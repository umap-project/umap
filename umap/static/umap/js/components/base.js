const EVENT_PREFIX = 'umap'

export class uMapElement extends HTMLElement {
  static emit(type, detail = {}) {
    const event = new CustomEvent(`${EVENT_PREFIX}:${type}`, {
      bubbles: true,
      cancelable: true,
      detail: detail,
    })
    return document.dispatchEvent(event)
  }

  /**
   * Retrieves a clone of the content template either using the `template`
   * attribute or an id mathing the name of the component:
   *
   * `umap-alert` component => `umap-alert-template` template id lookup.
   */
  get template() {
    return document
      .getElementById(this.getAttribute('template') || `${this.localName}-template`)
      .content.cloneNode(true)
  }

  constructor() {
    super()
    this.append(this.template)
  }

  /**
   * Special method which allows to easily listen to events
   * and have automated event to component method binding.
   *
   * For instance listening to `alert` will then call `onAlert`.
   */
  handleEvent(event) {
    event.preventDefault()
    // From `umap:alert` to `alert`.
    const eventName = event.type.replace(`${EVENT_PREFIX}:`, '')
    // From `alert` event type to `onAlert` call against that class.
    this[`on${eventName.charAt(0).toUpperCase() + eventName.slice(1)}`](event)
  }

  listen(eventName) {
    // Using `this` as a listener will call `handleEvent` under the hood.
    document.addEventListener(`${EVENT_PREFIX}:${eventName}`, this)
  }
}

export function register(klass, name) {
  if ('customElements' in globalThis && !customElements.get(name)) {
    customElements.define(name, klass)
  }
}
