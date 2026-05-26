(function () {
  'use strict';

  var FORM_API_BASE = (window.FORM_API_BASE || 'https://forms-api-ruby.vercel.app/api').replace(/\/+$/, '');
  var FORM_ID = 'inquiry';

  function getForm() {
    return document.querySelector('form.marketingForm');
  }

  function getFieldValues() {
    var form = getForm();
    if (!form) return {};
    var data = {};
    var inputs = form.querySelectorAll('input[name], textarea[name], select[name]');
    inputs.forEach(function (el) {
      var name = el.getAttribute('name');
      if (name && el.type !== 'checkbox' && el.type !== 'radio') {
        data[name] = el.value;
      }
    });
    return data;
  }

  function getContext() {
    return {
      url: window.location.href,
      referrer: document.referrer || '',
      language: navigator.language || '',
      userAgent: navigator.userAgent || ''
    };
  }

  function applyVisibility(rules) {
    if (!rules || !rules.visibility) return;
    Object.keys(rules.visibility).forEach(function (fieldName) {
      var field = document.querySelector('[name="' + fieldName + '"]');
      if (!field) return;
      var block = field.closest('.textFormFieldBlock, .phoneFormFieldBlock, .dateTimeFormFieldBlock, .lookupFormFieldBlock, .optionSetFormFieldBlock, .passesBlock, .multiOptionSetFormFieldBlock, .twoOptionFormFieldBlock, .consentBlock');
      if (block) {
        block.style.display = rules.visibility[fieldName].visible ? '' : 'none';
      }
    });
  }

  function applyFieldValues(rules) {
    if (!rules || !rules.fieldValues) return;
    Object.keys(rules.fieldValues).forEach(function (fieldName) {
      var fieldValue = rules.fieldValues[fieldName];
      if (!fieldValue || !fieldValue.value) return;
      var field = document.querySelector('[name="' + fieldName + '"]');
      if (!field) return;

      field.value = fieldValue.value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function applyEnrichments(enrichments) {
    if (!enrichments) return;
    var map = {
      country: 'nor_country',
      website: 'websiteurl',
      companyName: 'companyname'
    };
    Object.keys(map).forEach(function (key) {
      var enrichment = enrichments[key];
      if (!enrichment || !enrichment.value) return;
      var field = document.querySelector('[name="' + map[key] + '"]');
      if (field && !field.value) {
        field.value = enrichment.value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function applyTranslations(translations) {
    if (!translations) return;
    var labelMap = {
      firstname: 'First name',
      lastname: 'Last name',
      email: 'Email address',
      phone: 'Phone number',
      companyName: 'Company name',
      country: 'Country',
      inquiry: 'Inquiry'
    };
    if (translations.labels) {
      Object.keys(translations.labels).forEach(function (key) {
        var labelText = labelMap[key];
        if (!labelText) return;
        var label = Array.from(document.querySelectorAll('label')).find(function (l) {
          return l.textContent.trim().startsWith(labelText);
        });
        if (label) {
          var star = label.querySelector('.requiredSuffix');
          var text = translations.labels[key];
          if (star) {
            var textNode = Array.from(label.childNodes).find(function (n) {
              return n.nodeType === 3 && n.textContent.trim().startsWith(labelText);
            });
            if (textNode) textNode.textContent = text + '\u00a0';
          } else {
            label.childNodes[0].textContent = text;
          }
        }
      });
    }
    if (translations.placeholders) {
      var placeholderMap = {
        firstname: 'firstname',
        lastname: 'lastname',
        email: 'emailaddress1',
        phone: 'mobilephone',
        inquiry: 'description'
      };
      Object.keys(translations.placeholders).forEach(function (key) {
        var fieldName = placeholderMap[key];
        if (!fieldName) return;
        var field = document.querySelector('[name="' + fieldName + '"]');
        if (field) {
          field.setAttribute('placeholder', translations.placeholders[key]);
        }
      });
    }
  }

  function evaluate() {
    var payload = {
      formId: FORM_ID,
      fields: getFieldValues(),
      context: getContext(),
      version: '1.0'
    };

    fetch(FORM_API_BASE + '/form/' + FORM_ID + '/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        applyVisibility(data.rules);
        applyFieldValues(data.rules);
        applyEnrichments(data.enrichments);
        applyTranslations(data.translations);
      })
      .catch(function (err) {
        console.warn('[form-intelligence] API call failed:', err);
      });
  }

  function init() {
    var form = getForm();
    if (!form) return;

    evaluate();

    form.addEventListener('change', function (e) {
      var target = e.target;
      if (target && target.getAttribute('name')) {
        evaluate();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
