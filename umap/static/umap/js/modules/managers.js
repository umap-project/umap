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
  first() {
    return this.active()[0]
  }
  last() {
    const layers = this.active()
    return layers[layers.length - 1]
  }
}

export class FeatureManager extends Map {
  add(feature) {
    if (this.has(feature.id)) {
      console.error('Duplicate id', feature, this.get(feature.id))
      feature.id = Utils.generateId()
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
