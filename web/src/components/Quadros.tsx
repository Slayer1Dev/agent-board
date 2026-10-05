import { useState } from 'react'
import { api, type QuadroResumo } from '../api'
import { t, tNome } from '../i18n'
import { ItemMarcavel, Popover } from './Popover'

const Icone = <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M6 2.5v11M10 2.5v7" stroke="currentColor" strokeWidth="1.5" /></svg>

/** Seletor de quadros do rodapé: trocar, criar, renomear e apagar (só quadro vazio). */
export function Quadros({ quadros, atual, aoEscolher, aoMudar }: {
  quadros: QuadroResumo[]
  atual: string
  aoEscolher: (id: string) => void
  aoMudar: () => Promise<void>
}) {
  const [novo, setNovo] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function executar<T>(acao: () => Promise<T>): Promise<T | undefined> {
    setOcupado(true)
    try { const r = await acao(); setErro(''); await aoMudar(); return r }
    catch (e) { setErro((e as Error).message); return undefined }
    finally { setOcupado(false) }
  }

  const quadroAtual = quadros.find(q => q.id === atual)
  const nomeAtual = quadroAtual ? tNome(quadroAtual.nome) : t('Quadros')

  return (
    <Popover rotulo={nomeAtual} titulo={t('Quadros')} icone={Icone} direcao="cima" alinhar="esquerda" largura={320}>
      {fechar => (
        <>
          <div className="pop__corpo" role="menu">
            {quadros.map(q => editando === q.id ? (
              <form key={q.id} className="quadro-form" onSubmit={e => { e.preventDefault(); void executar(() => api.renomearQuadro(q.id, nome)).then(r => { if (r) setEditando(null) }) }}>
                <input aria-label={t('Novo nome do quadro {nome}', { nome: tNome(q.nome) })} value={nome} maxLength={60} disabled={ocupado} onChange={e => setNome(e.target.value)} ref={campo => campo?.focus()} />
                <button type="submit" className="pop__link" disabled={ocupado || !nome.trim()}>{t('Salvar')}</button>
                <button type="button" className="pop__link" onClick={() => { setEditando(null); setErro('') }}>{t('Cancelar')}</button>
              </form>
            ) : (
              <div key={q.id} className="proj">
                <ItemMarcavel tipo="radio" marcado={q.id === atual} num={q.cards} aoClicar={() => { aoEscolher(q.id); fechar() }}>{tNome(q.nome)}</ItemMarcavel>
                <span className="proj__acoes">
                  <button type="button" className="proj__acao" title={t('Renomear')} aria-label={t('Renomear o quadro {nome}', { nome: tNome(q.nome) })} onClick={() => { setEditando(q.id); setNome(q.nome); setErro('') }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13l.6-2.8L11 2.8l2.2 2.2-7.4 7.4z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                  </button>
                  <button
                    type="button"
                    className="proj__acao"
                    disabled={ocupado || q.cards > 0 || quadros.length < 2}
                    title={quadros.length < 2 ? t('É o único quadro') : q.cards > 0 ? t('Só dá para apagar um quadro sem cards') : t('Apagar quadro vazio')}
                    aria-label={t('Apagar o quadro {nome}', { nome: tNome(q.nome) })}
                    onClick={() => void executar(() => api.apagarQuadro(q.id)).then(r => { if (r && q.id === atual) aoEscolher('') })}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </span>
              </div>
            ))}
            {erro && <p className="pop__erro" role="alert">{erro}</p>}
          </div>
          <form className="pop__rodape quadro-form" onSubmit={e => { e.preventDefault(); void executar(() => api.criarQuadro(novo)).then(q => { if (q) { setNovo(''); aoEscolher(q.id); fechar() } }) }}>
            <input aria-label={t('Nome do novo quadro')} placeholder={t('Novo quadro')} value={novo} maxLength={60} disabled={ocupado} onChange={e => setNovo(e.target.value)} />
            <button type="submit" className="btn btn--primario quadro-form__criar" disabled={ocupado || !novo.trim()}>{t('Criar')}</button>
          </form>
        </>
      )}
    </Popover>
  )
}
