L.U.IframeExporter = L.Evented.extend({
  options: {
    includeFullScreenLink: true,
    currentView: false,
    keepCurrentDatalayers: false,
    viewCurrentFeature: false,
  },

  queryString: {
    scaleControl: false,
    miniMap: false,
    scrollWheelZoom: false,
    zoomControl: true,
    editMode: 'disabled',
    moreControl: true,
    searchControl: null,
    tilelayersControl: null,
    embedControl: null,
    datalayersControl: true,
    onLoadPanel: 'none',
    captionBar: false,
    captionMenus: true,
  },

  dimensions: {
    width: '100%',
    height: '300px',
  },

  initialize: function (map) {
    this.map = map
    this.baseUrl = L.Util.getBaseUrl()
    // Use map default, not generic default
    this.queryString.onLoadPanel = this.map.options.onLoadPanel
  },

  getMap: function () {
    return this.map
  },

  buildUrl: function (options) {
    const datalayers = []
    if (this.options.viewCurrentFeature && this.map.currentFeature) {
      this.queryString.feature = this.map.currentFeature.getSlug()
    }
    if (this.options.keepCurrentDatalayers) {
      this.map.eachDataLayer((datalayer) => {
        if (datalayer.isVisible() && datalayer.umap_id) {
          datalayers.push(datalayer.umap_id)
        }
      })
      this.queryString.datalayers = datalayers.join(',')
    } else {
      delete this.queryString.datalayers
    }
    const currentView = this.options.currentView ? window.location.hash : ''
    const queryString = L.extend({}, this.queryString, options)
    return `${this.baseUrl}?${L.Util.buildQueryString(queryString)}${currentView}`
  },

  build: function () {
    const iframeUrl = this.buildUrl()
    let code = `<iframe width="${this.dimensions.width}" height="${this.dimensions.height}" frameborder="0" allowfullscreen allow="geolocation" src="${iframeUrl}"></iframe>`
    if (this.options.includeFullScreenLink) {
      const fullUrl = this.buildUrl({ scrollWheelZoom: true })
      code += `<p><a href="${fullUrl}">${L._('See full screen')}</a></p>`
    }
    return code
  },
})