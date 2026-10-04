import { db, uid, registrar, proximaPosicao, PASTA_DADOS } from './db.js'
import { mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'

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
  tags: Tag[]
  autor: string | null
  lembrete_em: string | null
  lembrete_nota: string | null
  lembrete_feito_em: string | null
  repeticao_id: string | null
  lembrete_estado: 'futuro' | 'hoje' | 'atrasado' | 'feito' | null
  repeticao: { regra: RegraRepeticao; estado: string; periodo: string; proxima: string } | null
}

export type Tag = { id: string; nome: string; cor: string }
export function listarTags(): Tag[] { return db.prepare('SELECT * FROM tags ORDER BY nome COLLATE NOCASE').all() as Tag[] }
function tagsDoCard(id: string): Tag[] {
  return db.prepare('SELECT t.* FROM tags t JOIN card_tags ct ON ct.tag_id = t.id WHERE ct.card_id = ? ORDER BY t.nome COLLATE NOCASE').all(id) as Tag[]
}
function enriquecer(card: Card): Card {
  const criador = db.prepare("SELECT autor FROM eventos WHERE card_id = ? AND acao = 'criou' ORDER BY rowid LIMIT 1").get(card.id) as { autor: string } | undefined
  return { ...card, tags: tagsDoCard(card.id), autor: criador?.autor ?? null, lembrete_estado: estadoLembrete(card), repeticao: repeticaoDoCard(card) }
}

