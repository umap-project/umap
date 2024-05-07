import URLs from './urls.js'
import Browser from './browser.js'
import Facets from './facets.js'
import Caption from './caption.js'
import { Panel, EditPanel, FullPanel } from './panel.js'
import * as Utils from './utils.js'
import { SCHEMA } from './schema.js'
import { Request, ServerRequest, RequestError, HTTPError, NOKError } from './request.js'
import Orderable from './orderable.js'
import { SyncEngine } from './sync/engine.js'
// Import modules and export them to the global scope.
// For the not yet module-compatible JS out there.

// By alphabetic order
window.U = {
  Browser,
  Caption,
  EditPanel,
  Facets,
  FullPanel,
  HTTPError,
  NOKError,
  Orderable,
  Panel,
  Request,
  RequestError,
  SCHEMA,
  ServerRequest,
  SyncEngine,
  URLs,
  Utils,
}
