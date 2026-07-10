import {
  Popup as BasePopup,
  DomEvent,
  Path,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import * as DOMUtils from '../domutils.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'

export default function loadPopup(name) {
  switch (name) {
    case 'Large':
      return PopupLarge
    case 'Panel':
      return Panel
    default:
      return Popup
  }
}

const Popup = BasePopup.extend({
  initialize: function (feature) {
    this.feature = feature
    BasePopup.prototype.initialize.call(this, {}, feature.ui)
  },

  loadContent: async function () {
    const container = document.createElement('div')
    container.classList.add('umap-popup')
    const name = this.feature.getOption('popupTemplate')
    const { default: loadTemplate } = await import('./template.js')
    this.content = await loadTemplate(name, this.feature, container)
    const elements = container.querySelectorAll('img,iframe')
    for (const element of elements) {
      this.onElementLoaded(element)
    }
    if (!elements.length && container.textContent.replace('\n', '') === '') {
      container.innerHTML = ''
      container.appendChild(
        DOMUtils.loadTemplate(
          Utils.sanitizeVars`<h3>${this.feature.getDisplayName()}</h3>`
        )
      )
    }
    this.setContent(container)
  },

  onElementLoaded: function (el) {
    DomEvent.on(el, 'load', () => {
      this._updateLayout()
      this._updatePosition()
      // Do not call when feature is in cluster.
      if (this._map) this._adjustPan()
    })
  },
})

const PopupLarge = Popup.extend({
  options: {
    maxWidth: 500,
    className: 'umap-popup-large',
  },
})

const Panel = Popup.extend({
  options: {
    zoomAnimation: false,
  },

  backButton: function (umap) {
    const button = Utils.loadTemplate(
      `<button class="icon icon-16 icon-back" title="${translate('Back to browser')}"></button>`
    )
    // Fixme: remove me when this is merged and released
    // https://github.com/Leaflet/Leaflet/pull/9052
    DOMUtils.disableClickPropagation(button)
    button.addEventListener('click', () => umap.openBrowser())
    return button
  },

  onAdd: function (leafletMap) {
    const umap = this.feature._umap
    umap.panel.setDefaultMode('expanded')
    umap.panel.open({
      content: this._content,
      actions: [this.backButton(umap)],
    })

    // fire events as in base class Popup.js:onAdd
    leafletMap.fire('popupopen', { popup: this })
    if (this._source) {
      this._source.fire('popupopen', { popup: this }, true)
      if (!(this._source instanceof Path)) {
        this._source.on('preclick', DomEvent.stopPropagation)
      }
    }
  },

  onRemove: function (leafletMap) {
    this.feature._umap.panel.close()

    // fire events as in base class Popup.js:onRemove
    leafletMap.fire('popupclose', { popup: this })
    if (this._source) {
      this._source.fire('popupclose', { popup: this }, true)
      if (!(this._source instanceof Path)) {
        this._source.off('preclick', DomEvent.stopPropagation)
      }
    }
  },

  update: () => {},
  _updateLayout: () => {},
  _updatePosition: () => {},
  _adjustPan: () => {},
  _animateZoom: () => {},
})
