import { useEffect, useState } from 'react'
import { api, type Card } from '../api'
import { Popover } from './Popover'

function dataCampo(data: string | null) {
  if (!data) return ''
  const d = new Date(data)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
export function Lembrete({ card, aoMudar }: { card: Card; aoMudar: () => Promise<void> }) {
  const [data, setData] = useState(() => dataCampo(card.lembrete_em))
  const [nota, setNota] = useState(card.lembrete_nota || '')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true)
    try { await acao(); await aoMudar(); setErro('') } catch (e) { setErro((e as Error).message) }
    finally { setOcupado(false) }
  }
  return <fieldset className="controles" disabled={ocupado}><legend>Lembrete {card.lembrete_estado ? `· ${card.lembrete_estado}` : ''}</legend><div className="linha-campos"><label>Data e hora <input type="datetime-local" value={data} onChange={e => setData(e.target.value)} /></label><input aria-label="Nota do lembrete" maxLength={2000} value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota opcional" /><button className="btn" onClick={() => void executar(() => api.definirLembrete(card.id, data ? new Date(data).toISOString() : null, nota, card.revisao))}>Salvar lembrete</button></div>{card.lembrete_em && <div className="linha-campos">{[{ acao: 'feito', nome: 'Marcar feito' }, { acao: 'hora', nome: '+1 hora' }, { acao: 'amanha', nome: 'Amanhã' }, { acao: 'semana', nome: 'Próxima semana' }].map(a => <button className="tag" key={a.acao} onClick={() => void executar(() => api.agirLembrete(card.id, a.acao, card.revisao))}>{a.nome}</button>)}<button className="tag" onClick={() => void executar(() => api.definirLembrete(card.id, null, '', card.revisao))}>Remover</button></div>}{erro && <p role="alert">{erro}</p>}</fieldset>
}
const Sino = <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 11V7.2a4 4 0 0 1 8 0V11l1.2 1.5H2.8z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M6.6 14h2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>

/** Sino do cabeçalho: lembretes vencidos e de hoje, em lista. */
export function LembretesTopo({ versao, aoAbrir }: { versao: string; aoAbrir: (id: string) => void }) {
  const [cards, setCards] = useState<Card[]>([])
  const [erro, setErro] = useState('')
  useEffect(() => {
    let ativo = true
    const carregar = () => api.lembretes().then(c => { if (ativo) { setCards(c); setErro('') } }).catch(e => { if (ativo) setErro((e as Error).message) })
    void carregar()
    const t = setInterval(carregar, 60000)
    return () => { ativo = false; clearInterval(t) }
  }, [versao])
  const atrasado = cards.some(c => c.lembrete_estado === 'atrasado')
  return (
    <Popover rotulo="Lembretes" soIcone titulo="Lembretes vencidos e de hoje" icone={Sino} contador={cards.length} alerta={atrasado} largura={360}>
      {fechar => (
        <div className="pop__corpo">
          {erro && <p className="pop__erro" role="alert">{erro}</p>}
          {!erro && !cards.length && <p className="pop__vazio">Nenhum lembrete vencido ou para hoje.</p>}
          {cards.map(c => (
            <button key={c.id} type="button" className={`lembrete-item lembrete-item--${c.lembrete_estado}`} onClick={() => { aoAbrir(c.id); fechar() }}>
              <strong>{c.titulo}</strong>
              <span>{c.lembrete_estado === 'atrasado' ? 'Atrasado' : 'Hoje'} · {new Date(c.lembrete_em!).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              {c.lembrete_nota && <small>{c.lembrete_nota}</small>}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}
