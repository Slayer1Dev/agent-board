import { db, uid, registrar, proximaPosicao } from './db.js'

export type Card = {
  id: string
  coluna_id: string
  titulo: string
  descricao: string
  posicao: number
  projeto: string | null
  criado_em: string
  atualizado_em: string
  arquivado_em: string | null
  revisao: number
  acao_id?: string
}

export type Coluna = { id: string; quadro_id: string; nome: string; posicao: number }
export type Quadro = { id: string; nome: string; criado_em: string }

/** Operações usadas tanto pela API REST quanto pelas ferramentas MCP. */

export function listarQuadros(): Quadro[] {
  return db.prepare('SELECT * FROM quadros ORDER BY criado_em').all() as Quadro[]
}

export function quadroPadrao(): Quadro {
  const q = db.prepare('SELECT * FROM quadros ORDER BY criado_em LIMIT 1').get() as Quadro
  if (!q) throw new Error('nenhum quadro existe')
  return q
}

export function listarColunas(quadroId: string): Coluna[] {
  return db
    .prepare('SELECT * FROM colunas WHERE quadro_id = ? ORDER BY posicao')
    .all(quadroId) as Coluna[]
}

export function listarCards(colunaId: string): Card[] {
  return db
    .prepare('SELECT * FROM cards WHERE coluna_id = ? AND arquivado_em IS NULL ORDER BY posicao')
    .all(colunaId) as Card[]
}

/** Quadro inteiro em uma chamada — é o que a UI e o MCP pedem com mais frequência. */
export function quadroCompleto(quadroId?: string) {
  const quadro = quadroId
    ? (db.prepare('SELECT * FROM quadros WHERE id = ?').get(quadroId) as Quadro)
    : quadroPadrao()
  if (!quadro) throw new Error('quadro não encontrado')

  return {
    ...quadro,
    colunas: listarColunas(quadro.id).map((c) => ({ ...c, cards: listarCards(c.id) })),
  }
}

export function obterCard(id: string) {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Card | undefined
  if (!card) return null
  const eventos = db
    .prepare('SELECT autor, acao, detalhe, criado_em FROM eventos WHERE card_id = ? ORDER BY criado_em, rowid')
    .all(id)
  return { ...card, eventos }
}

