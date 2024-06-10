import { describe, it } from 'mocha'
import sinon from 'sinon'

import pkg from 'chai'
const { expect } = pkg

import { MapUpdater } from '../js/modules/sync/updaters.js'
import { SyncEngine } from '../js/modules/sync/engine.js'

describe('SyncEngine', () => {
  it('should initialize methods even before start', function () {
    const engine = new SyncEngine({})
    engine.upsert()
    engine.update()
    engine.delete()
  })
})

describe('#dispatch', function () {
  it('should raise an error on unknown updater', function () {
    const dispatcher = new SyncEngine({})
    expect(() => {
      dispatcher.dispatch({
        kind: 'operation',
        subject: 'unknown',
        metadata: {},
      })
    }).to.throw(Error)
  })
  it('should produce an error on malformated messages', function () {
    const dispatcher = new SyncEngine({})
    expect(() => {
      dispatcher.dispatch({
        yeah: 'yeah',
        payload: { foo: 'bar' },
      })
    }).to.throw(Error)
  })
  it('should raise an unknown operations', function () {
    const dispatcher = new SyncEngine({})
    expect(() => {
      dispatcher.dispatch({
        kind: 'something-else',
      })
    }).to.throw(Error)
  })
})

describe('Updaters', () => {
  describe('BaseUpdater', function () {
    let updater
    let map
    let obj

    this.beforeEach(function () {
      map = {}
      updater = new MapUpdater(map)
      obj = {}
    })
    it('should be able to set object properties', function () {
      let obj = {}
      updater.updateObjectValue(obj, 'foo', 'foo')
      expect(obj).deep.equal({ foo: 'foo' })
    })

    it('should be able to set object properties recursively on existing objects', function () {
      let obj = { foo: {} }
      updater.updateObjectValue(obj, 'foo.bar', 'foo')
      expect(obj).deep.equal({ foo: { bar: 'foo' } })
    })

    it('should be able to set object properties recursively on deep objects', function () {
      let obj = { foo: { bar: { baz: {} } } }
      updater.updateObjectValue(obj, 'foo.bar.baz.test', 'value')
      expect(obj).deep.equal({ foo: { bar: { baz: { test: 'value' } } } })
    })

    it('should be able to replace object properties recursively on deep objects', function () {
      let obj = { foo: { bar: { baz: { test: 'test' } } } }
      updater.updateObjectValue(obj, 'foo.bar.baz.test', 'value')
      expect(obj).deep.equal({ foo: { bar: { baz: { test: 'value' } } } })
    })

    it('should not set object properties recursively on non-existing objects', function () {
      let obj = { foo: {} }
      updater.updateObjectValue(obj, 'bar.bar', 'value')

      expect(obj).deep.equal({ foo: {} })
    })

    it('should delete keys for undefined values', function () {
      let obj = { foo: 'foo' }
      updater.updateObjectValue(obj, 'foo', undefined)

      expect(obj).deep.equal({})
    })

    it('should delete keys for undefined values, recursively', function () {
      let obj = { foo: { bar: 'bar' } }
      updater.updateObjectValue(obj, 'foo.bar', undefined)

      expect(obj).deep.equal({ foo: {} })
    })
  })
})
