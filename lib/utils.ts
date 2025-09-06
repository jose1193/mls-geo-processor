import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats time from milliseconds to human-readable format
 * @param milliseconds - Time in milliseconds
 * @returns Formatted time string (e.g., "2m 15s" or "45s")
 */
export function formatTime(milliseconds: number): string {
  if (!milliseconds || milliseconds <= 0) return "0m 0s";
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}
