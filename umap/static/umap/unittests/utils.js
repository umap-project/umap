import { describe, it } from 'mocha'
import * as Utils from '../js/modules/utils.js'
import pkg from 'chai'
const { assert, expect } = pkg

// Export JSDOM to the global namespace, to be able to check for its presence
// in the actual implementation. Avoiding monkeypatching the implementations here.
import { JSDOM } from 'jsdom'
global.JSDOM = JSDOM

describe('Utils', function () {
  describe('#toHTML()', function () {
    it('should handle title', function () {
      assert.equal(Utils.toHTML('# A title'), '<h4>A title</h4>')
    })
    it('should handle title followed by text', function () {
      assert.equal(Utils.toHTML('# A title\nSome text.'), '<h4>A title</h4>Some text.')
    })

    it('should handle title in the middle of the content', function () {
      assert.equal(Utils.toHTML('A phrase\n## A title'), 'A phrase\n<h5>A title</h5>')
    })

    it('should handle hr', function () {
      assert.equal(Utils.toHTML('---'), '<hr>')
    })

    it('should handle bold', function () {
      assert.equal(Utils.toHTML('Some **bold**'), 'Some <strong>bold</strong>')
    })

    it('should handle italic', function () {
      assert.equal(Utils.toHTML('Some *italic*'), 'Some <em>italic</em>')
    })

    it('should handle links without formatting', function () {
      assert.equal(
        Utils.toHTML('A simple http://osm.org link'),
        'A simple <a href="http://osm.org" target="_blank">http://osm.org</a> link'
      )
    })

    it('should handle simple link in title', function () {
      assert.equal(
        Utils.toHTML('# http://osm.org'),
        '<h4><a href="http://osm.org" target="_blank">http://osm.org</a></h4>'
      )
    })

    it('should handle links with url parameter', function () {
      assert.equal(
        Utils.toHTML('A simple https://osm.org/?url=https%3A//anotherurl.com link'),
        'A simple <a href="https://osm.org/?url=https%3A//anotherurl.com" target="_blank">https://osm.org/?url=https%3A//anotherurl.com</a> link'
      )
    })

    it('should handle simple link inside parenthesis', function () {
      assert.equal(
        Utils.toHTML('A simple link (http://osm.org)'),
        'A simple link (<a href="http://osm.org" target="_blank">http://osm.org</a>)'
      )
    })

    it('should handle simple link with formatting', function () {
      assert.equal(
        Utils.toHTML('A simple [[http://osm.org]] link'),
        'A simple <a href="http://osm.org" target="_blank">http://osm.org</a> link'
      )
    })

    it('should handle simple link with formatting and content', function () {
      assert.equal(
        Utils.toHTML('A simple [[http://osm.org|link]]'),
        'A simple <a href="http://osm.org" target="_blank">link</a>'
      )
    })

    it('should handle simple link followed by a carriage return', function () {
      assert.equal(
        Utils.toHTML('A simple link http://osm.org\nAnother line'),
        'A simple link <a href="http://osm.org" target="_blank">http://osm.org</a>\nAnother line'
      )
    })

    it('should handle target option', function () {
      assert.equal(
        Utils.toHTML('A simple http://osm.org link', { target: 'self' }),
        'A simple <a href="http://osm.org" target="_self">http://osm.org</a> link'
      )
    })

    it('should handle image', function () {
      assert.equal(
        Utils.toHTML('A simple image: {{http://osm.org/pouet.png}}'),
        'A simple image: <img src="http://osm.org/pouet.png">'
      )
    })

    it('should handle image without text', function () {
      assert.equal(
        Utils.toHTML('{{http://osm.org/pouet.png}}'),
        '<img src="http://osm.org/pouet.png">'
      )
    })

    it('should handle image with width', function () {
      assert.equal(
        Utils.toHTML('A simple image: {{http://osm.org/pouet.png|100}}'),
        'A simple image: <img style="width:100px;min-width:100px;" src="http://osm.org/pouet.png">'
      )
    })

    it('should handle iframe', function () {
      assert.equal(
        Utils.toHTML('A simple iframe: {{{http://osm.org/pouet.html}}}'),
        'A simple iframe: <div><iframe height="300px" width="100%" src="http://osm.org/pouet.html" frameborder="0"></iframe></div>'
      )
    })

    it('should handle iframe with height', function () {
      assert.equal(
        Utils.toHTML('A simple iframe: {{{http://osm.org/pouet.html|200}}}'),
        'A simple iframe: <div><iframe height="200px" width="100%" src="http://osm.org/pouet.html" frameborder="0"></iframe></div>'
      )
    })

    it('should handle iframe with height and width', function () {
      assert.equal(
        Utils.toHTML('A simple iframe: {{{http://osm.org/pouet.html|200*400}}}'),
        'A simple iframe: <div><iframe height="200px" width="400px" src="http://osm.org/pouet.html" frameborder="0"></iframe></div>'
      )
    })

    it('should handle iframe with height with px', function () {
      assert.equal(
        Utils.toHTML('A simple iframe: {{{http://osm.org/pouet.html|200px}}}'),
        'A simple iframe: <div><iframe height="200px" width="100%" src="http://osm.org/pouet.html" frameborder="0"></iframe></div>'
      )
    })

    it('should handle iframe with url parameter', function () {
      assert.equal(
        Utils.toHTML(
          'A simple iframe: {{{https://osm.org/?url=https%3A//anotherurl.com}}}'
        ),
        'A simple iframe: <div><iframe height="300px" width="100%" src="https://osm.org/?url=https%3A//anotherurl.com" frameborder="0"></iframe></div>'
      )
    })

    it('should handle iframe with height with px', function () {
      assert.equal(
        Utils.toHTML(
          'A double iframe: {{{https://osm.org/pouet}}}{{{https://osm.org/boudin}}}'
        ),
        'A double iframe: <div><iframe height="300px" width="100%" src="https://osm.org/pouet" frameborder="0"></iframe></div><div><iframe height="300px" width="100%" src="https://osm.org/boudin" frameborder="0"></iframe></div>'
      )
    })

    it('http link with http link as parameter as variable', function () {
      assert.equal(
        Utils.toHTML('A phrase with a [[http://iframeurl.com?to=http://another.com]].'),
        'A phrase with a <a href="http://iframeurl.com?to=http://another.com" target="_blank">http://iframeurl.com?to=http://another.com</a>.'
      )
    })

    it('simple bullet points', function () {
      assert.equal(
        Utils.toHTML('* First point\n* Second point\n* Last point'),
        '<ul><li>First point</li><li>Second point</li><li>Last point</li></ul>'
      )
    })

    it('bullet points with bold and italic', function () {
      assert.equal(
        Utils.toHTML('* First *point*\n* Second **point**\n* Last [[https://here.org|point]]'),
        '<ul><li>First <em>point</em></li><li>Second <strong>point</strong></li><li>Last <a href="https://here.org" target="_blank">point</a></li></ul>'
      )
    })

    it('title followed by bullet points', function () {
      assert.equal(
        Utils.toHTML('## Some title\n* First *point*\n* Second **point**\n* Last [[https://here.org|point]]'),
        '<h5>Some title</h5><ul><li>First <em>point</em></li><li>Second <strong>point</strong></li><li>Last <a href="https://here.org" target="_blank">point</a></li></ul>'
      )
    })
  })

  describe('#escapeHTML', function () {
    it('should escape HTML tags', function () {
      assert.equal(Utils.escapeHTML('<span onload="alert(oups)">'), '<span></span>')
    })

    it('should not escape geo: links', function () {
      assert.equal(Utils.escapeHTML('<a href="geo:1,2"></a>'), '<a href="geo:1,2"></a>')
    })

    it('should not escape dir and title attributes', function () {
      assert.equal(
        Utils.escapeHTML('<a title="Title" dir="rtl"></a>'),
        '<a dir="rtl" title="Title"></a>'
      )
    })

    it('should not escape video tag with dedicated attributes', function () {
      assert.equal(
        Utils.escapeHTML(
          '<video width="100%" height="281" controls><source type="video/mp4" src="movie.mp4"></video>'
        ),
        '<video controls="" height="281" width="100%"><source src="movie.mp4" type="video/mp4"></video>'
      )
    })

    it('should not escape audio tag with dedicated attributes', function () {
      assert.equal(
        Utils.escapeHTML(
          '<audio controls><source type="audio/ogg" src="horse.ogg"></audio>'
        ),
        '<audio controls=""><source src="horse.ogg" type="audio/ogg"></audio>'
      )
    })

    it('should not fail with int value', function () {
      assert.equal(Utils.escapeHTML(25), '25')
    })

    it('should not fail with null value', function () {
      assert.equal(Utils.escapeHTML(null), '')
    })
  })

  describe('#greedyTemplate', function () {
    it('should replace simple props', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {variable}.', { variable: 'thing' }),
        'A phrase with a thing.'
      )
    })

    it('should not fail when missing key', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {missing}', {}),
        'A phrase with a '
      )
    })

    it('should process brakets in brakets', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {{{variable}}}.', { variable: 'value' }),
        'A phrase with a {{value}}.'
      )
    })

    it('should not process http links', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {{{http://iframeurl.com}}}.', {
          'http://iframeurl.com': 'value',
        }),
        'A phrase with a {{{http://iframeurl.com}}}.'
      )
    })

    it('should not accept dash', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {var-iable}.', { 'var-iable': 'value' }),
        'A phrase with a {var-iable}.'
      )
    })

    it('should accept colon', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {variable:fr}.', {
          'variable:fr': 'value',
        }),
        'A phrase with a value.'
      )
    })

    it('should accept arobase', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {@variable}.', {
          '@variable': 'value',
        }),
        'A phrase with a value.'
      )
    })

    it('should accept space', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {var iable}.', {
          'var iable': 'value',
        }),
        'A phrase with a value.'
      )
    })

    it('should accept non ascii chars', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {Accessibilité} and {переменная}.', {
          Accessibilité: 'value',
          переменная: 'another',
        }),
        'A phrase with a value and another.'
      )
    })

    it('should replace even with ignore if key is found', function () {
      assert.equal(
        Utils.greedyTemplate(
          'A phrase with a {variable:fr}.',
          { 'variable:fr': 'value' },
          true
        ),
        'A phrase with a value.'
      )
    })

    it('should keep string when using ignore if key is not found', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {variable:fr}.', {}, true),
        'A phrase with a {variable:fr}.'
      )
    })

    it('should replace nested variables', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var}.', { fr: { var: 'value' } }),
        'A phrase with a value.'
      )
    })

    it('should not fail if nested variable is missing', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.foo}.', {
          fr: { var: 'value' },
        }),
        'A phrase with a .'
      )
    })

    it('should not fail with nested variables and no data', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.foo}.', {}),
        'A phrase with a .'
      )
    })

    it('should handle fallback value if any', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.bar|"default"}.', {}),
        'A phrase with a default.'
      )
    })

    it('should handle fallback var if any', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.bar|fallback}.', {
          fallback: 'default',
        }),
        'A phrase with a default.'
      )
    })

    it('should handle multiple fallbacks', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.bar|try.again|"default"}.', {}),
        'A phrase with a default.'
      )
    })

    it('should use the first defined value', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.bar|try.again|"default"}.', {
          try: { again: 'please' },
        }),
        'A phrase with a please.'
      )
    })

    it('should use the first defined value', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with a {fr.var.bar|try.again|"default"}.', {
          try: { again: 'again' },
          fr: { var: { bar: 'value' } },
        }),
        'A phrase with a value.'
      )
    })

    it('should support the first example from #820 when translated to final syntax', function () {
      assert.equal(
        Utils.greedyTemplate('# {name} ({ele|"-"} m ü. M.)', { name: 'Portalet' }),
        '# Portalet (- m ü. M.)'
      )
    })

    it('should support the first example from #820 when translated to final syntax when no fallback required', function () {
      assert.equal(
        Utils.greedyTemplate('# {name} ({ele|"-"} m ü. M.)', {
          name: 'Portalet',
          ele: 3344,
        }),
        '# Portalet (3344 m ü. M.)'
      )
    })

    it('should support white space in fallback', function () {
      assert.equal(
        Utils.greedyTemplate('A phrase with {var|"white space in the fallback."}', {}),
        'A phrase with white space in the fallback.'
      )
    })

    it('should support empty string as fallback', function () {
      assert.equal(
        Utils.greedyTemplate(
          'A phrase with empty string ("{var|""}") in the fallback.',
          {}
        ),
        'A phrase with empty string ("") in the fallback.'
      )
    })

    it('should support e.g. links as fallback', function () {
      assert.equal(
        Utils.greedyTemplate(
          'A phrase with {var|"[[https://osm.org|link]]"} as fallback.',
          {}
        ),
        'A phrase with [[https://osm.org|link]] as fallback.'
      )
    })
  })

  describe('#flattenCoordinates()', function () {
    it('should not alter already flat coords', function () {
      var coords = [
        [1, 2],
        [3, 4],
      ]
      assert.deepEqual(Utils.flattenCoordinates(coords), coords)
    })

    it('should flatten nested coords', function () {
      var coords = [
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

    it('should not fail on empty coords', function () {
      var coords = []
      assert.deepEqual(Utils.flattenCoordinates(coords), coords)
    })
  })

  describe('#usableOption()', function () {
    it('should consider false', function () {
      assert.ok(Utils.usableOption({ key: false }, 'key'))
    })

    it('should consider 0', function () {
      assert.ok(Utils.usableOption({ key: 0 }, 'key'))
    })

    it('should not consider undefined', function () {
      assert.notOk(Utils.usableOption({}, 'key'))
    })

    it('should not consider empty string', function () {
      assert.notOk(Utils.usableOption({ key: '' }, 'key'))
    })

    it('should consider null', function () {
      assert.ok(Utils.usableOption({ key: null }, 'key'))
    })
  })

  describe('#normalize()', function () {
    it('should remove accents', function () {
      // French é
      assert.equal(Utils.normalize('aéroport'), 'aeroport')
      // American é
      assert.equal(Utils.normalize('aéroport'), 'aeroport')
    })
  })

  describe('#sortFeatures()', function () {
    let feat1, feat2, feat3
    before(function () {
      feat1 = { properties: {} }
      feat2 = { properties: {} }
      feat3 = { properties: {} }
    })
    it('should sort feature from custom key', function () {
      feat1.properties.mykey = '13. foo'
      feat2.properties.mykey = '7. foo'
      feat3.properties.mykey = '111. foo'
      let features = Utils.sortFeatures([feat1, feat2, feat3], 'mykey')
      assert.equal(features[0], feat2)
      assert.equal(features[1], feat1)
      assert.equal(features[2], feat3)
    })
    it('should sort feature from multiple keys', function () {
      feat1.properties.mykey = '13. foo'
      feat2.properties.mykey = '111. foo'
      feat3.properties.mykey = '111. foo'
      feat1.properties.otherkey = 'C'
      feat2.properties.otherkey = 'B'
      feat3.properties.otherkey = 'A'
      let features = Utils.sortFeatures([feat1, feat2, feat3], 'mykey,otherkey')
      assert.equal(features[0], feat1)
      assert.equal(features[1], feat3)
      assert.equal(features[2], feat2)
    })
    it('should sort feature from custom key reverse', function () {
      feat1.properties.mykey = '13. foo'
      feat2.properties.mykey = '7. foo'
      feat3.properties.mykey = '111. foo'
      let features = Utils.sortFeatures([feat1, feat2, feat3], '-mykey')
      assert.equal(features[0], feat3)
      assert.equal(features[1], feat1)
      assert.equal(features[2], feat2)
    })
    it('should sort feature from multiple keys with reverse', function () {
      feat1.properties.mykey = '13. foo'
      feat2.properties.mykey = '111. foo'
      feat3.properties.mykey = '111. foo'
      feat1.properties.otherkey = 'C'
      feat2.properties.otherkey = 'B'
      feat3.properties.otherkey = 'A'
      let features = Utils.sortFeatures([feat1, feat2, feat3], 'mykey,-otherkey')
      assert.equal(features[0], feat1)
      assert.equal(features[1], feat2)
      assert.equal(features[2], feat3)
    })
    it('should sort feature with space first', function () {
      feat1.properties.mykey = '1 foo'
      feat2.properties.mykey = '2 foo'
      feat3.properties.mykey = '1a foo'
      let features = Utils.sortFeatures([feat1, feat2, feat3], 'mykey')
      assert.equal(features[0], feat1)
      assert.equal(features[1], feat3)
      assert.equal(features[2], feat2)
    })
  })

  describe('#copyJSON', function () {
    it('should actually copy the JSON', function () {
      let originalJSON = { some: 'json' }
      let returned = Utils.CopyJSON(originalJSON)

      // Change the original JSON
      originalJSON['anotherKey'] = 'value'

      // ensure the two aren't the same object
      assert.notEqual(returned, originalJSON)
      assert.deepEqual(returned, { some: 'json' })
    })
  })

  describe('#getImpactsFromSchema()', function () {
    let getImpactsFromSchema = Utils.getImpactsFromSchema
    it('should return an array', function () {
      expect(getImpactsFromSchema(['foo'], {})).to.be.an('array')
      expect(getImpactsFromSchema(['foo'], { foo: {} })).to.be.an('array')
      expect(getImpactsFromSchema(['foo'], { foo: { impacts: [] } })).to.be.an('array')
      expect(getImpactsFromSchema(['foo'], { foo: { impacts: ['A'] } })).to.be.an(
        'array'
      )
    })

    it('should return a list of unique impacted values', function () {
      let schema = {
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
    it('should return an empty list if nothing is found', function () {
      let schema = {
        foo: { impacts: ['A'] },
        bar: { impacts: ['A', 'B'] },
        baz: { impacts: ['B', 'C'] },
      }

      assert.deepEqual(getImpactsFromSchema(['bad'], schema), [])
    })

    it('should return an empty list if the schema key does not exist', function () {
      let schema = {
        foo: { impacts: ['A'] },
      }

      assert.deepEqual(getImpactsFromSchema(['bad'], schema), [])
    })
    it('should work if the "impacts" key is not defined', function () {
      let schema = {
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
})
