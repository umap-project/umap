// Dedicated object so we can deal with a separate dirty status, and thus
// call the endpoint only when needed, saving one call at each save.
U.MapPermissions = L.Class.extend({
  options: {
    owner: null,
    editors: [],
    share_status: null,
    edit_status: null,
  },

  initialize: function (map) {
    this.setOptions(map.options.permissions)
    this.map = map
    let isDirty = false
    const self = this
    try {
      Object.defineProperty(this, 'isDirty', {
        get: function () {
          return isDirty
        },
        set: function (status) {
          isDirty = status
          if (status) {
            self.map.isDirty = status
          }
        },
      })
    } catch (e) {
      // Certainly IE8, which has a limited version of defineProperty
    }
  },

  setOptions: function (options) {
    this.options = L.Util.setOptions(this, options)
  },

  isOwner: function () {
    return (
      this.map.options.user &&
      this.map.options.permissions.owner &&
      this.map.options.user.id == this.map.options.permissions.owner.id
    )
  },

  isAnonymousMap: function () {
    return !this.map.options.permissions.owner
  },

  getMap: function () {
    return this.map
  },

  edit: function () {
    if (this.map.options.editMode !== 'advanced') return
    if (!this.map.options.umap_id) {
      return U.Alert.info(L._('Please save the map first'))
    }
    const container = L.DomUtil.create('div', 'permissions-panel')
    const fields = []
    L.DomUtil.createTitle(container, L._('Update permissions'), 'icon-key')
    if (this.isAnonymousMap()) {
      if (this.options.anonymous_edit_url) {
        const helpText = `${L._('Secret edit link:')}<br>${
          this.options.anonymous_edit_url
        }`
        L.DomUtil.element({
          tagName: 'p',
          className: 'help-text',
          innerHTML: helpText,
          parent: container,
        })
        fields.push([
          'options.edit_status',
          {
            handler: 'IntSelect',
            label: L._('Who can edit'),
            selectOptions: this.map.options.edit_statuses,
            helpText: helpText,
          },
        ])
      }
    } else {
      if (this.isOwner()) {
        fields.push([
          'options.edit_status',
          {
            handler: 'IntSelect',
            label: L._('Who can edit'),
            selectOptions: this.map.options.edit_statuses,
          },
        ])
        fields.push([
          'options.share_status',
          {
            handler: 'IntSelect',
            label: L._('Who can view'),
            selectOptions: this.map.options.share_statuses,
          },
        ])
        fields.push([
          'options.owner',
          { handler: 'ManageOwner', label: L._("Map's owner") },
        ])
      }
      fields.push([
        'options.editors',
        { handler: 'ManageEditors', label: L._("Map's editors") },
      ])
    }

    const builder = new U.FormBuilder(this, fields)
    const form = builder.build()
    container.appendChild(form)
    if (this.isAnonymousMap() && this.map.options.user) {
      // We have a user, and this user has come through here, so they can edit the map, so let's allow to own the map.
      // Note: real check is made on the back office anyway.
      const advancedActions = L.DomUtil.createFieldset(
        container,
        L._('Advanced actions')
      )
      const advancedButtons = L.DomUtil.create('div', 'button-bar', advancedActions)
      const download = L.DomUtil.createButton(
        'button',
        advancedButtons,
        L._('Attach the map to my account'),
        this.attach,
        this
      )
    }
    L.DomUtil.add('h4', '', container, L._('Datalayers'))
    this.map.eachDataLayer((datalayer) => {
      datalayer.permissions.edit(container)
    })
    this.map.editPanel.open({ content: container, className: 'dark' })
  },

  attach: async function () {
    const [data, response, error] = await this.map.server.post(this.getAttachUrl())
    if (!error) {
      this.options.owner = this.map.options.user
      U.Alert.success(L._('Map has been attached to your account'))
      this.map.editPanel.close()
    }
  },

  save: async function () {
    if (!this.isDirty) return this.map.continueSaving()
    const formData = new FormData()
    if (!this.isAnonymousMap() && this.options.editors) {
      const editors = this.options.editors.map((u) => u.id)
      for (let i = 0; i < this.options.editors.length; i++)
        formData.append('editors', this.options.editors[i].id)
    }
    if (this.isOwner() || this.isAnonymousMap())
      formData.append('edit_status', this.options.edit_status)
    if (this.isOwner()) {
      formData.append('owner', this.options.owner && this.options.owner.id)
      formData.append('share_status', this.options.share_status)
    }
    const [data, response, error] = await this.map.server.post(
      this.getUrl(),
      {},
      formData
    )
    if (!error) {
      this.commit()
      this.isDirty = false
      this.map.continueSaving()
      this.map.fire('postsync')
    }
  },

  getUrl: function () {
    return U.Utils.template(this.map.options.urls.map_update_permissions, {
      map_id: this.map.options.umap_id,
    })
  },

  getAttachUrl: function () {
    return U.Utils.template(this.map.options.urls.map_attach_owner, {
      map_id: this.map.options.umap_id,
    })
  },

  addOwnerLink: function (element, container) {
    if (this.options.owner && this.options.owner.name && this.options.owner.url) {
      const ownerContainer = L.DomUtil.add(
        element,
        'umap-map-owner',
        container,
        ` ${L._('by')} `
      )
      L.DomUtil.createLink(
        '',
        ownerContainer,
        this.options.owner.name,
        this.options.owner.url
      )
    }
  },

  commit: function () {
    L.Util.extend(this.map.options.permissions, this.options)
  },

  getShareStatusDisplay: function () {
    return Object.fromEntries(this.map.options.share_statuses)[
      this.options.share_status
    ]
  },
})
