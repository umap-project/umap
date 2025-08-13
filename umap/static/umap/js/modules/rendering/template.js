import {
  DomEvent,
  DomUtil,
  CircleMarker,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import { getLocale, translate } from '../i18n.js'
import { Request } from '../request.js'
import * as Utils from '../utils.js'
import * as Icon from './icon.js'

export default async function loadTemplate(name, feature, container) {
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
    case 'Wikipedia':
      klass = Wikipedia
      break
    case 'Route':
      klass = Route
      break
  }
  const content = new klass()
  return await content.render(feature, container)
}

class PopupTemplate {
  renderTitle(feature) {}

  renderBody(feature) {
    const template = feature.getOption('popupContentTemplate')
    const target = feature.getOption('outlinkTarget')
    const properties = feature.extendedProperties()
    // Resolve properties inside description
    properties.description = Utils.greedyTemplate(
      feature.properties.description || '',
      properties
    )
    properties.name = properties.name ?? feature.getDisplayName()
    let content = Utils.greedyTemplate(template, properties)
    content = Utils.toHTML(content, { target: target })
    return Utils.loadTemplate(`<div class="umap-popup-container text">${content}</div>`)
  }

  renderFooter(feature) {
    if (feature.hasPopupFooter()) {
      const template = `
      <ul class="umap-popup-footer dark">
        <li rel="prev"><button class="icon icon-16 icon-back" data-ref="previous"></button></li>
        <li class="zoom" title="${translate('Zoom to this feature')}"><button class="icon icon-16 icon-zoom" data-ref="zoom"></button></li>
        <li rel="next"><button class="icon icon-16 icon-forward" data-ref="next"></button></li>
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
          nextFeature.zoomTo({ callback: (event) => nextFeature.view(event) })
        })
      }
      if (previousFeature) {
        previous.title = translate('Go to «{feature}»', {
          feature: previousFeature.properties.name || translate('previous'),
        })
        DomEvent.on(previous, 'click', () => {
          previousFeature.zoomTo({ callback: (event) => previousFeature.view(event) })
        })
      }
      DomEvent.on(zoom, 'click', () => feature.zoomTo())
      return footer
    }
  }

  async render(feature, container) {
    const title = this.renderTitle(feature)
    if (title) container.appendChild(title)
    const body = await this.renderBody(feature)
    if (body) DomUtil.add('div', 'umap-popup-content', container, body)
    const footer = this.renderFooter(feature)
    if (footer) container.appendChild(footer)
  }
}
export const TitleMixin = (Base) =>
  class extends Base {
    renderTitle(feature) {
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

  async renderBody(feature) {
    const table = document.createElement('table')

    for (const key in feature.properties) {
      if (typeof feature.properties[key] === 'object' || U.LABEL_KEYS.includes(key)) {
        continue
      }
      table.appendChild(this.makeRow(feature, key))
    }
    return table
  }
}

class GeoRSSImage extends TitleMixin(PopupTemplate) {
  async renderBody(feature) {
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

class GeoRSSLink extends PopupTemplate {
  async renderBody(feature) {
    if (feature.properties.link) {
      return Utils.loadTemplate(
        `<a href="${feature.properties.link}" target="_blank"><h3>${feature.getDisplayName()}</h3></a>`
      )
    }
  }
}

class OSM extends PopupTemplate {
  renderTitle(feature) {
    const title = DomUtil.add('h3', 'popup-title')
    const color = feature.getPreviewColor()
    title.style.backgroundColor = color
    const iconUrl = feature.getDynamicOption('iconUrl')
    const icon = Icon.makeElement(iconUrl, title)
    DomUtil.addClass(icon, 'icon')
    Icon.setContrast(icon, title, iconUrl, color)
    if (DomUtil.contrastedColor(title, color)) title.style.color = 'white'
    DomUtil.add('span', '', title, this.getName(feature))
    return title
  }

  getName(feature) {
    const props = feature.properties
    const locale = getLocale()
    if (locale && props[`name:${locale}`]) return props[`name:${locale}`]
    return props.name
  }

  async renderBody(feature) {
    const props = feature.properties
    const body = document.createElement('div')
    const locale = getLocale()
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
    if (props.panoramax) {
      body.appendChild(
        Utils.loadTemplate(
          `<div><img src="https://api.panoramax.xyz/api/pictures/${props.panoramax}/sd.jpg" /></div>`
        )
      )
    }
    const wikipedia = props[`wikipedia:${locale}`] || props.wikipedia
    if (wikipedia) {
      body.appendChild(
        Utils.loadTemplate(
          `<div class="wikipedia-link"><a href="https://wikipedia.org/wiki/${wikipedia}" target="_blank">${translate('Wikipedia')}</a></div>`
        )
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

const _WIKIPEDIA_CACHE = {}

class Wikipedia extends PopupTemplate {
  async callWikipedia(wikipedia) {
    if (wikipedia && _WIKIPEDIA_CACHE[wikipedia]) return _WIKIPEDIA_CACHE[wikipedia]
    // Wikipedia value should be in form of "{locale}:{title}", according to https://wiki.openstreetmap.org/wiki/Key:wikipedia
    const [locale, page] = wikipedia.split(':')
    const url = `https://${locale}.wikipedia.org/w/api.php?action=query&format=json&origin=*&pithumbsize=500&prop=extracts|pageimages&titles=${page}`
    const request = new Request()
    const response = await request.get(url)
    if (response?.ok) {
      const data = await response.json()
      _WIKIPEDIA_CACHE[wikipedia] = data
      return data
    }
  }

  async renderBody(feature) {
    const body = document.createElement('div')
    const wikipedia = feature.properties.wikipedia
    if (!wikipedia) return ''
    const data = await this.callWikipedia(wikipedia)
    if (data) {
      const page = Object.values(data.query.pages)[0]
      const title = page.title || feature.getDisplayName()
      const extract = page.extract || ''
      const thumbnail = page.thumbnail?.source
      const [content, { image }] = Utils.loadTemplateWithRefs(
        `<div><h3>${Utils.escapeHTML(title)}</h3><img data-ref="image" hidden src="" />${Utils.escapeHTML(extract)}</div>`
      )
      if (thumbnail) {
        image.src = thumbnail
        image.hidden = false
      }
      body.appendChild(content)
    }
    return body
  }
}

class Route extends TitleMixin(PopupTemplate) {
  async renderBody(feature) {
    if (feature.type !== 'LineString' || feature.isMulti()) {
      return super.renderBody(feature)
    }
    let prev
    let dist = 0
    const data = []
    const latlngs = feature.ui.getLatLngs()
    const map = feature._umap._leafletMap
    const properties = feature.extendedProperties()
    for (const latlng of latlngs) {
      if (!latlng.alt) {
        continue
      }
      if (prev) {
        dist = map.distance(latlng, prev)
      }
      data.push([latlng.alt, dist])
      prev = latlng
    }
    const [root, { altitude, chart }] = Utils.loadTemplateWithRefs(`
      <div>
        <p>
          ${translate('Distance:')} ${properties.measure} •
          ${translate('Gain:')} ${properties.gain} m ↗ •
          ${translate('Loss:')} ${properties.loss} m ↘ •
          ${translate('Altitude:')} <span data-ref="altitude">—</span> m
        </p>
        <object width="100%"
          data="${feature._umap.getStaticPathFor('../vendors/simple-elevation-chart/elevation.svg')}"
          data-elevation="${JSON.stringify(data)}"
          data-ref="chart"
          type="image/svg+xml">
      </div>
    `)
    let marker
    function removeMarker() {
      if (marker) {
        marker.remove()
      }
    }
    chart.addEventListener('mouseout', removeMarker)
    map.on('popupclose', removeMarker)
    chart.addEventListener('chart:over', (event) => {
      const dataset = event.detail.element.dataset
      if (dataset.ele) {
        altitude.textContent = dataset.ele
      }
      removeMarker()
      const latlng = latlngs[dataset.index]
      if (!latlng) return
      marker = new CircleMarker(latlng, {
        radius: 8,
        fillColor: 'white',
        fillOpacity: 1,
        color: 'orange',
      }).addTo(map)
    })
    return root
  }
}
