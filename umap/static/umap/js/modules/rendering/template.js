import { DomUtil, DomEvent } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate, getLocale } from '../i18n.js'
import * as Utils from '../utils.js'

export default function loadTemplate(name, feature, container) {
  let klass = PopupTemplate
  switch (name) {
    case 'GeoRSSLink':
      klass = GeoRSSLink
      break
    case 'GeoRSSImage':
      klass = GeoRSSImage
      break
    case 'Table':
      klass = Table
      break
    case 'OSM':
      klass = OSM
      break
  }
  const content = new klass()
  return content.render(feature, container)
}

class PopupTemplate {
  renderTitle(feature, container) {}

  renderBody(feature, container) {
    const template = feature.getOption('popupContentTemplate')
    const target = feature.getOption('outlinkTarget')
    const properties = feature.extendedProperties()
    // Resolve properties inside description
    properties.description = Utils.greedyTemplate(
      feature.properties.description || '',
      properties
    )
    let content = Utils.greedyTemplate(template, properties)
    content = Utils.toHTML(content, { target: target })
    return Utils.loadTemplate(`<div class="umap-popup-container text">${content}</div>`)
  }

  renderFooter(feature, container) {
    if (feature.hasPopupFooter()) {
      const template = `
      <ul class="umap-popup-footer">
        <li rel="prev" data-ref="previous"></li>
        <li class="zoom" data-ref="zoom" title="${translate('Zoom to this feature')}"></li>
        <li rel="next" data-ref="next"></li>
      </ul>`
      const [footer, { previous, zoom, next }] = Utils.loadTemplateWithRefs(template)
      const nextFeature = feature.getNext()
      const previousFeature = feature.getPrevious()
      // Fixme: remove me when this is merged and released
      // https://github.com/Leaflet/Leaflet/pull/9052
      DomEvent.disableClickPropagation(footer)
      if (nextFeature) {
        next.title = translate('Go to «{feature}»', {
          feature: nextFeature.properties.name || translate('next'),
        })
        DomEvent.on(next, 'click', () => {
          nextFeature.zoomTo({ callback: nextFeature.view })
        })
      }
      if (previousFeature) {
        previous.title = translate('Go to «{feature}»', {
          feature: previousFeature.properties.name || translate('previous'),
        })
        DomEvent.on(previous, 'click', () => {
          previousFeature.zoomTo({ callback: previousFeature.view })
        })
      }
      DomEvent.on(zoom, 'click', () => feature.zoomTo())
      container.appendChild(footer)
    }
  }

  render(feature, container) {
    const title = this.renderTitle(feature, container)
    if (title) container.appendChild(title)
    const body = this.renderBody(feature, container)
    if (body) DomUtil.add('div', 'umap-popup-content', container, body)
    this.renderFooter(feature, container)
  }
}
export const TitleMixin = (Base) =>
  class extends Base {
    renderTitle(feature, container) {
      const title = feature.getDisplayName()
      if (title) {
        return Utils.loadTemplate(`<h3 class="popup-title">${title}</h3>`)
      }
    }
  }

class Table extends TitleMixin(PopupTemplate) {
  getValue(feature, key) {
    // TODO, manage links (url, mailto, wikipedia...)
    const value = Utils.escapeHTML(feature.properties[key]).trim()
    if (value.indexOf('http') === 0) {
      return `<a href="${value}" target="_blank">${value}</a>`
    }
    return value
  }

  makeRow(feature, key) {
    return Utils.loadTemplate(
      `<tr><th>${key}</th><td>${this.getValue(feature, key)}</td></tr>`
    )
  }

  renderBody(feature, container) {
    const table = document.createElement('table')

    for (const key in feature.properties) {
      if (typeof feature.properties[key] === 'object' || key === 'name') continue
      table.appendChild(this.makeRow(feature, key))
    }
    return table
  }
}

class GeoRSSImage extends TitleMixin(PopupTemplate) {
  renderBody(feature, container) {
    const body = DomUtil.create('a')
    body.href = feature.properties.link
    body.target = '_blank'
    if (feature.properties.img) {
      const img = DomUtil.create('img', '', body)
      img.src = feature.properties.img
      // Sadly, we are unable to override this from JS the clean way
      // See https://github.com/Leaflet/Leaflet/commit/61d746818b99d362108545c151a27f09d60960ee#commitcomment-6061847
      img.style.maxWidth = '500px'
      img.style.maxHeight = '500px'
    }
    return body
  }
}

class GeoRSSLink extends TitleMixin(PopupTemplate) {
  renderBody(feature, container) {
    const title = this.renderTitle(feature, container)
    return Utils.loadTemplate(
      `<a href="${feature.properties.link}" target="_blank">${title}</a>`
    )
  }
}

class OSM extends TitleMixin(PopupTemplate) {
  getName(feature) {
    const props = feature.properties
    const locale = getLocale()
    if (locale && props[`name:${locale}`]) return props[`name:${locale}`]
    return props.name
  }

  renderBody(feature, container) {
    const props = feature.properties
    const body = document.createElement('div')
    const title = DomUtil.add('h3', 'popup-title', container)
    const color = feature.getPreviewColor()
    title.style.backgroundColor = color
    const iconUrl = feature.getDynamicOption('iconUrl')
    const icon = U.Icon.makeIconElement(iconUrl, title)
    DomUtil.addClass(icon, 'icon')
    U.Icon.setIconContrast(icon, title, iconUrl, color)
    if (DomUtil.contrastedColor(title, color)) title.style.color = 'white'
    DomUtil.add('span', '', title, this.getName(feature))
    const street = props['addr:street']
    if (street) {
      const row = DomUtil.add('address', 'address', body)
      const number = props['addr:housenumber']
      if (number) {
        // Poor way to deal with international forms of writting addresses
        DomUtil.add('span', '', row, `${translate('No.')}: ${number}`)
        DomUtil.add('span', '', row, `${translate('Street')}: ${street}`)
      } else {
        DomUtil.add('span', '', row, street)
      }
    }
    if (props.website) {
      body.appendChild(
        Utils.loadTemplate(`<div><a href="${props.website}">${props.website}</a></div>`)
      )
    }
    const phone = props.phone || props['contact:phone']
    if (phone) {
      body.appendChild(
        Utils.loadTemplate(`<div><a href="tel:${phone}">${phone}</a></div>`)
      )
    }
    if (props.mobile) {
      body.appendChild(
        Utils.loadTemplate(
          `<div><a href="tel:${props.mobile}">${props.mobile}</a></div>`
        )
      )
    }
    const email = props.email || props['contact:email']
    if (email) {
      body.appendChild(
        Utils.loadTemplate(`<div><a href="mailto:${email}">${email}</a></div>`)
      )
    }
    const id = props['@id'] || props.id
    if (id) {
      body.appendChild(
        Utils.loadTemplate(
          `<div class="osm-link"><a href="https://www.openstreetmap.org/${id}">${translate('See on OpenStreetMap')}</a></div>`
        )
      )
    }
    return body
  }
}
