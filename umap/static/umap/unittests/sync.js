import { describe, it } from 'mocha'
import sinon from 'sinon'

import pkg from 'chai'
const { expect } = pkg

import { MapUpdater } from '../js/modules/sync/updaters.js'
import { SyncEngine, Operations } from '../js/modules/sync/engine.js'

describe('SyncEngine', () => {
  it('should initialize methods even before start', () => {
    const engine = new SyncEngine({})
    engine.upsert()
    engine.update()
    engine.delete()
  })
})

describe('#dispatch', () => {
  it('should raise an error on unknown updater', () => {
    const dispatcher = new SyncEngine({})
    expect(() => {
      dispatcher.dispatch({
        kind: 'operation',
        subject: 'unknown',
        metadata: {},
      })
    }).to.throw(Error)
  })
  it('should produce an error on malformated messages', () => {
    const dispatcher = new SyncEngine({})
    expect(() => {
      dispatcher.dispatch({
        yeah: 'yeah',
        payload: { foo: 'bar' },
      })
    }).to.throw(Error)
  })
  it('should raise an unknown operations', () => {
    const dispatcher = new SyncEngine({})
    expect(() => {
      dispatcher.dispatch({
        kind: 'something-else',
      })
    }).to.throw(Error)
  })
})

describe('Updaters', () => {
  describe('BaseUpdater', () => {
    let updater
    let map
    let obj

    beforeEach(() => {
      map = {}
      updater = new MapUpdater(map)
      obj = {}
    })
    it('should be able to set object properties', () => {
      let obj = {}
      updater.updateObjectValue(obj, 'foo', 'foo')
      expect(obj).deep.equal({ foo: 'foo' })
    })

    it('should be able to set object properties recursively on existing objects', () => {
      let obj = { foo: {} }
      updater.updateObjectValue(obj, 'foo.bar', 'foo')
      expect(obj).deep.equal({ foo: { bar: 'foo' } })
    })

    it('should be able to set object properties recursively on deep objects', () => {
      let obj = { foo: { bar: { baz: {} } } }
      updater.updateObjectValue(obj, 'foo.bar.baz.test', 'value')
      expect(obj).deep.equal({ foo: { bar: { baz: { test: 'value' } } } })
    })

    it('should be able to replace object properties recursively on deep objects', () => {
      let obj = { foo: { bar: { baz: { test: 'test' } } } }
      updater.updateObjectValue(obj, 'foo.bar.baz.test', 'value')
      expect(obj).deep.equal({ foo: { bar: { baz: { test: 'value' } } } })
    })

    it('should not set object properties recursively on non-existing objects', () => {
      let obj = { foo: {} }
      updater.updateObjectValue(obj, 'bar.bar', 'value')

      expect(obj).deep.equal({ foo: {} })
    })

    it('should delete keys for undefined values', () => {
      let obj = { foo: 'foo' }
      updater.updateObjectValue(obj, 'foo', undefined)

      expect(obj).deep.equal({})
    })

    it('should delete keys for undefined values, recursively', () => {
      let obj = { foo: { bar: 'bar' } }
      updater.updateObjectValue(obj, 'foo.bar', undefined)

      expect(obj).deep.equal({ foo: {} })
    })
  })
})

