import test from 'node:test'
import assert from 'node:assert/strict'
import type { Garment, Outfit, StyleProfile } from '../src/lib/types.ts'
import {
  EMPTY_TOMBSTONES,
  applyGarmentTombstones,
  applyOutfitTombstones,
  applyPlanTombstones,
  diffRemovals,
  isTombstoned,
  mergeGarments,
  mergeOutfits,
  mergePlan,
  mergeStyleProfile,
  mergeTombstones,
  mergeWearLog,
  pruneTombstones,
} from '../src/lib/syncMerge.ts'

const garment = (id: string, patch: Partial<Garment> = {}): Garment => ({
  id,
  name: id,
  category: 'shirt',
  color: 'white',
  colorLabel: 'White',
  styleTags: [],
  fit: 'regular',
  image: '/garments/shirt-crisp-white.svg',
  source: 'sample',
  scannedAt: null,
  favorite: false,
  ...patch,
})

const outfit = (id: string, patch: Partial<Outfit> = {}): Outfit => ({
  id,
  name: id,
  garmentIds: ['gar_a'],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...patch,
})

const profile = (patch: Partial<StyleProfile> = {}): StyleProfile => ({
  fit: null,
  favoriteColors: [],
  likes: [],
  avoids: [],
  ...patch,
})

test('migration is additive and never duplicates ids', () => {
  const local = [garment('gar_1'), garment('gar_2')]
  const remote = [garment('gar_2'), garment('gar_3')]
  const merged = mergeGarments(local, remote)
  assert.equal(merged.length, 3)
  assert.deepEqual(
    merged.map((g) => g.id).sort(),
    ['gar_1', 'gar_2', 'gar_3'],
  )
})

test('the newest updatedAt wins for the same id', () => {
  const local = [garment('gar_1', { wearCount: 2, updatedAt: '2026-02-01T00:00:00.000Z' })]
  const remote = [garment('gar_1', { wearCount: 5, updatedAt: '2026-03-01T00:00:00.000Z' })]
  assert.equal(mergeGarments(local, remote)[0].wearCount, 5)
  assert.equal(mergeGarments(remote, local)[0].wearCount, 5)
})

test('ties fall back to the cloud copy', () => {
  const local = [garment('gar_1', { wearStatus: 'worn', updatedAt: '2026-02-01T00:00:00.000Z' })]
  const remote = [garment('gar_1', { wearStatus: 'ready', updatedAt: '2026-02-01T00:00:00.000Z' })]
  assert.equal(mergeGarments(local, remote)[0].wearStatus, 'ready')
})

test('wear log dedupes by id and by semantic look identity', () => {
  const base = {
    dateKey: '2026-10-01',
    wornAt: '2026-10-01T12:00:00.000Z',
    outfitId: 'outfit_1',
    source: 'planner' as const,
  }
  const merged = mergeWearLog(
    [
      { ...base, id: 'wear_1', garmentIds: ['gar_a'] },
      { ...base, id: 'wear_2', garmentIds: ['gar_a'] },
    ],
    [
      { ...base, id: 'wear_3', garmentIds: ['gar_a'] },
      {
        ...base,
        id: 'wear_4',
        dateKey: '2026-10-02',
        outfitId: null,
        garmentIds: ['gar_b', 'gar_c'],
      },
    ],
  )
  assert.equal(merged.length, 2)
  assert.deepEqual(
    merged.map((entry) => entry.id).sort(),
    ['wear_1', 'wear_4'],
  )
})

test('wear log is newest first and capped', () => {
  const entries = Array.from({ length: 5 }, (_, index) => ({
    id: `wear_${index}`,
    dateKey: `2026-10-0${index + 1}`,
    wornAt: `2026-10-0${index + 1}T12:00:00.000Z`,
    garmentIds: [`gar_${index}`],
    outfitId: null,
    source: 'saved' as const,
  }))
  const merged = mergeWearLog([], entries, 3)
  assert.equal(merged.length, 3)
  assert.equal(merged[0].id, 'wear_4')
})

