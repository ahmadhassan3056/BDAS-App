import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}


// Return a clean filename for display (works with Windows and POSIX paths).
export function fileBasename(p) {
  if (!p) return "";
  const s = String(p);
  const parts = s.split(/[/\\]/);
  return parts[parts.length - 1] || s;
}

// Use for fields that may contain a full path but should look like a file ID/name in the UI.
export function prettyFileId(value) {
  if (!value) return "";
  return fileBasename(value);
}
