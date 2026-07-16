import pkg from 'chai'
import { describe, it } from 'mocha'
import * as Schema from '../js/modules/schema.js'

const { assert, expect } = pkg

describe('Schema', () => {
  describe('#hasField', () => {
    it('should return true if the field is in the schema', () => {
      assert.equal(Schema.hasField('foo', { foo: {} }), true)
    })
    it('should return false if the field is not in the schema', () => {
      assert.equal(Schema.hasField('foo', { bar: {} }), false)
    })
    it('should return false if the schema is not provided', () => {
      assert.equal(Schema.hasField('foo', {}), false)
    })
    it('should return false if the field is undefined', () => {
      assert.equal(Schema.hasField(undefined, {}), false)
    })
    // check that options. is removed
    it('should remove options. from the field', () => {
      assert.equal(Schema.hasField('options.foo', { foo: {} }), true)
    })

    // check that subfields are removed
    it('should remove subfields from the field', () => {
      assert.equal(Schema.hasField('options.foo.bar', { foo: { bar: {} } }), true)
    })
  })

  describe('#getImpacts()', () => {
    const getImpacts = Schema.getImpacts
    it('should return an array', () => {
      expect(getImpacts(['foo'], {})).to.be.an('array')
      expect(getImpacts(['foo'], { foo: {} })).to.be.an('array')
      expect(getImpacts(['foo'], { foo: { impacts: [] } })).to.be.an('array')
      expect(getImpacts(['foo'], { foo: { impacts: ['A'] } })).to.be.an('array')
    })

    it('should return a list of unique impacted values', () => {
      const schema = {
        foo: { impacts: ['A'] },
        bar: { impacts: ['A', 'B'] },
        baz: { impacts: ['B', 'C'] },
      }

      assert.deepEqual(getImpacts(['foo'], schema), ['A'])
      assert.deepEqual(getImpacts(['foo', 'bar'], schema), ['A', 'B'])
      assert.deepEqual(getImpacts(['foo', 'bar', 'baz'], schema), ['A', 'B', 'C'])
    })
    it('should return an empty list if nothing is found', () => {
      const schema = {
        foo: { impacts: ['A'] },
        bar: { impacts: ['A', 'B'] },
        baz: { impacts: ['B', 'C'] },
      }

      assert.deepEqual(getImpacts(['bad'], schema), [])
    })

    it('should return an empty list if the schema key does not exist', () => {
      const schema = {
        foo: { impacts: ['A'] },
      }

      assert.deepEqual(getImpacts(['bad'], schema), [])
    })
    it('should work if the "impacts" key is not defined', () => {
      const schema = {
        foo: {},
        bar: { impacts: ['A'] },
        baz: { impacts: ['B'] },
      }

      assert.deepEqual(getImpacts(['foo', 'bar', 'baz'], schema), ['A', 'B'])
    })
  })

  describe('#isValidValue()', () => {
    it('should consider false', () => {
      assert.ok(Schema.isValidValue(false, 'key'))
    })

    it('should consider 0', () => {
      assert.ok(Schema.isValidValue(0, 'key'))
    })

    it('should not consider undefined', () => {
      assert.notOk(Schema.isValidValue(undefined, 'key'))
    })

    it('should not consider empty string', () => {
      assert.notOk(Schema.isValidValue('', 'key'))
    })

    it('should consider null', () => {
      assert.ok(Schema.isValidValue(null, 'key'))
    })

    it('should respect schema type if given', () => {
      assert.ok(Schema.isValidValue(false, 'key', { key: { type: Boolean } }))
      assert.notOk(Schema.isValidValue(null, 'key', { key: { type: Boolean } }))
    })

    it('should respect schema choices if given', () => {
      assert.ok(
        Schema.isValidValue(null, 'key', {
          key: {
            type: Boolean,
            choices: [
              [null, 'foo'],
              [true, 'bar'],
              [false, 'baz'],
            ],
          },
        })
      )
      assert.notOk(
        Schema.isValidValue('null', 'key', {
          key: {
            type: Boolean,
            choices: [
              [null, 'foo'],
              [true, 'bar'],
              [false, 'baz'],
            ],
          },
        })
      )
    })

    it('should respect schema nullable if given', () => {
      assert.ok(
        Schema.isValidValue(null, 'key', {
          key: {
            type: Boolean,
            nullable: true,
          },
        })
      )
      assert.notOk(
        Schema.isValidValue(null, 'key', {
          key: {
            type: Boolean,
            nullable: false,
          },
        })
      )
    })
  })
})