export type RegraRepeticao = { frequencia: 'diaria' | 'semanal' | 'mensal'; dias?: number[]; dia?: number }
export function proximoPeriodo(regra: RegraRepeticao, depois: string): string {
  const data = new Date(`${depois}T12:00:00Z`)
  if (regra.frequencia === 'mensal') {
    for (let mes = 0; mes < 3; mes++) {
      const fim = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + mes + 1, 0)).getUTCDate()
      const candidato = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + mes, Math.min(regra.dia!, fim), 12)).toISOString().slice(0, 10)
      if (candidato > depois) return candidato
    }
  } else {
    for (let n = 1; n <= 7; n++) {
      data.setUTCDate(data.getUTCDate() + 1)
      if (regra.frequencia === 'diaria' || regra.dias!.includes(data.getUTCDay())) return data.toISOString().slice(0, 10)
    }
  }
  throw new Error('Regra de repetição inválida.')
}
function repeticaoDoCard(card: Card): Card['repeticao'] {
  if (!card.repeticao_id) return null
  const r = db.prepare('SELECT r.regra, r.estado, o.periodo FROM repeticoes r JOIN ocorrencias o ON o.repeticao_id = r.id WHERE o.card_id = ?').get(card.id) as { regra: string; estado: string; periodo: string } | undefined
  if (!r) return null
  const regra = JSON.parse(r.regra) as RegraRepeticao
  const gerada = db.prepare('SELECT periodo FROM ocorrencias WHERE origem_card_id = ?').get(card.id) as { periodo: string } | undefined
  return { regra, estado: r.estado, periodo: r.periodo, proxima: gerada?.periodo ?? proximoPeriodo(regra, [r.periodo, diaLocal(new Date())].sort().at(-1)!) }
}
export function definirRepeticao(id: string, regra: RegraRepeticao, autor: string, revisao?: number): Card {
  if (!['diaria', 'semanal', 'mensal'].includes(regra.frequencia)) throw new Error('Frequência inválida.')
  if (regra.frequencia === 'semanal' && (!regra.dias?.length || regra.dias.some(d => !Number.isInteger(d) || d < 0 || d > 6))) throw new Error('Escolha dias da semana entre 0 (domingo) e 6.')
  if (regra.frequencia === 'mensal' && (!Number.isInteger(regra.dia) || regra.dia! < 1 || regra.dia! > 31)) throw new Error('Dia mensal deve estar entre 1 e 31.')
  return db.transaction(() => {
    const c = exigirCard(id, revisao)
    if (c.repeticao?.estado === 'encerrada') throw new Error('Repetição encerrada. Crie um novo card para iniciar outra série.')
    const serie = c.repeticao_id ?? uid()
    db.prepare("INSERT INTO repeticoes (id, regra) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET regra = excluded.regra").run(serie, JSON.stringify(regra))
    db.prepare('INSERT OR IGNORE INTO ocorrencias (repeticao_id, periodo, card_id) VALUES (?, ?, ?)').run(serie, diaLocal(new Date()), id)
    db.prepare('UPDATE cards SET repeticao_id = ? WHERE id = ?').run(serie, id)
    invalidarSerie(serie, autor, 'definiu repetição', JSON.stringify(regra))
    return exigirCard(id)
  })()
}
function invalidarSerie(serie: string, autor: string, acao: string, detalhe: string) {
  db.prepare("UPDATE cards SET revisao = revisao + 1, atualizado_em = datetime('now') WHERE repeticao_id = ?").run(serie)
  const cards = db.prepare('SELECT id FROM cards WHERE repeticao_id = ?').all(serie) as { id: string }[]
  for (const card of cards) registrar(card.id, autor, acao, detalhe)
}
export function agirRepeticao(id: string, estado: 'ativa' | 'pausada' | 'encerrada', autor: string, revisao?: number): Card {
  return db.transaction(() => {
    const c = exigirCard(id, revisao)
    if (!c.repeticao_id || !c.repeticao) throw new Error('Card sem repetição.')
    if (!['ativa', 'pausada', 'encerrada'].includes(estado)) throw new Error('Estado inválido.')
    if (c.repeticao.estado === 'encerrada') throw new Error('Repetição já encerrada.')
    db.prepare('UPDATE repeticoes SET estado = ? WHERE id = ?').run(estado, c.repeticao_id)
    invalidarSerie(c.repeticao_id, autor, 'alterou repetição', estado)
    return exigirCard(id)
  })()
}
function gerarProxima(id: string, autor: string) {
  const c = exigirCard(id)
  if (!c.repeticao || c.repeticao.estado !== 'ativa') return
  const coluna = db.prepare('SELECT nome FROM colunas WHERE id = ?').get(c.coluna_id) as { nome: string }
  if (coluna.nome !== 'Concluído' || db.prepare('SELECT 1 FROM ocorrencias WHERE origem_card_id = ?').get(id)) return
  const periodo = c.repeticao.proxima
  if (db.prepare('SELECT 1 FROM ocorrencias WHERE repeticao_id = ? AND periodo = ?').get(c.repeticao_id, periodo)) return
  const novo = criarCard({ titulo: c.titulo, descricao: c.descricao, projeto: c.projeto ?? undefined, tags: c.tags.map(t => t.id), coluna: 'A fazer', autor })
  db.prepare('UPDATE cards SET repeticao_id = ? WHERE id = ?').run(c.repeticao_id, novo.id)
  db.prepare('INSERT INTO ocorrencias (repeticao_id, periodo, card_id, origem_card_id) VALUES (?, ?, ?, ?)').run(c.repeticao_id, periodo, novo.id, id)
  registrar(novo.id, autor, 'ocorrência de', `${id} · ${periodo}`)
  registrar(id, autor, 'gerou ocorrência', `${novo.id} · ${periodo}`)
}

