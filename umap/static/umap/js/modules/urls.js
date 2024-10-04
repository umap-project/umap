import { template } from './utils.js'

export default class URLs {
  constructor(serverUrls) {
    this.urls = serverUrls
  }

  has(urlName) {
    return urlName in this.urls
  }

  get(urlName, params) {
    if (typeof this[urlName] === 'function') return this[urlName](params)

    if (this.has(urlName)) {
      return template(this.urls[urlName], params)
    }
    throw `Unable to find a URL for route ${urlName}`
  }

  // Update if map_id is passed, create otherwise.
  map_save({ map_id, ...options }) {
    if (map_id) return this.get('map_update', { map_id, ...options })
    return this.get('map_create')
  }

  // Update the layer if pk is passed, create otherwise.
  datalayer_save({ map_id, pk }, ...options) {
    if (pk) return this.get('datalayer_update', { map_id, pk }, ...options)
    return this.get('datalayer_create', { map_id, pk }, ...options)
  }
}
