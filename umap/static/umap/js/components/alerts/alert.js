import { translate } from '../../modules/i18n.js'
import { uMapElement } from '../base.js'
import * as Clipboard from '../../modules/clipboard.js'

class Alert extends uMapElement {
  static get observedAttributes() {
    return ['open']
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'open':
        newValue === 'open' ? this._show() : this._hide()
        break
    }
  }

  static info(message, duration = 5000) {
    Alert.emit('alert', { message, duration })
  }

  static success(message, duration = 5000) {
    Alert.emit('alert', { level: 'success', message, duration })
  }

  // biome-ignore lint/style/useNumberNamespace: Number.Infinity returns undefined by default
  static warning(message, duration = Infinity) {
    Alert.emit('alert', { level: 'warning', message, duration })
  }

  // biome-ignore lint/style/useNumberNamespace: Number.Infinity returns undefined by default
  static error(message, duration = Infinity) {
    Alert.emit('alert', { level: 'error', message, duration })
  }

  constructor() {
    super()
    this._hide()
    this.container = this.querySelector('[role="dialog"]')
    this.element = this.container.querySelector('[role="alert"]')
  }

  _hide() {
    this.setAttribute('hidden', 'hidden')
    this.removeAttribute('open')
  }

  _show() {
    this.removeAttribute('hidden')
  }

  _handleClose() {
    this.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) {
        this._hide()
      }
    })
  }

  onAlert(event) {
    const { level = 'info', duration = 5000, message = '' } = event.detail
    this.container.dataset.level = level
    this.container.dataset.duration = duration
    this.element.textContent = message
    this.setAttribute('open', 'open')
    if (this._timeoutId) {
      clearTimeout(this._timeoutId)
    }
    if (Number.isFinite(duration)) {
      this._timeoutId = setTimeout(() => {
        this._hide()
      }, duration)
    }
  }

  connectedCallback() {
    this._handleClose()
    this.listen('alert')
  }
}

class AlertCreation extends Alert {
  static info(
    app,
    message,
    // biome-ignore lint/style/useNumberNamespace: Number.Infinity returns undefined by default
    duration = Infinity,
    editLink = undefined,
    sendCallback = undefined
  ) {
    AlertCreation.emit('alertCreation', {
      app,
      message,
      duration,
      editLink,
      sendCallback,
    })
  }

  constructor() {
    super()
    this.linkWrapper = this.container.querySelector('#link-wrapper')
    this.formWrapper = this.container.querySelector('#form-wrapper')
    this.loginLinks = this.container.querySelectorAll('a.login')
  }

  onAlertCreation(event) {
    const {
      app,
      level = 'info',
      duration = 5000,
      message = '',
      editLink = undefined,
      sendCallback = undefined,
    } = event.detail
    Alert.prototype.onAlert.call(this, { detail: { level, duration, message } })
    this.linkWrapper.querySelector('input[type="url"]').value = editLink
    const button = this.linkWrapper.querySelector('input[type="button"]')
    button.addEventListener('click', (event) => {
      event.preventDefault()
      Clipboard.copy(editLink)
    })
    for (const link of this.loginLinks) {
      link.addEventListener('click', (event) => {
        event.preventDefault()
        app.askForLogin().then(() => {
          app.permissions.attach()
          this._hide()
        })
      })
    }
    if (sendCallback) {
      this.formWrapper.removeAttribute('hidden')
      const form = this.formWrapper.querySelector('form')
      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        const formData = new FormData(form)
        sendCallback(formData)
        this.removeAttribute('open')
      })
    }
  }

  connectedCallback() {
    this._handleClose()
    this.listen('alertCreation')
  }
}

class AlertConflict extends Alert {
  static error(message, forceCallback) {
    AlertConflict.emit('alertConflict', { level: 'error', message, forceCallback })
  }

  constructor() {
    super()
    this.conflictWrapper = this.container.querySelector('#conflict-wrapper')
  }

  onAlertConflict(event) {
    const {
      level = 'info',
      duration = Number.POSITIVE_INFINITY,
      message = '',
      forceCallback = undefined,
    } = event.detail
    Alert.prototype.onAlert.call(this, { detail: { level, duration, message } })
    const form = this.conflictWrapper.querySelector('form')
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      switch (event.submitter.id) {
        case 'your-changes':
          forceCallback()
          break
        case 'their-changes':
          window.location.reload()
          break
      }
      this.removeAttribute('open')
    })
  }

  connectedCallback() {
    this._handleClose()
    this.listen('alertConflict')
  }
}

export { Alert, AlertCreation, AlertConflict }
