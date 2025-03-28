import {
  Popup as BasePopup,
  DomEvent,
  DomUtil,
  Path,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import Browser from '../browser.js'
import loadTemplate from './template.js'

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
    const container = DomUtil.create('div', 'umap-popup')
    const name = this.feature.getOption('popupTemplate')
    this.content = await loadTemplate(name, this.feature, container)
    const elements = container.querySelectorAll('img,iframe')
    for (const element of elements) {
      this.onElementLoaded(element)
    }
    if (!elements.length && container.textContent.replace('\n', '') === '') {
      container.innerHTML = ''
      DomUtil.add('h3', '', container, this.feature.getDisplayName())
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

  onAdd: function (leafletMap) {
    leafletMap._umap.panel.setDefaultMode('expanded')
    leafletMap._umap.panel.open({
      content: this._content,
      actions: [Browser.backButton(leafletMap._umap)],
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
    leafletMap._umap.panel.close()

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
