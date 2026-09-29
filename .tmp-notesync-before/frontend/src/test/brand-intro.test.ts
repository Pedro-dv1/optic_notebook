import { describe, expect, it } from 'vitest'
import { farthestCornerRadius } from '../components/brandIntro'

describe('brand intro iris', () => {
  it('reaches the farthest viewport corner from the marker center', () => {
    expect(farthestCornerRadius(75, 25, 100, 100)).toBe(Math.hypot(75, 75))
  })
})
