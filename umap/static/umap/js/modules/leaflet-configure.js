import * as L from '../../vendors/leaflet/leaflet-src.esm.js'
// Comes from https://github.com/Leaflet/Leaflet/pull/9281
// TODELETE once it's merged!
import * as i18n from './i18n.js'

window.L = { ...L, ...i18n }
window.L._ = i18n.translate
