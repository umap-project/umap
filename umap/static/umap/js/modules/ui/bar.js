import { DomEvent } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'
import { WithTemplate } from '../utils.js'
import ContextMenu from './contextmenu.js'

const TOP_BAR_TEMPLATE = `
<div class="umap-main-edit-toolbox with-transition dark">
    <div class="umap-left-edit-toolbox" data-ref="left">
        <div class="logo"><a class="" href="/" title="${translate('Go to the homepage')}">uMap</a></div>
        <button class="map-name" type="button" data-ref="name"></button>
        <button class="share-status" type="button" data-ref="share"></button>
    </div>
    <div class="umap-right-edit-toolbox" data-ref="right">
        <button class="connected-peers round" type="button" data-ref="peers">
          <i class="icon icon-16 icon-peers icon-black"></i>
          <span></span>
        </button>
        <button class="umap-user flat" type="button" data-ref="user">
          <i class="icon icon-16 icon-profile"></i>
          <span class="username" data-ref="username"></span>
        </button>
        <button class="umap-help-link" type="button" title="${translate('Help')}" data-ref="help">${translate('Help')}</button>
        <button class="edit-cancel round" type="button" data-ref="cancel">
            <i class="icon icon-16 icon-restore"></i>
            <span class="">${translate('Cancel edits')}</span>
        </button>
        <button class="edit-disable round" type="button" data-ref="view">
            <i class="icon icon-16 icon-eye"></i>
            <span class="">${translate('View')}</span>
        </button>
        <button class="edit-save button round" type="button" data-ref="save">
            <i class="icon icon-16 icon-save"></i>
            <i class="icon icon-16 icon-save-disabled"></i>
            <span hidden data-ref="saveLabel">${translate('Save')}</span>
            <span hidden data-ref="saveDraftLabel">${translate('Save draft')}</span>
        </button>
    </div>
</div>`

export class TopBar extends WithTemplate {
  constructor(umap, parent) {
    super()
    this._umap = umap
    this._menu = new ContextMenu({ className: 'dark', fixed: true })
    this.loadTemplate(TOP_BAR_TEMPLATE)
    this.parent = parent
  }

  setup() {
    this.parent.appendChild(this.element)
    this.elements.name.addEventListener('mouseover', () => {
      this._umap.tooltip.open({
        content: translate('Edit the title of the map'),
        anchor: this.elements.name,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.elements.share.addEventListener('mouseover', () => {
      this._umap.tooltip.open({
        content: translate('Update who can see and edit the map'),
        anchor: this.elements.share,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    if (this._umap.properties.editMode === 'advanced') {
      this.elements.name.addEventListener('click', () => this._umap.editCaption())
      this.elements.share.addEventListener('click', () => this._umap.permissions.edit())
    }
    this.elements.user.addEventListener('click', () => {
      if (this._umap.properties.user?.id) {
        const actions = [
          {
            label: translate('New map'),
            action: this._umap.urls.get('map_new'),
          },
          {
            label: translate('My maps'),
            action: this._umap.urls.get('user_dashboard'),
          },
          {
            label: translate('My teams'),
            action: this._umap.urls.get('user_teams'),
          },
        ]
        if (this._umap.urls.has('user_profile')) {
          actions.push({
            label: translate('My profile'),
            action: this._umap.urls.get('user_profile'),
          })
        }
        this._menu.openBelow(this.elements.user, actions)
      }
    })

    const connectedPeers = this._umap.sync.getNumberOfConnectedPeers()
    this.elements.peers.addEventListener('mouseover', () => {
      if (!connectedPeers) return
      this._umap.tooltip.open({
        content: translate('{connectedPeers} peer(s) currently connected to this map', {
          connectedPeers: connectedPeers,
        }),
        anchor: this.elements.peers,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })

    this.elements.help.addEventListener('click', () => this._umap.showGetStarted())
    this.elements.cancel.addEventListener('click', () => this._umap.askForReset())
    this.elements.cancel.addEventListener('mouseover', () => {
      this._umap.tooltip.open({
        content: this._umap.help.displayLabel('CANCEL'),
        anchor: this.elements.cancel,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.elements.view.addEventListener('click', () => this._umap.disableEdit())
    this.elements.view.addEventListener('mouseover', () => {
      this._umap.tooltip.open({
        content: this._umap.help.displayLabel('PREVIEW'),
        anchor: this.elements.view,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.elements.save.addEventListener('click', () => this._umap.saveAll())
    this.elements.save.addEventListener('mouseover', () => {
      this._umap.tooltip.open({
        content: this._umap.help.displayLabel('SAVE'),
        anchor: this.elements.save,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.redraw()
  }

  redraw() {
    this.elements.peers.hidden = !this._umap.getProperty('syncEnabled')
    this.elements.saveLabel.hidden = this._umap.permissions.isDraft()
    this.elements.saveDraftLabel.hidden = !this._umap.permissions.isDraft()
  }
}

const BOTTOM_BAR_TEMPLATE = `
  <div class="umap-caption-bar">
    <h3 class="map-name"></h3>
    <span data-ref="author"></span>
    <button class="umap-about-link flat" type="button" title="${translate('Open caption')}" data-ref="caption">${translate('Open caption')}</button>
    <button class="umap-open-browser-link flat" type="button" title="${translate('Browse data')}" data-ref="browse">${translate('Browse data')}</button>
    <button class="umap-open-browser-link flat" type="button" title="${translate('Filter data')}" data-ref="filter">${translate('Filter data')}</button>
  </div>
`

export class BottomBar extends WithTemplate {
  constructor(umap, slideshow, parent) {
    super()
    this._umap = umap
    this._slideshow = slideshow
    this.loadTemplate(BOTTOM_BAR_TEMPLATE)
    this.parent = parent
  }

  setup() {
    this.parent.appendChild(this.element)
    DomEvent.disableClickPropagation(this.element)
    this._umap.addAuthorLink(this.elements.author)
    this.elements.caption.addEventListener('click', () => this._umap.openCaption())
    this.elements.browse.addEventListener('click', () => this._umap.openBrowser('data'))
    this.elements.filter.addEventListener('click', () =>
      this._umap.openBrowser('filters')
    )
    this._slideshow.renderToolbox(this.element)
    this.redraw()
  }

  redraw() {
    const hasSlideshow = this._slideshow.isEnabled()
    const barEnabled = this._umap.properties.captionBar || hasSlideshow
    document.body.classList.toggle('umap-caption-bar-enabled', barEnabled)
    document.body.classList.toggle('umap-slideshow-enabled', hasSlideshow)
    const showMenus = this._umap.getProperty('captionMenus')
    this.elements.caption.hidden = !showMenus
    this.elements.browse.hidden = !showMenus
    this.elements.filter.hidden = !showMenus || !this._umap.properties.facetKey
  }
}
