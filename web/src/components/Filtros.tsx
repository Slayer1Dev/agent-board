import type { Quadro, Tag } from '../api'
import { localidade, t, tNome } from '../i18n'
import { ItemMarcavel, Popover } from './Popover'

type Valor = Record<string, string>

const NOMES: Record<string, string> = {
  projeto: 'Projeto', tag: 'Tag', autor: 'Autor', coluna: 'Coluna',
  depende: 'Depende de mim', lembrete: 'Com lembrete', repetida: 'Repetida', dias: 'Período',
}
const PERIODOS = [{ dias: '', nome: 'Qualquer data' }, { dias: '1', nome: 'Hoje' }, { dias: '7', nome: '7 dias' }, { dias: '30', nome: '30 dias' }]

function trocar(valor: Valor, chave: string, v: string): Valor {
  const novo = { ...valor }
  if (v) novo[chave] = v
  else delete novo[chave]
  // `periodo` só faz sentido junto de `dias`.
  if (!novo.dias) delete novo.periodo
  return novo
}

/** Filtros contados no botão: o projeto tem menu próprio e `periodo` acompanha `dias`. */
const ativos = (valor: Valor) => Object.keys(valor).filter(k => k !== 'projeto' && k !== 'periodo')

const Icone = <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4h11M4.5 8h7M6.5 12h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>

export function Filtros({ valor, aoMudar, quadro, tags }: { valor: Valor; aoMudar: (f: Valor) => void; quadro: Quadro; tags: Tag[] }) {
  const cards = quadro.colunas.flatMap(c => c.cards)
  const autores = [...new Set(cards.map(c => c.autor).filter((a): a is string => !!a))].sort((a, b) => a.localeCompare(b, localidade()))
  const mudar = (chave: string, v: string) => aoMudar(trocar(valor, chave, v))
  // Clicar de novo na opção marcada tira o filtro.
  const alternar = (chave: string, v: string) => mudar(chave, valor[chave] === v ? '' : v)
  const total = ativos(valor).length

  return (
    <Popover rotulo={t('Filtros')} titulo={t('Filtrar cards')} icone={Icone} contador={total} ativo={total > 0} largura={320}>
      <div className="pop__corpo" role="menu">
        <p className="pop__secao">{t('Mostrar só')}</p>
        <ItemMarcavel marcado={valor.depende === 'true'} aoClicar={() => alternar('depende', 'true')} sub={t('Cards na coluna {coluna}', { coluna: tNome('Revisão') })}>{t('Depende de mim')}</ItemMarcavel>
        <ItemMarcavel marcado={valor.lembrete === 'true'} aoClicar={() => alternar('lembrete', 'true')}>{t('Com lembrete')}</ItemMarcavel>
        <ItemMarcavel marcado={valor.repetida === 'true'} aoClicar={() => alternar('repetida', 'true')}>{t('Tarefas repetidas')}</ItemMarcavel>

        <p className="pop__secao">Tag</p>
        {!tags.length && <p className="pop__vazio">{t('Nenhuma tag criada. Crie pelo painel de um card.')}</p>}
        {tags.map(tag => <ItemMarcavel key={tag.id} tipo="radio" cor={tag.cor} marcado={valor.tag === tag.id} aoClicar={() => alternar('tag', tag.id)}>{tag.nome}</ItemMarcavel>)}

        <p className="pop__secao">{t('Autor')}</p>
        {autores.map(a => <ItemMarcavel key={a} tipo="radio" marcado={valor.autor === a} aoClicar={() => alternar('autor', a)}>{a}</ItemMarcavel>)}

        <p className="pop__secao">{t('Coluna')}</p>
        {quadro.colunas.map(c => <ItemMarcavel key={c.id} tipo="radio" marcado={valor.coluna === c.nome} num={c.cards.length} aoClicar={() => alternar('coluna', c.nome)}>{tNome(c.nome)}</ItemMarcavel>)}

        <p className="pop__secao">{t('Período')}</p>
        {PERIODOS.map(p => <ItemMarcavel key={p.nome} tipo="radio" marcado={(valor.dias || '') === p.dias} aoClicar={() => mudar('dias', p.dias)}>{t(p.nome)}</ItemMarcavel>)}
      </div>
      <footer className="pop__rodape">
        {valor.dias && (
          <span className="pop__segmento" role="group" aria-label={t('Contar o período pela data de')}>
            <button type="button" aria-pressed={valor.periodo !== 'criado'} onClick={() => mudar('periodo', '')}>{t('Alteração')}</button>
            <button type="button" aria-pressed={valor.periodo === 'criado'} onClick={() => mudar('periodo', 'criado')}>{t('Criação')}</button>
          </span>
        )}
        <button type="button" className="pop__link" disabled={!total} onClick={() => aoMudar(valor.projeto ? { projeto: valor.projeto } : {})}>{t('Limpar filtros')}</button>
      </footer>
    </Popover>
  )
}

/** Faixa fina com os filtros aplicados. Só aparece quando há algum. */
export function FiltrosAtivos({ valor, aoMudar, tags, visiveis, total }: { valor: Valor; aoMudar: (f: Valor) => void; tags: Tag[]; visiveis: number; total: number }) {
  const chaves = Object.keys(valor).filter(k => k !== 'periodo')
  if (!chaves.length) return null
  const nome = (k: string) => NOMES[k] ? t(NOMES[k]) : k
  const texto = (k: string) => {
    const v = valor[k]
    if (k === 'tag') return tags.find(tag => tag.id === v)?.nome || 'tag'
    if (k === 'projeto') return v === '__sem__' ? t('Sem projeto') : v
    if (k === 'coluna') return tNome(v)
    if (k === 'dias') return `${v === '1' ? t('hoje') : t('últimos {n} dias', { n: v })}${valor.periodo === 'criado' ? t(' (criação)') : ''}`
    return v === 'true' ? '' : v
  }
  return (
    <div className="filtros-ativos" role="status">
      <span className="filtros-ativos__contagem">{t('{n} de {total} cards', { n: visiveis, total })}</span>
      {chaves.map(k => (
        <span key={k} className="chip">
          {nome(k)}{texto(k) && <b>{texto(k)}</b>}
          <button type="button" aria-label={t('Remover filtro {nome}', { nome: nome(k) })} onClick={() => aoMudar(trocar(valor, k, ''))}>×</button>
        </span>
      ))}
      {chaves.length > 1 && <button type="button" className="pop__link" onClick={() => aoMudar({})}>{t('Limpar tudo')}</button>}
    </div>
  )
}
