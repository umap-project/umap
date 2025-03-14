import { fieldInSchema } from '../utils.js'

/**
 * Updaters are classes able to convert messages
 * received from other peers (or from the server) to changes on the map.
 */

class BaseUpdater {
  constructor(umap) {
    this._umap = umap
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

  getDataLayerFromMetadata({ id }) {
    return this._umap.getDataLayerByUmapId(id)
  }

  applyMessage(payload) {
    const { verb } = payload
    return this[verb](payload)
  }
}

export class MapUpdater extends BaseUpdater {
  update({ key, value }) {
    console.log('updating', key, value)
    if (fieldInSchema(key)) {
      this.updateObjectValue(this._umap, key, value)
    }

    this._umap.onPropertiesUpdated([key])
    this._umap.render([key])
  }

  getSaveTarget(metadata) {
    return this._umap
  }
}

export class DataLayerUpdater extends BaseUpdater {
  upsert({ value }) {
    // Upsert only happens when a new datalayer is created.
    try {
      console.log(
        'found datalayer with id',
        value.id,
        this.getDataLayerFromMetadata(value)
      )
    } catch {
      console.log('we are the fucking catch', value)
      const datalayer = this._umap.createDataLayer(value._umap_options || value, false)
      if (value.features) {
        datalayer.addData(value)
      }
    }
  }

  update({ key, metadata, value }) {
    const datalayer = this.getDataLayerFromMetadata(metadata)
    if (fieldInSchema(key)) {
      this.updateObjectValue(datalayer, key, value)
    } else {
      console.debug(
        'Not applying update for datalayer because key is not in the schema',
        key
      )
    }
    datalayer.render([key])
  }

  delete({ metadata }) {
    const datalayer = this.getDataLayerFromMetadata(metadata)
    if (datalayer) {
      datalayer.del(false)
      datalayer.commitDelete()
    }
  }

  getSaveTarget(metadata) {
    return this.getDataLayerFromMetadata(metadata)
  }
}

export class FeatureUpdater extends BaseUpdater {
  getFeatureFromMetadata({ id, layerId }) {
    const datalayer = this.getDataLayerFromMetadata({ id: layerId })
    return datalayer.getFeatureById(id)
  }

  // Create or update an object at a specific position
  upsert({ metadata, value }) {
    console.log('updater.upsert for', metadata, value)
    const { id, layerId } = metadata
    const datalayer = this.getDataLayerFromMetadata({ id: layerId })
    const feature = this.getFeatureFromMetadata(metadata)
    console.log('feature', feature)

    if (feature) {
      console.log('changing feature geometry')
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
      this.updateObjectValue(feature, key, value)
      feature.datalayer.indexProperties(feature)
    }

    feature.render([key])
  }

  delete({ metadata }) {
    // XXX Distinguish between properties getting deleted
    // and the wole feature getting deleted
    const feature = this.getFeatureFromMetadata(metadata)
    if (feature) feature.del(false)
  }

  getSaveTarget({ layerId }) {
    return this.getDataLayerFromMetadata({ id: layerId })
  }
}
