import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

/*
 * jsdom stubs for layout APIs it doesn't implement but Radix primitives and recharts'
 * ResponsiveContainer call. Without them you get "ResizeObserver is not defined" or a
 * console full of "Not implemented: Window's scrollTo()" — neither a real failure.
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
