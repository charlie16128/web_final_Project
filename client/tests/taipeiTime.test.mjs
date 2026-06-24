import assert from 'node:assert/strict'
import test from 'node:test'

import { taipeiInputToIso, toTaipeiInputValue } from '../src/utils/taipeiTime.js'

test('formats UTC instants as UTC+8 datetime-local values', function() {
  assert.equal(toTaipeiInputValue('2099-03-10T10:45:00.000Z'), '2099-03-10T18:45')
  assert.equal(toTaipeiInputValue('2099-03-10T16:15:00.000Z'), '2099-03-11T00:15')
})

test('converts datetime-local values as UTC+8 instants', function() {
  assert.equal(taipeiInputToIso('2099-03-10T18:45'), '2099-03-10T10:45:00.000Z')
  assert.equal(taipeiInputToIso('2099-03-11T00:15'), '2099-03-10T16:15:00.000Z')
})