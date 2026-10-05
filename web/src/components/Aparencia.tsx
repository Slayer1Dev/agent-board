import { useEffect, useRef, useState } from 'react'
import { api, type Wallpaper } from '../api'
import { IDIOMAS, idiomaDoNavegador, t, type Idioma } from '../i18n'

export type Preferencias = {
  /** Sem escolha salva, segue o idioma do navegador. */
  idioma: Idioma
  tema: 'escuro' | 'claro' | 'glass'
  largura: number
  fundo: string
  wallpaper: string
}
const chave = 'agent-board.aparencia.v1'
const padrao: Omit<Preferencias, 'idioma'> = { tema: 'escuro', largura: 0, fundo: 'ardosia', wallpaper: '' }
export function lerPreferencias(): Preferencias {
  try {
    const valor = JSON.parse(localStorage.getItem(chave) || '{}') as Partial<Preferencias>
    return {
      idioma: valor.idioma === 'pt' || valor.idioma === 'en' ? valor.idioma : idiomaDoNavegador(),
      tema: ['claro', 'glass', 'escuro'].includes(valor.tema || '') ? valor.tema! : padrao.tema,
      largura: typeof valor.largura === 'number' && valor.largura >= 260 && valor.largura <= 520 ? valor.largura : 0,
      fundo: ['ardosia', 'oceano', 'ameixa', 'floresta', 'argila'].includes(valor.fundo || '') ? valor.fundo! : padrao.fundo,
      wallpaper: typeof valor.wallpaper === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(valor.wallpaper) ? valor.wallpaper : '',
    }
  } catch { return { ...padrao, idioma: idiomaDoNavegador() } }
}

export function salvarPreferencias(preferencias: Preferencias) {
  localStorage.setItem(chave, JSON.stringify(preferencias))
}

