/**
 * A mixin to ease the rendering of the data, and updating of a local CRDT.
 *
 * The mixed class needs to expose:
 *
 * - `propertiesRenderers`, an object matching each property with a list of renderers.
 * - `getDataObject`, a method returning where the data is stored/retrieved.
 * - `getCRDT`, a method returning the CRDT used
 */
L.U.DataRendererMixin = {

  /**
   * Rerender the interface for the properties passed as an argument.
   * 
   * @param list properties : properties that have been updated.
   */
  renderProperties: function (properties) {
    let renderers = new Set()
    for (const prop of properties) {
      const propRenderers = this.propertiesRenderers[prop]
      if (propRenderers) {
        for (const renderer of propRenderers) {
          renderers.add(renderer)
        }
      }
    }

    // If no renderer has been found, use the default one.
    const hasDefault = Object.keys(this.propertiesRenderers).includes('default')
    const defaultRenderers = this.propertiesRenderers['default']

    if (hasDefault && renderers.size == 0) {
      for (const renderer of defaultRenderers) {
        renderers.add(renderer)
      }
    }

    for (const renderer of renderers) {
      if (renderer in this) {
        this[renderer](properties)
      }
    }

  },

}

// L.U.LWWMapDataRendereMixin = L.U.DataRendererMixin {
//   updateData: function(){
//     if (this.crdt) this.crdt.set(field, value)
//   }
// }

// L.U.FormBuilderDataRendererMixin = L.U.DataRendererMixin.extend({
//   getDataObject: function () {
//     return this.options
//   },
// })

