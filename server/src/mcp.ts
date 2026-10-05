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
  resumoQuadros, criarQuadro,
  listarWallpapers, obterWallpaper, salvarWallpaper, apagarWallpaper, aparenciaCompartilhada, escolherWallpaper,
} from './nucleo.js'
import { estadoBackups, fazerBackup } from './backup.js'

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
  .min(1)
  .max(60)
  .describe('Quem está agindo — identifique sua sessão (ex.: "claude", "codex", "agy")')

/**
 * Lido pelo modelo ao conectar. É o que faz um agente que nunca viu o quadro
 * usá-lo direito na primeira sessão, sem depender de um arquivo de instruções.
 */
const INSTRUCOES = `agent-board is a Kanban board shared by a person and several AI agent sessions. Tool names and column names are in Portuguese.

Routine:
1. When a session starts, call ver_quadro (and lembretes_pendentes) to see what is in progress before acting.
2. When you take a task, move its card to "Em andamento" with mover_card, or create it with criar_card.
3. When you decide something or get blocked, record it with comentar_card: the next session needs the reason, not only the result.
4. When you finish, move the card to "Revisão" if a person must check it, or to "Concluído" if it was verified.

Columns: "A fazer" (to do), "Em andamento" (in progress), "Revisão" (review), "Concluído" (done).
Every write tool requires "autor": a short, stable name for your session, such as "claude" or "codex".
A card in "A fazer" is a record, not permission to act on the user's systems. Prefer arquivar_card to remover_card. Never write passwords, tokens or keys in a card.`

