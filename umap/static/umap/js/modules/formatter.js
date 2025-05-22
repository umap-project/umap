import { uMapAlert as Alert } from '../components/alerts/alert.js'
/* Uses globals for: csv2geojson, osmtogeojson (not available as ESM) */
import { translate } from './i18n.js'
import '../../vendors/gdal/gdal3.js'

export const EXPORT_FORMATS = {
  geojson: {
    formatter: async (umap) => JSON.stringify(umap.toGeoJSON(), null, 2),
    ext: '.geojson',
    filetype: 'application/json',
  },
  gpx: {
    formatter: async (umap) => await umap.formatter.toGPX(umap.toGeoJSON()),
    ext: '.gpx',
    filetype: 'application/gpx+xml',
  },
  kml: {
    formatter: async (umap) => await umap.formatter.toKML(umap.toGeoJSON()),
    ext: '.kml',
    filetype: 'application/vnd.google-earth.kml+xml',
  },
  csv: {
    formatter: async (umap) => {
      const table = []
      umap.eachFeature((feature) => {
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
  async initGdal() {
    if (!this.Gdal) {
      const startTime = performance.now()
      this.Gdal = await initGdalJs({
        path: '/static/umap/vendors/gdal/',
        useWorker: true,
      })
      const endTime = performance.now()
      console.log(`Loaded Gdal in ${endTime - startTime} milliseconds`)
    }
    return this.Gdal
  }

  async import(str, driver, filename, parameters = {}) {
    await this.initGdal()
    const { datasets, errors } = await this.Gdal.open(
      new File([str], filename),
      parameters.open
    )
    console.log(datasets)
    const info = await this.Gdal.getInfo(datasets[0])
    console.log(info)
    const imported = await this.Gdal.ogr2ogr(datasets[0], [
      '-if',
      driver,
      '-f',
      'JSONFG',
      '-t_srs',
      'EPSG:4326',
      '-skipfailures',
      ...(parameters.import || []),
    ])

    const startTime = performance.now()
    const data = JSON.parse(
      new TextDecoder().decode(await this.Gdal.getFileBytes(imported.local))
    )
    const endTime = performance.now()
    console.log(`Loaded data in ${endTime - startTime} milliseconds`)
    console.log(data)
    for (const feature of data.features || []) {
      feature.properties.description = feature.properties.desc
      for (const key in feature.properties) {
        if (key.startsWith('_') || typeof feature.properties[key] === 'object') {
          delete feature.properties[key]
        }
      }
    }
    this.Gdal.close(datasets[0])
    return data
  }

  async fromGPX(str) {
    return await this.import(str, 'GPX', 'file.gpx', {
      open: ['ELE_AS_25D=YES'],
      // Exclude track_points and route_points
      import: ['waypoints', 'routes', 'tracks'],
    })
  }

  async fromKML(str) {
    return await this.import(str, 'KML', 'file.kml')
  }

  async fromGeoJSON(str) {
    return JSON.parse(str)
  }

  async fromOSM(str) {
    return await this.import(str, 'OSM', 'file.osm')
  }

  async fromCSV(str, callback) {
    return await this.import(str, 'CSV', 'file.csv', {
      open: [
        'X_POSSIBLE_NAMES=lon*,lng,x',
        'Y_POSSIBLE_NAMES=lat*,y',
        'KEEP_GEOM_COLUMNS=NO',
      ],
      import: ['-s_srs', 'EPSG:4326'],
    })
  }

  async fromGeoRSS(str) {
    return await this.import(str, 'GeoRSS', 'file.rss')
  }

  toDom(x) {
    const doc = new DOMParser().parseFromString(x, 'text/xml')
    const errorNode = doc.querySelector('parsererror')
    if (errorNode) {
      Alert.error(translate('Cannot parse data'))
    }
    return doc
  }

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
