import * as L from '../../vendors/leaflet/leaflet-src.esm.js'

// Exposes the modules to the window global scope, it's expected by leaflet plugins
// in a writeable form.
window.L = { ...L }
