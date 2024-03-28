U.DataLayerPermissions = L.Class.extend({
  options: {
    edit_status: null,
  },

  initialize: function (datalayer) {
    this.options = L.Util.setOptions(this, datalayer.options.permissions)
    this.datalayer = datalayer
    let isDirty = false
    const self = this
    try {
      Object.defineProperty(this, 'isDirty', {
        get: function () {
          return isDirty
        },
        set: function (status) {
          isDirty = status
          if (status) self.datalayer.isDirty = status
        },
      })
    } catch (e) {
      // Certainly IE8, which has a limited version of defineProperty
    }
  },

  getMap: function () {
    return this.datalayer.map
  },

  edit: function (container) {
    const fields = [
        [
          'options.edit_status',
          {
            handler: 'IntSelect',
            label: L._('Who can edit "{layer}"', { layer: this.datalayer.getName() }),
            selectOptions: this.datalayer.map.options.datalayer_edit_statuses,
          },
        ],
      ],
      builder = new U.FormBuilder(this, fields, {
        className: 'umap-form datalayer-permissions',
      }),
      form = builder.build()
    container.appendChild(form)
  },

  getUrl: function () {
    return U.Utils.template(this.datalayer.map.options.urls.datalayer_permissions, {
      map_id: this.datalayer.map.options.umap_id,
      pk: this.datalayer.umap_id,
    })
  },
  save: async function () {
    if (!this.isDirty) return this.datalayer.map.continueSaving()
    const formData = new FormData()
    formData.append('edit_status', this.options.edit_status)
    const [data, response, error] = await this.datalayer.map.server.post(
      this.getUrl(),
      {},
      formData
    )
    if (!error) {
      this.commit()
      this.isDirty = false
      this.datalayer.map.continueSaving()
    }
  },

  commit: function () {
    L.Util.extend(this.datalayer.options.permissions, this.options)
  },
})
