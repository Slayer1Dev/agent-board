import { useEffect, useState } from 'react'
import { api, type Card, type Tag } from '../api'
import { t } from '../i18n'

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
    <div className="tags">{tags.map(tag => <label className="tag" key={tag.id} style={{ borderColor: tag.cor }}><input type="checkbox" checked={card.tags.some(a => a.id === tag.id)} onChange={e => void executar(() => api.definirTags(card.id, e.target.checked ? [...card.tags.map(a => a.id), tag.id] : card.tags.filter(a => a.id !== tag.id).map(a => a.id), card.revisao))} />{tag.nome}<button type="button" aria-label={t('Renomear {nome}', { nome: tag.nome })} onClick={() => { const n = prompt(t('Novo nome da tag'), tag.nome); if (n) void executar(() => api.renomearTag(tag.id, n)) }}>✎</button><button type="button" aria-label={t('Apagar {nome}', { nome: tag.nome })} onClick={() => { if (confirm(t('Apagar a tag {nome} de todos os cards?', { nome: tag.nome }))) void executar(() => api.apagarTag(tag.id)) }}>×</button></label>)}</div>
    <div className="linha-campos"><input aria-label={t('Nova tag')} value={nome} maxLength={60} onChange={e => setNome(e.target.value)} placeholder={t('Nova tag')} /><button type="button" className="btn" disabled={!nome.trim()} onClick={() => void executar(async () => { const nova = await api.criarTag(nome); await api.definirTags(card.id, [...card.tags.map(a => a.id), nova.id], card.revisao); setNome('') })}>{t('Criar e adicionar')}</button></div>
    {erro && <p role="alert">{erro}</p>}
  </fieldset>
}
