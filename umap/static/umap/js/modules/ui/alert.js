import { DomUtil, DomEvent } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'

const ALERTS = []
let ALERT_ID = null

export default class Alert {
  constructor(parent) {
    this.parent = parent
    this.container = DomUtil.create('div', 'with-transition', this.parent)
    this.container.id = 'umap-alert-container'
    DomEvent.disableClickPropagation(this.container)
    DomEvent.on(this.container, 'contextmenu', DomEvent.stopPropagation) // Do not activate our custom context menu.
    DomEvent.on(this.container, 'wheel', DomEvent.stopPropagation)
    DomEvent.on(this.container, 'MozMousePixelScroll', DomEvent.stopPropagation)
  }

  open(params) {
    if (DomUtil.hasClass(this.parent, 'umap-alert')) ALERTS.push(params)
    else this._open(params)
  }

  _open(params) {
    if (!params) {
      if (ALERTS.length) params = ALERTS.pop()
      else return
    }
    let timeoutID
    const level_class = params.level && params.level == 'info' ? 'info' : 'error'
    this.container.innerHTML = ''
    DomUtil.addClass(this.parent, 'umap-alert')
    DomUtil.addClass(this.container, level_class)
    const close = () => {
      if (timeoutID && timeoutID !== ALERT_ID) {
        return
      } // Another alert has been forced
      this.container.innerHTML = ''
      DomUtil.removeClass(this.parent, 'umap-alert')
      DomUtil.removeClass(this.container, level_class)
      if (timeoutID) window.clearTimeout(timeoutID)
      this._open()
    }
    const closeButton = DomUtil.createButton(
      'umap-close-link',
      this.container,
      '',
      close,
      this
    )
    DomUtil.create('i', 'umap-close-icon', closeButton)
    const label = DomUtil.create('span', '', closeButton)
    label.title = label.textContent = translate('Close')
    DomUtil.element({
      tagName: 'div',
      innerHTML: params.content,
      parent: this.container,
    })
    let action, el, input
    const form = DomUtil.create('div', 'umap-alert-actions', this.container)
    for (let action of params.actions || []) {
      if (action.input) {
        input = DomUtil.element({
          tagName: 'input',
          parent: form,
          className: 'umap-alert-input',
          placeholder: action.input,
        })
      }
      el = DomUtil.createButton(
        'umap-action',
        form,
        action.label,
        action.callback,
        action.callbackContext
      )
      DomEvent.on(el, 'click', close, this)
    }
    if (params.duration !== Infinity) {
      ALERT_ID = timeoutID = window.setTimeout(close, params.duration || 3000)
    }
  }
}
