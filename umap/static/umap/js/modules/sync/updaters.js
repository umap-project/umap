/**
 * This file contains the updaters: classes that are able to convert messages
 * received from another party (or the server) to changes on the map.
 */

class BaseUpdater {
  constructor(map) {
    this.map = map
  }

  updateObjectValue(obj, key, value) {
    const parts = key.split('.')
    const lastKey = parts.pop()

    // Reduce the current list of attributes,
    // to find the object to set the property onto
    const objectToSet = parts.reduce((currentObj, part) => {
      if (currentObj !== undefined && part in currentObj) return currentObj[part]
    }, obj)

    // In case the given path doesn't exist, stop here
    if (objectToSet === undefined) return

    // Set the value (or delete it)
    if (typeof value === 'undefined') {
      delete objectToSet[lastKey]
    } else {
      objectToSet[lastKey] = value
    }
  }

  getDataLayerFromID(layerId) {
    if (layerId) return this.map.getDataLayerByUmapId(layerId)
    return this.map.defaultEditDataLayer()
  }

  applyMessage(payload) {
    let { verb } = payload
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
  upsert({ value }) {
    // Inserts does not happen (we use multiple updates instead).
    this.map.createDataLayer(value, false)
    this.map.render([])
  }

  update({ key, metadata, value }) {
    const datalayer = this.getDataLayerFromID(metadata.id)
    this.updateObjectValue(datalayer, key, value)
    datalayer.render([key])
  }
}

export class FeatureUpdater extends BaseUpdater {
  getFeatureFromMetadata({ id, layerId }) {
    const datalayer = this.getDataLayerFromID(layerId)
    return datalayer.getFeatureById(id)
  }

  // Create or update an object at a specific position
  upsert({ metadata, value }) {
    let { id, layerId } = metadata
    const datalayer = this.getDataLayerFromID(layerId)
    let feature = this.getFeatureFromMetadata(metadata, value)

    feature = datalayer.geoJSONToLeaflet({
      geometry: value.geometry,
      geojson: value,
      id,
      feature,
    })
    datalayer.addLayer(feature)
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
        datalayer.geoJSONToLeaflet({ geometry: value, id: metadata.id, feature })
      default:
        this.updateObjectValue(feature, key, value)
        feature.datalayer.indexProperties(feature)
    }

    feature.render([key])
  }

  delete({ metadata }) {
    // XXX Distinguish between properties getting deleted
    // and the wole feature getting deleted
    let feature = this.getFeatureFromMetadata(metadata)
    if (feature) feature.del(false)
  }
}
