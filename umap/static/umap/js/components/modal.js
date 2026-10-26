const CACHE = {}

class UmapModal extends HTMLElement {
  connectedCallback() {
    this.querySelector('.map-opener').addEventListener('click', async (event) => {
      const button = event.target.closest('button')
      button.nextElementSibling.showModal()
      const mapId = `${this.dataset.mapId}_target`
      if (!CACHE[mapId]) {
        // Load the whole app only when a preview is actually opened, so listing
        // pages (dashboard…) don't eagerly download the map bundle.
        const { default: App } = await import('../modules/app.js')
        const app = new App(mapId, JSON.parse(this.dataset.settings))
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
