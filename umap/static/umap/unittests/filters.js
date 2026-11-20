import pkg from 'chai'
import { describe, it } from 'mocha'
import { Filters } from '../js/modules/filters.js'

const { assert } = pkg

const makeFilters = (definition) => {
  const parent = {
    properties: { filters: [definition] },
    fields: new Map([['date', { parse: (value) => new Date(value) }]]),
  }
  return new Filters(parent, {})
}

describe('Default filter values', () => {
  it('filters immediately without building a form', () => {
    const filters = makeFilters({
      fieldKey: 'date',
      widget: 'MinMax',
      defaultValue: { min: '2026-11-15T00:00:00Z' },
    })
    assert.isTrue(filters.matchFeature({ properties: { date: '2026-11-14' } }))
    assert.isFalse(filters.matchFeature({ properties: { date: '2026-11-15' } }))
  })

  it('preserves visitor choices when the same configuration is reloaded', () => {
    const filters = makeFilters({
      fieldKey: 'date',
      widget: 'Checkbox',
      defaultValue: { selected: ['old'] },
    })
    filters.userData.date.selected = ['visitor']
    filters.load()
    assert.deepEqual(filters.userData.date.selected, ['visitor'])
    assert.deepEqual(filters.get('date').dumps().defaultValue, { selected: ['old'] })
  })

  it('applies a changed default and removes deleted filters', () => {
    const filters = makeFilters({
      fieldKey: 'date',
      widget: 'Switch',
      defaultValue: { wanted: false },
    })
    filters._parent.properties.filters[0].defaultValue = { wanted: true }
    filters.load()
    assert.deepEqual(filters.userData.date, { wanted: true })
    filters._parent.properties.filters = []
    filters.load()
    assert.isFalse(filters.isActive())
    assert.deepEqual(filters.userData, {})
  })
})
