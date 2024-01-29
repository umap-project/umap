import { decodeMessage } from "./messages/messages.js";

export class WebSocketTransport {
    constructor(messagesReceiver){
        this.id = crypto.randomUUID()
        this.websocket = new WebSocket("ws://localhost:8001/");
        this.websocket.onopen = (msg) => {this.onOpen(msg)}
        this.websocket.addEventListener("message", this.onMessage.bind(this));
        this.receiver = messagesReceiver
    }

    onOpen(msg){
        var joinMsg = {type: 'join'}
        console.log("joining websocket")
        this.websocket.send(JSON.stringify(joinMsg))
    }

    onMessage(encoded){
        console.log("received encoded message", encoded)
        let message = decodeMessage(encoded.data)
        this.receiver.dispatch(message)
    }

    send(message){
        let encoded = message.encode()
        this.websocket.send(encoded)
    }
}