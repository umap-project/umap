export class WebSocketTransport {
    constructor(messagesReceiver) {
        this.id = crypto.randomUUID()
        this.websocket = new WebSocket("ws://localhost:8001/");
        this.websocket.onopen = () => { this.send("join", this.id) }
        this.websocket.addEventListener("message", this.onMessage.bind(this));
        this.receiver = messagesReceiver
    }

    onMessage(wsMessage) {
        // XXX validate incoming data.
        this.receiver.dispatch(JSON.parse(wsMessage.data))
    }

    send(kind, payload) {
        let encoded = JSON.stringify({ kind, payload })
        this.websocket.send(encoded)
    }
}