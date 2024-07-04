import {
  uMapAlert as Alert,
  uMapAlertConflict as AlertConflict,
  uMapAlertCreation as AlertCreation,
} from '../components/alerts/alert.js'
import { AjaxAutocomplete, AjaxAutocompleteMultiple, AutocompleteDatalist } from './autocomplete.js'
import Browser from './browser.js'
import Caption from './caption.js'
import Facets from './facets.js'
import { Formatter } from './formatter.js'
import Help from './help.js'
import Importer from './importer.js'
import Orderable from './orderable.js'
import { HTTPError, NOKError, Request, RequestError, ServerRequest } from './request.js'
import Rules from './rules.js'
import { SCHEMA } from './schema.js'
import Share from './share.js'
import Slideshow from './slideshow.js'
import { SyncEngine } from './sync/engine.js'
import Dialog from './ui/dialog.js'
import { EditPanel, FullPanel, Panel } from './ui/panel.js'
import TableEditor from './tableeditor.js'
import Tooltip from './ui/tooltip.js'
import URLs from './urls.js'
import * as Utils from './utils.js'

// Import modules and export them to the global scope.
// For the not yet module-compatible JS out there.

// By alphabetic order
window.U = {
  Alert,
  AlertCreation,
  AlertConflict,
  AjaxAutocomplete,
  AjaxAutocompleteMultiple,
  AutocompleteDatalist,
  Browser,
  Caption,
  Dialog,
  EditPanel,
  Facets,
  Formatter,
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
  Share,
  Slideshow,
  SyncEngine,
  TableEditor,
  Tooltip,
  URLs,
  Utils,
}
