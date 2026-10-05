import type { CSSProperties } from 'react'
import type { Card, Evento } from '../api'
import { localidade, t } from '../i18n'

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

/** Matiz estável (0 a 359) derivado de um texto: o mesmo nome dá sempre a mesma cor. */
function matiz(texto: string) {
  let hash = 0
  for (const letra of texto.toLowerCase()) hash = ((hash * 31) + letra.charCodeAt(0)) >>> 0
  return (Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0) % 360
}

export function Projeto({ nome }: { nome: string }) {
  const estilo = { '--projeto': `hsl(${matiz(nome)} 65% var(--projeto-luz, 78%))` } as CSSProperties
  return <span className={`projeto${nome ? '' : ' projeto--vazio'}`} style={estilo} title={nome || t('Sem projeto')}>{nome || t('Sem projeto')}</span>
}

export function Autor({ nome }: { nome?: string | null }) {
  // Agentes comuns têm cor própria no tema; qualquer outro autor ganha uma cor estável pelo nome.
  const conhecido = ['claude', 'codex', 'astra', 'agy', 'web'].includes(nome?.toLowerCase() || '')
  const estilo = !conhecido && nome ? { '--autor': `hsl(${matiz(nome)} 55% var(--projeto-luz, 78%))` } as CSSProperties : undefined
  return <span className={`autor autor--${conhecido ? nome!.toLowerCase() : 'outro'}`} style={estilo} title={nome ? t('Autor: {nome}', { nome }) : t('Autoria não registrada no histórico')}><span className="autor__marca" aria-hidden="true">{nome?.slice(0, 2).toUpperCase() || '—'}</span>{nome || t('Sem autoria')}</span>
}

export function autorCriacao(eventos: Evento[]) {
  return eventos.find(e => e.acao === 'criou')?.autor || null
}

export function DataHora({ valor, curta = false }: { valor: string; curta?: boolean }) {
  const iso = valor.includes('T') ? valor : valor.replace(' ', 'T') + 'Z'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return <time>{valor}</time>
  return <time className="evento__hora" dateTime={iso} title={data.toLocaleString(localidade())}>{data.toLocaleDateString(localidade(), { day: '2-digit', month: '2-digit' })}{!curta && ` · ${data.toLocaleTimeString(localidade(), { hour: '2-digit', minute: '2-digit' })}`}</time>
}
