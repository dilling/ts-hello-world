import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * The shadcn/ui class helper: merges conditional classes and resolves Tailwind
 * conflicts so a caller's `px-6` beats a component's default `px-4`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
