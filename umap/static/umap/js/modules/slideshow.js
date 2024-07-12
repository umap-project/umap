import { WithTemplate } from './utils.js'
import { translate } from './i18n.js'

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
  constructor(map, options) {
    super()
    this.map = map
    this._id = null
    this.CLASSNAME = 'umap-slideshow-active'
    this.setOptions(options)
    this._current = null

    if (this.options.autoplay) {
      this.map.onceDataLoaded(function () {
        this.play()
      }, this)
    }
    this.map.on(
      'edit:enabled',
      function () {
        this.stop()
      },
      this
    )
  }

  set current(feature) {
    this._current = feature
  }

  get current() {
    if (!this._current) {
      const datalayer = this.defaultDatalayer()
      if (datalayer) this._current = datalayer.getFeatureByIndex(0)
    }
    return this._current
  }

  get next() {
    if (this._current === null) {
      return this.current
    }
    return this.current.getNext()
  }

  setOptions(options) {
    this.options = Object.assign(
      {
        delay: 5000,
        autoplay: false,
      },
      options
    )
  }

  defaultDatalayer() {
    return this.map.findDataLayer((d) => d.canBrowse())
  }

  startSpinner() {
    const time = Number.parseInt(this.options.delay, 10)
    if (!time) return
    const css = `rotation ${time / 1000}s infinite linear`
    const spinner = document.querySelector('.umap-slideshow-toolbox .play .spinner')
    spinner.style.animation = css
  }

  stopSpinner() {
    const spinner = document.querySelector('.umap-slideshow-toolbox .play .spinner')
    spinner.style.animation = 'none'
  }

  play() {
    if (this._id) return
    if (this.map.editEnabled || !this.map.options.slideshow.active) return
    L.DomUtil.addClass(document.body, this.CLASSNAME)
    this._id = window.setInterval(L.bind(this.loop, this), this.options.delay)
    this.startSpinner()
    this.loop()
  }

  loop() {
    this.current = this.next
    this.step()
  }

  pause() {
    if (this._id) {
      this.stopSpinner()
      L.DomUtil.removeClass(document.body, this.CLASSNAME)
      window.clearInterval(this._id)
      this._id = null
    }
  }

  stop() {
    this.pause()
    this.current = null
  }

  forward() {
    this.pause()
    this.current = this.next
    this.step()
  }

  backward() {
    this.pause()
    if (this.current) this.current = this.current.getPrevious()
    this.step()
  }

  step() {
    if (!this.current) return this.stop()
    this.current.zoomTo({ easing: this.options.easing })
    this.current.view()
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
