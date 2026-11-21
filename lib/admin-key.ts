import { timingSafeEqual } from 'crypto'

// Admin routes send the same ADMIN_SECRET the admin page was opened with.
export function isAdmin(request: Request) {
  const expected = process.env.ADMIN_SECRET
  const given = request.headers.get('x-admin-key')
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
