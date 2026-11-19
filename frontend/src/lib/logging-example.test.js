import { describe, expect, test } from 'vitest'
import { loggingExample, volumeSum } from './logging-example.js'
import { withDbLoad } from './dumbbells.js'
import { withLoadKind } from './plates.js'
import { workoutVolume } from './history.js'

const BENCH = '0289'      // dumbbell bench press: two bells
const ROW = '0292'        // dumbbell one arm bent-over row: one bell by its name
const SQUAT = '0043'      // barbell full squat
const LEG_PRESS = '2287'  // lever leg press: a leverage machine, not plate-loaded by default

const kg = { unit: 'kg' }
const ex = (S, cfg, opts) => loggingExample(S, cfg, opts)

describe('loggingExample: what it leaves out', () => {
  test('bodyweight, timed and cardio work has no example', () => {
    expect(ex(kg, { id: BENCH, reps: 10, weight: 20 }, { bodyweight: true })).toBeNull()
    expect(ex(kg, { id: BENCH, reps: 10, weight: 20 }, { mode: 'time' })).toBeNull()
    expect(ex(kg, { id: BENCH, reps: 10, weight: 20 }, { mode: 'cardio' })).toBeNull()
    expect(ex(kg, null)).toBeNull()
  })
})

describe('loggingExample: dumbbells', () => {
  test('Each on two bells: one bell is typed, the volume counts both', () => {
    const e = ex(kg, { id: BENCH, reps: 10, weight: 20, dbLoad: 'each' })
    expect(e.heading).toBe('each')
    expect(e.what).toBe('each')
    expect(e.factor).toBe(2)
    expect(e.volume).toBe(400)
    expect(e.rows).toEqual([{ w: 20, r: 10 }])
  })

  test('Both: the pair together is typed and counted once', () => {
    const e = ex(kg, { id: BENCH, reps: 10, weight: 40, dbLoad: 'total' })
    expect(e.heading).toBe('total')
    expect(e.what).toBe('total')
    expect(e.factor).toBe(1)
    expect(e.volume).toBe(400)
  })

  test('As entered: taken at face value, the plain heading', () => {
    const e = ex(kg, { id: BENCH, reps: 10, weight: 20 })
    expect(e.heading).toBe('as')
    expect(e.what).toBe('as')
    expect(e.factor).toBe(1)
    expect(e.volume).toBe(200)
  })

  test('the exercise default applies when the slot has no meaning of its own', () => {
    const S = { ...kg, dbLoad: withDbLoad({}, BENCH, 'each', 1) }
    expect(ex(S, { id: BENCH, reps: 10, weight: 20 }).factor).toBe(2)
    // and the slot's own choice wins over it
    expect(ex(S, { id: BENCH, reps: 10, weight: 20, dbLoad: 'total' }).factor).toBe(1)
  })

  test('Each with Per side is one bell: counted once, split left and right', () => {
    const e = ex(kg, { id: BENCH, reps: 12, weight: 20, dbLoad: 'each', side: true })
    expect(e.heading).toBe('as')
    expect(e.what).toBe('one-arm')
    expect(e.perSide).toBe(true)
    expect(e.factor).toBe(1)
    expect(e.rows).toEqual([{ side: 'L', w: 20, r: 6 }, { side: 'R', w: 20, r: 6 }])
    expect(e.volume).toBe(240)
  })

  test('a one-arm exercise by its name counts one bell even without Per side', () => {
    const e = ex(kg, { id: ROW, reps: 10, weight: 20, dbLoad: 'each' })
    expect(e.what).toBe('one-arm')
    expect(e.heading).toBe('as')
    expect(e.factor).toBe(1)
    expect(e.volume).toBe(200)
  })
})

describe('loggingExample: per side', () => {
  test('an odd total is rounded up to even, as the sheet saves it', () => {
    const e = ex(kg, { id: SQUAT, reps: 11, weight: 60, side: true })
    expect(e.rows).toEqual([{ side: 'L', w: 60, r: 6 }, { side: 'R', w: 60, r: 6 }])
    expect(e.volume).toBe(720)
  })

  test('at one weight, per side moves the same volume as a straight set', () => {
    const one = ex(kg, { id: SQUAT, reps: 12, weight: 60 })
    const split = ex(kg, { id: SQUAT, reps: 12, weight: 60, side: true })
    expect(split.volume).toBe(one.volume)
  })
})

