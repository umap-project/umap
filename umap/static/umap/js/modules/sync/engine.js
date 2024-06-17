import { DataLayerUpdater, FeatureUpdater, MapUpdater } from './updaters.js'
import { WebSocketTransport } from './websocket.js'
import { HybridLogicalClock } from './hlc.js'
import * as Utils from '../utils.js'

/**
 * The syncEngine exposes an API to sync messages between peers over the network.
 *
 * It's taking care of initializing the `transport` layer (sending and receiving
 * messages over websocket), the `operations` list (to store them locally),
 * and the `updaters` to apply messages to the map.
 *
 * You can use the `update`, `upsert` and `delete` methods.
 *
 * @example
 *
 * ```
 * const sync = new SyncEngine(map)
 *
 * // Get the authentication token from the umap server
 * sync.authenticate(tokenURI, webSocketURI, server)
 *
 * // Alternatively, start the engine manually with
 * sync.start(webSocketURI, authToken)
 *
 * // Then use the `upsert`, `update` and `delete` methods.
 * let {metadata, subject} = object.getSyncMetadata()
 * sync.upsert(subject, metadata, "value")
 * sync.update(subject, metadata, "key", "value")
 * sync.delete(subject, metadata, "key")
 * ```
 *
 * A `proxy()` method is also exposed, making it easier to use without having
 * to specify `subject` and `metadata` fields on each call:
 *
 * @example
 * ```
 * // Or using the `proxy()` method:
 * let syncProxy = sync.proxy(object)
 * syncProxy.upsert("value")
 * syncProxy.update("key", "value")
 * ```
 */
