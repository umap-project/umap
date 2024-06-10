import { WebSocketTransport } from './websocket.js'
import { MapUpdater, DataLayerUpdater, FeatureUpdater } from './updaters.js'

export class SyncEngine {
  constructor(map) {
    this.updaters = {
      map: new MapUpdater(map),
      feature: new FeatureUpdater(map),
      datalayer: new DataLayerUpdater(map),
    }
    this.transport = undefined
  }

  async authenticate(tokenURI, webSocketURI, server) {
    const [response, _, error] = await server.get(tokenURI)
    if (!error) {
      this.start(webSocketURI, response.token)
    }
  }

  start(webSocketURI, authToken) {
    this.transport = new WebSocketTransport(webSocketURI, authToken, this)
  }

  stop() {
    if (this.transport) this.transport.close()
    this.transport = undefined
  }

  _getUpdater(subject, metadata) {
    if (Object.keys(this.updaters).includes(subject)) {
      return this.updaters[subject]
    }
    throw new Error(`Unknown updater ${subject}, ${metadata}`)
  }

  // This method is called by the transport layer on new messages
  receive({ kind, ...payload }) {
    if (kind == 'operation') {
      let updater = this._getUpdater(payload.subject, payload.metadata)
      updater.applyMessage(payload)
    } else {
      throw new Error(`Unknown dispatch kind: ${kind}`)
    }
  }

  _send(message) {
    if (this.transport) {
      this.transport.send('operation', message)
    }
  }

  upsert(subject, metadata, value) {
    this._send({ verb: 'upsert', subject, metadata, value })
  }

  update(subject, metadata, key, value) {
    this._send({ verb: 'update', subject, metadata, key, value })
  }

  delete(subject, metadata, key) {
    this._send({ verb: 'delete', subject, metadata, key })
  }

  /**
   * Create a proxy for this sync engine.
   *
   * The proxy will automatically call `object.getSyncMetadata` and inject the returned
   * `subject` and `metadata`` to the `upsert`, `update` and `delete` calls.
   *
   * The proxy can be used as follows:
   *
   * ```
   * const proxy = sync.proxy(object)
   * proxy.update('key', 'value')
   *```
   */
  proxy(object) {
    const handler = {
      get(target, prop) {
        // Only proxy these methods
        if (['upsert', 'update', 'delete'].includes(prop)) {
          const { subject, metadata } = object.getSyncMetadata()
          // Reflect.get is calling the original method.
          // .bind is adding the parameters automatically
          return Reflect.get(...arguments).bind(target, subject, metadata)
        }
        return Reflect.get(...arguments)
      },
    }
    return new Proxy(this, handler)
  }
}
