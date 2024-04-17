import { describe, it } from 'mocha'

import pkg from 'chai'
const { expect } = pkg

import URLs from '../js/modules/urls.js'

describe('URLs', () => {
  // Mock server URLs that will be used for testing
  const mockServerUrls = {
    map_create: '/maps/create',
    map_update: '/maps/{map_id}/update',
    datalayer_create: '/maps/{map_id}/datalayers/create',
    datalayer_update: '/maps/{map_id}/datalayers/{pk}/update',
  }

  let urls = new URLs(mockServerUrls)

  describe('get()', () => {
    it('should throw an error if the urlName does not exist', () => {
      expect(() => urls.get('non_existent')).to.throw()
    })

    it('should return the correct templated URL for known urlNames', () => {
      expect(urls.get('map_create')).to.be.equal('/maps/create')
      expect(urls.get('map_update', { map_id: '123' })).to.be.equal('/maps/123/update')
    })

    it('should return the correct templated URL when provided with parameters', () => {
      expect(urls.get('datalayer_update', { map_id: '123', pk: '456' })).to.be.equal(
        '/maps/123/datalayers/456/update'
      )
    })
  })

  describe('map_save()', () => {
    it('should return the create URL if no map_id is provided', () => {
      expect(urls.map_save({})).to.be.equal('/maps/create')
    })

    it('should return the update URL if a map_id is provided', () => {
      expect(urls.map_save({ map_id: '123' })).to.be.equal('/maps/123/update')
    })
  })

  describe('datalayer_save()', () => {
    it('should return the create URL if no pk is provided', () => {
      expect(urls.datalayer_save({ map_id: '123' })).to.be.equal(
        '/maps/123/datalayers/create'
      )
    })

    it('should return the update URL if a pk is provided', () => {
      expect(urls.datalayer_save({ map_id: '123', pk: '456' })).to.be.equal(
        '/maps/123/datalayers/456/update'
      )
    })
  })
})
