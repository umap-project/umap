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

  has(feature) {
    return this._features.includes(feature)
  }

  isEdited(feature) {
    return this._editing && this.has(feature)
  }

  select(feature) {
    this._select([feature])
  }

  remove(feature) {
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
