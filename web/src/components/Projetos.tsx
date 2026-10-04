import { useEffect, useState } from 'react'
import { api, type ProjetoResumo } from '../api'
import { DataHora } from './Identidade'

export function Projetos({ aoEscolher, atual, versao }: { aoEscolher: (nome: string) => void; atual: string; versao: string }) {
  const [projetos, setProjetos] = useState<ProjetoResumo[]>([])
  const [ordem, setOrdem] = useState('atividade')
  const [ocultos, setOcultos] = useState(false)
  const [erro, setErro] = useState('')
  useEffect(() => { let ativo = true; api.projetos(ordem, ocultos).then(p => { if (ativo) setProjetos(p) }).catch(e => { if (ativo) setErro((e as Error).message) }); return () => { ativo = false } }, [ordem, ocultos, versao])
  async function mudar(nome: string, campos: { cor?: string; favorito?: boolean; oculto?: boolean }) {
    try { await api.atualizarProjeto(nome, campos); setProjetos(await api.projetos(ordem, ocultos)); setErro('') }
    catch (e) { setErro((e as Error).message) }
  }
  return <details className="projetos-resumo"><summary>Projetos · {projetos.length}</summary><div className="linha-campos"><label>Ordenar <select value={ordem} onChange={e => setOrdem(e.target.value)}><option value="atividade">Atividade recente</option><option value="nome">Nome</option></select></label><label><input type="checkbox" checked={ocultos} onChange={e => setOcultos(e.target.checked)} />Mostrar escondidos</label></div>
    <div className="projetos-resumo__lista">{projetos.map(p => <article key={p.nome} className="projeto-resumo" style={{ borderLeftColor: p.cor }}><button className="projeto-resumo__nome" aria-pressed={atual === p.nome} onClick={() => aoEscolher(atual === p.nome ? '' : p.nome)}>{p.nome}</button><div className="projeto-resumo__contagem">{p.colunas.map(c => <span key={c.nome}>{c.nome} <b>{c.total}</b></span>)}</div><small>Última atividade {p.ultima_atividade ? <DataHora valor={p.ultima_atividade} /> : '—'}</small><div className="linha-campos"><button className="tag" aria-pressed={p.favorito} onClick={() => void mudar(p.nome, { favorito: !p.favorito })}>{p.favorito ? '★ Fixado' : '☆ Fixar'}</button><button className="tag" onClick={() => void mudar(p.nome, { oculto: !p.oculto })}>{p.oculto ? 'Mostrar' : 'Esconder'}</button><label>Cor <input type="color" value={p.cor} onChange={e => void mudar(p.nome, { cor: e.target.value })} /></label></div></article>)}</div>{erro && <p role="alert">{erro}</p>}
  </details>
}
