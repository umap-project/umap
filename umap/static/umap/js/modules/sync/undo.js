import * as Utils from '../utils.js'
import { DataLayerUpdater, FeatureUpdater, MapUpdater } from './updaters.js'

export class UndoManager {
  constructor(updaters, syncEngine) {
    this._syncEngine = syncEngine
    this.updaters = updaters
    this._undoStack = []
    this._redoStack = []
  }

  toggleState() {
    document.querySelector('.edit-undo').disabled = !this._undoStack.length
    document.querySelector('.edit-redo').disabled = !this._redoStack.length
  }

  add(operation) {
    console.debug('New entry in undo stack', operation)
    this._redoStack = []
    this._undoStack.push(operation)
    this.toggleState()
  }

  undo(redo = false) {
    const fromStack = redo ? this._redoStack : this._undoStack
    const toStack = redo ? this._undoStack : this._redoStack
    const operation = fromStack.pop()
    if (!operation) return
    const syncOperation = Utils.CopyJSON(operation)
    console.log('old/new', syncOperation.oldValue, syncOperation.newValue)
    delete syncOperation.oldValue
    delete syncOperation.newValue
    syncOperation.value = redo ? operation.newValue : operation.oldValue
    this.applyOperation(syncOperation)
    toStack.push(operation)
    this.toggleState()
  }

  redo() {
    this.undo(true)
  }

  applyOperation(syncOperation) {
    const updater = this._getUpdater(syncOperation.subject, syncOperation.metadata)
    switch (syncOperation.verb) {
      case 'update':
        updater.update(syncOperation)
        this._syncEngine._send(syncOperation)
        break
      case 'delete':
      case 'upsert':
        console.log('undo upsert/delete', syncOperation.value)
        if (syncOperation.value === null || syncOperation.value === undefined) {
          console.log('case delete')
          updater.delete(syncOperation)
        } else {
          console.log('case upsert')
          updater.upsert(syncOperation)
        }
        this._syncEngine._send(syncOperation)
        break
    }
  }

  _getUpdater(subject, metadata) {
    if (Object.keys(this.updaters).includes(subject)) {
      return this.updaters[subject]
    }
    throw new Error(`Unknown updater ${subject}, ${metadata}`)
  }
}
