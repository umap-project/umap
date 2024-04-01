import { translate } from './i18n.js'

// Possible impacts
// ['ui', 'data', 'limit-bounds', 'datalayer-index', 'remote-data', 'background']

export const SCHEMA = {
  browsable: {
    impacts: ['ui'],
    type: Boolean,
  },
  captionBar: {
    type: Boolean,
    impacts: ['ui'],
    label: translate('Do you want to display a caption bar?'),
    default: false,
    impacts: [],
  },
  captionMenus: {
    type: Boolean,
    impacts: ['ui'],
    label: translate('Do you want to display caption menus?'),
    default: true,
  },
  color: {
    type: String,
    impacts: ['data'],
    handler: 'ColorPicker',
    label: translate('color'),
    helpEntries: 'colorValue',
    inheritable: true,
    default: 'DarkBlue',
  },
  choropleth: {
    type: Object,
    impacts: ['data'],
  },
  cluster: {
    type: Object,
    impacts: ['data'],
  },
  dashArray: {
    type: String,
    impacts: ['data'],
    label: translate('dash array'),
    helpEntries: 'dashArray',
    inheritable: true,
  },
  datalayersControl: {
    type: Boolean,
    impacts: ['ui'],
    nullable: true,
    handler: 'DataLayersControl',
    label: translate('Display the data layers control'),
    default: true,
  },
  defaultView: {
    type: String,
    impacts: [], // no need to update the ui, only useful when loading the map
    label: translate('Default view'),
    choices: [
      ['center', translate('Saved center and zoom')],
      ['data', translate('Fit all data')],
      ['latest', translate('Latest feature')],
      ['locate', translate('User location')],
    ],
    default: 'center',
  },
  description: {
    type: 'Text',
    impacts: ['ui'],
    label: translate('description'),
    helpEntries: 'textFormatting',
  },
  displayOnLoad: {
    type: Boolean,
    impacts: [],
  },
  displayPopupFooter: {
    type: Boolean,
    impacts: ['ui'],
    label: translate('Do you want to display popup footer?'),
    default: false,
  },
  easing: { impacts: [], type: Boolean, default: false },
  editinosmControl: {
    type: Boolean,
    impacts: ['ui'],
    nullable: true,
    label: translate('Display the control to open OpenStreetMap editor'),
    default: null,
  },
  embedControl: {
    type: Boolean,
    impacts: ['ui'],
    nullable: true,
    label: translate('Display the embed control'),
    default: true,
  },
  facetKey: { impacts: ['ui'], type: String },
  fill: {
    type: Boolean,
    impacts: ['data'],
    label: translate('fill'),
    helpEntries: 'fill',
    inheritable: true,
    default: true,
  },
  fillColor: {
    type: String,
    impacts: ['data'],
    handler: 'ColorPicker',
    label: translate('fill color'),
    helpEntries: 'fillColor',
    inheritable: true,
  },
  fillOpacity: {
    type: Number,
    impacts: ['data'],
    min: 0.1,
    max: 1,
    step: 0.1,
    label: translate('fill opacity'),
    inheritable: true,
    default: 0.3,
  },
  filterKey: { impacts: [], type: String },
  fromZoom: {
    type: Number,
    impacts: [], // not needed
    label: translate('From zoom'),
    helpText: translate('Optional.'),
  },
  fullscreenControl: {
    type: Boolean,
    impacts: ['ui'],
    nullable: true,
    label: translate('Display the fullscreen control'),
    default: true,
  },
  heat: {
    type: Object,
    impacts: ['data'],
  },
  iconClass: {
    type: String,
    impacts: ['data'],
    label: translate('Icon shape'),
    inheritable: true,
    choices: [
      ['Default', translate('Default')],
      ['Circle', translate('Circle')],
      ['Drop', translate('Drop')],
      ['Ball', translate('Ball')],
    ],
    default: 'Default',
  },
  iconOpacity: {
    type: Number,
    impacts: ['data'],
    min: 0.1,
    max: 1,
    step: 0.1,
    label: translate('icon opacity'),
    inheritable: true,
    default: 1,
  },
  iconUrl: {
    type: String,
    impacts: ['data'],
    handler: 'IconUrl',
    label: translate('Icon symbol'),
    inheritable: true,
  },
  inCaption: {
    type: Boolean,
    impacts: ['ui'],
  },

  interactive: {
    type: Boolean,
    impacts: ['data'],
    label: translate('Allow interactions'),
    helpEntries: 'interactive',
    inheritable: true,
    default: true,
  },
  labelDirection: {
    type: String,
    impacts: ['data'],
    label: translate('Label direction'),
    inheritable: true,
    choices: [
      ['auto', translate('Automatic')],
      ['left', translate('On the left')],
      ['right', translate('On the right')],
      ['top', translate('On the top')],
      ['bottom', translate('On the bottom')],
    ],
    default: 'auto',
  },
  labelInteractive: {
    type: Boolean,
    impacts: ['data'],
    label: translate('Labels are clickable'),
    inheritable: true,
  },
  labelKey: {
    type: String,
    impacts: ['data'],
    helpEntries: 'labelKey',
    placeholder: translate('Default: name'),
    label: translate('Label key'),
    inheritable: true,
  },
  licence: { impacts: ['ui'], type: String, label: translate('licence') },
  limitBounds: { impacts: ['limit-bounds'], type: Object },
  locateControl: {
    type: Boolean,
    impacts: ['ui'],
    nullable: true,
    label: translate('Display the locate control'),
  },
  longCredit: {
    type: 'Text',
    impacts: ['ui'],
    label: translate('Long credits'),
    helpEntries: ['longCredit', 'textFormatting'],
  },
  measureControl: {
    type: Boolean,
    impacts: ['ui'],
    nullable: true,
    label: translate('Display the measure control'),
  },
  miniMap: {
    impacts: ['ui'],
    type: Boolean,
    label: translate('Do you want to display a minimap?'),
    default: false,
  },
  moreControl: {
    type: Boolean,
    impacts: ['ui'],
    label: translate('Do you want to display the «more» control?'),
    default: true,
  },
  name: {
    type: String,
    impacts: ['ui', 'data'],
    label: translate('name'),
  },
  onLoadPanel: {
    impacts: [], // This is what happens during the map instantiation
    type: String,
    label: translate('Do you want to display a panel on load?'),
    choices: [
      ['none', translate('None')],
      ['caption', translate('Caption')],
      ['databrowser', translate('Data browser')],
      ['facet', translate('Facet search')],
    ],
    default: 'none',
  },
  opacity: {
    type: Number,
    impacts: ['data'],
    min: 0.1,
    max: 1,
    step: 0.1,
    label: translate('opacity'),
    inheritable: true,
    default: 0.5,
  },
  outlink: {
    type: String,
    label: translate('Link to…'),
    helpEntries: 'outlink',
    placeholder: 'http://...',
    inheritable: true,
  },
  outlinkTarget: {
    type: String,
    impacts: [],
    label: translate('Open link in…'),
    inheritable: true,
    default: 'blank',
    choices: [
      ['blank', translate('new window')],
      ['self', translate('iframe')],
      ['parent', translate('parent window')],
    ],
  },
  overlay: { impacts: ['background'], type: Object },
  permanentCredit: {
    type: 'Text',
    impacts: ['ui'],
    label: translate('Permanent credits'),
    helpEntries: ['permanentCredit', 'textFormatting'],
  },
  permanentCreditBackground: {
    type: Boolean,
    impacts: ['ui'],
    label: translate('Permanent credits background'),
    default: true,
  },
  popupContentTemplate: {
    type: 'Text',
    impacts: [], // not needed
    label: translate('Popup content template'),
    helpEntries: ['dynamicProperties', 'textFormatting'],
    placeholder: '# {name}',
    inheritable: true,
    default: '# {name}\n{description}',
  },
  popupShape: {
    type: String,
    impacts: [], // not needed
    label: translate('Popup shape'),
    inheritable: true,
    choices: [
      ['Default', translate('Popup')],
      ['Large', translate('Popup (large)')],
      ['Panel', translate('Side panel')],
    ],
    default: 'Default',
  },
  popupTemplate: {
    type: String,
    impacts: [], // not needed
    label: translate('Popup content style'),
    inheritable: true,
    choices: [
      ['Default', translate('Default')],
      ['Table', translate('Table')],
      ['GeoRSSImage', translate('GeoRSS (title + image)')],
      ['GeoRSSLink', translate('GeoRSS (only link)')],
      ['OSM', translate('OpenStreetMap')],
    ],
    default: 'Default',
  },
  remoteData: {
    type: Object,
    impacts: ['remote-data'],
  },
  scaleControl: {
    impacts: ['ui'],
    type: Boolean,
    label: translate('Do you want to display the scale control?'),
    default: true,
  },
  scrollWheelZoom: {
    type: Boolean,
    impacts: ['ui'],
    label: translate('Allow scroll wheel zoom?'),
  },
  searchControl: {
    type: Boolean,
    impacts: ['ui'],
    nullable: true,
    label: translate('Display the search control'),
    default: true,
  },
  shortCredit: {
    type: String,
    impacts: ['ui'],
    label: translate('Short credits'),
    helpEntries: ['shortCredit', 'textFormatting'],
  },
  showLabel: {
    type: Boolean,
    impacts: ['data'],
    nullable: true,
    label: translate('Display label'),
    inheritable: true,
    default: false,
  },
  slideshow: {
    type: Object,
    impacts: ['ui'],
  },
  slugKey: {
    type: String,
    impacts: [],
  },
  smoothFactor: {
    type: Number,
    impacts: ['data'],
    min: 0,
    max: 10,
    step: 0.5,
    label: translate('Simplify'),
    helpEntries: 'smoothFactor',
    inheritable: true,
    default: 1.0,
  },
  sortKey: { impacts: ['data', 'datalayer-index'], type: String },
  starControl: {
    type: Boolean,
    impacts: ['ui'],
    nullable: true,
    label: translate('Display the star map button'),
  },
  stroke: {
    type: Boolean,
    impacts: ['data'],
    label: translate('stroke'),
    helpEntries: 'stroke',
    inheritable: true,
    default: true,
  },
  tilelayer: {
    type: Object,
    impacts: ['background'],
  },
  tilelayersControl: {
    type: Boolean,
    impacts: ['ui'],
    nullable: true,
    label: translate('Display the tile layers control'),
  },
  toZoom: {
    type: Number,
    impacts: [], // not needed
    label: translate('To zoom'),
    helpText: translate('Optional.'),
  },
  type: {
    type: 'String',
    impacts: ['data'],
  },
  weight: {
    type: Number,
    impacts: ['data'],
    min: 1,
    max: 20,
    step: 1,
    label: translate('weight'),
    inheritable: true,
    default: 3,
  },
  zoom: {
    type: Number,
    impacts: [], // default zoom, doesn't need to be updated
  },
  zoomControl: {
    type: Boolean,
    impacts: ['ui'],
    nullable: true,
    label: translate('Display the zoom control'),
    default: true,
  },
  zoomTo: {
    type: Number,
    impacts: [], // not need to update the view
    placeholder: translate('Inherit'),
    helpEntries: 'zoomTo',
    label: translate('Default zoom level'),
    inheritable: true,
  },
}
