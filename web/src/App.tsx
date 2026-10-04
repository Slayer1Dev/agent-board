import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { api, type Card, type Evento, type Quadro } from './api'
import { Coluna } from './components/Coluna'
import { PainelCard } from './components/PainelCard'
import { Atividade } from './components/Atividade'
import { projetoDoCard } from './components/Identidade'
import { useAutores } from './components/useAutores'

export default function App() {
  const [quadro, setQuadro] = useState<Quadro | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)

  const [projeto, setProjeto] = useState('')
  const autores = useAutores(quadro)
  const fecharPainel = useCallback(() => setSelecionado(null), [])

  // Guarda a assinatura do último estado para não re-renderizar a cada poll
  // quando nada mudou — senão o quadro pisca de 4 em 4 segundos.
  const assinatura = useRef('')

  const carregar = useCallback(async () => {
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
      setErro((e as Error).message)
    }
  }, [])

  useEffect(() => {
    carregar()
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
      <div className="vazio" role="status">
        {erro ? (
          <>
            <p className="vazio__erro">Não consegui falar com o servidor.</p>
            <p className="vazio__dica">Verifique a conexão com a rede Tailscale. Tentaremos novamente automaticamente.</p><p className="vazio__tecnico">{erro}</p>
          </>
        ) : (
          <><div className="carregando" aria-hidden="true"><i /><i /><i /><i /></div><h1>Carregando o quadro</h1><p>Buscando cards e atividade recente…</p></>
        )}
      </div>
    )
  }

  const total = quadro.colunas.reduce((n, c) => n + c.cards.length, 0)

  const projetos = [...new Set(quadro.colunas.flatMap(c => c.cards.map(projetoDoCard)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const filtrar = (c: Card) => !projeto || (projeto === '__sem__' ? !projetoDoCard(c) : projetoDoCard(c) === projeto)
  const visiveis = quadro.colunas.reduce((n, c) => n + c.cards.filter(filtrar).length, 0)

  return (
    <div className="app">
      <header className="topo">
        <div className="topo__identidade">
          <span className="marca" aria-hidden="true"><i /><i /><i /></span>
          <div><p className="topo__produto">agent-board <span>/</span> espaço de trabalho</p><h1 className="topo__titulo">{quadro.nome}</h1></div>
        </div>
        <div className="topo__situacao"><span className={`conexao${erro ? ' conexao--erro' : ''}`}>{erro ? 'Conexão interrompida' : 'Atualização automática'}</span><span className="topo__meta">{total} cards</span></div>
      </header>
      <div className="ferramentas">
        <div className="filtro"><label htmlFor="projeto">Projeto</label><select id="projeto" value={projeto} onChange={e => setProjeto(e.target.value)}><option value="">Todos os projetos</option>{projetos.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}{projetos.includes('') && <option value="__sem__">Sem projeto</option>}</select><span className="filtro__contagem">{projeto ? `${visiveis} de ${total}` : total} cards</span></div>
        <p className="ferramentas__dica">Abra um card para ver contexto e histórico</p>
      </div>
      {erro && <div className="aviso-conexao" role="alert"><strong>Não foi possível atualizar o quadro.</strong> Os últimos dados continuam visíveis. Tentando reconectar… <span>{erro}</span></div>}
      <main className="quadro" aria-label="Quadro Kanban">
        {quadro.colunas.map((c) => (
          <Coluna
            key={c.id}
            coluna={{ ...c, cards: c.cards.filter(filtrar) }}
            total={c.cards.length}
            filtrado={!!projeto}
            autores={autores}
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
          aoFechar={fecharPainel}
          aoMudar={() => {
            assinatura.current = ''
            carregar()
          }}
        />
      )}
    </div>
  )
}
