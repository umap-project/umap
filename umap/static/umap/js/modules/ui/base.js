export class Positioned {
  openAt({ anchor, position }) {
    if (anchor && position === 'top') {
      this.anchorTop(anchor)
    } else if (anchor && position === 'bottom') {
      this.anchorBottom(anchor)
    } else if (anchor && position === 'right') {
      this.anchorRight(anchor)
    } else {
      this.anchorAbsolute()
    }
  }

  toggleClassPosition(position) {
    this.container.classList.toggle('tooltip-bottom', position === 'bottom')
    this.container.classList.toggle('tooltip-top', position === 'top')
    this.container.classList.toggle('tooltip-right', position === 'right')
  }

  anchorTop(el) {
    this.toggleClassPosition('top')
    const coords = this.getPosition(el)
    this.setPosition({
      left: coords.left - 10,
      bottom: this.getDocHeight() - coords.top + 11,
    })
  }

  anchorBottom(el) {
    this.toggleClassPosition('bottom')
    const coords = this.getPosition(el)
    const selfCoords = this.getPosition(this.container)
    this.setPosition({
      left: coords.left + coords.width / 2 - selfCoords.width / 2,
      top: coords.bottom + 11,
    })
  }

  anchorRight(el) {
    this.toggleClassPosition('right')
    const coords = this.getPosition(el)
    console.log(coords)
    this.setPosition({
      left: coords.right + 11,
      top: coords.top,
    })
  }

  anchorAbsolute() {
    const left =
      this.parent.offsetLeft +
      this.parent.clientWidth / 2 -
      this.container.clientWidth / 2
    const top = this.parent.offsetTop + 75
    this.setPosition({ top: top, left: left })
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
