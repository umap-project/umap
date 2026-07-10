import { uMapAlert as Alert } from '../components/alerts/alert.js'
import * as DOMUtils from './domutils.js'
import { translate } from './i18n.js'
import { LocationIcon } from './icon.js'
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
    this.options = Object.assign({}, options)
    this.createInput()
    this.createContainer()
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

  get type() {
    return 'text'
  }

  get containerClassName() {
    return 'umap-autocomplete'
  }

  createInput() {
    this.input = DOMUtils.loadTemplate(`
      <input type="${this.type}" placeholder="${this.options.placeholder}" autocomplete="off" class="${this.options.className}" name="${this.options.name || 'autocomplete'}">
    `)
    this.parent.appendChild(this.input)
    this.input.addEventListener('keydown', (event) => this.onKeyDown(event))
    this.input.addEventListener('input', () => this.onInput())
    this.input.addEventListener('blur', (event) => this.onBlur(event))
  }

  createContainer() {
    this.container = DOMUtils.loadTemplate(
      `<ul class="${this.containerClassName}"></ul>`
    )
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

  onKeyDown(event) {
    switch (event.key) {
      case 'Tab':
        if (this.current !== null) this.select()
        event.preventDefault()
        event.stopPropagation()
        break
      case 'Enter':
        event.preventDefault()
        event.stopPropagation()
        this.select()
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
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
          event.preventDefault()
          event.stopPropagation()
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

  onInput() {
    if (this._typing) window.clearTimeout(this._typing)
    this._typing = window.setTimeout(() => {
      this.search()
    }, this.options.throttling)
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

  select() {
    const choice = this.results[this.current]
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
    const li = DOMUtils.loadTemplate(Utils.sanitizeVars`<li>${item.label}</li>`)
    this.container.appendChild(li)
    const result = {
      item: item,
      el: li,
    }
    li.addEventListener('mouseover', () => {
      this.current = result
      this.highlight()
    })
    li.addEventListener('mousedown', () => this.select())
    return result
  }

  resultToIndex(result) {
    return this.results.indexOf(result)
  }

  handleResults(data) {
    this.clear()
    this.container.style.display = 'block'
    this.resizeContainer()
    data.forEach((item) => {
      this.results.push(this.createResult(item))
    })
    if (!data.length && this.options.emptyMessage) {
      this.container.appendChild(
        DOMUtils.loadTemplate(
          Utils.sanitizeVars`<li class="umap-autocomplete-noresult">${this.options.emptyMessage}</li>`
        )
      )
    }
    this.current = 0
    this.highlight()
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
    return Utils.template(this.url, { q: encodeURIComponent(value) })
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
    constructor(parent, options) {
      super(parent, options)
      this.selectedContainer = this.initSelectedContainer()
    }

    initSelectedContainer() {
      const el = Utils.loadTemplate('<div class="umap-singleresult"></div>')
      this.input.parentNode.insertBefore(el, this.input.nextSibling)
      return el
    }

    displaySelected(result) {
      const [root, { close }] = DOMUtils.loadTemplateWithRefs(Utils.sanitizeVars`
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
    constructor(parent, options) {
      super(parent, options)
      this.selectedContainer = this.initSelectedContainer()
    }

    initSelectedContainer() {
      const el = Utils.loadTemplate('<ul class="umap-multiresult"></ul>')
      this.input.parentNode.insertBefore(el, this.input.nextSibling)
      return el
    }

    displaySelected(result) {
      const [li, { close }] = DOMUtils.loadTemplateWithRefs(Utils.sanitizeVars`
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

// Parse coordinates in the search input to make a reverse search:
// "48.3 4.8", "48.3, 4.8", "-48.3,-4.8"…
const COORDS_PATTERN =
  /^(?<lat>[-+]?\d{1,2}[.,]\d+)\s*[ ,]\s*(?<lng>[-+]?\d{1,3}[.,]\d+)$/

// TODO: settings ?
const REVERSE_URL = 'https://photon.komoot.io/reverse/?'

export class Geocoder extends BaseAjax {
  constructor(app, parent) {
    super(parent, {
      url: app.properties.urls.search,
      placeholder: translate('Type a place name or coordinates'),
      emptyMessage: translate('No results'),
      className: 'umap-search-input',
      minChar: 3,
      limit: 10,
      throttling: 300,
    })
    this.app = app
  }

  get type() {
    return 'search'
  }

  get containerClassName() {
    return 'umap-autocomplete umap-search'
  }

  createContainer() {
    this.container = DOMUtils.loadTemplate(
      `<ul class="${this.containerClassName}"></ul>`
    )
    this.parent.appendChild(this.container)
  }

  onBlur() {}

  buildParams(value) {
    const params = { q: value, limit: this.options.limit }
    // Bias results towards the current view, but only when zoomed in enough.
    if (this.app.mapProxy.zoom > 10) {
      const [lng, lat] = this.app.mapProxy.center
      params.lat = lat
      params.lon = lng
      params.location_bias_scale = 0.5
    }
    const bbox = this.app.mapProxy.getExtentBBoxString()
    if (bbox) params.bbox = bbox
    return params
  }

  buildUrl(value) {
    return this.options.url + Utils.buildQueryString(this.buildParams(value))
  }

  async search() {
    const value = this.input.value
    const coords = COORDS_PATTERN.exec(value)
    if (coords) {
      this.clear()
      const { lat, lng } = coords.groups
      return this.reverse(
        Number.parseFloat(lat.replace(',', '.')),
        Number.parseFloat(lng.replace(',', '.'))
      )
    }
    // Only numbers but not valid coordinates yet: abort.
    if (/^[\d .,]*$/.test(value)) return
    if (value.length < this.options.minChar) {
      this.clear()
      return
    }
    if (value === this.cache) return
    this.cache = value
    const geojson = await this._search(this.buildUrl(value))
    if (geojson) this.handleResults(geojson.features)
  }

  async reverse(lat, lng) {
    if (!Utils.coordinateIsValid([lng, lat])) {
      Alert.error(translate('Invalid latitude or longitude'))
      return
    }
    const url = `${REVERSE_URL}${Utils.buildQueryString({ limit: 1, lat, lon: lng })}`
    const geojson = await this._search(url)
    if (!geojson) return
    geojson.features.unshift({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        name: translate('Go to "{coords}"', { coords: `${lat} ${lng}` }),
      },
    })
    this.handleResults(geojson.features)
  }

  createResult(feature) {
    const el = this.formatResult(feature)
    this.container.appendChild(el)
    const result = { feature, el }
    el.addEventListener('mouseover', () => {
      this.current = result
      this.highlight()
    })
    el.addEventListener('mousedown', () => this.select())
    return result
  }

  formatResult(feature) {
    const properties = feature.properties
    const { name, housenumber, street, city, state, country } = properties
    let title = name || housenumber || ''
    if (!name && housenumber && street) title = `${housenumber} ${street}`
    const type =
      feature.properties.osm_value === 'yes'
        ? feature.properties.osm_key
        : feature.properties.osm_value
    const details = [
      type,
      city !== name ? city : null,
      state !== name ? state : null,
      country,
    ]
    const [li, { point, geom }] = DOMUtils.loadTemplateWithRefs(Utils.sanitizeVars`
      <li>
        <span class="search-result-tools">
          <button type="button" title="${translate('Add this geometry to my map')}" data-ref="geom"><i class="icon icon-16 icon-polygon-plus"></i></button>
          <button type="button" title="${translate('Add this place to my map')}" data-ref="point"><i class="icon icon-16 icon-marker-plus"></i></button>
        </span>
        <strong>${title}</strong>
        <small>${details.filter(Boolean).join(', ')}</small>
      </li>
    `)
    geom.hidden = !['R', 'W'].includes(properties.osm_type)
    point.addEventListener('mousedown', (event) => {
      event.stopPropagation()
      this.app.defaultEditDataLayer().makeFeature(feature).edit()
    })
    geom.addEventListener('mousedown', async (event) => {
      event.stopPropagation()
      const osm_type = { R: 'relation', W: 'way', N: 'node' }[properties.osm_type]
      if (!osm_type || !properties.osm_id) return
      await this.app.loadImporter()
      const importer = this.app.importer
      importer.build()
      importer.format = 'geojson'
      importer.raw = await this.getOSMObject(osm_type, properties.osm_id)
      importer.submit()
    })
    const id = 'location'
    const icon = new LocationIcon()
    li.addEventListener('mouseover', () => {
      this.app.fire('map:show:point', {
        id,
        position: feature.geometry.coordinates,
        icon,
      })
    })
    li.addEventListener('mouseout', () => {
      this.app.fire('map:hide:point', { id })
    })
    return li
  }

  async getOSMObject(osm_type, osm_id) {
    const url = `https://www.openstreetmap.org/api/0.6/${osm_type}/${osm_id}/full`
    const response = await this.app.request.get(url)
    if (response?.ok) {
      const data = await this.app.formatter.fromOSM(await response.text())
      return JSON.stringify(data)
    }
  }

  select() {
    const result = this.results[this.current]
    if (result) {
      const zoom = Math.max(this.app.mapProxy.zoom, 14) // Never unzoom.
      this.app.fire('map:view:set', {
        center: result.feature.geometry.coordinates,
        zoom,
      })
    }
  }
}

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
