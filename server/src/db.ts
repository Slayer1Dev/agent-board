import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { homedir } from 'node:os'

const CAMINHO = process.env.BOARD_DB ?? `${homedir()}/.agent-board/board.db`

mkdirSync(dirname(CAMINHO), { recursive: true })

export const db = new Database(CAMINHO)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS quadros (
    id         TEXT PRIMARY KEY,
    nome       TEXT NOT NULL,
    criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS colunas (
    id        TEXT PRIMARY KEY,
    quadro_id TEXT NOT NULL REFERENCES quadros(id) ON DELETE CASCADE,
    nome      TEXT NOT NULL,
    posicao   REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cards (
    id           TEXT PRIMARY KEY,
    coluna_id    TEXT NOT NULL REFERENCES colunas(id) ON DELETE CASCADE,
    titulo       TEXT NOT NULL,
    descricao    TEXT NOT NULL DEFAULT '',
    posicao      REAL NOT NULL,
    projeto      TEXT,
    criado_em    TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Cada mudança fica registrada com o autor. É isto que permite abrir o quadro
  -- e ver o que cada sessão de IA fez, em vez de só o estado final.
  CREATE TABLE IF NOT EXISTS eventos (
    id       TEXT PRIMARY KEY,
    card_id  TEXT REFERENCES cards(id) ON DELETE CASCADE,
    autor    TEXT NOT NULL,
    acao     TEXT NOT NULL,
    detalhe  TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_colunas_quadro ON colunas(quadro_id);
  CREATE INDEX IF NOT EXISTS idx_cards_coluna   ON cards(coluna_id);
  CREATE INDEX IF NOT EXISTS idx_eventos_card   ON eventos(card_id);
`)

export const uid = () => randomUUID()

/** Cria um quadro inicial na primeira execução, para o app nunca abrir vazio. */
export function semear() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM quadros').get() as { n: number }
  if (n > 0) return

  const quadroId = uid()
  db.prepare('INSERT INTO quadros (id, nome) VALUES (?, ?)').run(quadroId, 'Principal')

  const inserirColuna = db.prepare(
    'INSERT INTO colunas (id, quadro_id, nome, posicao) VALUES (?, ?, ?, ?)',
  )
  ;['A fazer', 'Em andamento', 'Revisão', 'Concluído'].forEach((nome, i) => {
    inserirColuna.run(uid(), quadroId, nome, (i + 1) * 1000)
  })
}

export function registrar(cardId: string | null, autor: string, acao: string, detalhe = '') {
  db.prepare(
    'INSERT INTO eventos (id, card_id, autor, acao, detalhe) VALUES (?, ?, ?, ?, ?)',
  ).run(uid(), cardId, autor, acao, detalhe)
}

/**
 * Posição do próximo card numa coluna. Usamos float com espaçamento largo para
 * que reordenar seja só calcular a média entre vizinhos — sem reescrever a coluna toda.
 */
export function proximaPosicao(colunaId: string): number {
  const r = db
    .prepare('SELECT MAX(posicao) AS m FROM cards WHERE coluna_id = ?')
    .get(colunaId) as { m: number | null }
  return (r.m ?? 0) + 1000
}
