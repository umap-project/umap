// Utils that needs the DOM
import * as Utils from './utils.js'
import { translate } from './i18n.js'
import Tooltip from './ui/tooltip.js'

export const copyToClipboard = (textToCopy) => {
  const tooltip = new Tooltip()
  // https://stackoverflow.com/a/65996386
  // Navigator clipboard api needs a secure context (https)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textToCopy)
  } else {
    // Use the 'out of viewport hidden text area' trick
    const textArea = document.createElement('textarea')
    textArea.value = textToCopy

    // Move textarea out of the viewport so it's not visible
    textArea.style.position = 'absolute'
    textArea.style.left = '-999999px'

    document.body.prepend(textArea)
    textArea.select()

    try {
      document.execCommand('copy')
    } catch (error) {
      console.error(error)
    } finally {
      textArea.remove()
    }
  }
  tooltip.open({ content: translate('✅ Copied!'), duration: 5000 })
}

export const copiableInput = (parent, label, value) => {
  const [container, { input, button }] = Utils.loadTemplateWithRefs(`
    <div class="copiable-input">
      <label>${label}<input type="text" readOnly value="${value}" data-ref=input /></label>
      <button type="button" class="icon icon-24 icon-copy" title="${translate('copy')}" data-ref=button></button>
    </div>
  `)
  button.addEventListener('click', () => copyToClipboard(input.value))
  parent.appendChild(container)
  return input
}
