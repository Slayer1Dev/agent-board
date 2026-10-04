import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const dbPath = ':memory:'
process.env.BOARD_DB = dbPath

const { db, semear } = await import('./db.js')
const { pesquisarCards } = await import('./nucleo.js')
const { criarTag, alterarTag, definirTags, listarTags } = await import('./nucleo.js')
const { filtrarCards } = await import('./nucleo.js')
const { listarProjetos, atualizarProjeto } = await import('./nucleo.js')
const { definirLembrete, agirLembrete, listarLembretes, estadoLembrete } = await import('./nucleo.js')
const { definirRepeticao, agirRepeticao, proximoPeriodo } = await import('./nucleo.js')
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

describe('Repetição', () => {
  it('gera uma vez, copia conteúdo e tags, pausa a série e preserva proveniência', () => {
    const t = criarTag('Repetir', 'codex')
    const c = criarCard({ titulo: 'Rotina única', descricao: 'Contexto', projeto: 'rotina', tags: [t.id], autor: 'lucas' })
    definirRepeticao(c.id, { frequencia: 'diaria' }, 'lucas')
    const antes = pesquisarCards().length
    const movido = moverCard(c.id, { coluna: 'Concluído' }, 'astra')
    expect(pesquisarCards()).toHaveLength(antes + 1)
    moverCard(c.id, { coluna: 'A fazer' }, 'astra')
    moverCard(c.id, { coluna: 'Concluído' }, 'astra')
    expect(pesquisarCards()).toHaveLength(antes + 1)
    const nova = pesquisarCards().find(a => a.repeticao_id === obterCard(c.id)!.repeticao_id && a.id !== c.id)!
    expect(nova).toMatchObject({ titulo: c.titulo, descricao: c.descricao, projeto: c.projeto, coluna: 'A fazer', tags: [t] })
    expect(obterCard(nova.id)!.eventos).toEqual(expect.arrayContaining([expect.objectContaining({ autor: 'astra', acao: 'ocorrência de', detalhe: expect.stringContaining(c.id) })]))
    expect(() => desfazerAcao(movido.acao_id!, 'astra')).toThrow('ocorrência')
    agirRepeticao(nova.id, 'pausada', 'lucas')
    moverCard(nova.id, { coluna: 'Concluído' }, 'astra')
    expect(pesquisarCards()).toHaveLength(antes + 1)
    agirRepeticao(nova.id, 'ativa', 'lucas')
    moverCard(nova.id, { coluna: 'Concluído' }, 'astra')
    expect(pesquisarCards()).toHaveLength(antes + 2)
    agirRepeticao(nova.id, 'encerrada', 'lucas')
    expect(() => agirRepeticao(c.id, 'ativa', 'codex')).toThrow('encerrada')
    expect(filtrarCards('', { repetida: true }).some(a => a.id === c.id)).toBe(true)
    const ocorrencia = db.prepare('SELECT * FROM ocorrencias WHERE origem_card_id = ?').get(c.id) as { repeticao_id: string; periodo: string; card_id: string }
    expect(() => db.prepare('INSERT INTO ocorrencias (repeticao_id, periodo, card_id, origem_card_id) VALUES (?, ?, ?, ?)').run(ocorrencia.repeticao_id, ocorrencia.periodo, c.id, c.id)).toThrow()
  })
  it('calcula semana e fim de mês, valida regras', () => {
    expect(proximoPeriodo({ frequencia: 'semanal', dias: [1, 3] }, '2026-10-04')).toBe('2026-10-05')
    expect(proximoPeriodo({ frequencia: 'mensal', dia: 31 }, '2026-01-31')).toBe('2026-02-28')
    expect(proximoPeriodo({ frequencia: 'mensal', dia: 31 }, '2028-01-31')).toBe('2028-02-29')
    expect(proximoPeriodo({ frequencia: 'mensal', dia: 10 }, '2026-10-04')).toBe('2026-10-10')
    const c = criarCard({ titulo: 'Regra inválida', autor: 'codex' })
    expect(() => definirRepeticao(c.id, { frequencia: 'semanal', dias: [] }, 'codex')).toThrow()
    expect(() => definirRepeticao(c.id, { frequencia: 'mensal', dia: 32 }, 'codex')).toThrow()
  })
})

describe('Lembretes', () => {
  it('distingue hoje em São Paulo e consulta apenas pendentes, com autoria', () => {
    const agora = new Date('2026-10-05T01:00:00Z')
    const c = criarCard({ titulo: 'Lembrar', autor: 'codex' })
    definirLembrete(c.id, '2026-10-05T02:00:00Z', 'Ainda é dia 4 em SP', 'lucas')
    expect(estadoLembrete(obterCard(c.id)!, agora)).toBe('hoje')
    expect(listarLembretes(agora).some(a => a.id === c.id)).toBe(true)
    definirLembrete(c.id, '2026-10-05T03:00:00Z', '', 'lucas')
    expect(estadoLembrete(obterCard(c.id)!, agora)).toBe('futuro')
    expect(listarLembretes(agora).some(a => a.id === c.id)).toBe(false)
    definirLembrete(c.id, '2026-10-04T23:00:00Z', '', 'lucas')
    expect(estadoLembrete(obterCard(c.id)!, agora)).toBe('atrasado')
    agirLembrete(c.id, 'feito', 'astra', undefined, agora)
    expect(listarLembretes(agora).some(a => a.id === c.id)).toBe(false)
    agirLembrete(c.id, 'hora', 'astra', undefined, agora)
    expect(obterCard(c.id)!.lembrete_em).toBe('2026-10-05T02:00:00.000Z')
    agirLembrete(c.id, 'amanha', 'astra', undefined, agora)
    expect(obterCard(c.id)!.lembrete_em).toBe('2026-10-06T01:00:00.000Z')
    agirLembrete(c.id, 'semana', 'astra', undefined, agora)
    expect(obterCard(c.id)!.lembrete_em).toBe('2026-10-12T01:00:00.000Z')
    expect(obterCard(c.id)!.eventos).toEqual(expect.arrayContaining([expect.objectContaining({ autor: 'astra', acao: 'adiou lembrete' })]))
    expect(filtrarCards('', { lembrete: true }).some(a => a.id === c.id)).toBe(true)
    expect(() => definirLembrete(c.id, '2026-10-04T10:00', '', 'codex')).toThrow('fuso')
  })
})