function diaLocal(data: Date) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(data) }
export function estadoLembrete(card: Pick<Card, 'lembrete_em' | 'lembrete_feito_em'>, agora = new Date()): Card['lembrete_estado'] {
  if (!card.lembrete_em) return null
  if (card.lembrete_feito_em) return 'feito'
  const data = new Date(card.lembrete_em)
  if (data < agora) return 'atrasado'
  return diaLocal(data) === diaLocal(agora) ? 'hoje' : 'futuro'
}
export function listarLembretes(agora = new Date()) {
  return pesquisarCards().filter(c => !c.arquivado_em && c.lembrete_em && !c.lembrete_feito_em && diaLocal(new Date(c.lembrete_em)) <= diaLocal(agora))
    .map(c => ({ ...c, lembrete_estado: estadoLembrete(c, agora) }))
    .sort((a, b) => a.lembrete_em!.localeCompare(b.lembrete_em!))
}
export function definirLembrete(id: string, data: string | null, nota: string, autor: string, revisao?: number): Card {
  if (data !== null && (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(data) || !Number.isFinite(Date.parse(data)))) throw new Error('Informe data ISO com fuso horário.')
  if (nota.length > 2000) throw new Error('Nota deve ter até 2000 caracteres.')
  return db.transaction(() => {
    exigirCard(id, revisao)
    db.prepare("UPDATE cards SET lembrete_em = ?, lembrete_nota = ?, lembrete_feito_em = NULL, revisao = revisao + 1, atualizado_em = datetime('now') WHERE id = ?").run(data ? new Date(data).toISOString() : null, nota, id)
    registrar(id, autor, data ? 'definiu lembrete' : 'removeu lembrete', `${data ?? ''} ${nota}`)
    return exigirCard(id)
  })()
}
export function agirLembrete(id: string, acao: 'feito' | 'hora' | 'amanha' | 'semana', autor: string, revisao?: number, agora = new Date()): Card {
  return db.transaction(() => {
    const card = exigirCard(id, revisao)
    if (!card.lembrete_em) throw new Error('Card sem lembrete.')
    if (!['feito', 'hora', 'amanha', 'semana'].includes(acao)) throw new Error('Ação de lembrete inválida.')
    if (acao === 'feito') {
      db.prepare("UPDATE cards SET lembrete_feito_em = ?, revisao = revisao + 1, atualizado_em = datetime('now') WHERE id = ?").run(agora.toISOString(), id)
      registrar(id, autor, 'concluiu lembrete', card.lembrete_em)
    } else {
      const data = new Date(agora.getTime() + (acao === 'hora' ? 3600000 : acao === 'amanha' ? 86400000 : 7 * 86400000))
      db.prepare("UPDATE cards SET lembrete_em = ?, lembrete_feito_em = NULL, revisao = revisao + 1, atualizado_em = datetime('now') WHERE id = ?").run(data.toISOString(), id)
      registrar(id, autor, 'adiou lembrete', `${acao}: ${data.toISOString()}`)
    }
    return exigirCard(id)
  })()
}

