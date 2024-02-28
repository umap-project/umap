import URLs from './urls.js'
import Browser from './browser.js'
import * as Utils from './utils.js'
import {SCHEMA} from './schema.js'
import { Request, ServerRequest, RequestError, HTTPError, NOKError } from './request.js'

// Import modules and export them to the global scope.
// For the not yet module-compatible JS out there.

window.U = {
  URLs,
  Request,
  ServerRequest,
  RequestError,
  HTTPError,
  NOKError,
  Browser,
  Utils,
  SCHEMA,
}
