import { propertyBelongsTo } from '../utils.js'

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

  getDataLayerFromID(layerId) {
    if (layerId) return this.map.getDataLayerByUmapId(layerId)
    return this.map.defaultEditDataLayer()
  }

  applyMessage(payload) {
    let { verb, subject } = payload

    if (verb == 'update') {
      if (!propertyBelongsTo(payload.key, subject)) {
        console.error('Invalid message received', payload)
        return // Do not apply the message
      }
    }
    return this[verb](payload)
  }
}

export class MapUpdater extends BaseUpdater {
  update({ key, value }) {
    this.updateObjectValue(this.map, key, value)
    this.map.render([key])
  }
}

export class DataLayerUpdater extends BaseUpdater {
  upsert({ key, metadata, value }) {
    // Inserts does not happen (we use multiple updates instead).
    this.map.createDataLayer(value, false)
  }

  update({ key, metadata, value }) {
    const datalayer = this.getDataLayerFromID(metadata.id)
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
    const datalayer = this.getDataLayerFromID(layerId)
    return datalayer.getFeatureById(id)
  }

  // Create or update an object at a specific position
  upsert({ metadata, value }) {
    let { id, layerId } = metadata
    const datalayer = this.getDataLayerFromID(layerId)
    let feature = this.getFeatureFromMetadata(metadata, value)
    if (feature === undefined) {
      console.log(`Unable to find feature with id = ${metadata.id}. Creating a new one`)
    }
    feature = datalayer.geometryToFeature({
      geometry: value.geometry,
      geojson: value,
      id,
      feature,
    })
    feature.addTo(datalayer)
  }

  // Update a property of an object
  update({ key, metadata, value }) {
    let feature = this.getFeatureFromMetadata(metadata)
    if (feature === undefined) {
      console.error(`Unable to find feature with id = ${metadata.id}.`)
    }
    switch (key) {
      case 'geometry':
        const datalayer = this.getDataLayerFromID(metadata.layerId)
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
