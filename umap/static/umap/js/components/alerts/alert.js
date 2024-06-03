class uMapAlert extends HTMLElement {
  static info(message, duration = 5000) {
    const event = new CustomEvent('umap:alert', {
      bubbles: true,
      cancelable: true,
      detail: { message, duration },
    })
    document.dispatchEvent(event)
  }

  // biome-ignore lint/style/useNumberNamespace: Number.Infinity returns undefined by default
  static error(message, duration = Infinity) {
    const event = new CustomEvent('umap:alert', {
      bubbles: true,
      cancelable: true,
      detail: { level: 'error', message, duration },
    })
    document.dispatchEvent(event)
  }

  constructor() {
    super()
    this.container = this.querySelector('[role="dialog"]')
    this.element = this.container.querySelector('[role="alert"]')
  }

  _hide() {
    this.setAttribute('hidden', 'hidden')
  }

  _show() {
    this.removeAttribute('hidden')
  }

  _displayAlert(detail) {
    const { level = 'info', duration = 5000, message = '' } = detail
    this.container.dataset.level = level
    this.container.dataset.duration = duration
    this.element.textContent = message
    this._show()
    if (Number.isFinite(duration)) {
      setTimeout(() => {
        this._hide()
      }, duration)
    }
  }

  connectedCallback() {
    this.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) {
        this._hide()
      }
    })
    document.addEventListener('umap:alert', (event) => {
      this._displayAlert(event.detail)
    })
  }
}

class uMapAlertCreation extends uMapAlert {
  static info(
    message,
    // biome-ignore lint/style/useNumberNamespace: Number.Infinity returns undefined by default
    duration = Infinity,
    editLink = undefined,
    sendLink = undefined
  ) {
    const event = new CustomEvent('umap:alert-creation', {
      bubbles: true,
      cancelable: true,
      detail: { message, duration, editLink, sendLink },
    })
    document.dispatchEvent(event)
  }

  constructor() {
    super()
    this.linkWrapper = this.container.querySelector('#link-wrapper')
    this.formWrapper = this.container.querySelector('#form-wrapper')
  }

  _displayCreationAlert(detail) {
    const {
      level = 'info',
      duration = 5000,
      message = '',
      editLink = undefined,
      sendLink = undefined,
    } = detail
    uMapAlert.prototype._displayAlert.call(this, { level, duration, message })
    this.linkWrapper.querySelector('input[type="url"]').value = editLink
    const button = this.linkWrapper.querySelector('input[type="button"]')
    button.addEventListener('click', (event) => {
      event.preventDefault()
      L.Util.copyToClipboard(editLink)
      event.target.value = L._('✅ Copied!')
    })
    if (sendLink) {
      this.formWrapper.removeAttribute('hidden')
      const form = this.formWrapper.querySelector('form')
      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        const formData = new FormData(form)
        const server = new U.ServerRequest()
        this._hide()
        await server.post(sendLink, {}, formData)
      })
    }
  }

  connectedCallback() {
    this.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) {
        this._hide()
      }
    })
    document.addEventListener('umap:alert-creation', (event) => {
      this._displayCreationAlert(event.detail)
    })
  }
}

class uMapAlertChoice extends uMapAlert {
  static error(
    message,
    // biome-ignore lint/style/useNumberNamespace: Number.Infinity returns undefined by default
    duration = Infinity
  ) {
    const event = new CustomEvent('umap:alert-choice', {
      bubbles: true,
      cancelable: true,
      detail: { level: 'error', message, duration },
    })
    document.dispatchEvent(event)
  }

  constructor() {
    super()
    this.choiceWrapper = this.container.querySelector('#choice-wrapper')
  }

  _displayChoiceAlert(detail) {
    const { level = 'info', duration = 5000, message = '' } = detail
    uMapAlert.prototype._displayAlert.call(this, { level, duration, message })
    const form = this.choiceWrapper.querySelector('form')
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      switch (event.submitter.id) {
        case 'your-changes':
          document.dispatchEvent(
            new CustomEvent('umap:alert-choice-override', {
              bubbles: true,
              cancelable: true,
            })
          )
          break
        case 'their-changes':
          window.location.reload()
          break
      }
      this._hide()
    })
  }

  connectedCallback() {
    this.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) {
        this._hide()
      }
    })
    document.addEventListener('umap:alert-choice', (event) => {
      this._displayChoiceAlert(event.detail)
    })
  }
}

export { uMapAlert, uMapAlertCreation, uMapAlertChoice }
