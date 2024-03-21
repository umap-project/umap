/**
 * Generate a pseudo-unique identifier (5 chars long, mixed-case alphanumeric)
 *
 * Here's the collision risk:
 * - for 6 chars, 1 in 100 000
 * - for 5 chars, 5 in 100 000
 * - for 4 chars, 500 in 100 000
 *
 * @returns string
 */
export function generateId() {
  return btoa(Math.random().toString()).substring(10, 15)
}

/**
 * Ensure the ID matches the expected format.
 *
 * @param {string} string
 * @returns {boolean}
 */
export function checkId(string) {
  if (typeof string !== 'string') return false
  return /^[A-Za-z0-9]{5}$/.test(string)
}

export function getImpactsFromSchema(fields, schema) {
  schema = schema || U.SCHEMA
  let impacted = fields
    .map((field) => {
      // remove the option prefix for fields
      // And only keep the first part in case of a subfield
      // (e.g "options.limitBounds.foobar" will just return "limitBounds")
      return field.replace('options.', '').split('.')[0]
    })
    .reduce((acc, field) => {
      // retrieve the "impacts" field from the schema
      // and merge them together using sets
      const impacts = schema[field]?.impacts || []
      impacts.forEach((impact) => acc.add(impact))
      return acc
    }, new Set())

  return Array.from(impacted)
}
