/*
 * Modals
 */
U.UI = L.Evented.extend({
  ALERTS: Array(),
  ALERT_ID: null,
  TOOLTIP_ID: null,

  initialize: function (parent) {
    this.parent = parent
    this.container = L.DomUtil.create('div', 'leaflet-ui-container', this.parent)
    L.DomEvent.disableClickPropagation(this.container)
    L.DomEvent.on(this.container, 'contextmenu', L.DomEvent.stopPropagation) // Do not activate our custom context menu.
    L.DomEvent.on(this.container, 'wheel', L.DomEvent.stopPropagation)
    L.DomEvent.on(this.container, 'MozMousePixelScroll', L.DomEvent.stopPropagation)
    this._alert = L.DomUtil.create('div', 'with-transition', this.container)
    this._alert.id = 'umap-alert-container'
    this._tooltip = L.DomUtil.create('div', '', this.container)
    this._tooltip.id = 'umap-tooltip-container'
  },

  alert: function (e) {
    if (L.DomUtil.hasClass(this.parent, 'umap-alert')) this.ALERTS.push(e)
    else this.popAlert(e)
  },

  popAlert: function (e) {
    if (!e) {
      if (this.ALERTS.length) e = this.ALERTS.pop()
      else return
    }
    let timeoutID
    const level_class = e.level && e.level == 'info' ? 'info' : 'error'
    this._alert.innerHTML = ''
    L.DomUtil.addClass(this.parent, 'umap-alert')
    L.DomUtil.addClass(this._alert, level_class)
    const close = () => {
      if (timeoutID && timeoutID !== this.ALERT_ID) {
        return
      } // Another alert has been forced
      this._alert.innerHTML = ''
      L.DomUtil.removeClass(this.parent, 'umap-alert')
      L.DomUtil.removeClass(this._alert, level_class)
      if (timeoutID) window.clearTimeout(timeoutID)
      this.popAlert()
    }
    const closeButton = L.DomUtil.createButton(
      'umap-close-link',
      this._alert,
      '',
      close,
      this
    )
    L.DomUtil.create('i', 'umap-close-icon', closeButton)
    const label = L.DomUtil.create('span', '', closeButton)
    label.title = label.textContent = L._('Close')
    L.DomUtil.element({ tagName: 'div', innerHTML: e.content, parent: this._alert })
    if (e.actions) {
      let action, el, input
      const form = L.DomUtil.create('div', 'umap-alert-actions', this._alert)
      for (let i = 0; i < e.actions.length; i++) {
        action = e.actions[i]
        if (action.input) {
          input = L.DomUtil.element({
            tagName: 'input',
            parent: form,
            className: 'umap-alert-input',
            placeholder: action.input,
          })
        }
        el = L.DomUtil.createButton(
          'umap-action',
          form,
          action.label,
          action.callback,
          action.callbackContext || this.map
        )
        L.DomEvent.on(el, 'click', close, this)
      }
    }
    if (e.duration !== Infinity) {
      this.ALERT_ID = timeoutID = window.setTimeout(
        L.bind(close, this),
        e.duration || 3000
      )
    }
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