export function Aparencia({ valor, aoMudar, aoFechar }: { valor: Preferencias; aoMudar: (valor: Preferencias) => void; aoFechar: () => void }) {
  const [erro, setErro] = useState('')
  const [lendo, setLendo] = useState(false)
  const [galeria, setGaleria] = useState<Wallpaper[]>([])
  const [atual, setAtual] = useState<string | null>(null)
  useEffect(() => { Promise.all([api.wallpapers(), api.aparencia()]).then(([g, a]) => { setGaleria(g); setAtual(a.wallpaper) }).catch(e => setErro((e as Error).message)) }, [])
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
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) { setErro(t('Escolha uma imagem JPG, PNG ou WebP.')); return }
    if (arquivo.size > 8 * 1024 * 1024) { setErro(t('A imagem deve ter até 8 MB.')); return }
    setLendo(true)
    try {
      const bitmap = await createImageBitmap(arquivo)
      bitmap.close()
      const w = await api.enviarWallpaper(arquivo)
      await escolher(w.id)
      if (ativo.current) setGaleria(await api.wallpapers())
    } catch (e) { if (ativo.current) setErro((e as Error).message) }
    finally { if (ativo.current) setLendo(false) }
  }

  async function escolher(id: string | null) {
    try {
      await api.escolherWallpaper(id)
      const wallpaper = id ? await api.imagemWallpaper(id) : ''
      if (ativo.current) { setAtual(id); aoMudar({ ...valorAtual.current, wallpaper }); setErro('') }
    } catch (e) { if (ativo.current) setErro((e as Error).message) }
  }
  async function apagar(id: string) {
    if (!confirm(t('Apagar esta imagem da galeria do servidor?'))) return
    try { await api.apagarWallpaper(id); setGaleria(await api.wallpapers()); if (id === atual) { setAtual(null); aoMudar({ ...valorAtual.current, wallpaper: '' }) } }
    catch (e) { setErro((e as Error).message) }
  }

  return <div className="overlay" role="presentation" onClick={aoFechar}>
    <div className="painel aparencia" role="dialog" aria-modal="true" aria-label={t('Personalizar quadro')} ref={painel} tabIndex={-1} onClick={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key === 'Escape') aoFechar()
      if (e.key === 'Tab') {
        const campos = Array.from(painel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select') || [])
        if (e.shiftKey && (document.activeElement === campos[0] || document.activeElement === painel.current)) { e.preventDefault(); campos.at(-1)?.focus() }
        else if (!e.shiftKey && (document.activeElement === campos.at(-1) || document.activeElement === painel.current)) { e.preventDefault(); campos[0]?.focus() }
      }
    }}>
      <div className="painel__barra"><span>{t('Seu espaço de trabalho')}</span><button className="painel__fechar" aria-label={t('Fechar personalização')} onClick={aoFechar}>×</button></div>
      <h2 className="painel__titulo">{t('Personalizar quadro')}</h2>
      <p className="painel__dica">{t('Tema, idioma e largura ficam neste navegador. A galeria e o wallpaper escolhido são compartilhados entre navegadores.')}</p>
      {/* O rótulo fica nas duas línguas: quem não lê a atual precisa achar esta opção. */}
      <fieldset className="aparencia__grupo"><legend>Idioma · Language</legend><div className="pop__segmento idiomas">
        {IDIOMAS.map(i => <button key={i.id} type="button" lang={i.id === 'pt' ? 'pt-BR' : 'en'} aria-pressed={valor.idioma === i.id} onClick={() => aoMudar({ ...valor, idioma: i.id })}>{i.nome}</button>)}
      </div></fieldset>
      <fieldset className="aparencia__grupo"><legend>{t('Tema')}</legend><div className="temas">
        {([{ id: 'escuro', nome: 'Escuro' }, { id: 'claro', nome: 'Claro' }, { id: 'glass', nome: 'Liquid glass' }] as const).map(tema => <button key={tema.id} className={`tema-escolha tema-escolha--${tema.id}`} aria-pressed={valor.tema === tema.id} onClick={() => aoMudar({ ...valor, tema: tema.id })}><span className="tema-escolha__previa" aria-hidden="true"><i /><i /><i /></span>{t(tema.nome)}</button>)}
      </div></fieldset>
      <fieldset className="aparencia__grupo"><legend>{t('Cor do fundo')}</legend><div className="fundos">{[{ id: 'ardosia', nome: 'Ardósia' }, { id: 'oceano', nome: 'Oceano' }, { id: 'ameixa', nome: 'Ameixa' }, { id: 'floresta', nome: 'Floresta' }, { id: 'argila', nome: 'Argila' }].map(f => <button key={f.id} className={`fundo-escolha fundo-escolha--${f.id}`} aria-label={t(f.nome)} title={t(f.nome)} aria-pressed={valor.fundo === f.id} onClick={() => { aoMudar({ ...valor, fundo: f.id, wallpaper: '' }); void escolher(null) }}>{valor.fundo === f.id && !valor.wallpaper ? '✓' : ''}</button>)}</div></fieldset>
      <fieldset className="aparencia__grupo"><legend>Wallpaper</legend><label className="arquivo-imagem">{t('Enviar imagem ao servidor')}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={lendo} onChange={e => { void imagem(e.target.files?.[0]); e.target.value = '' }} /></label><p className="painel__dica">{t('JPG, PNG ou WebP, até 8 MB e 16 milhões de pixels. SVG não é aceito.')}</p>{valor.wallpaper && <button className="btn" onClick={() => void escolher(null)}>{t('Remover wallpaper')}</button>}{lendo && <p role="status">{t('Salvando imagem…')}</p>}<div className="wallpapers-galeria">{galeria.map(w => <div key={w.id} className="wallpaper-miniatura"><button aria-label={t('Escolher wallpaper de {autor}', { autor: w.autor })} aria-pressed={atual === w.id} onClick={() => void escolher(w.id)}><Miniatura id={w.id} /><span>{atual === w.id ? t('✓ Atual') : t('Escolher')}</span></button><button className="tag" onClick={() => void apagar(w.id)}>{t('Apagar')}</button></div>)}</div></fieldset>
      <fieldset className="aparencia__grupo"><legend>{t('Largura das listas')}</legend><label className="largura-listas" htmlFor="largura-listas">{valor.largura ? `${valor.largura} px` : t('Automática · preencher a tela')}</label><input id="largura-listas" type="range" min="260" max="520" step="10" value={valor.largura || 320} onChange={e => aoMudar({ ...valor, largura: +e.target.value })} /><button className="btn" aria-pressed={!valor.largura} onClick={() => aoMudar({ ...valor, largura: 0 })}>{t('Ajustar à tela')}</button></fieldset>
      {erro && <p className="painel__erro" role="alert">{erro}</p>}
    </div>
  </div>
}

function Miniatura({ id }: { id: string }) {
  const [url, setUrl] = useState('')
  const [erro, setErro] = useState('')
  useEffect(() => {
    let ativo = true, atual = ''
    api.imagemWallpaper(id).then(u => { atual = u; if (ativo) setUrl(u); else URL.revokeObjectURL(u) }).catch(e => { if (ativo) setErro((e as Error).message) })
    return () => { ativo = false; if (atual) URL.revokeObjectURL(atual) }
  }, [id])
  return url ? <img src={url} alt={t('Prévia do wallpaper')} /> : <span>{erro || t('Carregando…')}</span>
}