describe('Projetos', () => {
  it('lê projetos legados e conta cada coluna, preserva cards e registra metadados', () => {
    const c = criarCard({ titulo: 'Projeto legado', projeto: 'legado-test', autor: 'lucas' })
    const antes = obterCard(c.id)
    const p = listarProjetos().find(p => p.nome === 'legado-test')!
    expect(p.colunas.find(c => c.nome === 'A fazer')?.total).toBe(1)
    expect(p.ultima_atividade).toBeTruthy()
    atualizarProjeto(p.nome, { favorito: true, cor: '#123456', oculto: true }, 'codex')
    expect(listarProjetos().some(p => p.nome === 'legado-test')).toBe(false)
    expect(listarProjetos('nome', true)[0].nome).toBe(p.nome)
    expect(obterCard(c.id)).toEqual(antes)
    expect(atividade(10)).toEqual(expect.arrayContaining([expect.objectContaining({ autor: 'codex', acao: 'alterou projeto' })]))
  })
})

describe('Filtros combinados', () => {
  it('combina projeto, autor de criação, tag, coluna, revisão e período', () => {
    const t = criarTag('Filtro', 'codex')
    const c = criarCard({ titulo: 'Filtros', projeto: 'filtro-teste', coluna: 'Revisão', tags: [t.id], autor: 'lucas' })
    comentar(c.id, 'astra', 'Não troca autor de criação')
    expect(filtrarCards('', { projeto: 'filtro-teste', autor: 'lucas', tag: t.id, depende: true, coluna: 'Revisão', dias: 1 }).map(a => a.id)).toEqual([c.id])
    expect(filtrarCards('', { projeto: 'filtro-teste', autor: 'astra' })).toHaveLength(0)
    expect(filtrarCards('', { projeto: 'filtro-teste', lembrete: true })).toHaveLength(0)
    expect(filtrarCards('', { projeto: 'filtro-teste', repetida: true })).toHaveLength(0)
    db.prepare("UPDATE cards SET criado_em = '2020-01-01 00:00:00' WHERE id = ?").run(c.id)
    expect(filtrarCards('', { projeto: 'filtro-teste', dias: 1, periodo: 'criado' })).toHaveLength(0)
    arquivarCard(c.id, 'codex')
    expect(filtrarCards('', { projeto: 'filtro-teste', arquivados: false })).toHaveLength(0)
    expect(() => filtrarCards('', { dias: -1 })).toThrow('Dias')
  })
})

describe('Tags', () => {
  it('cria com tags, pesquisa, renomeia mantendo cor e registra remoção', () => {
    const t = criarTag('Urgência de teste', 'codex')
    const c = criarCard({ titulo: 'Etiquetado', tags: [t.id, t.id], autor: 'codex' })
    expect(obterCard(c.id)!.tags).toHaveLength(1)
    expect(pesquisarCards('urgência de teste').some(r => r.id === c.id)).toBe(true)
    alterarTag(t.id, 'lucas', 'Novo nome')
    expect(listarTags().find(a => a.id === t.id)?.cor).toBe(t.cor)
    definirTags(c.id, [], 'astra')
    expect(obterCard(c.id)!.eventos).toEqual(expect.arrayContaining([expect.objectContaining({ autor: 'astra', acao: 'removeu tag' })]))
    definirTags(c.id, [t.id], 'codex')
    alterarTag(t.id, 'codex', undefined, true)
    expect(obterCard(c.id)!.tags).toHaveLength(0)
  })
  it('valida IDs e reverte criação inteira quando a tag não existe', () => {
    const antes = pesquisarCards().length
    expect(() => criarCard({ titulo: 'Inválido', tags: ['ausente'], autor: 'codex' })).toThrow('Tag')
    expect(pesquisarCards()).toHaveLength(antes)
    expect(() => criarTag(' ', 'codex')).toThrow()
    expect(() => criarTag('Cor inválida', 'codex', 'red')).toThrow()
  })
})

describe('Pesquisa', () => {
  it('encontra título, descrição, projeto e comentário arquivado sem duplicar', () => {
    const c = criarCard({ titulo: 'Agulha Título', descricao: 'Contexto ÚNICO', projeto: 'Projeto Especial', autor: 'codex' })
    comentar(c.id, 'lucas', 'Comentário pesquisável <script>')
    comentar(c.id, 'lucas', 'Comentário pesquisável novamente')
    arquivarCard(c.id, 'codex')
    for (const busca of ['agulha', 'único', 'projeto especial', 'pesquisável']) {
      const resultados = pesquisarCards(busca).filter(r => r.id === c.id)
      expect(resultados).toHaveLength(1)
      expect(resultados[0].arquivado_em).toBeTruthy()
      expect(resultados[0].trecho.toLowerCase()).toContain(busca)
    }
    expect(pesquisarCards('ausente 123xyz')).toHaveLength(0)
  })
})