describe('loggingExample: barbells', () => {
  test('the typed total includes the bar; the plate line splits the rest per side', () => {
    const e = ex(kg, { id: SQUAT, reps: 5, weight: 100 })
    expect(e.what).toBe('bar')
    expect(e.kind).toBe('pairs')
    expect(e.base).toBe(20)
    expect(e.load.perSide).toBe(40)
    expect(e.load.plates.reduce((a, b) => a + b, 0)).toBe(40)
    // the bar is in the volume because it is in the number typed, not added on top
    expect(e.volume).toBe(500)
  })

  test('No bar: the total is all plates', () => {
    const e = ex({ ...kg, barWeights: { [SQUAT]: 0 } }, { id: SQUAT, reps: 5, weight: 100 })
    expect(e.what).toBe('no-bar')
    expect(e.base).toBe(0)
    expect(e.load.perSide).toBe(50)
    expect(e.volume).toBe(500)
  })

  test('a weight at or under the bar is the bar alone', () => {
    expect(ex(kg, { id: SQUAT, reps: 5, weight: 20 }).load.barOnly).toBe(true)
  })

  test('in lb the bar is the lb bar', () => {
    const e = ex({ unit: 'lb' }, { id: SQUAT, reps: 5, weight: 135 })
    expect(e.base).toBe(45)
    expect(e.load.perSide).toBe(45)
  })

  test('with the plates module off there is no plate line, the sentence stays', () => {
    const e = ex(kg, { id: SQUAT, reps: 5, weight: 100 }, { plates: false })
    expect(e.load).toBeNull()
    expect(e.what).toBe('bar')
  })
})

describe('loggingExample: plate-loaded machines', () => {
  test('a single stack on a base weight: the total includes the base', () => {
    const S = { ...kg, loadKind: withLoadKind({}, LEG_PRESS, 'single', 1), barWeights: { [LEG_PRESS]: 40 } }
    const e = ex(S, { id: LEG_PRESS, reps: 10, weight: 120 })
    expect(e.what).toBe('base')
    expect(e.base).toBe(40)
    expect(e.load.kind).toBe('single')
    expect(e.load.perSide).toBe(80)
    expect(e.volume).toBe(1200)
  })

  test('a single stack with no base: all plates', () => {
    const S = { ...kg, loadKind: withLoadKind({}, LEG_PRESS, 'single', 1) }
    expect(ex(S, { id: LEG_PRESS, reps: 10, weight: 120 }).what).toBe('plates')
  })

  test('plate loading off: no plate line and no base to explain', () => {
    const e = ex(kg, { id: LEG_PRESS, reps: 10, weight: 120 })
    expect(e.kind).toBe('none')
    expect(e.what).toBe('plain')
    expect(e.base).toBe(0)
    expect(e.load).toBeNull()
  })
})

describe('loggingExample: odd configs', () => {
  test('zero or missing weight gives a zero example, never NaN', () => {
    const e = ex(kg, { id: SQUAT, reps: undefined, weight: undefined })
    expect(e.w).toBe(0)
    expect(e.rows[0].r).toBe(10)
    expect(e.volume).toBe(0)
    expect(e.load).toBeNull()
  })

  test('a pyramid shows its first set with a rep target, at its own weight', () => {
    const e = ex(kg, { id: SQUAT, reps: 8, weight: 0, pyramid: ['max', 12, 8], pyramidWeight: [0, 60, 80] })
    expect(e.rows).toEqual([{ w: 60, r: 12 }])
    expect(e.volume).toBe(720)
  })

  test('the volume is the engine’s own, for the same set logged in a workout', () => {
    const cfg = { id: BENCH, reps: 10, weight: 22.5, dbLoad: 'each' }
    const logged = { entries: [{ id: BENCH, target: { ...cfg }, sets: [{ w: 22.5, r: 10, done: true }] }] }
    expect(ex(kg, cfg).volume).toBe(workoutVolume(logged))
  })
})

describe('volumeSum', () => {
  test('spells out the sum the volume comes from', () => {
    expect(volumeSum(ex(kg, { id: BENCH, reps: 10, weight: 20, dbLoad: 'each' }))).toBe('20 × 10 × 2')
    expect(volumeSum(ex(kg, { id: SQUAT, reps: 5, weight: 100 }))).toBe('100 × 5')
    expect(volumeSum(ex(kg, { id: BENCH, reps: 12, weight: 20, side: true }))).toBe('20 × 6 + 20 × 6')
    expect(volumeSum(null)).toBe('')
  })
})
