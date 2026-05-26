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
      id: 'category_options',
      type: 'static_options',
      field: 'nor_noricansalescategory',
      values: ['Aftermarket', 'OEM', 'EMP']
    },
    {
      id: 'process_options_filter',
      type: 'options_filter',
      field: 'nor_noricansalesprocess',
      depends_on: 'nor_noricansalescategory',
      mapping: {
        Aftermarket: ['Monitizer', 'New Business', 'Upgrade/Retrofit', 'Spares & Service'],
        OEM: ['Monitizer', 'New Business', 'Upgrade/Retrofit', 'Spares & Service'],
        EMP: ['Monitizer', 'New Business', 'Upgrade/Retrofit', 'Spares & Service']
      }
    },
    {
      id: 'division_options',
      type: 'static_options',
      field: 'nor_division',
      values: ['SIMPSON', 'DISA']
    },
    {
      id: 'division_by_hostname',
      type: 'field_value_map',
      field: 'nor_division',
      source: '_hostname',
      mapping: [
        { match: 'simpsongroup.com', value: 'SIMPSON' },
        { match: 'disagroup.com', value: 'DISA' }
      ]
    },
    {
      id: 'language_by_browser',
      type: 'field_value_map',
      field: 'nor_primarylanguage',
      source: '_language',
      defaultValue: 'English',
      mapping: [
        { match: 'de', value: 'German' },
        { match: 'zh', value: 'Chinese' },
        { match: 'en', value: 'English' }
      ]
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
    const result = evaluateRules('test-form', { nor_noricansalescategory: 'Aftermarket' });
    assert.deepStrictEqual(
      result.options.nor_noricansalesprocess.values.map(v => v.value),
      ['Monitizer', 'New Business', 'Upgrade/Retrofit', 'Spares & Service']
    );
  });

  it('should return static category options', () => {
    const result = evaluateRules('test-form', {});
    assert.deepStrictEqual(
      result.options.nor_noricansalescategory.values.map(v => v.value),
      ['Aftermarket', 'OEM', 'EMP']
    );
  });

  it('should return empty options for unmapped category', () => {
    const result = evaluateRules('test-form', { nor_noricansalescategory: 'Unknown' });
    assert.strictEqual(result.options.nor_noricansalesprocess, undefined);
  });

  it('should return static division options', () => {
    const result = evaluateRules('test-form', {});
    assert.deepStrictEqual(
      result.options.nor_division.values.map(v => v.value),
      ['SIMPSON', 'DISA']
    );
  });

  it('should set field values based on hostname mappings', () => {
    const result = evaluateRules('test-form', { _hostname: 'www.simpsongroup.com' });
    assert.strictEqual(result.fieldValues.nor_division.value, 'SIMPSON');
  });

  it('should not set field values for unmapped hostnames', () => {
    const result = evaluateRules('test-form', { _hostname: 'example.com' });
    assert.strictEqual(result.fieldValues.nor_division, undefined);
  });

  it('should set language field values from browser language', () => {
    const result = evaluateRules('test-form', { _language: 'de-DE' });
    assert.strictEqual(result.fieldValues.nor_primarylanguage.value, 'German');
  });

  it('should default language field values to English', () => {
    const result = evaluateRules('test-form', { _language: '' });
    assert.strictEqual(result.fieldValues.nor_primarylanguage.value, 'English');
  });

  it('should return null for unknown form', () => {
    const result = evaluateRules('nonexistent', {});
    assert.strictEqual(result, null);
  });
});
