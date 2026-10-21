import type { Widget } from '../src/shared/widget'

/** Test data builders — override only the fields a test cares about. */
export function aWidget(overrides: Partial<Widget> = {}): Widget {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: 'example',
    status: 'active',
    score: 50,
    lastRefreshedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
