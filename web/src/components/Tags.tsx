import { useEffect, useState } from 'react'
import { api, type Card, type Tag } from '../api'

export function Tags({ card, aoMudar }: { card: Card; aoMudar: () => Promise<void> }) {
  const [tags, setTags] = useState<Tag[]>([])
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => { api.tags().then(setTags).catch(e => setErro((e as Error).message)) }, [])
  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true)
    try { await acao(); setTags(await api.tags()); await aoMudar(); setErro('') }
    catch (e) { setErro((e as Error).message) }
    finally { setOcupado(false) }
  }
  return <fieldset className="controles" disabled={ocupado}><legend>Tags</legend>
    <div className="tags">{tags.map(t => <label className="tag" key={t.id} style={{ borderColor: t.cor }}><input type="checkbox" checked={card.tags.some(a => a.id === t.id)} onChange={e => void executar(() => api.definirTags(card.id, e.target.checked ? [...card.tags.map(a => a.id), t.id] : card.tags.filter(a => a.id !== t.id).map(a => a.id), card.revisao))} />{t.nome}<button type="button" aria-label={`Renomear ${t.nome}`} onClick={() => { const n = prompt('Novo nome da tag', t.nome); if (n) void executar(() => api.renomearTag(t.id, n)) }}>✎</button><button type="button" aria-label={`Apagar ${t.nome}`} onClick={() => { if (confirm(`Apagar a tag ${t.nome} de todos os cards?`)) void executar(() => api.apagarTag(t.id)) }}>×</button></label>)}</div>
    <div className="linha-campos"><input aria-label="Nova tag" value={nome} maxLength={60} onChange={e => setNome(e.target.value)} placeholder="Nova tag" /><button type="button" className="btn" disabled={!nome.trim()} onClick={() => void executar(async () => { const t = await api.criarTag(nome); await api.definirTags(card.id, [...card.tags.map(a => a.id), t.id], card.revisao); setNome('') })}>Criar e adicionar</button></div>
    {erro && <p role="alert">{erro}</p>}
  </fieldset>
}
