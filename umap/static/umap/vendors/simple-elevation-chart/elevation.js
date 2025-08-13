function scale(max, min, num) {
  const breathe = 10
  return (100 * (num - min + breathe)) / (max + breathe - min) || 0
}

function elevationColor(value) {
  // Minimize the number of different color variation.
  value = Math.round(Math.abs(value) / 20) * 20
  const red = 255 - value * 5
  const green = 125 - value * 10
  const blue = value
  return `rgb(${red} ${green} ${blue})`
}

function draw() {
  const elem = document.getElementsByTagName('svg')[0]
  let elevationData = JSON.parse(window.frameElement.dataset.elevation)
  elevationData = elevationData.map(([ele, dist]) => {
    return { ele, dist }
  })

  const dataEle = elevationData.map((n) => parseFloat(n.ele, 10) || 0)
  const dataDist = elevationData.map((n) => parseFloat(n.dist, 10) || 0)
  const distTotal = dataDist.reduce((acc, current) => current + acc, 0)
  const max = Math.max(...dataEle)
  const min = Math.min(...dataEle)
  const scaledEle = dataEle.map((num) => scale(max, min, num))
  const length = scaledEle.length
  let width
  let x
  let y
  let height
  let accX = 0
  const far = 8
  for (let i = 0; i < length; i++) {
    const farNext = dataEle[Math.min(i + far, length - far) % length]
    const farPrev = dataEle[Math.max(i + length - far, length + far) % length]
    const diffNextPrev = farNext - farPrev
    const color = elevationColor(diffNextPrev)
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    x = accX
    y = 100 - scaledEle[i]
    height = scaledEle[i] + 1
    width = (dataDist[i] / distTotal) * 100
    accX += width
    rect.setAttribute('x', `${x}%`)
    rect.setAttribute('y', `${y}%`)
    rect.setAttribute('width', `${width}%`)
    rect.setAttribute('height', `${height}%`)
    rect.setAttribute('fill', color)
    rect.setAttribute('data-index', i)
    rect.setAttribute('data-ele', Math.round(dataEle[i]))
    elem.appendChild(rect)
  }
  elem.addEventListener('mouseover', (event) => {
    const eleOver = new CustomEvent('chart:over', {
      detail: { element: event.target },
    })
    window.frameElement.dispatchEvent(eleOver)
  })
}

draw()
