import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const dbPath = ':memory:'
process.env.BOARD_DB = dbPath
const pastaTeste = mkdtempSync(join(process.cwd(), '.teste-wallpapers-'))
process.env.BOARD_DADOS = pastaTeste

const { db, semear } = await import('./db.js')
const { pesquisarCards } = await import('./nucleo.js')
const { criarTag, alterarTag, definirTags, listarTags } = await import('./nucleo.js')
const { filtrarCards } = await import('./nucleo.js')
const { criarQuadro, renomearQuadro, removerQuadro, resumoQuadros } = await import('./nucleo.js')
const { listarProjetos, atualizarProjeto } = await import('./nucleo.js')
const { definirLembrete, agirLembrete, listarLembretes, estadoLembrete } = await import('./nucleo.js')
const { definirRepeticao, agirRepeticao, proximoPeriodo } = await import('./nucleo.js')
const { validarWallpaper, salvarWallpaper, obterWallpaper, listarWallpapers, escolherWallpaper, aparenciaCompartilhada, apagarWallpaper } = await import('./nucleo.js')
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
    const c = criarCard({ titulo: 'Arquivo', descricao: 'Contexto\nPreservado', autor: 'ana' })
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

describe('Limites de entrada', () => {
  it('recusa textos e autores fora do tamanho', () => {
    expect(() => criarCard({ titulo: 'x'.repeat(301), autor: 'test' })).toThrow('Título deve ter até 300')
    expect(() => criarCard({ titulo: '   ', autor: 'test' })).toThrow('título é obrigatório')
    expect(() => criarCard({ titulo: 'Autor longo', autor: 'a'.repeat(61) })).toThrow('Autor deve ter entre 1 e 60')
    const card = criarCard({ titulo: 'Limites', autor: 'test' })
    expect(() => comentar(card.id, 'test', 'c'.repeat(50001))).toThrow('Comentário deve ter até 50000')
    expect(() => atualizarCard(card.id, { descricao: 'd'.repeat(50001) }, 'test')).toThrow('Descrição deve ter até 50000')
  })
})

describe('Vários quadros', () => {
  it('cria quadro com as colunas padrão e mantém os cards separados', () => {
    const q = criarQuadro('Casa', 'test')
    expect(listarColunas(q.id).map(c => c.nome)).toEqual(['A fazer', 'Em andamento', 'Revisão', 'Concluído'])
    const card = criarCard({ titulo: 'Só no quadro Casa', coluna: 'A fazer', quadro: 'casa', autor: 'test' })
    expect(listarColunas(q.id).some(c => c.id === card.coluna_id)).toBe(true)
    expect(quadroCompleto(q.id).colunas.flatMap(c => c.cards).map(c => c.id)).toEqual([card.id])
    expect(quadroCompleto().colunas.flatMap(c => c.cards).some(c => c.id === card.id)).toBe(false)
    expect(filtrarCards('', { quadro: q.id }).map(c => c.id)).toEqual([card.id])
    expect(resumoQuadros().find(r => r.id === q.id)?.cards).toBe(1)
  })

  it('move pelo nome da coluna dentro do quadro do próprio card', () => {
    const q = criarQuadro('Estudos', 'test')
    const card = criarCard({ titulo: 'Ler capítulo', quadro: q.id, autor: 'test' })
    const movido = moverCard(card.id, { coluna: 'Concluído' }, 'test')
    const destino = listarColunas(q.id).find(c => c.nome === 'Concluído')!
    expect(movido.coluna_id).toBe(destino.id)
  })

  it('valida nomes e só apaga quadro vazio que não seja o único', () => {
    expect(() => criarQuadro('  ', 'test')).toThrow('entre 1 e 60')
    expect(() => criarQuadro('CASA', 'test')).toThrow('Já existe')
    expect(() => criarCard({ titulo: 'x', coluna: 'A fazer', quadro: 'não existe', autor: 'test' })).toThrow('não existe')
    const vazio = criarQuadro('Temporário', 'test')
    expect(renomearQuadro(vazio.id, 'Provisório', 'test').nome).toBe('Provisório')
    expect(() => renomearQuadro(vazio.id, 'Casa', 'test')).toThrow('Já existe')
    const comCard = resumoQuadros().find(r => r.nome === 'Casa')!
    expect(() => removerQuadro(comCard.id, 'test')).toThrow('ainda tem 1 card')
    expect(removerQuadro(vazio.id, 'test')).toEqual({ ok: true })
    expect(resumoQuadros().some(r => r.id === vazio.id)).toBe(false)
    expect(atividade(20).some(e => (e as Evento).acao === 'apagou quadro' && (e as Evento).autor === 'test')).toBe(true)
  })
})

