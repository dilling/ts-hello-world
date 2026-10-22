import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

/*
 * jsdom stubs for browser APIs the real components use.
 *
 * Radix primitives (Select, Dialog, AlertDialog) and recharts' ResponsiveContainer call
 * into layout APIs that jsdom doesn't implement. Without these you get either a console
 * full of "Not implemented: Window's scrollTo()" or a hard "ResizeObserver is not
 * defined" — neither of which is a bug in the component under test, and both of which
 * cost someone half an hour.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Plain no-ops rather than `vi.fn()`: nothing asserts on these, and a bare spy here
// would outlive `cleanup()` between tests.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

window.scrollTo = () => {}
