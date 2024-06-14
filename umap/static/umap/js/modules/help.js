import { DomUtil, DomEvent } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'

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
  CANCEL: {
    shortcut: 'Modifier+Z',
    label: translate('Cancel edits'),
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
  facetKey: translate(
    'Comma separated list of properties to use for filters (eg.: mykey,otherkey). To control label, add it after a | (eg.: mykey|My Key,otherkey|Other Key). To control input field type, add it after another | (eg.: mykey|My Key|checkbox,otherkey|Other Key|datetime). Allowed values for the input field type are checkbox (default), radio, number, date and datetime.'
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
  importFormats: `
  <div>
    <h3>GeoJSON</h3>
    <p>${translate('All properties are imported.')}</p>
    <h3>GPX</h3>
    <p>${translate('Properties imported:')}name, desc</p>
    <h3>KML</h3>
    <p>${translate('Properties imported:')}name, description</p>
    <h3>CSV</h3>
    <p>${translate('Comma, tab or semi-colon separated values. SRS WGS84 is implied. Only Point geometries are imported. The import will look at the column headers for any mention of «lat» and «lon» at the begining of the header, case insensitive. All other column are imported as properties.')}</p>
    <h3>uMap</h3>
    <p>${translate('Imports all umap data, including layers and settings.')}</p>
  </div>
  `,
  dynamicProperties: `
  <div>
    <h3>${translate('Dynamic properties')}</h3>
    <p>${translate('Use placeholders with feature properties between brackets, eg. &#123;name&#125;, they will be dynamically replaced by the corresponding values.')}</p>
  </div>
  `,

  textFormatting: `
  <div>
    <h3>${translate('Text formatting')}</h3>
    <ul>
      <li>${translate('*single star for italic*')}</li>
      <li>${translate('**double star for bold**')}</li>
      <li>${translate('# one hash for main heading')}</li>
      <li>${translate('## two hashes for second heading')}</li>
      <li>${translate('### three hashes for third heading')}</li>
      <li>${translate('Simple link: [[http://example.com]]')}</li>
      <li>${translate('Link with text: [[http://example.com|text of the link]]')}</li>
      <li>${translate('Image: {{http://image.url.com}}')}</li>
      <li>${translate('Image with custom width (in px): {{http://image.url.com|width}}')}</li>
      <li>${translate('Iframe: {{{http://iframe.url.com}}}')}</li>
      <li>${translate('Iframe with custom height (in px): {{{http://iframe.url.com|height}}}')}</li>
      <li>${translate('Iframe with custom height and width (in px): {{{http://iframe.url.com|height*width}}}')}</li>
      <li>${translate('--- for a horizontal rule')}</li>
    </ul>
  </div>
  `,
}

export default class Help {
  constructor(map) {
    this.map = map
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
      label += ` ${shortcut}`
    } else {
      label += ` (${shortcut})`
    }
    return label
  }

  show(entries) {
    const container = DomUtil.add('div')
    // Special dynamic case. Do we still think this dialog is usefull ?
    if (entries == 'edit') {
      DomUtil.element({
        tagName: 'div',
        className: 'umap-help-entry',
        parent: container,
      }).appendChild(this._buildEditEntry())
    } else {
      for (const name of entries) {
        DomUtil.element({
          tagName: 'div',
          className: 'umap-help-entry',
          parent: container,
          innerHTML: ENTRIES[name],
        })
      }
    }
    this.map.dialog.open({ content: container, className: 'dark' })
  }

  button(container, entries, classname) {
    const button = DomUtil.createButton(
      classname || 'umap-help-button',
      container,
      translate('Help')
    )
    entries = typeof entries === 'string' ? [entries] : entries
    DomEvent.on(button, 'click', DomEvent.stop).on(button, 'click', () =>
      this.show(entries)
    )
    return button
  }

  link(container, entries) {
    const button = this.button(container, entries, 'umap-help-link')
    button.textContent = translate('Help')
    return button
  }

  _buildEditEntry() {
    const container = DomUtil.create('div', '')
    const title = DomUtil.create('h3', '', container)
    const actionsContainer = DomUtil.create('ul', 'umap-edit-actions', container)
    const addAction = (action) => {
      const actionContainer = DomUtil.add('li', '', actionsContainer)
      DomUtil.add('i', action.options.className, actionContainer),
        DomUtil.add('span', '', actionContainer, action.options.tooltip)
      DomEvent.on(actionContainer, 'click', action.addHooks, action)
      DomEvent.on(actionContainer, 'click', this.map.dialog.close, this.map.dialog)
    }
    title.textContent = translate('Where do we go from here?')
    for (const id in this.map.helpMenuActions) {
      addAction(this.map.helpMenuActions[id])
    }
    return container
  }
}
