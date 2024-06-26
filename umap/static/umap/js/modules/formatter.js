/* Uses globals for: csv2geojson, osmtogeojson, GeoRSSToGeoJSON (not available as ESM) */
import { translate } from './i18n.js'

export default class Formatter {
  async fromGPX(str) {
    let togeojson
    await import('../../vendors/togeojson/togeojson.es.js').then((module) => {
      togeojson = module
    })
    return togeojson.gpx(this.toDom(str))
  }

  async fromKML(str) {
    console.log(str)
    let togeojson
    await import('../../vendors/togeojson/togeojson.es.js').then((module) => {
      togeojson = module
    })
    return togeojson.kml(this.toDom(str), {
      skipNullGeometry: true,
    })
  }

  async fromGeoJSON(str) {
    try {
      return JSON.parse(str)
    } catch (err) {
      U.Alert.error(`Invalid JSON file: ${err}`)
    }
  }

  async fromOSM(str) {
    let src
    try {
      src = JSON.parse(str)
    } catch (e) {
      src = this.toDom(str)
    }
    return osmtogeojson(src, { flatProperties: true })
  }

  fromCSV(str, callback) {
    csv2geojson.csv2geojson(
      str,
      {
        delimiter: 'auto',
        includeLatLon: false,
      },
      (err, result) => {
        // csv2geojson fallback to null geometries when it cannot determine
        // lat or lon columns. This is valid geojson, but unwanted from a user
        // point of view.
        if (result?.features.length) {
          if (result.features[0].geometry === null) {
            err = {
              type: 'Error',
              message: translate('Cannot determine latitude and longitude columns.'),
            }
          }
        }
        if (err) {
          let message
          if (err.type === 'Error') {
            message = err.message
          } else {
            message = translate('{count} errors during import: {message}', {
              count: err.length,
              message: err[0].message,
            })
          }
          U.Alert.error(message, 10000)
          console.error(err)
        }
        if (result?.features.length) {
          callback(result)
        }
      }
    )
  }

  async fromGeoRSS(str) {
    return GeoRSSToGeoJSON(this.toDom(c))
  }

  toDom(x) {
    const doc = new DOMParser().parseFromString(x, 'text/xml')
    const errorNode = doc.querySelector('parsererror')
    if (errorNode) {
      U.Alert.error(translate('Cannot parse data'))
    }
    return doc
  }

  async parse(str, format) {
    switch (format) {
      case 'csv':
        return new Promise((resolve, reject) => {
          return this.fromCSV(str, (data) => resolve(data))
        })
      case 'gpx':
        return await this.fromGPX(str)
      case 'kml':
        return await this.fromKML(str)
      case 'osm':
        return await this.fromOSM(str)
      case 'georss':
        return await this.fromGeoRSS(str)
      case 'geojson':
        return await this.fromGeoJSON(str)
    }
  }

  async toGPX(geojson) {
    let togpx
    await import('../../vendors/geojson-to-gpx/index.js').then((module) => {
      togpx = module
    })
    for (const feature of geojson.features) {
      feature.properties.desc = feature.properties.description
    }
    const gpx = togpx.default(geojson)
    return new XMLSerializer().serializeToString(gpx)
  }

  async toKML(geojson) {
    let tokml
    await import('../../vendors/tokml/tokml.es.js').then((module) => {
      tokml = module
    })
    return tokml.toKML(geojson)
  }
}
