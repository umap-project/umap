import Umap from '../modules/umap.js'
import * as DOMUtils from '../modules/domutils.js'
import * as Utils from '../modules/utils.js'
import { translate } from '../modules/i18n.js'

class CopiableInput extends HTMLElement {
  connectedCallback() {
    DOMUtils.copiableInput(this, this.dataset.label, this.dataset.value || '')
  }
}

class CopiableTextarea extends HTMLElement {
  static get observedAttributes() {
    return ['value']
  }

  constructor() {
    super()
    const id = `copiable-${Utils.generateId()}`
    this.innerHTML = `
    <div class="copiable-textarea">
      <label for="${id}">${this.dataset.label}</label>
      <div>
        <textarea type="text" id="${id}" readOnly>${this.value}</textarea>
        <button type="button" class="icon icon-24 icon-copy" title="${translate('copy')}" data-ref=button></button>
      </div>
    </div>
  `
    this.textarea = this.querySelector('textarea')
    this.button = this.querySelector('button')
    this.button.addEventListener('click', () =>
      DOMUtils.copyToClipboard(this.textarea.textContent)
    )
  }
  attributeChangedCallback(name, oldValue, newValue) {
    this.textarea.textContent = newValue
  }
}

function register(Class, tagName) {
  console.log('register')
  if ('customElements' in window && !customElements.get(tagName)) {
    customElements.define(tagName, Class)
  }
}

register(CopiableInput, 'copiable-input')
register(CopiableTextarea, 'copiable-textarea')
