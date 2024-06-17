export class WebSocketTransport {
  constructor(webSocketURI, authToken, messagesReceiver) {
    this.websocket = new WebSocket(webSocketURI)
    this.websocket.onopen = () => {
      this.send('JoinRequest', { token: authToken })
    }
    this.websocket.addEventListener('message', this.onMessage.bind(this))
    this.receiver = messagesReceiver
  }

  onMessage(wsMessage) {
    this.receiver.receive(JSON.parse(wsMessage.data))
  }

  send(kind, payload) {
    const message = { ...payload }
    message.kind = kind
    const encoded = JSON.stringify(message)
    this.websocket.send(encoded)
  }

  close() {
    this.websocket.close()
  }
}