afterAll(() => { db.close(); rmSync(pastaTeste, { recursive: true, force: true }) })

describe('Wallpapers', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGP8//8/AwMDEwMYAAAkBgMBXaJOiAAAAABJRU5ErkJggg==', 'base64')
  const jpg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==', 'base64')
  const webp = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoCAAIAAUAmJaQAA3AA/vz0AAA=', 'base64')
  it('valida os três formatos reais e recusa SVG, tamanho, assinatura falsa e truncamento', () => {
    expect(validarWallpaper(png).tipo).toBe('image/png')
    expect(validarWallpaper(jpg).tipo).toBe('image/jpeg')
    expect(validarWallpaper(webp).tipo).toBe('image/webp')
    for (const invalido of [Buffer.from('<svg><script>malicioso()</script></svg>'), Buffer.alloc(8 * 1024 * 1024 + 1), png.subarray(0, 33), jpg.subarray(0, 30), webp.subarray(0, 30), Buffer.concat([png, Buffer.from('<script>')])]) expect(() => validarWallpaper(invalido)).toThrow()
    const corrompido = Buffer.from(png); corrompido[45] ^= 1
    expect(() => validarWallpaper(corrompido)).toThrow()
  })
  it('salva com nome gerado, compartilha seleção, impede traversal e apaga com autoria', () => {
    const antes = pesquisarCards().length
    const w = salvarWallpaper(png, 'codex')
    expect(w.arquivo).toMatch(/^[a-f0-9-]+\.png$/)
    expect(obterWallpaper(w.id).bytes).toEqual(png)
    escolherWallpaper(w.id, 'ana')
    expect(aparenciaCompartilhada().wallpaper).toBe(w.id)
    expect(listarWallpapers().some(a => a.id === w.id)).toBe(true)
    expect(() => obterWallpaper('../../board.db')).toThrow()
    expect(() => escolherWallpaper('ausente', 'codex')).toThrow()
    apagarWallpaper(w.id, 'astra')
    expect(aparenciaCompartilhada().wallpaper).toBeNull()
    expect(listarWallpapers().some(a => a.id === w.id)).toBe(false)
    expect(atividade(10)).toEqual(expect.arrayContaining([expect.objectContaining({ autor: 'astra', acao: 'apagou wallpaper' })]))
    expect(pesquisarCards()).toHaveLength(antes)
  })
})

describe('Repetição', () => {
  it('gera uma vez, copia conteúdo e tags, pausa a série e preserva proveniência', () => {
    const t = criarTag('Repetir', 'codex')
    const c = criarCard({ titulo: 'Rotina única', descricao: 'Contexto', projeto: 'rotina', tags: [t.id], autor: 'ana' })
    definirRepeticao(c.id, { frequencia: 'diaria' }, 'ana')
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
    agirRepeticao(nova.id, 'pausada', 'ana')
    moverCard(nova.id, { coluna: 'Concluído' }, 'astra')
    expect(pesquisarCards()).toHaveLength(antes + 1)
    agirRepeticao(nova.id, 'ativa', 'ana')
    moverCard(nova.id, { coluna: 'Concluído' }, 'astra')
    expect(pesquisarCards()).toHaveLength(antes + 2)
    agirRepeticao(nova.id, 'encerrada', 'ana')
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
    definirLembrete(c.id, '2026-10-05T02:00:00Z', 'Ainda é dia 4 em SP', 'ana')
    expect(estadoLembrete(obterCard(c.id)!, agora)).toBe('hoje')
    expect(listarLembretes(agora).some(a => a.id === c.id)).toBe(true)
    definirLembrete(c.id, '2026-10-05T03:00:00Z', '', 'ana')
    expect(estadoLembrete(obterCard(c.id)!, agora)).toBe('futuro')
    expect(listarLembretes(agora).some(a => a.id === c.id)).toBe(false)
    definirLembrete(c.id, '2026-10-04T23:00:00Z', '', 'ana')
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
    const c = criarCard({ titulo: 'Projeto legado', projeto: 'legado-test', autor: 'ana' })
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
    const c = criarCard({ titulo: 'Filtros', projeto: 'filtro-teste', coluna: 'Revisão', tags: [t.id], autor: 'ana' })
    comentar(c.id, 'astra', 'Não troca autor de criação')
    expect(filtrarCards('', { projeto: 'filtro-teste', autor: 'ana', tag: t.id, depende: true, coluna: 'Revisão', dias: 1 }).map(a => a.id)).toEqual([c.id])
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
    alterarTag(t.id, 'ana', 'Novo nome')
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
    comentar(c.id, 'ana', 'Comentário pesquisável <script>')
    comentar(c.id, 'ana', 'Comentário pesquisável novamente')
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
