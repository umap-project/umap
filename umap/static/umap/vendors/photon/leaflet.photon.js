L.PhotonBase = L.Class.extend({

    forEach: function (els, callback) {
        Array.prototype.forEach.call(els, callback);
    },

    ajax: function (callback, thisobj) {
        if (typeof this.xhr === 'object') {
            this.xhr.abort();
        }
        this.xhr = new XMLHttpRequest();
        var self = this;
        this.xhr.open('GET', this.options.url + this.buildQueryString(this.getParams()), true);

        this.xhr.onload = function(e) {
            self.fire('ajax:return');
            if (this.status === 200) {
                if (callback) {
                    var raw = this.response;
                    raw = JSON.parse(raw);
                    callback.call(thisobj || this, raw);
                }
            }
            delete this.xhr;
        };

        this.fire('ajax:send');
        this.xhr.send();
    },

    buildQueryString: function (params) {
        var queryString = [];
        for (var key in params) {
            if (params[key]) {
                queryString.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
            }
        }
        return queryString.join('&');
    },

    featureToPopupContent: function (feature) {
        var container = L.DomUtil.create('div', 'leaflet-photon-popup'),
            title = L.DomUtil.create('h3', '', container);
        title.innerHTML = feature.properties.label;
        return container;
    }

});


L.PhotonBaseSearch = L.PhotonBase.extend({

    includes: ((typeof L.Evented !== 'undefined' && L.Evented.prototype) || L.Mixin.Events),

    options: {
        url: 'https://photon.komoot.io/api/?',
        placeholder: 'Start typing...',
        minChar: 3,
        limit: 5,
        submitDelay: 300,
        includePosition: true,
        bbox: null,
        noResultLabel: 'No result',
        feedbackEmail: 'photon@komoot.de',  // Set to null to remove feedback box
        feedbackLabel: 'Feedback'
    },

    CACHE: '',
    RESULTS: [],
    KEYS: {
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        TAB: 9,
        RETURN: 13,
        ESC: 27,
        APPLE: 91,
        SHIFT: 16,
        ALT: 17,
        CTRL: 18
    },

    initialize: function (input, options) {
        this.input = input;
        L.setOptions(this, options);
        var CURRENT = null;

        try {
            Object.defineProperty(this, 'CURRENT', {
                get: function () {
                    return CURRENT;
                },
                set: function (index) {
                    if (typeof index === 'object') {
                        index = this.resultToIndex(index);
                    }
                    CURRENT = index;
                }
            });
        } catch (e) {
            // Hello IE8
        }
        this.input.type = L.Browser.ie ? 'text' : 'search';
        this.input.placeholder = this.options.placeholder;
        this.input.autocomplete = 'off';
        this.input.autocorrect = 'off';
        L.DomEvent.disableClickPropagation(this.input);

        L.DomEvent.on(this.input, 'keydown', this.onKeyDown, this);
        L.DomEvent.on(this.input, 'input', this.onInput, this);
        L.DomEvent.on(this.input, 'blur', this.onBlur, this);
        L.DomEvent.on(this.input, 'focus', this.onFocus, this);
        this.createResultsContainer();
    },

    createResultsContainer: function () {
        this.resultsContainer = this.options.resultsContainer || L.DomUtil.create('ul', 'photon-autocomplete', document.querySelector('body'));
    },

    resizeContainer: function()
    {
        var l = this.getLeft(this.input);
        var t = this.getTop(this.input) + this.input.offsetHeight;
        this.resultsContainer.style.left = l + 'px';
        this.resultsContainer.style.top = t + 'px';
        var width = this.options.width ? this.options.width : this.input.offsetWidth - 2;
        this.resultsContainer.style.width = width + 'px';
    },

    onKeyDown: function (e) {
        switch (e.keyCode) {
            case this.KEYS.TAB:
                if(this.CURRENT !== null)
                {
                    this.setChoice();
                }
                L.DomEvent.stop(e);
                break;
            case this.KEYS.RETURN:
                L.DomEvent.stop(e);
                this.setChoice();
                break;
            case this.KEYS.ESC:
                L.DomEvent.stop(e);
                this.hide();
                this.input.blur();
                break;
            case this.KEYS.DOWN:
                if(this.RESULTS.length > 0) {
                    if(this.CURRENT !== null && this.CURRENT < this.RESULTS.length - 1) { // what if one resutl?
                        this.CURRENT++;
                        this.highlight();
                    }
                    else if(this.CURRENT === null) {
                        this.CURRENT = 0;
                        this.highlight();
                    }
                }
                break;
            case this.KEYS.UP:
                if(this.CURRENT !== null) {
                    L.DomEvent.stop(e);
                }
                if(this.RESULTS.length > 0) {
                    if(this.CURRENT > 0) {
                        this.CURRENT--;
                        this.highlight();
                    }
                    else if(this.CURRENT === 0) {
                        this.CURRENT = null;
                        this.highlight();
                    }
                }
                break;
        }
    },

    onInput: function (e) {
        if (typeof this.submitDelay === 'number') {
            window.clearTimeout(this.submitDelay);
            delete this.submitDelay;
        }
        this.submitDelay = window.setTimeout(L.Util.bind(this.search, this), this.options.submitDelay);
    },

    onBlur: function (e) {
        this.fire('blur');
        var self = this;
        setTimeout(function () {
            self.hide();
        }, 100);
    },

    onFocus: function (e) {
        this.fire('focus');
        this.input.select();
        this.search();  // In case we have a value from a previous search.
    },

    clear: function () {
        this.RESULTS = [];
        this.CURRENT = null;
        this.CACHE = '';
        this.resultsContainer.innerHTML = '';
    },

    hide: function() {
        this.fire('hide');
        this.clear();
        this.resultsContainer.style.display = 'none';
    },

    setChoice: function (choice) {
        choice = choice || this.RESULTS[this.CURRENT];
        if (choice) {
            this.hide();
            this.fire('selected', {choice: choice.feature});
            this.onSelected(choice.feature);
            this.input.value = '';
        }
    },

    search: function() {
        var val = this.input.value;
        var minChar = typeof this.options.minChar === 'function' ? this.options.minChar(val) : val.length >= this.options.minChar;
        if (!val || !minChar) return this.clear();
        if(val + '' === this.CACHE + '') return;
        else this.CACHE = val;
        this._doSearch();
    },

    _doSearch: function () {
        this.ajax(this.handleResults, this);
    },

    _onSelected: function (feature) {
    },

    onSelected: function (choice) {
        return (this.options.onSelected || this._onSelected).call(this, choice);
    },

    _formatResult: function (feature, el) {
        var title = L.DomUtil.create('strong', '', el),
            detailsContainer = L.DomUtil.create('small', '', el),
            details = [],
            type = this.formatType(feature);
        if (feature.properties.name) {
            title.innerHTML = feature.properties.name;
        } else if (feature.properties.housenumber) {
            title.innerHTML = feature.properties.housenumber;
            if (feature.properties.street) {
                title.innerHTML += ' ' + feature.properties.street;
            }
        }
        if (type) details.push(type);
        if (feature.properties.city && feature.properties.city !== feature.properties.name) {
            details.push(feature.properties.city);
        }
        if (feature.properties.state && feature.properties.state !== feature.properties.name) {
            details.push(feature.properties.state);
        }
        if (feature.properties.country) details.push(feature.properties.country);
        detailsContainer.innerHTML = details.join(', ');
    },

    formatResult: function (feature, el) {
        return (this.options.formatResult || this._formatResult).call(this, feature, el);
    },

    formatType: function (feature) {
        return (this.options.formatType || this._formatType).call(this, feature);
    },

    _formatType: function (feature) {
        return feature.properties.osm_value === 'yes'
               ? feature.properties.osm_key
               : feature.properties.osm_value;
    },

    createResult: function (feature) {
        var el = L.DomUtil.create('li', '', this.resultsContainer);
        this.formatResult(feature, el);
        var result = {
            feature: feature,
            el: el
        };
        // Touch handling needed
        L.DomEvent.on(el, 'mouseover', function (e) {
            this.CURRENT = result;
            this.highlight();
        }, this);
        L.DomEvent.on(el, 'mousedown', function (e) {
            this.setChoice();
        }, this);
        return result;
    },

    resultToIndex: function (result) {
        var out = null;
        this.forEach(this.RESULTS, function (item, index) {
            if (item === result) {
                out = index;
                return;
            }
        });
        return out;
    },

    handleResults: function(geojson) {
        var self = this;
        this.clear();
        this.resultsContainer.style.display = 'block';
        this.resizeContainer();
        this.forEach(geojson.features, function (feature) {
            self.RESULTS.push(self.createResult(feature));
        });
        if (geojson.features.length === 0) {
            var noresult = L.DomUtil.create('li', 'photon-no-result', this.resultsContainer);
            noresult.innerHTML = this.options.noResultLabel;
        }
        if (this.options.feedbackEmail) {
            var feedback = L.DomUtil.create('a', 'photon-feedback', this.resultsContainer);
            feedback.href = 'mailto:' + this.options.feedbackEmail;
            feedback.innerHTML = this.options.feedbackLabel;
        }
        this.CURRENT = 0;
        this.highlight();
        if (this.options.resultsHandler) {
            this.options.resultsHandler(geojson);
        }
    },

    highlight: function () {
        var self = this;
        this.forEach(this.RESULTS, function (item, index) {
            if (index === self.CURRENT) {
                L.DomUtil.addClass(item.el, 'on');
            }
            else {
                L.DomUtil.removeClass(item.el, 'on');
            }
        });
    },

    getLeft: function (el) {
        var tmp = el.offsetLeft;
        el = el.offsetParent;
        while(el) {
            tmp += el.offsetLeft;
            el = el.offsetParent;
        }
        return tmp;
    },

    getTop: function (el) {
        var tmp = el.offsetTop;
        el = el.offsetParent;
        while(el) {
            tmp += el.offsetTop;
            el = el.offsetParent;
        }
        return tmp;
    },

    getParams: function () {
        return {
            q: this.CACHE,
            lang: this.options.lang,
            limit: this.options.limit,
            osm_tag: this.options.osm_tag
        };
    }

});

