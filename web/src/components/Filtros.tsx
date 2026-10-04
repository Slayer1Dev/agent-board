import { useEffect, useState } from 'react'
import { api, type Quadro, type Tag } from '../api'

export function Filtros({ valor, aoMudar, quadro }: { valor: Record<string, string>; aoMudar: (f: Record<string, string>) => void; quadro: Quadro }) {
  const [tags, setTags] = useState<Tag[]>([])
  const [erro, setErro] = useState('')
  useEffect(() => { api.tags().then(setTags).catch(e => setErro((e as Error).message)) }, [quadro])
  const cards = quadro.colunas.flatMap(c => c.cards)
  const autores = [...new Set(cards.map(c => c.autor).filter((a): a is string => !!a))].sort()
  function mudar(chave: string, v: string) { const novo = { ...valor }; if (v) novo[chave] = v; else delete novo[chave]; aoMudar(novo) }
  const nomes: Record<string, string> = { projeto: 'Projeto', tag: 'Tag', autor: 'Autor', coluna: 'Coluna', depende: 'Depende de mim', lembrete: 'Com lembrete', repetida: 'Repetida', dias: 'Últimos dias', periodo: 'Período' }
  return <div className="filtros-ampliados"><details><summary>Filtrar visão</summary><div className="linha-campos">
    <label>Tag <select value={valor.tag || ''} onChange={e => mudar('tag', e.target.value)}><option value="">Todas</option>{tags.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
    <label>Autor <select value={valor.autor || ''} onChange={e => mudar('autor', e.target.value)}><option value="">Todos</option>{autores.map(a => <option key={a}>{a}</option>)}</select></label>
    <label>Coluna <select value={valor.coluna || ''} onChange={e => mudar('coluna', e.target.value)}><option value="">Todas</option>{quadro.colunas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></label>
    {(['depende', 'lembrete', 'repetida'] as const).map(k => <label key={k}><input type="checkbox" checked={valor[k] === 'true'} onChange={e => mudar(k, e.target.checked ? 'true' : '')} />{nomes[k]}</label>)}
    <label>Últimos <input type="number" min="1" max="36500" placeholder="N dias" value={valor.dias || ''} onChange={e => mudar('dias', e.target.value)} /></label>
    <label>Data <select value={valor.periodo || 'alterado'} onChange={e => mudar('periodo', e.target.value)}><option value="alterado">Alteração</option><option value="criado">Criação</option></select></label>
  </div></details><div className="tags">{Object.entries(valor).map(([k, v]) => <button key={k} className="tag" onClick={() => mudar(k, '')}>{nomes[k] || k}: {k === 'tag' ? tags.find(t => t.id === v)?.nome || v : v === 'true' ? 'sim' : v} ×</button>)}{!!Object.keys(valor).length && <button className="tag" onClick={() => aoMudar({})}>Limpar tudo</button>}</div>{erro && <p role="alert">{erro}</p>}</div>
}
