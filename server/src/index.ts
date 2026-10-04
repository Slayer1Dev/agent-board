import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { semear } from './db.js'
import { criarServidorMcp } from './mcp.js'
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
  quadroPadrao,
  listarArquivados,
  arquivarCard,
  desfazerAcao,
  pesquisarCards,
  listarTags, criarTag, alterarTag, definirTags,
  filtrarCards,
} from './nucleo.js'

const PORTA = Number(process.env.BOARD_PORT ?? 8078)
const HOST = process.env.BOARD_HOST ?? '127.0.0.1'
const CHAVE = process.env.BOARD_API_KEY ?? ''

semear()

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(cors())

/**
 * Exige a chave quando BOARD_API_KEY está definida. Sem chave configurada o
 * servidor sobe aberto — aceitável apenas em 127.0.0.1, e avisado na inicialização.
 */
function autenticar(req: Request, res: Response, next: NextFunction) {
  if (!CHAVE) return next()
  const cabecalho = req.header('authorization') ?? ''
  const enviada = cabecalho.replace(/^Bearer\s+/i, '')
  if (enviada !== CHAVE) return res.status(401).json({ erro: 'não autorizado' })
  next()
}

const autor = (req: Request) => (req.header('x-autor') || req.body?.autor || 'web') as string

app.get('/saude', (_req, res) => res.json({ ok: true }))

// ---------- API REST (consumida pela interface) ----------

const api = express.Router()
api.use(autenticar)

api.get('/quadro', (_req, res) => res.json(quadroCompleto()))
api.get('/atividade', (req, res) => res.json(atividade(Number(req.query.limite ?? 50))))

api.get('/arquivados', (_req, res) => res.json(listarArquivados()))
api.get('/cards', (req, res) => res.json(filtrarCards(String(req.query.busca ?? ''), {
  projeto: req.query.projeto?.toString(), tag: req.query.tag?.toString(), autor: req.query.autor?.toString(), coluna: req.query.coluna?.toString(),
  depende: req.query.depende === 'true', lembrete: req.query.lembrete === 'true', repetida: req.query.repetida === 'true',
  dias: req.query.dias === undefined ? undefined : Number(req.query.dias), periodo: req.query.periodo === 'criado' ? 'criado' : 'alterado', arquivados: req.query.arquivados !== 'false',
})))
api.get('/tags', (_req, res) => res.json(listarTags()))
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
    const { titulo, coluna, colunaId, descricao, projeto, tags } = req.body ?? {}
    if (!titulo?.trim()) return res.status(400).json({ erro: 'título é obrigatório' })
    res.status(201).json(criarCard({ titulo, coluna, colunaId, descricao, projeto, tags, autor: autor(req) }))
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
    res.status(201).json(criarColuna(quadroPadrao().id, nome, autor(req)))
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

app.post('/mcp', autenticar, async (req, res) => {
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
    if (HOST !== '127.0.0.1') console.log('  ⚠️  E exposto fora de localhost. Defina uma chave.')
  }
})
