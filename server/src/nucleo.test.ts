import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const dbPath = ':memory:'
process.env.BOARD_DB = dbPath

const { db, semear } = await import('./db.js')
const { criarCard, moverCard, comentar, atividade, listarColunas, quadroPadrao, atualizarCard, obterCard, quadroCompleto, listarArquivados, arquivarCard, desfazerAcao } = await import('./nucleo.js')

type Coluna = { nome: string; id: string }
type Evento = { acao: string; card_titulo: string; autor: string; detalhe: string; criado_em: string }

describe('Núcleo', () => {
  beforeAll(() => {
    semear()
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


describe('Arquivamento e desfazer com concorrência', () => {
  it('arquiva e restaura preservando id, coluna, descrição e comentários', () => {
    const c = criarCard({ titulo: 'Arquivo', descricao: 'Contexto\nPreservado', autor: 'lucas' })
    comentar(c.id, 'claude', 'Nota importante')
    const antes = obterCard(c.id)!
    const a = arquivarCard(c.id, 'web', false, antes.revisao)
    expect(a.arquivado_em).toBeTruthy()
    expect(quadroCompleto().colunas.flatMap(col => col.cards).some(k => k.id === c.id)).toBe(false)
    expect(listarArquivados().some(k => k.id === c.id)).toBe(true)
    const r = arquivarCard(c.id, 'web', true, a.revisao)
    expect(r.coluna_id).toBe(c.coluna_id)
    expect(r.descricao).toBe(c.descricao)
    expect(r.arquivado_em).toBeNull()
    expect(obterCard(c.id)!.eventos).toEqual(expect.arrayContaining([expect.objectContaining({ acao: 'comentou', detalhe: 'Nota importante' })]))
  })
  it('desfaz edição, movimento e criação em sequência, sem apagar o card', () => {
    const c = criarCard({ titulo: 'Sequência', autor: 'web' })
    const m = moverCard(c.id, { coluna: 'Em andamento' }, 'web')
    const e = atualizarCard(c.id, { descricao: 'Alterada' }, 'web')
    expect(desfazerAcao(e.acao_id!, 'web').descricao).toBe('')
    expect(desfazerAcao(m.acao_id!, 'web').coluna_id).toBe(c.coluna_id)
    expect(desfazerAcao(c.acao_id!, 'web').arquivado_em).toBeTruthy()
    expect(obterCard(c.id)!.eventos.length).toBeGreaterThan(3)
  })
  it('recusa desfazer quando outra IA editou, mesmo se voltar ao mesmo texto', () => {
    const c = criarCard({ titulo: 'Concorrência', autor: 'web' })
    const e = atualizarCard(c.id, { descricao: 'A' }, 'web')
    atualizarCard(c.id, { descricao: 'B' }, 'claude')
    atualizarCard(c.id, { descricao: 'A' }, 'claude')
    expect(() => desfazerAcao(e.acao_id!, 'web')).toThrow('outra alteração')
    expect(obterCard(c.id)!.descricao).toBe('A')
  })
  it('comentário posterior impede desfazer e permanece no histórico', () => {
    const c = criarCard({ titulo: 'Comentário', autor: 'web' })
    comentar(c.id, 'astra', 'Não apagar')
    expect(() => desfazerAcao(c.acao_id!, 'web')).toThrow('outra alteração')
    expect(obterCard(c.id)!.arquivado_em).toBeNull()
  })
  it('recusa autor diferente, repetição e edição com revisão antiga', () => {
    const c = criarCard({ titulo: 'Proteção', autor: 'web' })
    const e = atualizarCard(c.id, { descricao: 'texto' }, 'web', c.revisao)
    expect(() => desfazerAcao(e.acao_id!, 'claude')).toThrow('autor')
    expect(() => arquivarCard(c.id, 'web', false, c.revisao)).toThrow('outra sessão')
    desfazerAcao(e.acao_id!, 'web')
    expect(() => desfazerAcao(e.acao_id!, 'web')).toThrow('já foi desfeita')
  })
  it('desfaz arquivamento e restauração, sem trocar posição', () => {
    const c = criarCard({ titulo: 'Posição', autor: 'web' })
    const a = arquivarCard(c.id, 'web')
    const r = arquivarCard(c.id, 'web', true)
    expect(desfazerAcao(r.acao_id!, 'web').arquivado_em).toBeTruthy()
    const final = desfazerAcao(a.acao_id!, 'web')
    expect(final.arquivado_em).toBeNull()
    expect(final.posicao).toBe(c.posicao)
  })
  it('falhas não deixam ação ou evento parcial', () => {
    const c = criarCard({ titulo: 'Atômico', autor: 'web' })
    const anterior = obterCard(c.id)
    expect(() => moverCard(c.id, { colunaId: 'inexistente' }, 'web')).toThrow()
    expect(obterCard(c.id)).toEqual(anterior)
  })
})

afterAll(() => db.close())
