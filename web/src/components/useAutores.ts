import { useEffect, useRef, useState } from 'react'
import { api, type Quadro } from '../api'
import { autorCriacao } from './Identidade'

export function useAutores(quadro: Quadro | null) {
  const [autores, setAutores] = useState<Record<string, string | null>>({})
  const cache = useRef<Record<string, string | null>>({})
  useEffect(() => {
    let cancelado = false
    const fila = quadro?.colunas.flatMap(c => c.cards).filter(c => !(c.id in cache.current)) || []
    // A listagem não inclui autor. Lê o histórico existente com concorrência limitada,
    // uma vez por card, sem transformar o poll de 4 segundos em dezenas de chamadas.
    async function consumir() {
      while (fila.length && !cancelado) {
        const card = fila.shift()!
        try {
          const detalhe = await api.card(card.id)
          if (!cancelado) {
            const autor = autorCriacao(detalhe.eventos)
            cache.current[card.id] = autor
            setAutores(a => ({ ...a, [card.id]: autor }))
          }
        } catch { /* Autoria indisponível não deve impedir a leitura do quadro. */ }
      }
    }
    void Promise.all(Array.from({ length: 4 }, consumir))
    return () => { cancelado = true }
  }, [quadro])
  return autores
}
