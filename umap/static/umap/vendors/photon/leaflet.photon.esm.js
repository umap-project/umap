import {
  Control,
  DomUtil,
  DomEvent,
  Evented,
  latLng,
  Util,
} from '../leaflet/leaflet-src.esm.js'

const PhotonBase = Evented.extend({
  forEach: (els, callback) => {
    Array.prototype.forEach.call(els, callback)
  },

  ajax: function () {
    const url = this.options.url + this.buildQueryString(this.getParams())
    this.fire('ajax:send')
    return new Promise((resolve) => {
        fetch(url).then(async (resp) => {
            if (resp.ok) {
                resolve(await resp.json())
            }
           this.fire('ajax:return')
        })
    })
  },

  buildQueryString: (params) => {
    const queryString = []
    for (const [key, param] of Object.entries(params)) {
      if (param) {
        queryString.push(`${encodeURIComponent(key)}=${encodeURIComponent(param)}`)
      }
    }
    return queryString.join('&')
  },

  featureToPopupContent: (feature) => {
    const container = DomUtil.create('div', 'leaflet-photon-popup')
    const title = DomUtil.create('h3', '', container)
    title.innerHTML = feature.properties.label
    return container
  },
})

const PhotonBaseSearch = PhotonBase.extend({
  options: {
    url: 'https://photon.komoot.io/api/?',
    placeholder: 'Start typing...',
    minChar: 3,
    limit: 5,
    submitDelay: 300,
    includePosition: true,
    bbox: null,
    noResultLabel: 'No result',
    feedbackEmail: 'photon@komoot.de', // Set to null to remove feedback box
    feedbackLabel: 'Feedback',
  },

  CACHE: '',
  RESULTS: [],
  KEYS: {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    TAB: 9,
    RETURN: 13,
    ESC: 27,
    APPLE: 91,
    SHIFT: 16,
    ALT: 17,
    CTRL: 18,
  },

  initialize: function (input, options) {
    this.input = input
    Util.setOptions(this, options)
    let CURRENT = null

    Object.defineProperty(this, 'CURRENT', {
      get: () => CURRENT,
      set: function (index) {
        if (typeof index === 'object') {
          index = this.resultToIndex(index)
        }
        CURRENT = index
      },
    })

    this.input.type = 'search'
    this.input.placeholder = this.options.placeholder
    this.input.autocomplete = 'off'
    this.input.autocorrect = 'off'
    DomEvent.disableClickPropagation(this.input)

    DomEvent.on(this.input, 'keydown', this.onKeyDown, this)
    DomEvent.on(this.input, 'input', this.onInput, this)
    DomEvent.on(this.input, 'blur', this.onBlur, this)
    DomEvent.on(this.input, 'focus', this.onFocus, this)
    this.createResultsContainer()
  },

  createResultsContainer: function () {
    this.resultsContainer =
      this.options.resultsContainer ||
      DomUtil.create('ul', 'photon-autocomplete', document.querySelector('body'))
  },

  resizeContainer: function () {
    const l = this.getLeft(this.input)
    const t = this.getTop(this.input) + this.input.offsetHeight
    this.resultsContainer.style.left = `${l}px`
    this.resultsContainer.style.top = `${t}px`
    const width = this.options.width ? this.options.width : this.input.offsetWidth - 2
    this.resultsContainer.style.width = `${width}px`
  },

  onKeyDown: function (e) {
    switch (e.keyCode) {
      case this.KEYS.TAB:
        if (this.CURRENT !== null) {
          this.setChoice()
        }
        DomEvent.stop(e)
        break
      case this.KEYS.RETURN:
        DomEvent.stop(e)
        this.setChoice()
        break
      case this.KEYS.ESC:
        DomEvent.stop(e)
        this.hide()
        this.input.blur()
        break
      case this.KEYS.DOWN:
        if (this.RESULTS.length > 0) {
          if (this.CURRENT !== null && this.CURRENT < this.RESULTS.length - 1) {
            // what if one resutl?
            this.CURRENT++
            this.highlight()
          } else if (this.CURRENT === null) {
            this.CURRENT = 0
            this.highlight()
          }
        }
        break
      case this.KEYS.UP:
        if (this.CURRENT !== null) {
          DomEvent.stop(e)
        }
        if (this.RESULTS.length > 0) {
          if (this.CURRENT > 0) {
            this.CURRENT--
            this.highlight()
          } else if (this.CURRENT === 0) {
            this.CURRENT = null
            this.highlight()
          }
        }
        break
    }
  },

  onInput: function (_e) {
    if (typeof this.submitDelay === 'number') {
      window.clearTimeout(this.submitDelay)
      delete this.submitDelay
    }
    this.submitDelay = window.setTimeout(
      Util.bind(this.search, this),
      this.options.submitDelay
    )
  },

  onBlur: function (_e) {
    this.fire('blur')
    setTimeout(() => {
      this.hide()
    }, 100)
  },

  onFocus: function (_e) {
    this.fire('focus')
    this.input.select()
    this.search() // In case we have a value from a previous search.
  },

  clear: function () {
    this.RESULTS = []
    this.CURRENT = null
    this.CACHE = ''
    this.resultsContainer.innerHTML = ''
  },

  hide: function () {
    this.fire('hide')
    this.clear()
    this.resultsContainer.style.display = 'none'
  },

  setChoice: function (choice) {
    choice = choice || this.RESULTS[this.CURRENT]
    if (choice) {
      this.hide()
      this.fire('selected', { choice: choice.feature })
      this.onSelected(choice.feature)
      this.input.value = ''
    }
  },

  search: function () {
    const val = this.input.value
    const minChar =
      typeof this.options.minChar === 'function'
        ? this.options.minChar(val)
        : val.length >= this.options.minChar
    if (!val || !minChar) return this.clear()
    if (`${val}` === `${this.CACHE}`) return
    this.CACHE = val
    this._doSearch()
  },

  _doSearch: function () {
    this.ajax().then((data) => this.handleResults(data))
  },

  _onSelected: (_feature) => {},

  onSelected: function (choice) {
    return (this.options.onSelected || this._onSelected).call(this, choice)
  },

  _formatResult: function (feature, el) {
    const title = DomUtil.create('strong', '', el)
    const detailsContainer = DomUtil.create('small', '', el)
    const details = []
    const type = this.formatType(feature)
    if (feature.properties.name) {
      title.innerHTML = feature.properties.name
    } else if (feature.properties.housenumber) {
      title.innerHTML = feature.properties.housenumber
      if (feature.properties.street) {
        title.innerHTML += ` ${feature.properties.street}`
      }
    }
    if (type) details.push(type)
    if (
      feature.properties.city &&
      feature.properties.city !== feature.properties.name
    ) {
      details.push(feature.properties.city)
    }
    if (
      feature.properties.state &&
      feature.properties.state !== feature.properties.name
    ) {
      details.push(feature.properties.state)
    }
    if (feature.properties.country) details.push(feature.properties.country)
    detailsContainer.innerHTML = details.join(', ')
  },

  formatResult: function (feature, el) {
    return (this.options.formatResult || this._formatResult).call(this, feature, el)
  },

  formatType: function (feature) {
    return (this.options.formatType || this._formatType).call(this, feature)
  },

  _formatType: (feature) =>
    feature.properties.osm_value === 'yes'
      ? feature.properties.osm_key
      : feature.properties.osm_value,

  createResult: function (feature) {
    const el = DomUtil.create('li', '', this.resultsContainer)
    this.formatResult(feature, el)
    const result = {
      feature: feature,
      el: el,
    }
    // Touch handling needed
    DomEvent.on(
      el,
      'mouseover',
      function (_e) {
        this.CURRENT = result
        this.highlight()
      },
      this
    )
    DomEvent.on(
      el,
      'mousedown',
      function (_e) {
        this.setChoice()
      },
      this
    )
    return result
  },

  resultToIndex: function (result) {
    let out = null
    this.forEach(this.RESULTS, (item, index) => {
      if (item === result) {
        out = index
        return
      }
    })
    return out
  },

  handleResults: function (geojson) {
    this.clear()
    this.resultsContainer.style.display = 'block'
    this.resizeContainer()
    this.forEach(geojson.features, (feature) => {
      this.RESULTS.push(this.createResult(feature))
    })
    if (geojson.features.length === 0) {
      const noresult = DomUtil.create('li', 'photon-no-result', this.resultsContainer)
      noresult.innerHTML = this.options.noResultLabel
    }
    if (this.options.feedbackEmail) {
      const feedback = DomUtil.create('a', 'photon-feedback', this.resultsContainer)
      feedback.href = `mailto:${this.options.feedbackEmail}`
      feedback.innerHTML = this.options.feedbackLabel
    }
    this.CURRENT = 0
    this.highlight()
    if (this.options.resultsHandler) {
      this.options.resultsHandler(geojson)
    }
  },

  highlight: function () {
    this.forEach(this.RESULTS, (item, index) => {
      if (index === this.CURRENT) {
        DomUtil.addClass(item.el, 'on')
      } else {
        DomUtil.removeClass(item.el, 'on')
      }
    })
  },

  getLeft: (el) => {
    let tmp = el.offsetLeft
    el = el.offsetParent
    while (el) {
      tmp += el.offsetLeft
      el = el.offsetParent
    }
    return tmp
  },

  getTop: (el) => {
    let tmp = el.offsetTop
    el = el.offsetParent
    while (el) {
      tmp += el.offsetTop
      el = el.offsetParent
    }
    return tmp
  },

  getParams: function () {
    return {
      q: this.CACHE,
      lang: this.options.lang,
      limit: this.options.limit,
      osm_tag: this.options.osm_tag,
    }
  },
})

