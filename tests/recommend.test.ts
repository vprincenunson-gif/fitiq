import test from 'node:test'
import assert from 'node:assert/strict'
import type { GarmentCategory, GarmentColor } from '../src/lib/types.ts'
import {
  MockOutfitRecommendationService,
  type GarmentDescriptor,
} from '../src/services/recommend.ts'

const service = new MockOutfitRecommendationService()

function descriptor(
  id: string,
  category: GarmentCategory,
  color: GarmentColor = 'navy',
): GarmentDescriptor {
  return {
    id,
    name: id,
    category,
    color,
    colorLabel: color,
    fit: 'regular',
    styleTags: [],
    favorite: false,
    wearCount: 0,
    lastWornDaysAgo: null,
  }
}

async function recommend(wardrobe: GarmentDescriptor[]) {
  return service.recommend({ vibe: 'casual', wardrobe, current: {} })
}

test('legacy shirt / pants / shoes wardrobe still recommends the same ids', async () => {
  const result = await recommend([
    descriptor('shirt-1', 'shirt'),
    descriptor('pants-1', 'pants'),
    descriptor('shoes-1', 'shoes'),
  ])
  assert.equal(result.topId, 'shirt-1')
  assert.equal(result.bottomId, 'pants-1')
  assert.equal(result.shoesId, 'shoes-1')
})

test('blouses, tops, jeans and skirts fill their slots', async () => {
  const result = await recommend([
    descriptor('blouse-1', 'blouse'),
    descriptor('jeans-1', 'jeans'),
    descriptor('skirt-1', 'skirt'),
    descriptor('shoes-1', 'shoes'),
  ])
  assert.equal(result.topId, 'blouse-1')
  assert.ok(result.bottomId === 'jeans-1' || result.bottomId === 'skirt-1')
  assert.equal(result.shoesId, 'shoes-1')
  assert.ok(result.rationale.length > 0)
})

test('a top-only and bottom-only wardrobe fills what it can', async () => {
  const result = await recommend([descriptor('top-1', 'top')])
  assert.equal(result.topId, 'top-1')
  assert.equal(result.bottomId, null)
  assert.equal(result.shoesId, null)
})

test('categories with no slot are never recommended', async () => {
  const result = await recommend([
    descriptor('dress-1', 'dress'),
    descriptor('accessory-1', 'accessory'),
  ])
  assert.equal(result.topId, null)
  assert.equal(result.bottomId, null)
  assert.equal(result.shoesId, null)
})
