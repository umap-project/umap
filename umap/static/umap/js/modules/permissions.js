import { Alert } from '../components/alerts/alert.js'
import * as Clipboard from './clipboard.js'
import { MutatingForm } from './form/builder.js'
import { translate } from './i18n.js'
import * as Utils from './utils.js'
import * as DOMUtils from './domutils.js'

// Dedicated object so we can deal with a separate dirty status, and thus
// call the endpoint only when needed, saving one call at each save.
export class MapPermissions {
  constructor(app) {
    this.setProperties(app.properties.permissions)
    this.app = app
  }

  get journal() {
    if (!this._journal) {
      this._journal = this.app.journalEngine.proxy(this)
    }
    return this._journal
  }

  setProperties(properties) {
    this.properties = Object.assign(
      {
        owner: null,
        team: null,
        editors: [],
        share_status: null,
        edit_status: null,
      },
      properties
    )
  }

  getJournalMetadata() {
    return {
      subject: 'mappermissions',
      metadata: {},
    }
  }

  render() {
    this.app.render(['properties.permissions'])
  }

  isOwner() {
    return Boolean(this.app.properties.user?.is_owner)
  }

  isAnonymousMap() {
    return !this.properties.owner
  }

  isDraft() {
    return this.properties.share_status === 0
  }

  userIsAuth() {
    return Boolean(this.app.properties.user?.id)
  }

  async _editAnonymous(container) {
    if (this.isOwner()) {
      // We have a user, and this user has come through here, so they can edit the map, so let's allow to own the map.
      // Note: real check is made on the back office anyway.
      const template = `
          <div class="anonymous soft-round aplat">
            <h4><i class="icon icon-16 icon-anonymous"></i> ${translate('Anonymous map')}</h4>
            <div data-ref="copiableInput"></div>
            <p data-ref="p" hidden><button type="button" data-ref="button">${translate('Attach the map to my account')}</button></p>
          </div>
        `
      const [root, { button, copiableInput, p }] = Utils.loadTemplateWithRefs(template)
      container.appendChild(root)
      if (this.properties.anonymous_edit_url) {
        Clipboard.copiableInput(
          copiableInput,
          translate('Secret edit link:'),
          this.properties.anonymous_edit_url
        )
      }
      if (this.userIsAuth()) {
        button.addEventListener('click', () => this.attach())
        p.hidden = false
      }
      const fields = []
      fields.push([
        'properties.edit_status',
        {
          handler: 'IntSelect',
          label: translate('Who can edit'),
          selectOptions: this.app.properties.edit_statuses,
        },
      ])
      fields.push([
        'properties.share_status',
        {
          handler: 'IntSelect',
          label: translate('Who can view'),
          selectOptions: this.app.properties.share_statuses,
        },
      ])
      const builder = new MutatingForm(this, fields)
      const form = await builder.build()
      container.appendChild(form)
    }
  }

  async _editWithOwner(container) {
    const topFields = []
    const collaboratorsFields = []
    const fieldset = Utils.loadTemplate(
      `<fieldset class="separator"><legend>${translate('Map')}</legend></fieldset>`
    )
    container.appendChild(fieldset)
    if (this.isOwner()) {
      topFields.push([
        'properties.edit_status',
        {
          handler: 'IntSelect',
          label: translate('Who can edit'),
          selectOptions: this.app.properties.edit_statuses,
        },
      ])
      topFields.push([
        'properties.share_status',
        {
          handler: 'IntSelect',
          label: translate('Who can view'),
          selectOptions: this.app.properties.share_statuses,
        },
      ])
      collaboratorsFields.push([
        'properties.owner',
        {
          handler: 'ManageOwner',
          label: translate("Map's owner"),
          url: this.app.properties.urls.agnocomplete,
        },
      ])
      if (this.app.properties.user?.teams?.length) {
        collaboratorsFields.push([
          'properties.team',
          {
            handler: 'ManageTeam',
            label: translate('Attach map to a team'),
            teams: this.app.properties.user.teams,
          },
        ])
      }
    }
    collaboratorsFields.push([
      'properties.editors',
      {
        handler: 'ManageEditors',
        label: translate("Map's editors"),
        url: this.app.properties.urls.agnocomplete,
      },
    ])

    const builder = new MutatingForm(this, topFields)
    const form = await builder.build()
    container.appendChild(form)
    if (collaboratorsFields.length) {
      const fieldset = Utils.loadTemplate(
        `<fieldset class="separator"><legend>${translate('Manage collaborators')}</legend></fieldset>`
      )
      container.appendChild(fieldset)
      const builder = new MutatingForm(this, collaboratorsFields)
      const form = await builder.build()
      container.appendChild(form)
    }
  }

