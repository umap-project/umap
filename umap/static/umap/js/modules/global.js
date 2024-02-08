import * as L from '../../vendors/leaflet/leaflet-src.esm.js'
import URLs from './urls.js'
import Browser from './browser.js'
import { Request, ServerRequest, RequestError, HTTPError, NOKError } from './request.js'
// Import modules and export them to the global scope.
// For the not yet module-compatible JS out there.

// Copy the leaflet module, it's expected by leaflet plugins to be writeable.
window.L = { ...L }
window.U = { URLs, Request, ServerRequest, RequestError, HTTPError, NOKError, Browser }
