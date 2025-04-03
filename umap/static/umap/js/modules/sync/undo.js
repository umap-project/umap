import * as Utils from '../utils.js'
import { DataLayerUpdater, FeatureUpdater, MapUpdater } from './updaters.js'

export class UndoManager {
  constructor(umap, updaters, syncEngine) {
    this._umap = umap
    this._syncEngine = syncEngine
    this.updaters = updaters
    this._undoStack = []
    this._redoStack = []
  }

  toggleState() {
    // document is undefined during unittests
    if (typeof document === 'undefined') return
    const undoButton = document.querySelector('.edit-undo')
    const redoButton = document.querySelector('.edit-redo')
    if (undoButton) undoButton.disabled = !this._undoStack.length
    if (redoButton) redoButton.disabled = !this._redoStack.length
    const dirty = this.isDirty()
    document.body.classList.toggle('umap-is-dirty', dirty)
    for (const button of document.querySelectorAll('.disabled-on-dirty')) {
      button.disabled = dirty
    }
    for (const button of document.querySelectorAll('.enabled-on-dirty')) {
      button.disabled = !dirty
    }
  }

  isDirty() {
    if (!this._umap.id) return true
    for (const stage of this._undoStack) {
      if (stage.operation.dirty) return true
    }
    for (const stage of this._redoStack) {
      if (stage.operation.dirty) return true
    }
    return false
  }

  add(stage) {
    stage.operation.dirty = true
    this._redoStack = []
    this._undoStack.push(stage)
    this.toggleState()
  }

  copyOperation(stage, redo) {
    const operation = Utils.CopyJSON(stage.operation)
    const value = redo ? stage.newValue : stage.oldValue
    operation.value = value
    if (['delete', 'upsert'].includes(operation.verb)) {
      operation.verb = value === null || value === undefined ? 'delete' : 'upsert'
    }
    return operation
  }

  undo(redo = false) {
    const fromStack = redo ? this._redoStack : this._undoStack
    const toStack = redo ? this._undoStack : this._redoStack
    const stage = fromStack.pop()
    if (!stage) return
    stage.operation.dirty = !stage.operation.dirty
    if (stage.operation.verb === 'batch') {
      for (const st of stage.stages) {
        this.applyOperation(this.copyOperation(st, redo))
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
        break
      case 'delete':
        updater.delete(operation)
        break
      case 'upsert':
        updater.upsert(operation)
        break
    }
    this._syncEngine._send(operation)
  }

  _getUpdater(subject, metadata) {
    if (Object.keys(this.updaters).includes(subject)) {
      return this.updaters[subject]
    }
    throw new Error(`Unknown updater ${subject}, ${metadata}`)
  }
}