export type Filtros = { projeto?: string; tag?: string; autor?: string; coluna?: string; depende?: boolean; lembrete?: boolean; repetida?: boolean; dias?: number; periodo?: 'criado' | 'alterado'; arquivados?: boolean }
export function filtrarCards(busca = '', filtros: Filtros = {}) {
  if (filtros.dias !== undefined && (!Number.isInteger(filtros.dias) || filtros.dias < 1 || filtros.dias > 36500)) throw new Error('Dias deve ser um inteiro entre 1 e 36500.')
  return pesquisarCards(busca).filter(c => {
    if (filtros.arquivados === false && c.arquivado_em) return false
    if (filtros.projeto && (filtros.projeto === '__sem__' ? !!c.projeto : c.projeto !== filtros.projeto)) return false
    if (filtros.tag && !c.tags.some(t => t.id === filtros.tag || t.nome === filtros.tag)) return false
    if (filtros.autor && c.autor !== filtros.autor) return false
    if (filtros.coluna && c.coluna !== filtros.coluna && c.coluna_id !== filtros.coluna) return false
    if (filtros.depende && c.coluna !== 'Revisão') return false
    if (filtros.lembrete && (!c.lembrete_em || c.lembrete_feito_em)) return false
    if (filtros.repetida && !c.repeticao_id) return false
    const data = filtros.periodo === 'criado' ? c.criado_em : c.atualizado_em
    if (filtros.dias && Date.parse(data.replace(' ', 'T') + 'Z') < Date.now() - filtros.dias * 86400000) return false
    return true
  })
}
export function criarTag(nome: string, autor: string, cor?: string): Tag {
  nome = nome.trim()
  if (!nome || nome.length > 60) throw new Error('Tag deve ter entre 1 e 60 caracteres.')
  if (cor && !/^#[0-9a-f]{6}$/i.test(cor)) throw new Error('Cor deve ser hexadecimal (#RRGGBB).')
  const paleta = ['#a5c8ff', '#f5c698', '#b9dfba', '#dfb4ed', '#f4abb9']
  const indice = [...nome].reduce((n, c) => n + c.charCodeAt(0), 0) % paleta.length
  return db.transaction(() => {
    const tag = { id: uid(), nome, cor: cor ?? paleta[indice] }
    db.prepare('INSERT INTO tags (id, nome, cor) VALUES (?, ?, ?)').run(tag.id, tag.nome, tag.cor)
    registrar(null, autor, 'criou tag', nome)
    return tag
  })()
}
export function alterarTag(id: string, autor: string, nome?: string, apagar = false) {
  return db.transaction(() => {
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag | undefined
    if (!tag) throw new Error('Tag não encontrada.')
    if (!apagar && (!nome?.trim() || nome.trim().length > 60)) throw new Error('Nome de tag inválido.')
    const associados = db.prepare('SELECT card_id FROM card_tags WHERE tag_id = ?').all(id) as { card_id: string }[]
    if (apagar) db.prepare('DELETE FROM tags WHERE id = ?').run(id)
    else db.prepare('UPDATE tags SET nome = ? WHERE id = ?').run(nome!.trim(), id)
    for (const c of associados) {
      registrar(c.card_id, autor, apagar ? 'removeu tag' : 'renomeou tag', apagar ? tag.nome : `${tag.nome} → ${nome!.trim()}`)
      db.prepare("UPDATE cards SET revisao = revisao + 1, atualizado_em = datetime('now') WHERE id = ?").run(c.card_id)
    }
    registrar(null, autor, apagar ? 'apagou tag' : 'renomeou tag', tag.nome)
    return { ok: true }
  })()
}
export function definirTags(id: string, tags: string[], autor: string, revisao?: number): Card {
  return db.transaction(() => {
    const atual = exigirCard(id, revisao)
    const ids = [...new Set(tags)]
    if (ids.some(t => !db.prepare('SELECT 1 FROM tags WHERE id = ?').get(t))) throw new Error('Tag não encontrada.')
    if (ids.length === atual.tags.length && ids.every(t => atual.tags.some(a => a.id === t))) return atual
    for (const t of atual.tags.filter(t => !ids.includes(t.id))) {
      db.prepare('DELETE FROM card_tags WHERE card_id = ? AND tag_id = ?').run(id, t.id)
      registrar(id, autor, 'removeu tag', t.nome)
    }
    for (const t of ids.filter(t => !atual.tags.some(a => a.id === t))) {
      db.prepare('INSERT INTO card_tags (card_id, tag_id) VALUES (?, ?)').run(id, t)
      registrar(id, autor, 'adicionou tag', listarTags().find(a => a.id === t)!.nome)
    }
    db.prepare("UPDATE cards SET revisao = revisao + 1, atualizado_em = datetime('now') WHERE id = ?").run(id)
    return exigirCard(id)
  })()
}

export type Coluna = { id: string; quadro_id: string; nome: string; posicao: number }
export type Quadro = { id: string; nome: string; criado_em: string }

function dimensoes(largura: number, altura: number) {
  if (!largura || !altura || largura * altura > 16000000 || largura > 8192 || altura > 8192) throw new Error('Imagem deve ter até 16 milhões de pixels e 8192 px por lado.')
}
export function validarWallpaper(bytes: Buffer): { extensao: string; tipo: string } {
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error('Wallpaper deve ter até 8 MB.')
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    let pos = 8, cabecalho = false, fim = false
    const dados: Buffer[] = []
    while (pos + 12 <= bytes.length) {
      const tamanho = bytes.readUInt32BE(pos), tipo = bytes.toString('ascii', pos + 4, pos + 8)
      if (pos + tamanho + 12 > bytes.length) throw new Error('PNG truncado.')
      let crc = 0xffffffff
      for (const b of bytes.subarray(pos + 4, pos + 8 + tamanho)) {
        crc ^= b
        for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
      }
      if (((crc ^ 0xffffffff) >>> 0) !== bytes.readUInt32BE(pos + 8 + tamanho)) throw new Error('PNG corrompido.')
      if (tipo === 'IHDR') {
        if (pos !== 8 || tamanho !== 13) throw new Error('Cabeçalho PNG inválido.')
        dimensoes(bytes.readUInt32BE(pos + 8), bytes.readUInt32BE(pos + 12))
        cabecalho = true
      }
      if (tipo === 'IDAT') dados.push(bytes.subarray(pos + 8, pos + 8 + tamanho))
      pos += tamanho + 12
      if (tipo === 'IEND') { fim = tamanho === 0 && pos === bytes.length; break }
    }
    if (!cabecalho || !fim || !dados.length) throw new Error('PNG incompleto.')
    inflateSync(Buffer.concat(dados), { maxOutputLength: 160000000 })
    return { extensao: 'png', tipo: 'image/png' }
  }
  if (bytes.length > 10 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) {
    let pos = 2, quadro = false, imagem = false
    while (pos + 4 < bytes.length) {
      if (bytes[pos++] !== 0xff) throw new Error('JPG inválido.')
      while (bytes[pos] === 0xff) pos++
      const marcador = bytes[pos++]
      const tamanho = bytes.readUInt16BE(pos)
      if (tamanho < 2 || pos + tamanho > bytes.length) throw new Error('JPG truncado.')
      if ([0xc0, 0xc1, 0xc2].includes(marcador)) {
        if (tamanho < 8) throw new Error('Cabeçalho JPG inválido.')
        dimensoes(bytes.readUInt16BE(pos + 5), bytes.readUInt16BE(pos + 3)); quadro = true
      }
      if (marcador === 0xda) { imagem = true; break }
      pos += tamanho
    }
    if (!quadro || !imagem) throw new Error('JPG sem imagem.')
    return { extensao: 'jpg', tipo: 'image/jpeg' }
  }
  if (bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length) {
    let pos = 12, imagem = false
    while (pos + 8 <= bytes.length) {
      const tipo = bytes.toString('ascii', pos, pos + 4), tamanho = bytes.readUInt32LE(pos + 4), p = pos + 8
      if (p + tamanho > bytes.length) throw new Error('WebP truncado.')
      if (tipo === 'VP8 ' && tamanho >= 10 && bytes.subarray(p + 3, p + 6).equals(Buffer.from([157, 1, 42]))) {
        dimensoes(bytes.readUInt16LE(p + 6) & 0x3fff, bytes.readUInt16LE(p + 8) & 0x3fff); imagem = true
      }
      if (tipo === 'VP8L' && tamanho >= 5 && bytes[p] === 0x2f) {
        const bits = bytes.readUInt32LE(p + 1)
        dimensoes((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1); imagem = true
      }
      pos = p + tamanho + (tamanho % 2)
    }
    if (!imagem || pos !== bytes.length) throw new Error('WebP inválido ou animado não suportado.')
    return { extensao: 'webp', tipo: 'image/webp' }
  }
  throw new Error('Conteúdo inválido. Aceitos apenas PNG, JPG e WebP; SVG não é permitido.')
}
type Wallpaper = { id: string; arquivo: string; tipo: string; criado_em: string; autor: string }
function pastaWallpapers() { return join(PASTA_DADOS, 'wallpapers') }
export function listarWallpapers() {
  return (db.prepare('SELECT * FROM wallpapers ORDER BY criado_em DESC, rowid DESC').all() as Wallpaper[]).map(w => ({ ...w, url: `/api/wallpapers/${w.id}/arquivo` }))
}
export function obterWallpaper(id: string) {
  const w = db.prepare('SELECT * FROM wallpapers WHERE id = ?').get(id) as Wallpaper | undefined
  if (!w) throw new Error('Wallpaper não encontrado.')
  return { bytes: readFileSync(join(pastaWallpapers(), w.arquivo)), tipo: w.tipo }
}
export function salvarWallpaper(bytes: Buffer, autor: string) {
  const formato = validarWallpaper(bytes), id = uid(), arquivo = `${id}.${formato.extensao}`
  mkdirSync(pastaWallpapers(), { recursive: true })
  const caminho = join(pastaWallpapers(), arquivo)
  writeFileSync(caminho, bytes, { flag: 'wx' })
  try {
    return db.transaction(() => {
      db.prepare('INSERT INTO wallpapers (id, arquivo, tipo, autor) VALUES (?, ?, ?, ?)').run(id, arquivo, formato.tipo, autor)
      registrar(null, autor, 'enviou wallpaper', id)
      return listarWallpapers().find(w => w.id === id)!
    })()
  } catch (e) { unlinkSync(caminho); throw e }
}
export function aparenciaCompartilhada() {
  const p = db.prepare("SELECT valor FROM preferencias WHERE chave = 'wallpaper'").get() as { valor: string } | undefined
  const wallpaper = p?.valor || null
  return { wallpaper, url: wallpaper ? `/api/wallpapers/${wallpaper}/arquivo` : '' }
}
export function escolherWallpaper(id: string | null, autor: string) {
  return db.transaction(() => {
    if (id && !db.prepare('SELECT 1 FROM wallpapers WHERE id = ?').get(id)) throw new Error('Wallpaper não encontrado.')
    db.prepare("INSERT INTO preferencias (chave, valor) VALUES ('wallpaper', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").run(id ?? '')
    registrar(null, autor, 'escolheu wallpaper', id ?? 'Sem wallpaper')
    return aparenciaCompartilhada()
  })()
}
export function apagarWallpaper(id: string, autor: string) {
  obterWallpaper(id)
  return db.transaction(() => {
    if (aparenciaCompartilhada().wallpaper === id) escolherWallpaper(null, autor)
    const w = listarWallpapers().find(w => w.id === id)!
    unlinkSync(join(pastaWallpapers(), w.arquivo))
    db.prepare('DELETE FROM wallpapers WHERE id = ?').run(id)
    registrar(null, autor, 'apagou wallpaper', id)
    return { ok: true }
  })()
}

export type Projeto = { nome: string; cor: string; favorito: boolean; oculto: boolean; ultima_atividade: string | null; colunas: { nome: string; total: number }[] }
export function listarProjetos(ordem: 'atividade' | 'nome' = 'atividade', incluirOcultos = false): Projeto[] {
  const nomes = db.prepare("SELECT projeto AS nome FROM cards WHERE projeto IS NOT NULL AND projeto <> '' UNION SELECT nome FROM projetos").all() as { nome: string }[]
  const colunas = listarColunas(quadroPadrao().id)
  const projetos = nomes.map(({ nome }) => {
    const meta = db.prepare('SELECT * FROM projetos WHERE nome = ?').get(nome) as { cor: string; favorito: number; oculto: number; atualizado_em: string } | undefined
    const ultima = db.prepare('SELECT MAX(atualizado_em) AS data FROM cards WHERE projeto = ?').get(nome) as { data: string | null }
    const indice = [...nome].reduce((n, c) => n + c.charCodeAt(0), 0) % 5
    return { nome, cor: meta?.cor ?? ['#a5c8ff', '#f5c698', '#b9dfba', '#dfb4ed', '#f4abb9'][indice], favorito: !!meta?.favorito, oculto: !!meta?.oculto,
      ultima_atividade: [ultima.data, meta?.atualizado_em ?? null].filter((v): v is string => !!v).sort().at(-1) ?? null,
      colunas: colunas.map(c => ({ nome: c.nome, total: (db.prepare('SELECT COUNT(*) AS n FROM cards WHERE projeto = ? AND coluna_id = ? AND arquivado_em IS NULL').get(nome, c.id) as { n: number }).n })),
    }
  }).filter(p => incluirOcultos || !p.oculto)
  return projetos.sort((a, b) => Number(b.favorito) - Number(a.favorito) || (ordem === 'nome' ? a.nome.localeCompare(b.nome, 'pt-BR') : (b.ultima_atividade ?? '').localeCompare(a.ultima_atividade ?? '') || a.nome.localeCompare(b.nome, 'pt-BR')))
}
export function atualizarProjeto(nome: string, campos: { cor?: string; favorito?: boolean; oculto?: boolean }, autor: string) {
  if (!nome.trim()) throw new Error('Projeto obrigatório.')
  if (campos.cor && !/^#[0-9a-f]{6}$/i.test(campos.cor)) throw new Error('Cor inválida.')
  return db.transaction(() => {
    const atual = listarProjetos('nome', true).find(p => p.nome === nome)
    db.prepare(`INSERT INTO projetos (nome, cor, favorito, oculto) VALUES (?, ?, ?, ?)
      ON CONFLICT(nome) DO UPDATE SET cor = excluded.cor, favorito = excluded.favorito, oculto = excluded.oculto, atualizado_em = datetime('now')`)
      .run(nome, campos.cor ?? atual?.cor ?? '#a5c8ff', Number(campos.favorito ?? atual?.favorito ?? false), Number(campos.oculto ?? atual?.oculto ?? false))
    registrar(null, autor, 'alterou projeto', `${nome}: ${JSON.stringify(campos)}`)
    return listarProjetos('nome', true).find(p => p.nome === nome)!
  })()
}

export function pesquisarCards(busca = '') {
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const cards = db.prepare(`SELECT c.*, col.nome AS coluna FROM cards c JOIN colunas col ON col.id = c.coluna_id ORDER BY c.atualizado_em DESC, c.id`).all() as (Card & { coluna: string })[]
  return cards.flatMap(card => {
    const comentarios = db.prepare("SELECT detalhe FROM eventos WHERE card_id = ? AND acao = 'comentou' ORDER BY rowid").all(card.id) as { detalhe: string }[]
    const campos = [card.titulo, card.descricao, card.projeto ?? '', ...tagsDoCard(card.id).map(t => t.nome), ...comentarios.map(c => c.detalhe)]
    const encontrado = campos.find(c => c.toLocaleLowerCase('pt-BR').includes(termo))
    if (encontrado === undefined) return []
    const inicio = encontrado.toLocaleLowerCase('pt-BR').indexOf(termo)
    const trecho = encontrado.slice(Math.max(0, inicio - 65), inicio + termo.length + 100)
    return [{ ...enriquecer(card), coluna: card.coluna, trecho }]
  })
}

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
    .all(colunaId).map(c => enriquecer(c as Card))
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
  return { ...enriquecer(card), eventos }
}

function criarCardOriginal(opts: {
  colunaId?: string
  coluna?: string
  titulo: string
  descricao?: string
  projeto?: string
  autor: string
  tags?: string[]
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
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Card | undefined
  return card ? enriquecer(card) : undefined
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
  return alterar(null, opts.autor, 'criação', () => {
    const card = criarCardOriginal(opts)
    if (opts.tags) definirTags(card.id, opts.tags, opts.autor)
    return card
  })
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
    const resultado = moverCardOriginal(id, destino, autor)
    gerarProxima(id, autor)
    return resultado
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
  return db.prepare('SELECT * FROM cards WHERE arquivado_em IS NOT NULL ORDER BY arquivado_em DESC, id').all().map(c => enriquecer(c as Card))
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
    if (acao.tipo === 'movimento' && db.prepare('SELECT 1 FROM ocorrencias WHERE origem_card_id = ?').get(acao.card_id)) throw new Error('Este movimento gerou uma ocorrência. Mova o card manualmente; a ocorrência e seu histórico serão preservados.')
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
