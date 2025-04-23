import {
  DomEvent,
  DomUtil,
  Util,
  setOptions,
} from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import { Request, ServerRequest } from './request.js'
import { escapeHTML, generateId } from './utils.js'
import * as Utils from './utils.js'

export class BaseAutocomplete {
  constructor(parent, options) {
    this.parent = parent
    this.options = {
      placeholder: translate('Start typing...'),
      emptyMessage: translate('No result'),
      allowFree: true,
      minChar: 2,
      maxResults: 5,
      throttling: 300,
    }
    this.cache = ''
    this.results = []
    this._current = null
    setOptions(this, options)
    this.createInput()
    this.createContainer()
    this.selectedContainer = this.initSelectedContainer()
  }

  get current() {
    return this._current
  }

  set current(index) {
    if (typeof index === 'object') {
      index = this.resultToIndex(index)
    }
    this._current = index
  }

  createInput() {
    this.input = DomUtil.element({
      tagName: 'input',
      type: 'text',
      parent: this.parent,
      placeholder: this.options.placeholder,
      autocomplete: 'off',
      className: this.options.className,
      name: this.options.name || 'autocomplete',
    })
    DomEvent.on(this.input, 'keydown', this.onKeyDown, this)
    DomEvent.on(this.input, 'keyup', this.onKeyUp, this)
    DomEvent.on(this.input, 'blur', this.onBlur, this)
  }

  createContainer() {
    this.container = DomUtil.element({
      tagName: 'ul',
      parent: document.body,
      className: 'umap-autocomplete',
    })
  }

  resizeContainer() {
    const l = this.getLeft(this.input)
    const t = this.getTop(this.input) + this.input.offsetHeight
    this.container.style.left = `${l}px`
    this.container.style.top = `${t}px`
    const width = this.options.width ? this.options.width : this.input.offsetWidth - 2
    this.container.style.width = `${width}px`
  }

  onKeyDown(e) {
    switch (e.key) {
      case 'Tab':
        if (this.current !== null) this.setChoice()
        DomEvent.stop(e)
        break
      case 'Enter':
        DomEvent.stop(e)
        this.setChoice()
        break
      case 'Escape':
        DomEvent.stop(e)
        this.hide()
        break
      case 'ArrowDown':
        if (this.results.length > 0) {
          if (this.current !== null && this.current < this.results.length - 1) {
            // what if one result?
            this.current++
            this.highlight()
          } else if (this.current === null) {
            this.current = 0
            this.highlight()
          }
        }
        break
      case 'ArrowUp':
        if (this.current !== null) {
          DomEvent.stop(e)
        }
        if (this.results.length > 0) {
          if (this.current > 0) {
            this.current--
            this.highlight()
          } else if (this.current === 0) {
            this.current = null
            this.highlight()
          }
        }
        break
    }
  }

  onKeyUp(e) {
    const special = [
      'Tab',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowDown',
      'ArrowUp',
      'Meta',
      'Shift',
      'Alt',
      'Control',
    ]
    if (!special.includes(e.key)) {
      if (this._typing) window.clearTimeout(this._typing)
      this._typing = window.setTimeout(() => {
        this.search()
      }, this.options.throttling)
    }
  }

  onBlur() {
    setTimeout(() => this.hide(), 100)
  }

  clear() {
    this.results = []
    this.current = null
    this.cache = ''
    this.container.innerHTML = ''
  }

  hide() {
    this.clear()
    this.container.style.display = 'none'
    this.input.value = ''
  }

  setChoice(choice) {
    choice = choice || this.results[this.current]
    if (choice) {
      this.input.value = choice.item.label
      this.options.on_select(choice)
      this.displaySelected(choice)
      this.hide()
      if (this.options.callback) {
        this.options.callback.bind(this)(choice)
      }
    }
  }

  createResult(item) {
    const el = DomUtil.element({
      tagName: 'li',
      parent: this.container,
      textContent: item.label,
    })
    const result = {
      item: item,
      el: el,
    }
    DomEvent.on(el, 'mouseover', () => {
      this.current = result
      this.highlight()
    })
    DomEvent.on(el, 'mousedown', () => this.setChoice())
    return result
  }

  resultToIndex(result) {
    return this.results.findIndex((item) => item.item.value === result.item.value)
  }

