import { useState } from 'react'
import type { Coluna as TColuna } from '../api'
import { Autor, DataHora, Projeto, projetoDoCard, tituloDoCard } from './Identidade'

type Props = {
  total: number
  filtrado: boolean
  autores: Record<string, string | null>
  coluna: TColuna
  arrastando: string | null
  aoArrastar: (id: string | null) => void
  aoSoltar: () => void
  aoAbrir: (id: string) => void
  aoAdicionar: (titulo: string) => void
}

export function Coluna({ coluna, total, filtrado, autores, arrastando, aoArrastar, aoSoltar, aoAbrir, aoAdicionar }: Props) {
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

  const estado = coluna.nome === 'Em andamento' ? 'andamento' : coluna.nome === 'Revisão' ? 'revisao' : coluna.nome === 'Concluído' ? 'concluido' : 'afazer'
  const dica = { andamento: 'Trabalho em curso', revisao: 'Para conferir', concluido: 'Entregas registradas', afazer: 'Próximos passos' }[estado]

  return (
    <section
      className={`coluna coluna--${estado}${sobre ? ' coluna--alvo' : ''}`}
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
        <div><h2 className="coluna__nome"><span className="coluna__sinal" aria-hidden="true" />{coluna.nome}</h2><p className="coluna__dica">{dica}</p></div>
        <span className="coluna__contagem">{coluna.cards.length}{filtrado && <small> / {total}</small>}</span>
      </header>

      {coluna.cards.length === 0 && (
        <p className="coluna__vazia">{sobre ? 'Soltar aqui' : filtrado ? 'Nenhum card corresponde aos filtros nesta etapa.' : 'Nenhum card nesta etapa.'}</p>
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
              <p className="card__titulo">{tituloDoCard(card)}</p>
              {card.repeticao && <p className="lembrete-estado">↻ {card.repeticao.estado === 'ativa' ? `Próxima: ${card.repeticao.proxima.split('-').reverse().join('/')}` : card.repeticao.estado}</p>}
              {card.lembrete_em && card.lembrete_estado !== 'feito' && <p className={`lembrete-estado lembrete-estado--${card.lembrete_estado}`}>◷ {card.lembrete_estado === 'hoje' ? 'Vence hoje' : card.lembrete_estado === 'atrasado' ? 'Atrasado' : 'Lembrete futuro'} · {new Date(card.lembrete_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</p>}
              {!!card.tags?.length && <div className="tags">{card.tags.map(t => <span className="tag" key={t.id} style={{ borderColor: t.cor }}>{t.nome}</span>)}</div>}
              <div className="card__rodape"><Projeto nome={projetoDoCard(card)} />{card.id in autores ? <Autor nome={autores[card.id]} /> : <span className="card__autoria-carregando">Carregando autoria…</span>}<DataHora valor={card.atualizado_em} curta /></div>
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
            aria-label="Título do card"
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
