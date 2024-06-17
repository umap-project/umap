import { describe, it } from 'mocha'
import * as Utils from '../js/modules/utils.js'
import pkg from 'chai'
const { assert, expect } = pkg

// Export JSDOM to the global namespace, to be able to check for its presence
// in the actual implementation. Avoiding monkeypatching the implementations here.
import { JSDOM } from 'jsdom'
global.JSDOM = JSDOM

describe('Utils', () => {
  describe('#toHTML()', () => {
    it('should handle title', () => {
      assert.equal(Utils.toHTML('# A title'), '<h4>A title</h4>')
    })
    it('should handle title followed by text', () => {
      assert.equal(Utils.toHTML('# A title\nSome text.'), '<h4>A title</h4>Some text.')
    })

    it('should handle title in the middle of the content', () => {
      assert.equal(Utils.toHTML('A phrase\n## A title'), 'A phrase\n<h5>A title</h5>')
    })

    it('should handle hr', () => {
      assert.equal(Utils.toHTML('---'), '<hr>')
    })

    it('should handle bold', () => {
      assert.equal(Utils.toHTML('Some **bold**'), 'Some <strong>bold</strong>')
    })

    it('should handle italic', () => {
      assert.equal(Utils.toHTML('Some *italic*'), 'Some <em>italic</em>')
    })

    it('should handle links without formatting', () => {
      assert.equal(
        Utils.toHTML('A simple http://osm.org link'),
        'A simple <a href="http://osm.org" target="_blank">http://osm.org</a> link'
      )
    })

    it('should handle simple link in title', () => {
      assert.equal(
        Utils.toHTML('# http://osm.org'),
        '<h4><a href="http://osm.org" target="_blank">http://osm.org</a></h4>'
      )
    })

    it('should handle links with url parameter', () => {
      assert.equal(
        Utils.toHTML('A simple https://osm.org/?url=https%3A//anotherurl.com link'),
        'A simple <a href="https://osm.org/?url=https%3A//anotherurl.com" target="_blank">https://osm.org/?url=https%3A//anotherurl.com</a> link'
      )
    })

    it('should handle simple link inside parenthesis', () => {
      assert.equal(
        Utils.toHTML('A simple link (http://osm.org)'),
        'A simple link (<a href="http://osm.org" target="_blank">http://osm.org</a>)'
      )
    })

    it('should handle simple link with formatting', () => {
      assert.equal(
        Utils.toHTML('A simple [[http://osm.org]] link'),
        'A simple <a href="http://osm.org" target="_blank">http://osm.org</a> link'
      )
    })

    it('should handle simple link with formatting and content', () => {
      assert.equal(
        Utils.toHTML('A simple [[http://osm.org|link]]'),
        'A simple <a href="http://osm.org" target="_blank">link</a>'
      )
    })

    it('should handle simple link followed by a carriage return', () => {
      assert.equal(
        Utils.toHTML('A simple link http://osm.org\nAnother line'),
        'A simple link <a href="http://osm.org" target="_blank">http://osm.org</a>\nAnother line'
      )
    })

    it('should handle target option', () => {
      assert.equal(
        Utils.toHTML('A simple http://osm.org link', { target: 'self' }),
        'A simple <a href="http://osm.org" target="_self">http://osm.org</a> link'
      )
    })

    it('should handle image', () => {
      assert.equal(
        Utils.toHTML('A simple image: {{http://osm.org/pouet.png}}'),
        'A simple image: <img src="http://osm.org/pouet.png">'
      )
    })

    it('should handle image without text', () => {
      assert.equal(
        Utils.toHTML('{{http://osm.org/pouet.png}}'),
        '<img src="http://osm.org/pouet.png">'
      )
    })

    it('should handle image with width', () => {
      assert.equal(
        Utils.toHTML('A simple image: {{http://osm.org/pouet.png|100}}'),
        'A simple image: <img style="width:100px;min-width:100px;" src="http://osm.org/pouet.png">'
      )
    })

    it('should handle iframe', () => {
      assert.equal(
        Utils.toHTML('A simple iframe: {{{http://osm.org/pouet.html}}}'),
        'A simple iframe: <div><iframe height="300px" width="100%" src="http://osm.org/pouet.html" frameborder="0"></iframe></div>'
      )
    })

    it('should handle iframe with height', () => {
      assert.equal(
        Utils.toHTML('A simple iframe: {{{http://osm.org/pouet.html|200}}}'),
        'A simple iframe: <div><iframe height="200px" width="100%" src="http://osm.org/pouet.html" frameborder="0"></iframe></div>'
      )
    })

    it('should handle iframe with height and width', () => {
      assert.equal(
        Utils.toHTML('A simple iframe: {{{http://osm.org/pouet.html|200*400}}}'),
        'A simple iframe: <div><iframe height="200px" width="400px" src="http://osm.org/pouet.html" frameborder="0"></iframe></div>'
      )
    })

    it('should handle iframe with height with px', () => {
      assert.equal(
        Utils.toHTML('A simple iframe: {{{http://osm.org/pouet.html|200px}}}'),
        'A simple iframe: <div><iframe height="200px" width="100%" src="http://osm.org/pouet.html" frameborder="0"></iframe></div>'
      )
    })

    it('should handle iframe with url parameter', () => {
      assert.equal(
        Utils.toHTML(
          'A simple iframe: {{{https://osm.org/?url=https%3A//anotherurl.com}}}'
        ),
        'A simple iframe: <div><iframe height="300px" width="100%" src="https://osm.org/?url=https%3A//anotherurl.com" frameborder="0"></iframe></div>'
      )
    })

    it('should handle iframe with height with px', () => {
      assert.equal(
        Utils.toHTML(
          'A double iframe: {{{https://osm.org/pouet}}}{{{https://osm.org/boudin}}}'
        ),
        'A double iframe: <div><iframe height="300px" width="100%" src="https://osm.org/pouet" frameborder="0"></iframe></div><div><iframe height="300px" width="100%" src="https://osm.org/boudin" frameborder="0"></iframe></div>'
      )
    })

    it('http link with http link as parameter as variable', () => {
      assert.equal(
        Utils.toHTML('A phrase with a [[http://iframeurl.com?to=http://another.com]].'),
        'A phrase with a <a href="http://iframeurl.com?to=http://another.com" target="_blank">http://iframeurl.com?to=http://another.com</a>.'
      )
    })

    it('simple bullet points', () => {
      assert.equal(
        Utils.toHTML('* First point\n* Second point\n* Last point'),
        '<ul><li>First point</li><li>Second point</li><li>Last point</li></ul>'
      )
    })

    it('bullet points with bold and italic', () => {
      assert.equal(
        Utils.toHTML(
          '* First *point*\n* Second **point**\n* Last [[https://here.org|point]]'
        ),
        '<ul><li>First <em>point</em></li><li>Second <strong>point</strong></li><li>Last <a href="https://here.org" target="_blank">point</a></li></ul>'
      )
    })

    it('title followed by bullet points', () => {
      assert.equal(
        Utils.toHTML(
          '## Some title\n* First *point*\n* Second **point**\n* Last [[https://here.org|point]]'
        ),
        '<h5>Some title</h5><ul><li>First <em>point</em></li><li>Second <strong>point</strong></li><li>Last <a href="https://here.org" target="_blank">point</a></li></ul>'
      )
    })
  })

  describe('#escapeHTML', () => {
    it('should escape HTML tags', () => {
      assert.equal(Utils.escapeHTML('<span onload="alert(oups)">'), '<span></span>')
    })

    it('should not escape geo: links', () => {
      assert.equal(Utils.escapeHTML('<a href="geo:1,2"></a>'), '<a href="geo:1,2"></a>')
    })

    it('should not escape dir and title attributes', () => {
      assert.equal(
        Utils.escapeHTML('<a title="Title" dir="rtl"></a>'),
        '<a dir="rtl" title="Title"></a>'
      )
    })

    it('should not escape video tag with dedicated attributes', () => {
      assert.equal(
        Utils.escapeHTML(
          '<video width="100%" height="281" controls><source type="video/mp4" src="movie.mp4"></video>'
        ),
        '<video controls="" height="281" width="100%"><source src="movie.mp4" type="video/mp4"></video>'
      )
    })

    it('should not escape audio tag with dedicated attributes', () => {
      assert.equal(
        Utils.escapeHTML(
          '<audio controls><source type="audio/ogg" src="horse.ogg"></audio>'
        ),
        '<audio controls=""><source src="horse.ogg" type="audio/ogg"></audio>'
      )
    })

    it('should not fail with int value', () => {
      assert.equal(Utils.escapeHTML(25), '25')
    })

    it('should not fail with null value', () => {
      assert.equal(Utils.escapeHTML(null), '')
    })
  })

  describe('#greedyTemplate', () => {
    it('should replace simple props', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {variable}.', { variable: 'thing' }),
        'A phrase with a thing.'
      )
    })

    it('should not fail when missing key', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {missing}', {}),
        'A phrase with a '
      )
    })

    it('should process brakets in brakets', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {{{variable}}}.', { variable: 'value' }),
        'A phrase with a {{value}}.'
      )
    })

    it('should not process http links', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {{{http://iframeurl.com}}}.', {
          'http://iframeurl.com': 'value',
        }),
        'A phrase with a {{{http://iframeurl.com}}}.'
      )
    })

    it('should not accept dash', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {var-iable}.', { 'var-iable': 'value' }),
        'A phrase with a {var-iable}.'
      )
    })

    it('should accept colon', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {variable:fr}.', {
          'variable:fr': 'value',
        }),
        'A phrase with a value.'
      )
    })

    it('should accept arobase', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {@variable}.', {
          '@variable': 'value',
        }),
        'A phrase with a value.'
      )
    })

    it('should accept space', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {var iable}.', {
          'var iable': 'value',
        }),
        'A phrase with a value.'
      )
    })

    it('should accept non ascii chars', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {Accessibilité} and {переменная}.', {
          Accessibilité: 'value',
          переменная: 'another',
        }),
        'A phrase with a value and another.'
      )
    })

    it('should replace even with ignore if key is found', () => {
      assert.equal(
        Utils.greedyTemplate(
          'A phrase with a {variable:fr}.',
          { 'variable:fr': 'value' },
          true
        ),
        'A phrase with a value.'
      )
    })

    it('should keep string when using ignore if key is not found', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {variable:fr}.', {}, true),
        'A phrase with a {variable:fr}.'
      )
    })

    it('should replace nested variables', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var}.', { fr: { var: 'value' } }),
        'A phrase with a value.'
      )
    })

    it('should not fail if nested variable is missing', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.foo}.', {
          fr: { var: 'value' },
        }),
        'A phrase with a .'
      )
    })

    it('should not fail with nested variables and no data', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.foo}.', {}),
        'A phrase with a .'
      )
    })

    it('should handle fallback value if any', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.bar|"default"}.', {}),
        'A phrase with a default.'
      )
    })

    it('should handle fallback var if any', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.bar|fallback}.', {
          fallback: 'default',
        }),
        'A phrase with a default.'
      )
    })

    it('should handle multiple fallbacks', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.bar|try.again|"default"}.', {}),
        'A phrase with a default.'
      )
    })

    it('should use the first defined value', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.bar|try.again|"default"}.', {
          try: { again: 'please' },
        }),
        'A phrase with a please.'
      )
    })

    it('should use the first defined value', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.bar|try.again|"default"}.', {
          try: { again: 'again' },
          fr: { var: { bar: 'value' } },
        }),
        'A phrase with a value.'
      )
    })

    it('should support the first example from #820 when translated to final syntax', () => {
      assert.equal(
        Utils.greedyTemplate('# {name} ({ele|"-"} m ü. M.)', { name: 'Portalet' }),
        '# Portalet (- m ü. M.)'
      )
    })

    it('should support the first example from #820 when translated to final syntax when no fallback required', () => {
      assert.equal(
        Utils.greedyTemplate('# {name} ({ele|"-"} m ü. M.)', {
          name: 'Portalet',
          ele: 3344,
        }),
        '# Portalet (3344 m ü. M.)'
      )
    })

    it('should support white space in fallback', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with {var|"white space in the fallback."}', {}),
        'A phrase with white space in the fallback.'
      )
    })

    it('should support empty string as fallback', () => {
      assert.equal(
        Utils.greedyTemplate(
          'A phrase with empty string ("{var|""}") in the fallback.',
          {}
        ),
        'A phrase with empty string ("") in the fallback.'
      )
    })

    it('should support e.g. links as fallback', () => {
      assert.equal(
        Utils.greedyTemplate(
          'A phrase with {var|"[[https://osm.org|link]]"} as fallback.',
          {}
        ),
        'A phrase with [[https://osm.org|link]] as fallback.'
      )
    })

    it('should not consider null values', () => {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {foo|fallback}.', {
          foo: null,
          fallback: 'default',
        }),
        'A phrase with a default.'
      )
    })
  })

  describe('#flattenCoordinates()', () => {
    it('should not alter already flat coords', () => {
      const coords = [
        [1, 2],
        [3, 4],
      ]
      assert.deepEqual(Utils.flattenCoordinates(coords), coords)
    })

    it('should flatten nested coords', () => {
      let coords = [
        [
          [1, 2],
          [3, 4],
        ],
      ]
      assert.deepEqual(Utils.flattenCoordinates(coords), coords[0])
      coords = [
        [
          [
            [1, 2],
            [3, 4],
          ],
        ],
      ]
      assert.deepEqual(Utils.flattenCoordinates(coords), coords[0][0])
    })

    it('should not fail on empty coords', () => {
      const coords = []
      assert.deepEqual(Utils.flattenCoordinates(coords), coords)
    })
  })

  describe('#polygonMustBeFlattened', () => {
    it('should return false for simple polygon', () => {
      const coords = [
        [
          [100.0, 0.0],
          [101.0, 0.0],
          [101.0, 1.0],
          [100.0, 1.0],
          [100.0, 0.0],
        ],
      ]
      assert.notOk(Utils.polygonMustBeFlattened(coords))
    })

    it('should return false for simple polygon with hole', () => {
      const coords = [
        [
          [100.0, 0.0],
          [101.0, 0.0],
          [101.0, 1.0],
          [100.0, 1.0],
          [100.0, 0.0],
        ],
        [
          [100.8, 0.8],
          [100.8, 0.2],
          [100.2, 0.2],
          [100.2, 0.8],
          [100.8, 0.8],
        ],
      ]
      assert.notOk(Utils.polygonMustBeFlattened(coords))
    })

    it('should return false for multipolygon', () => {
      const coords = [
        [
          [
            [102.0, 2.0],
            [103.0, 2.0],
            [103.0, 3.0],
            [102.0, 3.0],
            [102.0, 2.0],
          ],
        ],
        [
          [
            [100.0, 0.0],
            [101.0, 0.0],
            [101.0, 1.0],
            [100.0, 1.0],
            [100.0, 0.0],
          ],
          [
            [100.2, 0.2],
            [100.2, 0.8],
            [100.8, 0.8],
            [100.8, 0.2],
            [100.2, 0.2],
          ],
        ],
      ]
      assert.notOk(Utils.polygonMustBeFlattened(coords))
    })

    it('should return true for false multi polygon', () => {
      const coords = [
        [
          [
            [100.0, 0.0],
            [101.0, 0.0],
            [101.0, 1.0],
            [100.0, 1.0],
            [100.0, 0.0],
          ],
        ],
      ]
      assert.ok(Utils.polygonMustBeFlattened(coords))
    })

    it('should return true for false multi polygon with hole', () => {
      const coords = [
        [
          [
            [100.0, 0.0],
            [101.0, 0.0],
            [101.0, 1.0],
            [100.0, 1.0],
            [100.0, 0.0],
          ],
          [
            [100.8, 0.8],
            [100.8, 0.2],
            [100.2, 0.2],
            [100.2, 0.8],
            [100.8, 0.8],
          ],
        ],
      ]
      assert.ok(Utils.polygonMustBeFlattened(coords))
    })

    it('should return false for empty coords', () => {
      assert.notOk(Utils.polygonMustBeFlattened([]))
    })
  })

  describe('#usableOption()', () => {
    it('should consider false', () => {
      assert.ok(Utils.usableOption({ key: false }, 'key'))
    })

    it('should consider 0', () => {
      assert.ok(Utils.usableOption({ key: 0 }, 'key'))
    })

    it('should not consider undefined', () => {
      assert.notOk(Utils.usableOption({}, 'key'))
    })

    it('should not consider empty string', () => {
      assert.notOk(Utils.usableOption({ key: '' }, 'key'))
    })

    it('should consider null', () => {
      assert.ok(Utils.usableOption({ key: null }, 'key'))
    })
  })

  describe('#normalize()', () => {
    it('should remove accents', () => {
      // French é
      assert.equal(Utils.normalize('aéroport'), 'aeroport')
      // American é
      assert.equal(Utils.normalize('aéroport'), 'aeroport')
    })
  })

  describe('#sortFeatures()', () => {
    let feat1
    let feat2
    let feat3
    before(() => {
      feat1 = { properties: {} }
      feat2 = { properties: {} }
      feat3 = { properties: {} }
    })
    it('should sort feature from custom key', () => {
      feat1.properties.mykey = '13. foo'
      feat2.properties.mykey = '7. foo'
      feat3.properties.mykey = '111. foo'
      const features = Utils.sortFeatures([feat1, feat2, feat3], 'mykey')
      assert.equal(features[0], feat2)
      assert.equal(features[1], feat1)
      assert.equal(features[2], feat3)
    })
    it('should sort feature from multiple keys', () => {
      feat1.properties.mykey = '13. foo'
      feat2.properties.mykey = '111. foo'
      feat3.properties.mykey = '111. foo'
      feat1.properties.otherkey = 'C'
      feat2.properties.otherkey = 'B'
      feat3.properties.otherkey = 'A'
      const features = Utils.sortFeatures([feat1, feat2, feat3], 'mykey,otherkey')
      assert.equal(features[0], feat1)
      assert.equal(features[1], feat3)
      assert.equal(features[2], feat2)
    })
    it('should sort feature from custom key reverse', () => {
      feat1.properties.mykey = '13. foo'
      feat2.properties.mykey = '7. foo'
      feat3.properties.mykey = '111. foo'
      let features = Utils.sortFeatures([feat1, feat2, feat3], '-mykey')
      assert.equal(features[0], feat3)
      assert.equal(features[1], feat1)
      assert.equal(features[2], feat2)
    })
    it('should sort feature from multiple keys with reverse', () => {
      feat1.properties.mykey = '13. foo'
      feat2.properties.mykey = '111. foo'
      feat3.properties.mykey = '111. foo'
      feat1.properties.otherkey = 'C'
      feat2.properties.otherkey = 'B'
      feat3.properties.otherkey = 'A'
      const features = Utils.sortFeatures([feat1, feat2, feat3], 'mykey,-otherkey')
      assert.equal(features[0], feat1)
      assert.equal(features[1], feat2)
      assert.equal(features[2], feat3)
    })
    it('should sort feature with space first', () => {
      feat1.properties.mykey = '1 foo'
      feat2.properties.mykey = '2 foo'
      feat3.properties.mykey = '1a foo'
      const features = Utils.sortFeatures([feat1, feat2, feat3], 'mykey')
      assert.equal(features[0], feat1)
      assert.equal(features[1], feat3)
      assert.equal(features[2], feat2)
    })
  })

  describe('#copyJSON', () => {
    it('should actually copy the JSON', () => {
      const originalJSON = { some: 'json' }
      const returned = Utils.CopyJSON(originalJSON)

      // Change the original JSON
      originalJSON.anotherKey = 'value'

      // ensure the two aren't the same object
      assert.notEqual(returned, originalJSON)
      assert.deepEqual(returned, { some: 'json' })
    })
  })

  describe('#getImpactsFromSchema()', () => {
    const getImpactsFromSchema = Utils.getImpactsFromSchema
    it('should return an array', () => {
      expect(getImpactsFromSchema(['foo'], {})).to.be.an('array')
      expect(getImpactsFromSchema(['foo'], { foo: {} })).to.be.an('array')
      expect(getImpactsFromSchema(['foo'], { foo: { impacts: [] } })).to.be.an('array')
      expect(getImpactsFromSchema(['foo'], { foo: { impacts: ['A'] } })).to.be.an(
        'array'
      )
    })

    it('should return a list of unique impacted values', () => {
      const schema = {
        foo: { impacts: ['A'] },
        bar: { impacts: ['A', 'B'] },
        baz: { impacts: ['B', 'C'] },
      }

      assert.deepEqual(getImpactsFromSchema(['foo'], schema), ['A'])
      assert.deepEqual(getImpactsFromSchema(['foo', 'bar'], schema), ['A', 'B'])
      assert.deepEqual(getImpactsFromSchema(['foo', 'bar', 'baz'], schema), [
        'A',
        'B',
        'C',
      ])
    })
    it('should return an empty list if nothing is found', () => {
      const schema = {
        foo: { impacts: ['A'] },
        bar: { impacts: ['A', 'B'] },
        baz: { impacts: ['B', 'C'] },
      }

      assert.deepEqual(getImpactsFromSchema(['bad'], schema), [])
    })

    it('should return an empty list if the schema key does not exist', () => {
      const schema = {
        foo: { impacts: ['A'] },
      }

      assert.deepEqual(getImpactsFromSchema(['bad'], schema), [])
    })
    it('should work if the "impacts" key is not defined', () => {
      const schema = {
        foo: {},
        bar: { impacts: ['A'] },
        baz: { impacts: ['B'] },
      }

      assert.deepEqual(getImpactsFromSchema(['foo', 'bar', 'baz'], schema), ['A', 'B'])
    })
  })

  describe('#parseNaiveDate', () => {
    it('should parse a date', () => {
      assert.equal(
        Utils.parseNaiveDate('2024/03/04').toISOString(),
        '2024-03-04T00:00:00.000Z'
      )
    })
    it('should parse a datetime', () => {
      assert.equal(
        Utils.parseNaiveDate('2024/03/04 12:13:14').toISOString(),
        '2024-03-04T00:00:00.000Z'
      )
    })
    it('should parse an iso datetime', () => {
      assert.equal(
        Utils.parseNaiveDate('2024-03-04T00:00:00.000Z').toISOString(),
        '2024-03-04T00:00:00.000Z'
      )
    })
    it('should parse a GMT time', () => {
      assert.equal(
        Utils.parseNaiveDate('04 Mar 2024 00:12:00 GMT').toISOString(),
        '2024-03-04T00:00:00.000Z'
      )
    })
    it('should parse a GMT time with explicit timezone', () => {
      assert.equal(
        Utils.parseNaiveDate('Thu, 04 Mar 2024 00:00:00 GMT+0300').toISOString(),
        '2024-03-03T00:00:00.000Z'
      )
    })
  })

  describe('#isObject', () => {
    it('should return true for objects', () => {
      assert.equal(Utils.isObject({}), true)
      assert.equal(Utils.isObject({ foo: 'bar' }), true)
    })

    it('should return false for Array', () => {
      assert.equal(Utils.isObject([]), false)
    })

    it('should return false on null', () => {
      assert.equal(Utils.isObject(null), false)
    })

    it('should return false on undefined', () => {
      assert.equal(Utils.isObject(undefined), false)
    })

    it('should return false on string', () => {
      assert.equal(Utils.isObject(''), false)
    })
  })
})
