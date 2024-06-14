import URLs from './urls.js'
import Browser from './browser.js'
import Facets from './facets.js'
import Caption from './caption.js'
import { Panel, EditPanel, FullPanel } from './ui/panel.js'
import Dialog from './ui/dialog.js'
import Tooltip from './ui/tooltip.js'
import Rules from './rules.js'
import * as Utils from './utils.js'
import { SCHEMA } from './schema.js'
import { Request, ServerRequest, RequestError, HTTPError, NOKError } from './request.js'
import { AjaxAutocomplete, AjaxAutocompleteMultiple } from './autocomplete.js'
import Orderable from './orderable.js'
import Importer from './importer.js'
import Help from './help.js'
import { SyncEngine } from './sync/engine.js'
import {
  uMapAlert as Alert,
  uMapAlertCreation as AlertCreation,
  uMapAlertConflict as AlertConflict,
} from '../components/alerts/alert.js'

// Import modules and export them to the global scope.
// For the not yet module-compatible JS out there.

// By alphabetic order
window.U = {
  Alert,
  AlertCreation,
  AlertConflict,
  AjaxAutocomplete,
  AjaxAutocompleteMultiple,
  Browser,
  Caption,
  Dialog,
  EditPanel,
  Facets,
  FullPanel,
  Help,
  HTTPError,
  Importer,
  NOKError,
  Orderable,
  Panel,
  Request,
  RequestError,
  Rules,
  SCHEMA,
  ServerRequest,
  SyncEngine,
  Tooltip,
  URLs,
  Utils,
}
