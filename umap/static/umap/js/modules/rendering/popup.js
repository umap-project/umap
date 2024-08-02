import {
  DomEvent,
  DomUtil,
  Path,
  Popup as BasePopup,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import loadTemplate from './template.js'
import Browser from '../browser.js'

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
    this.container = DomUtil.create('div', 'umap-popup')
    this.format()
    BasePopup.prototype.initialize.call(this, {}, feature)
    this.setContent(this.container)
  },

  format: function () {
    const name = this.feature.getOption('popupTemplate')
    this.content = loadTemplate(name, this.feature, this.container)
    const elements = this.container.querySelectorAll('img,iframe')
    for (const element of elements) {
      this.onElementLoaded(element)
    }
    if (!elements.length && this.container.textContent.replace('\n', '') === '') {
      this.container.innerHTML = ''
      DomUtil.add('h3', '', this.container, this.feature.getDisplayName())
    }
  },

  onElementLoaded: function (el) {
    DomEvent.on(el, 'load', () => {
      this._updateLayout()
      this._updatePosition()
      this._adjustPan()
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

  onAdd: function (map) {
    map.panel.setDefaultMode('expanded')
    map.panel.open({
      content: this._content,
      actions: [Browser.backButton(map)],
    })

    // fire events as in base class Popup.js:onAdd
    map.fire('popupopen', { popup: this })
    if (this._source) {
      this._source.fire('popupopen', { popup: this }, true)
      if (!(this._source instanceof Path)) {
        this._source.on('preclick', DomEvent.stopPropagation)
      }
    }
  },

  onRemove: function (map) {
    map.panel.close()

    // fire events as in base class Popup.js:onRemove
    map.fire('popupclose', { popup: this })
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
