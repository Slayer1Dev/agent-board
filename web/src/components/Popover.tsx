import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { t } from '../i18n'

type Props = {
  /** Texto do botão. Em telas estreitas some e fica só o ícone. */
  rotulo: string
  /** Título do painel e dica do botão. */
  titulo: string
  icone: ReactNode
  contador?: number
  /** Marca o botão quando há algo aplicado (um filtro, um projeto escolhido). */
  ativo?: boolean
  /** Pinta o contador com a cor de alerta. */
  alerta?: boolean
  /** Esconde o texto do botão em qualquer largura (continua lido por leitores de tela). */
  soIcone?: boolean
  largura?: number
  /** Para onde o painel abre. No rodapé, para cima. */
  direcao?: 'baixo' | 'cima'
  alinhar?: 'direita' | 'esquerda'
  children: ReactNode | ((fechar: () => void) => ReactNode)
}

/** Botão do cabeçalho que abre um painel em lista. Fecha ao clicar fora e com Esc. */
export function Popover({ rotulo, titulo, icone, contador, ativo, alerta, soIcone, largura = 320, direcao = 'baixo', alinhar = 'direita', children }: Props) {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false) }
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Captura antes do painel do card e do atalho da busca: Esc fecha só o que está por cima.
      e.stopPropagation()
      setAberto(false)
      botao.current?.focus()
    }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla, true)
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', tecla, true) }
  }, [aberto])

  const fechar = () => setAberto(false)

  return (
    <div className={`pop pop--${direcao} pop--${alinhar}`} ref={raiz}>
      <button
        ref={botao}
        type="button"
        className={`btn pop__botao${ativo ? ' pop__botao--ativo' : ''}`}
        title={titulo}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={() => setAberto(a => !a)}
      >
        {icone}
        <span className={soIcone ? 'so-leitor' : 'pop__rotulo'}>{rotulo}</span>
        {!!contador && <span className={`pop__contador${alerta ? ' pop__contador--alerta' : ''}`}>{contador}</span>}
      </button>
      {aberto && (
        <div id={id} className="pop__painel" role="dialog" aria-label={titulo} style={{ width: largura }}>
          <header className="pop__cabeca">
            <strong>{titulo}</strong>
            <button type="button" className="pop__fechar" aria-label={t('Fechar')} onClick={fechar}>×</button>
          </header>
          {typeof children === 'function' ? children(fechar) : children}
        </div>
      )}
    </div>
  )
}

/** Linha de lista com marcação (caixa ou bolinha), usada nos painéis do cabeçalho. */
export function ItemMarcavel({ marcado, tipo = 'caixa', cor, sub, num, aoClicar, children }: {
  marcado: boolean
  tipo?: 'caixa' | 'radio'
  cor?: string
  sub?: ReactNode
  num?: ReactNode
  aoClicar: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className="pop__item" role={tipo === 'caixa' ? 'menuitemcheckbox' : 'menuitemradio'} aria-checked={marcado} onClick={aoClicar}>
      <span className={`pop__marca${tipo === 'radio' ? ' pop__marca--radio' : ''}`} aria-hidden="true">
        {marcado && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5.2 4.2 7.4 8 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      {cor && <span className="pop__cor" style={{ background: cor }} aria-hidden="true" />}
      <span className="pop__texto">{children}{sub && <span className="pop__sub">{sub}</span>}</span>
      {num !== undefined && <span className="pop__num">{num}</span>}
    </button>
  )
}
