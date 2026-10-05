import { useEffect, useRef, useState } from 'react'
import { api, type Card } from '../api'
import { t } from '../i18n'
import { DataHora, Projeto, projetoDoCard, tituloDoCard } from './Identidade'

export function Arquivados({ aoFechar, aoRestaurar, aoAbrir }: { aoFechar: () => void; aoRestaurar: (card: Card) => void; aoAbrir: (id: string) => void }) {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const painel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let ativo = true
    const anterior = document.activeElement as HTMLElement | null
    painel.current?.focus()
    const carregar = () => api.arquivados().then(c => { if (ativo) setCards(c) }).catch(e => { if (ativo) setErro((e as Error).message) })
    void carregar()
    const timer = setInterval(carregar, 4000)
    return () => { ativo = false; clearInterval(timer); anterior?.focus() }
  }, [])
  async function restaurar(card: Card) {
    setOcupado(card.id); setErro('')
    try {
      const atualizado = await api.restaurar(card.id, card.revisao)
      setCards(c => c?.filter(item => item.id !== card.id) || [])
      aoRestaurar(atualizado)
    } catch (e) { setErro((e as Error).message) }
    finally { setOcupado(null) }
  }
  const visiveis = cards?.filter(c => `${c.titulo} ${c.projeto || ''}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase()))
  return <div className="overlay" role="presentation" onClick={aoFechar}><div className="painel arquivo" role="dialog" aria-modal="true" aria-label={t('Cards arquivados')} ref={painel} tabIndex={-1} onClick={e => e.stopPropagation()} onKeyDown={e => {
    if (e.key === 'Escape') aoFechar()
    if (e.key === 'Tab') {
      const campos = Array.from(painel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input') || [])
      if (e.shiftKey && (document.activeElement === campos[0] || document.activeElement === painel.current)) { e.preventDefault(); campos.at(-1)?.focus() }
      else if (!e.shiftKey && (document.activeElement === campos.at(-1) || document.activeElement === painel.current)) { e.preventDefault(); campos[0]?.focus() }
    }
  }}>
    <div className="painel__barra"><span>{t('Fora do quadro, sem perder o histórico')}</span><button className="painel__fechar" onClick={aoFechar} aria-label={t('Fechar arquivados')}>×</button></div>
    <h2 className="painel__titulo">{t('Cards arquivados')}</h2><p className="painel__dica">{t('Restaurar devolve o card à coluna de origem.')}</p>
    <label className="rotulo" htmlFor="busca-arquivo">{t('Buscar por título ou projeto')}</label><input id="busca-arquivo" className="comentar__campo" value={busca} onChange={e => setBusca(e.target.value)} />
    {erro && <p role="alert" className="painel__erro">{erro}</p>}
    {!cards && !erro && <p role="status">{t('Carregando arquivados…')}</p>}
    {visiveis?.length === 0 && <p className="arquivo__vazio">{busca ? t('Nenhum card corresponde à busca.') : t('Nenhum card arquivado.')}</p>}
    <ul className="arquivo__lista">{visiveis?.map(c => <li className="arquivo__card" key={c.id}><div className="arquivo__meta"><Projeto nome={projetoDoCard(c)} /><DataHora valor={c.arquivado_em!} /></div><button className="arquivo__titulo" onClick={() => aoAbrir(c.id)}>{tituloDoCard(c)}</button><button className="btn" disabled={!!ocupado} onClick={() => void restaurar(c)}>{ocupado === c.id ? t('Restaurando…') : t('Restaurar')}</button></li>)}</ul>
  </div></div>
}
