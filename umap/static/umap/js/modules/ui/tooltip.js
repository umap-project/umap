import { DomEvent } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'
import { Positioned } from './base.js'
import * as Utils from '../utils.js'

export default class Tooltip extends Positioned {
  constructor(parent) {
    super()
    this.parent = parent
    this.container = Utils.loadTemplate(
      '<div id="umap-tooltip-container" class="with-transition"></div>'
    )
    this.parent.appendChild(this.container)
    DomEvent.disableClickPropagation(this.container)
    this.container.addEventListener('contextmenu', (event) => event.stopPropagation()) // Do not activate our custom context menu.
    this.container.addEventListener('wheel', (event) => event.stopPropagation())
    this.container.addEventListener('MozMousePixelScroll', (event) =>
      event.stopPropagation()
    )
  }

  open(opts) {
    const showIt = () => {
      this.container.innerHTML = Utils.escapeHTML(opts.content)
      this.parent.classList.add('umap-tooltip')
      this.openAt(opts)
    }
    this.TOOLTIP_ID = window.setTimeout(L.bind(showIt, this), opts.delay || 0)
    const id = this.TOOLTIP_ID
    const closeIt = () => {
      this.close(id)
    }
    if (opts.anchor) {
      opts.anchor.addEventListener('mouseout', closeIt, { once: true })
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
    this.parent.classList.remove('umap-tooltip')
  }
}
