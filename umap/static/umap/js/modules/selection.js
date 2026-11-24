export default class Selection {
  constructor(app) {
    this.app = app
    this._features = []
    this._editing = false
  }

  get features() {
    return [...this._features]
  }

  get size() {
    return this._features.length
  }

  get current() {
    if (this.size === 1) return this._features[0]
  }

  has(feature) {
    return this._features.includes(feature)
  }

  isEdited(feature) {
    return this._editing && this.has(feature)
  }

  select(feature) {
    this._select([feature])
  }

  unselect(feature) {
    if (!this.has(feature)) return
    this._select(this._features.filter((other) => other !== feature))
  }

  clear() {
    this._select([])
  }

  edit(feature) {
    this._edit(feature)
  }

  endEdit() {
    this._select(this._features)
  }

  next(options) {
    const target = this.current?.getNext() || this.firstFeature()
    if (target) this.moveTo(target, options)
    return target
  }

  previous(options) {
    const target = this.current?.getPrevious()
    if (target) this.moveTo(target, options)
    return target
  }

  moveTo(feature, { easing } = {}) {
    const current = this.current
    const showPopup = !current || this.app.shownFeature === current
    feature.zoomTo({ easing })
    if (current && this.isEdited(current) && !feature.isReadOnly()) feature.edit()
    else this.select(feature)
    if (showPopup) feature.openPopup()
  }

  firstFeature() {
    return this.app.layers.tree
      .find((datalayer) => datalayer.canBrowse())
      ?.features.first()
  }

  _select(features) {
    const editEnded = this._editing
    this._features = features
    this._editing = false
    this.app.fire('selection:changed', { editEnded })
  }

  _edit(feature) {
    this._features = [feature]
    this._editing = true
    this.app.fire('selection:changed', { editEnded: false })
  }
}
