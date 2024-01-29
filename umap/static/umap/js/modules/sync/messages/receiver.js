import { MapUpdater } from "../updaters/mapUpdater.js"
import { LayerGroupUpdater } from "../updaters/layerGroupUpdater.js"


// FIXME: Maybe name this MessagesDispatcher ?
export class MessagesReceiver {
    
    constructor(map){
        this.updaters = {
            map: new MapUpdater(map),
            layers: new LayerGroupUpdater(map)
        }
    }

    dispatch(message){
        // FIXME if message.subject not in this.updaters: throw
        console.log("message", message)
        const updater = this.updaters[message.subject]
        switch(message.action){
            case "set-data":
                updater.setData(message)
        }
    }
}
