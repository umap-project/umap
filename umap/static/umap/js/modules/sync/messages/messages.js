export class BaseMessage {
    // Possible actions:
    // - set-obj-data
    // - new-layer
    constructor(action, subject, path, value){
        this.action = action
        this.subject = subject
        this.path = path
        this.value = value
    }

    encode(){
        return encodeMessage({
            action: this.action,
            subject: this.subject,
            path: this.path,
            value: this.value
        })
    }

    decode(encoded){
        return decodeMessage(encoded)
    }
}

export class SetDataMessage extends BaseMessage{
    constructor(subject, path, value){
        super("set-data", subject, path, value)
    }
}

export class NewLayer extends BaseMessage{
    constructor(subject, path, value){
        super("new-layer", subject, path, value)
    }
}


export function encodeMessage(payload, type="message"){
    return JSON.stringify({
        type: type,
        payload: payload
    })
}

export function decodeMessage(encodedData){
    console.log("encoded message", encodedData)
    // XXX Ensure the data matches what we expect here.
    let parsed = JSON.parse(encodedData)
    console.log(parsed)
    switch(parsed.payload.action){
        case 'set-data':
            let {subject, path, value} = parsed.payload
            return new SetDataMessage(subject, path, value)
    }
}