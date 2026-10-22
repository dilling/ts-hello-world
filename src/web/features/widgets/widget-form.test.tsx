import type { WidgetFields } from '@shared/widget'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WidgetForm } from './widget-form'

/**
 * Form test template.
 *
 * No router and no QueryClient, because the form doesn't fetch or navigate — it takes an
 * `onSubmit` and calls it. That's the payoff for keeping the mutation in the route: the
 * interesting behaviour (validation, submit, disabled states) is testable with nothing
 * mocked but a spy.
 */
function renderForm(onSubmit = vi.fn<(value: WidgetFields) => Promise<void>>()) {
  const onCancel = vi.fn<() => void>()
  render(
    <WidgetForm
      defaultValues={{ name: '', status: 'active', score: 0 }}
      onSubmit={onSubmit}
      submitLabel="Create widget"
      onCancel={onCancel}
    />,
  )
  return { onSubmit, onCancel, user: userEvent.setup() }
}

describe('WidgetForm', () => {
  it('submits the entered values', async () => {
    const { onSubmit, user } = renderForm()

    await user.type(screen.getByLabelText('Name'), 'auth-service')
    await user.clear(screen.getByLabelText('Score'))
    await user.type(screen.getByLabelText('Score'), '73')
    await user.click(screen.getByRole('button', { name: 'Create widget' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'auth-service',
        status: 'active',
        score: 73,
      })
    })
  })

  it('rejects an empty name using the shared zod schema', async () => {
    const { onSubmit, user } = renderForm()

    // Type and clear, so the field is touched and validation has run.
    await user.type(screen.getByLabelText('Name'), 'x')
    await user.clear(screen.getByLabelText('Name'))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a score above 100, which is a server-side constraint', async () => {
    const { onSubmit, user } = renderForm()

    await user.type(screen.getByLabelText('Name'), 'auth-service')
    await user.clear(screen.getByLabelText('Score'))
    await user.type(screen.getByLabelText('Score'), '150')
    await user.click(screen.getByRole('button', { name: 'Create widget' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
