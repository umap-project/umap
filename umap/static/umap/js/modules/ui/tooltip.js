import { DomUtil, DomEvent } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'

export default class Tooltip {
  constructor(parent) {
    this.parent = parent
    this.container = DomUtil.create('div', 'with-transition', this.parent)
    this.container.id = 'umap-tooltip-container'
    DomEvent.disableClickPropagation(this.container)
    DomEvent.on(this.container, 'contextmenu', DomEvent.stopPropagation) // Do not activate our custom context menu.
    DomEvent.on(this.container, 'wheel', DomEvent.stopPropagation)
    DomEvent.on(this.container, 'MozMousePixelScroll', DomEvent.stopPropagation)
  }

  open(opts) {
    function showIt() {
      if (opts.anchor && opts.position === 'top') {
        this.anchorTop(opts.anchor)
      } else if (opts.anchor && opts.position === 'left') {
        this.anchorLeft(opts.anchor)
      } else if (opts.anchor && opts.position === 'bottom') {
        this.anchorBottom(opts.anchor)
      } else {
        this.anchorAbsolute()
      }
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
    if (opts.duration !== Infinity) {
      window.setTimeout(closeIt, opts.duration || 3000)
    }
  }

  anchorAbsolute() {
    this.container.className = ''
    const left =
        this.parent.offsetLeft +
        this.parent.clientWidth / 2 -
        this.container.clientWidth / 2,
      top = this.parent.offsetTop + 75
    this.setPosition({ top: top, left: left })
  }

  anchorTop(el) {
    this.container.className = 'tooltip-top'
    const coords = this.getPosition(el)
    this.setPosition({
      left: coords.left - 10,
      bottom: this.getDocHeight() - coords.top + 11,
    })
  }

  anchorBottom(el) {
    this.container.className = 'tooltip-bottom'
    const coords = this.getPosition(el)
    this.setPosition({
      left: coords.left,
      top: coords.bottom + 11,
    })
  }

  anchorLeft(el) {
    this.container.className = 'tooltip-left'
    const coords = this.getPosition(el)
    this.setPosition({
      top: coords.top,
      right: document.documentElement.offsetWidth - coords.left + 11,
    })
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

  getPosition(el) {
    return el.getBoundingClientRect()
  }

  setPosition(coords) {
    if (coords.left) this.container.style.left = `${coords.left}px`
    else this.container.style.left = 'initial'
    if (coords.right) this.container.style.right = `${coords.right}px`
    else this.container.style.right = 'initial'
    if (coords.top) this.container.style.top = `${coords.top}px`
    else this.container.style.top = 'initial'
    if (coords.bottom) this.container.style.bottom = `${coords.bottom}px`
    else this.container.style.bottom = 'initial'
  }

  getDocHeight() {
    const D = document
    return Math.max(
      D.body.scrollHeight,
      D.documentElement.scrollHeight,
      D.body.offsetHeight,
      D.documentElement.offsetHeight,
      D.body.clientHeight,
      D.documentElement.clientHeight
    )
  }
}
