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
        autor: AUTOR,
      },
    },
    async ({ titulo, coluna, descricao, projeto, autor }) => {
      try {
        return texto(criarCard({ titulo, coluna, descricao, projeto, autor }))
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
      description: 'Apaga um card. Ação destrutiva — prefira mover para "Concluído".',
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

  return s
}
