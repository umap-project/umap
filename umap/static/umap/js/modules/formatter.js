import * as csv2geojson from 'csv2geojson'
import { Alert } from '../components/alerts/alert.js'
import { translate } from './i18n.js'

const parseTextGeom = async (geom) => {
  try {
    return JSON.parse(geom)
  } catch (e) {
    try {
      const betterknown = await import('betterknown')
      return betterknown.wktToGeoJSON(geom)
    } catch {
      return null
    }
  }
}

// Base class for problems in the data itself, whose message is meant to be shown
// to the user.
export class DataError extends Error {}

// Raised when the data has no data row at all. This is expected for remote data,
// for example a dynamic layer with nothing in the current view.
export class EmptyDataError extends DataError {}

// Raised when the data has rows, but none of them can be turned into a feature.
export class InvalidDataError extends DataError {}

const csvWithoutFeaturesError = (str, err) => {
  const nonBlankLines = str.split(/\r\n|\r|\n/).filter((line) => line.trim())
  if (!nonBlankLines.length) {
    return new EmptyDataError(translate('the CSV is empty'))
  }
  if (nonBlankLines.length === 1) {
    return new EmptyDataError(translate('the CSV only contains a header row'))
  }
  if (Array.isArray(err)) {
    // csv2geojson returns one error per row it could not convert.
    return new InvalidDataError(
      translate('the latitude or longitude is invalid in all {count} rows', {
        count: err.length,
      })
    )
  }
  return new InvalidDataError(err?.message || translate('the CSV has no data rows'))
}

export const EXPORT_FORMATS = {
  geojson: {
    ext: '.geojson',
    filetype: 'application/json',
  },
  gpx: {
    ext: '.gpx',
    filetype: 'application/gpx+xml',
  },
  kml: {
    ext: '.kml',
    filetype: 'application/vnd.google-earth.kml+xml',
  },
  csv: {
    ext: '.csv',
    filetype: 'text/csv',
  },
  wkt: {
    ext: '.csv',
    filetype: 'text/csv',
  },
}

/**
 * The result of converting data in one of the supported formats to GeoJSON.
 *
 * @typedef {Object} ParseResult
 * @property {Object} geojson - The converted data, as a GeoJSON FeatureCollection.
 * @property {Array<string>} warnings - Reasons, meant for the user, why parts of
 *   the data could not be converted while the rest could.
 */

export class Formatter {
  /**
   * @param {string} str - The GPX document.
   * @returns {Promise<ParseResult>}
   */
  async fromGPX(str) {
    const togeojson = await import('@tmcw/togeojson')
    const data = togeojson.gpx(this.toDom(str))
    for (const feature of data.features || []) {
      feature.properties.description = feature.properties.desc
      for (const key in feature.properties) {
        if (key.startsWith('_') || typeof feature.properties[key] === 'object') {
          delete feature.properties[key]
        }
      }
    }
    return { geojson: data, warnings: [] }
  }

  /**
   * @param {string} str - The KML document.
   * @returns {Promise<ParseResult>}
   */
  async fromKML(str) {
    const togeojson = await import('@tmcw/togeojson')
    const data = togeojson.kml(this.toDom(str), {
      skipNullGeometry: true,
    })
    return { geojson: data, warnings: [] }
  }

  /**
   * @param {string} str - The GeoJSON document.
   * @returns {Promise<ParseResult>}
   */
  async fromGeoJSON(str) {
    return { geojson: JSON.parse(str), warnings: [] }
  }

  /**
   * @param {string} str - The OSM XML or JSON document.
   * @returns {Promise<ParseResult>}
   */
  async fromOSM(str) {
    const osm2geojson = await import('osm2geojson-lite')
    const data = osm2geojson.default(str, { flatProperties: true })
    // FIXME: make a PR to osmtogeojson when it's more active
    // cf https://github.com/umap-project/umap/issues/3072
    for (const feature of data.features || []) {
      const [osm_type, osm_id] = feature.properties.id.split('/')
      feature.properties.osm_id = osm_id
      feature.properties.osm_type = osm_type
    }
    return { geojson: data, warnings: [] }
  }

