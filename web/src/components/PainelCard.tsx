import { useEffect, useRef, useState } from 'react'
import { api, type Card, type Evento } from '../api'
import { t, tDetalhe } from '../i18n'
import { Autor, DataHora, Projeto, autorCriacao, projetoDoCard, tituloDoCard } from './Identidade'
import { Tags } from './Tags'
import { Lembrete } from './Lembretes'
import { Repeticao } from './Repeticao'

type Props = { id: string; aoFechar: () => void; aoMudar: () => void; aoAcao: (card: Card, nome: string) => void }

export function PainelCard({ id, aoFechar, aoMudar, aoAcao }: Props) {
  const [card, setCard] = useState<(Card & { eventos: Evento[] }) | null>(null)
  const [descricao, setDescricao] = useState('')
  const [comentario, setComentario] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const painel = useRef<HTMLElement>(null)

  useEffect(() => {
    let ativo = true
    api.card(id).then((c) => {
      if (ativo) { setCard(c); setDescricao(c.descricao) }
    }).catch(e => { if (ativo) setErro((e as Error).message) })
    return () => { ativo = false }
  }, [id])

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    painel.current?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
      if (e.key !== 'Tab') return
      const campos = Array.from(painel.current?.querySelectorAll<HTMLElement>('button, input, textarea, select, [tabindex="0"]') || []).filter(el => !el.hasAttribute('disabled'))
      const primeiro = campos[0], ultimo = campos[campos.length - 1]
      if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === painel.current)) { e.preventDefault(); ultimo?.focus() }
      else if (!e.shiftKey && (document.activeElement === ultimo || document.activeElement === painel.current)) { e.preventDefault(); primeiro?.focus() }
    }
    window.addEventListener('keydown', tecla)
    return () => { window.removeEventListener('keydown', tecla); anterior?.focus() }
  }, [aoFechar])

  async function salvar() {
    if (!card || descricao === card.descricao) return
    setSalvando(true)
    try {
      const resultado = await api.atualizarCard(id, { descricao, revisao: card.revisao })
      aoAcao(resultado, t('Descrição alterada'))
      const atualizado = await api.card(id)
      setCard(atualizado)
      setErro(null)
      aoMudar()
    } catch (e) { setErro((e as Error).message) }
    finally { setSalvando(false) }
  }

  async function enviarComentario(e: React.FormEvent) {
    e.preventDefault()
    const texto = comentario.trim()
    if (!texto) return
    try {
      await api.comentar(id, texto)
      setComentario('')
      setCard(await api.card(id))
      setErro(null)
      aoMudar()
    } catch (e) { setErro((e as Error).message) }
  }

  async function arquivar() {
    if (!card) return
    try {
      const resultado = card.arquivado_em ? await api.restaurar(id, card.revisao) : await api.arquivar(id, card.revisao)
      aoAcao(resultado, card.arquivado_em ? t('Card restaurado') : t('Card arquivado'))
      aoMudar()
      aoFechar()
    } catch (e) { setErro((e as Error).message) }
  }

  return (
    <div className="overlay" onClick={aoFechar} role="presentation">
      <aside
        className="painel"
        ref={painel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={card?.titulo ?? 'Card'}
      >
        <div className="painel__barra"><span>{t('Contexto do card')}</span><button className="painel__fechar" onClick={aoFechar} aria-label={t('Fechar')}>×</button></div>
        {erro && <p className="painel__erro" role="alert">{t('Não foi possível concluir a operação: {erro}', { erro })}</p>}
        {!card ? (
          <p className="painel__carregando" role="status">{erro ? t('Feche e abra o card para tentar novamente.') : t('Carregando contexto e histórico…')}</p>
        ) : (
          <>
            <header className="painel__topo">
              <h2 className="painel__titulo">{tituloDoCard(card)}</h2>

            </header>

            {card.arquivado_em && <p className="painel__dica">{t('Este card está arquivado. O histórico foi preservado.')}</p>}
            <div className="painel__meta"><Projeto nome={projetoDoCard(card)} /><Autor nome={autorCriacao(card.eventos)} /><span className="painel__dica">{t('Criado em')} <DataHora valor={card.criado_em} /></span></div>

            <Tags card={card} aoMudar={async () => { setCard(await api.card(id)); aoMudar() }} />
            <Lembrete key={`${id}-${card.revisao}`} card={card} aoMudar={async () => { setCard(await api.card(id)); aoMudar() }} />
            <Repeticao key={`rep-${id}-${card.revisao}`} card={card} aoMudar={async () => { setCard(await api.card(id)); aoMudar() }} />
            <label className="rotulo" htmlFor="desc">{t('Descrição')}</label>
            <textarea
              id="desc"
              className="painel__desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onBlur={salvar}
              rows={Math.min(20, Math.max(8, descricao.split("\n").length + Math.ceil(descricao.length / 100)))}
              placeholder={t('Contexto, critério de pronto, links…')}
            />
            <p className="painel__dica" role="status">{salvando ? t('Salvando…') : t('A descrição é salva ao sair do campo.')}</p>

            <h3 className="rotulo">{t('Histórico')} <span>{card.eventos.length}</span></h3>
            <ul className="historico">
              {card.eventos.map((e, i) => (
                <li className={`evento${e.acao === 'comentou' ? ' evento--comentario' : ''}`} key={i}>
                  <Autor nome={e.autor} />
                  <span className="evento__acao">{t(e.acao)}</span>
                  <DataHora valor={e.criado_em} />
                  {e.detalhe && <p className="evento__detalhe">{tDetalhe(e.acao, e.detalhe)}</p>}
                </li>
              ))}
            </ul>

            <form className="comentar" onSubmit={enviarComentario}>
              <input
                className="comentar__campo"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder={t('Deixar uma nota…')}
                aria-label={t('Comentário')}
              />
              <button className="btn btn--primario" type="submit">
                {t('Enviar')}
              </button>
            </form>

            <button className="btn btn--perigo" type="button" onClick={arquivar}>
              {card.arquivado_em ? t('Restaurar card') : t('Arquivar card')}
            </button>
          </>
        )}
      </aside>
    </div>
  )
}