export class SyncEngine {
  constructor(map) {
    this.updaters = {
      map: new MapUpdater(map),
      feature: new FeatureUpdater(map),
      datalayer: new DataLayerUpdater(map),
    }
    this.transport = undefined
    this._operations = new Operations()
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

  upsert(subject, metadata, value) {
    this._send({ verb: 'upsert', subject, metadata, value })
  }

  update(subject, metadata, key, value) {
    this._send({ verb: 'update', subject, metadata, key, value })
  }

  delete(subject, metadata, key) {
    this._send({ verb: 'delete', subject, metadata, key })
  }

  _send(inputMessage) {
    let message = this._operations.addLocal(inputMessage)

    if (this.offline) return
    if (this.transport) {
      this.transport.send('OperationMessage', message)
    }
  }

  _getUpdater(subject, metadata) {
    if (Object.keys(this.updaters).includes(subject)) {
      return this.updaters[subject]
    }
    throw new Error(`Unknown updater ${subject}, ${metadata}`)
  }

  _applyOperation(operation) {
    const updater = this._getUpdater(operation.subject, operation.metadata)
    updater.applyMessage(operation)
  }

  /**
   * This is called by the transport layer on new messages,
   * and dispatches the different "on*" methods.
   */
  receive({ kind, ...payload }) {
    if (kind === 'OperationMessage') {
      this.onOperationMessage(payload)
    } else if (kind === 'JoinResponse') {
      this.onJoinResponse(payload)
    } else if (kind === 'ListPeersResponse') {
      this.onListPeersResponse(payload)
    } else if (kind === 'PeerMessage') {
      debug('received peermessage', payload)
      if (payload.message.verb === 'ListOperationsRequest') {
        this.onListOperationsRequest(payload)
      } else if (payload.message.verb === 'ListOperationsResponse') {
        this.onListOperationsResponse(payload)
      }
    } else {
      throw new Error(`Received unknown message from the websocket server: ${kind}`)
    }
  }

  /**
   * Received when an operation has been performed by another peer.
   *
   * Stores the passed operation locally and apply it.
   *
   * @param {Object} payload
   */
  onOperationMessage(payload) {
    this._operations.storeRemoteOperations([payload])
    this._applyOperation(payload)
  }

  /**
   * Received when the server acknowledges the `join` for this peer.
   *
   * @param {Object} payload
   * @param {string} payload.uuid The server-assigned uuid for this peer
   * @param {string[]} payload.peers The list of peers uuids
   */
  onJoinResponse({ uuid, peers }) {
    debug('received join response', { uuid, peers })
    this.uuid = uuid
    this.peers = peers

    // Get one peer at random
    let randomPeer = this._getRandomPeer()

    if (randomPeer) {
      // Retrieve the operations which happened before join.
      this.sendToPeer(randomPeer, 'ListOperationsRequest', {
        lastKnownHLC: this._operations.getLastKnownHLC(),
      })
    }
  }

  /**
   * Received when the list of peers has changed.
   *
   * @param {Object} payload
   * @param {string[]} payload.peers The list of peers uuids
   */
  onListPeersResponse({ peers }) {
    debug('received peerinfo', { peers })
    this.peers = peers
  }

  /**
   * Received when another peer asks for the list of operations.
   *
   * @param {Object} payload
   * @param {string} payload.sender the uuid of the requesting peer
   * @param {string} payload.latestKnownHLC the latest known HLC of the requesting peer
   */
  onListOperationsRequest({ sender, lastKnownHLC }) {
    this.sendToPeer(sender, 'ListOperationsResponse', {
      operations: this._operations.getOperationsSince(lastKnownHLC),
    })
  }

  /**
   * Received when another peer sends the list of operations.
   *
   * When receiving this message, operations are filtered and applied
   *
   * @param {*} operations The list of (encoded operations)
   */
  onListOperationsResponse({ sender, message }) {
    debug(`received operations from peer ${sender}`, message.operations)

    if (message.operations.length === 0) return

    // Get the list of stored operations before this message.
    const remoteOperations = Operations.sort(message.operations)
    this._operations.storeRemoteOperations(remoteOperations)

    // Sort the local operations only once, see below.
    for (const remote of remoteOperations) {
      if (this._operations.shouldBypassOperation(remote)) {
        debug(
          'Skipping the following operation, because a newer one has been found locally',
          remote
        )
      } else {
        this._applyOperation(remote)
      }
    }

    // TODO: compact the changes here?
    // e.g. we might want to :
    // - group cases of multiple updates
    // - not apply changes where we have a more recent version (but store them nevertheless)

    // 1. Get the list of fields that changed (in the incoming operations)
    // 2. For each field, get the last version
    // 3. Check if we should apply the changes.

    // For each operation
    // Get the updated key hlc
    // If key.local_hlc > key.remote_hlc: drop
    // Else: apply
  }

  /**
   * Send a message to another peer (via the transport layer)
   *
   * @param {*} recipient
   * @param {*} verb
   * @param {*} payload
   */
  sendToPeer(recipient, verb, payload) {
    payload.verb = verb
    this.transport.send('PeerMessage', {
      sender: this.uuid,
      recipient: recipient,
      message: payload,
    })
  }

  /**
   * Selects a peer ID at random within the known ones.
   *
   * @returns {string|bool} the selected peer uuid, or False if none was found.
   */
  _getRandomPeer() {
    let otherPeers = this.peers.filter((p) => p !== this.uuid)
    if (otherPeers.length > 0) {
      const random = Math.floor(Math.random() * otherPeers.length)
      return otherPeers[random]
    }
    return false
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

/**
 * Registry of local and remote operations, keeping a constant ordering.
 */
export class Operations {
  constructor() {
    this._hlc = new HybridLogicalClock()
    this._operations = new Array()
  }

  /**
   * Tick the clock and add store the passed message in the operations list.
   *
   * @param {*} inputMessage
   * @returns {*} clock-aware message
   */
  addLocal(inputMessage) {
    let message = { ...inputMessage, hlc: this._hlc.tick() }
    this._operations.push(message)
    return message
  }

  /**
   * Returns the current list of operations ordered by their HLC.
   *
   * This DOES NOT modify the list in place, but instead return a new copy.
   *
   * @returns {Array}
   */
  sorted() {
    return Operations.sort(this._operations)
  }

  /**
   * Static method to order the given list of operations by their HCL.
   *
   * @param {Object[]} operations
   * @returns an ordered copy
   */
  static sort(operations) {
    const copy = [...operations]
    copy.sort((a, b) => (a.hlc < b.hlc ? -1 : 1))
    return copy
  }

  /**
   * Store a list of remote operations locally
   *
   * Note that operations are not applied as part of this method.
   *
   * - Updates the list of operations with the remote ones.
   * - Updates the clock to reflect these changes.
   *
   * @param {Array} remoteOperations
   */
  storeRemoteOperations(remoteOperations) {
    // get the highest date from the passed operations
    let greatestHLC = remoteOperations
      .map((op) => op.hlc)
      .reduce((max, current) => (current > max ? current : max))

    // Bump the current HLC.
    this._hlc.receive(greatestHLC)
    this._operations.push(...remoteOperations)
  }

  /**
   * Get operations that happened since a specific clock tick.
   */
  getOperationsSince(hlc) {
    if (!hlc) return this._operations
    // first get the position of the clock that was sent
    const start = this._operations.findIndex((op) => op.hlc === hlc)
    this._operations.slice(start)
    return this._operations.filter((op) => op.hlc > hlc)
  }

  /**
   * Returns the last known HLC value.
   */
  getLastKnownHLC() {
    return this._operations.at(-1)?.hlc
  }

  /**
   * Checks if a given operation should be bypassed.
   *
   * Note that this doesn't only check the clock, but also if the operation share
   * on the same context (subject + metadata).
   *
   * @param {Object} remote the remote operation to compare to
   * @returns bool
   */
  shouldBypassOperation(remote) {
    const sortedLocalOperations = this.sorted()
    // No operations are stored, no need to check
    if (sortedLocalOperations.length <= 0) {
      debug('No operations are stored, no need to check')
      return false
    }

    // Latest local operation is older than the remote one
    const latest = sortedLocalOperations.at(-1)
    if (latest.hlc < remote.hlc) {
      debug('Latest local operation is older than the remote one')
      return false
    }

    // Skip operations enabling the sync engine:
    // If we receive something, we are already connected.
    if (
      remote.hasOwnProperty('key') &&
      remote.key === 'options.syncEnabled' &&
      remote.value === true
    ) {
      return true
    }
    for (const local of sortedLocalOperations) {
      if (
        local.hlc > remote.hlc &&
        Operations.haveSameContext(local, remote) &&
        // For now (and until we fix the conflict between updates and upsert)
        // upsert always have priority over other operations
        remote.verb !== 'upsert'
      ) {
        debug('this is newer:', local)
        return true
      }
    }
    return false
  }

  /**
   * Compares two operations to see if they share the same context.
   *
   * @param {Object} local
   * @param {Object} remote
   * @return {bool} true if the two operations share the same context.
   */
  static haveSameContext(local, remote) {
    const shouldCheckKey =
      local.hasOwnProperty('key') &&
      remote.hasOwnProperty('key') &&
      typeof local.key !== 'undefined' &&
      typeof remote.key !== 'undefined'

    return (
      Utils.deepEqual(local.subject, remote.subject) &&
      Utils.deepEqual(local.metadata, remote.metadata) &&
      (!shouldCheckKey || (shouldCheckKey && local.key == remote.key))
    )
  }
}

function debug(...args) {
  console.debug('SYNC ⇆', ...args)
}
