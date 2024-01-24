// Uses `L._`` from Leaflet.i18n which we cannot import as a module yet
import { Evented, DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'

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
      this._onError(error)
      this.fire('dataload', { id: id })
      return
    }
    if (!response.ok) {
      this.onNok(response.status, await response.text())
    }
    // TODO
    // - error handling
    // - UI connection / events
    // - preflight mode in CORS ?

    this.fire('dataload', { id: id })
    return response
  },

  get: async function (uri, headers) {
    return await this._fetch('GET', uri, headers)
  },

  post: async function (uri, headers, data) {
    return await this._fetch('POST', uri, headers, data)
  },

  _onError: function (error) {
    console.error(error)
    this.onError(error)
  },
  onError: function (error) {},
  onNok: function (status) {},
})

export const Request = BaseRequest.extend({
  initialize: function (ui) {
    this.ui = ui
  },
  onError: function (error) {
    console.error(error)
    this.ui.alert({ content: L._('Problem in the response'), level: 'error' })
  },
  onNok: function (status, message) {
    this.onError(message)
  },
})

// Adds uMap specifics to requests handling
// like logging, CSRF, etc.
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
    return await this._handle_json_response(response)
  },

  get: async function (uri, headers) {
    const response = await Request.prototype.get.call(this, uri, headers)
    return await this._handle_json_response(response)
  },

  _handle_json_response: async function (response) {
    try {
      const data = await response.json()
      this._handle_server_instructions(data)
      return [data, response]
    } catch (error) {
      this._onError(error)
    }
  },

  _handle_server_instructions: function (data) {
    // In some case, the response contains instructions
    if (data.redirect) {
      const newPath = data.redirect
      if (window.location.pathname == newPath) {
        window.location.reload() // Keep the hash, so the current view
      } else {
        window.location = newPath
      }
    } else if (data.info) {
      this.ui.alert({ content: data.info, level: 'info' })
      this.ui.closePanel()
    } else if (data.error) {
      this.ui.alert({ content: data.error, level: 'error' })
    } else if (data.login_required) {
      // TODO: stop flow and run request again when user
      // is logged in
      const win = window.open(data.login_required)
      window.umap_proceed = () => {
        console.log('logged in')
        this.fire('login')
        win.close()
      }
    }
  },

  onNok: function (status, message) {
    if (status === 403) {
      this.ui.alert({
        content: message || L._('Action not allowed :('),
        level: 'error',
      })
    } else if (status === 412) {
      const msg = L._(
        'Woops! Someone else seems to have edited the data. You can save anyway, but this will erase the changes made by others.'
      )
      const actions = [
        {
          label: L._('Save anyway'),
          callback: function () {
            // TODO
            delete settings.headers['If-Match']
            this._fetch(settings)
          },
        },
        {
          label: L._('Cancel'),
        },
      ]
      this.ui.alert({
        content: msg,
        level: 'error',
        duration: 100000,
        actions: actions,
      })
    }
  },
})
