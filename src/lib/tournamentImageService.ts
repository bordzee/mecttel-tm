import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { isStorageConfigured, storage } from './firebase'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const COVER_EXTENSIONS = ['jpg', 'png', 'webp'] as const

function coverRef(tournamentId: string, ext: string) {
  return ref(storage, `tournaments/${tournamentId}/cover.${ext}`)
}

export function validateTournamentImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return 'Use a JPEG, PNG, or WebP image'
  if (file.size > MAX_BYTES) return 'Image must be 2 MB or smaller'
  return null
}

export function validateImageUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Image URL must start with http:// or https://'
    }
    return null
  } catch {
    return 'Enter a valid image URL'
  }
}

export async function resolveTournamentImageForSave(
  tournamentId: string,
  options: {
    file?: File | null
    urlInput?: string
    clear?: boolean
    existingUrl?: string | null
  },
): Promise<string | null> {
  if (options.file) {
    if (!isStorageConfigured || import.meta.env.VITE_FIREBASE_IMAGE_UPLOAD !== 'true') {
      throw new Error(
        'File upload needs Firebase Storage on the Blaze plan. Paste an image URL instead.',
      )
    }
    return uploadTournamentImage(tournamentId, options.file)
  }

  const url = options.urlInput?.trim() ?? ''
  if (url) {
    const validation = validateImageUrl(url)
    if (validation) throw new Error(validation)
    return url
  }

  if (options.clear) {
    await deleteTournamentImageFiles(tournamentId)
    return null
  }

  return options.existingUrl ?? null
}

export async function uploadTournamentImage(tournamentId: string, file: File): Promise<string> {
  if (!isStorageConfigured) throw new Error('Firebase Storage is not configured')
  const validation = validateTournamentImageFile(file)
  if (validation) throw new Error(validation)

  await deleteTournamentImageFiles(tournamentId)

  const ext = EXT_BY_TYPE[file.type]!
  await uploadBytes(coverRef(tournamentId, ext), file, { contentType: file.type })
  return getDownloadURL(coverRef(tournamentId, ext))
}

export async function deleteTournamentImageFiles(tournamentId: string) {
  if (!isStorageConfigured) return
  await Promise.all(
    COVER_EXTENSIONS.map(async (ext) => {
      try {
        await deleteObject(coverRef(tournamentId, ext))
      } catch {
        // ignore missing files
      }
    }),
  )
}
