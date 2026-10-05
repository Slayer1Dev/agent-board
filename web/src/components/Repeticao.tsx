import { useState } from 'react'
import { api, type Card, type RegraRepeticao } from '../api'
import { dataDia, t, tNome } from '../i18n'

export function Repeticao({ card, aoMudar }: { card: Card; aoMudar: () => Promise<void> }) {
  const [frequencia, setFrequencia] = useState<RegraRepeticao['frequencia']>(card.repeticao?.regra.frequencia ?? 'diaria')
  const [dias, setDias] = useState<number[]>(card.repeticao?.regra.dias ?? [1])
  const [dia, setDia] = useState(card.repeticao?.regra.dia ?? 1)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true)
    try { await acao(); await aoMudar(); setErro('') } catch (e) { setErro((e as Error).message) }
    finally { setOcupado(false) }
  }
  return <fieldset className="controles" disabled={ocupado || card.repeticao?.estado === 'encerrada'}><legend>{t('Repetição')} {card.repeticao ? `· ${t(card.repeticao.estado)}` : ''}</legend><div className="linha-campos"><label>{t('Frequência')} <select value={frequencia} onChange={e => setFrequencia(e.target.value as RegraRepeticao['frequencia'])}><option value="diaria">{t('Todo dia')}</option><option value="semanal">{t('Toda semana')}</option><option value="mensal">{t('Todo mês')}</option></select></label>{frequencia === 'mensal' && <label>{t('Dia')} <input type="number" min="1" max="31" value={dia} onChange={e => setDia(+e.target.value)} /></label>}</div>{frequencia === 'semanal' && <div className="linha-campos">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => <label key={d}><input type="checkbox" checked={dias.includes(i)} onChange={e => setDias(e.target.checked ? [...dias, i] : dias.filter(d => d !== i))} />{t(d)}</label>)}</div>}<div className="linha-campos"><button className="btn" onClick={() => void executar(() => api.definirRepeticao(card.id, { frequencia, dias, dia }, card.revisao))}>{t('Salvar repetição')}</button>{card.repeticao && <><button className="tag" onClick={() => void executar(() => api.agirRepeticao(card.id, card.repeticao?.estado === 'pausada' ? 'ativa' : 'pausada', card.revisao))}>{card.repeticao.estado === 'pausada' ? t('Retomar') : t('Pausar')}</button><button className="tag" onClick={() => void executar(() => api.agirRepeticao(card.id, 'encerrada', card.revisao))}>{t('Encerrar')}</button></>}</div>{card.repeticao && <p className="painel__dica">{t('Ocorrência: {periodo}. Próxima: {proxima}. Ao concluir, cria um card em {coluna}. Alterações e pausa valem para a série inteira.', { periodo: card.repeticao.periodo, proxima: dataDia(card.repeticao.proxima), coluna: tNome('A fazer') })}</p>}{erro && <p role="alert">{erro}</p>}</fieldset>
}
