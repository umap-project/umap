import { uMapAlert as Alert } from '../components/alerts/alert.js'
import {
  AjaxAutocomplete,
  AjaxAutocompleteMultiple,
  AutocompleteDatalist,
} from './autocomplete.js'
import { LineString, Point, Polygon } from './data/features.js'
import { LAYER_TYPES } from './data/layer.js'
import Help from './help.js'
import * as Icon from './rendering/icon.js'
import { LeafletMarker, LeafletPolygon, LeafletPolyline } from './rendering/ui.js'
import { ServerRequest } from './request.js'
import { SCHEMA } from './schema.js'
import * as Utils from './utils.js'

// Import modules and export them to the global scope.
// For the not yet module-compatible JS out there.

// By alphabetic order
window.U = {
  Alert,
  AjaxAutocomplete,
  AjaxAutocompleteMultiple,
  AutocompleteDatalist,
  Help,
  Icon,
  LAYER_TYPES,
  LeafletMarker,
  LeafletPolygon,
  LeafletPolyline,
  LineString,
  Point,
  Polygon,
  SCHEMA,
  ServerRequest,
  Utils,
}
