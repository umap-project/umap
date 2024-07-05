import { DomEvent, DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'
import { Positioned } from './base.js'

export default class Tooltip extends Positioned {
  constructor(parent) {
    super()
    this.parent = parent
    this.container = DomUtil.create('div', 'with-transition', this.parent)
    this.container.id = 'umap-tooltip-container'
    DomEvent.disableClickPropagation(this.container)
    DomEvent.on(this.container, 'contextmenu', DomEvent.stopPropagation) // Do not activate our custom context menu.
    DomEvent.on(this.container, 'wheel', DomEvent.stopPropagation)
    DomEvent.on(this.container, 'MozMousePixelScroll', DomEvent.stopPropagation)
  }

  open(opts) {
    const showIt = () => {
      this.openAt(opts)
      L.DomUtil.addClass(this.parent, 'umap-tooltip')
      this.container.innerHTML = U.Utils.escapeHTML(opts.content)
    }
    this.TOOLTIP_ID = window.setTimeout(L.bind(showIt, this), opts.delay || 0)
    const id = this.TOOLTIP_ID
    const closeIt = () => {
      this.close(id)
    }
    if (opts.anchor) {
      L.DomEvent.once(opts.anchor, 'mouseout', closeIt)
    }
    if (opts.duration !== Number.POSITIVE_INFINITY) {
      window.setTimeout(closeIt, opts.duration || 3000)
    }
  }

  close(id) {
    // Clear timetout even if a new tooltip has been added
    // in the meantime. Eg. after a mouseout from the anchor.
    window.clearTimeout(id)
    if (id && id !== this.TOOLTIP_ID) return
    this.container.className = ''
    this.container.innerHTML = ''
    this.setPosition({})
    L.DomUtil.removeClass(this.parent, 'umap-tooltip')
  }
}
