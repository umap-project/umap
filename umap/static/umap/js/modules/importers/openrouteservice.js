import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'
import { Form } from '../form/builder.js'

export const PROFILES = [
  ['foot-walking', translate('Walking')],
  ['foot-hiking', translate('Hiking')],
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
  constructor(app) {
    this.app = app
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
      ['datalayer', { handler: 'NullableDataLayerSwitcher' }],
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
    const form = new Form(properties, metadatas, { app: this.app })
    // Needed for DataLayerSwitcher (which expects to be used with MutatingForm)
    form.app = this.app

    const Isochrones = new ORS.Isochrones({
      api_key: this.app.properties.ORSAPIKey,
      host: this.app.properties.ORSHost,
    })
    this.app.dialog.open({ template: await form.build() }).then(async () => {
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
        data.features.reverse()
        for (const feature of data.features) {
          feature.properties.duration = Number(feature.properties.value) / 60
          feature.properties.profile = properties.profile
        }
        this.app.importer.build()
        this.app.importer.raw = JSON.stringify(data)
        this.app.importer.format = 'geojson'
        this.app.importer.layer = properties.datalayer
        this.app.importer.submit()
      } catch (err) {
        console.error(err)
      }
    })
  }

  async elevation(geometry) {
    const ORS = await this.loadORS()

    const Elevation = new ORS.Elevation({
      api_key: this.app.properties.ORSAPIKey,
      host: this.app.properties.ORSHost,
    })

    try {
      const data = await Elevation.lineElevation({
        format_in: 'geojson',
        format_out: 'geojson',
        geometry: geometry,
      })
      return data?.geometry
    } catch (err) {
      console.debug(`An error occurred: ${err.status}`)
      console.error(err)
    }
  }

  async directions(properties) {
    if (!properties?.coordinates || properties.coordinates.length < 2) {
      console.error('Not enough coordinates to compute route', properties)
      return
    }
    const ORS = await this.loadORS()
    const Directions = new ORS.Directions({
      api_key: this.app.properties.ORSAPIKey,
      host: this.app.properties.ORSHost,
    })
    try {
      const featuresCollection = await Directions.calculate({
        coordinates: properties.coordinates,
        profile: properties.profile,
        preference: properties.preference,
        elevation: properties.elevation,
        geometry_simplify: true,
        instructions: false,
        format: 'geojson',
      })
      const feature = featuresCollection.features[0]
      return feature.geometry
    } catch (err) {
      console.debug(`An error occurred: ${err.status}`)
      console.error(err)
    }
  }
}
