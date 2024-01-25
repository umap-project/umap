// Uses `L._`` from Leaflet.i18n which we cannot import as a module yet
import { Evented, DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'

export class HTTPError extends Error {
  constructor(message) {
    super(message)
    this.name = this.constructor.name
  }
}

export class NokError extends Error {
  constructor(response) {
    super(response.status)
    this.response = response
    this.status = response.status
    this.name = this.constructor.name
  }
}

const BaseRequest = Evented.extend({
  _fetch: async function (method, uri, headers, data) {
    const id = Math.random()
    this.fire('dataloading', { id: id })
    let response

    try {
      response = await fetch(uri, {
        method: method,
        mode: 'cors',
        headers: headers,
        body: data,
      })
    } catch (error) {
      console.error(error)
      this.fire('dataload', { id: id })
      throw new HTTPError(error.message)
    }
    if (!response.ok) {
      this.fire('dataload', { id: id })
      throw new NokError(response.status)
    }
    // TODO
    // - error handling
    // - UI connection / events

    this.fire('dataload', { id: id })
    return response
  },
})

// Basic class to issue request
// It returns a response, or null in case of error
// In case of error, an alert is sent, but non 20X status are not handled
// The consumer must check the response status by hand
export const Request = BaseRequest.extend({
  initialize: function (ui) {
    this.ui = ui
  },

  _fetch: async function (method, uri, headers, data) {
    try {
      const response = await BaseRequest.prototype._fetch.call(
        this,
        method,
        uri,
        headers,
        data
      )
      return response
    } catch (error) {
      if (error instanceof NokError) return this._onNok(error)
      return this._onError(error)
    }
  },

  get: async function (uri, headers) {
    return await this._fetch('GET', uri, headers)
  },

  post: async function (uri, headers, data) {
    return await this._fetch('POST', uri, headers, data)
  },

  _onError: function (error) {
    this.ui.alert({ content: L._('Problem in the response'), level: 'error' })
  },

  _onNok: function (error) {
    this._onError(error)
    return error.response
  },

})

// Adds uMap specifics to requests handling
// like logging, CSRF, etc.
// It expects only json responses.
// Returns an array of three elements: [data, response, error]
// The consumer must check the error to proceed or not with using the data or response
export const ServerRequest = Request.extend({
  _fetch: async function (method, uri, headers, data) {
    // Add a flag so backend can know we are in ajax and adapt the response
    // See is_ajax in utils.py
    headers = headers || {}
    headers['X-Requested-With'] = 'XMLHttpRequest'
    return await Request.prototype._fetch.call(this, method, uri, headers, data)
  },

  post: async function (uri, headers, data) {
    const token = document.cookie.replace(
      /(?:(?:^|.*;\s*)csrftoken\s*\=\s*([^;]*).*$)|^.*$/,
      '$1'
    )
    if (token) {
      headers = headers || {}
      headers['X-CSRFToken'] = token
    }
    const response = await Request.prototype.post.call(this, uri, headers, data)
    return await this._as_json(response)
  },

  get: async function (uri, headers) {
    const response = await Request.prototype.get.call(this, uri, headers)
    return await this._as_json(response)
  },

  _as_json: async function (response) {
    if (Array.isArray(response)) return response
    try {
      const data = await response.json()
      if (data.info) {
        this.ui.alert({ content: data.info, level: 'info' })
        this.ui.closePanel()
      } else if (data.error) {
        this.ui.alert({ content: data.error, level: 'error' })
        return this._onError(new Error(data.error))
      }
      return [data, response, null]
    } catch (error) {
      return this._onError(error)
    }
  },

  _onError: function (error) {
    return [{}, null, error]
  },

  _onNok: function (error) {
    if (error.status === 403) {
      this.ui.alert({
        content: message || L._('Action not allowed :('),
        level: 'error',
      })
    }
    return [{}, error.response, error]
  },
})
