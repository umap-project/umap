import { DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import { uMapAlert as Alert } from '../components/alerts/alert.js'
import * as Utils from './utils.js'

// Dedicated object so we can deal with a separate dirty status, and thus
// call the endpoint only when needed, saving one call at each save.
export class MapPermissions {
  constructor(map) {
    this.setOptions(map.options.permissions)
    this.map = map
    this._isDirty = false
  }

  set isDirty(status) {
    this._isDirty = status
    if (status) this.map.isDirty = status
  }

  get isDirty() {
    return this._isDirty
  }

  setOptions(options) {
    this.options = Object.assign(
      {
        owner: null,
        team: null,
        editors: [],
        share_status: null,
        edit_status: null,
      },
      options
    )
  }

  isOwner() {
    return Boolean(this.map.options.user?.is_owner)
  }

  isAnonymousMap() {
    return !this.map.options.permissions.owner
  }

  _editAnonymous(container) {
    const fields = []
    if (this.isOwner()) {
      fields.push([
        'options.edit_status',
        {
          handler: 'IntSelect',
          label: translate('Who can edit'),
          selectOptions: this.map.options.edit_statuses,
        },
      ])
      const builder = new U.FormBuilder(this, fields)
      const form = builder.build()
      container.appendChild(form)

      if (this.options.anonymous_edit_url) {
        DomUtil.createCopiableInput(
          container,
          translate('Secret edit link:'),
          this.options.anonymous_edit_url
        )
      }

      if (this.map.options.user?.id) {
        // We have a user, and this user has come through here, so they can edit the map, so let's allow to own the map.
        // Note: real check is made on the back office anyway.
        const advancedActions = DomUtil.createFieldset(
          container,
          translate('Advanced actions')
        )
        const advancedButtons = DomUtil.create('div', 'button-bar', advancedActions)
        DomUtil.createButton(
          'button',
          advancedButtons,
          translate('Attach the map to my account'),
          this.attach,
          this
        )
      }
    }
  }

  _editWithOwner(container) {
    const topFields = []
    const collaboratorsFields = []
    const fieldset = Utils.loadTemplate(
      `<fieldset class="separator"><legend>${translate('Map')}</legend></fieldset>`
    )
    container.appendChild(fieldset)
    if (this.isOwner()) {
      topFields.push([
        'options.edit_status',
        {
          handler: 'IntSelect',
          label: translate('Who can edit'),
          selectOptions: this.map.options.edit_statuses,
        },
      ])
      topFields.push([
        'options.share_status',
        {
          handler: 'IntSelect',
          label: translate('Who can view'),
          selectOptions: this.map.options.share_statuses,
        },
      ])
      collaboratorsFields.push([
        'options.owner',
        { handler: 'ManageOwner', label: translate("Map's owner") },
      ])
      if (this.map.options.user?.teams?.length) {
        collaboratorsFields.push([
          'options.team',
          {
            handler: 'ManageTeam',
            label: translate('Attach map to a team'),
            teams: this.map.options.user.teams,
          },
        ])
      }
    }
    collaboratorsFields.push([
      'options.editors',
      { handler: 'ManageEditors', label: translate("Map's editors") },
    ])

    const builder = new U.FormBuilder(this, topFields)
    const form = builder.build()
    container.appendChild(form)
    if (collaboratorsFields.length) {
      const fieldset = Utils.loadTemplate(
        `<fieldset class="separator"><legend>${translate('Manage collaborators')}</legend></fieldset>`
      )
      container.appendChild(fieldset)
      const builder = new U.FormBuilder(this, collaboratorsFields)
      const form = builder.build()
      container.appendChild(form)
    }
  }

  _editDatalayers(container) {
    if (this.map.hasLayers()) {
      const fieldset = Utils.loadTemplate(
        `<fieldset class="separator"><legend>${translate('Datalayers')}</legend></fieldset>`
      )
      container.appendChild(fieldset)
      this.map.eachDataLayer((datalayer) => {
        datalayer.permissions.edit(fieldset)
      })
    }
  }

  edit() {
    if (this.map.options.editMode !== 'advanced') return
    if (!this.map.options.umap_id) {
      Alert.info(translate('Please save the map first'))
      return
    }
    const container = DomUtil.create('div', 'permissions-panel')
    DomUtil.createTitle(container, translate('Update permissions'), 'icon-key')
    if (this.isAnonymousMap()) this._editAnonymous(container)
    else this._editWithOwner(container)
    this._editDatalayers(container)
    this.map.editPanel.open({ content: container, className: 'dark' })
  }

  async attach() {
    const [data, response, error] = await this.map.server.post(this.getAttachUrl())
    if (!error) {
      this.options.owner = this.map.options.user
      Alert.success(translate('Map has been attached to your account'))
      this.map.editPanel.close()
    }
  }

  async save() {
    if (!this.isDirty) return
    const formData = new FormData()
    if (!this.isAnonymousMap() && this.options.editors) {
      const editors = this.options.editors.map((u) => u.id)
      for (let i = 0; i < this.options.editors.length; i++)
        formData.append('editors', this.options.editors[i].id)
    }
    if (this.isOwner() || this.isAnonymousMap()) {
      formData.append('edit_status', this.options.edit_status)
    }
    if (this.isOwner()) {
      formData.append('owner', this.options.owner?.id)
      formData.append('team', this.options.team?.id || '')
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
      this.map.fire('postsync')
    }
  }

  getUrl() {
    return Utils.template(this.map.options.urls.map_update_permissions, {
      map_id: this.map.options.umap_id,
    })
  }

  getAttachUrl() {
    return Utils.template(this.map.options.urls.map_attach_owner, {
      map_id: this.map.options.umap_id,
    })
  }

  commit() {
    this.map.options.permissions = Object.assign(
      this.map.options.permissions,
      this.options
    )
  }

  getShareStatusDisplay() {
    if (this.map.options.share_statuses) {
      return Object.fromEntries(this.map.options.share_statuses)[
        this.options.share_status
      ]
    }
  }
}

export class DataLayerPermissions {
  constructor(datalayer) {
    this.options = Object.assign(
      {
        edit_status: null,
      },
      datalayer.options.permissions
    )

    this.datalayer = datalayer
    this._isDirty = false
  }

  set isDirty(status) {
    this._isDirty = status
    if (status) this.datalayer.isDirty = status
  }

  get isDirty() {
    return this._isDirty
  }

  get map() {
    return this.datalayer.map
  }

  edit(container) {
    const fields = [
      [
        'options.edit_status',
        {
          handler: 'IntSelect',
          label: translate('Who can edit "{layer}"', {
            layer: this.datalayer.getName(),
          }),
          selectOptions: this.map.options.datalayer_edit_statuses,
        },
      ],
    ]
    const builder = new U.FormBuilder(this, fields, {
      className: 'umap-form datalayer-permissions',
    })
    const form = builder.build()
    container.appendChild(form)
  }

  getUrl() {
    return this.map.urls.get('datalayer_permissions', {
      map_id: this.map.options.umap_id,
      pk: this.datalayer.umap_id,
    })
  }

  async save() {
    if (!this.isDirty) return
    const formData = new FormData()
    formData.append('edit_status', this.options.edit_status)
    const [data, response, error] = await this.map.server.post(
      this.getUrl(),
      {},
      formData
    )
    if (!error) {
      this.commit()
      this.isDirty = false
    }
  }

  commit() {
    this.datalayer.options.permissions = Object.assign(
      this.datalayer.options.permissions,
      this.options
    )
  }
}
