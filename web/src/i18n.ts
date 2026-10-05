// Idiomas da interface. O texto em português é a própria chave: `t('Salvar')`
// devolve "Salvar" em português e a tradução em inglês. Texto sem tradução
// aparece em português, então uma chave esquecida nunca quebra a tela.
//
// Nomes e mensagens que vêm do servidor (ações do histórico, estados, colunas
// padrão) continuam gravados em português, porque os agentes os usam pela API;
// aqui eles só são traduzidos na hora de mostrar.

export type Idioma = 'pt' | 'en'
export const IDIOMAS: { id: Idioma; nome: string }[] = [{ id: 'pt', nome: 'Português' }, { id: 'en', nome: 'English' }]

let idioma: Idioma = 'pt'

export function idiomaDoNavegador(): Idioma {
  return (typeof navigator !== 'undefined' && navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en'
}

/** Chamado pelo App a cada renderização, antes dos componentes lerem os textos. */
export function definirIdioma(valor: Idioma) { idioma = valor }

/** Localidade para datas, horas e ordenação. */
export function localidade() {
  if (idioma === 'pt') return 'pt-BR'
  const navegador = typeof navigator !== 'undefined' ? navigator.language || '' : ''
  return navegador.toLowerCase().startsWith('en') ? navegador : 'en-US'
}

export function t(texto: string, valores?: Record<string, string | number>) {
  let saida = idioma === 'en' ? EN[texto] ?? texto : texto
  if (valores) for (const [chave, valor] of Object.entries(valores)) saida = saida.replaceAll(`{${chave}}`, String(valor))
  return saida
}

/** Nomes criados pelo próprio servidor (quadro e colunas padrão). Nomes dados pelo usuário ficam como estão. */
export function tNome(nome: string) {
  return idioma === 'en' ? NOMES_PADRAO[nome] ?? nome : nome
}

/** Detalhe de um evento do histórico: só os formatos fixos são traduzidos. */
export function tDetalhe(acao: string, detalhe: string) {
  if (idioma !== 'en') return detalhe
  if (acao === 'moveu' && detalhe.startsWith('para ')) return `to ${tNome(detalhe.slice(5))}`
  // Nas outras ações o detalhe é texto de alguém (título, comentário, nome de tag): fica como está.
  return acao === 'reordenou' || acao === 'escolheu wallpaper' ? EN[detalhe] ?? detalhe : detalhe
}

export function dataHoraCurta(valor: string | Date) {
  return new Date(valor).toLocaleString(localidade(), { dateStyle: 'short', timeStyle: 'short' })
}

/** Mostra uma data do servidor (AAAA-MM-DD) no formato do idioma, sem deslocar o dia pelo fuso. */
export function dataDia(valor: string) {
  const [ano, mes, dia] = valor.split('-').map(Number)
  if (!ano || !mes || !dia) return valor
  return new Date(ano, mes - 1, dia).toLocaleDateString(localidade())
}

const NOMES_PADRAO: Record<string, string> = {
  'Principal': 'Main',
  'A fazer': 'To do',
  'Em andamento': 'In progress',
  'Revisão': 'Review',
  'Concluído': 'Done',
}

const EN: Record<string, string> = {
  // Geral
  'Fechar': 'Close',
  'Salvar': 'Save',
  'Cancelar': 'Cancel',
  'Criar': 'Create',
  'Apagar': 'Delete',
  'Remover': 'Remove',
  'Renomear': 'Rename',
  'Adicionar': 'Add',
  'Enviar': 'Send',
  'Carregando…': 'Loading…',
  'Salvando…': 'Saving…',
  'Sem projeto': 'No project',
  'Hoje': 'Today',
  'Atrasado': 'Overdue',
  'Nome': 'Name',

  // Tela inicial e conexão
  'Não consegui falar com o servidor.': 'Could not reach the server.',
  'Verifique se o servidor do quadro está no ar e se este computador o alcança. Tentaremos novamente automaticamente.': 'Check that the board server is running and that this computer can reach it. We will keep trying automatically.',
  'Carregando o quadro': 'Loading the board',
  'Buscando cards e atividade recente…': 'Fetching cards and recent activity…',
  'Não foi possível atualizar o quadro.': 'Could not refresh the board.',
  'Os últimos dados continuam visíveis. Tentando reconectar…': 'The latest data is still on screen. Trying to reconnect…',
  'A aparência foi aplicada, mas não pôde ser salva neste navegador. Tente remover o wallpaper ou liberar espaço.': 'The appearance was applied but could not be saved in this browser. Try removing the wallpaper or freeing some space.',
  'agent-board · espaço de trabalho': 'agent-board · workspace',
  'Quadro Kanban': 'Kanban board',

  // Menu de ajustes
  'Ajustes': 'Settings',
  'Ajustes (conexão interrompida)': 'Settings (connection lost)',
  'Desfazer': 'Undo',
  'Desfazendo…': 'Undoing…',
  'Arquivados': 'Archived',
  'Personalizar': 'Customize',
  'Conexão interrompida': 'Connection lost',
  'Atualização automática ativa': 'Auto-refresh on',
  '{n} de {total} cards': '{n} of {total} cards',
  '{total} cards': '{total} cards',
  'Fechar aviso': 'Dismiss notice',

  // Ações que podem ser desfeitas
  '{acao}. Você pode desfazer pelo botão ou Ctrl+Z.': '{acao}. You can undo with the button or Ctrl+Z.',
  'Desfeito: {acao}.': 'Undone: {acao}.',
  'Card movido': 'Card moved',
  'Card criado': 'Card created',
  'Card restaurado': 'Card restored',
  'Card arquivado': 'Card archived',
  'Descrição alterada': 'Description changed',

  // Coluna
  'Trabalho em curso': 'Work in progress',
  'Para conferir': 'Waiting for review',
  'Entregas registradas': 'Finished work',
  'Próximos passos': 'Next steps',
  'Soltar aqui': 'Drop here',
  'Nenhum card corresponde aos filtros nesta etapa.': 'No card matches the filters in this column.',
  'Nenhum card nesta etapa.': 'No cards in this column.',
  'Abrir {titulo}': 'Open {titulo}',
  'Próxima: {data}': 'Next: {data}',
  'Vence hoje': 'Due today',
  'Lembrete futuro': 'Upcoming reminder',
  'Carregando autoria…': 'Loading author…',
  'Título do card': 'Card title',
  '+ Adicionar card': '+ Add card',

  // Estados que o servidor devolve
  'ativa': 'active',
  'pausada': 'paused',
  'encerrada': 'ended',
  'futuro': 'upcoming',
  'hoje': 'today',
  'atrasado': 'overdue',
  'feito': 'done',

  // Painel do card
  'Contexto do card': 'Card details',
  'Não foi possível concluir a operação: {erro}': 'The operation could not be completed: {erro}',
  'Feche e abra o card para tentar novamente.': 'Close the card and open it again to retry.',
  'Carregando contexto e histórico…': 'Loading details and history…',
  'Este card está arquivado. O histórico foi preservado.': 'This card is archived. Its history was kept.',
  'Criado em': 'Created on',
  'Descrição': 'Description',
  'Contexto, critério de pronto, links…': 'Context, definition of done, links…',
  'A descrição é salva ao sair do campo.': 'The description is saved when you leave the field.',
  'Histórico': 'History',
  'Deixar uma nota…': 'Leave a note…',
  'Comentário': 'Comment',
  'Restaurar card': 'Restore card',
  'Arquivar card': 'Archive card',

  // Tags
  'Renomear {nome}': 'Rename {nome}',
  'Apagar {nome}': 'Delete {nome}',
  'Novo nome da tag': 'New tag name',
  'Apagar a tag {nome} de todos os cards?': 'Delete the tag {nome} from every card?',
  'Nova tag': 'New tag',
  'Criar e adicionar': 'Create and add',

  // Lembretes
  'Lembrete': 'Reminder',
  'Lembretes': 'Reminders',
  'Data e hora': 'Date and time',
  'Nota do lembrete': 'Reminder note',
  'Nota opcional': 'Optional note',
  'Salvar lembrete': 'Save reminder',
  'Marcar feito': 'Mark done',
  '+1 hora': '+1 hour',
  'Amanhã': 'Tomorrow',
  'Próxima semana': 'Next week',
  'Lembretes vencidos e de hoje': 'Overdue and today’s reminders',
  'Nenhum lembrete vencido ou para hoje.': 'No reminders overdue or due today.',

  // Repetição
  'Repetição': 'Repeat',
  'Frequência': 'Frequency',
  'Todo dia': 'Every day',
  'Toda semana': 'Every week',
  'Todo mês': 'Every month',
  'Dia': 'Day',
  'Dom': 'Sun', 'Seg': 'Mon', 'Ter': 'Tue', 'Qua': 'Wed', 'Qui': 'Thu', 'Sex': 'Fri', 'Sáb': 'Sat',
  'Salvar repetição': 'Save repeat',
  'Retomar': 'Resume',
  'Pausar': 'Pause',
  'Encerrar': 'End',
  'Ocorrência: {periodo}. Próxima: {proxima}. Ao concluir, cria um card em {coluna}. Alterações e pausa valem para a série inteira.': 'Occurrence: {periodo}. Next: {proxima}. Finishing it creates a card in {coluna}. Changes and pauses apply to the whole series.',

  // Arquivados
  'Cards arquivados': 'Archived cards',
  'Fora do quadro, sem perder o histórico': 'Off the board, history kept',
  'Fechar arquivados': 'Close archived cards',
  'Restaurar devolve o card à coluna de origem.': 'Restoring puts the card back in its original column.',
  'Buscar por título ou projeto': 'Search by title or project',
  'Carregando arquivados…': 'Loading archived cards…',
  'Nenhum card corresponde à busca.': 'No card matches the search.',
  'Nenhum card arquivado.': 'No archived cards.',
  'Restaurando…': 'Restoring…',
  'Restaurar': 'Restore',

  // Atividade
  'Atividade recente': 'Recent activity',
  'Nenhuma atividade registrada ainda.': 'No activity recorded yet.',

  // Busca
  'Buscar no quadro': 'Search the board',
  'Buscar cards': 'Search cards',
  'Buscando…': 'Searching…',
  '1 resultado': '1 result',
  '{n} resultados': '{n} results',
  'inclui arquivados': 'includes archived',
  'Arquivado': 'Archived',

  // Filtros
  'Filtros': 'Filters',
  'Filtrar cards': 'Filter cards',
  'Mostrar só': 'Show only',
  'Depende de mim': 'Waiting on me',
  'Cards na coluna {coluna}': 'Cards in the {coluna} column',
  'Com lembrete': 'With a reminder',
  'Tarefas repetidas': 'Recurring tasks',
  'Repetida': 'Recurring',
  'Nenhuma tag criada. Crie pelo painel de um card.': 'No tags yet. Create one from a card’s panel.',
  'Projeto': 'Project',
  'Autor': 'Author',
  'Coluna': 'Column',
  'Período': 'Period',
  'Qualquer data': 'Any date',
  '7 dias': '7 days',
  '30 dias': '30 days',
  'Contar o período pela data de': 'Count the period from the date of',
  'Alteração': 'Last change',
  'Criação': 'Creation',
  'Limpar filtros': 'Clear filters',
  'Limpar tudo': 'Clear all',
  'últimos {n} dias': 'last {n} days',
  ' (criação)': ' (creation)',
  'Remover filtro {nome}': 'Remove filter {nome}',

  // Identidade
  'Autor: {nome}': 'Author: {nome}',
  'Autoria não registrada no histórico': 'No author recorded in the history',
  'Sem autoria': 'No author',

  // Projetos
  'Projetos': 'Projects',
  'Todos os projetos': 'All projects',
  'Sem cards no quadro': 'No cards on the board',
  'Fixado no topo': 'Pinned to the top',
  'Tirar do topo': 'Unpin',
  'Fixar no topo': 'Pin to the top',
  'Voltar a mostrar': 'Show again',
  'Esconder da lista': 'Hide from the list',
  'Cor do projeto': 'Project colour',
  'Cor do projeto {nome}': 'Colour of project {nome}',
  'Ordenar projetos': 'Sort projects',
  'Recentes': 'Recent',
  'Mostrar escondidos': 'Show hidden',

  // Quadros
  'Quadros': 'Boards',
  'Novo nome do quadro {nome}': 'New name for the board {nome}',
  'Renomear o quadro {nome}': 'Rename the board {nome}',
  'É o único quadro': 'This is the only board',
  'Só dá para apagar um quadro sem cards': 'Only a board with no cards can be deleted',
  'Apagar quadro vazio': 'Delete empty board',
  'Apagar o quadro {nome}': 'Delete the board {nome}',
  'Nome do novo quadro': 'Name of the new board',
  'Novo quadro': 'New board',

  // Personalização
  'Personalizar quadro': 'Customize the board',
  'Seu espaço de trabalho': 'Your workspace',
  'Fechar personalização': 'Close customization',
  'Tema, idioma e largura ficam neste navegador. A galeria e o wallpaper escolhido são compartilhados entre navegadores.': 'Theme, language and width are kept in this browser. The gallery and the chosen wallpaper are shared between browsers.',
  'Idioma': 'Language',
  'Tema': 'Theme',
  'Escuro': 'Dark',
  'Claro': 'Light',
  'Cor do fundo': 'Background colour',
  'Ardósia': 'Slate',
  'Oceano': 'Ocean',
  'Ameixa': 'Plum',
  'Floresta': 'Forest',
  'Argila': 'Clay',
  'Enviar imagem ao servidor': 'Upload an image to the server',
  'JPG, PNG ou WebP, até 8 MB e 16 milhões de pixels. SVG não é aceito.': 'JPG, PNG or WebP, up to 8 MB and 16 million pixels. SVG is not accepted.',
  'Remover wallpaper': 'Remove wallpaper',
  'Salvando imagem…': 'Saving image…',
  'Escolher wallpaper de {autor}': 'Choose the wallpaper from {autor}',
  '✓ Atual': '✓ Current',
  'Escolher': 'Choose',
  'Largura das listas': 'List width',
  'Automática · preencher a tela': 'Automatic · fill the screen',
  'Ajustar à tela': 'Fit to screen',
  'Escolha uma imagem JPG, PNG ou WebP.': 'Choose a JPG, PNG or WebP image.',
  'A imagem deve ter até 8 MB.': 'The image must be 8 MB or smaller.',
  'Apagar esta imagem da galeria do servidor?': 'Delete this image from the server gallery?',
  'Prévia do wallpaper': 'Wallpaper preview',
  'Não foi possível carregar o wallpaper.': 'Could not load the wallpaper.',

  // Ações do histórico (gravadas pelo servidor)
  'criou': 'created',
  'editou': 'edited',
  'moveu': 'moved',
  'reordenou': 'reordered',
  'comentou': 'commented',
  'removeu': 'removed',
  'arquivou': 'archived',
  'restaurou': 'restored',
  'desfez': 'undid',
  'criou coluna': 'created column',
  'criou quadro': 'created board',
  'renomeou quadro': 'renamed board',
  'apagou quadro': 'deleted board',
  'criou tag': 'created tag',
  'renomeou tag': 'renamed tag',
  'apagou tag': 'deleted tag',
  'adicionou tag': 'added tag',
  'removeu tag': 'removed tag',
  'definiu lembrete': 'set reminder',
  'removeu lembrete': 'removed reminder',
  'concluiu lembrete': 'completed reminder',
  'adiou lembrete': 'snoozed reminder',
  'ocorrência de': 'occurrence of',
  'gerou ocorrência': 'created occurrence',
  'enviou wallpaper': 'uploaded wallpaper',
  'escolheu wallpaper': 'chose wallpaper',
  'apagou wallpaper': 'deleted wallpaper',
  'alterou projeto': 'changed project',
  'posição na mesma coluna': 'position within the same column',
  'Sem wallpaper': 'No wallpaper',
}
