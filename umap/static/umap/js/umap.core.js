/* Poor man pub/sub handler, enough for now */

L.UmapSingleton = L.Evented.extend({});
L.U = new L.UmapSingleton();
L.U.Map = L.Map.extend({});

/*
* Utils
*/
L.Util.queryString = function (name, fallback) {
    var decode = function (s) { return decodeURIComponent(s.replace(/\+/g, ' ')); };
    var qs = window.location.search.slice(1).split('&'), qa = {};
    for (var i in qs) {
        var key = qs[i].split('=');
        if (!key) continue;
        qa[decode(key[0])] = key[1] ? decode(key[1]) : 1;
    }
    return qa[name] || fallback;
};

L.Util.booleanFromQueryString = function (name) {
    var value = L.Util.queryString(name);
    return value === '1' || value === 'true';
};

L.Util.setFromQueryString = function (options, name) {
    var value = L.Util.queryString(name);
    if (typeof value !== 'undefined') options[name] = value;
};

L.Util.setBooleanFromQueryString = function (options, name) {
    var value = L.Util.queryString(name);
    if (typeof value !== 'undefined') options[name] = value == '1' || value == 'true';
};
L.Util.setNullableBooleanFromQueryString = function (options, name) {
    var value = L.Util.queryString(name);
    if (typeof value !== 'undefined') {
        if (value === 'null') value = null;
        else if (value === '0' || value === 'false') value = false;
        else value = true;
        options[name] = value;
    }
};
L.Util.escapeHTML = function (s) {
    s = s? s.toString() : '';
    return s.replace(/</gm, '&lt;');
};
L.Util.toHTML = function (r) {
    var ii;

    // detect newline format
    var newline = r.indexOf('\r\n') != -1 ? '\r\n' : r.indexOf('\n') != -1 ? '\n' : '';

    // Escape tags
    r = r.replace(/</gm, '&lt;');


    // headings and hr
    r = r.replace(/^### (.*)/gm, '<h5>$1</h5>');
    r = r.replace(/^## (.*)/gm, '<h4>$1</h4>');
    r = r.replace(/^# (.*)/gm, '<h3>$1</h3>');
    r = r.replace(/^---/gm, '<hr>');

    // bold, italics
    r = r.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    r = r.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // unordered lists
    r = r.replace(/^\*\* (.*)/gm, '<ul><ul><li>$1</li></ul></ul>');
    r = r.replace(/^\* (.*)/gm, '<ul><li>$1</li></ul>');
    for (ii = 0; ii < 3; ii++) r = r.replace(new RegExp('</ul>' + newline + '<ul>', 'g'), newline);

    // links
    r = r.replace(/(\[\[http)/g, '[[h_t_t_p');  // Escape for avoiding clash between [[http://xxx]] and http://xxx
    r = r.replace(/({{http)/g, '{{h_t_t_p');
    r = r.replace(/(=http)/g, '=h_t_t_p');  // http://xxx as query string, see https://github.com/umap-project/umap/issues/607
    r = r.replace(/(https?:[^ \<)\n]*)/g, '<a target="_blank" href="$1">$1</a>');
    r = r.replace(/\[\[(h_t_t_ps?:[^\]|]*?)\]\]/g, '<a target="_blank" href="$1">$1</a>');
    r = r.replace(/\[\[(h_t_t_ps?:[^|]*?)\|(.*?)\]\]/g, '<a target="_blank" href="$1">$2</a>');
    r = r.replace(/\[\[([^\]|]*?)\]\]/g, '<a href="$1">$1</a>');
    r = r.replace(/\[\[([^|]*?)\|(.*?)\]\]/g, '<a href="$1">$2</a>');

    // iframe
    r = r.replace(/{{{(h_t_t_ps?[^ |{]*)}}}/g, '<div><iframe frameborder="0" src="$1" width="100%" height="300px"></iframe></div>');
    r = r.replace(/{{{(h_t_t_ps?[^ |{]*)\|(\d*)(px)?}}}/g, '<div><iframe frameborder="0" src="$1" width="100%" height="$2px"></iframe></div>');
    r = r.replace(/{{{(h_t_t_ps?[^ |{]*)\|(\d*)(px)?\*(\d*)(px)?}}}/g, '<div><iframe frameborder="0" src="$1" width="$4px" height="$2px"></iframe></div>');

    // images
    r = r.replace(/{{([^\]|]*?)}}/g, '<img src="$1">');
    r = r.replace(/{{([^|]*?)\|(\d*?)}}/g, '<img src="$1" width="$2">');

    //Unescape http
    r = r.replace(/(h_t_t_p)/g, 'http');

    // Preserver line breaks
    if (newline) r = r.replace(new RegExp(newline + '(?=[^]+)', 'g'), '<br>' + newline);

    return r;
};
L.Util.isObject = function (what) {
    return typeof what === 'object' && what !== null;
};
L.Util.CopyJSON = function (geojson) {
    return JSON.parse(JSON.stringify(geojson));
};
L.Util.detectFileType = function (f) {
    var filename = f.name ? escape(f.name.toLowerCase()) : '';
    function ext(_) {
        return filename.indexOf(_) !== -1;
    }
    if (f.type === 'application/vnd.google-earth.kml+xml' || ext('.kml')) {
        return 'kml';
    }
    if (ext('.gpx')) return 'gpx';
    if (ext('.geojson') || ext('.json')) return 'geojson';
    if (f.type === 'text/csv' || ext('.csv') || ext('.tsv') || ext('.dsv')) {
        return 'csv';
    }
    if (ext('.xml') || ext('.osm')) return 'osm';
    if (ext('.umap')) return 'umap';
};

L.Util.usableOption = function (options, option) {
    return options[option] !== undefined && options[option] !== '';
};

L.Util.greedyTemplate = function (str, data, ignore) {
    function getValue(data, path) {
        var value = data
        for (var i = 0; i < path.length; i++) {
            value = value[path[i]]
            if (value === undefined) break;
        }
        return value;
    }

    return str.replace(/\{ *([\w_\:\."\|]+) *\}/g, function (str, key) {
        var vars = key.split('|'), value, path;
        for (var i = 0; i < vars.length; i++) {
            path = vars[i];
            if (path.startsWith('"') && path.endsWith('"')) value = path.substring(1, path.length -1); // static default value.
            else value = getValue(data, path.split('.'));
        }
        if (value === undefined) {
            if (ignore) value = str;
            else value = '';
        }
        return value;
    });
};

L.Util.sortFeatures = function (features, sortKey) {
    var sortKeys = (sortKey || 'name').split(',');

    var sort = function (a, b, i) {
        var sortKey = sortKeys[i], score,
            valA = a.properties[sortKey] || '',
            valB = b.properties[sortKey] || '';
        if (!valA) {
            score = -1;
        } else if (!valB) {
            score = 1;
        } else {
            score = valA.toString().toLowerCase().localeCompare(valB.toString().toLowerCase());
        }
        if (score === 0 && sortKeys[i + 1]) return sort(a, b, i + 1);
        return score;
    };

    features.sort(function (a, b) {
        if (!a.properties || !b.properties) {
            return 0;
        }
        return sort(a, b, 0);
    });


    return features;
};

L.Util.flattenCoordinates = function (coords) {
    while (coords[0] && typeof coords[0][0] !== 'number') coords = coords[0];
    return coords;
};


L.Util.buildQueryString = function (params) {
    var query_string = [];
    for (var key in params) {
        query_string.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
    }
    return query_string.join('&');
};

L.Util.getBaseUrl = function () {
    return '//' + window.location.host + window.location.pathname;
};

L.DomUtil.add = function (tagName, className, container, content) {
    var el = L.DomUtil.create(tagName, className, container);
    if (content) {
        if (content.nodeType && content.nodeType === 1) {
            el.appendChild(content);
        }
        else {
            el.innerHTML = content;
        }
    }
    return el;
};

L.DomUtil.createFieldset = function (container, legend, options) {
    options = options || {};
    var fieldset = L.DomUtil.create('div', 'fieldset toggle', container);
    var legendEl = L.DomUtil.add('h5', 'legend style_options_toggle', fieldset, legend);
    var fieldsEl = L.DomUtil.add('div', 'fields with-transition', fieldset);
    L.DomEvent.on(legendEl, 'click', function () {
        if (L.DomUtil.hasClass(fieldset, 'on')) {
            L.DomUtil.removeClass(fieldset, 'on');
        } else {
            L.DomUtil.addClass(fieldset, 'on');
            if (options.callback) options.callback.call(options.context || this);
        }
    });
    return fieldsEl;
};

L.DomUtil.classIf = function (el, className, bool) {
    if (bool) L.DomUtil.addClass(el, className);
    else L.DomUtil.removeClass(el, className);
};


L.DomUtil.element = function (what, attrs, parent) {
    var el = document.createElement(what);
    for (var attr in attrs) {
        el[attr] = attrs[attr];
    }
    if (typeof parent !== 'undefined') {
        parent.appendChild(el);
    }
    return el;
};


L.DomUtil.before = function (target, el) {
    target.parentNode.insertBefore(el, target);
    return el;
};

L.DomUtil.after = function (target, el)
{
    target.parentNode.insertBefore(el, target.nextSibling);
    return el;
};

L.DomUtil.RGBRegex = /rgb *\( *([0-9]{1,3}) *, *([0-9]{1,3}) *, *([0-9]{1,3}) *\)/;

L.DomUtil.TextColorFromBackgroundColor = function (el) {
    var out = '#000000';
    if (!window.getComputedStyle) {return out;}
    var rgb = window.getComputedStyle(el).getPropertyValue('background-color');
    rgb = L.DomUtil.RGBRegex.exec(rgb);
    if (!rgb || rgb.length !== 4) {return out;}
    rgb = parseInt(rgb[1], 10) + parseInt(rgb[2], 10) + parseInt(rgb[3], 10);
    if (rgb < (255 * 3 / 2)) {
        out = '#ffffff';
    }
    return out;
};
L.DomEvent.once = function (el, types, fn, context) {
    // cf https://github.com/Leaflet/Leaflet/pull/3528#issuecomment-134551575

    if (typeof types === 'object') {
        for (var type in types) {
            L.DomEvent.once(el, type, types[type], fn);
        }
        return L.DomEvent;
    }

    var handler = L.bind(function () {
        L.DomEvent
            .off(el, types, fn, context)
            .off(el, types, handler, context);
    }, L.DomEvent);

    // add a listener that's executed once and removed after that
    return L.DomEvent
        .on(el, types, fn, context)
        .on(el, types, handler, context);
};


/*
* Global events
*/
L.U.Keys = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    TAB: 9,
    ENTER: 13,
    ESC: 27,
    APPLE: 91,
    SHIFT: 16,
    ALT: 17,
    CTRL: 18,
    E: 69,
    F: 70,
    H: 72,
    I: 73,
    L: 76,
    M: 77,
    P: 80,
    S: 83,
    Z: 90
};


L.U.Help = L.Class.extend({

    initialize: function (map) {
        this.map = map;
        this.box = L.DomUtil.create('div', 'umap-help-box with-transition dark', document.body);
        var closeLink = L.DomUtil.create('a', 'umap-close-link', this.box);
        closeLink.href = '#';
        L.DomUtil.add('i', 'umap-close-icon', closeLink);
        var label = L.DomUtil.create('span', '', closeLink);
        label.title = label.textContent = L._('Close');
        this.content = L.DomUtil.create('div', 'umap-help-content', this.box);
        L.DomEvent.on(closeLink, 'click', this.hide, this);
    },

    onKeyDown: function (e) {
        var key = e.keyCode,
            ESC = 27;
        if (key === ESC) {
            this.hide();
        }
    },

    show: function () {
        this.content.innerHTML = '';
        for (var i = 0, name; i < arguments.length; i++) {
            name = arguments[i];
            L.DomUtil.add('div', 'umap-help-entry', this.content, this.resolve(name));
        }
        L.DomUtil.addClass(document.body, 'umap-help-on');
    },

    hide: function () {
        L.DomUtil.removeClass(document.body, 'umap-help-on');
    },

    visible: function () {
        return L.DomUtil.hasClass(document.body, 'umap-help-on')
    },

    resolve: function (name) {
        return typeof this[name] === 'function' ? this[name]() : this[name];
    },

    button: function (container, entries) {
        var helpButton = L.DomUtil.create('a', 'umap-help-button', container);
        helpButton.href = '#';
        if (entries) {
            L.DomEvent
                .on(helpButton, 'click', L.DomEvent.stop)
                .on(helpButton, 'click', function (e) {
                    var args = typeof entries === 'string' ? [entries] : entries;
                    this.show.apply(this, args);
                }, this);
        }
        return helpButton;
    },

    edit: function () {
        var container = L.DomUtil.create('div', ''),
            self = this,
            title = L.DomUtil.create('h3', '', container),
            actionsContainer = L.DomUtil.create('ul', 'umap-edit-actions', container);
        var addAction = function (action) {
            var actionContainer = L.DomUtil.add('li', '', actionsContainer);
            L.DomUtil.add('i', action.options.className, actionContainer),
            L.DomUtil.add('span', '', actionContainer, action.options.tooltip);
            L.DomEvent.on(actionContainer, 'click', action.addHooks, action);
            L.DomEvent.on(actionContainer, 'click', self.hide, self);
        };
        title.textContent = L._('Where do we go from here?');
        for (var id in this.map.helpMenuActions) {
            addAction(this.map.helpMenuActions[id]);
        }
        return container;
    },

    importFormats: function () {
        var container = L.DomUtil.create('div');
        L.DomUtil.add('h3', '', container, 'GeojSON');
        L.DomUtil.add('p', '', container, L._('All properties are imported.'));
        L.DomUtil.add('h3', '', container, 'GPX');
        L.DomUtil.add('p', '', container, L._('Properties imported:') + 'name, desc');
        L.DomUtil.add('h3', '', container, 'KML');
        L.DomUtil.add('p', '', container, L._('Properties imported:') + 'name, description');
        L.DomUtil.add('h3', '', container, 'CSV');
        L.DomUtil.add('p', '', container, L._('Comma, tab or semi-colon separated values. SRS WGS84 is implied. Only Point geometries are imported. The import will look at the column headers for any mention of «lat» and «lon» at the begining of the header, case insensitive. All other column are imported as properties.'));
        L.DomUtil.add('h3', '', container, 'uMap');
        L.DomUtil.add('p', '', container, L._('Imports all umap data, including layers and settings.'));
        return container;
    },

    textFormatting: function () {
        var container = L.DomUtil.create('div'),
            title = L.DomUtil.add('h3', '', container, L._('Text formatting')),
            elements = L.DomUtil.create('ul', '', container);
        L.DomUtil.add('li', '', elements, L._('*simple star for italic*'));
        L.DomUtil.add('li', '', elements, L._('**double star for bold**'));
        L.DomUtil.add('li', '', elements, L._('# one hash for main heading'));
        L.DomUtil.add('li', '', elements, L._('## two hashes for second heading'));
        L.DomUtil.add('li', '', elements, L._('### three hashes for third heading'));
        L.DomUtil.add('li', '', elements, L._('Simple link: [[http://example.com]]'));
        L.DomUtil.add('li', '', elements, L._('Link with text: [[http://example.com|text of the link]]'));
        L.DomUtil.add('li', '', elements, L._('Image: {{http://image.url.com}}'));
        L.DomUtil.add('li', '', elements, L._('Image with custom width (in px): {{http://image.url.com|width}}'));
        L.DomUtil.add('li', '', elements, L._('Iframe: {{{http://iframe.url.com}}}'));
        L.DomUtil.add('li', '', elements, L._('Iframe with custom height (in px): {{{http://iframe.url.com|height}}}'));
        L.DomUtil.add('li', '', elements, L._('Iframe with custom height and width (in px): {{{http://iframe.url.com|height*width}}}'));
        L.DomUtil.add('li', '', elements, L._('--- for an horizontal rule'));
        return container;
    },

    dynamicProperties: function () {
        var container = L.DomUtil.create('div');
        L.DomUtil.add('h3', '', container, L._('Dynamic properties'));
        L.DomUtil.add('p', '', container, L._('Use placeholders with feature properties between brackets, eg. &#123;name&#125;, they will be dynamically replaced by the corresponding values.'));
        return container;
    },

    formatURL: L._('Supported variables that will be dynamically replaced') + ': {bbox}, {lat}, {lng}, {zoom}, {east}, {north}..., {left}, {top}...',
    formatIconSymbol: L._('Symbol can be either a unicode caracter or an URL. You can use feature properties as variables: ex.: with "http://myserver.org/images/{name}.png", the {name} variable will be replaced by the "name" value of each marker.'),
    colorValue: L._('Must be a valid CSS value (eg.: DarkBlue or #123456)'),
    smoothFactor: L._('How much to simplify the polyline on each zoom level (more = better performance and smoother look, less = more accurate)'),
    dashArray: L._('A comma separated list of numbers that defines the stroke dash pattern. Ex.: "5, 10, 15".'),
    zoomTo: L._('Zoom level for automatic zooms'),
    labelKey: L._('The name of the property to use as feature label (ex.: "nom")'),
    stroke: L._('Whether to display or not polygons paths.'),
    fill: L._('Whether to fill polygons with color.'),
    fillColor: L._('Optional. Same as color if not set.'),
    shortCredit: L._('Will be displayed in the bottom right corner of the map'),
    longCredit: L._('Will be visible in the caption of the map'),
    sortKey: L._('Property to use for sorting features'),
    slugKey: L._('The name of the property to use as feature unique identifier.'),
    filterKey: L._('Comma separated list of properties to use when filtering features'),
    interactive: L._('If false, the polygon will act as a part of the underlying map.'),
    outlink: L._('Define link to open in a new window on polygon click.'),
    dynamicRemoteData: L._('Fetch data each time map view changes.'),
    proxyRemoteData: L._('To use if remote server doesn\'t allow cross domain (slower)'),
    browsable: L._('Set it to false to hide this layer from the slideshow, the data browser, the popup navigation…')
});


L.U.Orderable = L.Evented.extend({

    options: {
        selector: 'li',
        color: '#374E75'
    },

    initialize: function (parent, options) {
        L.Util.setOptions(this, options);
        this.parent = parent;
        this.src = null;
        this.dst = null;
        this.els = this.parent.querySelectorAll(this.options.selector);
        for (var i = 0; i < this.els.length; i++) this.makeDraggable(this.els[i]);
    },

    makeDraggable: function (node) {
        node.draggable = true;
        L.DomEvent.on(node, 'dragstart', this.onDragStart, this);
        L.DomEvent.on(node, 'dragenter', this.onDragEnter, this);
        L.DomEvent.on(node, 'dragover', this.onDragOver, this);
        L.DomEvent.on(node, 'dragleave', this.onDragLeave, this);
        L.DomEvent.on(node, 'drop', this.onDrop, this);
        L.DomEvent.on(node, 'dragend', this.onDragEnd, this);
    },

    nodeIndex: function (node) {
        return Array.prototype.indexOf.call(this.parent.children, node);
    },

    findTarget: function (node) {
        while (node) {
            if (this.nodeIndex(node) !== -1) return node;
            node = node.parentNode;
        }
    },

    onDragStart: function (e) {
        // e.target is the source node.
        this.src = e.target;
        this.initialIndex = this.nodeIndex(this.src);
        this.srcBackgroundColor = this.src.style.backgroundColor;
        this.src.style.backgroundColor = this.options.color;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.src.innerHTML);
    },

    onDragOver: function (e) {
        if (e.preventDefault) e.preventDefault();  // Necessary. Allows us to drop.
        e.dataTransfer.dropEffect = 'move';
        return false;
    },

    onDragEnter: function (e) {
        // e.target is the current hover target.
        var dst = this.findTarget(e.target);
        if (!dst || dst === this.src) return;
        this.dst = dst;
        var targetIndex = this.nodeIndex(this.dst),
            srcIndex = this.nodeIndex(this.src);
        if (targetIndex > srcIndex) this.parent.insertBefore(this.dst, this.src);
        else this.parent.insertBefore(this.src, this.dst);
    },

    onDragLeave: function (e) {
        // e.target is previous target element.
    },

    onDrop: function (e) {
        // e.target is current target element.
        if (e.stopPropagation) e.stopPropagation();  // Stops the browser from redirecting.
        if (!this.dst) return;
        this.fire('drop', {
            src: this.src,
            initialIndex: this.initialIndex,
            finalIndex: this.nodeIndex(this.src),
            dst: this.dst
        });
        return false;
    },

    onDragEnd: function (e) {
        // e.target is the source node.
        this.src.style.backgroundColor = this.srcBackgroundColor;
    }

});

L.LatLng.prototype.isValid = function () {
    return !isNaN(this.lat) && !isNaN(this.lng);
}