  async _editDatalayers(container) {
    if (this.app.hasLayers()) {
      const fieldset = Utils.loadTemplate(
        `<fieldset class="separator"><legend>${translate('Datalayers’ permissions')}</legend></fieldset>`
      )
      container.appendChild(fieldset)
      const appendLayer = async (layer, parentContainer) => {
        const [details, { body, icon }] = Utils.loadTemplateWithRefs(
          `<details open class="layer-group">
            <summary><i class="icon icon-16" data-ref="icon"></i>${layer.getName()}</summary>
            <div data-ref="body"></div>
          </details>`
        )
        if (layer.group) {
          icon.classList.add('icon-folder')
        } else {
          icon.hidden = true
        }
        parentContainer.appendChild(details)
        await layer.permissions.edit(body)
        for (const child of layer.layers) {
          appendLayer(child, body)
        }
      }
      for (const layer of this.app.layers.root) {
        appendLayer(layer, fieldset)
      }
    }
  }

  async edit() {
    if (this.app.properties.editMode !== 'advanced') return
    if (!this.app.id) {
      Alert.info(translate('Please save the map first'))
      return
    }
    const container = DOMUtils.loadTemplate(`
      <div class="umap-edit-permissions">
        <h3><i class="icon icon-16 icon-key"></i> ${translate('Update permissions')}</h3>
      </div>
    `)
    if (this.isAnonymousMap()) await this._editAnonymous(container)
    else await this._editWithOwner(container)
    await this._editDatalayers(container)
    this.app.editPanel.open({
      content: container,
      className: 'dark',
      highlight: 'permissions',
    })
  }

  async attach() {
    const [data, response, error] = await this.app.server.post(this.getAttachUrl())
    if (!error) {
      this.properties.owner = this.app.properties.user
      this.app.properties.user.is_owner = true
      this.render()
      Alert.success(translate('Map has been attached to your account'))
      this.app.editPanel.close()
    }
  }

  async save() {
    const formData = new FormData()
    if (!this.isAnonymousMap() && this.properties.editors) {
      const editors = this.properties.editors.map((u) => u.id)
      for (let i = 0; i < this.properties.editors.length; i++)
        formData.append('editors', this.properties.editors[i].id)
    }
    if (this.isOwner() || this.isAnonymousMap()) {
      formData.append('edit_status', this.properties.edit_status)
      formData.append('share_status', this.properties.share_status)
    }
    if (this.isOwner()) {
      formData.append('owner', this.properties.owner?.id)
      formData.append('team', this.properties.team?.id || '')
    }
    const [data, response, error] = await this.app.server.post(
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
    return this.app.urls.get('map_update_permissions', {
      map_id: this.app.id,
    })
  }

  getAttachUrl() {
    return this.app.urls.get('map_attach_owner', {
      map_id: this.app.id,
    })
  }

  commit() {
    this.app.properties.permissions = Object.assign(
      {},
      this.app.properties.permissions,
      this.properties
    )
  }

  pull() {
    this.setProperties(this.app.properties.permissions)
  }

  getShareStatusDisplay() {
    if (this.app.properties.share_statuses) {
      return Object.fromEntries(this.app.properties.share_statuses)[
        this.properties.share_status
      ]
    }
  }
}

export class DataLayerPermissions {
  constructor(app, datalayer, permissions) {
    this.app = app
    this.properties = Object.assign(
      {
        edit_status: null,
      },
      permissions
    )

    this.datalayer = datalayer
  }

  get journal() {
    if (!this._journal) {
      this._journal = this.app.journalEngine.proxy(this)
    }
    return this._journal
  }

  getJournalMetadata() {
    return {
      subject: 'datalayerpermissions',
      metadata: { id: this.datalayer.id },
    }
  }

  async edit(container) {
    const label = this.datalayer.group
      ? translate('Group’s permissions')
      : translate('Layer’s permissions')
    const fields = [
      [
        'properties.edit_status',
        {
          handler: 'IntSelect',
          label: label,
          labelClassName: 'sr-only',
          selectOptions: this.app.properties.datalayer_edit_statuses,
        },
      ],
    ]
    const builder = new MutatingForm(this, fields, {
      className: 'umap-form datalayer-permissions',
    })
    const form = await builder.build()
    container.appendChild(form)
  }

  getUrl() {
    return this.app.urls.get('datalayer_permissions', {
      map_id: this.app.id,
      pk: this.datalayer.id,
    })
  }

  async save() {
    const formData = new FormData()
    formData.append('edit_status', this.properties.edit_status)
    const [data, response, error] = await this.app.server.post(
      this.getUrl(),
      {},
      formData
    )
    return !error
  }
}
