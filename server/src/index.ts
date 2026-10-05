import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { timingSafeEqual } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { semear } from './db.js'
import { criarServidorMcp } from './mcp.js'
import { agendarBackups, estadoBackups, fazerBackup, INTERVALO_HORAS, PASTA_BACKUP } from './backup.js'
import {
  quadroCompleto,
  obterCard,
  criarCard,
  atualizarCard,
  moverCard,
  comentar,
  removerCard,
  atividade,
  criarColuna,
  listarArquivados,
  arquivarCard,
  desfazerAcao,
  pesquisarCards,
  listarTags, criarTag, alterarTag, definirTags,
  filtrarCards,
  listarProjetos, atualizarProjeto,
  listarLembretes, definirLembrete, agirLembrete,
  definirRepeticao, agirRepeticao,
  resolverQuadro, resumoQuadros, criarQuadro, renomearQuadro, removerQuadro,
  listarWallpapers, obterWallpaper, salvarWallpaper, apagarWallpaper, aparenciaCompartilhada, escolherWallpaper,
} from './nucleo.js'

const PORTA = Number(process.env.BOARD_PORT ?? 8078)
const HOST = process.env.BOARD_HOST ?? '127.0.0.1'
const CHAVE = process.env.BOARD_API_KEY ?? ''

const lista = (valor: string | undefined) => (valor ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean)
const LOCAIS = ['127.0.0.1', 'localhost', '::1']
/** Origens de navegador autorizadas a chamar a API de outro endereço (CORS). Vazio = nenhuma. */
const ORIGENS = lista(process.env.BOARD_CORS_ORIGENS)
/** Nomes pelos quais o servidor pode ser chamado quando não há chave. */
const HOSTS = new Set([...LOCAIS, HOST.toLowerCase(), ...lista(process.env.BOARD_HOSTS)])
const ABERTO = process.env.BOARD_PERMITIR_ABERTO === '1'

// Sem chave, quem alcança a porta lê e escreve tudo. Fora de localhost isso só
// acontece se alguém pedir explicitamente.
if (!CHAVE && !LOCAIS.includes(HOST.toLowerCase()) && !ABERTO) {
  console.error(`Recusando iniciar: BOARD_HOST=${HOST} sem BOARD_API_KEY deixaria o quadro aberto para a rede.`)
  console.error('Defina BOARD_API_KEY, ou BOARD_PERMITIR_ABERTO=1 se a porta já estiver protegida por outro meio.')
  process.exit(1)
}

semear()

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '12mb' }))
// Por padrão não há CORS: a interface fala com a API pelo mesmo endereço (proxy).
if (ORIGENS.length) app.use(cors({ origin: ORIGENS }))

/**
 * Sem chave, a proteção é o endereço. Um site qualquer aberto no navegador
 * consegue mandar requisições para 127.0.0.1, então recusamos:
 *  - Host desconhecido (ataque de DNS rebinding);
 *  - origem de navegador que não seja a própria interface nem uma origem declarada.
 * Com chave definida nada disto se aplica: quem não tem a chave leva 401.
 */
