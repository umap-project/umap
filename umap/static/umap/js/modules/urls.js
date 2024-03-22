// Vendorized from leaflet.utils
// https://github.com/Leaflet/Leaflet/blob/108c6717b70f57c63645498f9bd66b6677758786/src/core/Util.js#L132-L151
var templateRe = /\{ *([\w_ -]+) *\}/g

function template(str, data) {
  return str.replace(templateRe, function (str, key) {
    var value = data[key]

    if (value === undefined) {
      throw new Error('No value provided for variable ' + str)
    } else if (typeof value === 'function') {
      value = value(data)
    }
    return value
  })
}

export default class URLs {
  constructor(serverUrls) {
    this.urls = serverUrls
  }

  get(urlName, params) {
    if (typeof this[urlName] === 'function') return this[urlName](params)

    if (this.urls.hasOwnProperty(urlName)) {
      return template(this.urls[urlName], params)
    } else {
      throw `Unable to find a URL for route ${urlName}`
    }
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
