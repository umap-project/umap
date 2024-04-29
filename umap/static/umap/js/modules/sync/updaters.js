/**
 * This file contains the updaters: classes that are able to convert messages
 * received from another party (or the server) to changes on the map.
 */

class BaseUpdater {
  constructor(map) {
    this.map = map
  }

  updateObjectValue(obj, key, value) {
    // XXX refactor so it's cleaner
    let path = key.split('.')
    let what
    for (var i = 0, l = path.length; i < l; i++) {
      what = path[i]
      if (what === path[l - 1]) {
        if (typeof value === 'undefined') {
          delete obj[what]
        } else {
          obj[what] = value
        }
      } else {
        obj = obj[what]
      }
    }
  }

  getLayerFromID(layerId) {
    if (layerId) return this.map.getDataLayerByUmapId(layerId)
    return this.map.defaultEditDataLayer()
  }

  applyMessage(message) {
    let { verb } = message
    return this[verb](message)
  }
}

export class MapUpdater extends BaseUpdater {
  update({ key, value }) {
    console.log(key, value)
    this.updateObjectValue(this.map, key, value)
    this.map.render([key])
  }
}

export class DatalayerUpdater extends BaseUpdater {
  update({ key, metadata, value }) {
    const datalayer = this.getLayerFromID(metadata.id)
    console.log(datalayer, key, value)
    this.updateObjectValue(datalayer, key, value)
    datalayer.render([key])
  }
}

/**
 * This is an abstract base class
 * And needs to be subclassed to be used.
 *
 * The child classes need to expose:
 * - `featureClass`: the name of the class to create the feature
 * - `featureArgument`: an object with the properties to pass to the class when bulding it.
 **/
class FeatureUpdater extends BaseUpdater {
  getFeatureFromMetadata({ id, layerId }) {
    const datalayer = this.getLayerFromID(layerId)
    return datalayer.getFeatureById(id)
  }

  // XXX Not sure about the naming. It's returning latlng OR latlngS
  getGeometry({ type, coordinates }) {
    if (type == 'Point') {
      return L.GeoJSON.coordsToLatLng(coordinates)
    }
    return L.GeoJSON.coordsToLatLngs(coordinates)
  }

  upsert({ metadata, value }) {
    let { id, layerId } = metadata
    const datalayer = this.getLayerFromID(layerId)
    let feature = this.getFeatureFromMetadata(metadata, value)
    feature = datalayer.geometryToFeature({ geometry: value.geometry, id, feature })
    feature.addTo(datalayer)
  }

  update({ key, metadata, value }) {
    let feature = this.getFeatureFromMetadata(metadata)

    switch (key) {
      case 'geometry':
        const datalayer = this.getLayerFromID(metadata.layerId)
        datalayer.geometryToFeature({ geometry: value, id: metadata.id, feature })
      default:
        this.updateObjectValue(feature, key, value)
    }

    feature.datalayer.indexProperties(feature)
    feature.render([key])
  }

  delete({ metadata }) {
    // XXX Distinguish between properties getting deleted
    // and the wole feature getting deleted
    let feature = this.getFeatureFromMetadata(metadata)
    if (feature) feature.del()
  }
}

class PathUpdater extends FeatureUpdater {}

class MarkerUpdater extends FeatureUpdater {
  featureType = 'marker'
  featureClass = U.Marker
  featureArgument = 'latlng'
}

class PolygonUpdater extends PathUpdater {
  featureType = 'polygon'
  featureClass = U.Polygon
  featureArgument = 'latlngs'
}

class PolylineUpdater extends PathUpdater {
  featureType = 'polyline'
  featureClass = U.Polyline
  featureArgument = 'latlngs'
}

export { MarkerUpdater, PolygonUpdater, PolylineUpdater }
