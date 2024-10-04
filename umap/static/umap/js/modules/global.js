import {
  uMapAlert as Alert,
  uMapAlertCreation as AlertCreation,
} from '../components/alerts/alert.js'
import {
  AjaxAutocomplete,
  AjaxAutocompleteMultiple,
  AutocompleteDatalist,
} from './autocomplete.js'
import Browser from './browser.js'
import Caption from './caption.js'
import ContextMenu from './ui/contextmenu.js'
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
import Tooltip from './ui/tooltip.js'
import URLs from './urls.js'
import * as Utils from './utils.js'
import * as Icon from './rendering/icon.js'
import { DataLayer, LAYER_TYPES } from './data/layer.js'
import { DataLayerPermissions, MapPermissions } from './permissions.js'
import { Point, LineString, Polygon } from './data/features.js'
import { LeafletMarker, LeafletPolyline, LeafletPolygon } from './rendering/ui.js'

// Import modules and export them to the global scope.
// For the not yet module-compatible JS out there.

// By alphabetic order
window.U = {
  Alert,
  AlertCreation,
  AjaxAutocomplete,
  AjaxAutocompleteMultiple,
  AutocompleteDatalist,
  Browser,
  Caption,
  ContextMenu,
  DataLayer,
  DataLayerPermissions,
  Dialog,
  EditPanel,
  Facets,
  Formatter,
  FullPanel,
  Help,
  HTTPError,
  Icon,
  Importer,
  LAYER_TYPES,
  LeafletMarker,
  LeafletPolygon,
  LeafletPolyline,
  LineString,
  MapPermissions,
  NOKError,
  Orderable,
  Panel,
  Point,
  Polygon,
  Request,
  RequestError,
  Rules,
  SCHEMA,
  ServerRequest,
  Share,
  Slideshow,
  SyncEngine,
  Tooltip,
  URLs,
  Utils,
}