test('planner merges by day and keeps newer edits', () => {
  const local = {
    '2026-10-01': { outfitId: 'outfit_a', occasion: null, updatedAt: '2026-10-01T00:00:00.000Z' },
    '2026-10-02': { outfitId: 'outfit_b', occasion: null, updatedAt: '2026-10-02T00:00:00.000Z' },
  }
  const remote = {
    '2026-10-01': { outfitId: 'outfit_c', occasion: 'formal', updatedAt: '2026-10-05T00:00:00.000Z' },
    '2026-10-03': { outfitId: 'outfit_d', occasion: null, updatedAt: '2026-10-03T00:00:00.000Z' },
  }
  const merged = mergePlan(local, remote)
  assert.equal(merged['2026-10-01'].outfitId, 'outfit_c')
  assert.equal(merged['2026-10-02'].outfitId, 'outfit_b')
  assert.equal(merged['2026-10-03'].outfitId, 'outfit_d')
})

test('style profile keeps the newest edit, and unions when timestamps tie', () => {
  const newer = mergeStyleProfile(
    profile({ fit: 'slim', updatedAt: '2026-01-01T00:00:00.000Z' }),
    profile({ fit: 'relaxed', updatedAt: '2026-02-01T00:00:00.000Z' }),
  )
  assert.equal(newer.fit, 'relaxed')

  const union = mergeStyleProfile(
    profile({ favoriteColors: ['navy'], likes: ['minimal'] }),
    profile({ favoriteColors: ['black'], likes: ['formal'] }),
  )
  assert.deepEqual(union.favoriteColors.sort(), ['black', 'navy'])
  assert.deepEqual(union.likes.sort(), ['formal', 'minimal'])
})

test('outfits are merged and ordered newest first', () => {
  const merged = mergeOutfits(
    [outfit('outfit_old', { createdAt: '2026-01-01T00:00:00.000Z' })],
    [outfit('outfit_new', { createdAt: '2026-02-01T00:00:00.000Z' })],
  )
  assert.deepEqual(
    merged.map((item) => item.id),
    ['outfit_new', 'outfit_old'],
  )
})

test('tombstones hide deleted rows but allow a newer edit to resurrect', () => {
  assert.equal(isTombstoned('2026-03-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'), true)
  assert.equal(isTombstoned('2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z'), false)
  assert.equal(isTombstoned('2026-03-01T00:00:00.000Z', undefined), true)

  const tombstones = {
    ...EMPTY_TOMBSTONES,
    garments: { gar_1: '2026-03-01T00:00:00.000Z' },
    outfits: { outfit_1: '2026-03-01T00:00:00.000Z' },
    planner: { '2026-10-01': '2026-03-01T00:00:00.000Z' },
  }
  assert.deepEqual(applyGarmentTombstones([garment('gar_1'), garment('gar_2')], tombstones).map((g) => g.id), ['gar_2'])
  assert.deepEqual(applyOutfitTombstones([outfit('outfit_1')], tombstones), [])
  assert.deepEqual(
    applyPlanTombstones(
      { '2026-10-01': { outfitId: 'a', occasion: null }, '2026-10-02': { outfitId: 'b', occasion: null } },
      tombstones,
    ),
    { '2026-10-02': { outfitId: 'b', occasion: null } },
  )
})

test('removals are diffed from the previous snapshot', () => {
  const removed = diffRemovals(['a', 'b', 'c'], ['a', 'c'], '2026-10-01T00:00:00.000Z')
  assert.deepEqual(removed, { b: '2026-10-01T00:00:00.000Z' })
})

test('tombstones merge by newest timestamp and expire', () => {
  const merged = mergeTombstones(
    { ...EMPTY_TOMBSTONES, garments: { a: '2026-01-01T00:00:00.000Z' } },
    { ...EMPTY_TOMBSTONES, garments: { a: '2026-02-01T00:00:00.000Z', b: '2026-02-01T00:00:00.000Z' } },
  )
  assert.equal(merged.garments.a, '2026-02-01T00:00:00.000Z')
  assert.equal(merged.garments.b, '2026-02-01T00:00:00.000Z')

  const pruned = pruneTombstones(merged, new Date('2026-06-01T00:00:00.000Z'))
  assert.deepEqual(pruned.garments, {})
})
