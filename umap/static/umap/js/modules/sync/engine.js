import { WebSocketTransport } from './websocket.js'
import {
  MapUpdater,
  MarkerUpdater,
  PolygonUpdater,
  PolylineUpdater,
  DataLayerUpdater,
} from './updaters.js'

export class SyncEngine {
  constructor(map) {
    this.map = map
    this.receiver = new MessagesDispatcher(this.map)

    this._initialize()
  }
  _initialize() {
    this.transport = undefined
    const noop = () => {}
    // by default, all operations do nothing, until the engine is started.
    this.upsert = this.update = this.delete = noop
  }

  start(webSocketURI, authToken) {
    this.transport = new WebSocketTransport(webSocketURI, authToken, this.receiver)
    this.sender = new MessagesSender(this.transport)
    this.upsert = this.sender.upsert.bind(this.sender)
    this.update = this.sender.update.bind(this.sender)
    this.delete = this.sender.delete.bind(this.sender)
  }

  stop() {
    if (this.transport) this.transport.close()
    this._initialize()
  }
}

export class MessagesDispatcher {
  constructor(map) {
    this.map = map
    this.updaters = {
      map: new MapUpdater(this.map),
      marker: new MarkerUpdater(this.map),
      polyline: new PolylineUpdater(this.map),
      polygon: new PolygonUpdater(this.map),
      datalayer: new DataLayerUpdater(this.map),
    }
  }

  getUpdater(subject, metadata) {
    switch (subject) {
      case 'feature':
        const featureTypeExists = Object.keys(this.updaters).includes(
          metadata.featureType
        )
        if (featureTypeExists) {
          const updater = this.updaters[metadata.featureType]
          console.log(`found updater ${metadata.featureType}, ${updater}`)
          return updater
        }
      case 'map':
      case 'datalayer':
        return this.updaters[subject]
      default:
        throw new Error(`Unknown updater ${subject}, ${metadata}`)
    }
  }

  dispatch({ kind, ...payload }) {
    console.log(kind, payload)
    if (kind == 'operation') {
      let updater = this.getUpdater(payload.subject, payload.metadata)
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
    this._transport.send('operation', message)
  }

  upsert(subject, metadata, value) {
    this.send({ verb: 'upsert', subject, metadata, value })
  }

  update(subject, metadata, key, value) {
    this.send({ verb: 'update', subject, metadata, key, value })
  }

  delete(subject, metadata, key) {
    this.send({ verb: 'delete', subject, metadata, key })
  }
}
