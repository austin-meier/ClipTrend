import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cropWindowFor, parseAspect } from '../src/crop/geometry'
import { observedVelocity, scoreClip } from '../src/lib/trending'

const HOUR = 3_600_000
const thresholds = { minViews: 300, minViewsPerHour: 100, maxAgeHours: 48 }

test('a fast-rising fresh clip trends on lifetime velocity', () => {
   const score = scoreClip({ createdAt: 0, now: 2 * HOUR, views: 600, history: [] }, thresholds)
   assert.equal(Math.round(score.velocity), 300) // 600 views over 2h
   assert.equal(score.trending, true)
})

test('a popular-but-old clip is not trending on velocity', () => {
   const score = scoreClip(
      { createdAt: 0, now: 40 * HOUR, views: 4000, history: [] },
      { minViews: 300, minViewsPerHour: 200, maxAgeHours: 48 }
   )
   assert.equal(score.velocity, 100) // 4000 over 40h, below the 200/h bar
   assert.equal(score.trending, false)
})

test('observed velocity prefers the measured delta over the lifetime estimate', () => {
   assert.equal(observedVelocity(500, HOUR, [{ at: 0, views: 100 }]), 400) // (500-100)/1h
})

test('observed velocity is undefined without prior history', () => {
   assert.equal(observedVelocity(500, HOUR, []), undefined)
})

test('below the absolute-views floor never trends, however fast', () => {
   const score = scoreClip(
      { createdAt: 0, now: HOUR, views: 50, history: [] },
      { minViews: 300, minViewsPerHour: 10, maxAgeHours: 48 }
   )
   assert.equal(score.trending, false)
})

test('cropWindowFor centres a 9:16 window on the focal point, within bounds', () => {
   const win = cropWindowFor(1920, 1080, parseAspect('9:16'), { x: 0.5, y: 0.5 })
   assert.equal(win.height, 1080)
   assert.equal(win.width, Math.round(1080 * (9 / 16))) // 608
   assert.equal(win.x, Math.round(960 - win.width / 2))
   assert.equal(win.y, 0)
})

test('cropWindowFor clamps the window when the focal point is at an edge', () => {
   const win = cropWindowFor(1920, 1080, parseAspect('9:16'), { x: 0, y: 0 })
   assert.equal(win.x, 0)
   assert.equal(win.y, 0)
})
