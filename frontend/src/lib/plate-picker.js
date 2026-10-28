import { inventoryFor, plateStack } from './plates.js'
import { isSideSet } from './workout-model.js'

export const pickerStock = (S, kind) => inventoryFor(S).map(({ w, n }) => ({ w, n: kind === 'single' ? n * 2 : n }))

export function pickerTotal(kind, base, counts) {
  const factor = kind === 'pairs' ? 2 : 1
  const quarterUnits = Object.entries(counts).reduce((sum, [size, count]) => sum + Math.round(Number(size) * 4) * count, 0)
  return Math.round((base + factor * quarterUnits / 4) * 100) / 100
}

export function pickerDraft(weight, base, kind, stock) {
  if (!(weight > 0)) return { counts: {}, exact: true }
  const factor = kind === 'pairs' ? 2 : 1
  const required = (weight - base) / factor
  if (required < 0) return { counts: {}, exact: false }
  const { plates, missing } = plateStack(required, stock)
  const counts = {}
  for (const size of plates) counts[size] = (counts[size] || 0) + 1
  return { counts, exact: Math.abs(missing) < 0.001 && Math.abs(pickerTotal(kind, base, counts) - weight) < 0.001 }
}

export const pickerEligible = row => !!row && !isSideSet(row) && !row.side
export const pickerActiveSet = sets => sets.findIndex(row => pickerEligible(row) && !row.done)
