const assert = require('assert');
const { describe, it } = require('node:test');
const { validateEvaluateInput } = require('../api/middleware/validate');

function mockReqRes(body, params) {
  const req = { body: body || {}, params: params || {} };
  let statusCode, jsonData;
  const res = {
    status: function (code) { statusCode = code; return res; },
    json: function (data) { jsonData = data; }
  };
  return { req, res, getStatus: () => statusCode, getData: () => jsonData };
}

describe('Input Validation', () => {
  it('should pass with valid input', () => {
    const m = mockReqRes(
      { fields: { firstname: 'John' }, context: { language: 'en' } },
      { formId: 'inquiry' }
    );
    let called = false;
    validateEvaluateInput(m.req, m.res, () => { called = true; });
    assert.strictEqual(called, true);
  });

  it('should reject missing formId', () => {
    const m = mockReqRes({ fields: { firstname: 'John' } }, { formId: '' });
    validateEvaluateInput(m.req, m.res, () => {});
    assert.strictEqual(m.getStatus(), 400);
  });

  it('should reject missing fields', () => {
    const m = mockReqRes({}, { formId: 'inquiry' });
    validateEvaluateInput(m.req, m.res, () => {});
    assert.strictEqual(m.getStatus(), 400);
  });

  it('should reject fields as array', () => {
    const m = mockReqRes({ fields: [] }, { formId: 'inquiry' });
    validateEvaluateInput(m.req, m.res, () => {});
    assert.strictEqual(m.getStatus(), 400);
  });
});
