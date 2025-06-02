import Umap from '../modules/umap.js'

const CACHE = {}

class UmapModal extends HTMLElement {
  connectedCallback() {
    this.querySelector('.map-opener').addEventListener('click', (event) => {
      const button = event.target.closest('button')
      button.nextElementSibling.showModal()
      const mapId = `${this.dataset.mapId}_target`
      if (!CACHE[mapId]) {
        const map = new Umap(mapId, JSON.parse(this.dataset.settings))
        CACHE[mapId] = map
      } else {
        CACHE[mapId]._leafletMap.invalidateSize()
      }
    })
  }
}

function register(Class, tagName) {
  if ('customElements' in window && !customElements.get(tagName)) {
    customElements.define(tagName, Class)
  }
}

register(UmapModal, 'umap-modal')
