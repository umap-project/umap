import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'
import { Form } from '../form/builder.js'

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
    const profiles = [
      ['foot-walking', translate('Walking')],
      ['driving-car', translate('By car')],
      ['cycling-regular', translate('Cycling')],
      ['wheelchair', translate('Wheelchair')],
    ]

    const metadatas = [
      ['datalayer', { handler: 'DataLayerSwitcher', allowEmpty: true }],
      [
        'profile',
        { handler: 'Select', selectOptions: profiles, label: translate('Profile') },
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
}
