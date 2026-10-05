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
export type RegraRepeticao = { frequencia: 'diaria' | 'semanal' | 'mensal'; dias?: number[]; dia?: number }
export type Tag = { id: string; nome: string; cor: string }
export type Wallpaper = { id: string; url: string; criado_em: string; autor: string }
export type ProjetoResumo = { nome: string; cor: string; favorito: boolean; oculto: boolean; ultima_atividade: string | null; colunas: { nome: string; total: number }[] }

export type Coluna = { id: string; nome: string; posicao: number; cards: Card[] }
export type Quadro = { id: string; nome: string; colunas: Coluna[] }
export type QuadroResumo = { id: string; nome: string; criado_em: string; cards: number }
export type Evento = {
  autor: string
  acao: string
  detalhe: string
  criado_em: string
  card_titulo: string | null
}

const BASE = import.meta.env.VITE_API ?? '/api'
const CHAVE = import.meta.env.VITE_API_KEY ?? ''

async function req<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-autor': 'web',
      ...(CHAVE ? { Authorization: `Bearer ${CHAVE}` } : {}),
      ...init?.headers,
    },
  })
  if (!r.ok) {
    const corpo = await r.json().catch(() => ({ erro: r.statusText }))
    throw new Error(corpo.erro ?? `HTTP ${r.status}`)
  }
  return r.json() as Promise<T>
}

export const api = {
  imagemWallpaper: async (id: string) => {
    const r = await fetch(`${BASE}/wallpapers/${id}/arquivo`, { headers: CHAVE ? { Authorization: `Bearer ${CHAVE}` } : {} })
    if (!r.ok) throw new Error('Não foi possível carregar o wallpaper.')
    return URL.createObjectURL(await r.blob())
  },
  wallpapers: () => req<Wallpaper[]>('/wallpapers'),
  enviarWallpaper: (arquivo: File) => req<Wallpaper>('/wallpapers', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: arquivo }),
  apagarWallpaper: (id: string) => req(`/wallpapers/${id}`, { method: 'DELETE' }),
  aparencia: () => req<{ wallpaper: string | null; url: string }>('/aparencia'),
  escolherWallpaper: (wallpaper: string | null) => req<{ wallpaper: string | null; url: string }>('/aparencia', { method: 'PUT', body: JSON.stringify({ wallpaper }) }),
  definirRepeticao: (id: string, regra: RegraRepeticao, revisao: number) => req<Card>(`/cards/${id}/repeticao`, { method: 'PUT', body: JSON.stringify({ regra, revisao }) }),
  agirRepeticao: (id: string, estado: string, revisao: number) => req<Card>(`/cards/${id}/repeticao`, { method: 'POST', body: JSON.stringify({ estado, revisao }) }),
  lembretes: () => req<Card[]>('/lembretes'),
  definirLembrete: (id: string, data: string | null, nota: string, revisao: number) => req<Card>(`/cards/${id}/lembrete`, { method: 'PUT', body: JSON.stringify({ data, nota, revisao }) }),
  agirLembrete: (id: string, acao: string, revisao: number) => req<Card>(`/cards/${id}/lembrete`, { method: 'POST', body: JSON.stringify({ acao, revisao }) }),
  projetos: (ordem: string, ocultos: boolean, quadro = '') => req<ProjetoResumo[]>(`/projetos?ordem=${ordem}&ocultos=${ocultos}${quadro ? `&quadro=${encodeURIComponent(quadro)}` : ''}`),
  atualizarProjeto: (nome: string, campos: { cor?: string; favorito?: boolean; oculto?: boolean }) => req<ProjetoResumo>(`/projetos/${encodeURIComponent(nome)}`, { method: 'PATCH', body: JSON.stringify(campos) }),
  filtrar: (filtros: Record<string, string>, quadro: string) => req<Card[]>(`/cards?${new URLSearchParams({ ...filtros, quadro, arquivados: 'false' })}`),
  tags: () => req<Tag[]>('/tags'),
  criarTag: (nome: string) => req<Tag>('/tags', { method: 'POST', body: JSON.stringify({ nome }) }),
  renomearTag: (id: string, nome: string) => req(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify({ nome }) }),
  apagarTag: (id: string) => req(`/tags/${id}`, { method: 'DELETE' }),
  definirTags: (id: string, tags: string[], revisao: number) => req<Card>(`/cards/${id}/tags`, { method: 'PUT', body: JSON.stringify({ tags, revisao }) }),
  pesquisar: (busca: string) => req<(Card & { coluna: string; trecho: string })[]>(`/cards?busca=${encodeURIComponent(busca)}`),
  quadro: (id = '') => req<Quadro>(`/quadro${id ? `?id=${encodeURIComponent(id)}` : ''}`),
  quadros: () => req<QuadroResumo[]>('/quadros'),
  criarQuadro: (nome: string) => req<QuadroResumo>('/quadros', { method: 'POST', body: JSON.stringify({ nome }) }),
  renomearQuadro: (id: string, nome: string) => req<QuadroResumo>(`/quadros/${id}`, { method: 'PATCH', body: JSON.stringify({ nome }) }),
  apagarQuadro: (id: string) => req<{ ok: true }>(`/quadros/${id}`, { method: 'DELETE' }),
  atividade: (limite = 30) => req<Evento[]>(`/atividade?limite=${limite}`),
  card: (id: string) => req<Card & { eventos: Evento[] }>(`/cards/${id}`),

  criarCard: (dados: { titulo: string; colunaId: string; descricao?: string; projeto?: string }) =>
    req<Card>('/cards', { method: 'POST', body: JSON.stringify(dados) }),

  moverCard: (id: string, colunaId: string, posicao?: number, revisao?: number) =>
    req<Card>(`/cards/${id}/mover`, { method: 'POST', body: JSON.stringify({ colunaId, posicao, revisao }) }),

  atualizarCard: (id: string, dados: { titulo?: string; descricao?: string; revisao?: number }) =>
    req<Card>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),

  comentar: (id: string, texto: string) =>
    req<{ ok: true }>(`/cards/${id}/comentarios`, { method: 'POST', body: JSON.stringify({ texto }) }),

  arquivados: () => req<Card[]>('/arquivados'),
  arquivar: (id: string, revisao: number) => req<Card>(`/cards/${id}/arquivar`, { method: 'POST', body: JSON.stringify({ revisao }) }),
  restaurar: (id: string, revisao: number) => req<Card>(`/cards/${id}/restaurar`, { method: 'POST', body: JSON.stringify({ revisao }) }),
  desfazer: (id: string) => req<Card>(`/acoes/${id}/desfazer`, { method: 'POST', body: '{}' }),

  removerCard: (id: string) => req<{ ok: true }>(`/cards/${id}`, { method: 'DELETE' }),

  criarColuna: (nome: string) =>
    req<Coluna>('/colunas', { method: 'POST', body: JSON.stringify({ nome }) }),
}
