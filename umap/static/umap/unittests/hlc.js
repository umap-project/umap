import { describe, it } from 'mocha'
import sinon from 'sinon'

import pkg from 'chai'
const { expect } = pkg

import { HybridLogicalClock } from '../js/modules/sync/hlc.js'

describe('HybridLogicalClock', () => {
  let clock

  describe('#parse', () => {
    it('should reject invalid values', () => {
      clock = new HybridLogicalClock()
      expect(() => clock.parse('invalid')).to.throw()
      expect(() => clock.parse('123:456')).to.throw()
      expect(() => clock.parse('123:456:789:000')).to.throw()
    })

    it('should parse correct values', () => {
      clock = new HybridLogicalClock()
      const result = clock.parse('1625097600000:42:abc-123')
      expect(result).to.deep.equal({
        walltime: '1625097600000',
        nn: 42,
        id: 'abc-123',
      })
    })

    it('should default to 0 for nn if none is provided', () => {
      clock = new HybridLogicalClock()
      const result = clock.parse('1625097600000::abc-123')
      expect(result).to.deep.equal({
        walltime: '1625097600000',
        nn: 0,
        id: 'abc-123',
      })
    })
  })

  describe('#serialize', () => {
    it('should correctly serialize the clock', () => {
      clock = new HybridLogicalClock(1625097600000, 42, 'abc-123')
      expect(clock.serialize()).to.equal('1625097600000:42:abc-123')
    })
  })

  describe('#tick', () => {
    it('should increment walltime when current time is greater', () => {
      const now = Date.now()
      clock = new HybridLogicalClock(now - 1000, 0, 'test')
      const result = clock.tick()
      const parsed = clock.parse(result)
      expect(parsed.walltime).to.be.at.least(now.toString())
      expect(parsed.nn).to.equal(0)
    })

    it('should increment nn when current time is not greater', () => {
      const now = Date.now()
      clock = new HybridLogicalClock(now, 5, 'test')
      sinon.useFakeTimers(now)
      const result = clock.tick()
      const parsed = clock.parse(result)
      expect(parsed.walltime).to.equal(now.toString())
      expect(parsed.nn).to.equal(6)
      sinon.restore()
    })
  })

  describe('#receive', () => {
    it("should use current time when it's greater than both local and remote", () => {
      const now = Date.now()
      clock = new HybridLogicalClock(now - 1000, 0, 'local')
      const result = clock.receive(`${now - 500}:0:remote`)
      expect(result.walltime).to.be.at.least(now)
      expect(result.nn).to.equal(0)
      expect(result.id).to.equal('local')
    })

    it('should increment nn when local and remote times are equal', () => {
      const now = Date.now()
      clock = new HybridLogicalClock(now, 5, 'local')
      const result = clock.receive(`${now}:7:remote`)
      expect(result.walltime).to.equal(now)
      expect(result.nn).to.equal(8)
      expect(result.id).to.equal('local')
    })

    it('should use remote time and increment nn when remote time is greater', () => {
      const now = Date.now()
      clock = new HybridLogicalClock(now - 1000, 5, 'local')
      const result = clock.receive(`${now}:7:remote`)
      expect(result.walltime).to.be.least(now.toString())
      expect(result.nn).to.equal(8)
      expect(result.id).to.equal('local')
    })

    it('should increment local nn when local time is greater', () => {
      const now = Date.now()
      clock = new HybridLogicalClock(now, 5, 'local')
      const result = clock.receive(`${now - 1000}:7:remote`)
      expect(result.walltime).to.be.least(now)
      expect(result.nn).to.equal(6)
      expect(result.id).to.equal('local')
    })
  })

  it('should maintain causal order across multiple operations', () => {
    const hlc = new HybridLogicalClock()

    // Simulate a sequence of events
    const event1 = hlc.tick()

    // Simulate some time passing
    const clock = sinon.useFakeTimers(Date.now() + 100)

    const event2 = hlc.tick()

    // Simulate receiving a message from another node
    const remoteEvent = hlc.receive(`${Date.now() - 50}:5:remote-id`)

    const event3 = hlc.tick()

    // Advance time significantly
    clock.tick(1000)

    const event4 = hlc.tick()

    // Clean up the fake timer
    clock.restore()

    // Parse all events
    const parsedEvent1 = hlc.parse(event1)
    const parsedEvent2 = hlc.parse(event2)
    const parsedEvent3 = hlc.parse(event3)
    const parsedEvent4 = hlc.parse(event4)

    // Assertions to ensure causal order is maintained
    expect(parsedEvent2.walltime).to.be.greaterThan(parsedEvent1.walltime)
    expect(parsedEvent3.walltime).to.equal(parsedEvent2.walltime)
    expect(parsedEvent3.nn).to.be.greaterThan(parsedEvent2.nn)
    expect(parsedEvent4.walltime).to.be.greaterThan(parsedEvent3.walltime)

    // Check that all events have the same id
    const uniqueIds = new Set([
      parsedEvent1.id,
      parsedEvent2.id,
      parsedEvent3.id,
      parsedEvent4.id,
    ])
    expect(uniqueIds.size).to.equal(1)

    // Ensure we can compare events as strings and maintain the same order
    const events = [event1, event2, event3, event4]
    const sortedEvents = [...events].sort()
    expect(sortedEvents).to.deep.equal(events)
  })
})
