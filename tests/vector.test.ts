import { describe, it, expect } from 'vitest';
import { vec2, vecAdd, vecSub, vecScale, vecLength, vecNormalize, vecDot, vecAngle } from '../src/core/vector';

describe('Vector2 Math Library', () => {
  it('adds and subtracts vectors correctly', () => {
    const v1 = vec2(3, 4);
    const v2 = vec2(1, -2);
    expect(vecAdd(v1, v2)).toEqual({ x: 4, y: 2 });
    expect(vecSub(v1, v2)).toEqual({ x: 2, y: 6 });
    expect(vecScale(v1, 2)).toEqual({ x: 6, y: 8 });
  });

  it('calculates length and normalization safely', () => {
    const v = vec2(3, 4);
    expect(vecLength(v)).toBe(5);
    const norm = vecNormalize(v);
    expect(norm.x).toBeCloseTo(0.6);
    expect(norm.y).toBeCloseTo(0.8);

    const zero = vecNormalize(vec2(0, 0));
    expect(zero).toEqual({ x: 0, y: 0 });
  });

  it('calculates dot product and angle', () => {
    const a = vec2(1, 0);
    const b = vec2(0, 1);
    expect(vecDot(a, b)).toBe(0);
    expect(vecAngle(a)).toBe(0);
    expect(vecAngle(b)).toBeCloseTo(Math.PI / 2);
  });
});