L.PhotonSearch = L.PhotonBaseSearch.extend({

    initialize: function (map, input, options) {
        this.map = map;
        L.PhotonBaseSearch.prototype.initialize.call(this, input, options);
    },

    _onSelected: function (feature) {
        this.map.setView([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], 16);
    },

    getParams: function () {
        var params = L.PhotonBaseSearch.prototype.getParams.call(this);
        if (this.options.includePosition) {
            params.lat = this.map.getCenter().lat;
            params.lon = this.map.getCenter().lng;
            if (this.options.location_bias_scale) {
                params.location_bias_scale = this.options.location_bias_scale;
            }
        }
        if (this.options.bbox && this.options.bbox.length === 4) {
            params.bbox = this.options.bbox.join(',');
        }
        return params;
    }

});

L.Control.Photon = L.Control.extend({

    includes: ((typeof L.Evented !== 'undefined' && L.Evented.prototype) || L.Mixin.Events),

    onAdd: function (map, options) {
        this.map = map;
        this.container = L.DomUtil.create('div', 'leaflet-photon');

        this.options = L.Util.extend(this.options, options);

        this.input = L.DomUtil.create('input', 'photon-input', this.container);
        this.search = new L.PhotonSearch(map, this.input, this.options);
        this.search.on('blur', this.forwardEvent, this);
        this.search.on('focus', this.forwardEvent, this);
        this.search.on('hide', this.forwardEvent, this);
        this.search.on('selected', this.forwardEvent, this);
        this.search.on('ajax:send', this.forwardEvent, this);
        this.search.on('ajax:return', this.forwardEvent, this);
        return this.container;
    },

    // TODO onRemove

    forwardEvent: function (e) {
        this.fire(e.type, e);
    }

});

