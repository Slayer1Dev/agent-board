import { useEffect, useRef, useState } from 'react'
import { api, type Card } from '../api'

function Destaque({ texto, busca }: { texto: string; busca: string }) {
  const inicio = texto.toLocaleLowerCase('pt-BR').indexOf(busca.toLocaleLowerCase('pt-BR'))
  if (inicio < 0 || !busca) return <>{texto}</>
  return <>{texto.slice(0, inicio)}<mark>{texto.slice(inicio, inicio + busca.length)}</mark><Destaque texto={texto.slice(inicio + busca.length)} busca={busca} /></>
}

export function Busca({ aoAbrir, versao }: { aoAbrir: (id: string) => void; versao: string }) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<(Card & { coluna: string; trecho: string })[]>([])
  const [erro, setErro] = useState('')
  const [consultaPronta, setConsultaPronta] = useState('')
  const campo = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); campo.current?.focus() }
      if (e.key === 'Escape' && document.activeElement === campo.current) setBusca('')
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])
  useEffect(() => {
    let ativo = true
    const t = setTimeout(() => {
      if (busca.trim()) api.pesquisar(busca.trim()).then(r => { if (ativo) { setResultados(r); setErro(''); setConsultaPronta(busca.trim()) } }).catch(e => { if (ativo) { setErro((e as Error).message); setConsultaPronta(busca.trim()) } })
    }, 180)
    return () => { ativo = false; clearTimeout(t) }
  }, [busca, versao])
  return <section className="busca" aria-label="Pesquisa de cards">
    <label className="busca__campo">Buscar no quadro <input ref={campo} type="search" placeholder="Título, contexto, comentários… · Ctrl+K" value={busca} onChange={e => setBusca(e.target.value)} /></label>
    {busca.trim() && <div className="busca__resultados" aria-live="polite">
      {consultaPronta !== busca.trim() ? <p>Buscando…</p> : erro ? <p role="alert">{erro}</p> : <><p>{resultados.length} resultados · inclui arquivados</p>{resultados.map(c => <button key={c.id} onClick={() => { aoAbrir(c.id); setBusca('') }}><strong><Destaque texto={c.titulo} busca={busca.trim()} /></strong><small>{c.projeto || 'Sem projeto'} · {c.coluna}{c.arquivado_em ? ' · Arquivado' : ''}</small><span><Destaque texto={c.trecho} busca={busca.trim()} /></span></button>)}</>}
    </div>}
  </section>
}
