L.U.Xhr = L.Evented.extend({
  initialize: function (ui) {
    this.ui = ui
  },

  _wrapper: function () {
    let wrapper
    if (window.XMLHttpRequest === undefined) {
      wrapper = () => {
        try {
          return new window.ActiveXObject('Microsoft.XMLHTTP.6.0')
        } catch (e1) {
          try {
            return new window.ActiveXObject('Microsoft.XMLHTTP.3.0')
          } catch (e2) {
            throw new Error('XMLHttpRequest is not supported')
          }
        }
      }
    } else {
      wrapper = window.XMLHttpRequest
    }
    return new wrapper()
  },

  _ajax: function (settings) {
    const xhr = this._wrapper(),
      id = Math.random(),
      self = this
    this.fire('dataloading', { id: id })
    const loaded = () => {
      self.fire('dataload', { id: id })
    }

    try {
      xhr.open(settings.verb, settings.uri, true)
    } catch (err) {
      // Unknown protocol?
      this.ui.alert({
        content: L._('Error while fetching {url}', { url: settings.uri }),
        level: 'error',
      })
      loaded()
      return
    }

    if (
      settings.uri.indexOf('http') !== 0 ||
      settings.uri.indexOf(window.location.origin) === 0
    ) {
      // "X-" mode headers cause the request to be in preflight mode,
      // we don"t want that by default for CORS requests
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
    }
    if (settings.headers) {
      for (const name in settings.headers) {
        xhr.setRequestHeader(name, settings.headers[name])
      }
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status == 200) {
          settings.callback.call(settings.context || xhr, xhr.responseText, xhr)
        } else if (xhr.status === 403) {
          self.ui.alert({
            content: xhr.responseText || L._('Action not allowed :('),
            level: 'error',
          })
        } else if (xhr.status === 412) {
          const msg = L._(
            'Woops! Someone else seems to have edited the data. You can save anyway, but this will erase the changes made by others.'
          )
          const actions = [
            {
              label: L._('Save anyway'),
              callback: function () {
                delete settings.headers['If-Match']
                self._ajax(settings)
              },
              callbackContext: self,
            },
            {
              label: L._('Cancel'),
            },
          ]
          self.ui.alert({
            content: msg,
            level: 'error',
            duration: 100000,
            actions: actions,
          })
        } else {
          if (xhr.status === 0) {
            // 0 === request cut by user or CORS
            self.ui.alert({
              content: L._(
                'Issue reaching that URL (network problem or CORS protection)'
              ),
              level: 'error',
            })
          } else {
            self.ui.alert({ content: L._('Problem in the response'), level: 'error' })
          }
        }
        loaded()
      }
    }

    try {
      xhr.send(settings.data)
    } catch (e) {
      // Pass
      loaded()
      console.error('Bad Request', e)
    }
  },

  // supports only JSON as response data type
  _json: function (verb, uri, options) {
    const args = arguments,
      self = this
    const default_options = {
      async: true,
      callback: null,
      responseType: 'text',
      data: null,
      listen_form: null, // optional form to listen in default callback
    }
    const settings = L.Util.extend({}, default_options, options)

    if (verb === 'POST') {
      // find a way not to make this django specific
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)csrftoken\s*\=\s*([^;]*).*$)|^.*$/,
        '$1'
      )
      if (token) {
        settings.headers = settings.headers || {}
        settings.headers['X-CSRFToken'] = token
      }
    }

    const callback = function (responseText, response) {
      let data
      try {
        data = JSON.parse(responseText)
      } catch (err) {
        console.log(err)
        self.ui.alert({
          content: L._('Problem in the response format'),
          level: 'error',
        })
        return
      }
      if (data.errors) {
        console.log(data.errors)
        self.ui.alert({ content: L._('An error occured'), level: 'error' })
      } else if (data.login_required) {
        // login_required should be an URL for the login form
        if (settings.login_callback) settings.login_callback(data)
        else self.login(data, args)
      } else {
        if (settings.callback)
          L.bind(settings.callback, settings.context || this)(data, response)
        else self.default_callback(data, settings, response)
      }
    }

    this._ajax({
      verb: verb,
      uri: uri,
      data: settings.data,
      callback: callback,
      headers: settings.headers,
      listener: settings.listener,
    })
  },

  get: function (uri, options) {
    this._json('GET', uri, options)
  },

  post: function (uri, options) {
    this._json('POST', uri, options)
  },

  submit_form: function (form_id, options) {
    if (typeof options === 'undefined') options = {}
    const form = L.DomUtil.get(form_id)
    const formData = new FormData(form)
    if (options.extraFormData) formData.append(options.extraFormData)
    options.data = formData
    this.post(form.action, options)
    return false
  },

  listen_form: function (form_id, options) {
    const form = L.DomUtil.get(form_id),
      self = this
    if (!form) return
    L.DomEvent.on(form, 'submit', L.DomEvent.stopPropagation)
      .on(form, 'submit', L.DomEvent.preventDefault)
      .on(form, 'submit', () => {
        self.submit_form(form_id, options)
      })
  },

  listen_link: function (link_id, options) {
    const link = L.DomUtil.get(link_id),
      self = this
    if (link) {
      L.DomEvent.on(link, 'click', L.DomEvent.stop).on(link, 'click', () => {
        if (options.confirm && !confirm(options.confirm)) {
          return
        }
        self.get(link.href, options)
      })
    }
  },

  default_callback: function (data, options) {
    // default callback, to avoid boilerplate
    if (data.redirect) {
      const newPath = data.redirect
      if (window.location.pathname == newPath)
        window.location.reload() // Keep the hash, so the current view
      else window.location = newPath
    } else if (data.info) {
      this.ui.alert({ content: data.info, level: 'info' })
      this.ui.closePanel()
    } else if (data.error) {
      this.ui.alert({ content: data.error, level: 'error' })
    } else if (data.html) {
      const ui_options = { data: data }
      let listen_options
      if (options.className) ui_options.className = options.className
      this.ui.openPanel(ui_options)
      // To low boilerplate, if there is a form, listen it
      if (options.listen_form) {
        // Listen form again
        listen_options = L.Util.extend({}, options, options.listen_form.options)
        this.listen_form(options.listen_form.id, listen_options)
      }
      if (options.listen_link) {
        for (let i = 0, l = options.listen_link.length; i < l; i++) {
          // Listen link again
          listen_options = L.Util.extend({}, options, options.listen_link[i].options)
          this.listen_link(options.listen_link[i].id, listen_options)
        }
      }
    } else if (options.success) {
      // Success is called only if data contain no msg and no html
      options.success(data)
    }
  },

  login: function (data, args) {
    // data.html: login form
    // args: args of the first _json call, to call again at process end
    const self = this
    const proceed = () => {
      self.ui.closePanel()
      if (typeof args !== 'undefined') self._json.apply(self, args)
      else self.default_callback(data, {})
    }
    const ask_for_login = (data) => {
      self.ui.openPanel({ data: data, className: 'login-panel' })
      self.listen_form('login_form', {
        callback: function (data) {
          if (data.html) ask_for_login(data) // Problem in the login - ask again
          else proceed()
        },
      })
      // Auth links
      const links = document.getElementsByClassName('umap-login-popup')
      Object.keys(links).forEach((el) => {
        const link = links[el]
        L.DomEvent.on(link, 'click', L.DomEvent.stop).on(link, 'click', () => {
          self.ui.closePanel()
          const win = window.open(link.href)
          window.umap_proceed = () => {
            proceed()
            win.close()
          }
        })
      })
    }
    if (data.login_required) {
      this.get(data.login_required, {
        callback: function (data) {
          ask_for_login(data)
        },
      })
    } else {
      ask_for_login(data)
    }
  },

  logout: function (url) {
    this.get(url)
  },
})
