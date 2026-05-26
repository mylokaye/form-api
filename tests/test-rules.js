const assert = require('assert');
const { describe, it } = require('node:test');
const path = require('path');
const fs = require('fs');
const { evaluateRules } = require('../api/engine/rules');

const TEST_CONFIG = {
  version: '1.0',
  rules: [
    {
      id: 'state_visibility',
      type: 'visibility',
      field: 'nor_state',
      condition: { field: 'nor_country', op: 'eq', value: 'United States' },
      actions: [{ type: 'set_visible', value: true }]
    },
    {
      id: 'process_options_filter',
      type: 'options_filter',
      field: 'nor_noricansalesprocess',
      depends_on: 'nor_noricansalescategory',
      mapping: {
        Equipment: ['New Equipment', 'Service', 'Parts'],
        Service: ['Repair', 'Maintenance']
      }
    }
  ]
};

fs.writeFileSync(
  path.join(__dirname, '..', 'config', 'forms', 'test-form.json'),
  JSON.stringify(TEST_CONFIG)
);

describe('Rule Engine', () => {
  it('should show state when country is United States', () => {
    const result = evaluateRules('test-form', { nor_country: 'United States' });
    assert.strictEqual(result.visibility.nor_state.visible, true);
  });

  it('should hide state when country is not United States', () => {
    const result = evaluateRules('test-form', { nor_country: 'Germany' });
    assert.strictEqual(result.visibility.nor_state.visible, false);
  });

  it('should filter options based on category', () => {
    const result = evaluateRules('test-form', { nor_noricansalescategory: 'Equipment' });
    assert.deepStrictEqual(
      result.options.nor_noricansalesprocess.values.map(v => v.value),
      ['New Equipment', 'Service', 'Parts']
    );
  });

  it('should return empty options for unmapped category', () => {
    const result = evaluateRules('test-form', { nor_noricansalescategory: 'Unknown' });
    assert.strictEqual(result.options.nor_noricansalesprocess, undefined);
  });

  it('should return null for unknown form', () => {
    const result = evaluateRules('nonexistent', {});
    assert.strictEqual(result, null);
  });
});
