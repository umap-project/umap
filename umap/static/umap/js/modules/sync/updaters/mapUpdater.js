// all the updaters have the same interface
// .setData() which should rerender the object.

export class FormBuilderObjectUpdater{
    constructor(obj){
        this.obj = obj
    }

    setData(message){
        console.log(message)
        // FIXME, this is the simple version
        // Need to support subobjects, see https://github.com/yohanboniface/Leaflet.FormBuilder/blob/master/Leaflet.FormBuilder.js#L70-L86
        this.obj.options[message.path] = message.value

        // FIXME, this needs to be rendered only once if possible, accross different updates.
        // (not sure how)
        this.obj.renderProperties([message.path])
    }
}

export class MapUpdater extends FormBuilderObjectUpdater {
    
}
