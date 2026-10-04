import { useEffect, useRef, useState } from 'react'

export type Preferencias = {
  tema: 'escuro' | 'claro' | 'glass'
  largura: number
  fundo: string
  wallpaper: string
}
const chave = 'agent-board.aparencia.v1'
const padrao: Preferencias = { tema: 'escuro', largura: 0, fundo: 'ardosia', wallpaper: '' }
export function lerPreferencias(): Preferencias {
  try {
    const valor = JSON.parse(localStorage.getItem(chave) || '{}') as Partial<Preferencias>
    return {
      tema: ['claro', 'glass', 'escuro'].includes(valor.tema || '') ? valor.tema! : padrao.tema,
      largura: typeof valor.largura === 'number' && valor.largura >= 260 && valor.largura <= 520 ? valor.largura : 0,
      fundo: ['ardosia', 'oceano', 'ameixa', 'floresta', 'argila'].includes(valor.fundo || '') ? valor.fundo! : padrao.fundo,
      wallpaper: typeof valor.wallpaper === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(valor.wallpaper) ? valor.wallpaper : '',
    }
  } catch { return padrao }
}

export function salvarPreferencias(preferencias: Preferencias) {
  localStorage.setItem(chave, JSON.stringify(preferencias))
}

export function Aparencia({ valor, aoMudar, aoFechar }: { valor: Preferencias; aoMudar: (valor: Preferencias) => void; aoFechar: () => void }) {
  const [erro, setErro] = useState('')
  const [lendo, setLendo] = useState(false)
  const painel = useRef<HTMLDivElement>(null)
  const ativo = useRef(true)
  const valorAtual = useRef(valor)
  useEffect(() => { valorAtual.current = valor }, [valor])
  useEffect(() => {
    ativo.current = true
    const anterior = document.activeElement as HTMLElement | null
    painel.current?.focus()
    return () => { ativo.current = false; anterior?.focus() }
  }, [])

  async function imagem(arquivo?: File) {
    if (!arquivo) return
    setErro('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) { setErro('Escolha uma imagem JPG, PNG ou WebP.'); return }
    if (arquivo.size > 15 * 1024 * 1024) { setErro('A imagem deve ter até 15 MB.'); return }
    setLendo(true)
    try {
      const bitmap = await createImageBitmap(arquivo)
      const escala = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * escala))
      canvas.height = Math.max(1, Math.round(bitmap.height * escala))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Não foi possível preparar a imagem.')
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      const wallpaper = canvas.toDataURL('image/jpeg', 0.85)
      if (ativo.current) aoMudar({ ...valorAtual.current, wallpaper })
    } catch { if (ativo.current) setErro('Não foi possível abrir ou guardar esta imagem. Tente um arquivo menor.') }
    finally { if (ativo.current) setLendo(false) }
  }

  return <div className="overlay" role="presentation" onClick={aoFechar}>
    <div className="painel aparencia" role="dialog" aria-modal="true" aria-label="Personalizar quadro" ref={painel} tabIndex={-1} onClick={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key === 'Escape') aoFechar()
      if (e.key === 'Tab') {
        const campos = Array.from(painel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select') || [])
        if (e.shiftKey && (document.activeElement === campos[0] || document.activeElement === painel.current)) { e.preventDefault(); campos.at(-1)?.focus() }
        else if (!e.shiftKey && (document.activeElement === campos.at(-1) || document.activeElement === painel.current)) { e.preventDefault(); campos[0]?.focus() }
      }
    }}>
      <div className="painel__barra"><span>Seu espaço de trabalho</span><button className="painel__fechar" aria-label="Fechar personalização" onClick={aoFechar}>×</button></div>
      <h2 className="painel__titulo">Personalizar quadro</h2>
      <p className="painel__dica">Preferências salvas neste navegador. O wallpaper fica no seu dispositivo.</p>
      <fieldset className="aparencia__grupo"><legend>Tema</legend><div className="temas">
        {([{ id: 'escuro', nome: 'Escuro' }, { id: 'claro', nome: 'Claro' }, { id: 'glass', nome: 'Liquid glass' }] as const).map(t => <button key={t.id} className={`tema-escolha tema-escolha--${t.id}`} aria-pressed={valor.tema === t.id} onClick={() => aoMudar({ ...valor, tema: t.id })}><span className="tema-escolha__previa" aria-hidden="true"><i /><i /><i /></span>{t.nome}</button>)}
      </div></fieldset>
      <fieldset className="aparencia__grupo"><legend>Cor do fundo</legend><div className="fundos">{[{ id: 'ardosia', nome: 'Ardósia' }, { id: 'oceano', nome: 'Oceano' }, { id: 'ameixa', nome: 'Ameixa' }, { id: 'floresta', nome: 'Floresta' }, { id: 'argila', nome: 'Argila' }].map(f => <button key={f.id} className={`fundo-escolha fundo-escolha--${f.id}`} aria-label={f.nome} title={f.nome} aria-pressed={valor.fundo === f.id} onClick={() => aoMudar({ ...valor, fundo: f.id, wallpaper: '' })}>{valor.fundo === f.id && !valor.wallpaper ? '✓' : ''}</button>)}</div></fieldset>
      <fieldset className="aparencia__grupo"><legend>Wallpaper</legend><label className="arquivo-imagem">Escolher imagem do dispositivo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={lendo} onChange={e => { void imagem(e.target.files?.[0]); e.target.value = '' }} /></label><p className="painel__dica">JPG, PNG ou WebP, até 15 MB. Ajustada ao tamanho da tela, sem enviar ao servidor.</p>{valor.wallpaper && <button className="btn" onClick={() => aoMudar({ ...valor, wallpaper: '' })}>Remover wallpaper</button>}{lendo && <p role="status">Preparando imagem…</p>}</fieldset>
      <fieldset className="aparencia__grupo"><legend>Largura das listas</legend><label className="largura-listas" htmlFor="largura-listas">{valor.largura ? `${valor.largura} px` : 'Automática · preencher a tela'}</label><input id="largura-listas" type="range" min="260" max="520" step="10" value={valor.largura || 320} onChange={e => aoMudar({ ...valor, largura: +e.target.value })} /><button className="btn" aria-pressed={!valor.largura} onClick={() => aoMudar({ ...valor, largura: 0 })}>Ajustar à tela</button></fieldset>
      {erro && <p className="painel__erro" role="alert">{erro}</p>}
    </div>
  </div>
}
