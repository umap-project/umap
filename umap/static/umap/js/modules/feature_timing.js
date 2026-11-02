// Strict calendar dates, with the same midnight UTC boundaries as the server.
export function parseTimingDate(value) {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))
    return null
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(timestamp) || value.slice(0, 4) === '0000') return null
  return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null
}

export function resolveTimingDate(value, properties) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'string' && /^\{[^{}]+\}$/.test(value)) {
    const key = value.slice(1, -1)
    if (properties === undefined) return null
    value = Object.hasOwn(properties, key) ? properties[key] : undefined
    if (value === undefined || value === null || value === '') return null
  }
  if (typeof value === 'string' && /^[0-9]{2}\.[0-9]{2}\.[0-9]{4}$/.test(value))
    value = `${value.slice(6)}-${value.slice(3, 5)}-${value.slice(0, 2)}`
  const parsed = parseTimingDate(value)
  if (parsed === null) throw Error('Invalid calendar date')
  return parsed
}

export function resolveTiming(timing, properties) {
  if (timing === undefined || timing === null) return { hide: null, delete: null }
  if (typeof timing !== 'object' || Array.isArray(timing)) throw Error('Invalid timing')
  if (timing.enabled !== undefined && typeof timing.enabled !== 'boolean')
    throw Error('Invalid enabled option')
  if (
    timing.expiryAction !== undefined &&
    !['delete', 'move'].includes(timing.expiryAction)
  )
    throw Error('Invalid expiry action')
  if (
    timing.expiryAction === 'move' &&
    (typeof timing.archiveLayer !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        timing.archiveLayer
      ))
  )
    throw Error('Invalid archive layer')
  const hide = resolveTimingDate(timing.hideOn, properties)
  let deletion = resolveTimingDate(timing.deleteOn, properties)
  const delay = timing.deleteAfter
  const calculated = delay !== undefined && delay !== null && delay !== ''
  if (calculated) {
    const unit = timing.deleteUnit === undefined ? 'days' : timing.deleteUnit
    if (
      !Number.isInteger(delay) ||
      delay < 1 ||
      delay > 36500 ||
      !['days', 'months'].includes(unit)
    )
      throw Error('Invalid retention period')
    if (!timing.hideOn || timing.deleteOn) throw Error('Invalid retention basis')
    if (hide !== null) {
      const date = new Date(hide)
      if (unit === 'days') date.setUTCDate(date.getUTCDate() + delay)
      else {
        const day = date.getUTCDate()
        date.setUTCDate(1)
        date.setUTCMonth(date.getUTCMonth() + delay)
        const end = new Date(date.getTime())
        end.setUTCMonth(end.getUTCMonth() + 1)
        end.setUTCDate(0)
        date.setUTCDate(Math.min(day, end.getUTCDate()))
      }
      if (date.getUTCFullYear() > 9999) throw Error('Date out of range')
      deletion = date.getTime()
    }
  }
  if (hide !== null && deletion !== null && hide > deletion)
    throw Error('Invalid order')
  if (timing.enabled && !timing.deleteOn && !calculated)
    throw Error('Missing deletion date')
  if (
    [
      ['hideOn', hide],
      ['deleteOn', deletion],
    ].some(
      ([key, resolved]) =>
        typeof timing[key] === 'string' &&
        /^\{[^{}]+\}$/.test(timing[key]) &&
        resolved === null
    )
  )
    return { hide: null, delete: null }
  return { hide, delete: deletion }
}

export function validateTiming(timing, properties) {
  try {
    resolveTiming(timing, properties)
    return true
  } catch {
    return false
  }
}

export function isTimeHidden(timing, editing, now = Date.now(), properties = {}) {
  if (editing || !timing?.enabled || !validateTiming(timing, properties)) return false
  const resolved = resolveTiming(timing, properties)
  const boundary = resolved.hide ?? resolved.delete
  return boundary !== null && now >= boundary
}

export function nextHideTime(features, now = Date.now()) {
  let next = Number.POSITIVE_INFINITY
  for (const feature of features) {
    const timing = feature.properties?._umap_options?.timing
    if (!timing?.enabled || !validateTiming(timing, feature.properties)) continue
    const resolved = resolveTiming(timing, feature.properties)
    const boundary = resolved.hide ?? resolved.delete
    if (boundary !== null && boundary > now) next = Math.min(next, boundary)
  }
  return next
}
