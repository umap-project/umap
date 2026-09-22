export class Positioned {
  openAt({ anchor, position, at }) {
    if (at) return this.anchorAt(at, position)
    const point = anchor && this.anchorPoint(anchor, position)
    if (point) this.anchorAt(point, position)
    else this.anchorAbsolute()
  }

  anchorPoint(el, position) {
    const rect = this.getPosition(el)
    switch (position) {
      case 'top':
        return [rect.left + rect.width / 2, rect.top]
      case 'bottom':
        return [rect.left + rect.width / 2, rect.bottom]
      case 'left':
        return [rect.left, rect.top + rect.height / 2]
      case 'right':
        return [rect.right, rect.top + rect.height / 2]
      default:
        return null
    }
  }

  anchorAt([x, y], position) {
    if (!position || position === 'auto') return this.computePosition([x, y])
    this.toggleClassPosition(position)
    this.setPosition({ left: x, top: y })
  }

  toggleClassPosition(position) {
    const positions = [
      'bottom',
      'top',
      'left',
      'right',
      'bottom-right',
      'bottom-left',
      'top-right',
      'top-left',
    ]
    for (const known of positions) {
      this.container.classList.toggle(`tooltip-${known}`, position === known)
    }
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
    let tooltip = ''
    let left
    let top
    if (y < window.innerHeight / 2) {
      top = Math.min(y, window.innerHeight - this.container.offsetHeight)
      tooltip += 'top'
    } else {
      top = Math.max(0, y - this.container.offsetHeight)
      tooltip += 'bottom'
    }
    if (x < window.innerWidth / 2) {
      left = x
      tooltip += '-left'
    } else {
      left = x - this.container.offsetWidth
      tooltip += '-right'
    }
    this.toggleClassPosition(tooltip)
    this.setPosition({ left, top })
  }
}
