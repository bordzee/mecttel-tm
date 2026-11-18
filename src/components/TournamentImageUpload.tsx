import { useEffect, useMemo, useRef, useState } from 'react'
import { FormLabel, TextInput } from './ui/primitives'
import { isImageUploadEnabled } from '../lib/firebase'
import { validateImageUrl, validateTournamentImageFile } from '../lib/tournamentImageService'

export function TournamentImageUpload({
  imageUrl,
  urlInput = '',
  onUrlInputChange,
  onFileChange,
  onClear,
  disabled = false,
}: {
  imageUrl?: string | null
  urlInput?: string
  onUrlInputChange?: (url: string) => void
  onFileChange: (file: File | null) => void
  onClear?: () => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [localError, setLocalError] = useState('')

  const trimmedUrl = urlInput.trim()
  const urlPreview = trimmedUrl && !validateImageUrl(trimmedUrl) ? trimmedUrl : null
  const displayUrl = previewUrl ?? urlPreview ?? imageUrl ?? null

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handlePick = (file: File | null) => {
    setLocalError('')
    if (!file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      onFileChange(null)
      return
    }

    const validation = validateTournamentImageFile(file)
    if (validation) {
      setLocalError(validation)
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    onFileChange(file)
    onUrlInputChange?.('')
  }

  const handleUrlChange = (value: string) => {
    setLocalError('')
    onUrlInputChange?.(value)
    if (value.trim()) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      onFileChange(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = () => {
    handlePick(null)
    onUrlInputChange?.('')
    onClear?.()
    if (inputRef.current) inputRef.current.value = ''
  }

  const helperText = useMemo(() => {
    if (isImageUploadEnabled) {
      return 'Upload JPEG, PNG, or WebP (max 2 MB), or paste an image URL.'
    }
    return 'Firebase Storage needs the Blaze plan. Host your image elsewhere (e.g. your website) and paste the link below.'
  }, [])

  const urlError = trimmedUrl ? validateImageUrl(trimmedUrl) : null

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium text-text-steel">Tournament image (optional)</p>

      {displayUrl && (
        <div className="overflow-hidden rounded-[14px] border border-border bg-card-raised">
          <img
            src={displayUrl}
            alt="Tournament cover preview"
            className="w-full aspect-[16/9] object-cover"
          />
        </div>
      )}

      {isImageUploadEnabled && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={disabled}
            onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="press inline-flex h-11 items-center justify-center rounded-[10px] bg-card-raised px-4 text-sm font-medium text-text-primary hover:shadow-[inset_0_0_0_1px_var(--line-strong)] disabled:opacity-50"
            >
              {displayUrl ? 'Change file' : 'Upload file'}
            </button>
          </div>
        </>
      )}

      <div>
        <FormLabel>{isImageUploadEnabled ? 'Or image URL' : 'Image URL'}</FormLabel>
        <TextInput
          value={urlInput}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://example.com/tournament-cover.jpg"
          disabled={disabled}
          inputMode="url"
          autoComplete="url"
        />
      </div>

      {displayUrl && (
        <button
          type="button"
          disabled={disabled}
          onClick={handleRemove}
          className="press inline-flex h-11 items-center justify-center rounded-[10px] bg-card-raised px-4 text-sm font-medium text-text-steel hover:text-danger disabled:opacity-50"
        >
          Remove image
        </button>
      )}

      <p className="text-xs text-text-steel">{helperText}</p>
      {localError && <p className="text-xs font-semibold text-danger">{localError}</p>}
      {urlError && <p className="text-xs font-semibold text-danger">{urlError}</p>}
    </div>
  )
}
