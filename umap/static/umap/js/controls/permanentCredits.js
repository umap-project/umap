
L.U.PermanentCreditsControl = L.Control.extend({
  options: {
    position: 'bottomleft',
  },

  initialize: function (map, options) {
    this.map = map
    L.Control.prototype.initialize.call(this, options)
  },

  onAdd: function () {
    const paragraphContainer = L.DomUtil.create(
        'div',
        'umap-permanent-credits-container'
      ),
      creditsParagraph = L.DomUtil.create('p', '', paragraphContainer)

    this.paragraphContainer = paragraphContainer
    this.setCredits()
    this.setBackground()

    return paragraphContainer
  },

  setCredits: function () {
    this.paragraphContainer.innerHTML = L.Util.toHTML(this.map.options.permanentCredit)
  },

  setBackground: function () {
    if (this.map.options.permanentCreditBackground) {
      this.paragraphContainer.style.backgroundColor = '#FFFFFFB0'
    } else {
      this.paragraphContainer.style.backgroundColor = ''
    }
  },
})