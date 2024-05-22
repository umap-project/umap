/*
 * Modals
 */
U.UI = L.Evented.extend({
  TOOLTIP_ID: null,

  initialize: function (parent) {
    this.parent = parent
    this.container = L.DomUtil.create('div', 'leaflet-ui-container', this.parent)
    L.DomEvent.disableClickPropagation(this.container)
    L.DomEvent.on(this.container, 'contextmenu', L.DomEvent.stopPropagation) // Do not activate our custom context menu.
    L.DomEvent.on(this.container, 'wheel', L.DomEvent.stopPropagation)
    L.DomEvent.on(this.container, 'MozMousePixelScroll', L.DomEvent.stopPropagation)
    this._tooltip = L.DomUtil.create('div', '', this.container)
    this._tooltip.id = 'umap-tooltip-container'
  },

  tooltip: function (opts) {
    function showIt() {
      if (opts.anchor && opts.position === 'top') {
        this.anchorTooltipTop(opts.anchor)
      } else if (opts.anchor && opts.position === 'left') {
        this.anchorTooltipLeft(opts.anchor)
      } else if (opts.anchor && opts.position === 'bottom') {
        this.anchorTooltipBottom(opts.anchor)
      } else {
        this.anchorTooltipAbsolute()
      }
      L.DomUtil.addClass(this.parent, 'umap-tooltip')
      this._tooltip.innerHTML = U.Utils.escapeHTML(opts.content)
    }
    this.TOOLTIP_ID = window.setTimeout(L.bind(showIt, this), opts.delay || 0)
    const id = this.TOOLTIP_ID
    function closeIt() {
      this.closeTooltip(id)
    }
    if (opts.anchor) {
      L.DomEvent.once(opts.anchor, 'mouseout', closeIt, this)
    }
    if (opts.duration !== Infinity) {
      window.setTimeout(L.bind(closeIt, this), opts.duration || 3000)
    }
  },

  anchorTooltipAbsolute: function () {
    this._tooltip.className = ''
    const left =
        this.parent.offsetLeft +
        this.parent.clientWidth / 2 -
        this._tooltip.clientWidth / 2,
      top = this.parent.offsetTop + 75
    this.setTooltipPosition({ top: top, left: left })
  },

  anchorTooltipTop: function (el) {
    this._tooltip.className = 'tooltip-top'
    const coords = this.getPosition(el)
    this.setTooltipPosition({
      left: coords.left - 10,
      bottom: this.getDocHeight() - coords.top + 11,
    })
  },

  anchorTooltipBottom: function (el) {
    this._tooltip.className = 'tooltip-bottom'
    const coords = this.getPosition(el)
    this.setTooltipPosition({
      left: coords.left,
      top: coords.bottom + 11,
    })
  },

  anchorTooltipLeft: function (el) {
    this._tooltip.className = 'tooltip-left'
    const coords = this.getPosition(el)
    this.setTooltipPosition({
      top: coords.top,
      right: document.documentElement.offsetWidth - coords.left + 11,
    })
  },

  closeTooltip: function (id) {
    // Clear timetout even if a new tooltip has been added
    // in the meantime. Eg. after a mouseout from the anchor.
    window.clearTimeout(id)
    if (id && id !== this.TOOLTIP_ID) return
    this._tooltip.className = ''
    this._tooltip.innerHTML = ''
    this.setTooltipPosition({})
    L.DomUtil.removeClass(this.parent, 'umap-tooltip')
  },

  getPosition: function (el) {
    return el.getBoundingClientRect()
  },

  setTooltipPosition: function (coords) {
    if (coords.left) this._tooltip.style.left = `${coords.left}px`
    else this._tooltip.style.left = 'initial'
    if (coords.right) this._tooltip.style.right = `${coords.right}px`
    else this._tooltip.style.right = 'initial'
    if (coords.top) this._tooltip.style.top = `${coords.top}px`
    else this._tooltip.style.top = 'initial'
    if (coords.bottom) this._tooltip.style.bottom = `${coords.bottom}px`
    else this._tooltip.style.bottom = 'initial'
  },

  getDocHeight: function () {
    const D = document
    return Math.max(
      D.body.scrollHeight,
      D.documentElement.scrollHeight,
      D.body.offsetHeight,
      D.documentElement.offsetHeight,
      D.body.clientHeight,
      D.documentElement.clientHeight
    )
  },
})
