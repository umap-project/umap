class UmapFragment extends HTMLElement {
  connectedCallback() {
    new U.Map(this.firstElementChild.id, JSON.parse(this.dataset.settings))
  }
}

function register(Class, tagName) {
  if ('customElements' in window && !customElements.get(tagName)) {
    customElements.define(tagName, Class)
  }
}

register(UmapFragment, 'umap-fragment')
