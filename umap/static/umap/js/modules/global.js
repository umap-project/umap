import URLs from './urls.js'
import Browser from './browser.js'
import * as Utils from './utils.js'
import { Request, ServerRequest, RequestError, HTTPError, NOKError } from './request.js'

// Import modules and export them to the global scope.
// For the not yet module-compatible JS out there.

// Copy the leaflet module, it's expected by leaflet plugins to be writeable.
window.U = {
  URLs,
  Request,
  ServerRequest,
  RequestError,
  HTTPError,
  NOKError,
  Browser,
  Utils,
}
