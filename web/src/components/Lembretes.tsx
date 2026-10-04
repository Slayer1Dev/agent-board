import { useEffect, useState } from 'react'
import { api, type Card } from '../api'

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
export function LembretesTopo({ versao, aoAbrir }: { versao: string; aoAbrir: (id: string) => void }) {
  const [cards, setCards] = useState<Card[]>([])
  const [erro, setErro] = useState('')
  useEffect(() => { let ativo = true; const carregar = () => api.lembretes().then(c => { if (ativo) { setCards(c); setErro('') } }).catch(e => { if (ativo) setErro((e as Error).message) }); void carregar(); const t = setInterval(carregar, 60000); return () => { ativo = false; clearInterval(t) } }, [versao])
  return <details className="lembretes-topo"><summary title="Vencidos e de hoje">◷ {cards.length}<span className="so-leitor"> lembretes vencidos e de hoje</span></summary><div className="lembretes-topo__lista">{erro && <p role="alert">{erro}</p>}{!cards.length && <p>Nenhum lembrete vencido ou de hoje.</p>}{cards.map(c => <button key={c.id} onClick={() => aoAbrir(c.id)}><strong>{c.titulo}</strong><span>{c.lembrete_estado} · {new Date(c.lembrete_em!).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>{c.lembrete_nota && <small>{c.lembrete_nota}</small>}</button>)}</div></details>
}
