import type { Widget } from '@shared/widget'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { scoreTone } from './score'

/**
 * Score-by-widget bar chart — the stand-in for "coverage by repo".
 *
 * Presentational only: it takes data as a prop and does no fetching. That keeps it
 * trivial to test and reusable on a team page later, where the data will come from a
 * different query.
 */
export function WidgetScoreChart({ widgets }: { widgets: Widget[] }) {
  if (widgets.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">No widgets to chart.</p>
  }

  const data = widgets.map((w) => ({ name: w.name, score: w.score }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="name"
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
          stroke="var(--color-border)"
          interval={0}
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
          stroke="var(--color-border)"
          unit="%"
        />
        <Tooltip
          cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }}
          contentStyle={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            color: 'var(--color-foreground)',
          }}
          // Recharts types the value loosely (ValueType | undefined), so narrow it here
          // rather than interpolating something that might not be a number.
          formatter={(value) => [typeof value === 'number' ? `${value}%` : '—', 'Score']}
        />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {/* Colour encodes the same thresholds as the badge, so the two views agree. */}
          {data.map((entry) => (
            <Cell key={entry.name} fill={`var(--color-${scoreTone(entry.score)})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
