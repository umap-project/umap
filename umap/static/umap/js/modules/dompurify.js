import { default as DOMPurifyInitializer } from '../../vendors/dompurify/purify.es.js'
import { JSDOM } from 'jsdom'

console.log(DOMPurifyInitializer)

export default function getPurify() {
  if (typeof window === 'undefined') {
    return DOMPurifyInitializer(new JSDOM('').window)
  } else {
    return DOMPurifyInitializer(window)
  }
}