describe('Operations', () => {
  describe('haveSameContext', () => {
    const createOperation = (overrides = {}) => ({
      subject: 'feature',
      metadata: {
        id: 'UxNjQ',
        layerId: '606d26bd-230f-4d3e-a2a7-0c3caed71548',
        featureType: 'marker',
      },
      ...overrides,
    })

    it('should check if subject and metadata are the same', () => {
      const op1 = createOperation()
      const op2 = createOperation()
      const op3 = createOperation({
        subject: 'datalayer',
        metadata: { id: '606d26bd-230f-4d3e-a2a7-0c3caed71548' },
      })

      expect(Operations.haveSameContext(op1, op2)).to.be.true
      expect(Operations.haveSameContext(op1, op3)).to.be.false
      expect(Operations.haveSameContext(op2, op3)).to.be.false
    })

    it('should check if the key matches if there is any provided', () => {
      const op1 = createOperation({ key: 'properties.name' })
      const op2 = createOperation({ key: 'properties.name' })
      const op3 = createOperation({ key: 'geometry' })
      const op4 = createOperation()

      expect(Operations.haveSameContext(op1, op2)).to.be.true
      expect(Operations.haveSameContext(op1, op3)).to.be.false
      expect(Operations.haveSameContext(op1, op4)).to.be.true
      expect(Operations.haveSameContext(op4, createOperation())).to.be.true
    })

    it('should use deep equality for subject and metadata', () => {
      const op1 = createOperation({ metadata: { nested: { value: 1 } } })
      const op2 = createOperation({ metadata: { nested: { value: 1 } } })
      const op3 = createOperation({ metadata: { nested: { value: 2 } } })

      expect(Operations.haveSameContext(op1, op2)).to.be.true
      expect(Operations.haveSameContext(op1, op3)).to.be.false
    })
  })

  describe('sort', () => {
    it('should sort operations by timestamp', () => {
      const operations = [
        { hlc: '1727193550:44:id1' },
        { hlc: '1727193549:42:id1' },
        { hlc: '1727193551:43:id1' },
      ]
      const sorted = Operations.sort(operations)
      expect(sorted).to.deep.equal([
        { hlc: '1727193549:42:id1' },
        { hlc: '1727193550:44:id1' },
        { hlc: '1727193551:43:id1' },
      ])
    })

    it('should sort operations by NN when timestamp is the same', () => {
      const operations = [
        { hlc: '1727193549:42:id1' },
        { hlc: '1727193549:44:id1' },
        { hlc: '1727193549:43:id1' },
      ]
      const sorted = Operations.sort(operations)
      expect(sorted).to.deep.equal([
        { hlc: '1727193549:42:id1' },
        { hlc: '1727193549:43:id1' },
        { hlc: '1727193549:44:id1' },
      ])
    })

    it('should sort operations by id if other fields are equal', () => {
      const operations = [
        { hlc: '1727193549:42:id3' },
        { hlc: '1727193549:42:id2' },
        { hlc: '1727193549:42:id1' },
      ]
      const sorted = Operations.sort(operations)
      expect(sorted).to.deep.equal([
        { hlc: '1727193549:42:id1' },
        { hlc: '1727193549:42:id2' },
        { hlc: '1727193549:42:id3' },
      ])
    })
  })

  describe('addLocal', () => {
    it('should add a local operation with a new hlc', () => {
      const ops = new Operations()
      const inputMessage = { verb: 'update', subject: 'test' }
      const result = ops.addLocal(inputMessage)
      expect(result).to.have.property('hlc')
      expect(result.hlc).to.match(/^\d+:\d+:[^:]+$/)
      expect(result).to.include(inputMessage)
    })
  })

  describe('sorted', () => {
    it('should return sorted operations', () => {
      const ops = new Operations()
      ops._operations = [{ hlc: '1727193549:43:id1' }, { hlc: '1727193549:42:id1' }]
      const sorted = ops.sorted()
      expect(sorted[0].hlc).to.equal('1727193549:42:id1')
      expect(sorted[1].hlc).to.equal('1727193549:43:id1')
    })
  })

  describe('shouldBypassOperation', () => {
    let ops

    beforeEach(() => {
      ops = new Operations()
    })

    const createOperation = (overrides = {}) => ({
      verb: 'update',
      subject: 'feature',
      metadata: {
        id: 'UxNjQ',
        layerId: '606d26bd-230f-4d3e-a2a7-0c3caed71548',
        featureType: 'marker',
      },
      key: 'properties.name',
      value: 'default',
      hlc: '0000000000000:0:f4df51cc-7617-4bd4-8bd2-599cdf17da65',
      ...overrides,
    })

    const createUpsertOperation = (overrides = {}) =>
      createOperation({
        verb: 'upsert',
        key: undefined,
        value: {
          type: 'Feature',
          geometry: {
            coordinates: [0.439453, 48.04871],
            type: 'Point',
          },
          properties: {},
          id: 'UxNjQ',
        },
        ...overrides,
      })

    it('should return false if no local operation is newer', () => {
      const remote = createUpsertOperation({ hlc: '1727184449050:44:id2' })
      ops._operations = [
        createOperation({
          hlc: '1727184449010:0:f4df51cc-7617-4bd4-8bd2-599cdf17da65',
        }),
        createUpsertOperation({
          hlc: '1727184449020:0:b4a221a0-7b62-4588-a6af-041b041006dc',
        }),
      ]

      const result = ops.shouldBypassOperation(remote)
      expect(result).to.be.false
    })

    it('should return true if a similar "delete" operation is newer', () => {
      const remote = createOperation({
        verb: 'delete',
        metadata: { id: 'M1NTA', layerId: '1234', featureType: 'marker' },
        hlc: '1:0:3f45b56f-f750-4b50-90d7-9ecce4b0cf53',
      })

      ops._operations = [
        createOperation({
          verb: 'delete',
          metadata: { id: 'M1NTA', layerId: '1234', featureType: 'marker' },
          hlc: '2:0:3f45b56f-f750-4b50-90d7-9ecce4b0cf53',
        }),
      ]

      const result = ops.shouldBypassOperation(remote)
      expect(result).to.be.true
    })

    describe('update', () => {
      it('should check for related updates', () => {
        ops._operations = [
          createOperation({
            value: 'y',
            hlc: '1:0:f4df51cc-7617-4bd4-8bd2-599cdf17da65',
          }),
          createOperation({
            value: 'youpi',
            hlc: '9:0:f4df51cc-7617-4bd4-8bd2-599cdf17da65',
          }),
        ]

        const remoteOperation = createOperation({
          value: 'something else',
          hlc: '0:0:f4df51cc-7617-4bd4-8bd2-599cdf17da65',
        })

        const result = ops.shouldBypassOperation(remoteOperation)
        expect(result).to.be.true
      })

      it('should check for related deletes', () => {
        ops._operations = [
          {
            verb: 'delete',
            subject: 'feature',
            metadata: {
              id: 'M1NTA',
              layerId: '123',
              featureType: 'marker',
            },
            hlc: '1727196583562:0:3f45b56f-f750-4b50-90d7-9ecce4b0cf53',
            key: undefined,
          },
        ]

        const remoteOperation = createOperation({
          metadata: { id: 'M1NTA', layerId: '123', featureType: 'marker' },
          key: 'geometry',
          value: { coordinates: [2.944336, 47.070122], type: 'Point' },
          hlc: '0:0:3f45b56f-f750-4b50-90d7-9ecce4b0cf53',
        })

        const result = ops.shouldBypassOperation(remoteOperation)
        expect(result).to.be.true
      })
    })

    describe('upsert', () => {
      it('should take precedence over updates (even if fresher)', () => {
        ops._operations = [
          createOperation({
            value: 'youpi',
            hlc: '1000000000000:0:f4df51cc-7617-4bd4-8bd2-599cdf17da65',
          }),
        ]

        const remoteOperation = createUpsertOperation({
          hlc: '0000000000000:0:b4a221a0-7b62-4588-a6af-041b041006dc',
        })

        const result = ops.shouldBypassOperation(remoteOperation)
        expect(result).to.be.false
      })
    })

    describe('delete', () => {
      it('should check for the same delete', () => {
        ops._operations = [
          createOperation({
            verb: 'delete',
            metadata: { id: 'I3MDg', layerId: null, featureType: 'polygon' },
            key: undefined,
            hlc: '1:0:3f45b56f-f750-4b50-90d7-9ecce4b0cf53',
          }),
        ]

        const remoteOperation = createOperation({
          verb: 'delete',
          metadata: { id: 'I3MDg', layerId: null, featureType: 'polygon' },
          key: undefined,
          hlc: '0:0:3f45b56f-f750-4b50-90d7-9ecce4b0cf53',
        })

        const result = ops.shouldBypassOperation(remoteOperation)
        expect(result).to.be.true
      })
    })
  })
  describe('storeRemoteOperations', () => {
    it('should store remote operations and update the local HLC', () => {
      const ops = new Operations()
      const remoteOps = [{ hlc: '1727193549:42:id2' }, { hlc: '1727193549:43:id2' }]
      ops.storeRemoteOperations(remoteOps)
      expect(ops._operations).to.deep.equal(remoteOps)
    })
  })

  describe('getOperationsSince', () => {
    it('should return operations since a given HLC', () => {
      const ops = new Operations()
      ops._operations = [
        { hlc: '1727193549:42:id1' },
        { hlc: '1727193549:43:id1' },
        { hlc: '1727193549:44:id1' },
      ]
      const result = ops.getOperationsSince('1727193549:42:id1')
      expect(result).to.deep.equal([
        { hlc: '1727193549:43:id1' },
        { hlc: '1727193549:44:id1' },
      ])
    })

    it('should return all operations if no HLC is provided', () => {
      const ops = new Operations()
      ops._operations = [{ hlc: '1727193549:42:id1' }, { hlc: '1727193549:43:id1' }]
      const result = ops.getOperationsSince()
      expect(result).to.deep.equal(ops._operations)
    })
  })
})
