class BaseUpdater {
    updateObjectValue(obj, key, value) {
        // XXX refactor so it's cleaner
        let path = key.split('.')
        let what
        for (var i = 0, l = path.length; i < l; i++) {
            what = path[i];
            if (what === path[l - 1]) {
                if (typeof value === 'undefined') {
                    delete obj[what];
                } else {
                    obj[what] = value;
                }
            } else {
                obj = obj[what];
            }
        }
    }

    applyMessage(message) {
        let { verb } = message
        return this[verb](message)
    }
}

export class MapUpdater extends BaseUpdater {
    constructor(map) {
        super()
        this.map = map
    }

    update({ key, value }) {
        console.log(key, value)
        this.updateObjectValue(this.map, key, value)
        this.map.renderProperties([key.replace("options.", "")])
    }
}

// Maybe have an updater per type of feature (marker, polyline, etc)
export class FeatureUpdater extends BaseUpdater {
    constructor(map) {
        super()
        this.map = map
    }

    getLayerFromID(layerId) {
        if (layerId)
            return this.map.getDataLayerByUmapId(layerId)
        return this.map.defaultEditDataLayer()
    }

    getFeatureFromMetadata({ id, layerId }) {
        const datalayer = this.getLayerFromID(layerId)
        return datalayer.getFeatureById(id)
    }

    create({ metadata, value }) {
        let { id, layerId } = metadata
        const datalayer = this.getLayerFromID(layerId)
        let marker = new L.U.Marker(this.map, value.latlng, { datalayer }, id)
        marker.addTo(datalayer)
    }

    update({ key, metadata, value }) {
        let feature = this.getFeatureFromMetadata(metadata)

        if (key == "latlng") {
            feature.setLatLng(value)
        } else {
            this.updateObjectValue(feature, key, value)
        }
        feature.renderProperties([key])
    }

    delete({ metadata }) {
        // XXX
        // We need to distinguish between properties getting deleted
        // and the wole feature getting deleted
        let feature = this.getFeatureFromMetadata(metadata)
        feature.del()
    }
}