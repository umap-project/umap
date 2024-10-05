export class Positioned {
  openAt({ anchor, position }) {
    if (anchor && position === 'top') {
      this.anchorTop(anchor)
    } else if (anchor && position === 'left') {
      this.anchorLeft(anchor)
    } else if (anchor && position === 'bottom') {
      this.anchorBottom(anchor)
    } else {
      this.anchorAbsolute()
    }
  }

  anchorAbsolute() {
    this.container.className = ''
    const left =
      this.parent.offsetLeft +
      this.parent.clientWidth / 2 -
      this.container.clientWidth / 2
    const top = this.parent.offsetTop + 75
    this.setPosition({ top: top, left: left })
  }

  anchorTop(el) {
    this.container.className = 'tooltip-top'
    const coords = this.getPosition(el)
    this.setPosition({
      left: coords.left - 10,
      bottom: this.getDocHeight() - coords.top + 11,
    })
  }

  anchorBottom(el) {
    this.container.className = 'tooltip-bottom'
    const coords = this.getPosition(el)
    this.setPosition({
      left: coords.left,
      top: coords.bottom + 11,
    })
  }

  anchorLeft(el) {
    this.container.className = 'tooltip-left'
    const coords = this.getPosition(el)
    this.setPosition({
      top: coords.top,
      right: document.documentElement.offsetWidth - coords.left + 11,
    })
  }

  getPosition(el) {
    return el.getBoundingClientRect()
  }

  setPosition(coords) {
    if (coords.left) this.container.style.left = `${coords.left}px`
    else this.container.style.left = 'initial'
    if (coords.right) this.container.style.right = `${coords.right}px`
    else this.container.style.right = 'initial'
    if (coords.top) this.container.style.top = `${coords.top}px`
    else this.container.style.top = 'initial'
    if (coords.bottom) this.container.style.bottom = `${coords.bottom}px`
    else this.container.style.bottom = 'initial'
  }

  computePosition([x, y]) {
    let left
    let top
    if (x < window.innerWidth / 2) {
      left = x
    } else {
      left = x - this.container.offsetWidth
    }
    if (y < window.innerHeight / 2) {
      top = Math.min(y, window.innerHeight - this.container.offsetHeight)
    } else {
      top = Math.max(0, y - this.container.offsetHeight)
    }
    this.setPosition({ left, top })
  }

  getDocHeight() {
    const D = document
    return Math.max(
      D.body.scrollHeight,
      D.documentElement.scrollHeight,
      D.body.offsetHeight,
      D.documentElement.offsetHeight,
      D.body.clientHeight,
      D.documentElement.clientHeight
    )
  }
}