L.control.photon = function(options) {
    return new L.Control.Photon(options);
}

L.Map.addInitHook(function () {
    if (this.options.photonControl) {
        this.photonControl = new L.Control.Photon(this.options.photonControlOptions || {});
        this.addControl(this.photonControl);
    }
});

L.PhotonReverse = L.PhotonBase.extend({

    includes: ((typeof L.Evented !== 'undefined' && L.Evented.prototype) || L.Mixin.Events),

    options: {
        url: 'https://photon.komoot.io/reverse/?',
        limit: 1,
        handleResults: null
    },

    initialize: function (options) {
        L.setOptions(this, options);
    },

    doReverse: function (latlng) {
        latlng = L.latLng(latlng);
        this.fire('reverse', {latlng: latlng});
        this.latlng = latlng;
        this.ajax(this.handleResults, this);
    },

    _handleResults: function (data) {
        /*eslint-disable no-console */
        console.log(data);
        /*eslint-enable no-alert */
    },

    handleResults: function (data) {
        return (this.options.handleResults || this._handleResults).call(this, data);
    },

    getParams: function () {
        return {
            lang: this.options.lang,
            limit: this.options.limit,
            lat: this.latlng.lat,
            lon: this.latlng.lng,
            osm_tag: this.options.osm_tag
        };
    }

});
