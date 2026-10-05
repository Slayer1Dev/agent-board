import Database from 'better-sqlite3'
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { db, CAMINHO, PASTA_DADOS } from './db.js'

/**
 * Backup automático. O quadro é o único lugar onde o histórico das sessões
 * existe; um disco trocado ou uma pasta esquecida no backup da máquina e ele
 * some. Por isso o próprio servidor se copia, sem depender de cron.
 *
 * Cada backup é uma pasta `board-<data>` com o banco (cópia consistente, feita
 * pela API de backup do SQLite com o servidor no ar) e os wallpapers.
 * Para restaurar: pare o servidor e copie `board.db` e `wallpapers/` de volta.
 */

const numero = (valor: string | undefined, padrao: number) => {
  const n = Number(valor)
  return valor !== undefined && valor.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : padrao
}

export const PASTA_BACKUP = process.env.BOARD_BACKUP_DIR ?? join(PASTA_DADOS, 'backups')
/** Intervalo entre backups automáticos, em horas. 0 desliga. */
export const INTERVALO_HORAS = numero(process.env.BOARD_BACKUP_HORAS, 24)
/** Quantos backups guardar. Os mais antigos são apagados. */
export const MANTER = Math.max(1, Math.floor(numero(process.env.BOARD_BACKUP_MANTER, 14)))

// Só pastas com exatamente este formato são listadas e apagadas pela retenção:
// qualquer outra coisa que alguém guarde na pasta de backups fica intocada.
const NOME = /^board-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/

export type Backup = { nome: string; criado_em: string; bytes: number; cards: number; wallpapers: number }

const dataDoNome = (nome: string) => {
  const m = NOME.exec(nome)
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7]}Z` : null
}

function contar(arquivo: string) {
  const copia = new Database(arquivo, { readonly: true, fileMustExist: true })
  try {
    const estado = copia.pragma('integrity_check', { simple: true })
    if (estado !== 'ok') throw new Error(`a cópia não passou na verificação de integridade: ${String(estado)}`)
    return (copia.prepare('SELECT COUNT(*) AS n FROM cards').get() as { n: number }).n
  } finally { copia.close() }
}

/**
 * A cópia herda o modo WAL do banco em uso, e um banco em WAL cria arquivos
 * `-wal` e `-shm` ao lado sempre que é aberto. Tirar a cópia desse modo deixa o
 * backup num arquivo só, que é o que alguém vai copiar de volta ao restaurar.
 */
function selar(arquivo: string) {
  const copia = new Database(arquivo, { fileMustExist: true })
  try { copia.pragma('journal_mode = DELETE') } finally { copia.close() }
}

/** Backups existentes, do mais novo para o mais antigo. */
export function listarBackups(pasta = PASTA_BACKUP): Backup[] {
  if (!existsSync(pasta)) return []
  return readdirSync(pasta, { withFileTypes: true })
    .filter(e => e.isDirectory() && NOME.test(e.name) && existsSync(join(pasta, e.name, 'board.db')))
    .map(e => {
      const dir = join(pasta, e.name)
      const imagens = join(dir, 'wallpapers')
      let cards = -1
      try { cards = contar(join(dir, 'board.db')) } catch { /* cópia ilegível: aparece na lista com -1 para alguém notar */ }
      return {
        nome: e.name,
        criado_em: dataDoNome(e.name)!,
        bytes: statSync(join(dir, 'board.db')).size,
        cards,
        wallpapers: existsSync(imagens) ? readdirSync(imagens).length : 0,
      }
    })
    .sort((a, b) => b.nome.localeCompare(a.nome))
}

let emCurso: Promise<Backup> | null = null

/** Faz um backup agora. Chamadas simultâneas esperam o mesmo backup em vez de fazer dois. */
export function fazerBackup(opcoes: { pasta?: string; manter?: number } = {}): Promise<Backup> {
  emCurso ??= copiar(opcoes.pasta ?? PASTA_BACKUP, opcoes.manter ?? MANTER).finally(() => { emCurso = null })
  return emCurso
}

async function copiar(pasta: string, manter: number): Promise<Backup> {
  mkdirSync(pasta, { recursive: true, mode: 0o700 })
  const nome = `board-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const final = join(pasta, nome)
  // Escreve numa pasta provisória e renomeia no fim: um backup interrompido nunca parece completo.
  const parcial = join(pasta, `.${nome}.parcial`)
  mkdirSync(parcial, { mode: 0o700 })
  try {
    await db.backup(join(parcial, 'board.db'))
    selar(join(parcial, 'board.db'))
    contar(join(parcial, 'board.db'))
    const imagens = join(PASTA_DADOS, 'wallpapers')
    if (existsSync(imagens)) cpSync(imagens, join(parcial, 'wallpapers'), { recursive: true })
    renameSync(parcial, final)
  } catch (e) {
    rmSync(parcial, { recursive: true, force: true })
    throw e
  }
  const todos = listarBackups(pasta)
  for (const antigo of todos.slice(manter)) rmSync(join(pasta, antigo.nome), { recursive: true, force: true })
  return todos.find(b => b.nome === nome)!
}

export function estadoBackups() {
  const backups = listarBackups()
  return { pasta: PASTA_BACKUP, intervalo_horas: INTERVALO_HORAS, manter: MANTER, automatico: automaticoLigado(), ultimo: backups[0] ?? null, backups }
}

// Banco em memória (testes) não tem o que guardar.
const automaticoLigado = () => INTERVALO_HORAS > 0 && CAMINHO !== ':memory:'

/**
 * Liga o backup automático. Confere de tempos em tempos se o último backup já
 * passou do intervalo, em vez de contar o tempo desde que o processo subiu:
 * assim um servidor que reinicia todo dia não fica sem backup.
 */
export function agendarBackups(registrar: (mensagem: string) => void = console.log) {
  if (!automaticoLigado()) return null
  const conferir = async () => {
    try {
      const ultimo = listarBackups()[0]
      if (ultimo && Date.now() - Date.parse(ultimo.criado_em) < INTERVALO_HORAS * 3_600_000) return
      const b = await fazerBackup()
      registrar(`backup: ${join(PASTA_BACKUP, b.nome)} (${b.cards} cards, ${Math.ceil(b.bytes / 1024)} KB)`)
    } catch (e) {
      registrar(`ERRO no backup automático: ${(e as Error).message}`)
    }
  }
  setTimeout(conferir, 20_000).unref()
  const timer = setInterval(conferir, 15 * 60_000)
  timer.unref()
  return timer
}