export const PhotonSearch = PhotonBaseSearch.extend({
  initialize: function (map, input, options) {
    this.map = map
    PhotonBaseSearch.prototype.initialize.call(this, input, options)
  },

  _onSelected: function (feature) {
    this.map.setView(
      [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
      16
    )
  },

  getParams: function () {
    const params = PhotonBaseSearch.prototype.getParams.call(this)
    if (this.options.includePosition) {
      params.lat = this.map.getCenter().lat
      params.lon = this.map.getCenter().lng
      if (this.options.location_bias_scale) {
        params.location_bias_scale = this.options.location_bias_scale
      }
    }
    if (this.options.bbox && this.options.bbox.length === 4) {
      params.bbox = this.options.bbox.join(',')
    }
    return params
  },
})

Control.Photon = Control.extend({
  includes: Evented.prototype,

  onAdd: function (map, options) {
    this.map = map
    this.container = DomUtil.create('div', 'leaflet-photon')

    this.options = Util.extend(this.options, options)

    this.input = DomUtil.create('input', 'photon-input', this.container)
    this.search = new PhotonSearch(map, this.input, this.options)
    this.search.on('blur', this.forwardEvent, this)
    this.search.on('focus', this.forwardEvent, this)
    this.search.on('hide', this.forwardEvent, this)
    this.search.on('selected', this.forwardEvent, this)
    this.search.on('ajax:send', this.forwardEvent, this)
    this.search.on('ajax:return', this.forwardEvent, this)
    return this.container
  },

  // TODO onRemove

  forwardEvent: function (e) {
    this.fire(e.type, e)
  },
})

export const PhotonReverse = PhotonBase.extend({
  options: {
    url: 'https://photon.komoot.io/reverse/?',
    limit: 1,
    handleResults: null,
  },

  initialize: function (options) {
    Util.setOptions(this, options)
  },

  doReverse: function (latlng) {
    latlng = latLng(latlng)
    this.fire('reverse', { latlng: latlng })
    this.latlng = latlng
    this.ajax().then((data) => this.handleResults(data))
  },

  _handleResults: (data) => {
    /*eslint-disable no-console */
    console.log(data)
    /*eslint-enable no-alert */
  },

  handleResults: function (data) {
    return (this.options.handleResults || this._handleResults).call(this, data)
  },

  getParams: function () {
    return {
      lang: this.options.lang,
      limit: this.options.limit,
      lat: this.latlng.lat,
      lon: this.latlng.lng,
      osm_tag: this.options.osm_tag,
    }
  },
})
