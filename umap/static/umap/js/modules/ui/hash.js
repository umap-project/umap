export default class Hash {
  constructor() {
    document.body.addEventListener('mapview:updated', (event) => {
      this._updating = true
      this.update(event.detail)
    })
    window.addEventListener('hashchange', () => this.parse())
  }

  update({ zoom, latlng }) {
    const [lat, lng] = latlng
    window.location.hash = `#${zoom}/${lat}/${lng}`
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
    const zoom = parseInt(args[0], 10)
    const lat = parseFloat(args[1])
    const lng = parseFloat(args[2])
    if (isNaN(zoom) || isNaN(lat) || isNaN(lng)) return
    document.body.dispatchEvent(
      new CustomEvent('mapview:update', { detail: { zoom, latlng: [lat, lng] } })
    )
  }
}
