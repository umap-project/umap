import { translate } from '../i18n.js'
import { WithTemplate } from '../utils.js'

const TEMPLATE = `
  <dialog data-ref="dialog">
    <form method="dialog" data-ref="form">
      <ul class="buttons">
        <li><i class="icon icon-16 icon-close" data-close></i></li>
        <li hidden data-ref="back"><i class="icon icon-16 icon-back"></i></li>
      </ul>
      <h3 data-ref="message" id="${Math.round(Date.now()).toString(36)}"></h3>
      <fieldset data-ref="fieldset" role="document">
        <div data-ref="template"></div>
      </fieldset>
      <menu>
        <button type="button" data-ref="cancel" data-close value="cancel"></button>
        <button type="submit" class="button" data-ref="accept" value="accept"></button>
      </menu>
    </form>
  </dialog>
`

// From https://css-tricks.com/replace-javascript-dialogs-html-dialog-element/
export default class Dialog extends WithTemplate {
  constructor(settings = {}) {
    super()
    this.settings = Object.assign(
      {
        accept: translate('OK'),
        cancel: translate('Cancel'),
        className: '',
        message: '',
        template: '',
      },
      settings
    )
    this.init()
  }

  collectFormData() {
    const formData = new FormData(this.elements.form)
    const object = {}
    formData.forEach((value, key) => {
      if (!Reflect.has(object, key)) {
        object[key] = value
        return
      }
      if (!Array.isArray(object[key])) {
        object[key] = [object[key]]
      }
      object[key].push(value)
    })
    return object
  }

  getFocusable() {
    return [
      ...this.dialog.querySelectorAll(
        'button,[href],select,textarea,input:not([type="hidden"]),[tabindex]:not([tabindex="-1"])'
      ),
    ]
  }

  init() {
    this.dialogSupported = typeof HTMLDialogElement === 'function'
    this.dialog = this.loadTemplate(TEMPLATE)
    this.dialog.dataset.component = this.dialogSupported ? 'dialog' : 'no-dialog'
    document.body.appendChild(this.dialog)

    this.focusable = []

    this.dialog.setAttribute('aria-labelledby', this.elements.message.id)
    this.dialog.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) {
        this.close()
      }
    })
    if (!this.dialogSupported) {
      this.elements.form.addEventListener('submit', (event) => {
        event.preventDefault()
        this.dialog.returnValue = 'accept'
        this.close()
      })
    }
    this.dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (!this.dialogSupported) {
          e.preventDefault()
          this.elements.form.requestSubmit()
        }
      }
      if (e.key === 'Escape') {
        e.stopPropagation()
        this.close()
      }
    })
  }

  currentZIndex() {
    return Math.max(
      ...Array.from(document.querySelectorAll('dialog')).map((el) => {
        const zIndex = window.getComputedStyle(el).getPropertyValue('z-index')
        if (zIndex === 'auto') return 0
        return zIndex || 0
      })
    )
  }

  open(settings = {}) {
    const dialog = Object.assign({}, this.settings, settings)
    this.dialog.className = 'umap-dialog window'
    if (dialog.className) {
      this.dialog.classList.add(...dialog.className.split(' '))
    }
    this.elements.accept.textContent = dialog.accept
    this.elements.accept.hidden = !dialog.accept
    this.elements.cancel.textContent = dialog.cancel
    this.elements.cancel.hidden = !dialog.cancel
    this.elements.message.textContent = dialog.message
    this.elements.message.hidden = !dialog.message
    this.elements.target = dialog.target || ''
    this.elements.template.innerHTML = ''
    if (dialog.template?.nodeType === 1) {
      this.elements.template.appendChild(dialog.template)
    } else {
      this.elements.template.innerHTML = dialog.template || ''
    }
    this.elements.back.hidden = !dialog.back
    if (dialog.back) {
      this.elements.back.addEventListener('click', dialog.back)
    }

    this.focusable = this.getFocusable()
    this.hasFormData = this.elements.fieldset.elements.length > 0

    const currentZIndex = this.currentZIndex()
    if (currentZIndex) {
      this.dialog.style.zIndex = currentZIndex + 1
    }

    this.toggle(true)

    if (this.hasFormData) this.focusable[0].focus()
    else this.elements.accept.focus()

    return this.waitForUser()
  }

  on(...args) {
    this.dialog.addEventListener(...args)
  }

  close() {
    this.toggle(false)
    this.dialog.returnValue = undefined
  }

  toggle(open = false) {
    if (this.dialogSupported) {
      if (open) this.dialog.show()
      else this.dialog.close()
    } else {
      this.dialog.hidden = !open
      if (this.elements.target && !open) {
        this.elements.target.focus()
      }
      if (!open) {
        this.dialog.dispatchEvent(new CustomEvent('close'))
      }
    }
  }

  waitForUser() {
    return new Promise((resolve) => {
      this.dialog.addEventListener(
        'close',
        (event) => {
          if (this.dialog.returnValue === 'accept') {
            const value = this.hasFormData ? this.collectFormData() : true
            resolve(value)
          }
        },
        { once: true }
      )
    })
  }

  alert(config) {
    return this.open(
      Object.assign({}, config, { cancel: false, message, template: false })
    )
  }

  confirm(message, config = {}) {
    return this.open(Object.assign({}, config, { message, template: false }))
  }

  prompt(message, fallback = '', config = {}) {
    const template = `<input type="text" name="prompt" value="${fallback}">`
    return this.open(Object.assign({}, config, { message, template }))
  }
}
