import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { fmtPlate } from '../lib/format.js'
import { isWarmupRow } from '../lib/workout-model.js'
import { pickerDraft, pickerTotal } from '../lib/plate-picker.js'
import Icon from './Icon.jsx'
import './PlatePicker.css'

export default function PlatePicker({ name, unit, kind, base, bar, stock, sets, initial, onApply, close }) {
  const [draft, setDraft] = useState(() => pickerDraft(sets[initial].w, base, kind, stock))
  const [changed, setChanged] = useState(false)
  const [error, setError] = useState(false)
  const total = pickerTotal(kind, base, draft.counts)
  const side = kind === 'pairs' ? (total - base) / 2 : total - base
  const old = Number(sets[initial].w) || 0
  const canApply = draft.exact || changed
  const setLabel = i => isWarmupRow(sets[i])
    ? t('Warm-up') + ' ' + sets.slice(0, i + 1).filter(isWarmupRow).length
    : t('Set {0}', sets.slice(0, i + 1).filter(row => !isWarmupRow(row)).length)
  const adjust = (size, delta) => {
    const limit = stock.find(p => p.w === size)?.n || 0
    const next = Math.max(0, Math.min(limit, (draft.counts[size] || 0) + delta))
    setDraft(current => ({ ...current, counts: { ...current.counts, [size]: next } }))
    setChanged(true)
  }
  const reset = () => { setDraft({ counts: {}, exact: true }); setChanged(true); setError(false) }
  const apply = () => {
    if (!canApply) return
    if (onApply(total)) close()
    else setError(true)
  }
  return <div className="plate-picker">
    <div className="pp-head">
      <div><h3>{t('Plate calculator')}</h3><div className="small dim">{name}</div></div>
      <button type="button" className="pp-reset" onClick={reset}><Icon name="reset" />{t('Reset')}</button>
      <button type="button" className="pp-close" aria-label={t('Close')} onClick={close}><Icon name="xmark" /></button>
    </div>
    <div className="pp-total" aria-live="polite">
      <span className="pp-overline">{t('Total calculated weight')}</span>
      <strong>{fmtPlate(total)} <small>{unit}</small></strong>
      <div className="pp-breakdown">{kind === 'pairs' ? t('{0} per side', fmtPlate(side) + ' ' + unit) : t('Load {0}', fmtPlate(side) + ' ' + unit)}
        <span>{bar ? t('Bar ({0})', unit) : t('Base weight ({0})', unit)}: {fmtPlate(base)} + {kind === 'pairs' ? `(${fmtPlate(side)} × 2)` : fmtPlate(side)} = {fmtPlate(total)} {unit}</span>
      </div>
    </div>
    <div className="pp-section">
      <div className="pp-section-head"><strong>{t('Plates')} · {kind === 'pairs' ? t('Per side') : t('Single stack')}</strong><span>{kind === 'pairs' ? '×2' : t('Single stack')}</span></div>
      <div className="pp-grid">{stock.map(({ w, n }) => <div className="pp-plate" key={w}>
        <span className="pp-size">{fmtPlate(w)} <small>{unit}</small></span>
        <button type="button" aria-label={`${t('Remove')} ${fmtPlate(w)} ${unit} ${t('Plates')}`} disabled={!draft.counts[w]} onClick={() => adjust(w, -1)}><Icon name="minus" /></button>
        <input className="pp-count" type="number" inputMode="numeric" min="0" max={n} step="1" aria-label={`${fmtPlate(w)} ${unit} ${t('Plates')}`} value={draft.counts[w] || 0} onChange={event => {
          const value = Number(event.target.value)
          if (!Number.isFinite(value)) return
          const next = Math.max(0, Math.min(n, Math.trunc(value)))
          setDraft(current => ({ ...current, counts: { ...current.counts, [w]: next } }))
          setChanged(true)
        }} />
        <button type="button" aria-label={`${t('Add')} ${fmtPlate(w)} ${unit} ${t('Plates')}`} disabled={(draft.counts[w] || 0) >= n} onClick={() => adjust(w, 1)}><Icon name="plus" /></button>
      </div>)}</div>
    </div>
    {!draft.exact && !changed && <p className="pp-message">{t('Saved weight {0} cannot be made exactly with these plates. Change a plate or reset to apply a new total.', fmtPlate(old) + ' ' + unit)}</p>}
    {error && <p className="pp-message" role="alert">{t('Workout or plate settings changed. Reopen the picker to continue.')}</p>}
    <button type="button" className="pp-apply" disabled={!canApply} onClick={apply}>{t('Apply {0} to {1}', fmtPlate(total) + ' ' + unit, setLabel(initial))}<Icon name="check" /></button>
  </div>
}
