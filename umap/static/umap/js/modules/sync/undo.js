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

  markSaved() {
    if (this._undoStack.length > 0) {
      const lastOperation = this._undoStack[this._undoStack.length - 1]
      lastOperation.saved_marker = true
    }
  }

  /**
   * Returns the list of changed "subjects" from the undo stack,
   * since the last time we marked "saved"
   **/
  getChangedObjects() {
    // Get operations in the undo stack since the last save
    let last_save_index = this._undoStack.findLastIndex(
      (op) => op.saved_marker === true
    )
    if (last_save_index === -1) {
      last_save_index = 0
    }

    console.log('last save index', last_save_index)
    const operations_since_last_saved = this._undoStack.slice(last_save_index)

    return operations_since_last_saved.reduce((acc, op) => {
      const metadata = { subject: op.subject, metadata: op.metadata }
      const obj = this._getSaveTargetFromOperation(op)
      if (!acc.includes(obj)) {
        acc.push(obj)
      }
      return acc
    }, [])
  }

  _getSaveTargetFromOperation({ subject, metadata }) {
    return this._getUpdater(subject, metadata).getSaveTarget(metadata)
  }

  undo(redo = false) {
    const fromStack = redo ? this._redoStack : this._undoStack
    const toStack = redo ? this._undoStack : this._redoStack
    const operation = fromStack.pop()
    if (!operation) return
    if (operation.verb === 'batch') {
      for (const op of operation.operations) {
        this._applyOperation(this._cleanOperation(op, redo))
      }
    } else {
      this._applyOperation(this._cleanOperation(operation, redo))
    }
    toStack.push(operation)
    this.toggleState()
  }

  redo() {
    this.undo(true)
  }

  _cleanOperation(operation, redo) {
    const syncOperation = Utils.CopyJSON(operation)
    delete syncOperation.oldValue
    delete syncOperation.newValue
    syncOperation.value = redo ? operation.newValue : operation.oldValue
    return syncOperation
  }

  _applyOperation(syncOperation) {
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
