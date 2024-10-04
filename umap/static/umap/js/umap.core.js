L.Util.copyToClipboard = (textToCopy) => {
  // https://stackoverflow.com/a/65996386
  // Navigator clipboard api needs a secure context (https)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textToCopy)
  } else {
    // Use the 'out of viewport hidden text area' trick
    const textArea = document.createElement('textarea')
    textArea.value = textToCopy

    // Move textarea out of the viewport so it's not visible
    textArea.style.position = 'absolute'
    textArea.style.left = '-999999px'

    document.body.prepend(textArea)
    textArea.select()

    try {
      document.execCommand('copy')
    } catch (error) {
      console.error(error)
    } finally {
      textArea.remove()
    }
  }
}

L.Util.queryString = (name, fallback) => {
  const decode = (s) => decodeURIComponent(s.replace(/\+/g, ' '))
  const qs = window.location.search.slice(1).split('&')
  const qa = {}
  for (const i in qs) {
    const key = qs[i].split('=')
    if (!key) continue
    qa[decode(key[0])] = key[1] ? decode(key[1]) : 1
  }
  return qa[name] || fallback
}

L.Util.booleanFromQueryString = (name) => {
  const value = L.Util.queryString(name)
  return value === '1' || value === 'true'
}

L.Util.setFromQueryString = (options, name) => {
  const value = L.Util.queryString(name)
  if (typeof value !== 'undefined') options[name] = value
}

L.Util.setBooleanFromQueryString = (options, name) => {
  const value = L.Util.queryString(name)
  if (typeof value !== 'undefined') options[name] = value === '1' || value === 'true'
}

L.Util.setNumberFromQueryString = (options, name) => {
  const value = +L.Util.queryString(name)
  if (!Number.isNaN(value)) options[name] = value
}

L.Util.setNullableBooleanFromQueryString = (options, name) => {
  let value = L.Util.queryString(name)
  if (typeof value !== 'undefined') {
    if (value === 'null') value = null
    else if (value === '0' || value === 'false') value = false
    else value = true
    options[name] = value
  }
}

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
  L.DomUtil.add('span', '', summary, legend)
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

L.DomUtil.createLink = (className, container, content, url, target, title) => {
  const el = L.DomUtil.add('a', className, container, content)
  el.href = url
  if (target) {
    el.target = target
  }
  if (title) {
    el.title = title
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
  if (className) L.DomUtil.createIcon(title, iconClassName)
  L.DomUtil.add('span', className, title, text)
  return title
}

L.DomUtil.createCopiableInput = (parent, label, value) => {
  const wrapper = L.DomUtil.add('div', 'copiable-input', parent)
  const labelEl = L.DomUtil.add('label', '', wrapper, label)
  const input = L.DomUtil.add('input', '', labelEl)
  input.type = 'text'
  input.readOnly = true
  input.value = value
  const button = L.DomUtil.createButtonIcon(wrapper, 'icon-copy', L._('copy'), () =>
    L.Util.copyToClipboard(input.value)
  )
  button.type = 'button'
  return input
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

L.DomUtil.before = (target, el) => {
  target.parentNode.insertBefore(el, target)
  return el
}

L.DomUtil.after = (target, el) => {
  target.parentNode.insertBefore(el, target.nextSibling)
  return el
}

// From https://gist.github.com/Accudio/b9cb16e0e3df858cef0d31e38f1fe46f
// convert colour in range 0-255 to the modifier used within luminance calculation
L.DomUtil.colourMod = (colour) => {
  const sRGB = colour / 255
  let mod = ((sRGB + 0.055) / 1.055) ** 2.4
  if (sRGB < 0.03928) mod = sRGB / 12.92
  return mod
}
L.DomUtil.RGBRegex = /rgb *\( *([0-9]{1,3}) *, *([0-9]{1,3}) *, *([0-9]{1,3}) *\)/
L.DomUtil.TextColorFromBackgroundColor = (el, bgcolor) => {
  return L.DomUtil.contrastedColor(el, bgcolor) ? '#ffffff' : '#000000'
}
L.DomUtil.contrastWCAG21 = (rgb) => {
  const [r, g, b] = rgb
  // luminance of inputted colour
  const lum =
    0.2126 * L.DomUtil.colourMod(r) +
    0.7152 * L.DomUtil.colourMod(g) +
    0.0722 * L.DomUtil.colourMod(b)
  // white has a luminance of 1
  const whiteLum = 1
  const contrast = (whiteLum + 0.05) / (lum + 0.05)
  return contrast > 3 ? 1 : 0
}

const _CACHE_CONSTRAST = {}
L.DomUtil.contrastedColor = (el, bgcolor) => {
  // Return 0 for black and 1 for white
  // bgcolor is a human color, it can be a any keyword (purple…)
  if (typeof _CACHE_CONSTRAST[bgcolor] !== 'undefined') return _CACHE_CONSTRAST[bgcolor]
  let out = 0
  let rgb = window.getComputedStyle(el).getPropertyValue('background-color')
  rgb = L.DomUtil.RGBRegex.exec(rgb)
  if (!rgb || rgb.length !== 4) return out
  rgb = [
    Number.parseInt(rgb[1], 10),
    Number.parseInt(rgb[2], 10),
    Number.parseInt(rgb[3], 10),
  ]
  out = L.DomUtil.contrastWCAG21(rgb)
  if (bgcolor) _CACHE_CONSTRAST[bgcolor] = out
  return out
}
L.DomEvent.once = (el, types, fn, context) => {
  // cf https://github.com/Leaflet/Leaflet/pull/3528#issuecomment-134551575

  if (typeof types === 'object') {
    for (const type in types) {
      L.DomEvent.once(el, type, types[type], fn)
    }
    return L.DomEvent
  }

  const handler = L.bind(() => {
    L.DomEvent.off(el, types, fn, context).off(el, types, handler, context)
  }, L.DomEvent)

  // add a listener that's executed once and removed after that
  return L.DomEvent.on(el, types, fn, context).on(el, types, handler, context)
}

L.LatLng.prototype.isValid = function () {
  return (
    Number.isFinite(this.lat) &&
    Math.abs(this.lat) <= 90 &&
    Number.isFinite(this.lng) &&
    Math.abs(this.lng) <= 180
  )
}
