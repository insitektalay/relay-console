export function getCurrentUserAvatarUrl(
  user?: {
    avatarUrl?: string | null
    email?: string | null
    name?: string | null
  } | null
) {
  if (user?.avatarUrl) return user.avatarUrl

  const name = user?.name?.trim().toLowerCase()
  const email = user?.email?.trim().toLowerCase()
  if (name === "alex kerss" || email?.startsWith("alex")) {
    return "/avatars/alex-kerss.png"
  }

  return undefined
}
