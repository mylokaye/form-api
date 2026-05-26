const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { validateEvaluateInput } = require('../middleware/validate');
const { evaluateRules } = require('../engine/rules');
const { evaluateEnrichments } = require('../engine/enrich');

function extractHostname(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

router.post('/form/:formId/evaluate', validateEvaluateInput, async (req, res) => {
  const start = Date.now();
  const { formId } = req.params;
  const { fields, context, version } = req.body;

  const contextFields = {
    _url: context?.url || '',
    _hostname: extractHostname(context?.url),
    _referrer: context?.referrer || '',
    _language: context?.language || ''
  };
  const mergedFields = { ...fields, ...contextFields };

  const rules = evaluateRules(formId, mergedFields);
  if (!rules) {
    return res.status(404).json({ error: `form '${formId}' not found` });
  }

  const enrichments = await evaluateEnrichments(fields, context);

  let translations = null;
  const translationPath = path.join(__dirname, '..', '..', 'config', 'translations', `${formId}.json`);
  if (fs.existsSync(translationPath)) {
    const lang = (context?.language || 'en').split('-')[0];
    const allTranslations = JSON.parse(fs.readFileSync(translationPath, 'utf-8'));
    translations = allTranslations[lang] || allTranslations['en'] || null;
  }

  const response = {
    version: version || '1.0',
    formId,
    rules,
    enrichments,
    translations,
    meta: {
      evaluated_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      version_applied: version || '1.0'
    }
  };

  res.json(response);
});

module.exports = router;
