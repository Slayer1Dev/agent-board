import { useEffect, useState } from 'react'
import { api, type Card, type Evento } from '../api'

type Props = { id: string; aoFechar: () => void; aoMudar: () => void }

export function PainelCard({ id, aoFechar, aoMudar }: Props) {
  const [card, setCard] = useState<(Card & { eventos: Evento[] }) | null>(null)
  const [descricao, setDescricao] = useState('')
  const [comentario, setComentario] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.card(id).then((c) => {
      setCard(c)
      setDescricao(c.descricao)
    })
  }, [id])

  useEffect(() => {
    const t = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [aoFechar])

  async function salvar() {
    if (!card || descricao === card.descricao) return
    setSalvando(true)
    await api.atualizarCard(id, { descricao })
    const atualizado = await api.card(id)
    setCard(atualizado)
    setSalvando(false)
    aoMudar()
  }

  async function enviarComentario(e: React.FormEvent) {
    e.preventDefault()
    const t = comentario.trim()
    if (!t) return
    await api.comentar(id, t)
    setComentario('')
    setCard(await api.card(id))
    aoMudar()
  }

  async function remover() {
    await api.removerCard(id)
    aoMudar()
    aoFechar()
  }

  return (
    <div className="overlay" onClick={aoFechar} role="presentation">
      <aside
        className="painel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={card?.titulo ?? 'Card'}
      >
        {!card ? (
          <p className="painel__carregando">Carregando…</p>
        ) : (
          <>
            <header className="painel__topo">
              <h2 className="painel__titulo">{card.titulo}</h2>
              <button className="painel__fechar" onClick={aoFechar} aria-label="Fechar">
                ×
              </button>
            </header>

            {card.projeto && <span className="card__projeto">{card.projeto}</span>}

            <label className="rotulo" htmlFor="desc">
              Descrição
            </label>
            <textarea
              id="desc"
              className="painel__desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onBlur={salvar}
              rows={5}
              placeholder="Contexto, critério de pronto, links…"
            />
            {salvando && <span className="painel__dica">salvando…</span>}

            <h3 className="rotulo">Histórico</h3>
            <ul className="historico">
              {card.eventos.map((e, i) => (
                <li className="evento" key={i}>
                  <span className={`autor autor--${e.autor}`}>{e.autor}</span>
                  <span className="evento__acao">{e.acao}</span>
                  {e.detalhe && <span className="evento__detalhe">{e.detalhe}</span>}
                  <time className="evento__hora">{e.criado_em.slice(5, 16)}</time>
                </li>
              ))}
            </ul>

            <form className="comentar" onSubmit={enviarComentario}>
              <input
                className="comentar__campo"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Deixar uma nota…"
                aria-label="Comentário"
              />
              <button className="btn btn--primario" type="submit">
                Enviar
              </button>
            </form>

            <button className="btn btn--perigo" type="button" onClick={remover}>
              Remover card
            </button>
          </>
        )}
      </aside>
    </div>
  )
}
