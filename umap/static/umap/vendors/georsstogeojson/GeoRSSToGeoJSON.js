export function parse(dom, options) {
  const g = {
    type: 'FeatureCollection',
    features: [],
  }

  const items = get(dom, 'item')
  for (const item of Array.from(items)) {
    const feature = processOne(item)
    if (feature) {
      g.features.push(feature)
    }
  }
  return g
}

function get(x, y) {
  return x.getElementsByTagName(y)
}
function get1(x, y) {
  const n = get(x, y)
  return n.length ? n[0] : null
}
function norm(el) {
  if (el.normalize) {
    el.normalize()
  }
  return el
}
function nodeVal(x) {
  if (x) {
    norm(x)
  }
  return x?.firstChild?.nodeValue
}
function attr(x, y) {
  return x.getAttribute(y)
}

function geom(node) {
  function p(c) {
    return parseFloat(c)
  }
  function r(c) {
    return c.reverse().map(p)
  } // we have latlon we want lonlat
  function e(f) {
    const _ = []
    for (let i = 0; i < f.length; i += 2) {
      _.push(r(f.slice(i, i + 2)))
    }
    return _
  }

  let type
  let coordinates

  if (get1(node, 'geo:long')) {
    type = 'Point'
    coordinates = [
      p(nodeVal(get1(node, 'geo:long'))),
      p(nodeVal(get1(node, 'geo:lat'))),
    ]
  } else if (get1(node, 'long')) {
    type = 'Point'
    coordinates = [p(nodeVal(get1(node, 'long'))), p(nodeVal(get1(node, 'lat')))]
  } else if (get1(node, 'georss:point')) {
    type = 'Point'
    coordinates = r(nodeVal(get1(node, 'georss:point')).split(' '))
  } else if (get1(node, 'point')) {
    type = 'Point'
    coordinates = r(nodeVal(get1(node, 'point')).split(' '))
  } else {
    const line = get1(node, 'georss:line')
    const poly = get1(node, 'georss:polygon')
    if (line || poly) {
      type = line ? 'LineString' : 'Polygon'
      const tag = line ? 'georss:line' : 'georss:polygon'
      coordinates = nodeVal(get1(node, tag)).split(' ')
      if (coordinates.length % 2 !== 0) return
      coordinates = e(coordinates)
      if (poly) {
        coordinates = [coordinates]
      }
    }
  }
  if (type && coordinates) {
    return {
      type: type,
      coordinates: coordinates,
    }
  }
}

function processOne(node) {
  const geometry = geom(node)
  // TODO collect and fire errors
  if (!geometry) return
  const f = {
    type: 'Feature',
    geometry: geometry,
    properties: {
      title: nodeVal(get1(node, 'title')),
      description: nodeVal(get1(node, 'description')),
      link: nodeVal(get1(node, 'link')),
    },
  }
  let media = get1(node, 'media:content')
  let mime
  if (!media) {
    media = get1(node, 'enclosure')
  }
  if (media) {
    mime = attr(media, 'type')
    if (mime.indexOf('image') !== -1) {
      f.properties.img = attr(media, 'url') // How not to invent a key?
    }
  }
  return f
}
