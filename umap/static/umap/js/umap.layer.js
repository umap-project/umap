L.U.Layer = {
  canBrowse: true,

  getType: function () {
    const proto = Object.getPrototypeOf(this)
    return proto.constructor.TYPE
  },

  getName: function () {
    const proto = Object.getPrototypeOf(this)
    return proto.constructor.NAME
  },

  getFeatures: function () {
    return this._layers
  },

  getEditableOptions: function () {
    return []
  },

  onEdit: function () {},

  hasDataVisible: function () {
    return !!Object.keys(this._layers).length
  },
}

L.U.Layer.Default = L.FeatureGroup.extend({
  statics: {
    NAME: L._('Default'),
    TYPE: 'Default',
  },
  includes: [L.U.Layer],

  initialize: function (datalayer) {
    this.datalayer = datalayer
    L.FeatureGroup.prototype.initialize.call(this)
  },
})

L.U.MarkerCluster = L.MarkerCluster.extend({
  // Custom class so we can call computeTextColor
  // when element is already on the DOM.

  _initIcon: function () {
    L.MarkerCluster.prototype._initIcon.call(this)
    const div = this._icon.querySelector('div')
    // Compute text color only when icon is added to the DOM.
    div.style.color = this._iconObj.computeTextColor(div)
  },
})

L.U.Layer.Cluster = L.MarkerClusterGroup.extend({
  statics: {
    NAME: L._('Clustered'),
    TYPE: 'Cluster',
  },
  includes: [L.U.Layer],

  initialize: function (datalayer) {
    this.datalayer = datalayer
    const options = {
      polygonOptions: {
        color: this.datalayer.getColor(),
      },
      iconCreateFunction: function (cluster) {
        return new L.U.Icon.Cluster(datalayer, cluster)
      },
    }
    if (this.datalayer.options.cluster && this.datalayer.options.cluster.radius) {
      options.maxClusterRadius = this.datalayer.options.cluster.radius
    }
    L.MarkerClusterGroup.prototype.initialize.call(this, options)
    this._markerCluster = L.U.MarkerCluster
    this._layers = []
  },

  onRemove: function (map) {
    // In some situation, the onRemove is called before the layer is really
    // added to the map: basically when combining a defaultView=data + max/minZoom
    // and loading the map at a zoom outside of that zoom range.
    // FIXME: move this upstream (_unbindEvents should accept a map parameter
    // instead of relying on this._map)
    this._map = map
    return L.MarkerClusterGroup.prototype.onRemove.call(this, map)
  },

  addLayer: function (layer) {
    this._layers.push(layer)
    return L.MarkerClusterGroup.prototype.addLayer.call(this, layer)
  },

  removeLayer: function (layer) {
    this._layers.splice(this._layers.indexOf(layer), 1)
    return L.MarkerClusterGroup.prototype.removeLayer.call(this, layer)
  },

  getEditableOptions: function () {
    if (!L.Util.isObject(this.datalayer.options.cluster)) {
      this.datalayer.options.cluster = {}
    }
    return [
      [
        'options.cluster.radius',
        {
          handler: 'BlurIntInput',
          placeholder: L._('Clustering radius'),
          helpText: L._('Override clustering radius (default 80)'),
        },
      ],
      [
        'options.cluster.textColor',
        {
          handler: 'TextColorPicker',
          placeholder: L._('Auto'),
          helpText: L._('Text color for the cluster label'),
        },
      ],
    ]
  },

  onEdit: function (field, builder) {
    if (field === 'options.cluster.radius') {
      // No way to reset radius of an already instanciated MarkerClusterGroup...
      this.datalayer.resetLayer(true)
      return
    }
    if (field === 'options.color') {
      this.options.polygonOptions.color = this.datalayer.getColor()
    }
  },
})

