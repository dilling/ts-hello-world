/**
 * Display formatting for wire values. Every DTO timestamp is an ISO *string* (see the
 * note in `src/shared/widget.ts`), so there is exactly one place that turns one into
 * something a human reads.
 *
 * This file exists because `formatTimestamp` had already been copy-pasted into two
 * components. Put new formatters here rather than inlining a third copy.
 */

/** ISO string -> locale date+time. `null` means "the server has never set this". */
export function formatTimestamp(value: string | null): string {
  if (!value) return 'never'
  return new Date(value).toLocaleString()
}
