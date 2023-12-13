L.U.AttributionControl = L.Control.Attribution.extend({
    options: {
      prefix: '',
    },
  
    _update: function () {
      L.Control.Attribution.prototype._update.call(this)
      // Use our how container, so we can hide/show on small screens
      const credits = this._container.innerHTML
      this._container.innerHTML = ''
      const container = L.DomUtil.add(
        'div',
        'attribution-container',
        this._container,
        credits
      )
      if (this._map.options.shortCredit) {
        L.DomUtil.add(
          'span',
          '',
          container,
          ` — ${L.Util.toHTML(this._map.options.shortCredit)}`
        )
      }
      if (this._map.options.captionMenus) {
        const link = L.DomUtil.add('a', '', container, ` — ${L._('About')}`)
        L.DomEvent.on(link, 'click', L.DomEvent.stop)
          .on(link, 'click', this._map.displayCaption, this._map)
          .on(link, 'dblclick', L.DomEvent.stop)
      }
      if (window.top === window.self && this._map.options.captionMenus) {
        // We are not in iframe mode
        L.DomUtil.createLink('', container, ` — ${L._('Home')}`, '/')
      }
      if (this._map.options.captionMenus) {
        L.DomUtil.createLink(
          '',
          container,
          ` — ${L._('Powered by uMap')}`,
          'https://github.com/umap-project/umap/'
        )
      }
      L.DomUtil.createLink('attribution-toggle', this._container, '')
    },
  })