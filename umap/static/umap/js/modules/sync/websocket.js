export class WebSocketTransport {
  constructor(webSocketURI, authToken, messagesReceiver) {
    this.websocket = new WebSocket(webSocketURI)
    this.websocket.onopen = () => {
      this.send('join', { token: authToken })
    }
    this.websocket.addEventListener('message', this.onMessage.bind(this))
    this.receiver = messagesReceiver
  }

  onMessage(wsMessage) {
    // XXX validate incoming data.
    this.receiver.dispatch(JSON.parse(wsMessage.data))
  }

  send(kind, payload) {
    const message = { ...payload }
    message.kind = kind
    let encoded = JSON.stringify(message)
    this.websocket.send(encoded)
  }

  close() {
    this.websocket.close()
  }
}
