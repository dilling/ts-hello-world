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

/** Derived from the generated component so `shadcn add button` can't leave it stale. */
type ButtonVariant = VariantProps<typeof buttonVariants>['variant']

/**
 * Destructive actions confirm first. Use this rather than `window.confirm` or a
 * hand-rolled modal — Radix's `AlertDialog` brings the focus trap, scroll lock, inert
 * background and `role="alertdialog"` that a hand-written one silently lacks.
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
