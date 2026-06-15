export function isAdminUser(user) {
  return user?.role === 'admin' || user?.role === 'super_admin'
}

export function baseDisplayName(user) {
  return user?.username || user?.name || 'Unknown user'
}

export function formatDisplayName(user) {
  const name = baseDisplayName(user)
  return isAdminUser(user) ? `[ADMIN] ${name}` : name
}
