customElements.define(
  'elevation-chart',
  class extends HTMLElement {
    constructor() {
      super()
      this.addEventListener('DataAvailable', this)
    }

    async handleEvent(event) {
      this.data = event.detail.data
      const object = this.querySelector('object')

      object.addEventListener('load', () => {
        const svgDocument = object.contentDocument
        for (const rect of svgDocument.querySelectorAll('rect')) {
          rect.addEventListener('mouseover', (event) => {
            const dataset = event.target.dataset
            const latlng = this.data[dataset.pointIndex]
            this.querySelector('#altitude').textContent = latlng.ele.toFixed(0)
          })
        }
      })
    }
  },
)
