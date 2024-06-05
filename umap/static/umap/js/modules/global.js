import URLs from './urls.js'
import Browser from './browser.js'
import Facets from './facets.js'
import Caption from './caption.js'
import { Panel, EditPanel, FullPanel } from './ui/panel.js'
import Alert from './ui/alert.js'
import Dialog from './ui/dialog.js'
import Tooltip from './ui/tooltip.js'
import * as Utils from './utils.js'
import { SCHEMA } from './schema.js'
import { Request, ServerRequest, RequestError, HTTPError, NOKError } from './request.js'
import { AjaxAutocomplete, AjaxAutocompleteMultiple } from './autocomplete.js'
import Orderable from './orderable.js'
import Importer from './importer.js'
import Help from './help.js'

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
  Alert,
  Dialog,
  Tooltip,
  EditPanel,
  FullPanel,
  Utils,
  SCHEMA,
  Importer,
  Orderable,
  Caption,
  AjaxAutocomplete,
  AjaxAutocompleteMultiple,
  Help,
}
