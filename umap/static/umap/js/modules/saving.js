export class SaveManager {
  constructor() {
    this._queue = new Set()
  }

  get isDirty() {
    return Boolean(this._queue.size)
  }

  async save() {
    for (const obj of this._queue) {
      const ok = await obj.save()
      if (!ok) break
      this.delete(obj)
    }
  }

  add(obj) {
    this._queue.add(obj)
    this.checkStatus()
  }

  delete(obj) {
    this._queue.delete(obj)
    this.checkStatus()
  }

  has(obj) {
    return this._queue.has(obj)
  }

  checkStatus() {
    document.body.classList.toggle('umap-is-dirty', this._queue.size)
  }
}

export const SAVEMANAGER = new SaveManager()

export class ServerStored {
  set isDirty(status) {
    if (status) {
      SAVEMANAGER.add(this)
    } else {
      SAVEMANAGER.delete(this)
    }
    this.onDirty(status)
  }

  get isDirty() {
    return SAVEMANAGER.has(this)
  }

  onDirty(status) {}
}
