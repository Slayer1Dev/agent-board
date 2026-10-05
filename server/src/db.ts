import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { homedir } from 'node:os'

const CAMINHO = process.env.BOARD_DB ?? `${homedir()}/.agent-board/board.db`
export const PASTA_DADOS = process.env.BOARD_DADOS ?? dirname(CAMINHO)

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

// Migração aditiva: os cards existentes e seu histórico permanecem intactos.
const camposCard = db.prepare('PRAGMA table_info(cards)').all() as { name: string }[]
if (!camposCard.some(c => c.name === 'arquivado_em')) db.exec('ALTER TABLE cards ADD COLUMN arquivado_em TEXT')
if (!camposCard.some(c => c.name === 'revisao')) db.exec('ALTER TABLE cards ADD COLUMN revisao INTEGER NOT NULL DEFAULT 0')
for (const campo of ['lembrete_em', 'lembrete_nota', 'lembrete_feito_em', 'repeticao_id']) {
  if (!camposCard.some(c => c.name === campo)) db.exec(`ALTER TABLE cards ADD COLUMN ${campo} TEXT DEFAULT NULL`)
}
db.exec(`CREATE TABLE IF NOT EXISTS acoes_reversiveis (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  autor TEXT NOT NULL,
  tipo TEXT NOT NULL,
  antes TEXT,
  depois TEXT NOT NULL,
  revisao_esperada INTEGER NOT NULL,
  desfeita_em TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_acoes_card ON acoes_reversiveis(card_id);`)

export const uid = () => randomUUID()
db.exec(`CREATE TABLE IF NOT EXISTS wallpapers (
  id TEXT PRIMARY KEY, arquivo TEXT NOT NULL UNIQUE, tipo TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')), autor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS preferencias (
  chave TEXT PRIMARY KEY, valor TEXT NOT NULL
);`)
db.exec(`CREATE TABLE IF NOT EXISTS repeticoes (
  id TEXT PRIMARY KEY, regra TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'ativa'
);
CREATE TABLE IF NOT EXISTS ocorrencias (
  repeticao_id TEXT NOT NULL REFERENCES repeticoes(id), periodo TEXT NOT NULL,
  card_id TEXT NOT NULL UNIQUE REFERENCES cards(id), origem_card_id TEXT UNIQUE REFERENCES cards(id),
  PRIMARY KEY(repeticao_id, periodo)
);`)
db.exec(`CREATE TABLE IF NOT EXISTS projetos (
  nome TEXT PRIMARY KEY, cor TEXT NOT NULL, favorito INTEGER NOT NULL DEFAULT 0,
  oculto INTEGER NOT NULL DEFAULT 0, atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);`)
db.exec(`CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, nome TEXT NOT NULL COLLATE NOCASE UNIQUE, cor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS card_tags (card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(card_id, tag_id));`)

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
  // O autor é texto livre vindo de fora; sem limite, um nome gigante entraria em todo o histórico.
  if (typeof autor !== 'string' || !autor.trim() || autor.length > 60) throw new Error('Autor deve ter entre 1 e 60 caracteres.')
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
