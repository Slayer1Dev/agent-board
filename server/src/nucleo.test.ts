import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { rmSync } from 'node:fs'

const dbPath = `./test-db-${Date.now()}.sqlite`
process.env.BOARD_DB = dbPath

const { db, semear } = await import('./db.js')
const { criarCard, moverCard, comentar, atividade, listarColunas, quadroPadrao } = await import('./nucleo.js')

type Coluna = { nome: string; id: string }
type Evento = { acao: string; card_titulo: string; autor: string; detalhe: string; criado_em: string }

describe('Núcleo', () => {
  beforeAll(() => {
    semear()
  })

  afterAll(() => {
    db.close()
    try {
      rmSync(dbPath)
      rmSync(`${dbPath}-wal`)
      rmSync(`${dbPath}-shm`)
    } catch {}
  })

  it('deve criar card numa coluna indicada pelo nome ("A fazer")', () => {
    const card = criarCard({ titulo: 'Test Card', coluna: 'A fazer', autor: 'test' })
    expect(card.titulo).toBe('Test Card')
    
    const q = quadroPadrao()
    const colunas = listarColunas(q.id) as Coluna[]
    const colunaAFazer = colunas.find((c) => c.nome === 'A fazer')
    expect(card.coluna_id).toBe(colunaAFazer?.id)
  })

  it('deve lançar erro ao criar card com nome de coluna inexistente', () => {
    expect(() => {
      criarCard({ titulo: 'Test 2', coluna: 'Não existe', autor: 'test' })
    }).toThrow('coluna "Não existe" não existe')
  })

  it('deve registrar evento com o autor correto ao mover card entre colunas', () => {
    const card = criarCard({ titulo: 'Mover Test', coluna: 'A fazer', autor: 'autor1' })
    moverCard(card.id, { coluna: 'Em andamento' }, 'autor2')
    
    const eventos = atividade(10) as Evento[]
    const moveEvent = eventos.find((e) => e.acao === 'moveu' && e.card_titulo === 'Mover Test')
    
    expect(moveEvent).toBeDefined()
    expect(moveEvent?.autor).toBe('autor2')
    expect(moveEvent?.detalhe).toBe('para Em andamento')
  })

  it('deve lançar erro ao comentar em card inexistente', () => {
    expect(() => {
      comentar('id-invalido', 'autor1', 'comentário de teste')
    }).toThrow('card não encontrado')
  })

  it('atividade() retorna eventos do mais recente para o mais antigo', () => {
    criarCard({ titulo: 'Card 1', autor: 'autor1' })
    criarCard({ titulo: 'Card 2', autor: 'autor2' })
    
    const eventos = atividade(10) as Evento[]
    const datas = eventos.map((e) => new Date(e.criado_em).getTime())
    
    for (let i = 0; i < datas.length - 1; i++) {
      expect(datas[i]).toBeGreaterThanOrEqual(datas[i+1])
    }
  })
})
