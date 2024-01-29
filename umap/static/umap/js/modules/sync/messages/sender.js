import { SetDataMessage } from "./messages.js"

export class MessagesSender {
    constructor(subject, transport){
        this._transport = transport
        this._subject = subject
    }

    set(key, value){
        let message = new SetDataMessage(this._subject, key, value)
        console.log("message obj", message, message.encode())
        this._transport.send(message)
    }
}
