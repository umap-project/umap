import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { translate } from '../i18n.js'

const PONG_TIMEOUT = 5000
const PING_INTERVAL = 30000
const FIRST_CONNECTION_TIMEOUT = 2000

export class WebSocketTransport {
  constructor(webSocketURI, authToken, messagesReceiver, peerId, username) {
    this.receiver = messagesReceiver

    this.websocket = new WebSocket(webSocketURI)

    this.websocket.onopen = () => {
      this.send('JoinRequest', { token: authToken, peer: peerId, username })
      this.receiver.onConnection()
    }
    this.websocket.addEventListener('message', this.onMessage.bind(this))
    this.websocket.onclose = () => {
      console.debug('websocket closed')
      if (!this.receiver.closeRequested) {
        Alert.info(
          translate(
            'This map has enabled real-time synchronization with other users, but you are currently disconnected. We will try to reconnect in the background and reconcile with other users, but this feature is still experimental, and you might lose data. Have fun!'
          )
        )
        console.debug('Not requested, reconnecting...')
        this.receiver.reconnect()
      }
    }

    this.websocket.onerror = (error) => {
      console.debug('WS ERROR', error)
    }

    this.ensureOpen = setInterval(() => {
      if (this.websocket.readyState !== WebSocket.OPEN) {
        this.websocket.close()
        clearInterval(this.ensureOpen)
      }
    }, FIRST_CONNECTION_TIMEOUT)

    // To ensure the connection is still alive, we send ping and expect pong back.
    // Websocket provides a `ping` method to keep the connection alive, but it's
    // unfortunately not possible to access it from the WebSocket object.
    // See https://making.close.com/posts/reliable-websockets/ for more details.
    this.pingInterval = setInterval(() => {
      if (this.websocket.readyState === WebSocket.OPEN) {
        console.debug('sending ping')
        this.websocket.send('ping')
        this.pongReceived = false
        setTimeout(() => {
          if (!this.pongReceived) {
            console.warn('No pong received, reconnecting...')
            this.websocket.close()
            clearInterval(this.pingInterval)
          }
        }, PONG_TIMEOUT)
      }
    }, PING_INTERVAL)
  }

  onMessage(wsMessage) {
    if (wsMessage.data === 'pong') {
      this.pongReceived = true
    } else {
      this.receiver.receive(JSON.parse(wsMessage.data))
    }
  }

  send(kind, payload) {
    const message = { ...payload }
    message.kind = kind
    const encoded = JSON.stringify(message)
    this.websocket.send(encoded)
  }

  close() {
    console.debug('Closing')
    this.receiver.closeRequested = true
    this.websocket.close()
  }
}
