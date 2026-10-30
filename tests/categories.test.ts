import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CATEGORY_LABELS,
  CATEGORY_SINGULAR,
  GARMENT_CATEGORIES,
  OUTFIT_SLOT_KEYS,
  genericGarmentName,
  isGarmentCategory,
  slotForCategory,
  slotKeyForCategory,
} from '../src/lib/types.ts'

test('category catalog is inclusive and keeps legacy ids', () => {
  const required = [
    'shirt',
    'blouse',
    'top',
    'pants',
    'jeans',
    'skirt',
    'dress',
    'jumpsuit',
    'ethnic',
    'shoes',
    'accessory',
  ]
  assert.deepEqual([...GARMENT_CATEGORIES].sort(), [...required].sort())
  assert.equal(new Set(GARMENT_CATEGORIES).size, GARMENT_CATEGORIES.length)
  for (const id of required) {
    assert.ok(isGarmentCategory(id), `${id} should be a category`)
    assert.ok(CATEGORY_LABELS[id as keyof typeof CATEGORY_LABELS])
    assert.ok(CATEGORY_SINGULAR[id as keyof typeof CATEGORY_SINGULAR])
  }
  assert.equal(isGarmentCategory('gender'), false)
  assert.equal(isGarmentCategory(''), false)
})

test('existing slots and storage keys are unchanged', () => {
  assert.deepEqual(OUTFIT_SLOT_KEYS, ['shirt', 'pants', 'shoes'])
  assert.equal(slotForCategory('shirt'), 'top')
  assert.equal(slotForCategory('pants'), 'bottom')
  assert.equal(slotForCategory('shoes'), 'shoes')
  // Same legacy keys, so saved looks and in-flight sync payloads still load.
  assert.equal(slotKeyForCategory('shirt'), 'shirt')
  assert.equal(slotKeyForCategory('pants'), 'pants')
  assert.equal(slotKeyForCategory('shoes'), 'shoes')
})

test('new slot-compatible categories map without changing the schema', () => {
  assert.equal(slotForCategory('blouse'), 'top')
  assert.equal(slotForCategory('top'), 'top')
  assert.equal(slotForCategory('jeans'), 'bottom')
  assert.equal(slotForCategory('skirt'), 'bottom')

  assert.equal(slotKeyForCategory('blouse'), 'shirt')
  assert.equal(slotKeyForCategory('top'), 'shirt')
  assert.equal(slotKeyForCategory('jeans'), 'pants')
  assert.equal(slotKeyForCategory('skirt'), 'pants')
})

test('categories without styling logic are never forced into a slot', () => {
  for (const category of ['dress', 'jumpsuit', 'ethnic', 'accessory'] as const) {
    assert.equal(slotForCategory(category), null, `${category} must have no slot yet`)
    assert.equal(slotKeyForCategory(category), null, `${category} must have no slot key`)
  }
})

test('generic names use the inclusive singular labels', () => {
  assert.equal(genericGarmentName('Blue', 'jeans'), 'Blue Jeans')
  assert.equal(genericGarmentName('Ivory', 'blouse'), 'Ivory Blouse')
  assert.equal(genericGarmentName('Black', 'dress'), 'Black Dress')
  assert.equal(genericGarmentName('Tan', 'shoes'), 'Tan Shoes')
  assert.equal(genericGarmentName('', 'accessory'), 'Accessory')
})

test('database migrations accept every app category', () => {
  for (const file of [
    '../supabase/migrations/0001_fitiq_cloud.sql',
    '../supabase/migrations/0002_expand_wardrobe_categories.sql',
  ]) {
    const sql = readFileSync(new URL(file, import.meta.url), 'utf8')
    for (const category of GARMENT_CATEGORIES) {
      assert.ok(sql.includes(`'${category}'`), `${file} is missing ${category}`)
    }
  }
})
