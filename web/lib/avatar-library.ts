const FALLBACK_ILLUSTRATED_AVATARS = [
  "illustrated-black-female-01.png",
  "illustrated-east-asian-male-01.png",
  "illustrated-south-asian-female-01.png",
  "illustrated-middle-eastern-male-01.png",
  "illustrated-latino-female-01.png",
  "illustrated-white-male-01.png",
] as const

function configuredAvatarAssetBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_RELAY_AVATAR_ASSET_BASE_URL?.trim()
  if (!configured) return null

  try {
    const url = new URL(configured)
    if (url.protocol !== "https:") return null
    return url.toString().replace(/\/$/, "")
  } catch {
    return null
  }
}

const avatarAssetBaseUrl = configuredAvatarAssetBaseUrl()

function avatarUrl(fileName: string) {
  const normalizedFileName = fileName.split("/").at(-1) ?? fileName
  return avatarAssetBaseUrl
    ? `${avatarAssetBaseUrl}/illustrated/${normalizedFileName}`
    : `/avatars/illustrated/${normalizedFileName}`
}

const FULL_ILLUSTRATED_AVATAR_NAMES = [
  "illustrated-black-female-01.png",
    "/avatars/illustrated/illustrated-black-female-02.png",
    "/avatars/illustrated/illustrated-black-female-03.png",
    "/avatars/illustrated/illustrated-black-male-01.png",
    "/avatars/illustrated/illustrated-black-male-02.png",
    "/avatars/illustrated/illustrated-black-male-03.png",
    "/avatars/illustrated/illustrated-east-asian-female-01.png",
    "/avatars/illustrated/illustrated-east-asian-female-02.png",
    "/avatars/illustrated/illustrated-east-asian-female-03.png",
    "/avatars/illustrated/illustrated-east-asian-male-01.png",
    "/avatars/illustrated/illustrated-east-asian-male-02.png",
    "/avatars/illustrated/illustrated-east-asian-male-03.png",
    "/avatars/illustrated/illustrated-south-asian-female-01.png",
    "/avatars/illustrated/illustrated-south-asian-female-02.png",
    "/avatars/illustrated/illustrated-south-asian-female-03.png",
    "/avatars/illustrated/illustrated-south-asian-male-01.png",
    "/avatars/illustrated/illustrated-south-asian-male-02.png",
    "/avatars/illustrated/illustrated-south-asian-male-03.png",
    "/avatars/illustrated/illustrated-southeast-asian-female-01.png",
    "/avatars/illustrated/illustrated-southeast-asian-female-02.png",
    "/avatars/illustrated/illustrated-southeast-asian-female-03.png",
    "/avatars/illustrated/illustrated-southeast-asian-male-01.png",
    "/avatars/illustrated/illustrated-southeast-asian-male-02.png",
    "/avatars/illustrated/illustrated-southeast-asian-male-03.png",
    "/avatars/illustrated/illustrated-middle-eastern-female-01.png",
    "/avatars/illustrated/illustrated-middle-eastern-female-02.png",
    "/avatars/illustrated/illustrated-middle-eastern-female-03.png",
    "/avatars/illustrated/illustrated-middle-eastern-male-01.png",
    "/avatars/illustrated/illustrated-middle-eastern-male-02.png",
    "/avatars/illustrated/illustrated-middle-eastern-male-03.png",
    "/avatars/illustrated/illustrated-latino-female-01.png",
    "/avatars/illustrated/illustrated-latino-female-02.png",
    "/avatars/illustrated/illustrated-latino-female-03.png",
    "/avatars/illustrated/illustrated-latino-male-01.png",
    "/avatars/illustrated/illustrated-latino-male-02.png",
    "/avatars/illustrated/illustrated-latino-male-03.png",
    "/avatars/illustrated/illustrated-white-female-01.png",
    "/avatars/illustrated/illustrated-white-female-02.png",
    "/avatars/illustrated/illustrated-white-female-03.png",
    "/avatars/illustrated/illustrated-white-male-01.png",
    "/avatars/illustrated/illustrated-white-male-02.png",
    "illustrated-white-male-03.png",
] as const

const illustratedAvatarNames = avatarAssetBaseUrl
  ? FULL_ILLUSTRATED_AVATAR_NAMES
  : FALLBACK_ILLUSTRATED_AVATARS

export const AVATAR_LIBRARY = {
  photorealistic: [],
  illustrated: illustratedAvatarNames.map(avatarUrl),
  cartoon: [],
  uploaded: ["/avatars/alex-kerss.png"],
} as const

export type AvatarLibraryCategory = keyof typeof AVATAR_LIBRARY

function sheetAvatarRange(sheet: string, start: number, end: number) {
  if (!avatarAssetBaseUrl) return []
  return Array.from({ length: end - start + 1 }, (_, index) => {
    const avatarNumber = String(start + index).padStart(3, "0")
    return avatarUrl(`${sheet}_avatar-${avatarNumber}.png`)
  })
}

/**
 * The category set and ordering used by Relay Console Swift's AvatarEditor.
 * The web bundle already contains the same source artwork under /illustrated.
 */
export const SWIFT_AVATAR_LIBRARY = {
  illustrated: AVATAR_LIBRARY.illustrated.filter(
    (avatar) => !avatar.endsWith("illustrated-white-male-03.png")
  ),
  corporate: [
    ...sheetAvatarRange("sheet-05", 1, 100),
    ...sheetAvatarRange("sheet-06", 1, 24),
  ],
  creator: sheetAvatarRange("sheet-07", 1, 24),
  urban: sheetAvatarRange("sheet-01", 1, 24),
  portrait: [
    ...sheetAvatarRange("sheet-03", 1, 24),
    ...sheetAvatarRange("sheet-10", 1, 24),
  ],
  comic: [
    ...sheetAvatarRange("sheet-08", 1, 24),
    ...sheetAvatarRange("sheet-09", 1, 9),
  ],
  retro: sheetAvatarRange("sheet-09", 10, 24),
  hero: sheetAvatarRange("sheet-04", 1, 24),
  vector: sheetAvatarRange("sheet-02", 1, 24),
} as const

export type SwiftAvatarLibraryCategory = keyof typeof SWIFT_AVATAR_LIBRARY
