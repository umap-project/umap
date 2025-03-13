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
    const undoButton = document.querySelector('.edit-undo')
    const redoButton = document.querySelector('.edit-redo')
    if (undoButton) undoButton.disabled = !this._undoStack.length
    if (redoButton) redoButton.disabled = !this._redoStack.length
  }

  add(operation) {
    this._redoStack = []
    this._undoStack.push(operation)
    this.toggleState()
  }

  cleanOperation(operation, redo) {
    const syncOperation = Utils.CopyJSON(operation)
    delete syncOperation.oldValue
    delete syncOperation.newValue
    syncOperation.value = redo ? operation.newValue : operation.oldValue
    return syncOperation
  }

  undo(redo = false) {
    const fromStack = redo ? this._redoStack : this._undoStack
    const toStack = redo ? this._undoStack : this._redoStack
    const operation = fromStack.pop()
    if (!operation) return
    if (operation.verb === 'batch') {
      for (const op of operation.operations) {
        this.applyOperation(this.cleanOperation(op, redo))
      }
    } else {
      this.applyOperation(this.cleanOperation(operation, redo))
    }
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
        if (syncOperation.value === null || syncOperation.value === undefined) {
          updater.delete(syncOperation)
        } else {
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
