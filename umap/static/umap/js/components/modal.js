import App from '../modules/app.js'

const CACHE = {}

class UmapModal extends HTMLElement {
  connectedCallback() {
    this.querySelector('.map-opener').addEventListener('click', (event) => {
      const button = event.target.closest('button')
      button.nextElementSibling.showModal()
      const mapId = `${this.dataset.mapId}_target`
      if (!CACHE[mapId]) {
        const app = new App(mapId, JSON.parse(this.dataset.settings))
        // Expose it for playwright.
        U.MAP = app
        CACHE[mapId] = app
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
