export default class DropControl {
  constructor(app, dropzone) {
    this.app = app
    this.dropzone = dropzone
  }

  enable() {
    this.controller = new AbortController()
    this.dropzone.addEventListener('dragenter', (event) => this.dragenter(event), {
      signal: this.controller.signal,
    })
    this.dropzone.addEventListener('dragover', (event) => this.dragover(event), {
      signal: this.controller.signal,
    })
    this.dropzone.addEventListener('drop', (event) => this.drop(event), {
      signal: this.controller.signal,
    })
    this.dropzone.addEventListener('dragleave', (event) => this.dragleave(event), {
      signal: this.controller.signal,
    })
  }

  disable() {
    this.controller.abort()
  }

  dragenter(event) {
    if (event.target !== this.dropzone) return false
    event.stopPropagation()
    event.preventDefault()
    this.dropzone.classList.add('umap-dragover')
  }

  dragover(event) {
    event.stopPropagation()
    event.preventDefault()
  }

  drop(event) {
    if (event.target !== this.dropzone) return false
    this.dropzone.classList.remove('umap-dragover')
    event.stopPropagation()
    event.preventDefault()
    // dataTransfer must be consumed before async context
    const files = event.dataTransfer.files
    this.app.loadImporter().then((importer) => {
      importer.build()
      importer.files = files
      importer.submit()
    })
  }

  dragleave() {
    this.dropzone.classList.remove('umap-dragover')
  }
}
