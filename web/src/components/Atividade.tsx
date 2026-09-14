import { useState } from 'react'
import type { Evento } from '../api'

/**
 * Barra de atividade: mostra o que cada sessão fez. É o motivo de o quadro
 * existir — sem isto seria só uma lista de tarefas.
 */
export function Atividade({ eventos }: { eventos: Evento[] }) {
  const [aberta, setAberta] = useState(false)

  return (
    <aside className={`atividade${aberta ? ' atividade--aberta' : ''}`}>
      <button
        className="atividade__alca"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
      >
        Atividade
        <span className="atividade__seta" aria-hidden="true">
          {aberta ? '▾' : '▴'}
        </span>
      </button>

      {aberta && (
        <ul className="atividade__lista">
          {eventos.length === 0 && <li className="atividade__vazio">Nada ainda.</li>}
          {eventos.map((e, i) => (
            <li className="evento" key={i}>
              <span className={`autor autor--${e.autor}`}>{e.autor}</span>
              <span className="evento__acao">{e.acao}</span>
              {e.card_titulo && <span className="evento__alvo">{e.card_titulo}</span>}
              {e.detalhe && <span className="evento__detalhe">{e.detalhe}</span>}
              <time className="evento__hora">{e.criado_em.slice(5, 16)}</time>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
