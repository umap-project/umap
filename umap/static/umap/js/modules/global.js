import * as L from '../../vendors/leaflet/leaflet-src.esm.js'
import * as Y from '../../vendors/yjs/yjs.js'
import URLs from './urls.js'
// Import modules and export them to the global scope.
// For the not yet module-compatible JS out there.

// Copy the leaflet module, it's expected by leaflet plugins to be writeable.
window.L = { ...L }

window.Y = Y
window.umap = { URLs }
