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
    const dirty = this.isDirty()
    document.body.classList.toggle('umap-is-dirty', dirty)
    for (const button of document.querySelectorAll('.disabled-on-dirty')) {
      button.disabled = dirty
    }
  }

  isDirty() {
    for (const stage of this._undoStack) {
      if (stage.operation.dirty) return true
    }
    for (const stage of this._redoStack) {
      if (stage.operation.dirty) return true
    }
    return false
  }

  add(stage) {
    // FIXME make it more generic
    if (stage.operation.key !== '_referenceVersion') {
      stage.operation.dirty = true
      this._redoStack = []
      this._undoStack.push(stage)
      this.toggleState()
    }
  }

  copyOperation(stage, redo) {
    const operation = Utils.CopyJSON(stage.operation)
    operation.value = redo ? stage.newValue : stage.oldValue
    return operation
  }

  undo(redo = false) {
    const fromStack = redo ? this._redoStack : this._undoStack
    const toStack = redo ? this._undoStack : this._redoStack
    const stage = fromStack.pop()
    if (!stage) return
    stage.operation.dirty = !stage.operation.dirty
    if (stage.operation.verb === 'batch') {
      for (const op of stage.operations) {
        this.applyOperation(this.copyOperation(op, redo))
      }
    } else {
      this.applyOperation(this.copyOperation(stage, redo))
    }
    toStack.push(stage)
    this.toggleState()
  }

  redo() {
    this.undo(true)
  }

  applyOperation(operation) {
    const updater = this._getUpdater(operation.subject, operation.metadata)
    switch (operation.verb) {
      case 'update':
        updater.update(operation)
        this._syncEngine._send(operation)
        break
      case 'delete':
      case 'upsert':
        if (operation.value === null || operation.value === undefined) {
          updater.delete(operation)
        } else {
          updater.upsert(operation)
        }
        this._syncEngine._send(operation)
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
