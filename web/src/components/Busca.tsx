import { useEffect, useRef, useState } from 'react'
import { api, type Card } from '../api'
import { localidade, t, tNome } from '../i18n'

function Destaque({ texto, busca }: { texto: string; busca: string }) {
  const inicio = texto.toLocaleLowerCase(localidade()).indexOf(busca.toLocaleLowerCase(localidade()))
  if (inicio < 0 || !busca) return <>{texto}</>
  return <>{texto.slice(0, inicio)}<mark>{texto.slice(inicio, inicio + busca.length)}</mark><Destaque texto={texto.slice(inicio + busca.length)} busca={busca} /></>
}

type Resultado = Card & { coluna: string; trecho: string }

/** Busca do cabeçalho: campo compacto e resultados em lista logo abaixo. Ctrl+K foca. */
export function Busca({ aoAbrir, versao }: { aoAbrir: (id: string) => void; versao: string }) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [erro, setErro] = useState('')
  const [consultaPronta, setConsultaPronta] = useState('')
  const raiz = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const termo = busca.trim()

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); campo.current?.focus(); campo.current?.select() }
      if (e.key === 'Escape' && raiz.current?.contains(document.activeElement)) { setBusca(''); campo.current?.blur() }
    }
    const fora = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setBusca('') }
    window.addEventListener('keydown', tecla)
    document.addEventListener('pointerdown', fora)
    return () => { window.removeEventListener('keydown', tecla); document.removeEventListener('pointerdown', fora) }
  }, [])

  useEffect(() => {
    if (!termo) return
    let ativo = true
    const espera = setTimeout(() => {
      api.pesquisar(termo)
        .then(r => { if (ativo) { setResultados(r); setErro(''); setConsultaPronta(termo) } })
        .catch(e => { if (ativo) { setErro((e as Error).message); setConsultaPronta(termo) } })
    }, 180)
    return () => { ativo = false; clearTimeout(espera) }
  }, [termo, versao])

  return (
    <div className="busca" role="search" ref={raiz}>
      <label className="busca__campo">
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m10.5 10.5 3.2 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        <span className="so-leitor">{t('Buscar no quadro')}</span>
        <input ref={campo} type="search" placeholder={t('Buscar cards')} value={busca} onChange={e => setBusca(e.target.value)} />
        <kbd>Ctrl K</kbd>
      </label>
      {termo && (
        <div className="busca__resultados" aria-live="polite">
          {consultaPronta !== termo ? <p className="busca__info">{t('Buscando…')}</p>
            : erro ? <p className="busca__info" role="alert">{erro}</p>
            : (
              <>
                <p className="busca__info">{resultados.length === 1 ? t('1 resultado') : t('{n} resultados', { n: resultados.length })} · {t('inclui arquivados')}</p>
                {resultados.map(c => (
                  <button key={c.id} type="button" className="busca__item" onClick={() => { aoAbrir(c.id); setBusca('') }}>
                    <strong><Destaque texto={c.titulo} busca={termo} /></strong>
                    <small>{c.projeto || t('Sem projeto')} · {tNome(c.coluna)}{c.arquivado_em ? ` · ${t('Arquivado')}` : ''}</small>
                    {c.trecho && <span><Destaque texto={c.trecho} busca={termo} /></span>}
                  </button>
                ))}
              </>
            )}
        </div>
      )}
    </div>
  )
}
