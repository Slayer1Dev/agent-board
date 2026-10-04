import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  quadroCompleto,
  obterCard,
  criarCard,
  atualizarCard,
  moverCard,
  comentar,
  removerCard,
  atividade,
  listarArquivados,
  arquivarCard,
  desfazerAcao,
  pesquisarCards,
  listarTags, criarTag, alterarTag, definirTags,
  filtrarCards,
  listarProjetos, atualizarProjeto,
  listarLembretes, definirLembrete, agirLembrete,
  definirRepeticao, agirRepeticao,
  listarWallpapers, obterWallpaper, salvarWallpaper, apagarWallpaper, aparenciaCompartilhada, escolherWallpaper,
} from './nucleo.js'

const texto = (valor: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(valor, null, 2) }],
})

const erro = (e: unknown) => ({
  content: [{ type: 'text' as const, text: `erro: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
})

/**
 * O campo `autor` aparece em toda ferramenta de escrita de propósito: sem ele o
 * quadro vira um estado sem história, e o objetivo aqui é justamente saber qual
 * sessão fez o quê.
 */
const AUTOR = z
  .string()
  .describe('Quem está agindo — identifique sua sessão (ex.: "claude", "codex", "agy")')

export function criarServidorMcp() {
  const s = new McpServer({ name: 'agent-board', version: '0.1.0' })
  s.registerTool('listar_wallpapers', { inputSchema: {} }, async () => texto(listarWallpapers()))
  s.registerTool('obter_wallpaper', { inputSchema: { id: z.string() } }, async ({ id }) => { try { const w = obterWallpaper(id); return texto({ tipo: w.tipo, base64: w.bytes.toString('base64') }) } catch (e) { return erro(e) } })
  s.registerTool('enviar_wallpaper', { inputSchema: { base64: z.string().max(12 * 1024 * 1024), autor: AUTOR } }, async ({ base64, autor }) => { try { return texto(salvarWallpaper(Buffer.from(base64, 'base64'), autor)) } catch (e) { return erro(e) } })
  s.registerTool('apagar_wallpaper', { inputSchema: { id: z.string(), autor: AUTOR } }, async ({ id, autor }) => { try { return texto(apagarWallpaper(id, autor)) } catch (e) { return erro(e) } })
  s.registerTool('ver_aparencia', { inputSchema: {} }, async () => texto(aparenciaCompartilhada()))
  s.registerTool('escolher_wallpaper', { inputSchema: { id: z.string().nullable(), autor: AUTOR } }, async ({ id, autor }) => { try { return texto(escolherWallpaper(id, autor)) } catch (e) { return erro(e) } })
  s.registerTool('definir_repeticao', { inputSchema: { id: z.string(), regra: z.object({ frequencia: z.enum(['diaria', 'semanal', 'mensal']), dias: z.array(z.number().int()).optional(), dia: z.number().int().optional() }), autor: AUTOR } }, async ({ id, regra, autor }) => { try { return texto(definirRepeticao(id, regra, autor)) } catch (e) { return erro(e) } })
  s.registerTool('agir_repeticao', { inputSchema: { id: z.string(), estado: z.enum(['ativa', 'pausada', 'encerrada']), autor: AUTOR } }, async ({ id, estado, autor }) => { try { return texto(agirRepeticao(id, estado, autor)) } catch (e) { return erro(e) } })
  s.registerTool('lembretes_pendentes', { description: 'Lembretes vencidos e de hoje em São Paulo. Consultar no início da sessão.', inputSchema: {} }, async () => texto(listarLembretes()))
  s.registerTool('definir_lembrete', { inputSchema: { id: z.string(), data: z.string().nullable(), nota: z.string().optional(), autor: AUTOR } }, async ({ id, data, nota, autor }) => { try { return texto(definirLembrete(id, data, nota ?? '', autor)) } catch (e) { return erro(e) } })
  s.registerTool('agir_lembrete', { inputSchema: { id: z.string(), acao: z.enum(['feito', 'hora', 'amanha', 'semana']), autor: AUTOR } }, async ({ id, acao, autor }) => { try { return texto(agirLembrete(id, acao, autor)) } catch (e) { return erro(e) } })
  s.registerTool('listar_projetos', { inputSchema: { ordem: z.enum(['atividade', 'nome']).optional(), ocultos: z.boolean().optional() } }, async ({ ordem, ocultos }) => { try { return texto(listarProjetos(ordem, ocultos)) } catch (e) { return erro(e) } })
  s.registerTool('atualizar_projeto', { inputSchema: { nome: z.string(), cor: z.string().optional(), favorito: z.boolean().optional(), oculto: z.boolean().optional(), autor: AUTOR } }, async ({ nome, autor, ...campos }) => { try { return texto(atualizarProjeto(nome, campos, autor)) } catch (e) { return erro(e) } })
  s.registerTool('filtrar_cards', { inputSchema: {
    busca: z.string().optional(), projeto: z.string().optional(), tag: z.string().optional(), autor: z.string().optional(), coluna: z.string().optional(),
    depende: z.boolean().optional(), lembrete: z.boolean().optional(), repetida: z.boolean().optional(), dias: z.number().int().min(1).max(36500).optional(),
    periodo: z.enum(['criado', 'alterado']).optional(), arquivados: z.boolean().optional(),
  } }, async ({ busca, ...filtros }) => { try { return texto(filtrarCards(busca, filtros)) } catch (e) { return erro(e) } })
  s.registerTool('listar_tags', { inputSchema: {} }, async () => texto(listarTags()))
  s.registerTool('criar_tag', { inputSchema: { nome: z.string(), cor: z.string().optional(), autor: AUTOR } }, async ({ nome, cor, autor }) => { try { return texto(criarTag(nome, autor, cor)) } catch (e) { return erro(e) } })
  s.registerTool('alterar_tag', { inputSchema: { id: z.string(), nome: z.string().optional(), apagar: z.boolean().optional(), autor: AUTOR } }, async ({ id, nome, apagar, autor }) => { try { return texto(alterarTag(id, autor, nome, apagar)) } catch (e) { return erro(e) } })
  s.registerTool('definir_tags', { inputSchema: { id: z.string(), tags: z.array(z.string()), autor: AUTOR } }, async ({ id, tags, autor }) => { try { return texto(definirTags(id, tags, autor)) } catch (e) { return erro(e) } })
  s.registerTool('pesquisar_cards', {
    description: 'Pesquisa título, descrição, projeto e comentários, incluindo arquivados.',
    inputSchema: { busca: z.string().optional() },
  }, async ({ busca }) => { try { return texto(pesquisarCards(busca)) } catch (e) { return erro(e) } })

  s.registerTool(
    'ver_quadro',
    {
      title: 'Ver o quadro',
      description:
        'Retorna o quadro inteiro com colunas e cards. Use isto primeiro para saber o estado atual do trabalho antes de agir.',
      inputSchema: {},
    },
    async () => {
      try {
        return texto(quadroCompleto())
      } catch (e) {
        return erro(e)
      }
    },
  )

  s.registerTool(
    'ver_card',
    {
      title: 'Ver um card',
      description: 'Detalhes de um card, incluindo todo o histórico de quem mexeu nele.',
      inputSchema: { id: z.string().describe('ID do card') },
    },
    async ({ id }) => {
      try {
        const c = obterCard(id)
        return c ? texto(c) : erro(new Error('card não encontrado'))
      } catch (e) {
        return erro(e)
      }
    },
  )

  s.registerTool(
    'criar_card',
    {
      title: 'Criar card',
      description: 'Cria um card. A coluna pode ser indicada pelo nome (ex.: "A fazer").',
      inputSchema: {
        titulo: z.string().describe('Título curto e acionável'),
        coluna: z.string().optional().describe('Nome da coluna. Padrão: a primeira.'),
        descricao: z.string().optional().describe('Contexto, critério de pronto, links'),
        projeto: z.string().optional().describe('A qual projeto pertence'),
        tags: z.array(z.string()).optional().describe('IDs das tags'),
        autor: AUTOR,
      },
    },
    async ({ titulo, coluna, descricao, projeto, tags, autor }) => {
      try {
        return texto(criarCard({ titulo, coluna, descricao, projeto, tags, autor }))
      } catch (e) {
        return erro(e)
      }
    },
  )

  s.registerTool(
    'mover_card',
    {
      title: 'Mover card',
      description:
        'Move um card para outra coluna — é assim que se reporta progresso (ex.: para "Em andamento" ao começar, "Concluído" ao terminar).',
      inputSchema: {
        id: z.string().describe('ID do card'),
        coluna: z.string().describe('Nome da coluna de destino'),
        autor: AUTOR,
      },
    },
    async ({ id, coluna, autor }) => {
      try {
        return texto(moverCard(id, { coluna }, autor))
      } catch (e) {
        return erro(e)
      }
    },
  )

  s.registerTool(
    'atualizar_card',
    {
      title: 'Atualizar card',
      description: 'Edita título, descrição ou projeto de um card.',
      inputSchema: {
        id: z.string(),
        titulo: z.string().optional(),
        descricao: z.string().optional(),
        projeto: z.string().optional(),
        autor: AUTOR,
      },
    },
    async ({ id, titulo, descricao, projeto, autor }) => {
      try {
        return texto(atualizarCard(id, { titulo, descricao, projeto }, autor))
      } catch (e) {
        return erro(e)
      }
    },
  )

  s.registerTool(
    'comentar_card',
    {
      title: 'Comentar no card',
      description:
        'Deixa uma nota no histórico do card. Use para registrar decisão, bloqueio ou achado que a próxima sessão precise saber.',
      inputSchema: {
        id: z.string(),
        texto: z.string().describe('O comentário'),
        autor: AUTOR,
      },
    },
    async ({ id, texto: t, autor }) => {
      try {
        return texto(comentar(id, autor, t))
      } catch (e) {
        return erro(e)
      }
    },
  )

  s.registerTool(
    'remover_card',
    {
      title: 'Remover card',
      description: 'Apaga um card. Ação destrutiva — prefira arquivar_card, que preserva o histórico.',
      inputSchema: { id: z.string(), autor: AUTOR },
      annotations: { destructiveHint: true },
    },
    async ({ id, autor }) => {
      try {
        return texto(removerCard(id, autor))
      } catch (e) {
        return erro(e)
      }
    },
  )

  s.registerTool(
    'atividade_recente',
    {
      title: 'Atividade recente',
      description:
        'O que mudou no quadro e quem mudou, do mais recente ao mais antigo. Use no início da sessão para se situar.',
      inputSchema: { limite: z.number().int().min(1).max(200).optional() },
    },
    async ({ limite }) => {
      try {
        return texto(atividade(limite ?? 50))
      } catch (e) {
        return erro(e)
      }
    },
  )

  s.registerTool('ver_arquivados', {
    title: 'Ver cards arquivados', description: 'Cards fora do quadro, preservados com todo o histórico e disponíveis para restaurar.', inputSchema: {},
  }, async () => { try { return texto(listarArquivados()) } catch (e) { return erro(e) } })
  for (const restaurar of [false, true]) {
    s.registerTool(restaurar ? 'restaurar_card' : 'arquivar_card', {
      title: restaurar ? 'Restaurar card' : 'Arquivar card',
      description: restaurar ? 'Devolve um card arquivado à sua coluna original.' : 'Retira um card do quadro sem apagar o histórico. Reversível por restaurar_card.',
      inputSchema: { id: z.string(), autor: AUTOR },
    }, async ({ id, autor }) => { try { return texto(arquivarCard(id, autor, restaurar)) } catch (e) { return erro(e) } })
  }
  s.registerTool('desfazer_acao', {
    title: 'Desfazer ação', description: 'Desfaz por acao_id retornado na escrita. Exige mesmo autor e recusa se o card mudou depois. Criação é desfeita por arquivamento; comentários não são apagados.',
    inputSchema: { id: z.string(), autor: AUTOR },
  }, async ({ id, autor }) => { try { return texto(desfazerAcao(id, autor)) } catch (e) { return erro(e) } })

  return s
}
