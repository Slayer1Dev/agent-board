import { useState, type ReactNode } from 'react'
import type { Evento } from '../api'
import { Autor, DataHora } from './Identidade'

/**
 * Barra de atividade: mostra o que cada sessão fez. É o motivo de o quadro
 * existir — sem isto seria só uma lista de tarefas.
 */
export function Atividade({ eventos, inicio }: { eventos: Evento[]; inicio?: ReactNode }) {
  const [aberta, setAberta] = useState(false)

  return (
    <aside className={`atividade${aberta ? ' atividade--aberta' : ''}`}>
      <div className="atividade__barra">
      {inicio}
      <button
        className="atividade__alca"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        aria-controls="atividade-lista"
      >
        <span className="atividade__titulo">Atividade recente</span><span className="atividade__contagem">{eventos.length}</span>
        {!aberta && eventos[0] && <span className="atividade__resumo"><Autor nome={eventos[0].autor} /><span>{eventos[0].acao} · {eventos[0].card_titulo || eventos[0].detalhe}</span></span>}
        <span className="atividade__seta" aria-hidden="true">
          {aberta ? '▾' : '▴'}
        </span>
      </button>
      </div>

      {aberta && (
        <ul className="atividade__lista" id="atividade-lista">
          {eventos.length === 0 && <li className="atividade__vazio">Nenhuma atividade registrada ainda.</li>}
          {eventos.map((e, i) => (
            <li className="evento" key={i}>
              <Autor nome={e.autor} />
              <span className="evento__acao">{e.acao}</span>
              {e.card_titulo && <span className="evento__alvo">{e.card_titulo}</span>}
              {e.detalhe && <span className="evento__detalhe">{e.detalhe}</span>}
              <DataHora valor={e.criado_em} />
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
