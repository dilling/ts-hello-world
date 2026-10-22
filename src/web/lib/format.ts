/**
 * Display formatting for wire values — the one place an ISO string becomes something a
 * human reads. Put new formatters here rather than inlining them in a component.
 */

/** ISO string -> locale date+time. `null` means "the server has never set this". */
export function formatTimestamp(value: string | null): string {
  if (!value) return 'never'
  return new Date(value).toLocaleString()
}
