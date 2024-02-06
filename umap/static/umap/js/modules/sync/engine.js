import { WebSocketTransport } from "./websocket.js"
import { MapUpdater, FeatureUpdater } from "./updaters.js"

export class SyncEngine {
    constructor(map) {
        this.receiver = new MessagesDispatcher(map)
        this.transport = new WebSocketTransport(this.receiver)
        this.sender = new MessagesSender(this.transport)

        this.create = this.sender.create.bind(this.sender)
        this.update = this.sender.update.bind(this.sender)
        this.delete = this.sender.delete.bind(this.sender)
    }
}

export class MessagesDispatcher {
    constructor(map) {
        this.map = map
        this.updaters = {
            map: new MapUpdater(this.map),
            feature: new FeatureUpdater(this.map)
        }
    }

    getUpdater(subject) {
        if (["map", "feature"].includes(subject)) {
            return this.updaters[subject]
        }
        throw new Error(`Unknown updater ${subject}`)
    }

    dispatch({ kind, payload }) {
        console.log(kind, payload)
        if (kind == "sync-protocol") {
            let updater = this.getUpdater(payload.subject)
            updater.applyMessage(payload)
        }
    }
}

/**
 * Sends the message to the other party (using the specified transport):
 * 
 * - `subject` is the type of object this is referering to (map, feature, layer)
 * - `metadata` contains information about the object we're refering to (id, layerId for instance)
 * - `key` and
 * - `value` are the keys and values that are being modified.
 */
export class MessagesSender {
    constructor(transport) {
        this._transport = transport
    }

    send(message) {
        this._transport.send("sync-protocol", message)
    }

    create(subject, metadata, value) {
        this.send({ verb: "create", subject, metadata, value })
    }

    update(subject, metadata, key, value) {
        this.send({ verb: "update", subject, metadata, key, value })
    }

    delete(subject, metadata, key) {
        this.send({ verb: "delete", subject, metadata, key })
    }
}


