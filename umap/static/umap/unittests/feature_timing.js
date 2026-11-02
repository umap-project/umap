import pkg from 'chai'
import { describe, it } from 'mocha'
import {
  isTimeHidden,
  nextHideTime,
  parseTimingDate,
  resolveTiming,
  validateTiming,
} from '../js/modules/feature_timing.js'

const { assert } = pkg
const schedule = { enabled: true, hideOn: '2030-01-01', deleteOn: '2030-01-02' }

describe('Feature timing', () => {
  it('requires a valid destination for the optional move action', () => {
    assert.isTrue(validateTiming({ ...schedule, expiryAction: 'delete' }))
    assert.isTrue(
      validateTiming({
        ...schedule,
        expiryAction: 'move',
        archiveLayer: '12345678-1234-1234-1234-123456789abc',
      })
    )
    for (const value of [undefined, '', 'other-map', true, 123]) {
      assert.isFalse(
        validateTiming({ ...schedule, expiryAction: 'move', archiveLayer: value })
      )
    }
    assert.isFalse(validateTiming({ ...schedule, expiryAction: 'unknown' }))
  })
  it('resolves date fields and adds days or clamped calendar months', () => {
    const timing = {
      enabled: true,
      hideOn: '{Ende}',
      deleteAfter: 3,
      deleteUnit: 'months',
    }
    const result = resolveTiming(timing, { Ende: '15.11.2026' })
    assert.equal(result.hide, Date.parse('2026-11-15T00:00:00Z'))
    assert.equal(result.delete, Date.parse('2027-02-15T00:00:00Z'))
    for (const [start, amount, unit, end] of [
      ['2027-01-31', 1, 'months', '2027-02-28'],
      ['2028-01-31', 1, 'months', '2028-02-29'],
      ['2028-02-29', 12, 'months', '2029-02-28'],
      ['2026-12-29', 7, 'days', '2027-01-05'],
    ]) {
      assert.equal(
        resolveTiming(
          { ...timing, hideOn: start, deleteAfter: amount, deleteUnit: unit },
          {}
        ).delete,
        Date.parse(`${end}T00:00:00Z`)
      )
    }
    assert.deepEqual(resolveTiming(timing, {}), { hide: null, delete: null })
    assert.deepEqual(resolveTiming(timing, { Ende: '' }), { hide: null, delete: null })
    assert.isTrue(isTimeHidden(timing, false, result.hide, { Ende: '15.11.2026' }))
    assert.isFalse(isTimeHidden(timing, false, Number.POSITIVE_INFINITY, {}))
    const feature = { properties: { Ende: '15.11.2026', _umap_options: { timing } } }
    assert.equal(nextHideTime([feature], 0), result.hide)
    feature.properties.Ende = '16.11.2026'
    assert.equal(nextHideTime([feature], 0), result.hide + 86400000)
  })
  it('rejects invalid fields and unsafe or overflowing retention periods', () => {
    const timing = {
      enabled: true,
      hideOn: '{Ende}',
      deleteAfter: 3,
      deleteUnit: 'months',
    }
    for (const amount of [0, -1, true, 1.5, '3', 36501])
      assert.isFalse(validateTiming({ ...timing, deleteAfter: amount }, {}))
    for (const value of ['31.02.2026', '{Other}', '2026-1-2', 123])
      assert.isFalse(validateTiming(timing, { Ende: value }))
    for (const overrides of [
      { hideOn: 'prefix {Ende}' },
      { hideOn: '9999-12-31' },
      { hideOn: null },
      { deleteUnit: 'years' },
      { deleteOn: '2027-01-01' },
    ])
      assert.isFalse(validateTiming({ ...timing, ...overrides }, {}))
    for (const field of [
      'Bingo',
      'Ende der Baustelle',
      'Datum.Ende',
      '_Datum',
      '終了日',
    ]) {
      const result = resolveTiming(
        { ...timing, hideOn: `{${field}}` },
        { [field]: '15.11.2026' }
      )
      assert.equal(result.hide, Date.parse('2026-11-15T00:00:00Z'))
    }
  })
  it('uses the inclusive midnight UTC boundary and preserves editing access', () => {
    const midnight = Date.parse('2030-01-01T00:00:00Z')
    assert.isFalse(isTimeHidden(schedule, false, midnight - 1))
    assert.isTrue(isTimeHidden(schedule, false, midnight))
    assert.isFalse(isTimeHidden(schedule, true, midnight))
    assert.equal(parseTimingDate('2030-01-01'), midnight)
  })
  it('requires a valid deletion date and ordered dates', () => {
    for (const value of [
      '2030-02-30',
      '2030-13-01',
      '01/02/2030',
      '2030-01-01T00:00:00Z',
      '0000-01-01',
      true,
      0,
    ]) {
      assert.isNull(parseTimingDate(value))
      assert.isFalse(validateTiming({ enabled: true, deleteOn: value }))
    }
    assert.isFalse(validateTiming({ ...schedule, hideOn: '2031-01-01' }))
    assert.isFalse(validateTiming({ enabled: true }))
    assert.isTrue(validateTiming({ enabled: true, deleteOn: '2032-02-29' }))
  })
  it('preserves untimed and disabled features and optional hiding', () => {
    assert.isTrue(validateTiming(undefined))
    assert.isFalse(isTimeHidden(undefined, false, Number.POSITIVE_INFINITY))
    assert.isFalse(
      isTimeHidden({ ...schedule, enabled: false }, false, Number.POSITIVE_INFINITY)
    )
    const expiry = { enabled: true, deleteOn: '2030-01-02' }
    const boundary = Date.parse('2030-01-02T00:00:00Z')
    assert.isFalse(isTimeHidden(expiry, false, boundary - 1))
    assert.isTrue(isTimeHidden(expiry, false, boundary))
    assert.equal(
      nextHideTime([{ properties: { _umap_options: { timing: expiry } } }], 0),
      boundary
    )
  })
  it('recomputes the next visibility change after rescheduling', () => {
    const feature = { properties: { _umap_options: { timing: { ...schedule } } } }
    assert.equal(nextHideTime([feature], 0), Date.parse('2030-01-01T00:00:00Z'))
    feature.properties._umap_options.timing.hideOn = '2030-01-02'
    assert.equal(nextHideTime([feature], 0), Date.parse('2030-01-02T00:00:00Z'))
    feature.properties._umap_options.timing.enabled = false
    assert.equal(nextHideTime([feature], 0), Number.POSITIVE_INFINITY)
  })
})
