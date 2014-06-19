L.S.AutoComplete = L.Class.extend({

    options: {
        placeholder: 'Start typing...',
        emptyMessage: 'No result',
        allowFree: true,
        minChar: 2,
        maxResults: 5
    },

    CACHE: '',
    RESULTS: [],

    initialize: function (el, options) {
        this.el = L.DomUtil.get(el);
        L.setOptions(options);
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
        return this;
    },

    createInput: function () {
        this.input = L.DomUtil.element('input', {
            type: 'text',
            placeholder: this.options.placeholder,
            autocomplete: 'off'
        });
        L.DomUtil.before(this.el, this.input);
        L.DomEvent.on(this.input, 'keydown', this.onKeyDown, this);
        L.DomEvent.on(this.input, 'keyup', this.onKeyUp, this);
        L.DomEvent.on(this.input, 'blur', this.onBlur, this);
    },

    createContainer: function () {
        this.container = L.DomUtil.element('ul', {className: 'umap-autocomplete'}, document.body);
    },

    resizeContainer: function()
    {
        var l = this.getLeft(this.input);
        var t = this.getTop(this.input) + this.input.offsetHeight;
        this.container.style.left = l + 'px';
        this.container.style.top = t + 'px';
        var width = this.options.width ? this.options.width : this.input.offsetWidth - 2;
        this.container.style.width = width + 'px';
    },


    onKeyDown: function (e) {
        switch (e.keyCode) {
            case L.S.Keys.TAB:
                if(this.CURRENT !== null)
                {
                    this.setChoice();
                }
                L.DomEvent.stop(e);
                break;
            case L.S.Keys.ENTER:
                L.DomEvent.stop(e);
                this.setChoice();
                break;
            case L.S.Keys.ESC:
                L.DomEvent.stop(e);
                this.hide();
                break;
            case L.S.Keys.DOWN:
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
            case L.S.Keys.UP:
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

    onKeyUp: function (e) {
        var special = [
            L.S.Keys.TAB,
            L.S.Keys.ENTER,
            L.S.Keys.LEFT,
            L.S.Keys.RIGHT,
            L.S.Keys.DOWN,
            L.S.Keys.UP,
            L.S.Keys.APPLE,
            L.S.Keys.SHIFT,
            L.S.Keys.ALT,
            L.S.Keys.CTRL
        ];
        if (special.indexOf(e.keyCode) === -1)
        {
            this.search();
        }
    },

    onBlur: function () {
        var self = this;
        setTimeout(function () {
            self.hide();
        }, 100);
    },

    clear: function () {
        this.RESULTS = [];
        this.CURRENT = null;
        this.CACHE = '';
        this.container.innerHTML = '';
    },

    hide: function() {
        this.clear();
        this.container.style.display = 'none';
        this.input.value = '';
    },

    setChoice: function (choice) {
        choice = choice || this.RESULTS[this.CURRENT];
        if (choice) {
            this.input.value = choice.display;
            this.select(choice);
            this.displaySelected(choice);
            this.hide();
            if (this.options.callback) {
                L.Util.bind(this.options.callback, this)(choice);
            }
        }
    },

    search: function() {
        var val = this.input.value;
        if (val.length < this.options.minChar) {
            this.clear();
            return;
        }
        if(!val) {
            this.clear();
            return;
        }
        if( val + '' === this.CACHE + '') {
            return;
        }
        else {
            this.CACHE = val;
        }
        var results = this._do_search(val);
        return this.handleResults(results);
    },

    createResult: function (item) {
        var el = L.DomUtil.element('li', {}, this.container);
        el.innerHTML = item.display;
        var result = {
            value: item.value,
            display: item.display,
            el: el
        };
        L.DomEvent.on(el, 'mouseover', function () {
            this.CURRENT = result;
            this.highlight();
        }, this);
        L.DomEvent.on(el, 'mousedown', function () {
            this.setChoice();
        }, this);
        return result;
    },

    resultToIndex: function (result) {
        var out = null;
        this.forEach(this.RESULTS, function (item, index) {
            if (item.value == result.value) {
                out = index;
                return;
            }
        });
        return out;
    },

    handleResults: function(data) {
        var self = this;
        this.clear();
        this.container.style.display = 'block';
        this.resizeContainer();
        this.forEach(data, function (item) {
            self.RESULTS.push(self.createResult(item));
        });
        this.CURRENT = 0;
        this.highlight();
        //TODO manage no results
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

    forEach: function (els, callback) {
        Array.prototype.forEach.call(els, callback);
    }

});


L.S.AutoComplete.BaseSelect = L.S.AutoComplete.extend({

    initialize: function (el, options) {
        L.S.AutoComplete.prototype.initialize.call(this, el, options);
        if (!this.el) return this;
        this.el.style.display = 'none';
        this.createInput();
        this.createContainer();
        this.initSelectedContainer();
    },

    optionToResult: function (option) {
        return {
            value: option.value,
            display: option.innerHTML
        };
    },

    _do_search: function (val) {
        var results = [],
            self = this,
            count = 0;
        this.forEach(this.el, function (item) {
            if (item.innerHTML.toLowerCase().indexOf(val.toLowerCase()) !== -1 && !item.selected && count < self.options.maxResults) {
                results.push(self.optionToResult(item));
                count++;
            }
        });
        return results;
    },

    select: function (option) {
        this.forEach(this.el, function (item) {
            if (item.value == option.value) {
                item.selected = true;
            }
        });
    },

    unselect: function (option) {
        this.forEach(this.el, function (item) {
            if (item.value == option.value) {
                item.selected = false;
            }
        });
    }

});

L.S.AutoComplete.MultiSelect = L.S.AutoComplete.BaseSelect.extend({

    initSelectedContainer: function () {
        this.selected_container = L.DomUtil.after(this.input, L.DomUtil.element('ul', {className: 'umap-multiresult'}));
        var self = this;
        this.forEach(this.el, function (option) {
            if (option.selected) {
                self.displaySelected(self.optionToResult(option));
            }
        });
    },

    displaySelected: function (result) {
        var result_el = L.DomUtil.element('li', {}, this.selected_container);
        result_el.innerHTML = result.display;
        var close = L.DomUtil.element('span', {className: 'close'}, result_el);
        close.innerHTML = '×';
        L.DomEvent.on(close, 'click', function () {
            this.selected_container.removeChild(result_el);
            this.unselect(result);
        }, this);
        this.hide();
    }

});

L.S.AutoComplete.multiSelect = function (el, options) {
    return new L.S.AutoComplete.MultiSelect(el, options);
};


L.S.AutoComplete.Select = L.S.AutoComplete.BaseSelect.extend({

    initSelectedContainer: function () {
        this.selected_container = L.DomUtil.after(this.input, L.DomUtil.element('div', {className: 'umap-singleresult'}));
        var self = this;
        if (this.el.selectedIndex !== -1 && this.el[this.el.selectedIndex].value !== '') {
            self.displaySelected(self.optionToResult(this.el[this.el.selectedIndex]));
        }
    },

    displaySelected: function (result) {
        var result_el = L.DomUtil.element('div', {}, this.selected_container);
        result_el.innerHTML = result.display;
        var close = L.DomUtil.element('span', {className: 'close'}, result_el);
        close.innerHTML = '×';
        this.input.style.display = 'none';
        L.DomEvent.on(close, 'click', function () {
            this.selected_container.innerHTML = '';
            this.unselect(result);
            this.input.style.display = 'block';
        }, this);
        this.hide();
    }

});

L.S.AutoComplete.select = function (el, options) {
    return new L.S.AutoComplete.Select(el, options);
};
