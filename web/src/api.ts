export type Card = {
  id: string
  coluna_id: string
  titulo: string
  descricao: string
  posicao: number
  projeto: string | null
  criado_em: string
  atualizado_em: string
}

export type Coluna = { id: string; nome: string; posicao: number; cards: Card[] }
export type Quadro = { id: string; nome: string; colunas: Coluna[] }
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
  quadro: () => req<Quadro>('/quadro'),
  atividade: (limite = 30) => req<Evento[]>(`/atividade?limite=${limite}`),
  card: (id: string) => req<Card & { eventos: Evento[] }>(`/cards/${id}`),

  criarCard: (dados: { titulo: string; colunaId: string; descricao?: string; projeto?: string }) =>
    req<Card>('/cards', { method: 'POST', body: JSON.stringify(dados) }),

  moverCard: (id: string, colunaId: string, posicao?: number) =>
    req<Card>(`/cards/${id}/mover`, { method: 'POST', body: JSON.stringify({ colunaId, posicao }) }),

  atualizarCard: (id: string, dados: { titulo?: string; descricao?: string }) =>
    req<Card>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),

  comentar: (id: string, texto: string) =>
    req<{ ok: true }>(`/cards/${id}/comentarios`, { method: 'POST', body: JSON.stringify({ texto }) }),

  removerCard: (id: string) => req<{ ok: true }>(`/cards/${id}`, { method: 'DELETE' }),

  criarColuna: (nome: string) =>
    req<Coluna>('/colunas', { method: 'POST', body: JSON.stringify({ nome }) }),
}
