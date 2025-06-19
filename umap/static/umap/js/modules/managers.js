import * as Utils from './utils.js'

export class DataLayerManager extends Object {
  add(datalayer) {
    this[datalayer.id] = datalayer
  }
  active() {
    return Object.values(this)
      .filter((datalayer) => !datalayer.isDeleted)
      .sort((a, b) => a.rank > b.rank)
  }
  reverse() {
    return this.active().reverse()
  }
  count() {
    return this.active().length
  }
  find(func) {
    for (const datalayer of this.reverse()) {
      if (func.call(datalayer, datalayer)) {
        return datalayer
      }
    }
  }
  filter(func) {
    return this.active().filter(func)
  }
  visible() {
    return this.filter((datalayer) => datalayer.isVisible())
  }
  browsable() {
    return this.reverse().filter((datalayer) => datalayer.allowBrowse())
  }
  prev(datalayer) {
    const browsable = this.browsable()
    const current = browsable.indexOf(datalayer)
    const prev = browsable[current - 1] || browsable[browsable.length - 1]
    if (!prev.canBrowse()) return this.prev(prev)
    return prev
  }
  next(datalayer) {
    const browsable = this.browsable()
    const current = browsable.indexOf(datalayer)
    const next = browsable[current + 1] || browsable[0]
    if (!next.canBrowse()) return this.next(next)
    return next
  }
}
export class FeatureManager {
  constructor() {
    this._registry = {}
    this._index = Array()
  }

  add(feature) {
    this._registry[feature.id] = feature
    this._index.push(feature.id)
  }

  del(feature) {
    this._index.splice(this._index.indexOf(feature.id), 1)
    delete this._registry[feature.id]
  }

  has(feature) {
    return this._index.includes(feature.id)
  }

  get(id) {
    return this._registry[id]
  }

  count() {
    return this._index.length
  }

  all() {
    return Object.values(this._registry)
  }

  each(method) {
    for (const id of [...this._index]) {
      method.call(this, this._registry[id])
    }
  }

  sort(by) {
    const features = Object.values(this._registry)
    Utils.sortFeatures(features, by, U.lang)
    this._index = features.map((feature) => feature.id)
  }

  getByIndex(index) {
    if (index === -1) index = this._index.length - 1
    const id = this._index[index]
    return this._registry[id]
  }

  getIndex(feature) {
    return this._index.indexOf(feature.id)
  }

  first() {
    return this.getByIndex(0)
  }

  last() {
    return this.getByIndex(-1)
  }

  next(feature) {
    const idx = this._index.indexOf(feature.id)
    const nextId = this._index[idx + 1]
    return this._registry[nextId]
  }

  prev(feature) {
    if (this.count() <= 1) return null
    const idx = this._index.indexOf(feature.id)
    const previousId = this._index[idx - 1]
    return this._registry[previousId]
  }
}
