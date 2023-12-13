L.U.DropControl = L.Class.extend({
    initialize: function (map) {
      this.map = map
      this.dropzone = map._container
    },
  
    enable: function () {
      L.DomEvent.on(this.dropzone, 'dragenter', this.dragenter, this)
      L.DomEvent.on(this.dropzone, 'dragover', this.dragover, this)
      L.DomEvent.on(this.dropzone, 'drop', this.drop, this)
      L.DomEvent.on(this.dropzone, 'dragleave', this.dragleave, this)
    },
  
    disable: function () {
      L.DomEvent.off(this.dropzone, 'dragenter', this.dragenter, this)
      L.DomEvent.off(this.dropzone, 'dragover', this.dragover, this)
      L.DomEvent.off(this.dropzone, 'drop', this.drop, this)
      L.DomEvent.off(this.dropzone, 'dragleave', this.dragleave, this)
    },
  
    dragenter: function (e) {
      L.DomEvent.stop(e)
      this.map.scrollWheelZoom.disable()
      this.dropzone.classList.add('umap-dragover')
    },
  
    dragover: function (e) {
      L.DomEvent.stop(e)
    },
  
    drop: function (e) {
      this.map.scrollWheelZoom.enable()
      this.dropzone.classList.remove('umap-dragover')
      L.DomEvent.stop(e)
      for (let i = 0, file; (file = e.dataTransfer.files[i]); i++) {
        this.map.processFileToImport(file)
      }
      this.map.onceDataLoaded(this.map.fitDataBounds)
    },
  
    dragleave: function () {
      this.map.scrollWheelZoom.enable()
      this.dropzone.classList.remove('umap-dragover')
    },
  })