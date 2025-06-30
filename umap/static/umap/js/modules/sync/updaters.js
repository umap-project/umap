import * as Utils from '../utils.js'

/**
 * Updaters are classes able to convert messages
 * received from other peers (or from the server) to changes on the map.
 */

class BaseUpdater {
  constructor(umap) {
    this._umap = umap
  }

  getDataLayerFromID(layerId) {
    return this._umap.getDataLayerByUmapId(layerId)
  }

  applyMessage(payload) {
    const { verb } = payload
    return this[verb](payload)
  }
}

export class MapUpdater extends BaseUpdater {
  update({ key, value }) {
    if (Utils.fieldInSchema(key)) {
      Utils.setObjectValue(this._umap, key, value)
    }

    this._umap.onPropertiesUpdated([key])
    this._umap.render([key])
  }

  getStoredObject() {
    return this._umap
  }
}

export class DataLayerUpdater extends BaseUpdater {
  upsert({ value }) {
    // Upsert only happens when a new datalayer is created.
    try {
      this.getDataLayerFromID(value.id)
    } catch {
      const datalayer = this._umap.createDataLayer(value._umap_options || value, false)
      if (value.features) {
        // FIXME: this will create new stages in the undoStack, thus this will empty
        // the redoStack
        datalayer.addData(value)
      }
    }
  }

  update({ key, metadata, value }) {
    const datalayer = this.getDataLayerFromID(metadata.id)
    if (key === 'properties') {
      datalayer.setProperties(value)
    } else if (Utils.fieldInSchema(key)) {
      Utils.setObjectValue(datalayer, key, value)
    } else {
      console.debug(
        'Not applying update for datalayer because key is not in the schema',
        key
      )
    }
    datalayer.render([key])
  }

  delete({ metadata }) {
    const datalayer = this.getDataLayerFromID(metadata.id)
    if (datalayer) {
      datalayer.del(false)
      datalayer.commitDelete()
    }
  }

  getStoredObject(metadata) {
    return this.getDataLayerFromID(metadata.id)
  }
}

export class FeatureUpdater extends BaseUpdater {
  getFeatureFromMetadata({ id, layerId }) {
    const datalayer = this.getDataLayerFromID(layerId)
    return datalayer.features.get(id)
  }

  // Create or update an object at a specific position
  upsert({ metadata, value }) {
    const { id, layerId } = metadata
    const datalayer = this.getDataLayerFromID(layerId)
    const feature = this.getFeatureFromMetadata(metadata)

    if (feature) {
      feature.geometry = value.geometry
    } else {
      datalayer.makeFeature(value, false)
    }
  }

  // Update a property of an object
  update({ key, metadata, value }) {
    const feature = this.getFeatureFromMetadata(metadata)
    if (feature === undefined) {
      console.error(`Unable to find feature with id = ${metadata.id}.`)
      return
    }
    if (key === 'geometry') {
      const feature = this.getFeatureFromMetadata(metadata)
      feature.geometry = value
    } else {
      Utils.setObjectValue(feature, key, value)
    }

    feature.render([key])
  }

  delete({ metadata }) {
    // XXX Distinguish between properties getting deleted
    // and the wole feature getting deleted
    const feature = this.getFeatureFromMetadata(metadata)
    if (feature) feature.del(false)
  }

  getStoredObject(metadata) {
    return this.getDataLayerFromID(metadata.layerId)
  }
}

export class MapPermissionsUpdater extends BaseUpdater {
  update({ key, value }) {
    if (Utils.fieldInSchema(key)) {
      Utils.setObjectValue(this._umap.permissions, key, value)
    }
  }

  getStoredObject(metadata) {
    return this._umap.permissions
  }
}

export class DataLayerPermissionsUpdater extends BaseUpdater {
  update({ key, value, metadata }) {
    if (Utils.fieldInSchema(key)) {
      Utils.setObjectValue(this.getDataLayerFromID(metadata.id), key, value)
    }
  }

  getStoredObject(metadata) {
    return this.getDataLayerFromID(metadata.id).permissions
  }
}
