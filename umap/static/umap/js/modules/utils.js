export function generateId() {
  // A real implementation would benefit from another id type.
  // Using uppercase + lowercase + digits, here's the collision risk
  // For 6 chars, 1 in 100 000
  // For 5 chars, 5 in 100 000
  // for 4 chars, 500 in 100 000
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
}
