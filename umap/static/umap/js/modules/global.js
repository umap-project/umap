import * as L from '../../vendors/leaflet/leaflet-src.esm.js'
import {MessagesSender} from './sync/messages/sender.js'
import {MessagesReceiver} from "./sync/messages/receiver.js"
import {WebSocketTransport} from './sync/websocket.js'

import URLs from './urls.js'

// Import modules and export them to the global scope.
// For the not yet module-compatible JS out there.

// Copy the leaflet module, it's expected by leaflet plugins to be writeable.
window.L = { ...L }

window.umap = { URLs, WebSocketTransport, MessagesReceiver, MessagesSender}

