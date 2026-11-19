// The "Logging example" in an exercise's settings: one set, built from the configured weight and
// reps, the way the workout screen will ask for it, and what the volume engine makes of it.
//
// Nothing here decides anything new. The set goes through the same pieces a logged one does:
// makeSideSet for a per-side split (lib/workout-model.js), the meaning a dumbbell weight is
// stamped with (withMeaning, lib/dumbbells.js), workoutVolume for the number (lib/history.js),
// and rowLoad for the plate line (lib/plates.js). So the example cannot say one thing while a
// session saves another. Read-only: it builds a throwaway entry and never touches state.
//
// Only a weighted reps set has a load to explain. Bodyweight, timed and cardio work get null.

import { workoutVolume, isPerSide } from './history.js'
import { makeSideSet, syncSideAggregate, isSideSet, isWarmupRow, dropsOf } from './workout-model.js'
import { withMeaning, entryDbLoad, bellsIn, isBellEx, volumeFactor } from './dumbbells.js'
import { loadKindFor, baseWeightFor, inventoryFor, rowLoad } from './plates.js'
import { usesBar } from './bar.js'
import { PYRAMID_MAX } from './pyramid.js'

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0)

// The set the example shows: a pyramid's first set with a rep target (its own weight), else the
// flat target. Reps as the config sheet saves them: at least 1, and even when split per side.
function firstSet(cfg, perSide) {
  const list = Array.isArray(cfg?.pyramid) ? cfg.pyramid : []
  const at = list.findIndex(p => p !== PYRAMID_MAX && num(p) > 0)
  const typed = at >= 0 ? num(list[at]) : num(cfg?.reps)
  const reps = Math.max(1, Math.round(typed) || 10)
  const w = at >= 0 ? num((cfg?.pyramidWeight || [])[at]) : num(cfg?.weight)
  return { w: Math.max(0, w), r: perSide ? Math.ceil(reps / 2) * 2 : reps }
}

/**
 * One example set for this exercise config, or null when there is no load to explain.
 * `S` is the state as the exercise sees it (lib/ex-unit.js exView), `cfg` the config being edited
 * with its `id`. Options: `mode` ('reps' | 'time' | 'cardio'), `bodyweight` (the sheet's flag),
 * `plates` (Settings → Modules: Plates and warm-ups; off hides the plate line, as in a workout).
 *
 *   → { heading: 'as'|'each'|'total', what, perSide, w, rows: [{ side?, w, r }],
 *       factor, volume, base, kind, load }
 *
 * `heading` is the weight column's heading in the workout ('each' → "Each (kg)"), `what` the one
 * sentence that says what to type: 'each' | 'total' | 'as' | 'one-arm' (dumbbells, kettlebells),
 * 'bar' | 'no-bar' | 'base' | 'plates' (plate-loaded), 'plain' (everything else).
 */
export function loggingExample(S, cfg, { mode = 'reps', bodyweight = false, plates = true } = {}) {
  if (mode !== 'reps' || bodyweight || !cfg?.id) return null
  const id = cfg.id
  const perSide = isPerSide(cfg)
  const { w, r } = firstSet(cfg, perSide)
  // The meaning stamped the way a session stamps it, so volumeFactor reads it like a logged entry.
  const target = withMeaning(S, cfg, id)
  const meaning = entryDbLoad({ target })
  const bell = isBellEx(id)
  const bells = bell ? bellsIn(target) : 0
  // The workout's weight column (views/Workout.jsx loadCol): one bell's heading is already true.
  const heading = bells === 2 ? meaning : 'as'
  let set = { w, r, done: true }
  if (perSide) {
    const split = makeSideSet(set)
    set = syncSideAggregate({ ...split, sides: { L: { ...split.sides.L, done: true }, R: { ...split.sides.R, done: true } } })
  }
  const rows = perSide
    ? [{ side: 'L', w: set.sides.L.w, r: set.sides.L.r }, { side: 'R', w: set.sides.R.w, r: set.sides.R.r }]
    : [{ w, r }]
  const entry = { id, target, sets: [set] }
  const factor = volumeFactor(entry)
  const volume = workoutVolume({ entries: [entry] })
  const kind = loadKindFor(S, cfg)
  const base = kind === 'none' ? 0 : baseWeightFor(S, id)
  const load = plates && kind !== 'none' ? rowLoad(kind, w, base, inventoryFor(S)) : null
  const what = bell ? (bells === 1 ? 'one-arm' : meaning)
    : kind === 'none' ? 'plain'
      : usesBar(id) ? (base > 0 ? 'bar' : 'no-bar')
        : base > 0 ? 'base' : 'plates'
  return { heading, what, perSide, w, rows, factor, volume, base, kind, load }
}

const doneRow = r => ({ ...r, done: true })

/**
 * One workout set's volume and the terms it is made of, for the line under the set (Settings →
 * Workout → "Volume under each set"). The set is counted as if done, so the line follows what is
 * typed before the tick; the number itself is workoutVolume's, so it is what the session counts.
 * Terms: each side, then each drop, as weight × reps; `factor` is the dumbbell one (volumeFactor).
 * null for a warm-up the profile leaves out of volume, and for a set that moves nothing.
 *   → { rows: [{ w, r }], factor, volume }
 */
export function setVolume(entry, set, { warmups = false } = {}) {
  if (!entry || !set || (!warmups && isWarmupRow(set))) return null
  const parts = isSideSet(set) ? [set.sides.L, set.sides.R] : [set]
  const rows = parts.flatMap(p => [p, ...dropsOf(p)]).map(p => ({ w: num(p?.w), r: num(p?.r) }))
  const done = isSideSet(set) ? { ...set, done: true, sides: { L: doneRow(set.sides.L), R: doneRow(set.sides.R) } } : doneRow(set)
  const volume = workoutVolume({ entries: [{ ...entry, sets: [done] }] }, { warmups: true })
  return volume > 0 ? { rows: rows.filter(x => x.w > 0 && x.r > 0), factor: volumeFactor(entry), volume } : null
}

/**
 * The sum behind the volume, in plain numbers: "20 × 10 × 2", or one term per side
 * ("20 × 6 + 20 × 6"). `fmt` formats a weight the way the screen does.
 */
export function volumeSum(ex, fmt = String) {
  if (!ex) return ''
  const terms = ex.rows.map(row => `${fmt(row.w)} × ${row.r}`)
  const sum = terms.join(' + ')
  if (ex.factor === 1) return sum
  return (terms.length > 1 ? `(${sum})` : sum) + ` × ${ex.factor}`
}
