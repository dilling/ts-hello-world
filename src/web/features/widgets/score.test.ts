import { describe, expect, it } from 'vite-plus/test'
import { scoreTone } from './score'

describe('scoreTone', () => {
  it.each([
    [100, 'success'],
    [80, 'success'],
    [79, 'warning'],
    [50, 'warning'],
    [49, 'destructive'],
    [0, 'destructive'],
  ])('maps %i to %s', (score, expected) => {
    expect(scoreTone(score)).toBe(expected)
  })
})
