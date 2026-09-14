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
    .prepare('SELECT * FROM cards WHERE coluna_id = ? ORDER BY posicao')
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
    .prepare('SELECT autor, acao, detalhe, criado_em FROM eventos WHERE card_id = ? ORDER BY criado_em')
    .all(id)
  return { ...card, eventos }
}

export function criarCard(opts: {
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

export function atualizarCard(
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

export function moverCard(
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
  }

  return db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Card
}

export function comentar(cardId: string, autor: string, texto: string) {
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
       ORDER BY e.criado_em DESC LIMIT ?`,
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
