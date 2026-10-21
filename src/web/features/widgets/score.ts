/**
 * One definition of the score thresholds, shared by the table badge and the chart
 * colours so they can never disagree. Swap these for your real coverage bands.
 */
export type ScoreTone = 'success' | 'warning' | 'destructive'

export function scoreTone(score: number): ScoreTone {
  if (score >= 80) return 'success'
  if (score >= 50) return 'warning'
  return 'destructive'
}
