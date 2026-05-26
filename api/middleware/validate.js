function validateEvaluateInput(req, res, next) {
  const { formId } = req.params;
  const { fields, context } = req.body;

  if (!formId || typeof formId !== 'string') {
    return res.status(400).json({ error: 'formId is required' });
  }

  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return res.status(400).json({ error: 'fields must be an object' });
  }

  if (context !== undefined && (typeof context !== 'object' || Array.isArray(context))) {
    return res.status(400).json({ error: 'context must be an object' });
  }

  next();
}

module.exports = { validateEvaluateInput };