L.U.Layer.Choropleth = L.FeatureGroup.extend({
  statics: {
    NAME: L._('Choropleth'),
    TYPE: 'Choropleth',
  },
  includes: [L.U.Layer],
  canBrowse: true,
  // Have defaults that better suit the choropleth mode.
  defaults: {
    color: 'white',
    fillColor: 'red',
    fillOpacity: 0.7,
    weight: 2,
  },
  MODES: {
    kmeans: L._('K-means'),
    equidistant: L._('Equidistant'),
    jenks: L._('Jenks-Fisher'),
    quantiles: L._('Quantiles'),
    manual: L._('Manual'),
  },

  initialize: function (datalayer) {
    this.datalayer = datalayer
    if (!L.Util.isObject(this.datalayer.options.choropleth)) {
      this.datalayer.options.choropleth = {}
    }
    L.FeatureGroup.prototype.initialize.call(
      this,
      [],
      this.datalayer.options.choropleth
    )
    this.datalayer.onceDataLoaded(() => {
      this.redraw()
      this.datalayer.on('datachanged', this.redraw, this)
    })
  },

  redraw: function () {
    this.computeBreaks()
    if (this._map) this.eachLayer(this._map.addLayer, this._map)
  },

  _getValue: function (feature) {
    const key = this.datalayer.options.choropleth.property || 'value'
    return +feature.properties[key] // TODO: should we catch values non castable to int ?
  },

  computeBreaks: function () {
    const values = []
    this.datalayer.eachLayer((layer) => {
      let value = this._getValue(layer)
      if (!isNaN(value)) values.push(value)
    })
    if (!values.length) {
      this.options.breaks = []
      this.options.colors = []
      return
    }
    let mode = this.datalayer.options.choropleth.mode,
      classes = +this.datalayer.options.choropleth.classes || 5,
      breaks
    if (mode === 'manual') {
      const manualBreaks = this.datalayer.options.choropleth.breaks
      if (manualBreaks) {
        breaks = manualBreaks
          .split(',')
          .map((b) => +b)
          .filter((b) => !isNaN(b))
      }
    } else if (mode === 'equidistant') {
      breaks = ss.equalIntervalBreaks(values, classes)
    } else if (mode === 'jenks') {
      breaks = ss.jenks(values, classes)
    } else if (mode === 'quantiles') {
      const quantiles = [...Array(classes)].map((e, i) => i / classes).concat(1)
      breaks = ss.quantile(values, quantiles)
    } else {
      breaks = ss.ckmeans(values, classes).map((cluster) => cluster[0])
      breaks.push(ss.max(values)) // Needed for computing the legend
    }
    this.options.breaks = breaks || []
    this.datalayer.options.choropleth.breaks = this.options.breaks
      .map((b) => +b.toFixed(2))
      .join(',')
    const fillColor = this.datalayer.getOption('fillColor') || this.defaults.fillColor
    let colorScheme = this.datalayer.options.choropleth.brewer
    if (!colorbrewer[colorScheme]) colorScheme = 'Blues'
    this.options.colors = colorbrewer[colorScheme][this.options.breaks.length - 1] || []
  },

  getColor: function (feature) {
    if (!feature) return // FIXME shold not happen
    const featureValue = this._getValue(feature)
    // Find the bucket/step/limit that this value is less than and give it that color
    for (let i = 1; i < this.options.breaks.length; i++) {
      if (featureValue <= this.options.breaks[i]) {
        return this.options.colors[i - 1]
      }
    }
  },

  getOption: function (option, feature) {
    if (feature && option === feature.staticOptions.mainColor) {
      return this.getColor(feature)
    }
  },

  addLayer: function (layer) {
    // Do not add yet the layer to the map
    // wait for datachanged event, so we want compute breaks once
    var id = this.getLayerId(layer)
    this._layers[id] = layer
    return this
  },

  onAdd: function (map) {
    this.computeBreaks()
    L.FeatureGroup.prototype.onAdd.call(this, map)
  },

  onEdit: function (field, builder) {
    // If user touches the breaks, then force manual mode
    if (field === 'options.choropleth.breaks') {
      this.datalayer.options.choropleth.mode = 'manual'
      builder.helpers['options.choropleth.mode'].fetch()
    }
    this.computeBreaks()
    // If user changes the mode or the number of classes,
    // then update the breaks input value
    if (field === 'options.choropleth.mode' || field === 'options.choropleth.classes') {
      builder.helpers['options.choropleth.breaks'].fetch()
    }
  },

  getEditableOptions: function () {
    const brewerSchemes = Object.keys(colorbrewer)
      .filter((k) => k !== 'schemeGroups')
      .sort()

    return [
      [
        'options.choropleth.property',
        {
          handler: 'Select',
          selectOptions: this.datalayer._propertiesIndex,
          label: L._('Choropleth property value'),
        },
      ],
      [
        'options.choropleth.brewer',
        {
          handler: 'Select',
          label: L._('Choropleth color palette'),
          selectOptions: brewerSchemes,
        },
      ],
      [
        'options.choropleth.classes',
        {
          handler: 'Range',
          min: 3,
          max: 9,
          step: 1,
          label: L._('Choropleth classes'),
          helpText: L._('Number of desired classes (default 5)'),
        },
      ],
      [
        'options.choropleth.breaks',
        {
          handler: 'BlurInput',
          label: L._('Choropleth breakpoints'),
          helpText: L._(
            'Comma separated list of numbers, including min and max values.'
          ),
        },
      ],
      [
        'options.choropleth.mode',
        {
          handler: 'MultiChoice',
          default: 'kmeans',
          choices: Object.entries(this.MODES),
          label: L._('Choropleth mode'),
        },
      ],
    ]
  },

  renderLegend: function (container) {
    const parent = L.DomUtil.create('ul', '', container)
    let li, color, label

    this.options.breaks.slice(0, -1).forEach((limit, index) => {
      li = L.DomUtil.create('li', '', parent)
      color = L.DomUtil.create('span', 'datalayer-color', li)
      color.style.backgroundColor = this.options.colors[index]
      label = L.DomUtil.create('span', '', li)
      label.textContent = `${+this.options.breaks[index].toFixed(
        1
      )} - ${+this.options.breaks[index + 1].toFixed(1)}`
    })
  },
})

