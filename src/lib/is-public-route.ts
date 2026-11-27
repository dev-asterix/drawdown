/**
 * Check if a route is public (accessible without authentication)
 */
export function isPublicRoute(pathname: string): boolean {
  const publicRoutes = ['/privacy', '/terms', '/demo']
  return publicRoutes.includes(pathname)
}
