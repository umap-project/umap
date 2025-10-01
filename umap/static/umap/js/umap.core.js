L.DomUtil.add = (tagName, className, container, content) => {
  const el = L.DomUtil.create(tagName, className, container)
  if (content) {
    if (content.nodeType && content.nodeType === 1) {
      el.appendChild(content)
    } else {
      el.textContent = content
    }
  }
  return el
}

L.DomUtil.createFieldset = (container, legend, options) => {
  options = options || {}
  const details = L.DomUtil.create('details', options.className || '', container)
  const summary = L.DomUtil.add('summary', '', details)
  if (options.icon) L.DomUtil.createIcon(summary, options.icon)
  L.DomUtil.add('h4', '', summary, legend)
  const fieldset = L.DomUtil.add('fieldset', '', details)
  details.open = options.on === true
  if (options.callback) {
    L.DomEvent.on(details, 'toggle', () => {
      if (details.open) options.callback.call(options.context || this)
    })
  }
  return fieldset
}

L.DomUtil.createButton = (className, container, content, callback, context) => {
  const el = L.DomUtil.add('button', className, container, content)
  el.type = 'button'
  if (!content.nodeType) {
    el.title = content
  }
  if (callback) {
    L.DomEvent.on(el, 'click', L.DomEvent.stop).on(el, 'click', callback, context)
  }
  return el
}

L.DomUtil.createIcon = (parent, className, title, size = 16) => {
  return L.DomUtil.element({
    tagName: 'i',
    parent: parent,
    className: `icon icon-${size} ${className}`,
    title: title || '',
  })
}

L.DomUtil.createButtonIcon = (parent, className, title, callback, size = 16) => {
  const el = L.DomUtil.element({
    tagName: 'button',
    parent: parent,
    className: `icon icon-${size} ${className}`,
    title: title || '',
  })
  if (callback) {
    L.DomEvent.on(el, 'click', L.DomEvent.stop).on(el, 'click', callback)
  }
  return el
}

L.DomUtil.createTitle = (parent, text, iconClassName, className = '', tag = 'h3') => {
  const title = L.DomUtil.create(tag, '', parent)
  if (iconClassName) L.DomUtil.createIcon(title, iconClassName)
  L.DomUtil.add('span', className, title, text)
  return title
}

L.DomUtil.element = ({ tagName, parent, ...attrs }) => {
  const el = document.createElement(tagName)
  if (attrs.innerHTML) {
    attrs.innerHTML = U.Utils.escapeHTML(attrs.innerHTML)
  } else if (attrs.safeHTML) {
    attrs.innerHTML = attrs.safeHTML
  }
  for (const attr in attrs) {
    el[attr] = attrs[attr]
  }
  if (typeof parent !== 'undefined') {
    parent.appendChild(el)
  }
  return el
}

L.LatLng.prototype.isValid = function () {
  return (
    Number.isFinite(this.lat) &&
    Math.abs(this.lat) <= 90 &&
    Number.isFinite(this.lng) &&
    Math.abs(this.lng) <= 180
  )
}
