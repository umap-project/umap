import { uMapAlert as Alert } from '../components/alerts/alert.js'
import { translate } from './i18n.js'

export class RequestError extends Error {}

export class HTTPError extends RequestError {
  constructor(message) {
    super(message)
    this.name = this.constructor.name
  }
}

export class NOKError extends RequestError {
  constructor(response) {
    super(response.status)
    this.response = response
    this.status = response.status
    this.name = this.constructor.name
  }
}

class BaseRequest {
  async _fetch(method, uri, headers, data) {
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
      throw new HTTPError(error.message)
    }
    if (!response.ok) {
      throw new NOKError(response)
    }

    return response
  }
}

// Basic class to issue request
// It returns a response, or null in case of error
// In case of error, an alert is sent, but non 20X status are not handled
// The consumer must check the response status by hand
export class Request extends BaseRequest {
  fire(name, detail) {
    document.body.dispatchEvent(new CustomEvent(name, { detail }))
  }

  async _fetch(method, uri, headers, data) {
    const id = Math.random()
    this.fire('dataloading', { id: id })
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
      if (error instanceof NOKError) return this._onNOK(error)
      return this._onError(error)
    } finally {
      this.fire('dataload', { id: id })
    }
  }

  async get(uri, headers) {
    return await this._fetch('GET', uri, headers)
  }

  async post(uri, headers, data) {
    return await this._fetch('POST', uri, headers, data)
  }

  _onError(error) {
    Alert.error(translate('Problem in the response'))
  }

  _onNOK(error) {
    this._onError(error)
    return error.response
  }
}

// Adds uMap specifics to requests handling
// like logging, CSRF, etc.
// It expects only json responses.
// Returns an array of three elements: [data, response, error]
// The consumer must check the error to proceed or not with using the data or response
export class ServerRequest extends Request {
  async _fetch(method, uri, headers, data) {
    // Add a flag so backend can know we are in ajax and adapt the response
    // See is_ajax in utils.py
    headers = headers || {}
    headers['X-Requested-With'] = 'XMLHttpRequest'
    return await Request.prototype._fetch.call(this, method, uri, headers, data)
  }

  async post(uri, headers, data) {
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
  }

  async get(uri, headers) {
    const response = await Request.prototype.get.call(this, uri, headers)
    return await this._as_json(response)
  }

  async _as_json(response) {
    if (Array.isArray(response)) return response
    try {
      const data = await response.json()
      if (data.info) {
        Alert.info(data.info)
      } else if (data.error) {
        Alert.error(data.error)
        return this._onError(new Error(data.error))
      }
      return [data, response, null]
    } catch (error) {
      return this._onError(error)
    }
  }

  _onError(error) {
    return [{}, null, error]
  }

  _onNOK(error) {
    if (error.status === 403) {
      Alert.error(error.message || translate('Action not allowed :('))
    } else {
      super._onError(error)
    }
    return [{}, error.response, error]
  }
}
