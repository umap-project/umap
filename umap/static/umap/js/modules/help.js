import { DomEvent, DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import Dialog from './ui/dialog.js'
import * as Utils from './utils.js'

const SHORTCUTS = {
  DRAW_MARKER: {
    shortcut: 'Modifier+M',
    label: translate('Draw a marker'),
  },
  DRAW_LINE: {
    shortcut: 'Modifier+L',
    label: translate('Draw a polyline'),
  },
  DRAW_POLYGON: {
    shortcut: 'Modifier+P',
    label: translate('Draw a polygon'),
  },
  TOGGLE_EDIT: {
    shortcut: 'Modifier+E',
    label: translate('Toggle edit mode'),
  },
  STOP_EDIT: {
    shortcut: 'Modifier+E',
    label: translate('Stop editing'),
  },
  SAVE_MAP: {
    shortcut: 'Modifier+S',
    label: translate('Save map'),
  },
  IMPORT_PANEL: {
    shortcut: 'Modifier+I',
    label: translate('Import data'),
  },
  SEARCH: {
    shortcut: 'Modifier+F',
    label: translate('Search location'),
  },
  UNDO: {
    shortcut: 'Modifier+Z',
    label: translate('Cancel last edit'),
  },
  REDO: {
    shortcut: 'Modifier+Shift+Z',
    label: translate('Redo last edit'),
  },
  PREVIEW: {
    shortcut: 'Modifier+E',
    label: translate('Back to preview'),
  },
  SAVE: {
    shortcut: 'Modifier+S',
    label: translate('Save current edits'),
  },
  EDIT_FEATURE_LAYER: {
    shortcut: 'Modifier+⇧+Click',
    label: translate("Edit feature's layer"),
  },
  CONTINUE_LINE: {
    shortcut: 'Modifier+Click',
    label: translate('Continue line'),
  },
}

const ENTRIES = {
  formatURL: `${translate(
    'Supported variables that will be dynamically replaced'
  )}: {bbox}, {lat}, {lng}, {zoom}, {east}, {north}..., {left}, {top}..., locale, lang`,
  colorValue: translate('Must be a valid CSS value (eg.: DarkBlue or #123456)'),
  smoothFactor: translate(
    'How much to simplify the polyline on each zoom level (more = better performance and smoother look, less = more accurate)'
  ),
  dashArray: translate(
    'A comma separated list of numbers that defines the stroke dash pattern. Ex.: "5, 10, 15".'
  ),
  zoomTo: translate('Zoom level for automatic zooms'),
  labelKey: translate(
    'The name of the property to use as feature label (eg.: "nom"). You can also use properties inside brackets to use more than one or mix with static content (eg.: "&lcub;name&rcub; in &lcub;place&rcub;")'
  ),
  stroke: translate('Whether to display or not polygons paths.'),
  fill: translate('Whether to fill polygons with color.'),
  fillColor: translate('Optional. Same as color if not set.'),
  shortCredit: translate('Will be displayed in the bottom right corner of the map'),
  longCredit: translate('Will be visible in the caption of the map'),
  permanentCredit: translate(
    'Will be permanently visible in the bottom left corner of the map'
  ),
  sortKey: translate(
    'Comma separated list of properties to use for sorting features. To reverse the sort, put a minus sign (-) before. Eg. mykey,-otherkey.'
  ),
  slugKey: translate('The name of the property to use as feature unique identifier.'),
  filterKey: translate(
    'Comma separated list of properties to use when filtering features by text input'
  ),
  facets: translate(
    'Filters will be displayed in the data browser to ease data selection.'
  ),
  interactive: translate(
    'If false, the polygon or line will act as a part of the underlying map.'
  ),
  outlink: translate('Define link to open in a new window on polygon click.'),
  dynamicRemoteData: translate('Fetch data each time map view changes.'),
  proxyRemoteData: translate(
    "To use if remote server doesn't allow cross domain (slower)"
  ),
  browsable: translate(
    'Set it to false to hide this layer from the slideshow, the data browser, the popup navigation…'
  ),
  importMode: translate(
    'When providing an URL, uMap can copy the remote data in a layer, or add this URL as remote source of the layer. In that case, data will always be fetched from that URL, and thus be up to date, but it will not be possible to edit it inside uMap.'
  ),
  importFormats: `
  <div>
    <dt>GeoJSON</dt>
    <dd>${translate('All properties are imported.')}</dd>
    <dt>GPX</dt>
    <dd>${translate('Properties imported:')}name, desc</dd>
    <dt>KML</dt>
    <dd>${translate('Properties imported:')}name, description</dd>
    <dt>CSV</dt>
    <dd>${translate('Comma, tab or semi-colon separated values. SRS WGS84 is implied. Only Point geometries are imported. The import will look at the column headers for any mention of «lat» and «lon» at the begining of the header, case insensitive. All other column are imported as properties.')}</dd>
    <dt>uMap</dt>
    <dd>${translate('Imports all umap data, including layers and settings.')}</dd>
  </div>
  `,
  dynamicProperties: `
  <div>
    <h4>${translate('Dynamic properties')}</h4>
    <p>${translate('Use placeholders with feature properties between brackets, eg. &#123;name&#125;, they will be dynamically replaced by the corresponding values.')}</p>
  </div>
  `,

  textFormatting: `
  <div>
    <h4>${translate('Text formatting')}</h4>
    <ul>
      <li>${translate('*single star for italic*')}</li>
      <li>${translate('**double star for bold**')}</li>
      <li>${translate('# one hash for main heading')}</li>
      <li>${translate('## two hashes for second heading')}</li>
      <li>${translate('### three hashes for third heading')}</li>
      <li>${translate('--- for a horizontal rule')}</li>
    </ul>
    <h4>${translate('Links')}</h4>
    <ul>
      <li>${translate('Simple link: [[https://example.com]]')}</li>
      <li>${translate('Link with text: [[https://example.com|text of the link]]')}</li>
    </ul>
    <h4>${translate('Images')}</h4>
    <ul>
      <li>${translate('Image: {{https://image.url.com}}')}</li>
      <li>${translate('Image with custom width (in px): {{https://image.url.com|width}}')}</li>
    </ul>
    <h4>${translate('Iframes')}</h4>
    <ul>
      <li>${translate('Iframe: {{{https://iframe.url.com}}}')}</li>
      <li>${translate('Iframe with custom height (in px): {{{https://iframe.url.com|height}}}')}</li>
      <li>${translate('Iframe with custom height and width (in px): {{{https://iframe.url.com|height*width}}}')}</li>
    </ul>
  </div>
  `,

  overpassImporter: `
  <div>
    <h4>${translate('Overpass supported expressions')}</h4>
    <ul>
      <li>${translate('key (eg. building)')}</li>
      <li>${translate('!key (eg. !name)')}</li>
      <li>${translate('key=value (eg. building=yes)')}</li>
      <li>${translate('key!=value (eg. building!=yes)')}</li>
      <li>${translate('key~value (eg. name~Grisy)')}</li>
      <li>${translate('key="value|value2" (eg. name="Paris|Berlin")')}</li>
    </ul>
    <div>${translate('More info about Overpass syntax')}: <a href="https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide">https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide</a></div>
    <div>${translate('For more complex needs, see')} <a href="https://overpass-turbo.eu/">https://overpass-turbo.eu/</a></div>
  </div>
  `,

  sync: translate(
    'Activate collaborative live editing on this map. Other users must reload the map after changing this setting.'
  ),
}

export default class Help {
  constructor(umap) {
    this.umap = umap
    this.dialog = new Dialog({ className: 'dark', accept: false, cancel: false })
    this.isMacOS = /mac/i.test(
      // eslint-disable-next-line compat/compat -- Fallback available.
      navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform
    )
  }

  displayLabel(action, withKbdTag = true) {
    let { shortcut, label } = SHORTCUTS[action]
    const modifier = this.isMacOS ? 'Cmd' : 'Ctrl'
    shortcut = shortcut.replace('Modifier', modifier)
    if (withKbdTag) {
      shortcut = shortcut
        .split('+')
        .map((el) => `<kbd>${el}</kbd>`)
        .join('+')
      label += ` <span class="nobr">${shortcut}</span>`
    } else {
      label += ` (${shortcut})`
    }
    return label
  }

  show(entries) {
    const container = DomUtil.add('div')
    DomUtil.createTitle(container, translate('Help'))
    for (const name of entries) {
      DomUtil.element({
        tagName: 'div',
        className: 'umap-help-entry',
        parent: container,
        innerHTML: ENTRIES[name],
      })
    }
    this.dialog.open({ template: container })
  }

  // Special dynamic case. Do we still think this dialog is useful?
  showGetStarted() {
    const [container, { getstarted, links }] = Utils.loadTemplateWithRefs(`
      <div>
        <h3><i class="icon icon-16 icon-help"></i>${translate('Where do we go from here?')}</h3>
        <ul data-ref=getstarted class="umap-getstarted"></ul>
        <h4>${translate('More help resources')}</h4>
        <ul data-ref=links class="umap-help-links"></ul>
      </div>
    `)
    const elements = document.querySelectorAll('[data-getstarted]')
    for (const el of elements) {
      const [node, { button }] = Utils.loadTemplateWithRefs(
        `<li><button data-ref=button type="button" title="${el.title}">${el.innerHTML}${el.title}</button></li>`
      )
      getstarted.appendChild(node)
      button.addEventListener('click', () => {
        el.click()
        this.dialog.close()
      })
    }
    for (const info of this.umap.properties.help_links) {
      const [node, { button }] = Utils.loadTemplateWithRefs(
        `<li><a href="${info.url}" target="_blank">${info.label} (${info.lang})</a><i class="icon icon-16 icon-external-link"></i></li>`
      )
      links.appendChild(node)
    }
    this.dialog.open({ template: container })
  }

  button(container, entries) {
    const button = DomUtil.createButton(
      'umap-help-button',
      container,
      translate('Help')
    )
    button.addEventListener('click', () => this.show(entries))
    return button
  }

  parse(container) {
    for (const element of container.querySelectorAll('[data-help]')) {
      if (element.dataset.help) {
        this.button(element, element.dataset.help.split(','))
      }
    }
  }
}

Help.MENU_ACTIONS = {}
