import Geolocation from 'ol/Geolocation.js'
import Feature from 'ol/Feature.js'
import CircleStyle from 'ol/style/Circle.js'
import Point from 'ol/geom/Point.js'
import Style from 'ol/style/Style.js'
import Fill from 'ol/style/Fill.js'
import Stroke from 'ol/style/Stroke.js'
import VectorSource from 'ol/source/Vector.js'
import VectorLayer from 'ol/layer/Vector.js'
import { transformExtent } from 'ol/proj.js'

let geolocation

export async function toggle(map, app) {
  if (!geolocation) await init(map, app)
  geolocation.setTracking(!geolocation.getTracking())
}

async function init(map, app) {
  geolocation = new Geolocation({
    trackingOptions: {
      enableHighAccuracy: true,
    },
    projection: map.getView().getProjection(),
  })

  // Markers
  const accuracyFeature = new Feature()
  const positionFeature = new Feature()
  positionFeature.setStyle(
    new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({
          color: '#3399CC',
        }),
        stroke: new Stroke({
          color: '#fff',
          width: 2,
        }),
      }),
    })
  )
  const geolocateLayer = new VectorLayer({
    source: new VectorSource({
      features: [accuracyFeature, positionFeature],
    }),
  })

  geolocation.on('change:accuracyGeometry', () => {
    accuracyFeature.setGeometry(geolocation.getAccuracyGeometry())
  })

  geolocation.on('change:tracking', () => {
    if (geolocation.getTracking()) {
      map.addLayer(geolocateLayer)
      // OL emits change:position before accuracyGeometry is computed.
      geolocation.once('change:accuracyGeometry', () => {
        const view = map.getView()
        // Adapt the view to the accuracy.
        const extent = geolocation.getAccuracyGeometry().getExtent()
        const bounds = transformExtent(extent, view.getProjection(), 'EPSG:4326')
        app.fire('map:view:fit', { bounds, zoom: view.getMaxZoom() })
      })
      app.fire('map:locate:activate')
    } else {
      map.removeLayer(geolocateLayer)
      app.fire('map:locate:deactivate')
    }
  })

  geolocation.on('change:position', () => {
    const coordinates = geolocation.getPosition()
    positionFeature.setGeometry(coordinates ? new Point(coordinates) : null)
  })
}
