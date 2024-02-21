export default class Alerts {
  constructor() {
    this.alertNode = document.querySelector('[role="alert"]')
    const observer = new MutationObserver(this._callback.bind(this))
    observer.observe(this.alertNode, { childList: true })
    // On initial page load, we want to display messages from Django.
    Array.from(this.alertNode.children).forEach(this._display.bind(this))
  }

  _callback(mutationList, observer) {
    for (const mutation of mutationList) {
      this._display(
        [...mutation.addedNodes].filter((item) => item.tagName === 'P').pop()
      )
    }
  }

  _display(alert) {
    const duration = alert.dataset?.duration || 3000
    const level = alert.dataset?.level || 'info'
    const wrapper = document.createElement('div')
    const alertHTML = alert.cloneNode(true).outerHTML
    wrapper.innerHTML = `
    <div data-level="${level}" data-alert data-toclose>
      ${alertHTML}
      <button class="umap-close-link" type="button" data-close>
        <i class="umap-close-icon"></i><span>${L._('Close')}</span>
      </button>
    </div>
    `
    const alertDiv = wrapper.firstElementChild
    this.alertNode.after(alertDiv)
    if (isFinite(duration)) {
      setTimeout(() => {
        alertDiv.remove()
      }, duration)
    }
  }

  add(message, level = 'info', duration = 3000) {
    this.alertNode.innerHTML = `
      <p data-level="${level}" data-duration="${duration}">
        ${message}
      </p>
    `
  }
}

// TODISCUSS: this might be something we want somewhere else.
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-close]')) {
    event.target.closest('[data-toclose]').remove()
  }
})
