import { useState } from 'react'
import type { Coluna as TColuna } from '../api'

type Props = {
  coluna: TColuna
  arrastando: string | null
  aoArrastar: (id: string | null) => void
  aoSoltar: () => void
  aoAbrir: (id: string) => void
  aoAdicionar: (titulo: string) => void
}

export function Coluna({ coluna, arrastando, aoArrastar, aoSoltar, aoAbrir, aoAdicionar }: Props) {
  const [sobre, setSobre] = useState(false)
  const [novo, setNovo] = useState('')
  const [abrindo, setAbrindo] = useState(false)

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    const t = novo.trim()
    if (!t) return
    aoAdicionar(t)
    setNovo('')
    setAbrindo(false)
  }

  return (
    <section
      className={`coluna${sobre ? ' coluna--alvo' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setSobre(true)
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={() => {
        setSobre(false)
        aoSoltar()
      }}
      aria-label={coluna.nome}
    >
      <header className="coluna__topo">
        <h2 className="coluna__nome">{coluna.nome}</h2>
        <span className="coluna__contagem">{coluna.cards.length}</span>
      </header>

      {coluna.cards.length === 0 && (
        <p className="coluna__vazia">{sobre ? 'Soltar aqui' : 'Vazia'}</p>
      )}

      <ul className="coluna__lista" hidden={coluna.cards.length === 0}>
        {coluna.cards.map((card) => (
          <li key={card.id}>
            <article
              className={`card${arrastando === card.id ? ' card--arrastando' : ''}`}
              draggable
              onDragStart={() => aoArrastar(card.id)}
              onDragEnd={() => aoArrastar(null)}
              onClick={() => aoAbrir(card.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  aoAbrir(card.id)
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Abrir ${card.titulo}`}
            >
              <p className="card__titulo">{card.titulo}</p>
              {card.projeto && <span className="card__projeto">{card.projeto}</span>}
            </article>
          </li>
        ))}
      </ul>

      {abrindo ? (
        <form className="novo" onSubmit={enviar}>
          <textarea
            className="novo__campo"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="Título do card"
            rows={2}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) enviar(e)
              if (e.key === 'Escape') setAbrindo(false)
            }}
          />
          <div className="novo__acoes">
            <button className="btn btn--primario" type="submit">
              Adicionar
            </button>
            <button className="btn" type="button" onClick={() => setAbrindo(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button className="coluna__add" type="button" onClick={() => setAbrindo(true)}>
          + Adicionar card
        </button>
      )}
    </section>
  )
}
