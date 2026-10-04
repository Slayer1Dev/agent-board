import type { CSSProperties } from 'react'
import type { Card, Evento } from '../api'

export function projetoDoCard(card: Card) {
  return card.projeto?.trim() || card.titulo.match(/^\[([^\]]+)\]/)?.[1]?.trim() || ''
}

export function tituloDoCard(card: Card) {
  const projeto = projetoDoCard(card)
  let titulo = card.titulo
  // O prefixo só some da apresentação quando a etiqueta carrega a mesma informação.
  while (titulo.match(/^\[([^\]]+)\]\s*/)?.[1]?.toLowerCase() === projeto.toLowerCase() && projeto) {
    titulo = titulo.replace(/^\[[^\]]+\]\s*/, '')
  }
  return titulo || card.titulo
}

export function Projeto({ nome }: { nome: string }) {
  let hash = 0
  for (const letra of nome.toLowerCase()) hash = ((hash * 31) + letra.charCodeAt(0)) >>> 0
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0
  const estilo = { '--projeto': `hsl(${hash % 360} 65% 78%)` } as CSSProperties
  return <span className={`projeto${nome ? '' : ' projeto--vazio'}`} style={estilo} title={nome || 'Sem projeto'}>{nome || 'Sem projeto'}</span>
}

export function Autor({ nome }: { nome?: string | null }) {
  const conhecido = ['claude', 'codex', 'astra', 'agy', 'lucas', 'web'].includes(nome?.toLowerCase() || '')
  return <span className={`autor autor--${conhecido ? nome!.toLowerCase() : 'outro'}`} title={nome ? `Autor: ${nome}` : 'Autoria não registrada no histórico'}><span className="autor__marca" aria-hidden="true">{nome?.slice(0, 2).toUpperCase() || '—'}</span>{nome || 'Sem autoria'}</span>
}

export function autorCriacao(eventos: Evento[]) {
  return eventos.find(e => e.acao === 'criou')?.autor || null
}

export function DataHora({ valor, curta = false }: { valor: string; curta?: boolean }) {
  const iso = valor.includes('T') ? valor : valor.replace(' ', 'T') + 'Z'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return <time>{valor}</time>
  return <time className="evento__hora" dateTime={iso} title={data.toLocaleString('pt-BR')}>{data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{!curta && ` · ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}</time>
}
