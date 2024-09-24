/* Uses globals for: csv2geojson, osmtogeojson (not available as ESM) */
import { translate } from './i18n.js'

export const EXPORT_FORMATS = {
  geojson: {
    formatter: async (map) => JSON.stringify(map.toGeoJSON(), null, 2),
    ext: '.geojson',
    filetype: 'application/json',
  },
  gpx: {
    formatter: async (map) => await map.formatter.toGPX(map.toGeoJSON()),
    ext: '.gpx',
    filetype: 'application/gpx+xml',
  },
  kml: {
    formatter: async (map) => await map.formatter.toKML(map.toGeoJSON()),
    ext: '.kml',
    filetype: 'application/vnd.google-earth.kml+xml',
  },
  csv: {
    formatter: async (map) => {
      const table = []
      map.eachFeature((feature) => {
        const row = feature.toGeoJSON().properties
        const center = feature.center
        delete row._umap_options
        row.Latitude = center.lat
        row.Longitude = center.lng
        table.push(row)
      })
      return csv2geojson.dsv.csvFormat(table)
    },
    ext: '.csv',
    filetype: 'text/csv',
  },
}

export class Formatter {
  async fromGPX(str) {
    const togeojson = await import('../../vendors/togeojson/togeojson.es.js')
    const data = togeojson.gpx(this.toDom(str))
    for (const feature of data.features || []) {
      feature.properties.description = feature.properties.desc
      for (const key in feature.properties) {
        if (key.startsWith('_') || typeof feature.properties[key] === 'object') {
          delete feature.properties[key]
        }
      }
    }
    return data
  }

  async fromKML(str) {
    const togeojson = await import('../../vendors/togeojson/togeojson.es.js')
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
    const GeoRSSToGeoJSON = await import('../../vendors/georsstogeojson/GeoRSSToGeoJSON.js')
    return GeoRSSToGeoJSON.parse(this.toDom(str))
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
    const togpx = await import('../../vendors/geojson-to-gpx/index.js')
    for (const feature of geojson.features) {
      feature.properties.desc = feature.properties.description
    }
    const gpx = togpx.default(geojson)
    return new XMLSerializer().serializeToString(gpx)
  }

  async toKML(geojson) {
    const tokml = await import('../../vendors/tokml/tokml.es.js')
    return tokml.toKML(geojson)
  }
}
