import * as Utils from './utils.js'

export const locales = {}

// @property locale: String
// The current locale code, that will be used when translating strings.
export let locale = null

// @function registerLocale(code: String, locale?: Object): String
// Define localized strings for a given locale, defined by `code`.
export function registerLocale(code, locale) {
  locales[code] = Object.assign({}, locales[code], locale)
}
// @function setLocale(code: String): undefined
// Define or change the locale code to be used when translating strings.
export function setLocale(code) {
  locale = code
}

// Until we have a proper way to load `locale` directly from this module,
// without copying to window.L we need to have a getter
export function getLocale() {
  return locale
}

function interpolate(str, ctx) {
  return Utils.escapeHTML(
    str
      .split(/\{|\}/)
      .map((t, i) => (!(i % 2) ? t : ctx[t]))
      .join('')
  )
}

// @function translate(string: String, data?: Object): String
// Actually try to translate the `string`, with optional variable passed in `data`.
export function translate(string, data = {}) {
  if (locale && locales[locale] && locales[locale][string] !== undefined) {
    string = locales[locale][string]
  }
  try {
    // Do not fail if some data is missing
    // a bad translation should not break the app
    string = interpolate(string, data)
  } catch (err) {
    console.error(err)
  }

  return string
}
