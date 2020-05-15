L.U.Slideshow = L.Class.extend({

    statics: {
        CLASSNAME: 'umap-slideshow-active'
    },

    options: {
        delay: 5000,
        autoplay: false
    },

    initialize: function (map, options) {
        this.setOptions(options);
        this.map = map;
        this._id = null;
        var current = null,  // current feature
            self = this;
        try {
            Object.defineProperty(this, 'current', {
                get: function () {
                    if (!current) {
                        var datalayer = this.defaultDatalayer();
                        if (datalayer) current = datalayer.getFeatureByIndex(0);
                    }
                    return current;
                },
                set: function (feature) {
                    current = feature;
                }
            });
        }
        catch (e) {
            // Certainly IE8, which has a limited version of defineProperty
        }
        try {
            Object.defineProperty(this, 'next', {
                get: function () {
                    if (!current) {
                        return self.current;
                    }
                    return current.getNext();
                }
            });
        }
        catch (e) {
            // Certainly IE8, which has a limited version of defineProperty
        }
        if (this.options.autoplay) {
            this.map.onceDataLoaded(function () {
                this.play();
            }, this);
        }
        this.map.on('edit:enabled', function () {
            this.stop();
        }, this);
    },

    setOptions: function (options) {
        L.setOptions(this, options);
        this.timeSpinner();
    },

    defaultDatalayer: function () {
        return this.map.findDataLayer(function (d) { return d.allowBrowse() && d.hasData(); });
    },

    timeSpinner: function () {
        var time = parseInt(this.options.delay, 10);
        if (!time) return;
        var css = 'rotation ' + time / 1000 + 's infinite linear',
            spinners = document.querySelectorAll('.umap-slideshow-toolbox .play .spinner');
        for (var i = 0; i < spinners.length; i++) {
            spinners[i].style.animation = css;
            spinners[i].style['-webkit-animation'] = css;
            spinners[i].style['-moz-animation'] = css;
            spinners[i].style['-o-animation'] = css;
        }
    },

    resetSpinners: function () {
        // Make that animnation is coordinated with user actions
        var spinners = document.querySelectorAll('.umap-slideshow-toolbox .play .spinner'),
            el, newOne;
        for (var i = 0; i < spinners.length; i++) {
            el = spinners[i];
            newOne = el.cloneNode(true);
            el.parentNode.replaceChild(newOne, el);
        }
    },

    play: function () {
        if (this._id) return;
        if (this.map.editEnabled || !this.map.options.slideshow.active) return;
        L.DomUtil.addClass(document.body, L.U.Slideshow.CLASSNAME);
        this._id = window.setInterval(L.bind(this.loop, this), this.options.delay);
        this.resetSpinners();
        this.loop();
    },

    loop: function () {
        this.current = this.next;
        this.step();
    },

    pause: function () {
        if (this._id) {
            L.DomUtil.removeClass(document.body, L.U.Slideshow.CLASSNAME);
            window.clearInterval(this._id);
            this._id = null;
        }
    },

    stop: function () {
        this.pause();
        this.current = null;
    },

    forward: function () {
        this.pause();
        this.current = this.next;
        this.step();
    },

    backward: function () {
        this.pause();
        if (this.current) this.current = this.current.getPrevious();
        this.step();
    },

    step: function () {
        if(!this.current) return this.stop();
        this.current.zoomTo({easing: this.options.easing});
        this.current.view();
    },

    renderToolbox: function (container) {
        var box = L.DomUtil.create('ul', 'umap-slideshow-toolbox'),
            play = L.DomUtil.create('li', 'play', box),
            stop = L.DomUtil.create('li', 'stop', box),
            prev = L.DomUtil.create('li', 'prev', box),
            next = L.DomUtil.create('li', 'next', box);
        L.DomUtil.create('div', 'spinner', play);
        play.title = L._('Start slideshow');
        stop.title = L._('Stop slideshow');
        next.title = L._('Zoom to the next');
        prev.title = L._('Zoom to the previous');
        var toggle = function () {
            if (this._id) this.pause();
            else this.play();
        };
        L.DomEvent.on(play, 'click', L.DomEvent.stop)
                  .on(play, 'click', toggle, this);
        L.DomEvent.on(stop, 'click', L.DomEvent.stop)
                  .on(stop, 'click', this.stop, this);
        L.DomEvent.on(prev, 'click', L.DomEvent.stop)
                  .on(prev, 'click', this.backward, this);
        L.DomEvent.on(next, 'click', L.DomEvent.stop)
                  .on(next, 'click', this.forward, this);
        container.appendChild(box);
        this.timeSpinner();
        return box;
    }

});
