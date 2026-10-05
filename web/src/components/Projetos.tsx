import { useEffect, useState } from 'react'
import { api, type ProjetoResumo } from '../api'
import { ItemMarcavel, Popover } from './Popover'

const Icone = <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.6h5A1.5 1.5 0 0 1 14 6.1v5.4A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>

type Campos = { cor?: string; favorito?: boolean; oculto?: boolean }

export function Projetos({ aoEscolher, atual, versao, semProjeto, quadro }: { aoEscolher: (nome: string) => void; atual: string; versao: string; semProjeto: boolean; quadro: string }) {
  const [projetos, setProjetos] = useState<ProjetoResumo[]>([])
  const [ordem, setOrdem] = useState<'atividade' | 'nome'>('atividade')
  const [ocultos, setOcultos] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    api.projetos(ordem, ocultos, quadro).then(p => { if (ativo) { setProjetos(p); setErro('') } }).catch(e => { if (ativo) setErro((e as Error).message) })
    return () => { ativo = false }
  }, [ordem, ocultos, versao, quadro])

  async function mudar(nome: string, campos: Campos) {
    try { await api.atualizarProjeto(nome, campos); setProjetos(await api.projetos(ordem, ocultos, quadro)); setErro('') }
    catch (e) { setErro((e as Error).message) }
  }

  const rotulo = atual === '__sem__' ? 'Sem projeto' : atual || 'Projetos'
  // Fixados primeiro; dentro de cada grupo vale a ordem escolhida, que já vem do servidor.
  const lista = [...projetos.filter(p => p.favorito), ...projetos.filter(p => !p.favorito)]

  return (
    <Popover rotulo={rotulo} titulo="Projetos" icone={Icone} ativo={!!atual} largura={380}>
      {fechar => {
        const escolher = (nome: string) => { aoEscolher(nome); fechar() }
        return (
          <>
            <div className="pop__corpo" role="menu">
              <ItemMarcavel tipo="radio" marcado={!atual} aoClicar={() => escolher('')}>Todos os projetos</ItemMarcavel>
              {lista.map(p => {
                const total = p.colunas.reduce((n, c) => n + c.total, 0)
                const resumo = p.colunas.filter(c => c.total).map(c => `${c.nome} ${c.total}`).join(' · ')
                return (
                  <div key={p.nome} className={`proj${p.oculto ? ' proj--oculto' : ''}`}>
                    <ItemMarcavel tipo="radio" cor={p.cor} marcado={atual === p.nome} num={total} sub={resumo || 'Sem cards no quadro'} aoClicar={() => escolher(atual === p.nome ? '' : p.nome)}>
                      {p.favorito && <span className="proj__estrela" title="Fixado no topo">★</span>}{p.nome}
                    </ItemMarcavel>
                    <span className="proj__acoes">
                      <button type="button" className="proj__acao" aria-pressed={p.favorito} title={p.favorito ? 'Tirar do topo' : 'Fixar no topo'} aria-label={`${p.favorito ? 'Tirar do topo' : 'Fixar no topo'}: ${p.nome}`} onClick={() => void mudar(p.nome, { favorito: !p.favorito })}>{p.favorito ? '★' : '☆'}</button>
                      <button type="button" className="proj__acao" title={p.oculto ? 'Voltar a mostrar' : 'Esconder da lista'} aria-label={`${p.oculto ? 'Voltar a mostrar' : 'Esconder da lista'}: ${p.nome}`} onClick={() => void mudar(p.nome, { oculto: !p.oculto })}>
                        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth="1.4" /><circle cx="8" cy="8" r="1.8" fill="currentColor" />{!p.oculto && <path d="M3 13 13 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}</svg>
                      </button>
                      <input type="color" className="proj__cor" value={p.cor} title="Cor do projeto" aria-label={`Cor do projeto ${p.nome}`} onChange={e => void mudar(p.nome, { cor: e.target.value })} />
                    </span>
                  </div>
                )
              })}
              {semProjeto && <ItemMarcavel tipo="radio" marcado={atual === '__sem__'} aoClicar={() => escolher(atual === '__sem__' ? '' : '__sem__')}>Sem projeto</ItemMarcavel>}
              {erro && <p className="pop__erro" role="alert">{erro}</p>}
            </div>
            <footer className="pop__rodape">
              <span className="pop__segmento" role="group" aria-label="Ordenar projetos">
                <button type="button" aria-pressed={ordem === 'atividade'} onClick={() => setOrdem('atividade')}>Recentes</button>
                <button type="button" aria-pressed={ordem === 'nome'} onClick={() => setOrdem('nome')}>Nome</button>
              </span>
              <label className="pop__opcao"><input type="checkbox" checked={ocultos} onChange={e => setOcultos(e.target.checked)} />Mostrar escondidos</label>
            </footer>
          </>
        )
      }}
    </Popover>
  )
}
