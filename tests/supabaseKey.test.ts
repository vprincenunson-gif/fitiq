import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePublicKey, validateSupabaseUrl } from '../src/lib/supabaseKey.ts'

const encode = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url')

const jwt = (payload: object): string => `header.${encode(payload)}.signature`

test('publishable keys are accepted', () => {
  assert.equal(validatePublicKey('sb_publishable_abc123').ok, true)
})

test('secret keys are rejected', () => {
  const result = validatePublicKey('sb_secret_abc123')
  assert.equal(result.ok, false)
  assert.match(result.reason ?? '', /secret key/i)
})

test('service-role JWTs are rejected', () => {
  const result = validatePublicKey(jwt({ role: 'service_role' }))
  assert.equal(result.ok, false)
  assert.match(result.reason ?? '', /service-role/i)
})

test('anon JWTs are accepted', () => {
  assert.equal(validatePublicKey(jwt({ role: 'anon' })).ok, true)
})

test('empty keys are rejected', () => {
  assert.equal(validatePublicKey('').ok, false)
})

test('only https project URLs are accepted', () => {
  assert.equal(validateSupabaseUrl('https://abc.supabase.co'), true)
  assert.equal(validateSupabaseUrl('http://abc.supabase.co'), false)
  assert.equal(validateSupabaseUrl('not a url'), false)
})