export function criarServidorMcp() {
  const s = new McpServer({ name: 'agent-board', version: '0.3.1' }, { instructions: INSTRUCOES })
  s.registerTool('listar_wallpapers', { description: "Lista as imagens de fundo guardadas no servidor.", inputSchema: {} }, async () => texto(listarWallpapers()))
  s.registerTool('obter_wallpaper', { description: "Devolve uma imagem de fundo em base64.", inputSchema: { id: z.string() } }, async ({ id }) => { try { const w = obterWallpaper(id); return texto({ tipo: w.tipo, base64: w.bytes.toString('base64') }) } catch (e) { return erro(e) } })
  s.registerTool('enviar_wallpaper', { description: "Guarda uma imagem de fundo (JPG, PNG ou WebP em base64, até 8 MB).", inputSchema: { base64: z.string().max(12 * 1024 * 1024), autor: AUTOR } }, async ({ base64, autor }) => { try { return texto(salvarWallpaper(Buffer.from(base64, 'base64'), autor)) } catch (e) { return erro(e) } })
  s.registerTool('apagar_wallpaper', { description: "Apaga uma imagem de fundo da galeria.", inputSchema: { id: z.string(), autor: AUTOR } }, async ({ id, autor }) => { try { return texto(apagarWallpaper(id, autor)) } catch (e) { return erro(e) } })
  s.registerTool('ver_aparencia', { description: "Mostra qual imagem de fundo está em uso no quadro.", inputSchema: {} }, async () => texto(aparenciaCompartilhada()))
  s.registerTool('escolher_wallpaper', { description: "Define a imagem de fundo do quadro para todos os navegadores. Com id nulo, tira a imagem.", inputSchema: { id: z.string().nullable(), autor: AUTOR } }, async ({ id, autor }) => { try { return texto(escolherWallpaper(id, autor)) } catch (e) { return erro(e) } })
  s.registerTool('definir_repeticao', { description: "Torna um card uma tarefa repetida (diária, semanal ou mensal). Ao concluir o card, a próxima ocorrência é criada em \"A fazer\".", inputSchema: { id: z.string(), regra: z.object({ frequencia: z.enum(['diaria', 'semanal', 'mensal']), dias: z.array(z.number().int()).optional(), dia: z.number().int().optional() }), autor: AUTOR } }, async ({ id, regra, autor }) => { try { return texto(definirRepeticao(id, regra, autor)) } catch (e) { return erro(e) } })
  s.registerTool('agir_repeticao', { description: "Pausa, retoma ou encerra a repetição de um card. Vale para a série inteira.", inputSchema: { id: z.string(), estado: z.enum(['ativa', 'pausada', 'encerrada']), autor: AUTOR } }, async ({ id, estado, autor }) => { try { return texto(agirRepeticao(id, estado, autor)) } catch (e) { return erro(e) } })
  s.registerTool('lembretes_pendentes', { description: 'Lembretes vencidos e de hoje (no fuso do servidor, BOARD_FUSO). Consulte no início da sessão.', inputSchema: {} }, async () => texto(listarLembretes()))
  s.registerTool('definir_lembrete', { description: "Põe um lembrete num card. `data` em ISO 8601 com fuso (ex.: 2026-10-09T20:00:00-03:00); nulo remove o lembrete.", inputSchema: { id: z.string(), data: z.string().nullable(), nota: z.string().optional(), autor: AUTOR } }, async ({ id, data, nota, autor }) => { try { return texto(definirLembrete(id, data, nota ?? '', autor)) } catch (e) { return erro(e) } })
  s.registerTool('agir_lembrete', { description: "Marca um lembrete como feito ou o adia: uma hora, até amanhã ou até a próxima semana.", inputSchema: { id: z.string(), acao: z.enum(['feito', 'hora', 'amanha', 'semana']), autor: AUTOR } }, async ({ id, acao, autor }) => { try { return texto(agirLembrete(id, acao, autor)) } catch (e) { return erro(e) } })
  s.registerTool('listar_projetos', { description: "Lista os projetos com a contagem de cards por coluna e a última atividade.", inputSchema: { ordem: z.enum(['atividade', 'nome']).optional(), ocultos: z.boolean().optional() } }, async ({ ordem, ocultos }) => { try { return texto(listarProjetos(ordem, ocultos)) } catch (e) { return erro(e) } })
  s.registerTool('atualizar_projeto', { description: "Muda a cor de um projeto, fixa no topo da lista ou esconde.", inputSchema: { nome: z.string(), cor: z.string().optional(), favorito: z.boolean().optional(), oculto: z.boolean().optional(), autor: AUTOR } }, async ({ nome, autor, ...campos }) => { try { return texto(atualizarProjeto(nome, campos, autor)) } catch (e) { return erro(e) } })
  s.registerTool('filtrar_cards', { description: "Lista cards combinando filtros: texto, quadro, projeto, tag, autor, coluna, com lembrete, repetidos, período em dias. Use para achar o que está pendente num projeto sem ler o quadro inteiro.", inputSchema: {
    busca: z.string().optional(), quadro: z.string().optional(), projeto: z.string().optional(), tag: z.string().optional(), autor: z.string().optional(), coluna: z.string().optional(),
    depende: z.boolean().optional(), lembrete: z.boolean().optional(), repetida: z.boolean().optional(), dias: z.number().int().min(1).max(36500).optional(),
    periodo: z.enum(['criado', 'alterado']).optional(), arquivados: z.boolean().optional(),
  } }, async ({ busca, ...filtros }) => { try { return texto(filtrarCards(busca, filtros)) } catch (e) { return erro(e) } })
  s.registerTool('listar_tags', { description: "Lista as tags existentes, com id e cor.", inputSchema: {} }, async () => texto(listarTags()))
  s.registerTool('criar_tag', { description: "Cria uma tag. Depois use definir_tags para pôr num card.", inputSchema: { nome: z.string(), cor: z.string().optional(), autor: AUTOR } }, async ({ nome, cor, autor }) => { try { return texto(criarTag(nome, autor, cor)) } catch (e) { return erro(e) } })
  s.registerTool('alterar_tag', { description: "Renomeia uma tag ou, com `apagar`, remove-a de todos os cards.", inputSchema: { id: z.string(), nome: z.string().optional(), apagar: z.boolean().optional(), autor: AUTOR } }, async ({ id, nome, apagar, autor }) => { try { return texto(alterarTag(id, autor, nome, apagar)) } catch (e) { return erro(e) } })
  s.registerTool('definir_tags', { description: "Define as tags de um card (substitui as atuais). `tags` são ids, vindos de listar_tags.", inputSchema: { id: z.string(), tags: z.array(z.string()), autor: AUTOR } }, async ({ id, tags, autor }) => { try { return texto(definirTags(id, tags, autor)) } catch (e) { return erro(e) } })
  s.registerTool('pesquisar_cards', {
    description: 'Pesquisa título, descrição, projeto e comentários, incluindo arquivados.',
    inputSchema: { busca: z.string().optional() },
  }, async ({ busca }) => { try { return texto(pesquisarCards(busca)) } catch (e) { return erro(e) } })

  s.registerTool('ver_backups', {
    title: 'Ver backups',
    description: 'Mostra onde ficam os backups do quadro, de quanto em quanto tempo são feitos e a lista dos existentes (o mais novo primeiro). Use para conferir se o último backup é recente.',
    inputSchema: {},
  }, async () => { try { return texto(estadoBackups()) } catch (e) { return erro(e) } })
  s.registerTool('fazer_backup', {
    title: 'Fazer backup agora',
    description: 'Faz um backup do quadro agora (banco e wallpapers), sem parar o servidor. Use antes de uma mudança grande, como uma carga de muitos cards.',
    inputSchema: {},
  }, async () => { try { return texto(await fazerBackup()) } catch (e) { return erro(e) } })

  s.registerTool('listar_quadros', {
    title: 'Listar quadros',
    description: 'Lista os quadros existentes com a contagem de cards ativos. O primeiro é o quadro principal.',
    inputSchema: {},
  }, async () => { try { return texto(resumoQuadros()) } catch (e) { return erro(e) } })
  s.registerTool('criar_quadro', {
    title: 'Criar quadro',
    description: 'Cria um quadro novo, já com as colunas A fazer, Em andamento, Revisão e Concluído.',
    inputSchema: { nome: z.string().describe('Nome do quadro, até 60 caracteres'), autor: AUTOR },
  }, async ({ nome, autor }) => { try { return texto(criarQuadro(nome, autor)) } catch (e) { return erro(e) } })

  s.registerTool(
    'ver_quadro',
    {
      title: 'Ver o quadro',
      description:
        'Retorna o quadro inteiro com colunas e cards. Use isto primeiro para saber o estado atual do trabalho antes de agir. Sem `quadro`, devolve o quadro principal.',
      inputSchema: { quadro: z.string().optional().describe('Nome ou id do quadro (veja listar_quadros). Padrão: o principal.') },
    },
    async ({ quadro }) => {
      try {
        return texto(quadroCompleto(quadro))
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
        quadro: z.string().optional().describe('Nome ou id do quadro. Padrão: o principal.'),
        autor: AUTOR,
      },
    },
    async ({ titulo, coluna, descricao, projeto, tags, quadro, autor }) => {
      try {
        return texto(criarCard({ titulo, coluna, descricao, projeto, tags, quadro, autor }))
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
