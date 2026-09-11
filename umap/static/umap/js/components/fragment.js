class UmapFragment extends HTMLElement {
  async connectedCallback() {
    const { default: App } = await import('../modules/app.js')
    new App(this.firstElementChild.id, JSON.parse(this.dataset.settings))
  }
}

function register(Class, tagName) {
  if ('customElements' in window && !customElements.get(tagName)) {
    customElements.define(tagName, Class)
  }
}

register(UmapFragment, 'umap-fragment')