function criarCardOriginal(opts: {
  colunaId?: string
  coluna?: string
  titulo: string
  descricao?: string
  projeto?: string
  autor: string
}): Card {
  let colunaId = opts.colunaId

  // Aceita o nome da coluna ("A fazer") além do id — as sessões de IA
  // raramente têm o id à mão, e exigir isso tornaria a ferramenta chata de usar.
  if (!colunaId && opts.coluna) {
    const q = quadroPadrao()
    const c = db
      .prepare('SELECT id FROM colunas WHERE quadro_id = ? AND nome = ? COLLATE NOCASE')
      .get(q.id, opts.coluna) as { id: string } | undefined
    if (!c) throw new Error(`coluna "${opts.coluna}" não existe`)
    colunaId = c.id
  }

  if (!colunaId) colunaId = listarColunas(quadroPadrao().id)[0]?.id
  if (!colunaId) throw new Error('nenhuma coluna disponível')

  const id = uid()
  db.prepare(
    `INSERT INTO cards (id, coluna_id, titulo, descricao, posicao, projeto)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, colunaId, opts.titulo, opts.descricao ?? '', proximaPosicao(colunaId), opts.projeto ?? null)

  registrar(id, opts.autor, 'criou', opts.titulo)
  return db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Card
}

function atualizarCardOriginal(
  id: string,
  campos: { titulo?: string; descricao?: string; projeto?: string | null },
  autor: string,
): Card {
  const atual = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Card | undefined
  if (!atual) throw new Error('card não encontrado')

  const mudancas: string[] = []
  if (campos.titulo !== undefined && campos.titulo !== atual.titulo) mudancas.push('título')
  if (campos.descricao !== undefined && campos.descricao !== atual.descricao) mudancas.push('descrição')
  if (campos.projeto !== undefined && campos.projeto !== atual.projeto) mudancas.push('projeto')

  db.prepare(
    `UPDATE cards SET titulo = ?, descricao = ?, projeto = ?, atualizado_em = datetime('now')
     WHERE id = ?`,
  ).run(
    campos.titulo ?? atual.titulo,
    campos.descricao ?? atual.descricao,
    campos.projeto !== undefined ? campos.projeto : atual.projeto,
    id,
  )

  if (mudancas.length) registrar(id, autor, 'editou', mudancas.join(', '))
  return db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Card
}

function moverCardOriginal(
  id: string,
  destino: { colunaId?: string; coluna?: string; posicao?: number },
  autor: string,
): Card {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Card | undefined
  if (!card) throw new Error('card não encontrado')

  let colunaId = destino.colunaId
  if (!colunaId && destino.coluna) {
    const q = quadroPadrao()
    const c = db
      .prepare('SELECT id FROM colunas WHERE quadro_id = ? AND nome = ? COLLATE NOCASE')
      .get(q.id, destino.coluna) as { id: string } | undefined
    if (!c) throw new Error(`coluna "${destino.coluna}" não existe`)
    colunaId = c.id
  }
  colunaId ??= card.coluna_id

  const posicao = destino.posicao ?? proximaPosicao(colunaId)
  db.prepare(
    `UPDATE cards SET coluna_id = ?, posicao = ?, atualizado_em = datetime('now') WHERE id = ?`,
  ).run(colunaId, posicao, id)

  if (colunaId !== card.coluna_id) {
    const nome = (db.prepare('SELECT nome FROM colunas WHERE id = ?').get(colunaId) as { nome: string })
      ?.nome
    registrar(id, autor, 'moveu', `para ${nome}`)
  } else if (posicao !== card.posicao) {
    registrar(id, autor, 'reordenou', 'posição na mesma coluna')
  }

  return db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Card
}

function comentarOriginal(cardId: string, autor: string, texto: string) {
  const existe = db.prepare('SELECT 1 FROM cards WHERE id = ?').get(cardId)
  if (!existe) throw new Error('card não encontrado')
  registrar(cardId, autor, 'comentou', texto)
  return { ok: true }
}

export function removerCard(id: string, autor: string) {
  const card = db.prepare('SELECT titulo FROM cards WHERE id = ?').get(id) as
    | { titulo: string }
    | undefined
  if (!card) throw new Error('card não encontrado')
  registrar(null, autor, 'removeu', card.titulo)
  db.prepare('DELETE FROM cards WHERE id = ?').run(id)
  return { ok: true }
}

/** Atividade recente — o "o que aconteceu desde a última vez" de uma sessão. */
export function atividade(limite = 50) {
  return db
    .prepare(
      `SELECT e.autor, e.acao, e.detalhe, e.criado_em, c.titulo AS card_titulo
       FROM eventos e LEFT JOIN cards c ON c.id = e.card_id
       ORDER BY e.criado_em DESC, e.rowid DESC LIMIT ?`,
    )
    .all(limite)
}

export function criarColuna(quadroId: string, nome: string, autor: string): Coluna {
  const r = db
    .prepare('SELECT MAX(posicao) AS m FROM colunas WHERE quadro_id = ?')
    .get(quadroId) as { m: number | null }
  const id = uid()
  db.prepare('INSERT INTO colunas (id, quadro_id, nome, posicao) VALUES (?, ?, ?, ?)').run(
    id,
    quadroId,
    nome,
    (r.m ?? 0) + 1000,
  )
  registrar(null, autor, 'criou coluna', nome)
  return db.prepare('SELECT * FROM colunas WHERE id = ?').get(id) as Coluna
}


type Acao = {
  id: string; card_id: string; autor: string; tipo: string;
  antes: string | null; depois: string; revisao_esperada: number; desfeita_em: string | null
}
function lerCard(id: string) {
  return db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Card | undefined
}
function exigirCard(id: string, revisao?: number) {
  const card = lerCard(id)
  if (!card) throw new Error('card não encontrado')
  if (revisao !== undefined && revisao !== card.revisao) throw new Error('O card mudou em outra sessão. Abra novamente antes de alterar.')
  return card
}
function alterar(id: string | null, autor: string, tipo: string, executar: () => Card): Card {
  return db.transaction(() => {
    const antes = id ? exigirCard(id) : null
    const resultado = executar()
    db.prepare("UPDATE cards SET revisao = revisao + 1, atualizado_em = datetime('now') WHERE id = ?").run(resultado.id)
    const depois = exigirCard(resultado.id)
    const acao = uid()
    db.prepare('INSERT INTO acoes_reversiveis (id, card_id, autor, tipo, antes, depois, revisao_esperada) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(acao, depois.id, autor, tipo, antes ? JSON.stringify(antes) : null, JSON.stringify(depois), depois.revisao)
    return { ...depois, acao_id: acao }
  })()
}

export function criarCard(opts: Parameters<typeof criarCardOriginal>[0]): Card {
  return alterar(null, opts.autor, 'criação', () => criarCardOriginal(opts))
}
export function atualizarCard(id: string, campos: Parameters<typeof atualizarCardOriginal>[1], autor: string, revisao?: number): Card {
  return alterar(id, autor, 'edição', () => {
    exigirCard(id, revisao)
    return atualizarCardOriginal(id, campos, autor)
  })
}
export function moverCard(id: string, destino: Parameters<typeof moverCardOriginal>[1], autor: string, revisao?: number): Card {
  return alterar(id, autor, 'movimento', () => {
    if (exigirCard(id, revisao).arquivado_em) throw new Error('Restaure o card antes de movê-lo.')
    return moverCardOriginal(id, destino, autor)
  })
}
export function comentar(id: string, autor: string, texto: string) {
  return db.transaction(() => {
    const resultado = comentarOriginal(id, autor, texto)
    // Comentário também invalida um desfazer antigo: outra pessoa pode ter agido.
    db.prepare("UPDATE cards SET revisao = revisao + 1, atualizado_em = datetime('now') WHERE id = ?").run(id)
    return resultado
  })()
}
export function listarArquivados(): Card[] {
  return db.prepare('SELECT * FROM cards WHERE arquivado_em IS NOT NULL ORDER BY arquivado_em DESC, id').all() as Card[]
}
export function arquivarCard(id: string, autor: string, restaurar = false, revisao?: number): Card {
  return alterar(id, autor, restaurar ? 'restauração' : 'arquivamento', () => {
    const card = exigirCard(id, revisao)
    if (restaurar ? !card.arquivado_em : !!card.arquivado_em) throw new Error(restaurar ? 'O card já está no quadro.' : 'O card já está arquivado.')
    db.prepare(`UPDATE cards SET arquivado_em = ${restaurar ? 'NULL' : "datetime('now')"} WHERE id = ?`).run(id)
    registrar(id, autor, restaurar ? 'restaurou' : 'arquivou', card.titulo)
    return exigirCard(id)
  })
}
export function desfazerAcao(id: string, autor: string): Card {
  return db.transaction(() => {
    const acao = db.prepare('SELECT * FROM acoes_reversiveis WHERE id = ?').get(id) as Acao | undefined
    if (!acao || acao.autor !== autor) throw new Error('Ação não disponível para este autor.')
    if (acao.desfeita_em) throw new Error('Esta ação já foi desfeita.')
    const atual = exigirCard(acao.card_id)
    if (atual.revisao !== acao.revisao_esperada) throw new Error('Não foi possível desfazer: o card recebeu outra alteração. O trabalho mais recente foi preservado.')
    const antes = acao.antes ? JSON.parse(acao.antes) as Card : null
    if (antes) {
      db.prepare(`UPDATE cards SET coluna_id = ?, titulo = ?, descricao = ?, posicao = ?, projeto = ?, arquivado_em = ?, revisao = revisao + 1, atualizado_em = datetime('now') WHERE id = ?`)
        .run(antes.coluna_id, antes.titulo, antes.descricao, antes.posicao, antes.projeto, antes.arquivado_em, atual.id)
    } else {
      // Desfazer criação arquiva em vez de apagar: comentários e autoria nunca somem.
      db.prepare("UPDATE cards SET arquivado_em = datetime('now'), revisao = revisao + 1, atualizado_em = datetime('now') WHERE id = ?").run(atual.id)
    }
    db.prepare("UPDATE acoes_reversiveis SET desfeita_em = datetime('now') WHERE id = ?").run(id)
    registrar(atual.id, autor, 'desfez', acao.tipo)
    const resultado = exigirCard(atual.id)
    const anterior = db.prepare('SELECT * FROM acoes_reversiveis WHERE card_id = ? AND desfeita_em IS NULL ORDER BY rowid DESC LIMIT 1').get(atual.id) as Acao | undefined
    // Reencadeia apenas a ação imediatamente anterior ao estado restaurado.
    // Assim Ctrl+Z repetido funciona sem liberar ações anteriores a conflitos.
    if (antes && anterior && (JSON.parse(anterior.depois) as Card).revisao === antes.revisao) {
      db.prepare('UPDATE acoes_reversiveis SET revisao_esperada = ? WHERE id = ?').run(resultado.revisao, anterior.id)
    }
    return resultado
  })()
}
