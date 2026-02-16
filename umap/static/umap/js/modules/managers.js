import * as Utils from './utils.js'

class LayerCollection {
  constructor(
    items,
    {
      root = false, // Do not iter over children
      filter = (i) => i, // Noop
      sort = (a, b) => b.rank - a.rank, // Higher ranks before
    } = {}
  ) {
    this._items = Array.from(items)
    this._root = root
    this._filter = filter
    this._sort = sort
    this._all = false
  }

  from(other) {
    this._root = other._root
    this._filter = other._filter
    this._sort = other._sort
    this._all = other._all
    return this
  }

  filter(func) {
    const previous = this._filter
    this._filter = (item) => previous(item) && func(item)
    return this
  }

  sort(func) {
    this._sort = func
    return this
  }

  reverse(func) {
    // Lower ranks before
    this.sort((a, b) => a.rank - b.rank)
    return this
  }

  root() {
    this._root = true
    return this
  }

  all() {
    this._all = true
    return this
  }

  visible() {
    return this.filter((datalayer) => datalayer.isVisible())
  }

  browsable() {
    return this.filter((datalayer) => datalayer.allowBrowse())
  }

  some(func) {
    return Array.from(this).some(func)
  }

  find(func) {
    return Array.from(this).find(func)
  }

  reduce(acc, func) {
    return Array.from(this).reduce(acc, func)
  }

  map(func) {
    return Array.from(this).map(func)
  }

  first() {
    return Array.from(this)[0]
  }

  count() {
    return Array.from(this).length
  }

  get length() {
    return Array.from(this).length
  }

  *[Symbol.iterator]() {
    if (!this._all) {
      this.filter((layer) => !layer.isDeleted)
    }
    const values = this._items.filter(this._filter).toSorted(this._sort)
    for (const dl of values) {
      yield dl
      if (!this._root) {
        yield* dl.layers.tree.from(this)
      }
    }
  }
}

export class LayerManager {
  constructor() {
    this._items = new Map()
  }

  get tree() {
    return new LayerCollection(this._items.values())
  }

  get root() {
    return new LayerCollection(this._items.values()).root()
  }

  *[Symbol.iterator]() {
    yield* this.root
  }

  get(id) {
    if (this._items.has(id)) return this._items.get(id)
    for (const item of this._items.values()) {
      if (item.layers.has(id)) return item.layers.get(id)
    }
  }

  has(id) {
    if (this._items.has(id)) return true
    for (const item of this._items.values()) {
      if (item.layers.has(id)) return true
    }
  }

  add(layer) {
    layer.rank ??= this._items.size
    this._items.set(layer.id, layer)
  }

  insert(layer, position, other) {
    const current = Array.from(this.root.reverse().filter((el) => el !== layer))
    const targetIdx = current.indexOf(other)
    // After = greater index, before = same index
    const shift = position === 'after' ? 1 : 0
    current.splice(targetIdx + shift, 0, layer)
    // We cannot insert on a Map, so let's clear and again in the final order
    this._items.clear()
    let rank = 0
    for (const item of current) {
      item.rank = rank++
      this.add(item)
    }
  }

  addAfter(layer, other) {
    this.insert(layer, 'after', other)
  }

  addBefore(layer, other) {
    this.insert(layer, 'before', other)
  }

  delete(layer) {
    this._items.delete(layer.id)
    let rank = 0
    for (const item of this.root.reverse()) {
      item.rank = rank++
    }
  }

  count() {
    return this.tree.length
  }

  prev(datalayer) {
    // TODO rework to include children
    const browsable = Array.from(this.tree.browsable())
    const current = browsable.indexOf(datalayer)
    const prev = browsable[current - 1] || browsable[browsable.length - 1]
    if (!prev.canBrowse()) return this.prev(prev)
    return prev
  }

  next(datalayer) {
    const browsable = Array.from(this.tree.browsable())
    const current = browsable.indexOf(datalayer)
    const next = browsable[current + 1] || browsable[0]
    if (!next.canBrowse()) return this.next(next)
    return next
  }

  first() {
    return this.tree.first()
  }

  last() {
    const layers = Array.from(this.tree)
    return layers[layers.length - 1]
  }
}

export class FeatureManager extends Map {
  add(feature) {
    if (this.has(feature.id)) {
      console.error('Duplicate id', feature, this.get(feature.id))
      feature.id = Utils.generateId()
      feature.datalayer._migrated = true
    }
    this.set(feature.id, feature)
  }

  all() {
    return Array.from(this.values())
  }

  visible() {
    return this.all().filter((feature) => !feature.isFiltered())
  }

  del(feature) {
    this.delete(feature.id)
  }

  count() {
    return this.size
  }

  sort(by) {
    const features = this.all()
    Utils.sortFeatures(features, by, U.lang)
    this.clear()
    for (const feature of features) {
      this.set(feature.id, feature)
    }
  }

  getIndex(feature) {
    const entries = Array.from(this)
    return entries.findIndex(([id]) => id === feature.id)
  }

  first() {
    return this.values().next().value
  }

  last() {
    return this.all()[this.size - 1]
  }

  next(feature) {
    const index = this.getIndex(feature)
    return this.all()[index + 1]
  }

  prev(feature) {
    const index = this.getIndex(feature)
    return this.all()[index - 1]
  }
}
