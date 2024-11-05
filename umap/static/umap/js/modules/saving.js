const _queue = new Set()

export let isDirty = false

export async function save() {
  for (const obj of _queue) {
    const ok = await obj.save()
    if (!ok) break
    remove(obj)
  }
}

export function add(obj) {
  _queue.add(obj)
  _onUpdate()
}

export function remove(obj) {
  _queue.delete(obj)
  _onUpdate()
}

export function has(obj) {
  return _queue.has(obj)
}

function _onUpdate() {
  isDirty = Boolean(_queue.size)
  document.body.classList.toggle('umap-is-dirty', isDirty)
}

export class ServerStored {
  set isDirty(status) {
    if (status) {
      add(this)
    } else {
      remove(this)
    }
    this.onDirty(status)
  }

  get isDirty() {
    return has(this)
  }

  onDirty(status) {}
}
