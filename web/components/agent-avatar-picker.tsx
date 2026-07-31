"use client"

import { useRef, useState } from "react"
import { CheckCircle2, ImageIcon, Upload, UserRoundPlus } from "lucide-react"
import { toast } from "sonner"

import {
  SWIFT_AVATAR_LIBRARY,
  type SwiftAvatarLibraryCategory,
} from "@/lib/avatar-library"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

const CATEGORY_LABELS: Record<SwiftAvatarLibraryCategory, string> = {
  illustrated: "Illustrated",
  corporate: "Corporate",
  creator: "Creator",
  urban: "Urban",
  portrait: "Portrait",
  comic: "Comic",
  retro: "Retro",
  hero: "Hero",
  vector: "Vector",
}

export function AgentAvatarPicker({
  value,
  customValue,
  onChange,
  onUpload,
  disabled = false,
  compact = false,
}: {
  value?: string | null
  customValue?: string | null
  onChange: (value: string | null) => void
  onUpload: (file: File) => Promise<string>
  disabled?: boolean
  compact?: boolean
}) {
  void [customValue, compact]
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [activeCategory, setActiveCategory] =
    useState<SwiftAvatarLibraryCategory>("illustrated")
  const [isUploading, setIsUploading] = useState(false)
  const activeAvatars = SWIFT_AVATAR_LIBRARY[activeCategory]

  async function handleUpload(file: File | undefined) {
    if (!file) return
    setIsUploading(true)
    try {
      const avatarUrl = await onUpload(file)
      onChange(avatarUrl)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to upload avatar"
      )
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className={cn("space-y-4", disabled && "opacity-60")}>
      <div className="flex min-w-0 items-center gap-4">
        <Avatar className="size-24 border border-dashed border-zinc-600 bg-[var(--claw-bg-inset)]">
          <AvatarImage src={value ?? undefined} />
          <AvatarFallback className="bg-[var(--claw-bg-inset)] text-[var(--claw-accent-blue)]">
            <UserRoundPlus className="size-10 stroke-[1.8]" />
          </AvatarFallback>
        </Avatar>
        <div className="text-base font-semibold text-[var(--claw-text-primary)]">
          Avatar
        </div>
      </div>

      <div className="space-y-2">
        <div className="claw-meta font-semibold text-zinc-500">Avatar type</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7">
          {(
            Object.keys(SWIFT_AVATAR_LIBRARY) as SwiftAvatarLibraryCategory[]
          ).map((category) => {
            const selected = activeCategory === category
            return (
              <button
                key={category}
                className={cn(
                  "flex h-10 min-w-0 items-center gap-2 rounded-[4px] border px-3 text-left text-sm font-semibold transition-colors",
                  selected
                    ? "border-[color-mix(in_srgb,var(--claw-accent-blue)_55%,var(--claw-border))] bg-[var(--claw-bg-selected)] text-[var(--claw-text-primary)]"
                    : "border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-inset)] text-[var(--claw-text-secondary)] hover:border-[var(--claw-border)]"
                )}
                disabled={disabled}
                onClick={() => setActiveCategory(category)}
                type="button"
              >
                {selected ? (
                  <CheckCircle2 className="size-4 shrink-0 fill-[var(--claw-accent-blue)] text-[var(--claw-accent-blue)]" />
                ) : (
                  <span className="size-4 shrink-0 rounded-full border-2 border-zinc-500" />
                )}
                <span className="truncate">{CATEGORY_LABELS[category]}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mission-scrollbar max-h-[clamp(300px,42vh,520px)] overflow-y-auto py-1">
        <div className="mx-auto grid w-fit grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8">
          {activeAvatars.map((avatarUrl) => (
            <button
              key={avatarUrl}
              aria-label={`Use ${CATEGORY_LABELS[activeCategory]} avatar`}
              className={cn(
                "rounded-full border-2 p-0.5 transition-colors hover:border-[var(--claw-accent-blue)]",
                value === avatarUrl
                  ? "border-[var(--claw-accent-blue)]"
                  : "border-transparent"
              )}
              disabled={disabled}
              onClick={() => onChange(avatarUrl)}
              type="button"
            >
              <Avatar className="size-[52px]">
                <AvatarImage alt="" src={avatarUrl} />
                <AvatarFallback>
                  <ImageIcon className="size-4" />
                </AvatarFallback>
              </Avatar>
            </button>
          ))}
        </div>
      </div>

      <div>
        <input
          ref={inputRef}
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          disabled={disabled || isUploading}
          type="file"
          onChange={(event) => void handleUpload(event.target.files?.[0])}
        />
        <Button
          disabled={disabled || isUploading}
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Upload className="mr-2 size-4" />
          {isUploading ? "Uploading..." : "Upload"}
        </Button>
      </div>
    </div>
  )
}
