/*
* Modals
*/
L.U.UI = L.Evented.extend({

    ALERTS: Array(),
    ALERT_ID:  null,
    TOOLTIP_ID:  null,

    initialize: function (parent) {
        this.parent = parent;
        this.container = L.DomUtil.create('div', 'leaflet-ui-container', this.parent);
        L.DomEvent.disableClickPropagation(this.container);
        L.DomEvent.on(this.container, 'contextmenu', L.DomEvent.stopPropagation);  // Do not activate our custom context menu.
        L.DomEvent.on(this.container, 'mousewheel', L.DomEvent.stopPropagation);
        L.DomEvent.on(this.container, 'MozMousePixelScroll', L.DomEvent.stopPropagation);
        this._panel = L.DomUtil.create('div', '', this.container);
        this._panel.id = 'umap-ui-container';
        this._alert = L.DomUtil.create('div', 'with-transition', this.container);
        this._alert.id = 'umap-alert-container';
        this._tooltip = L.DomUtil.create('div', '', this.container);
        this._tooltip.id = 'umap-tooltip-container';
    },

    resetPanelClassName: function () {
        this._panel.className = 'with-transition';
    },

    openPanel: function (e) {
        this.fire('panel:open');
        // We reset all because we can't know which class has been added
        // by previous ui processes...
        this.resetPanelClassName();
        this._panel.innerHTML = '';
        var actionsContainer = L.DomUtil.create('ul', 'toolbox', this._panel);
        var body = L.DomUtil.create('div', 'body', this._panel);
        if (e.data.html.nodeType && e.data.html.nodeType === 1) body.appendChild(e.data.html);
        else body.innerHTML = e.data.html;
        var closeLink = L.DomUtil.create('li', 'umap-close-link', actionsContainer);
        L.DomUtil.add('i', 'umap-close-icon', closeLink);
        var label = L.DomUtil.create('span', '', closeLink);
        label.title = label.textContent = L._('Close');
        if (e.actions) {
            for (var i = 0; i < e.actions.length; i++) {
                actionsContainer.appendChild(e.actions[i]);
            }
        }
        if (e.className) L.DomUtil.addClass(this._panel, e.className);
        if (L.DomUtil.hasClass(this.parent, 'umap-ui')) {
            // Already open.
            this.fire('panel:ready');
        } else {
            L.DomEvent.once(this._panel, 'transitionend', function (e) {
                this.fire('panel:ready');
            }, this);
            L.DomUtil.addClass(this.parent, 'umap-ui');
        }
        L.DomEvent.on(closeLink, 'click', this.closePanel, this);
    },

    closePanel: function () {
        this.resetPanelClassName();
        L.DomUtil.removeClass(this.parent, 'umap-ui');
        this.fire('panel:closed');
    },

    alert: function (e) {
        if (L.DomUtil.hasClass(this.parent, 'umap-alert')) this.ALERTS.push(e);
        else this.popAlert(e);
    },

    popAlert: function (e) {
        var self = this;
        if(!e) {
            if (this.ALERTS.length) e = this.ALERTS.pop();
            else return;
        }
        var timeoutID,
            level_class = e.level && e.level == 'info'? 'info': 'error';
        this._alert.innerHTML = '';
        L.DomUtil.addClass(this.parent, 'umap-alert');
        L.DomUtil.addClass(this._alert, level_class);
        var close = function () {
            if (timeoutID !== this.ALERT_ID) { return;}  // Another alert has been forced
            this._alert.innerHTML = '';
            L.DomUtil.removeClass(this.parent, 'umap-alert');
            L.DomUtil.removeClass(this._alert, level_class);
            if (timeoutID) window.clearTimeout(timeoutID);
            this.popAlert();
        };
        var closeLink = L.DomUtil.create('a', 'umap-close-link', this._alert);
        closeLink.href = '#';
        L.DomUtil.add('i', 'umap-close-icon', closeLink);
        var label = L.DomUtil.create('span', '', closeLink);
        label.title = label.textContent = L._('Close');
        L.DomEvent.on(closeLink, 'click', L.DomEvent.stop)
                  .on(closeLink, 'click', close, this);
        L.DomUtil.add('div', '', this._alert, e.content);
        if (e.actions) {
            var action, el;
            for (var i = 0; i < e.actions.length; i++) {
                action = e.actions[i];
                el = L.DomUtil.element('a', {'className': 'umap-action'}, this._alert);
                el.href = '#';
                el.textContent = action.label;
                L.DomEvent.on(el, 'click', L.DomEvent.stop)
                          .on(el, 'click', close, this);
                if (action.callback) L.DomEvent.on(el, 'click', action.callback, action.callbackContext || this.map);
            }
        }
        self.ALERT_ID = timeoutID = window.setTimeout(L.bind(close, this), e.duration || 3000);
    },

    tooltip: function (e) {
        this.TOOLTIP_ID = Math.random();
        var id = this.TOOLTIP_ID;
        L.DomUtil.addClass(this.parent, 'umap-tooltip');
        if (e.anchor && e.position === 'top') this.anchorTooltipTop(e.anchor);
        else if (e.anchor && e.position === 'left') this.anchorTooltipLeft(e.anchor);
        else this.anchorTooltipAbsolute();
        this._tooltip.innerHTML = e.content;
        function closeIt () { this.closeTooltip(id); }
        if (e.anchor) L.DomEvent.once(e.anchor, 'mouseout', closeIt, this);
        if (e.duration !== Infinity) window.setTimeout(L.bind(closeIt, this), e.duration || 3000);
    },

    anchorTooltipAbsolute: function () {
        this._tooltip.className = '';
        var left = this.parent.offsetLeft + (this.parent.clientWidth / 2) - (this._tooltip.clientWidth / 2),
            top = this.parent.offsetTop + 75;
        this.setTooltipPosition({top: top, left: left});
    },

    anchorTooltipTop: function (el) {
        this._tooltip.className = 'tooltip-top';
        var coords = this.getPosition(el);
        this.setTooltipPosition({left: coords.left - 10, bottom: this.getDocHeight() - coords.top + 11});
    },

    anchorTooltipLeft: function (el) {
        this._tooltip.className = 'tooltip-left';
        var coords = this.getPosition(el);
        this.setTooltipPosition({top: coords.top, right: document.documentElement.offsetWidth - coords.left + 11});
    },

    closeTooltip: function (id) {
        if (id && id !== this.TOOLTIP_ID) return;
        this._tooltip.innerHTML = '';
        L.DomUtil.removeClass(this.parent, 'umap-tooltip');
    },

    getPosition: function (el) {
        return el.getBoundingClientRect();
    },

    setTooltipPosition: function (coords) {
        if (coords.left) this._tooltip.style.left = coords.left + 'px';
        else this._tooltip.style.left = 'initial';
        if (coords.right) this._tooltip.style.right = coords.right + 'px';
        else this._tooltip.style.right = 'initial';
        if (coords.top) this._tooltip.style.top = coords.top + 'px';
        else this._tooltip.style.top = 'initial';
        if (coords.bottom) this._tooltip.style.bottom = coords.bottom + 'px';
        else this._tooltip.style.bottom = 'initial';
    },

    getDocHeight: function () {
        var D = document;
        return Math.max(
            D.body.scrollHeight, D.documentElement.scrollHeight,
            D.body.offsetHeight, D.documentElement.offsetHeight,
            D.body.clientHeight, D.documentElement.clientHeight
        );
    },

});
