import type { Widget } from '@shared/widget'
import { Link } from '@tanstack/react-router'
import { Badge } from '@web/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@web/components/ui/table'
import { scoreTone } from './score'

export function WidgetTable({ widgets }: { widgets: Widget[] }) {
  if (widgets.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No widgets match this filter.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Last refreshed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {widgets.map((widget) => (
          <TableRow key={widget.id}>
            <TableCell>
              {/* Typed Link: a bad `to` or a missing param fails typecheck. */}
              <Link
                to="/widgets/$widgetId"
                params={{ widgetId: widget.id }}
                className="font-medium hover:underline"
              >
                {widget.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{widget.status}</TableCell>
            <TableCell>
              <Badge variant={scoreTone(widget.score)}>{widget.score}%</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {formatTimestamp(widget.lastRefreshedAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'never'
  return new Date(value).toLocaleString()
}
