import { describe, it } from 'mocha'

import pkg from 'chai'
const { expect } = pkg

// App and its collaborators expect a browser-like environment. The shared
// setup only exposes the JSDOM class, so build the globals we need here,
// before importing the modules under test.
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
for (const key of [
  'window',
  'document',
  'history',
  'HTMLElement',
  'Element',
  'Node',
  'CustomEvent',
  'Event',
  'FileReader',
  'FormData',
  'BroadcastChannel',
  'DOMParser',
  'XMLSerializer',
  'getComputedStyle',
  'requestAnimationFrame',
  'MutationObserver',
  'ResizeObserver',
  'IntersectionObserver',
  'Blob',
  'File',
]) {
  try {
    if (dom.window[key] !== undefined) global[key] = dom.window[key]
  } catch {}
}
global.window = dom.window

const { default: App } = await import('../js/modules/app.js')
const { Journal } = await import('../js/modules/journal/engine.js')
const { Filters } = await import('../js/modules/filters.js')

// The two configurations attached to
// https://github.com/umap-project/umap/issues/3531
// They only differ by the label of the map level filter.
const makeConfig = (label) =>
  JSON.stringify({
    type: 'umap',
    geometry: { type: 'Point', coordinates: [2.35, 48.85] },
    properties: {
      name: 'Filter import persistence test',
      zoom: 14,
      fields: [{ key: 'category', type: 'String' }],
      filters: [{ fieldKey: 'category', widget: 'Checkbox', label }],
    },
    layers: [],
  })
const ORIGINAL = makeConfig('Category — ORIGINAL')
const MODIFIED = makeConfig('Category — MODIFIED')

describe('App#importRaw', () => {
  // Build a minimal App standing on an existing (already saved) map, with
  // the real journal engine, filters and export logic. Only the UI
  // collaborators of importRaw (layer creation, rendering, map proxy) are
  // stubbed, as they are not part of the save path under test.
  const makeApp = (serverProperties) => {
    const app = Object.create(App.prototype)
    app._target = new EventTarget()
    app.properties = JSON.parse(JSON.stringify(serverProperties))
    const engine = new Journal(app)
    app.journalEngine = engine
    app.journal = engine.proxy(app)
    app.fields = { pull: () => {}, get: () => undefined }
    app.filters = new Filters(app, app)
    app.createDataLayer = (spec) => ({ spec })
    app.render = () => {}
    app.mapProxy = { setDefaultCenter: () => {} }
    return app
  }

  it('should persist the filters of an imported .umap file on save', async () => {
    // A map previously saved with the ORIGINAL configuration.
    const serverProperties = { ...JSON.parse(ORIGINAL).properties, id: 42 }
    const app = makeApp(serverProperties)
    expect(app.filters.get('category').label).to.equal('Category — ORIGINAL')

    app.importRaw(MODIFIED)
    // The imported filter is the one displayed…
    expect(app.filters.get('category').label).to.equal('Category — MODIFIED')
    // …and the map must be dirty, so that saving persists it.
    expect(app.isDirty).to.be.true

    let persisted = null
    app.save = async () => {
      persisted = app.exportProperties()
      return true
    }
    await app.journalEngine.save()
    expect(persisted, 'map.save() should have been called').to.not.be.null
    expect(persisted.filters).to.deep.equal([
      { fieldKey: 'category', widget: 'Checkbox', label: 'Category — MODIFIED' },
    ])
  })

  it('should not mark the map dirty when the import changes nothing', () => {
    const serverProperties = { ...JSON.parse(ORIGINAL).properties, id: 42 }
    const app = makeApp(serverProperties)
    app.importRaw(ORIGINAL)
    expect(app.isDirty).to.be.false
  })
})
