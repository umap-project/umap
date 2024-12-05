import { uMapAlert as Alert } from '../components/alerts/alert.js'
import { AjaxAutocomplete, AjaxAutocompleteMultiple, AutocompleteDatalist } from './autocomplete.js'
import Help from './help.js'
import { ServerRequest } from './request.js'
import { SCHEMA } from './schema.js'
import * as Utils from './utils.js'
import * as Icon from './rendering/icon.js'
import { LAYER_TYPES } from './data/layer.js'
import { Point, LineString, Polygon } from './data/features.js'
import { LeafletMarker, LeafletPolyline, LeafletPolygon } from './rendering/ui.js'

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
