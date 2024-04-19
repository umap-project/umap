import URLs from './urls.js'
import Browser from './browser.js'
import Facets from './facets.js'
import { Panel, EditPanel, FullPanel } from './panel.js'
import * as Utils from './utils.js'
import { SCHEMA } from './schema.js'
import { Request, ServerRequest, RequestError, HTTPError, NOKError } from './request.js'
import Orderable from './orderable.js'

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
  Facets,
  Panel,
  EditPanel,
  FullPanel,
  Utils,
  SCHEMA,
  Orderable,
}
