import { Vector2 } from './types';

export function vec2(x: number, y: number): Vector2 {
  return { x, y };
}

export function vecAdd(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vecSub(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vecScale(v: Vector2, s: number): Vector2 {
  return { x: v.x * s, y: v.y * s };
}

export function vecLength(v: Vector2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vecNormalize(v: Vector2): Vector2 {
  const len = vecLength(v);
  if (len === 0) {
    return { x: 0, y: 0 };
  }
  return { x: v.x / len, y: v.y / len };
}

export function vecDot(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y;
}

export function vecAngle(v: Vector2): number {
  return Math.atan2(v.y, v.x);
}
