import pkg from 'chai'
import { afterEach, describe, it } from 'mocha'
import { registerLocale, setLocale, translate } from '../js/modules/i18n.js'

const { assert } = pkg

describe('i18n', () => {
  describe('#translate()', () => {
    afterEach(() => setLocale(null))

    it('should substitute provided placeholders', () => {
      assert.equal(translate('Clone of {name}', { name: 'Foo' }), 'Clone of Foo')
    })

    it('should tolerate spaces around placeholder name', () => {
      assert.equal(translate('Go to { coords }', { coords: '1,2' }), 'Go to 1,2')
    })

    it('should leave unknown placeholders untouched', () => {
      assert.equal(translate('Hello {missing}'), 'Hello {missing}')
    })

    it('should substitute placeholders inside a registered translation', () => {
      registerLocale('fr', { 'Clone of {name}': 'Copie de {name}' })
      setLocale('fr')
      assert.equal(translate('Clone of {name}', { name: 'Foo' }), 'Copie de Foo')
    })

    it('should not eat uMap image syntax', () => {
      assert.equal(
        translate('Image with custom width (in px): {{https://image.url.com|width}}'),
        'Image with custom width (in px): {{https://image.url.com|width}}'
      )
    })

    it('should not eat uMap image syntax in a registered translation', () => {
      registerLocale('fr', {
        'Image with custom width (in px): {{https://image.url.com|width}}':
          'Image avec largeur (en pixels) : {{https://image.url.com|largeur}}',
      })
      setLocale('fr')
      assert.equal(
        translate('Image with custom width (in px): {{https://image.url.com|width}}'),
        'Image avec largeur (en pixels) : {{https://image.url.com|largeur}}'
      )
    })

    it('should not eat uMap iframe syntax', () => {
      assert.equal(
        translate('Iframe: {{{https://iframe.url.com}}}'),
        'Iframe: {{{https://iframe.url.com}}}'
      )
    })

    it('should not eat uMap iframe syntax in a registered translation', () => {
      registerLocale('fr', {
        'Iframe: {{{https://iframe.url.com}}}': 'Iframe : {{{https://iframe.url.com}}}',
      })
      setLocale('fr')
      assert.equal(
        translate('Iframe: {{{https://iframe.url.com}}}'),
        'Iframe : {{{https://iframe.url.com}}}'
      )
    })
  })
})
