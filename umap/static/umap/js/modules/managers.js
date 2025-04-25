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
