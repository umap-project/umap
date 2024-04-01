describe('L.Util', function () {
  describe('#TextColorFromBackgroundColor', function () {
    it('should output white for black', function () {
      document.body.style.backgroundColor = 'black'
      assert.equal(L.DomUtil.TextColorFromBackgroundColor(document.body), '#ffffff')
    })

    it('should output white for brown', function () {
      document.body.style.backgroundColor = 'brown'
      assert.equal(L.DomUtil.TextColorFromBackgroundColor(document.body), '#ffffff')
    })

    it('should output black for white', function () {
      document.body.style.backgroundColor = 'white'
      assert.equal(L.DomUtil.TextColorFromBackgroundColor(document.body), '#000000')
    })

    it('should output black for tan', function () {
      document.body.style.backgroundColor = 'tan'
      assert.equal(L.DomUtil.TextColorFromBackgroundColor(document.body), '#000000')
    })

    it('should output black by default', function () {
      document.body.style.backgroundColor = 'transparent'
      assert.equal(L.DomUtil.TextColorFromBackgroundColor(document.body), '#000000')
    })
  })
})
