L.Storage.Icon = L.DivIcon.extend({
    initialize: function(map, options) {
        this.map = map;
        var default_options = {
            iconSize: null,  // Made in css
            iconUrl: this.map.getDefaultOption('iconUrl'),
            feature: null
        };
        options = L.Util.extend({}, default_options, options);
        L.Icon.prototype.initialize.call(this, options);
        this.feature = this.options.feature;
        if (this.feature && this.feature.isReadOnly()) {
            this.options.className += ' readonly';
        }
    },

    _getIconUrl: function (name) {
        var url;
        if(this.feature && this.feature._getIconUrl(name)) url = this.feature._getIconUrl(name);
        else url = this.options[name + 'Url'];
        return this.formatUrl(url, this.feature);
    },

    _getColor: function () {
        var color;
        if(this.feature) color = this.feature.getOption('color');
        else if (this.options.color) color = this.options.color;
        else color = this.map.getDefaultOption('color');
        return color;
    },

    formatUrl: function (url, feature) {
        return L.Util.greedyTemplate(url || '', feature ? feature.properties : {});
    }

});

L.Storage.Icon.Default = L.Storage.Icon.extend({
    default_options: {
        iconAnchor: new L.Point(16, 40),
        popupAnchor: new L.Point(0, -40),
        tooltipAnchor: new L.Point(16, -24),
        className: 'storage-div-icon'
    },

    initialize: function(map, options) {
        options = L.Util.extend({}, this.default_options, options);
        L.Storage.Icon.prototype.initialize.call(this, map, options);
    },

    _setColor: function() {
        var color = this._getColor();
        this.elements.container.style.backgroundColor = color;
        this.elements.arrow.style.borderTopColor = color;
    },

    createIcon: function() {
        this.elements = {};
        this.elements.main = L.DomUtil.create('div');
        this.elements.container = L.DomUtil.create('div', 'icon_container', this.elements.main);
        this.elements.arrow = L.DomUtil.create('div', 'icon_arrow', this.elements.main);
        this.elements.img = L.DomUtil.create('img', null, this.elements.container);
        var src = this._getIconUrl('icon');
        if (src) this.elements.img.src = src;
        this._setColor();
        this._setIconStyles(this.elements.main, 'icon');
        return this.elements.main;
    }

});

L.Storage.Icon.Circle = L.Storage.Icon.extend({
    initialize: function(map, options) {
        var default_options = {
            iconAnchor: new L.Point(6, 6),
            popupAnchor: new L.Point(0, -6),
            tooltipAnchor: new L.Point(6, 0),
            className: 'storage-circle-icon'
        };
        options = L.Util.extend({}, default_options, options);
        L.Storage.Icon.prototype.initialize.call(this, map, options);
    },

    _setColor: function() {
        this.elements.main.style.backgroundColor = this._getColor();
    },

    createIcon: function() {
        this.elements = {};
        this.elements.main = L.DomUtil.create('div');
        this.elements.main.innerHTML = '&nbsp;';
        this._setColor();
        this._setIconStyles(this.elements.main, 'icon');
        return this.elements.main;
    }

});

L.Storage.Icon.Drop = L.Storage.Icon.Default.extend({
    default_options: {
            iconAnchor: new L.Point(16, 42),
            popupAnchor: new L.Point(0, -42),
            tooltipAnchor: new L.Point(16, -24),
            className: 'storage-drop-icon'
    }
});

L.Storage.Icon.Ball = L.Storage.Icon.Default.extend({
    default_options: {
            iconAnchor: new L.Point(8, 30),
            popupAnchor: new L.Point(0, -28),
            tooltipAnchor: new L.Point(8, -23),
            className: 'storage-ball-icon'
    },

    createIcon: function() {
        this.elements = {};
        this.elements.main = L.DomUtil.create('div');
        this.elements.container = L.DomUtil.create('div', 'icon_container', this.elements.main);
        this.elements.arrow = L.DomUtil.create('div', 'icon_arrow', this.elements.main);
        this._setColor();
        this._setIconStyles(this.elements.main, 'icon');
        return this.elements.main;
    },

    _setColor: function() {
        var color = this._getColor('color'),
            background;
        if (L.Browser.ielt9) {
            background = color;
        }
        else if (L.Browser.webkit) {
            background = '-webkit-gradient( radial, 6 38%, 0, 6 38%, 8, from(white), to(' + color + ') )';
        }
        else {
            background = 'radial-gradient(circle at 6px 38% , white -4px, ' + color + ' 8px) repeat scroll 0 0 transparent';
        }
        this.elements.container.style.background = background;
    }

});

var _CACHE_COLOR = {};
L.Storage.Icon.Cluster = L.DivIcon.extend({
    options: {
        iconSize: [40, 40]
    },

    initialize: function (datalayer, cluster) {
        this.datalayer = datalayer;
        this.cluster = cluster;
    },

    createIcon: function () {
        var container = L.DomUtil.create('div', 'leaflet-marker-icon marker-cluster'),
            div = L.DomUtil.create('div', '', container),
            span = L.DomUtil.create('span', '', div),
            backgroundColor = this.datalayer.getColor(),
            color;
        span.innerHTML = this.cluster.getChildCount();
        div.style.backgroundColor = backgroundColor;
        if (this.datalayer.options.cluster && this.datalayer.options.cluster.textColor) {
            color = this.datalayer.options.cluster.textColor;
        }
        if (!color) {
            if (typeof _CACHE_COLOR[backgroundColor] === 'undefined') {
                color = L.DomUtil.TextColorFromBackgroundColor(div);
                _CACHE_COLOR[backgroundColor] = color;
            } else {
                color = _CACHE_COLOR[backgroundColor];
            }
        }
        div.style.color = color;
        return container;
    }

});
