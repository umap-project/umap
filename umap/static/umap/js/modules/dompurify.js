import { JSDOM } from 'jsdom'
import { default as DOMPurifyInitializer } from '../../vendors/dompurify/purify.es.js'

console.log(DOMPurifyInitializer)

export default function getPurify() {
  if (typeof window === 'undefined') {
    return DOMPurifyInitializer(new JSDOM('').window)
  }
  return DOMPurifyInitializer(window)
}
