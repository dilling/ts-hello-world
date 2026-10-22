import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@web/components/ui/alert-dialog'
import { Button, type buttonVariants } from '@web/components/ui/button'
import type { VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

/** Derived from the generated component rather than re-declared, so re-running
 * `shadcn add button` can't leave this out of step. */
type ButtonVariant = VariantProps<typeof buttonVariants>['variant']

/**
 * PATTERN: destructive actions confirm first. Use this instead of `window.confirm`, and
 * instead of hand-rolling a modal.
 *
 * It wraps shadcn's `AlertDialog` (Radix under the hood), which is doing more than it
 * looks: focus moves into the dialog and is trapped there, focus returns to the trigger
 * on close, Escape closes, the page behind is inert and scroll-locked, and the thing is
 * announced as `role="alertdialog"`. That is the entire reason this repo took the Radix
 * dependency rather than hand-rolling overlays — none of it is visible in a demo, and
 * all of it is wrong in a hand-written modal.
 *
 * Declarative, not a `useConfirm()` promise hook: the trigger and the confirmation live
 * in one place, there's no provider to mount, and nothing has to live in context.
 */
export interface ConfirmButtonProps {
  children: ReactNode
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  variant?: ButtonVariant
  disabled?: boolean
}

export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  variant = 'destructive',
  disabled,
}: ConfirmButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size="sm" disabled={disabled}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {/* AlertDialogAction closes the dialog itself, so onConfirm only fires the
              mutation — don't also manage open state here. */}
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
