import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'
import { Form } from '../form/builder.js'

export const PROFILES = [
  ['foot-walking', translate('Walking')],
  ['driving-car', translate('By car')],
  ['cycling-regular', translate('Cycling')],
  ['wheelchair', translate('Wheelchair')],
]

export const PREFERENCES = [
  ['recommended', translate('Recommended')],
  ['fastest', translate('Fastest')],
  ['shortest', translate('Shortest')],
]

export class Importer {
  constructor(umap) {
    this.umap = umap
    this.id = 'openrouteservice'
  }

  async loadORS() {
    const mod = await import('../../../vendors/openrouteservice/ors-js-client.js')
    return mod.default
  }

  async isochrone(latlng) {
    const ORS = await this.loadORS()
    const properties = {
      range: 10,
      lines: 1,
      profile: 'foot-walking',
    }

    const metadatas = [
      ['datalayer', { handler: 'DataLayerSwitcher', allowEmpty: true }],
      [
        'profile',
        { handler: 'Select', selectOptions: PROFILES, label: translate('Profile') },
      ],
      [
        'range',
        {
          handler: 'Range',
          min: 5,
          max: 60,
          step: 1,
          ticks: 11,
          label: translate('Max time (in minutes)'),
        },
      ],
      [
        'lines',
        {
          handler: 'Range',
          min: 1,
          max: 5,
          step: 1,
          label: translate('Number of lines'),
        },
      ],
    ]
    const form = new Form(properties, metadatas, { umap: this.umap })
    // Needed for DataLayerSwitcher (which expects to be used with MutatingForm)
    form._umap = this.umap

    const Isochrones = new ORS.Isochrones({
      api_key: this.umap.properties.ORSAPIKey,
    })
    this.umap.dialog.open({ template: form.build() }).then(async () => {
      try {
        const params = {
          locations: [[latlng.lng, latlng.lat]],
          profile: properties.profile,
          range: [properties.range * 60],
        }
        if (properties.lines !== 1) {
          params.interval = (properties.range / properties.lines) * 60
        }
        const data = await Isochrones.calculate(params)
        this.umap.importer.build()
        this.umap.importer.raw = JSON.stringify(data)
        this.umap.importer.format = 'geojson'
        this.umap.importer.layer = properties.datalayer
        this.umap.importer.submit()
      } catch (err) {
        console.error(err)
      }
    })
  }

  async elevation(geometry) {
    const ORS = await this.loadORS()

    const Elevation = new ORS.Elevation({
      api_key: this.umap.properties.ORSAPIKey,
    })

    try {
      const data = await Elevation.lineElevation({
        format_in: 'geojson',
        format_out: 'geojson',
        geometry: geometry,
      })
      return data?.geometry
    } catch (err) {
      console.log(`An error occurred: ${err.status}`)
      console.error(err)
    }
  }

  async snap(locations) {
    const ORS = await this.loadORS()
    const Snap = new ORS.Snap({ api_key: this.umap.properties.ORSAPIKey })
    const properties = {
      range: 10,
      lines: 1,
      profile: 'foot-walking',
    }

    const metadatas = [
      [
        'profile',
        { handler: 'Select', selectOptions: PROFILES, label: translate('Profile') },
      ],
      [
        'radius',
        {
          handler: 'Range',
          min: 0,
          max: 500,
          step: 50,
          ticks: 11,
          label: translate('Radius'),
        },
      ],
    ]
    const form = new Form(properties, metadatas, { umap: this.umap })
    this.umap.dialog.open({ template: form.build() }).then(async () => {
      try {
        const data = await Snap.calculate({
          locations: locations,
          radius: properties.radius,
          profile: properties.profile,
          format: 'geojson',
        })
        // Add your own result handling here
        console.log('response: ', data)
        return data
      } catch (err) {
        console.log(`An error occurred: ${err.status}`)
        console.error(err)
      }
    })
  }

  async directions(coordinates, properties) {
    const ORS = await this.loadORS()
    const Directions = new ORS.Directions({ api_key: this.umap.properties.ORSAPIKey })
    try {
      const featuresCollection = await Directions.calculate({
        coordinates: coordinates,
        profile: properties.profile,
        preference: properties.preference,
        elevation: properties.elevation,
        geometry_simplify: true,
        format: 'geojson',
      })
      // Add your own result handling here
      const feature = featuresCollection.features[0]
      console.log('response: ', feature)
      return feature.geometry
    } catch (err) {
      console.log(`An error occurred: ${err.status}`)
      console.error(err)
    }
  }
}
