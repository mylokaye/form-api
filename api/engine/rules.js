const path = require('path');
const fs = require('fs');

function loadConfig(formId) {
  const configPath = path.join(__dirname, '..', '..', 'config', 'forms', `${formId}.json`);
  if (!fs.existsSync(configPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function evaluateCondition(condition, fields) {
  const fieldValue = (fields[condition.field] || '').toString().trim().toLowerCase();
  const compareValue = condition.value.toString().trim().toLowerCase();

  switch (condition.op) {
    case 'eq':
      return fieldValue === compareValue;
    case 'neq':
      return fieldValue !== compareValue;
    case 'contains':
      return fieldValue.includes(compareValue);
    case 'starts_with':
      return fieldValue.startsWith(compareValue);
    case 'in':
      return Array.isArray(condition.value) && condition.value.map(v => v.toString().toLowerCase()).includes(fieldValue);
    case 'empty':
      return fieldValue === '';
    case 'not_empty':
      return fieldValue !== '';
    default:
      return false;
  }
}

function normalizeOptions(options) {
  return (options || []).map(option => {
    if (typeof option === 'string') {
      return { value: option, label: option };
    }

    return {
      value: option.value,
      label: option.label || option.value
    };
  }).filter(option => option.value);
}

function evaluateRules(formId, fields) {
  const config = loadConfig(formId);
  if (!config) {
    return null;
  }

  const result = {
    visibility: {},
    required: {},
    options: {},
    fieldValues: {}
  };

  for (const rule of (config.rules || [])) {
    if (rule.type === 'visibility' || rule.type === 'required') {
      const conditionMet = evaluateCondition(rule.condition, fields);

      for (const action of (rule.actions || [])) {
        if (action.type === 'set_visible') {
          result.visibility[rule.field] = {
            visible: conditionMet ? action.value : !action.value,
            reason: rule.id
          };
        }

        if (action.type === 'set_required') {
          result.required[rule.field] = conditionMet ? action.value : !action.value;
        }
      }
    }

    if (rule.type === 'options_filter') {
      const parentValue = (fields[rule.depends_on] || '').toString().trim();
      const mapping = rule.mapping[parentValue];
      if (mapping) {
        result.options[rule.field] = {
          values: normalizeOptions(mapping),
          filteredBy: rule.depends_on
        };
      }
    }

    if (rule.type === 'static_options') {
      result.options[rule.field] = {
        values: normalizeOptions(rule.values),
        reason: rule.id
      };
    }

    if (rule.type === 'field_value_map') {
      const sourceValue = (fields[rule.source] || '').toString().trim().toLowerCase();
      const match = (rule.mapping || []).find(entry => {
        const matchValue = (entry.match || '').toString().trim().toLowerCase();
        return matchValue && sourceValue.includes(matchValue);
      });

      if (match) {
        result.fieldValues[rule.field] = {
          value: match.value,
          reason: rule.id
        };
      }
    }
  }

  return result;
}

module.exports = { evaluateRules, loadConfig };
