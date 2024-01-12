/**
 * A mixin to ease the rendering of the data, and updating of a local CRDT.
 *
 * The mixed class needs to expose:
 *
 * - `dataUpdaters`, an object matching each property with a list of renderers.
 * - `getDataObject`, a method returning where the data is stored/retrieved.
 */
L.U.DataRendererMixin = {
  populateCRDT: function () {
    for (const [key, value] of Object.entries(this.options)) {
      this.crdt.set(key, value)
    }
  },
  /**
   * For each passed property, find the functions to rerender the interface,
   * and call them.
   *
   * @param list updatedProperties : properties that have been updated.
   */
  renderProperties: function (updatedProperties) {
    console.debug(updatedProperties)
    let renderers = new Set()
    for (const prop of updatedProperties) {
      const propRenderers = this.dataUpdaters[prop]
      if (propRenderers) {
        for (const renderer of propRenderers) renderers.add(renderer)
      }
    }
    console.debug('renderers', renderers)
    for (const renderer of renderers) this[renderer]()
  },

  dataReceived: function () {
    // Data has been received over the wire
    this.updateInternalData()
    this.onPropertiesUpdated(['name', 'color'])
  },
}

L.U.FormBuilderDataRendererMixin = {
  getDataObject: function () {
    return this.options
  },
}
