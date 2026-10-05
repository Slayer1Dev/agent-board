import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import './App.css'
import { api, type Card, type Evento, type Quadro, type QuadroResumo } from './api'
import { Coluna } from './components/Coluna'
import { PainelCard } from './components/PainelCard'
import { Atividade } from './components/Atividade'
import { projetoDoCard } from './components/Identidade'
import { useAutores } from './components/useAutores'
import { Arquivados } from './components/Arquivados'
import { Busca } from './components/Busca'
import { Filtros, FiltrosAtivos } from './components/Filtros'
import { useTags } from './components/useTags'
import { Projetos } from './components/Projetos'
import { Quadros } from './components/Quadros'
import { LembretesTopo } from './components/Lembretes'
import { Aparencia, lerPreferencias, salvarPreferencias, type Preferencias } from './components/Aparencia'

export default function App() {
  const [quadro, setQuadro] = useState<Quadro | null>(null)
  // Quadro aberto: fica guardado neste navegador. Vazio = o quadro principal.
  const [quadroId, setQuadroId] = useState(() => { try { return localStorage.getItem('agent-board:quadro') || '' } catch { return '' } })
  const [quadros, setQuadros] = useState<QuadroResumo[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)

  const [acoes, setAcoes] = useState<{ id: string; nome: string }[]>([])
  const [desfazendo, setDesfazendo] = useState(false)
  const travaDesfazer = useRef(false)
  const [avisoAcao, setAvisoAcao] = useState('')
  const [arquivadosAbertos, setArquivadosAbertos] = useState(false)

  const [preferencias, setPreferencias] = useState(lerPreferencias)
  const wallpaperId = useRef<string | null | undefined>(undefined)
  const wallpaperUrl = useRef('')
  const wallpaperLegado = useRef(lerPreferencias().wallpaper)
  const [personalizando, setPersonalizando] = useState(false)
  const [erroPreferencia, setErroPreferencia] = useState('')
  useEffect(() => { document.documentElement.dataset.tema = preferencias.tema }, [preferencias.tema])
  function mudarAparencia(valor: Preferencias) {
    if (valor.wallpaper !== wallpaperUrl.current && wallpaperUrl.current) URL.revokeObjectURL(wallpaperUrl.current)
    wallpaperUrl.current = valor.wallpaper
    setPreferencias(valor)
    try { salvarPreferencias(valor); setErroPreferencia('') }
    catch { setErroPreferencia('A aparência foi aplicada, mas não pôde ser salva neste navegador. Tente remover o wallpaper ou liberar espaço.') }
  }

  const [filtros, setFiltros] = useState<Record<string, string>>(() => Object.fromEntries(new URLSearchParams(location.search)))
  const projeto = filtros.projeto || ''
  const setProjeto = (valor: string) => setFiltros(f => { const novo = { ...f }; if (valor) novo.projeto = valor; else delete novo.projeto; return novo })
  const [idsFiltrados, setIdsFiltrados] = useState<Set<string> | null>(null)
  useEffect(() => {
    history.replaceState(null, '', `${location.pathname}${Object.keys(filtros).length ? '?' + new URLSearchParams(filtros) : ''}${location.hash}`)
    let ativo = true
    if (!quadro) return
    api.filtrar(filtros, quadro.id).then(cards => { if (ativo) setIdsFiltrados(new Set(cards.map(c => c.id))) }).catch(e => { if (ativo) setErro((e as Error).message) })
    return () => { ativo = false }
  }, [filtros, quadro])
  useEffect(() => {
    const voltar = () => setFiltros(Object.fromEntries(new URLSearchParams(location.search)))
    window.addEventListener('popstate', voltar)
    return () => window.removeEventListener('popstate', voltar)
  }, [])

  // Menu de ajustes do cabeçalho: fecha ao clicar fora e com Esc, devolvendo o foco ao botão.
  const [menuAberto, setMenuAberto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const botaoMenuRef = useRef<HTMLButtonElement>(null)
  const fecharMenu = useCallback((devolverFoco = false) => {
    setMenuAberto(false)
    if (devolverFoco) botaoMenuRef.current?.focus()
  }, [])
  useEffect(() => {
    if (!menuAberto) return
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    const fora = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) fecharMenu() }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); fecharMenu(true) } }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', tecla) }
  }, [menuAberto, fecharMenu])
  function teclasDoMenu(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Tab') { fecharMenu(); return }
    if (!(e.target as HTMLElement).matches('[role="menuitem"]')) return
    const itens = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')]
    const atual = itens.indexOf(e.target as HTMLButtonElement)
    const destino = e.key === 'ArrowDown' ? (atual + 1) % itens.length
      : e.key === 'ArrowUp' ? (atual - 1 + itens.length) % itens.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? itens.length - 1 : -1
    if (destino < 0) return
    e.preventDefault()
    itens[destino]?.focus()
  }
  const autores = useAutores(quadro)
  const fecharPainel = useCallback(() => setSelecionado(null), [])

  // Guarda a assinatura do último estado para não re-renderizar a cada poll
  // quando nada mudou — senão o quadro pisca de 4 em 4 segundos.
  const assinatura = useRef('')
  const tags = useTags(assinatura.current)

  const escolherQuadro = useCallback((id: string) => {
    try { if (id) localStorage.setItem('agent-board:quadro', id); else localStorage.removeItem('agent-board:quadro') } catch { /* sem armazenamento: vale só nesta aba */ }
    assinatura.current = ''
    setSelecionado(null)
    setQuadroId(id)
  }, [])

  const carregar = useCallback(async () => {
    try {
      const [q, a, aparencia, lista] = await Promise.all([
        // Se o quadro guardado não existe mais (foi apagado em outra sessão), volta ao principal.
        api.quadro(quadroId).catch(e => { if (quadroId) escolherQuadro(''); throw e }),
        api.atividade(30), api.aparencia(), api.quadros(),
      ])
      if (!aparencia.wallpaper && wallpaperLegado.current.startsWith('data:image/')) {
        const legado = wallpaperLegado.current
        wallpaperLegado.current = ''
        const imagem = await (await fetch(legado)).blob()
        const salvo = await api.enviarWallpaper(new File([imagem], 'wallpaper-legado', { type: imagem.type }))
        Object.assign(aparencia, await api.escolherWallpaper(salvo.id))
      }
      if (wallpaperId.current !== aparencia.wallpaper) {
        const url = aparencia.wallpaper ? await api.imagemWallpaper(aparencia.wallpaper) : ''
        if (wallpaperUrl.current) URL.revokeObjectURL(wallpaperUrl.current)
        wallpaperId.current = aparencia.wallpaper; wallpaperUrl.current = url
        setPreferencias(p => ({ ...p, wallpaper: url }))
      }
      const nova = JSON.stringify([q, a, lista])
      if (nova !== assinatura.current) {
        assinatura.current = nova
        setQuadro(q)
        setEventos(a)
        setQuadros(lista)
      }
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [quadroId, escolherQuadro])

  useEffect(() => {
    carregar()
    // Poll curto: outra sessão de IA pode mexer no quadro a qualquer momento.
    const t = setInterval(() => carregar(), 4000)
    return () => clearInterval(t)
  }, [carregar])

  function registrarAcao(card: Card, nome: string) {
    if (card.acao_id) setAcoes(a => [...a.slice(-29), { id: card.acao_id!, nome }])
    setAvisoAcao(nome + '. Você pode desfazer pelo botão ou Ctrl+Z.')
    assinatura.current = ''
    void carregar()
  }
  const desfazer = useCallback(async () => {
    const ultima = acoes.at(-1)
    if (!ultima || travaDesfazer.current) return
    travaDesfazer.current = true; setDesfazendo(true)
    try {
      await api.desfazer(ultima.id)
      setAcoes(a => a.filter(item => item.id !== ultima.id))
      setSelecionado(null); setArquivadosAbertos(false)
      setAvisoAcao('Desfeito: ' + ultima.nome.toLocaleLowerCase() + '.')
      assinatura.current = ''
      await carregar()
    } catch (e) { setAvisoAcao((e as Error).message) }
    finally { travaDesfazer.current = false; setDesfazendo(false) }
  }, [acoes, carregar])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo?.closest('input, textarea, select, [contenteditable="true"]')) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && acoes.length) { e.preventDefault(); void desfazer() }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [acoes.length, desfazer])

  async function soltarEm(colunaId: string) {
    if (!arrastando) return
    const id = arrastando
    const original = quadro?.colunas.flatMap(c => c.cards).find(c => c.id === id)
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
      const card = await api.moverCard(id, colunaId, undefined, original?.revisao)
      registrarAcao(card, 'Card movido')
    } catch (e) {
      setErro((e as Error).message)
    }
    assinatura.current = ''
    carregar()
  }

  async function adicionar(colunaId: string, titulo: string) {
    try {
      const card = await api.criarCard({ titulo, colunaId })
      registrarAcao(card, 'Card criado')
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
            <p className="vazio__dica">Verifique se o servidor do quadro está no ar e se este computador o alcança. Tentaremos novamente automaticamente.</p><p className="vazio__tecnico">{erro}</p>
          </>
        ) : (
          <><div className="carregando" aria-hidden="true"><i /><i /><i /><i /></div><h1>Carregando o quadro</h1><p>Buscando cards e atividade recente…</p></>
        )}
      </div>
    )
  }

  const total = quadro.colunas.reduce((n, c) => n + c.cards.length, 0)

  const projetos = [...new Set(quadro.colunas.flatMap(c => c.cards.map(projetoDoCard)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const filtrar = (c: Card) => !Object.keys(filtros).length || !!idsFiltrados?.has(c.id)
  const visiveis = quadro.colunas.reduce((n, c) => n + c.cards.filter(filtrar).length, 0)

  return (
    <div className={`app fundo--${preferencias.fundo}${preferencias.wallpaper ? ' com-wallpaper' : ''}${preferencias.largura ? ' listas-fixas' : ''}`} style={{ '--largura-lista': `${preferencias.largura}px`, '--wallpaper': preferencias.wallpaper ? `url("${preferencias.wallpaper}")` : 'none' } as CSSProperties}>
      <header className="topo">
        <div className="topo__identidade">
          <span className="marca" aria-hidden="true"><i /><i /><i /></span>
          <h1 className="topo__titulo" title="agent-board · espaço de trabalho">{quadro.nome}</h1>
        </div>
        <Busca aoAbrir={setSelecionado} versao={assinatura.current} />
        <div className="topo__acoes">
          <Filtros valor={filtros} aoMudar={setFiltros} quadro={quadro} tags={tags} />
          <Projetos aoEscolher={setProjeto} atual={projeto} versao={assinatura.current} semProjeto={projetos.includes('')} quadro={quadro.id} />
          <LembretesTopo versao={assinatura.current} aoAbrir={setSelecionado} />
          <div className="menu" ref={menuRef}>
            <button ref={botaoMenuRef} className={`btn menu__botao${erro ? ' menu__botao--alerta' : ''}`} aria-label={erro ? 'Ajustes (conexão interrompida)' : 'Ajustes'} title="Ajustes" aria-haspopup="menu" aria-expanded={menuAberto} aria-controls="menu-ajustes" onClick={() => setMenuAberto(a => !a)} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setMenuAberto(true) } }}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="3.5" cy="9" r="1.6" fill="currentColor" /><circle cx="9" cy="9" r="1.6" fill="currentColor" /><circle cx="14.5" cy="9" r="1.6" fill="currentColor" /></svg>
            </button>
            {menuAberto && (
              <div id="menu-ajustes" className="menu__lista" role="menu" aria-label="Ajustes" onKeyDown={teclasDoMenu}>
                <button role="menuitem" className="menu__item" disabled={!acoes.length || desfazendo} onClick={() => { fecharMenu(); void desfazer() }}><span>{desfazendo ? 'Desfazendo…' : 'Desfazer'}</span><kbd>Ctrl+Z</kbd></button>
                <button role="menuitem" className="menu__item" onClick={() => { fecharMenu(); setArquivadosAbertos(true) }}>Arquivados</button>
                <button role="menuitem" className="menu__item" onClick={() => { fecharMenu(); setPersonalizando(true) }}>Personalizar</button>
                <div className="menu__separador" role="separator" />
                <div className="menu__info"><span className={`conexao${erro ? ' conexao--erro' : ''}`}>{erro ? 'Conexão interrompida' : 'Atualização automática ativa'}</span><span>{Object.keys(filtros).length ? `${visiveis} de ${total}` : total} cards</span></div>
              </div>
            )}
          </div>
        </div>
      </header>
      <FiltrosAtivos valor={filtros} aoMudar={setFiltros} tags={tags} visiveis={visiveis} total={total} />
      {avisoAcao && <div className="aviso-acao" role="status"><span>{avisoAcao}</span><button onClick={() => setAvisoAcao('')} aria-label="Fechar aviso">×</button></div>}
      {erroPreferencia && <p className="aviso-conexao" role="alert">{erroPreferencia}</p>}
      {erro && <div className="aviso-conexao" role="alert"><strong>Não foi possível atualizar o quadro.</strong> Os últimos dados continuam visíveis. Tentando reconectar… <span>{erro}</span></div>}
      <main className="quadro" aria-label="Quadro Kanban">
        {quadro.colunas.map((c) => (
          <Coluna
            key={c.id}
            coluna={{ ...c, cards: c.cards.filter(filtrar) }}
            total={c.cards.length}
            filtrado={!!Object.keys(filtros).length}
            autores={autores}
            arrastando={arrastando}
            aoArrastar={setArrastando}
            aoSoltar={() => soltarEm(c.id)}
            aoAbrir={setSelecionado}
            aoAdicionar={(titulo) => adicionar(c.id, titulo)}
          />
        ))}
      </main>

      <Atividade
        eventos={eventos}
        inicio={<Quadros quadros={quadros} atual={quadro.id} aoEscolher={escolherQuadro} aoMudar={async () => { assinatura.current = ''; await carregar() }} />}
      />

      {arquivadosAbertos && <Arquivados aoFechar={() => setArquivadosAbertos(false)} aoRestaurar={card => registrarAcao(card, 'Card restaurado')} aoAbrir={id => { setArquivadosAbertos(false); setSelecionado(id) }} />}
      {personalizando && <Aparencia valor={preferencias} aoMudar={mudarAparencia} aoFechar={() => setPersonalizando(false)} />}
      {selecionado && (
        <PainelCard
          id={selecionado}
          aoFechar={fecharPainel}
          aoAcao={registrarAcao}
          aoMudar={() => {
            assinatura.current = ''
            carregar()
          }}
        />
      )}
    </div>
  )
}