function protegerSemChave(req: Request, res: Response, next: NextFunction) {
  if (CHAVE) return next()
  const host = (req.headers.host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase()
  if (!ABERTO && !HOSTS.has(host)) return res.status(403).json({ erro: 'host não permitido; defina BOARD_HOSTS ou BOARD_API_KEY' })
  const origem = req.headers.origin?.toLowerCase()
  if (origem && !ORIGENS.includes(origem)) {
    let hostOrigem = ''
    try { hostOrigem = new URL(origem).hostname.replace(/^\[|\]$/g, '') } catch { /* origem malformada: recusa abaixo */ }
    if (hostOrigem !== host) return res.status(403).json({ erro: 'origem não permitida; defina BOARD_CORS_ORIGENS ou BOARD_API_KEY' })
  }
  next()
}

/** Exige a chave quando BOARD_API_KEY está definida. Comparação em tempo constante. */
function autenticar(req: Request, res: Response, next: NextFunction) {
  if (!CHAVE) return next()
  const enviada = Buffer.from((req.header('authorization') ?? '').replace(/^Bearer\s+/i, ''))
  const esperada = Buffer.from(CHAVE)
  if (enviada.length !== esperada.length || !timingSafeEqual(enviada, esperada)) return res.status(401).json({ erro: 'não autorizado' })
  next()
}

const autor = (req: Request) => String(req.header('x-autor') || req.body?.autor || 'web').trim() || 'web'

app.get('/saude', (_req, res) => res.json({ ok: true }))

// ---------- API REST (consumida pela interface) ----------

const api = express.Router()
api.use(protegerSemChave, autenticar)

api.get('/quadro', (req, res) => res.json(quadroCompleto(req.query.id?.toString() || req.query.quadro?.toString())))
api.get('/quadros', (_req, res) => res.json(resumoQuadros()))
api.post('/quadros', (req, res) => res.status(201).json(criarQuadro(req.body?.nome, autor(req))))
api.patch('/quadros/:id', (req, res) => res.json(renomearQuadro(req.params.id, req.body?.nome, autor(req))))
api.delete('/quadros/:id', (req, res) => res.json(removerQuadro(req.params.id, autor(req))))
api.get('/atividade', (req, res) => res.json(atividade(Number(req.query.limite ?? 50))))
api.get('/backups', (_req, res) => res.json(estadoBackups()))
api.post('/backups', async (_req, res) => {
  try { res.status(201).json(await fazerBackup()) }
  catch (e) { res.status(500).json({ erro: `backup falhou: ${(e as Error).message}` }) }
})

api.get('/arquivados', (_req, res) => res.json(listarArquivados()))
api.get('/cards', (req, res) => res.json(filtrarCards(String(req.query.busca ?? ''), {
  quadro: req.query.quadro?.toString(), projeto: req.query.projeto?.toString(), tag: req.query.tag?.toString(), autor: req.query.autor?.toString(), coluna: req.query.coluna?.toString(),
  depende: req.query.depende === 'true', lembrete: req.query.lembrete === 'true', repetida: req.query.repetida === 'true',
  dias: req.query.dias === undefined ? undefined : Number(req.query.dias), periodo: req.query.periodo === 'criado' ? 'criado' : 'alterado', arquivados: req.query.arquivados !== 'false',
})))
api.get('/tags', (_req, res) => res.json(listarTags()))
api.get('/wallpapers', (_req, res) => res.json(listarWallpapers()))
api.post('/wallpapers', express.raw({ type: '*/*', limit: '8mb' }), (req, res) => {
  if (!Buffer.isBuffer(req.body)) throw new Error('Envie os bytes da imagem no corpo da requisição.')
  res.status(201).json(salvarWallpaper(req.body, autor(req)))
})
api.get('/wallpapers/:id/arquivo', (req, res) => { const w = obterWallpaper(req.params.id); res.set('X-Content-Type-Options', 'nosniff').type(w.tipo).send(w.bytes) })
api.delete('/wallpapers/:id', (req, res) => res.json(apagarWallpaper(req.params.id, autor(req))))
api.get('/aparencia', (_req, res) => res.json(aparenciaCompartilhada()))
api.put('/aparencia', (req, res) => res.json(escolherWallpaper(req.body.wallpaper ?? null, autor(req))))
api.get('/lembretes', (_req, res) => res.json(listarLembretes()))
api.put('/cards/:id/repeticao', (req, res) => res.json(definirRepeticao(req.params.id, req.body.regra, autor(req), req.body.revisao)))
api.post('/cards/:id/repeticao', (req, res) => res.json(agirRepeticao(req.params.id, req.body.estado, autor(req), req.body.revisao)))
api.put('/cards/:id/lembrete', (req, res) => res.json(definirLembrete(req.params.id, req.body.data ?? null, req.body.nota ?? '', autor(req), req.body.revisao)))
api.post('/cards/:id/lembrete', (req, res) => res.json(agirLembrete(req.params.id, req.body.acao, autor(req), req.body.revisao)))
api.get('/projetos', (req, res) => res.json(listarProjetos(req.query.ordem === 'nome' ? 'nome' : 'atividade', req.query.ocultos === 'true', req.query.quadro?.toString())))
api.patch('/projetos/:nome', (req, res) => res.json(atualizarProjeto(req.params.nome, req.body, autor(req))))
api.post('/tags', (req, res) => res.status(201).json(criarTag(req.body.nome, autor(req), req.body.cor)))
api.patch('/tags/:id', (req, res) => res.json(alterarTag(req.params.id, autor(req), req.body.nome)))
api.delete('/tags/:id', (req, res) => res.json(alterarTag(req.params.id, autor(req), undefined, true)))
api.put('/cards/:id/tags', (req, res) => res.json(definirTags(req.params.id, req.body.tags, autor(req), req.body.revisao)))

api.get('/cards/:id', (req, res) => {
  const c = obterCard(req.params.id)
  return c ? res.json(c) : res.status(404).json({ erro: 'card não encontrado' })
})

api.post('/cards', (req, res) => {
  try {
    const { titulo, coluna, colunaId, descricao, projeto, tags, quadro } = req.body ?? {}
    if (!titulo?.trim()) return res.status(400).json({ erro: 'título é obrigatório' })
    res.status(201).json(criarCard({ titulo, coluna, colunaId, descricao, projeto, tags, quadro, autor: autor(req) }))
  } catch (e) {
    res.status(400).json({ erro: (e as Error).message })
  }
})

api.patch('/cards/:id', (req, res) => {
  try {
    res.json(atualizarCard(req.params.id, req.body ?? {}, autor(req), req.body?.revisao))
  } catch (e) {
    res.status(400).json({ erro: (e as Error).message })
  }
})

api.post('/cards/:id/mover', (req, res) => {
  try {
    const { coluna, colunaId, posicao } = req.body ?? {}
    res.json(moverCard(req.params.id, { coluna, colunaId, posicao }, autor(req), req.body?.revisao))
  } catch (e) {
    res.status(400).json({ erro: (e as Error).message })
  }
})

api.post('/cards/:id/comentarios', (req, res) => {
  try {
    const { texto } = req.body ?? {}
    if (!texto?.trim()) return res.status(400).json({ erro: 'texto é obrigatório' })
    res.json(comentar(req.params.id, autor(req), texto))
  } catch (e) {
    res.status(400).json({ erro: (e as Error).message })
  }
})

for (const rota of ['arquivar', 'restaurar'] as const) {
  api.post(`/cards/:id/${rota}`, (req, res) => {
    try { res.json(arquivarCard(req.params.id, autor(req), rota === 'restaurar', req.body?.revisao)) }
    catch (e) { res.status(409).json({ erro: (e as Error).message }) }
  })
}
api.post('/acoes/:id/desfazer', (req, res) => {
  try { res.json(desfazerAcao(req.params.id, autor(req))) }
  catch (e) { res.status(409).json({ erro: (e as Error).message }) }
})

api.delete('/cards/:id', (req, res) => {
  try {
    res.json(removerCard(req.params.id, autor(req)))
  } catch (e) {
    res.status(400).json({ erro: (e as Error).message })
  }
})

api.post('/colunas', (req, res) => {
  try {
    const { nome } = req.body ?? {}
    if (!nome?.trim()) return res.status(400).json({ erro: 'nome é obrigatório' })
    res.status(201).json(criarColuna(resolverQuadro(req.body?.quadro).id, nome, autor(req)))
  } catch (e) {
    res.status(400).json({ erro: (e as Error).message })
  }
})

app.use('/api', api)
app.use((e: Error, _req: Request, res: Response, _next: NextFunction) => { res.status(400).json({ erro: e.message }) })

// ---------- MCP (consumido pelas sessões de IA) ----------
// Stateless: cada requisição cria seu próprio transporte. Simples e sem estado
// de sessão para expirar — o custo é não suportar notificações do servidor,
// que este quadro não usa.

app.post('/mcp', protegerSemChave, autenticar, async (req, res) => {
  try {
    const servidor = criarServidorMcp()
    const transporte = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => {
      transporte.close()
      servidor.close()
    })
    await servidor.connect(transporte)
    await transporte.handleRequest(req, res, req.body)
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ erro: (e as Error).message })
  }
})

app.listen(PORTA, HOST, () => {
  console.log(`agent-board em http://${HOST}:${PORTA}`)
  console.log(`  API  /api/quadro`)
  console.log(`  MCP  /mcp`)
  if (!CHAVE) {
    console.log('  ⚠️  BOARD_API_KEY não definida — servidor SEM autenticação.')
    console.log(ABERTO ? '  ⚠️  BOARD_PERMITIR_ABERTO=1: qualquer um que alcance esta porta lê e escreve.' : '      Aceita só chamadas feitas a este próprio endereço (localhost).')
  }
  console.log(agendarBackups()
    ? `  Backup automático a cada ${INTERVALO_HORAS} h em ${PASTA_BACKUP}`
    : '  ⚠️  Backup automático desligado (BOARD_BACKUP_HORAS=0).')
})
