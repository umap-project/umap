import * as Utils from '../utils.js'
import * as Schema from '../schema.js'

/**
 * Updaters are classes able to convert messages
 * received from other peers (or from the server) to changes on the map.
 */

class BaseUpdater {
  constructor(app) {
    this.app = app
  }

  getDataLayerFromID(layerId) {
    const datalayer = this.app.layers.tree.all().get(layerId)
    if (!datalayer) throw new Error(`Can't find datalayer with id ${layerId}`)
    return datalayer
  }

  applyMessage(payload) {
    const { verb } = payload
    return this[verb](payload)
  }
}

export class MapUpdater extends BaseUpdater {
  update({ key, value }) {
    if (Schema.hasField(key)) {
      Utils.setObjectValue(this.app, key, value)
    }

    this.app.render([key])
  }

  getStoredObject() {
    return this.app
  }
}

export class DataLayerUpdater extends BaseUpdater {
  upsert({ value }) {
    // Upsert only happens when a new datalayer is created.
    try {
      const datalayer = this.getDataLayerFromID(value.id)
      // We must be in a redo of a create
      // or undo of a delete
      datalayer.isDeleted = false
      datalayer.show()
      datalayer.dataChanged()
    } catch {
      const datalayer = this.app.createDataLayer(value, false)
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
    } else if (Schema.hasField(key)) {
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
    let datalayer
    try {
      datalayer = this.getDataLayerFromID(metadata.id)
    } catch (error) {
      console.debug(`Cannot find datalayer to delete: ${error}`)
    }
    datalayer.del(false, false)
    datalayer.commitDelete()
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
    if (Schema.hasField(key)) {
      Utils.setObjectValue(this.app.permissions, key, value)
    }
  }

  getStoredObject(metadata) {
    return this.app.permissions
  }
}

export class DataLayerPermissionsUpdater extends BaseUpdater {
  update({ key, value, metadata }) {
    if (Schema.hasField(key)) {
      Utils.setObjectValue(this.getDataLayerFromID(metadata.id), key, value)
    }
  }

  getStoredObject(metadata) {
    return this.getDataLayerFromID(metadata.id).permissions
  }
}