  /**
   * @param {string} str - The CSV document.
   * @returns {Promise<ParseResult>} The features of the valid rows, with a warning
   *   when other rows have an invalid latitude or longitude.
   * @throws {DataError} When no row at all can be turned into a feature.
   */
  async fromCSV(str) {
    let { err, result } = await new Promise((resolve) => {
      csv2geojson.csv2geojson(
        str,
        {
          delimiter: 'auto',
          includeLatLon: false,
          sexagesimal: false,
          parseLatLon: (raw) => Number.parseFloat(raw.toString().replace(',', '.')),
        },
        (err, result) => resolve({ err, result })
      )
    })
    if (!result?.features.length) {
      throw csvWithoutFeaturesError(str, err)
    }
    const first = result.features[0]
    if (first.geometry === null) {
      const geomFields = ['geom', 'geometry', 'wkt', 'geojson']
      const availableFields = Object.keys(first.properties).reduce((acc, key) => {
        acc[key.toLowerCase()] = key
        return acc
      }, {})
      for (let field of geomFields) {
        field = availableFields[field]
        if (first.properties[field]) {
          for (const feature of result.features) {
            feature.geometry = await parseTextGeom(feature.properties[field])
            delete feature.properties[field]
          }
          break
        }
      }
      if (first.geometry === null) {
        // csv2geojson fallback to null geometries when it cannot determine
        // lat or lon columns. This is valid geojson, but unwanted from a user
        // point of view.
        throw new InvalidDataError(
          translate(
            'No geo column found: must be either `lat(itude)` and `lon(gitude)` or `geom(etry)`.'
          )
        )
      }
    }
    const warnings = []
    if (Array.isArray(err)) {
      // csv2geojson returns one error per row it could not convert, next to the
      // features of the valid rows.
      warnings.push(
        translate('the latitude or longitude is invalid in {count} row(s)', {
          count: err.length,
        })
      )
    }
    return { geojson: result, warnings }
  }

  /**
   * @param {string} str - The GeoRSS document.
   * @returns {Promise<ParseResult>}
   */
  async fromGeoRSS(str) {
    const GeoRSSToGeoJSON = await import('georsstogeojson')
    return { geojson: GeoRSSToGeoJSON.parse(this.toDom(str)), warnings: [] }
  }

  toDom(x) {
    const doc = new DOMParser().parseFromString(x, 'text/xml')
    const errorNode = doc.querySelector('parsererror')
    if (errorNode) {
      Alert.error(translate('Cannot parse data'))
    }
    return doc
  }

  /**
   * Converts data in one of the supported formats to GeoJSON.
   *
   * @param {string} str - The raw data.
   * @param {string} format - One of `csv`, `gpx`, `kml`, `osm`, `georss` or `geojson`.
   * @returns {Promise<ParseResult|undefined>} `undefined` for an unknown format.
   * @throws {DataError} When the data contains nothing that can be imported.
   */
  async parse(str, format) {
    switch (format) {
      case 'csv':
        return await this.fromCSV(str)
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

  async stringify(features, format) {
    switch (format) {
      case 'csv':
        return await this.toCSV(features)
      case 'wkt':
        return await this.toWKT(features)
      case 'gpx':
        return await this.toGPX(features)
      case 'kml':
        return await this.toKML(features)
      case 'geojson':
        return await this.toGeoJSON(features)
    }
  }

  async toGPX(features) {
    const togpx = await import('@dwayneparton/geojson-to-gpx')
    const collection = this.toFeatureCollection(features)
    for (const feature of collection.features) {
      feature.properties.desc = feature.properties.description
    }
    const gpx = togpx.default(collection)
    return new XMLSerializer().serializeToString(gpx)
  }

  async toKML(features) {
    const tokml = await import('@placemarkio/tokml')
    return tokml.toKML(this.toFeatureCollection(features))
  }

  toFeatureCollection(features) {
    return {
      type: 'FeatureCollection',
      features: features.map((f) => f.toGeoJSON()),
    }
  }

  async toGeoJSON(features) {
    return JSON.stringify(this.toFeatureCollection(features), null, 2)
  }

  async toCSV(features) {
    const table = []
    for (const feature of features) {
      const row = feature.toGeoJSON().properties
      const [lng, lat] = feature.center
      delete row._umap_options
      row.Latitude = lat
      row.Longitude = lng
      table.push(row)
    }
    return csv2geojson.dsv.csvFormat(table)
  }

  async toWKT(features) {
    const table = []
    const betterknown = await import('betterknown')
    for (const feature of features) {
      const row = feature.toGeoJSON().properties
      delete row._umap_options
      row.geometry = betterknown.geoJSONToWkt(feature.geometry)
      table.push(row)
    }
    return csv2geojson.dsv.csvFormat(table)
  }
}