L.U.Layer.Heat = L.HeatLayer.extend({
  statics: {
    NAME: L._('Heatmap'),
    TYPE: 'Heat',
  },
  includes: [L.U.Layer],
  canBrowse: false,

  initialize: function (datalayer) {
    this.datalayer = datalayer
    L.HeatLayer.prototype.initialize.call(this, [], this.datalayer.options.heat)
  },

  addLayer: function (layer) {
    if (layer instanceof L.Marker) {
      let latlng = layer.getLatLng(),
        alt
      if (
        this.datalayer.options.heat &&
        this.datalayer.options.heat.intensityProperty
      ) {
        alt = parseFloat(
          layer.properties[this.datalayer.options.heat.intensityProperty || 0]
        )
        latlng = new L.LatLng(latlng.lat, latlng.lng, alt)
      }
      this.addLatLng(latlng)
    }
  },

  clearLayers: function () {
    this.setLatLngs([])
  },

  getFeatures: function () {
    return {}
  },

  getBounds: function () {
    return L.latLngBounds(this._latlngs)
  },

  getEditableOptions: function () {
    if (!L.Util.isObject(this.datalayer.options.heat)) {
      this.datalayer.options.heat = {}
    }
    return [
      [
        'options.heat.radius',
        {
          handler: 'Range',
          min: 10,
          max: 100,
          step: 5,
          label: L._('Heatmap radius'),
          helpText: L._('Override heatmap radius (default 25)'),
        },
      ],
      [
        'options.heat.intensityProperty',
        {
          handler: 'BlurInput',
          placeholder: L._('Heatmap intensity property'),
          helpText: L._('Optional intensity property for heatmap'),
        },
      ],
    ]
  },

  onEdit: function (field, builder) {
    if (field === 'options.heat.intensityProperty') {
      this.datalayer.resetLayer(true) // We need to repopulate the latlngs
      return
    }
    if (field === 'options.heat.radius') {
      this.options.radius = this.datalayer.options.heat.radius
    }
    this._updateOptions()
  },

  redraw: function () {
    // setlalngs call _redraw through setAnimFrame, thus async, so this
    // can ends with race condition if we remove the layer very faslty after.
    // TODO: PR in upstream Leaflet.heat
    if (!this._map) return
    L.HeatLayer.prototype.redraw.call(this)
  },

  _redraw: function () {
    // Import patch from https://github.com/Leaflet/Leaflet.heat/pull/78
    // Remove me when this get merged and released.
    if (!this._map) {
      return
    }
    var data = [],
      r = this._heat._r,
      size = this._map.getSize(),
      bounds = new L.Bounds(L.point([-r, -r]), size.add([r, r])),
      cellSize = r / 2,
      grid = [],
      panePos = this._map._getMapPanePos(),
      offsetX = panePos.x % cellSize,
      offsetY = panePos.y % cellSize,
      i,
      len,
      p,
      cell,
      x,
      y,
      j,
      len2

    this._max = 1

    for (i = 0, len = this._latlngs.length; i < len; i++) {
      p = this._map.latLngToContainerPoint(this._latlngs[i])
      x = Math.floor((p.x - offsetX) / cellSize) + 2
      y = Math.floor((p.y - offsetY) / cellSize) + 2

      var alt =
        this._latlngs[i].alt !== undefined
          ? this._latlngs[i].alt
          : this._latlngs[i][2] !== undefined
          ? +this._latlngs[i][2]
          : 1

      grid[y] = grid[y] || []
      cell = grid[y][x]

      if (!cell) {
        cell = grid[y][x] = [p.x, p.y, alt]
        cell.p = p
      } else {
        cell[0] = (cell[0] * cell[2] + p.x * alt) / (cell[2] + alt) // x
        cell[1] = (cell[1] * cell[2] + p.y * alt) / (cell[2] + alt) // y
        cell[2] += alt // cumulated intensity value
      }

      // Set the max for the current zoom level
      if (cell[2] > this._max) {
        this._max = cell[2]
      }
    }

    this._heat.max(this._max)

    for (i = 0, len = grid.length; i < len; i++) {
      if (grid[i]) {
        for (j = 0, len2 = grid[i].length; j < len2; j++) {
          cell = grid[i][j]
          if (cell && bounds.contains(cell.p)) {
            data.push([
              Math.round(cell[0]),
              Math.round(cell[1]),
              Math.min(cell[2], this._max),
            ])
          }
        }
      }
    }

    this._heat.data(data).draw(this.options.minOpacity)

    this._frame = null
  },
})

L.TileLayer.include({
  toJSON: function () {
    return {
      minZoom: this.options.minZoom,
      maxZoom: this.options.maxZoom,
      attribution: this.options.attribution,
      url_template: this._url,
      name: this.options.name,
      tms: this.options.tms,
    }
  },

  getAttribution: function () {
    return L.Util.toHTML(this.options.attribution)
  },
})
