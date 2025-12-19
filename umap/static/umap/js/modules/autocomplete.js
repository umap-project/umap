import { DomEvent, Util, setOptions } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import { Request, ServerRequest } from './request.js'
import { escapeHTML, generateId } from './utils.js'
import * as Utils from './utils.js'
import * as DOMUtils from './domutils.js'

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
    this.input = DOMUtils.loadTemplate(`
      <input type="text" placeholder="${this.options.placeholder}" autocomplete="off" class="${this.options.className}" name="${this.options.name || 'autocomplete'}">
    `)
    this.parent.appendChild(this.input)
    this.input.addEventListener('keydown', (event) => this.onKeyDown(event))
    this.input.addEventListener('keyup', (event) => this.onKeyUp(event))
    this.input.addEventListener('blur', (event) => this.onBlur(event))
  }

  createContainer() {
    this.container = DOMUtils.loadTemplate('<ul class="umap-autocomplete"></ul>')
    document.body.appendChild(this.container)
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
    const li = DOMUtils.loadTemplate(`<li>${item.label}</li>`)
    this.container.appendChild(li)
    const result = {
      item: item,
      el: li,
    }
    li.addEventListener('mouseover', () => {
      this.current = result
      this.highlight()
    })
    li.addEventListener('mousedown', () => this.setChoice())
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
      result.el.classList.toggle('on', index === this.current)
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
    this.url = this.options.url
    this.initRequest()
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
      const [root, { close }] = DOMUtils.loadTemplateWithRefs(`
        <div class="with-toolbox">
          ${result.item.label}
          <button type="button" class="icon icon-16 icon-close" title="${translate('Close')}" data-ref="close"></button>
        </div>
      `)
      this.selectedContainer.appendChild(root)
      this.input.style.display = 'none'
      close.addEventListener('click', () => {
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
      const [li, { close }] = DOMUtils.loadTemplateWithRefs(`
        <li class="with-toolbox">${result.item.label} <button class="icon icon-16 icon-close" type="button" data-ref="close"></button></li>
      `)
      this.selectedContainer.appendChild(li)
      close.addEventListener('click', () => {
        this.selectedContainer.removeChild(li)
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
