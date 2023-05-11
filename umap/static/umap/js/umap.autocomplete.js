L.U.AutoComplete = L.Class.extend({
  options: {
    placeholder: 'Start typing...',
    emptyMessage: 'No result',
    allowFree: true,
    minChar: 2,
    maxResults: 5,
  },

  CACHE: '',
  RESULTS: [],

  initialize(el, options) {
    this.el = el
    const ui = new L.U.UI(document.querySelector('header'))
    this.xhr = new L.U.Xhr(ui)
    L.setOptions(this, options)
    let CURRENT = null
    try {
      Object.defineProperty(this, 'CURRENT', {
        get() {
          return CURRENT
        },
        set(index) {
          if (typeof index === 'object') {
            index = this.resultToIndex(index)
          }
          CURRENT = index
        },
      })
    } catch (e) {
      // Hello IE8
    }
    return this
  },

  createInput() {
    this.input = L.DomUtil.element(
      'input',
      {
        type: 'text',
        placeholder: this.options.placeholder,
        autocomplete: 'off',
        className: this.options.className,
      },
      this.el
    )
    L.DomEvent.on(this.input, 'keydown', this.onKeyDown, this)
    L.DomEvent.on(this.input, 'keyup', this.onKeyUp, this)
    L.DomEvent.on(this.input, 'blur', this.onBlur, this)
  },

  createContainer() {
    this.container = L.DomUtil.element(
      'ul',
      { className: 'umap-autocomplete' },
      document.body
    )
  },

  resizeContainer() {
    const l = this.getLeft(this.input)
    const t = this.getTop(this.input) + this.input.offsetHeight
    this.container.style.left = `${l}px`
    this.container.style.top = `${t}px`
    const width = this.options.width ? this.options.width : this.input.offsetWidth - 2
    this.container.style.width = `${width}px`
  },

  onKeyDown(e) {
    switch (e.keyCode) {
      case L.U.Keys.TAB:
        if (this.CURRENT !== null) this.setChoice()
        L.DomEvent.stop(e)
        break
      case L.U.Keys.ENTER:
        L.DomEvent.stop(e)
        this.setChoice()
        break
      case L.U.Keys.ESC:
        L.DomEvent.stop(e)
        this.hide()
        break
      case L.U.Keys.DOWN:
        if (this.RESULTS.length > 0) {
          if (this.CURRENT !== null && this.CURRENT < this.RESULTS.length - 1) {
            // what if one result?
            this.CURRENT++
            this.highlight()
          } else if (this.CURRENT === null) {
            this.CURRENT = 0
            this.highlight()
          }
        }
        break
      case L.U.Keys.UP:
        if (this.CURRENT !== null) {
          L.DomEvent.stop(e)
        }
        if (this.RESULTS.length > 0) {
          if (this.CURRENT > 0) {
            this.CURRENT--
            this.highlight()
          } else if (this.CURRENT === 0) {
            this.CURRENT = null
            this.highlight()
          }
        }
        break
    }
  },

  onKeyUp({ keyCode }) {
    const special = [
      L.U.Keys.TAB,
      L.U.Keys.ENTER,
      L.U.Keys.LEFT,
      L.U.Keys.RIGHT,
      L.U.Keys.DOWN,
      L.U.Keys.UP,
      L.U.Keys.APPLE,
      L.U.Keys.SHIFT,
      L.U.Keys.ALT,
      L.U.Keys.CTRL,
    ]
    if (!special.includes(keyCode)) {
      this.search()
    }
  },

  onBlur() {
    const self = this
    setTimeout(() => {
      self.hide()
    }, 100)
  },

  clear() {
    this.RESULTS = []
    this.CURRENT = null
    this.CACHE = ''
    this.container.innerHTML = ''
  },

  hide() {
    this.clear()
    this.container.style.display = 'none'
    this.input.value = ''
  },

  setChoice(choice = this.RESULTS[this.CURRENT]) {
    if (choice) {
      this.input.value = choice.item.label
      this.options.on_select(choice)
      this.displaySelected(choice)
      this.hide()
      if (this.options.callback) {
        L.Util.bind(this.options.callback, this)(choice)
      }
    }
  },

  search() {
    const val = this.input.value
    if (val.length < this.options.minChar) {
      this.clear()
      return
    }
    if (`${val}` === `${this.CACHE}`) return
    else this.CACHE = val
    this._do_search(
      val,
      function (data) {
        this.handleResults(data.data)
      },
      this
    )
  },

  createResult(item) {
    const el = L.DomUtil.element('li', {}, this.container)
    el.textContent = item.label
    const result = {
      item,
      el,
    }
    L.DomEvent.on(
      el,
      'mouseover',
      function () {
        this.CURRENT = result
        this.highlight()
      },
      this
    )
    L.DomEvent.on(
      el,
      'mousedown',
      function () {
        this.setChoice()
      },
      this
    )
    return result
  },

  resultToIndex(result) {
    let out = null
    this.forEach(this.RESULTS, (item, index) => {
      if (item.item.value == result.item.value) {
        out = index
        return
      }
    })
    return out
  },

  handleResults(data) {
    const self = this
    this.clear()
    this.container.style.display = 'block'
    this.resizeContainer()
    this.forEach(data, (item) => {
      self.RESULTS.push(self.createResult(item))
    })
    this.CURRENT = 0
    this.highlight()
    //TODO manage no results
  },

  highlight() {
    const self = this
    this.forEach(this.RESULTS, ({ el }, index) => {
      if (index === self.CURRENT) L.DomUtil.addClass(el, 'on')
      else L.DomUtil.removeClass(el, 'on')
    })
  },

  getLeft(el) {
    let tmp = el.offsetLeft
    el = el.offsetParent
    while (el) {
      tmp += el.offsetLeft
      el = el.offsetParent
    }
    return tmp
  },

  getTop(el) {
    let tmp = el.offsetTop
    el = el.offsetParent
    while (el) {
      tmp += el.offsetTop
      el = el.offsetParent
    }
    return tmp
  },

  forEach(els, callback) {
    Array.prototype.forEach.call(els, callback)
  },
})

