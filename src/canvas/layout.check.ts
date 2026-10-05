// Run: node src/canvas/layout.check.ts
import assert from 'node:assert/strict';
import type { Domain } from '../types.ts';
import { FRAME_GAP, FRAME_W, layoutDomains, resolveDrop } from './layout.ts';

const STEP = FRAME_W + FRAME_GAP;
const H = { a: 600, b: 600, c: 600, m: 600 };

// Row a | b | c, m dropped mostly on top of b (left half) → m takes b's slot, b and c shift right.
let out = resolveDrop({ a: { x: 0, y: 0 }, b: { x: STEP, y: 0 }, c: { x: 2 * STEP, y: 0 }, m: { x: STEP - 40, y: -15 } }, H, 'm');
assert.deepEqual(out.m, { x: STEP, y: 0 });
assert.deepEqual(out.b, { x: 2 * STEP, y: 0 });
assert.deepEqual(out.c, { x: 3 * STEP, y: 0 });
assert.deepEqual(out.a, { x: 0, y: 0 });

// Dropped on b's right half → goes after b; c shifts.
out = resolveDrop({ a: { x: 0, y: 0 }, b: { x: STEP, y: 0 }, c: { x: 2 * STEP, y: 0 }, m: { x: STEP + 100, y: 20 } }, H, 'm');
assert.deepEqual(out.b, { x: STEP, y: 0 });
assert.deepEqual(out.m, { x: 2 * STEP, y: 0 });
assert.deepEqual(out.c, { x: 3 * STEP, y: 0 });

// Free space → untouched.
const free = { a: { x: 0, y: 0 }, m: { x: 5 * STEP, y: 33 } };
assert.deepEqual(resolveDrop(free, H, 'm'), free);

// Below a short frame (no vertical overlap) → no collision.
const below = { a: { x: 0, y: 0 }, m: { x: 20, y: 700 } };
assert.deepEqual(resolveDrop(below, H, 'm'), below);

console.log('layout ok');

// Dragging an auto-laid-out frame must not reflow the other auto-laid-out ones.
const d = (id: string) => ({ id, x: null, y: null }) as unknown as Domain;
const auto = layoutDomains([d('a'), d('b'), d('c')], { c: { x: 10, y: -20 } });
assert.deepEqual(auto.a, { x: 0, y: 0 });
assert.deepEqual(auto.b, { x: STEP, y: 0 });
console.log('layoutDomains ok');
