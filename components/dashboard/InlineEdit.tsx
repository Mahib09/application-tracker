"use client"
import { useState, useRef, useEffect } from "react"

interface InlineEditProps {
  value: string
  onSave: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  as?: "input" | "textarea"
}

export default function InlineEdit({
  value,
  onSave,
  placeholder = "—",
  className = "",
  inputClassName = "",
  as = "input",
}: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== value) onSave(trimmed)
  }

  const cancel = () => {
    setEditing(false)
    setDraft(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && as === "input") {
      e.preventDefault()
      commit()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      cancel()
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`text-left w-full rounded px-1.5 py-0.5 -mx-1.5 hover:bg-muted/60 transition-colors ${className}`}
      >
        {value || <span className="text-muted-foreground">{placeholder}</span>}
      </button>
    )
  }

  const sharedProps = {
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: handleKeyDown,
    className: `w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring/50 ${inputClassName}`,
  }

  if (as === "textarea") {
    return <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} rows={3} {...sharedProps} />
  }

  return <input ref={inputRef as React.RefObject<HTMLInputElement>} {...sharedProps} />
}