  handleResults(data) {
    this.clear()
    this.container.style.display = 'block'
    this.resizeContainer()
    data.forEach((item) => {
      this.results.push(this.createResult(item))
    })
    this.current = 0
    this.highlight()
    //TODO manage no results
  }

  highlight() {
    this.results.forEach((result, index) => {
      if (index === this.current) DomUtil.addClass(result.el, 'on')
      else DomUtil.removeClass(result.el, 'on')
    })
  }

  getLeft(el) {
    let tmp = el.offsetLeft
    el = el.offsetParent
    while (el) {
      tmp += el.offsetLeft
      el = el.offsetParent
    }
    return tmp
  }

  getTop(el) {
    let tmp = el.offsetTop
    el = el.offsetParent
    while (el) {
      tmp += el.offsetTop
      el = el.offsetParent
    }
    return tmp
  }
}

export class BaseAjax extends BaseAutocomplete {
  constructor(el, options) {
    super(el, options)
    this.setUrl()
    this.initRequest()
  }

  setUrl() {
    this.url = this.options?.url
  }

  initRequest() {
    this.request = new Request()
  }

  optionToResult(option) {
    return {
      value: option.value,
      label: option.innerHTML,
    }
  }

  buildUrl(value) {
    return Util.template(this.url, { q: encodeURIComponent(value) })
  }

  async search() {
    let val = this.input.value
    if (val.length < this.options.minChar) {
      this.clear()
      return
    }
    if (val === this.cache) return
    this.cache = val
    val = val.toLowerCase()
    const url = this.buildUrl(val)
    this.handleResults(await this._search(url))
  }

  async _search(url) {
    const response = await this.request.get(url)
    if (response?.ok) {
      return await response.json()
    }
  }
}

class BaseServerAjax extends BaseAjax {
  setUrl() {
    this.url = '/agnocomplete/AutocompleteUser/?q={q}'
  }

  initRequest() {
    this.server = new ServerRequest()
  }
  async _search(url) {
    const [{ data }, response] = await this.server.get(url)
    return data
  }
}

export const SingleMixin = (Base) =>
  class extends Base {
    initSelectedContainer() {
      const el = Utils.loadTemplate('<div class="umap-singleresult"></div>')
      this.input.parentNode.insertBefore(el, this.input.nextSibling)
      return el
    }

    displaySelected(result) {
      const result_el = DomUtil.element({
        tagName: 'div',
        parent: this.selectedContainer,
      })
      result_el.textContent = result.item.label
      const close = DomUtil.element({
        tagName: 'span',
        parent: result_el,
        className: 'close',
        textContent: '×',
      })
      this.input.style.display = 'none'
      DomEvent.on(close, 'click', () => {
        this.selectedContainer.innerHTML = ''
        this.input.style.display = 'block'
        this.options.on_unselect?.(result)
      })
      this.hide()
    }
  }

export const MultipleMixin = (Base) =>
  class extends Base {
    initSelectedContainer() {
      const el = Utils.loadTemplate('<ul class="umap-multiresult"></ul>')
      this.input.parentNode.insertBefore(el, this.input.nextSibling)
      return el
    }

    displaySelected(result) {
      const result_el = DomUtil.element({
        tagName: 'li',
        parent: this.selectedContainer,
      })
      result_el.textContent = result.item.label
      const close = DomUtil.element({
        tagName: 'span',
        parent: result_el,
        className: 'close',
        textContent: '×',
      })
      DomEvent.on(close, 'click', () => {
        this.selectedContainer.removeChild(result_el)
        this.options.on_unselect?.(result)
      })
      this.hide()
    }
  }

export class AjaxAutocompleteMultiple extends MultipleMixin(BaseServerAjax) {}

export class AjaxAutocomplete extends SingleMixin(BaseServerAjax) {}

export class AutocompleteDatalist {
  constructor(input) {
    this.input = input
    this.datalist = document.createElement('datalist')
    this.datalist.id = generateId()
    this.input.setAttribute('list', this.datalist.id)
    this.input.parentElement.appendChild(this.datalist)
  }

  set suggestions(values) {
    this.datalist.innerHTML = values
      .map((value) => `<option>${escapeHTML(value)}</option>`)
      .join('')
  }
}
