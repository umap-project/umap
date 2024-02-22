/**
 * Generate a pseudo-unique identifier (4 chars long)
 *
 * Using uppercase + lowercase + digits, here's the collision risk:
 * - for 6 chars, 1 in 100 000
 * - for 5 chars, 5 in 100 000
 * - for 4 chars, 500 in 100 000
 *
 * @returns string
 */
export function generateId() {
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
}
