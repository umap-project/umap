import * as Utils from '../utils.js'
import { HybridLogicalClock } from './hlc.js'
import { UndoManager } from './undo.js'
import {
  DataLayerUpdater,
  FeatureUpdater,
  MapUpdater,
  MapPermissionsUpdater,
  DataLayerPermissionsUpdater,
} from './updaters.js'
import { WebSocketTransport } from './websocket.js'

// Start reconnecting after 2 seconds, then double the delay each time
// maxing out at 32 seconds.
const RECONNECT_DELAY = 2000
const RECONNECT_DELAY_FACTOR = 2
const MAX_RECONNECT_DELAY = 32000

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
  constructor(umap) {
    this._umap = umap
    this.updaters = {
      map: new MapUpdater(umap),
      feature: new FeatureUpdater(umap),
      datalayer: new DataLayerUpdater(umap),
      mappermissions: new MapPermissionsUpdater(umap),
      datalayerpermissions: new DataLayerPermissionsUpdater(umap),
    }
    this.transport = undefined
    this._operations = new Operations()

    this._reconnectTimeout = null
    this._reconnectDelay = RECONNECT_DELAY
    this.websocketConnected = false
    this.closeRequested = false
    this.peerId = Utils.generateId()
    this._undoManager = new UndoManager(umap, this.updaters, this)
  }

  get isOpen() {
    return this.transport?.isOpen
  }

  async authenticate() {
    if (this.isOpen) return
    const websocketTokenURI = this._umap.urls.get('map_websocket_auth_token', {
      map_id: this._umap.id,
    })

    const [response, _, error] = await this._umap.server.get(websocketTokenURI)
    if (error) {
      this.reconnect()
      return
    }
    await this.start(response.token)
  }

  async start(authToken) {
    const path = this._umap.urls.get('ws_sync', { map_id: this._umap.id })
    const protocol = window.location.protocol === 'http:' ? 'ws:' : 'wss:'
    this.transport = new WebSocketTransport(this)
    await this.transport.connect(
      `${protocol}//${window.location.host}${path}`,
      authToken,
      this.peerId,
      this._umap.properties.user?.name
    )
    this.onConnection()
  }

  stop() {
    if (this.transport) {
      this.transport.close()
    }
    this.transport = undefined
  }

  onConnection() {
    this._reconnectTimeout = null
    this._reconnectDelay = RECONNECT_DELAY
    this.websocketConnected = true
    this.updaters.map.update({ key: 'numberOfConnectedPeers' })
  }

  reconnect() {
    this.websocketConnected = false
    this.updaters.map.update({ key: 'numberOfConnectedPeers' })

    this._reconnectTimeout = setTimeout(async () => {
      if (this._reconnectDelay < MAX_RECONNECT_DELAY) {
        this._reconnectDelay = this._reconnectDelay * RECONNECT_DELAY_FACTOR
      }
      await this.authenticate()
    }, this._reconnectDelay)
  }

  startBatch() {
    this._batch = []
  }

  commitBatch(subject, metadata) {
    if (!this._batch.length) {
      this._batch = null
      return
    }
    const operations = this._batch.map((stage) => stage.operation)
    const operation = { verb: 'batch', operations, subject, metadata }
    this._undoManager.add({ operation, stages: this._batch })
    this._send(operation)
    this._batch = null
  }

  upsert(subject, metadata, value, oldValue) {
    const operation = {
      verb: 'upsert',
      subject,
      metadata,
      value,
    }
    const stage = {
      operation,
      newValue: value,
      oldValue: oldValue,
    }
    if (this._batch) {
      this._batch.push(stage)
      return
    }
    this._undoManager.add(stage)
    this._send(operation)
  }

  update(subject, metadata, key, value, oldValue, { undo } = { undo: true }) {
    const operation = {
      verb: 'update',
      subject,
      metadata,
      key,
      value,
    }
    const stage = {
      operation,
      oldValue: oldValue,
      newValue: value,
    }
    if (this._batch) {
      this._batch.push(stage)
      return
    }
    if (undo) this._undoManager.add(stage)
    this._send(operation)
  }

  delete(subject, metadata, oldValue) {
    const operation = {
      verb: 'delete',
      subject,
      metadata,
    }
    const stage = {
      operation,
      oldValue: oldValue,
    }
    if (this._batch) {
      this._batch.push(stage)
      return
    }
    this._undoManager.add(stage)
    this._send(operation)
  }

  _getDirtyObjects() {
    const dirty = new Map()
    if (!this._umap.id) {
      // There is no operation for first map save
      dirty.set(this._umap, [])
    }
    const addDirtyObject = (operation) => {
      const updater = this._getUpdater(operation.subject)
      const obj = updater.getStoredObject(operation.metadata)
      if (!dirty.has(obj)) {
        dirty.set(obj, [])
      }
      dirty.get(obj).push(operation)
    }
    for (const operation of this._operations.sorted()) {
      if (operation.dirty) {
        addDirtyObject(operation)
        if (operation.verb === 'batch') {
          for (const op of operation.operations) {
            addDirtyObject(op)
          }
        }
      }
    }
    return dirty
  }

  async save() {
    const needSave = this._getDirtyObjects()
    for (const [obj, operations] of needSave.entries()) {
      const ok = await obj.save()
      if (!ok) return false
      for (const operation of operations) {
        operation.dirty = false
      }
    }
    this.saved()
    this._undoManager.toggleState()
    return true
  }

  saved() {
    if (this.offline) return
    if (this.transport) {
      this.transport.send('SavedMessage', {
        sender: this.peerId,
        lastKnownHLC: this._operations.getLastKnownHLC(),
      })
    }
  }

  _send(operation) {
    const message = this._operations.addLocal(operation)

    if (this.offline) return
    if (this.transport) {
      this.transport.send('OperationMessage', { sender: this.peerId, ...message })
    }
  }

  _getUpdater(subject, metadata, sync) {
    // For now, prevent permissions to be synced, for security reasons
    if (sync && (subject === 'mappermissions' || subject === 'datalayerpermissions')) {
      return
    }
    if (Object.keys(this.updaters).includes(subject)) {
      return this.updaters[subject]
    }
    throw new Error(`Unknown updater ${subject}, ${metadata}`)
  }

  _applyOperation(operation) {
    if (operation.verb === 'batch') {
      operation.operations.map((op) => this._applyOperation(op))
      return
    }
    const updater = this._getUpdater(operation.subject, operation.metadata)
    if (!updater) {
      debug('No updater for', operation)
      return
    }
    updater.applyMessage(operation)
  }

  getPeers() {
    return this.peers || {}
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
    } else if (kind === 'SavedMessage') {
      this.onSavedMessage(payload)
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
    if (payload.sender === this.peerId) return
    debug('received operation', payload)
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
  onJoinResponse({ peer, peers }) {
    debug('received join response', { peer, peers })
    this.onListPeersResponse({ peers })

    // Get one peer at random
    const randomPeer = this._getRandomPeer()

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
    debug('received peerinfo', peers)
    this.peers = peers
    this.updaters.map.update({ key: 'numberOfConnectedPeers' })
  }

  /**
   * Received when another peer asks for the list of operations.
   *
   * @param {Object} payload
   * @param {string} payload.sender the uuid of the requesting peer
   * @param {string} payload.latestKnownHLC the latest known HLC of the requesting peer
   */
  onListOperationsRequest({ sender, message }) {
    debug(
      `received operations request from peer ${sender} (since ${message.lastKnownHLC})`
    )

    this.sendToPeer(sender, 'ListOperationsResponse', {
      operations: this._operations.getOperationsSince(message.lastKnownHLC),
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
    debug(`received operations list from peer ${sender}`, message.operations)

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

  onSavedMessage({ sender, lastKnownHLC }) {
    debug(`received saved message from peer ${sender}`, lastKnownHLC)
    this._operations.saved(lastKnownHLC)
    this._undoManager.toggleState()
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
      sender: this.peerId,
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
    const otherPeers = Object.keys(this.peers).filter((p) => p !== this.peerId)
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
        if (['upsert', 'update', 'delete', 'commitBatch'].includes(prop)) {
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

  saved(hlc) {
    for (const operation of this.getOperationsBefore(hlc)) {
      operation.dirty = false
    }
  }

  /**
   * Tick the clock and store the passed message in the operations list.
   *
   * @param {*} inputMessage
   * @returns {*} clock-aware message
   */
  addLocal(operation) {
    operation.hlc = this._hlc.tick()
    this._operations.push(operation)
    return operation
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
    const greatestHLC = remoteOperations
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

  getOperationsBefore(hlc) {
    if (!hlc) return this._operations
    return this._operations.filter((op) => op.hlc <= hlc)
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
    const shouldCheckKey = local.key !== undefined && remote.key !== undefined

    return (
      Utils.deepEqual(local.subject, remote.subject) &&
      Utils.deepEqual(local.metadata, remote.metadata) &&
      (!shouldCheckKey || (shouldCheckKey && local.key === remote.key))
    )
  }
}

function debug(...args) {
  console.debug('SYNC ⇆', ...args.map((x) => JSON.stringify(x)))
}
