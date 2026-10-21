import { createFileRoute, redirect } from '@tanstack/react-router'

/** Nothing to show at the root yet — send people to the dashboard. */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/widgets' })
  },
})
