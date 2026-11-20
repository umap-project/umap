import { translate } from './i18n.js'
import { WithTemplate } from './utils.js'

const TOOLBOX_TEMPLATE = `
  <ul class="umap-slideshow-toolbox dark">
    <li class="play" title="${translate('Start slideshow')}" data-ref="play">
      <div class="spinner" style="animation: none;"></div>
    </li>
    <li class="stop" title="${translate('Stop slideshow')}" data-ref="stop"></li>
    <li class="prev" title="${translate('Zoom to the previous')}" data-ref="previous"></li>
    <li class="next" title="${translate('Zoom to the next')}" data-ref="next"></li>
  </ul>
`

export default class Slideshow extends WithTemplate {
  constructor(app, properties) {
    super()
    this.app = app
    this._id = null
    this.CLASSNAME = 'umap-slideshow-active'
    this.app.properties.slideshow ??= {}
    this.load()

    if (this.properties.autoplay) {
      this.app.onceDataLoaded(() => this.play())
    }
    app.on('edit:enabled', () => this.stop())
  }

  get current() {
    const { selection } = this.app
    if (selection.size === 1) return selection.features[0]
  }

  get next() {
    return this.current?.getNext() || this.defaultDatalayer()?.features.first()
  }

  load() {
    this.setProperties(this.app.properties.slideshow)
  }

  setProperties(properties = {}) {
    this.properties = Object.assign(
      {
        delay: 5000,
        autoplay: false,
      },
      properties
    )
  }

  defaultDatalayer() {
    return this.app.layers.tree.find((d) => d.canBrowse())
  }

  startSpinner() {
    const time = Number.parseInt(this.properties.delay, 10)
    if (!time) return
    const css = `rotation ${time / 1000}s infinite linear`
    const spinner = document.querySelector('.umap-slideshow-toolbox .play .spinner')
    spinner.style.animation = css
  }

  stopSpinner() {
    const spinner = document.querySelector('.umap-slideshow-toolbox .play .spinner')
    spinner.style.animation = 'none'
  }

  isEnabled() {
    return Boolean(this.properties.active)
  }

  play() {
    if (this._id) return
    if (this.app.editEnabled || !this.isEnabled()) return
    document.body.classList.add(this.CLASSNAME)
    this._id = window.setInterval(() => this.loop(), this.properties.delay)
    this.startSpinner()
    this.loop()
  }

  loop() {
    this.step(this.next)
  }

  pause() {
    if (this._id) {
      this.stopSpinner()
      document.body.classList.remove(this.CLASSNAME)
      window.clearInterval(this._id)
      this._id = null
    }
  }

  stop() {
    this.pause()
  }

  forward() {
    this.pause()
    this.step(this.next)
  }

  backward() {
    this.pause()
    this.step(this.current?.getPrevious())
  }

  step(feature) {
    if (!feature) return this.stop()
    feature.zoomTo({ easing: this.properties.easing })
    feature.view()
  }

  toggle() {
    this._id ? this.pause() : this.play()
  }

  renderToolbox(container) {
    container.appendChild(this.loadTemplate(TOOLBOX_TEMPLATE))
    this.elements.play.addEventListener('click', this.toggle.bind(this))
    this.elements.stop.addEventListener('click', this.stop.bind(this))
    this.elements.previous.addEventListener('click', this.backward.bind(this))
    this.elements.next.addEventListener('click', this.forward.bind(this))
  }
}
