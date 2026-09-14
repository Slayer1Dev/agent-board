import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { api, type Card, type Evento, type Quadro } from './api'
import { Coluna } from './components/Coluna'
import { PainelCard } from './components/PainelCard'
import { Atividade } from './components/Atividade'

export default function App() {
  const [quadro, setQuadro] = useState<Quadro | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)

  // Guarda a assinatura do último estado para não re-renderizar a cada poll
  // quando nada mudou — senão o quadro pisca de 4 em 4 segundos.
  const assinatura = useRef('')

  const carregar = useCallback(async (comIndicador = false) => {
    try {
      const [q, a] = await Promise.all([api.quadro(), api.atividade(30)])
      const nova = JSON.stringify([q, a])
      if (nova !== assinatura.current) {
        assinatura.current = nova
        setQuadro(q)
        setEventos(a)
      }
      setErro(null)
    } catch (e) {
      if (comIndicador) setErro((e as Error).message)
    }
  }, [])

  useEffect(() => {
    carregar(true)
    // Poll curto: outra sessão de IA pode mexer no quadro a qualquer momento.
    const t = setInterval(() => carregar(), 4000)
    return () => clearInterval(t)
  }, [carregar])

  async function soltarEm(colunaId: string) {
    if (!arrastando) return
    const id = arrastando
    setArrastando(null)

    // Otimista: move na tela antes da resposta, senão o arraste parece travado.
    setQuadro((q) => {
      if (!q) return q
      let card: Card | undefined
      const colunas = q.colunas.map((c) => {
        const restantes = c.cards.filter((k) => {
          if (k.id === id) card = k
          return k.id !== id
        })
        return { ...c, cards: restantes }
      })
      if (!card) return q
      return {
        ...q,
        colunas: colunas.map((c) =>
          c.id === colunaId ? { ...c, cards: [...c.cards, { ...card!, coluna_id: colunaId }] } : c,
        ),
      }
    })

    try {
      await api.moverCard(id, colunaId)
    } catch (e) {
      setErro((e as Error).message)
    }
    assinatura.current = ''
    carregar()
  }

  async function adicionar(colunaId: string, titulo: string) {
    try {
      await api.criarCard({ titulo, colunaId })
      assinatura.current = ''
      carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  if (!quadro) {
    return (
      <div className="vazio">
        {erro ? (
          <>
            <p className="vazio__erro">Não consegui falar com o servidor.</p>
            <p className="vazio__dica">{erro}</p>
          </>
        ) : (
          <p>Carregando…</p>
        )}
      </div>
    )
  }

  const total = quadro.colunas.reduce((n, c) => n + c.cards.length, 0)

  return (
    <div className="app">
      <header className="topo">
        <div>
          <h1 className="topo__titulo">{quadro.nome}</h1>
          <p className="topo__meta">
            {total} {total === 1 ? 'card' : 'cards'} · atualiza sozinho
          </p>
        </div>
        {erro && <span className="topo__erro">{erro}</span>}
      </header>

      <main className="quadro">
        {quadro.colunas.map((c) => (
          <Coluna
            key={c.id}
            coluna={c}
            arrastando={arrastando}
            aoArrastar={setArrastando}
            aoSoltar={() => soltarEm(c.id)}
            aoAbrir={setSelecionado}
            aoAdicionar={(titulo) => adicionar(c.id, titulo)}
          />
        ))}
      </main>

      <Atividade eventos={eventos} />

      {selecionado && (
        <PainelCard
          id={selecionado}
          aoFechar={() => setSelecionado(null)}
          aoMudar={() => {
            assinatura.current = ''
            carregar()
          }}
        />
      )}
    </div>
  )
}