L.U.AutoComplete.Ajax = L.U.AutoComplete.extend({
  initialize(el, options) {
    L.U.AutoComplete.prototype.initialize.call(this, el, options)
    if (!this.el) return this
    this.createInput()
    this.createContainer()
    this.selected_container = this.initSelectedContainer()
  },

  optionToResult({ value, innerHTML }) {
    return {
      value: value,
      label: innerHTML,
    }
  },

  _do_search(val, callback, context) {
    val = val.toLowerCase()
    this.xhr.get(`/agnocomplete/AutocompleteUser/?q=${encodeURIComponent(val)}`, {
      callback,
      context: context || this,
    })
  },
})

L.U.AutoComplete.Ajax.SelectMultiple = L.U.AutoComplete.Ajax.extend({
  initSelectedContainer() {
    return L.DomUtil.after(
      this.input,
      L.DomUtil.element('ul', { className: 'umap-multiresult' })
    )
  },

  displaySelected(result) {
    const result_el = L.DomUtil.element('li', {}, this.selected_container)
    result_el.textContent = result.item.label
    const close = L.DomUtil.element('span', { className: 'close' }, result_el)
    close.textContent = '×'
    L.DomEvent.on(
      close,
      'click',
      function () {
        this.selected_container.removeChild(result_el)
        this.options.on_unselect(result)
      },
      this
    )
    this.hide()
  },
})

L.U.AutoComplete.Ajax.Select = L.U.AutoComplete.Ajax.extend({
  initSelectedContainer() {
    return L.DomUtil.after(
      this.input,
      L.DomUtil.element('div', { className: 'umap-singleresult' })
    )
  },

  displaySelected({ item }) {
    const result_el = L.DomUtil.element('div', {}, this.selected_container)
    result_el.textContent = item.label
    const close = L.DomUtil.element('span', { className: 'close' }, result_el)
    close.textContent = '×'
    this.input.style.display = 'none'
    L.DomEvent.on(
      close,
      'click',
      function () {
        this.selected_container.innerHTML = ''
        this.input.style.display = 'block'
      },
      this
    )
    this.hide()
  },
})
