const PONG_TIMEOUT = 5000
const PING_INTERVAL = 30000
const FIRST_CONNECTION_TIMEOUT = 2000

export class WebSocketTransport {
  constructor(messagesReceiver) {
    this.receiver = messagesReceiver
  }

  async connect(webSocketURI, authToken, peerId, username) {
    return new Promise((resolve, reject) => {
      this.websocket = new WebSocket(webSocketURI)

      this.websocket.onopen = () => {
        this.send('JoinRequest', { token: authToken, peer: peerId, username })
        resolve(this.websocket)
      }
      this.websocket.addEventListener('message', this.onMessage.bind(this))
      this.websocket.onclose = () => {
        console.log('websocket closed')
        if (!this.receiver.closeRequested) {
          console.log('Not requested, reconnecting...')
          this.receiver.reconnect()
        }
      }

      this.websocket.onerror = (error) => {
        console.log('WS ERROR', error)
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
          console.log('sending ping')
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
    })
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
    console.log('Closing')
    this.receiver.closeRequested = true
    this.websocket.close()
  }

  get isOpen() {
    return this.websocket?.readyState === WebSocket.OPEN
  }
}
