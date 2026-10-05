import { describe, it, expect, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const pasta = mkdtempSync(join(process.cwd(), '.teste-backup-'))
process.env.BOARD_DB = join(pasta, 'board.db')
process.env.BOARD_DADOS = pasta
process.env.BOARD_BACKUP_DIR = join(pasta, 'backups')
process.env.BOARD_BACKUP_MANTER = '2'

const { db, semear } = await import('./db.js')
const { criarCard } = await import('./nucleo.js')
const { fazerBackup, listarBackups, estadoBackups, PASTA_BACKUP } = await import('./backup.js')

const espera = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('Backup', () => {
  afterAll(() => { db.close(); rmSync(pasta, { recursive: true, force: true }) })

  it('copia o banco com o servidor em uso e a cópia abre com os mesmos cards', async () => {
    semear()
    criarCard({ titulo: 'Guardado no backup', coluna: 'A fazer', autor: 'teste' })
    mkdirSync(join(pasta, 'wallpapers'), { recursive: true })
    writeFileSync(join(pasta, 'wallpapers', 'imagem.png'), 'bytes')

    const b = await fazerBackup()
    expect(b.cards).toBe(1)
    expect(b.wallpapers).toBe(1)
    expect(b.bytes).toBeGreaterThan(0)
    expect(Date.parse(b.criado_em)).toBeGreaterThan(Date.now() - 60_000)

    const copia = new Database(join(PASTA_BACKUP, b.nome, 'board.db'), { readonly: true })
    expect(copia.prepare('SELECT titulo FROM cards').pluck().all()).toEqual(['Guardado no backup'])
    copia.close()
    expect(existsSync(join(PASTA_BACKUP, b.nome, 'wallpapers', 'imagem.png'))).toBe(true)
    // Um arquivo só: nada de -wal ou -shm para esquecer na hora de restaurar.
    expect(readdirSync(join(PASTA_BACKUP, b.nome)).sort()).toEqual(['board.db', 'wallpapers'])
  })

  it('o que foi escrito depois do backup não aparece na cópia antiga', async () => {
    const antes = listarBackups()[0]
    criarCard({ titulo: 'Criado depois', coluna: 'A fazer', autor: 'teste' })
    expect(listarBackups()[0]).toMatchObject({ nome: antes.nome, cards: 1 })
  })

  it('guarda só os mais recentes e não toca em mais nada na pasta', async () => {
    writeFileSync(join(PASTA_BACKUP, 'anotacao.txt'), 'não é backup')
    mkdirSync(join(PASTA_BACKUP, 'board-de-outra-pessoa'))
    await espera(5); const segundo = await fazerBackup()
    await espera(5); const terceiro = await fazerBackup()

    expect(listarBackups().map(b => b.nome)).toEqual([terceiro.nome, segundo.nome])
    expect(terceiro.cards).toBe(2)
    expect(readdirSync(PASTA_BACKUP).sort()).toEqual(['anotacao.txt', 'board-de-outra-pessoa', segundo.nome, terceiro.nome].sort())
  })

  it('pedidos simultâneos fazem um backup só', async () => {
    await espera(5)
    const [a, b] = await Promise.all([fazerBackup(), fazerBackup()])
    expect(a.nome).toBe(b.nome)
  })

  it('não deixa pasta provisória para trás', () => {
    expect(readdirSync(PASTA_BACKUP).filter(n => n.endsWith('.parcial'))).toEqual([])
  })

  it('informa o estado para a interface e os agentes', () => {
    const e = estadoBackups()
    expect(e).toMatchObject({ manter: 2, intervalo_horas: 24, automatico: true, pasta: PASTA_BACKUP })
    expect(e.ultimo?.nome).toBe(e.backups[0].nome)
  })
})
