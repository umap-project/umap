import * as Utils from '../utils.js'

export default class Hash {
  constructor(app) {
    this.app = app
    this.app.on('map:view:updated', (event) => {
      this._updating = true
      this.update(event.detail)
    })
    window.addEventListener('hashchange', () => this.parse())
  }

  update({ zoom, coordinate }) {
    const [lng, lat] = coordinate
    history.replaceState(null, '', `#${zoom}/${lat}/${lng}`)
  }

  parse() {
    // Do not parse and re-update the map when we change the hash ourselves
    // after a move from the user.
    if (this._updating) {
      this._updating = false
      return
    }
    let hash = window.location.hash
    if (hash.indexOf('#') === 0) {
      hash = hash.substr(1)
    }
    const args = hash.split('/')
    if (args.length !== 3) return
    const zoom = parseFloat(args[0])
    const coordinates = [parseFloat(args[2]), parseFloat(args[1])]
    if (isNaN(zoom) || !Utils.coordinateIsValid(coordinates)) return
    this.app.fire('map:view:set', { zoom, coordinates, easing: false })
  }
}
