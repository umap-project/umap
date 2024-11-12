import { DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import { uMapAlert as Alert } from '../components/alerts/alert.js'
import { ServerStored } from './saving.js'
import * as Utils from './utils.js'

// Dedicated object so we can deal with a separate dirty status, and thus
// call the endpoint only when needed, saving one call at each save.
export class MapPermissions extends ServerStored {
  constructor(umap) {
    super()
    this.setOptions(umap.properties.permissions)
    this.umap = umap
    this._isDirty = false
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
    return Boolean(this.umap.properties.user?.is_owner)
  }

  isAnonymousMap() {
    return !this.umap.properties.permissions.owner
  }

  _editAnonymous(container) {
    const fields = []
    if (this.isOwner()) {
      fields.push([
        'options.edit_status',
        {
          handler: 'IntSelect',
          label: translate('Who can edit'),
          selectOptions: this.umap.properties.edit_statuses,
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

      if (this.umap.properties.user?.id) {
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
          selectOptions: this.umap.properties.edit_statuses,
        },
      ])
      topFields.push([
        'options.share_status',
        {
          handler: 'IntSelect',
          label: translate('Who can view'),
          selectOptions: this.umap.properties.share_statuses,
        },
      ])
      collaboratorsFields.push([
        'options.owner',
        { handler: 'ManageOwner', label: translate("Map's owner") },
      ])
      if (this.umap.properties.user?.teams?.length) {
        collaboratorsFields.push([
          'options.team',
          {
            handler: 'ManageTeam',
            label: translate('Attach map to a team'),
            teams: this.umap.properties.user.teams,
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
    if (this.umap.hasLayers()) {
      const fieldset = Utils.loadTemplate(
        `<fieldset class="separator"><legend>${translate('Datalayers')}</legend></fieldset>`
      )
      container.appendChild(fieldset)
      this.umap.eachDataLayer((datalayer) => {
        datalayer.permissions.edit(fieldset)
      })
    }
  }

  edit() {
    if (this.umap.properties.editMode !== 'advanced') return
    if (!this.umap.properties.umap_id) {
      Alert.info(translate('Please save the map first'))
      return
    }
    const container = DomUtil.create('div', 'permissions-panel')
    DomUtil.createTitle(container, translate('Update permissions'), 'icon-key')
    if (this.isAnonymousMap()) this._editAnonymous(container)
    else this._editWithOwner(container)
    this._editDatalayers(container)
    this.umap.editPanel.open({ content: container, className: 'dark' })
  }

  async attach() {
    const [data, response, error] = await this.umap.server.post(this.getAttachUrl())
    if (!error) {
      this.options.owner = this.umap.properties.user
      Alert.success(translate('Map has been attached to your account'))
      this.umap.editPanel.close()
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
    const [data, response, error] = await this.umap.server.post(
      this.getUrl(),
      {},
      formData
    )
    if (!error) {
      this.commit()
      return true
    }
  }

  getUrl() {
    return this.umap.urls.get('map_update_permissions', {
      map_id: this.umap.properties.umap_id,
    })
  }

  getAttachUrl() {
    return this.umap.urls.get('map_attach_owner', {
      map_id: this.umap.properties.umap_id,
    })
  }

  commit() {
    this.umap.properties.permissions = Object.assign(
      {},
      this.umap.properties.permissions,
      this.options
    )
  }

  getShareStatusDisplay() {
    if (this.umap.properties.share_statuses) {
      return Object.fromEntries(this.umap.properties.share_statuses)[
        this.options.share_status
      ]
    }
  }
}

export class DataLayerPermissions extends ServerStored {
  constructor(datalayer) {
    super()
    this.options = Object.assign(
      {
        edit_status: null,
      },
      datalayer.options.permissions
    )

    this.datalayer = datalayer
  }

  get umap() {
    return this.datalayer.umap
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
          selectOptions: this.umap.properties.datalayer_edit_statuses,
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
    return this.umap.urls.get('datalayer_permissions', {
      map_id: this.umap.properties.umap_id,
      pk: this.datalayer.umap_id,
    })
  }

  async save() {
    if (!this.isDirty) return
    const formData = new FormData()
    formData.append('edit_status', this.options.edit_status)
    const [data, response, error] = await this.umap.server.post(
      this.getUrl(),
      {},
      formData
    )
    if (!error) {
      this.commit()
      return true
    }
  }

  commit() {
    this.datalayer.options.permissions = Object.assign(
      {},
      this.datalayer.options.permissions,
      this.options
    )
  }
}
