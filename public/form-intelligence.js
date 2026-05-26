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

  function applyOptions(rules) {
    if (!rules || !rules.options) return;
    Object.keys(rules.options).forEach(function (fieldName) {
      var optionSet = rules.options[fieldName];
      if (!optionSet || !Array.isArray(optionSet.values)) return;

      var field = document.querySelector('[name="' + fieldName + '"]');
      if (!field) return;

      var target = field;
      var listId = field.getAttribute('list');
      if (listId) {
        target = document.getElementById(listId);
      }
      if (!target) return;

      target.innerHTML = '';
      optionSet.values.forEach(function (item) {
        var option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label || item.value;
        target.appendChild(option);
      });
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

    function setLabelForField(fieldName, text) {
      var field = document.querySelector('[name="' + fieldName + '"]');
      if (!field) return;
      var label = field.id ? document.querySelector('label[for="' + field.id + '"]') : null;
      if (!label) {
        label = field.closest('.textFormFieldBlock, .phoneFormFieldBlock, .dateTimeFormFieldBlock, .lookupFormFieldBlock, .optionSetFormFieldBlock, .passesBlock, .multiOptionSetFormFieldBlock, .twoOptionFormFieldBlock, .consentBlock')?.querySelector('label');
      }
      if (!label) return;

      var requiredSuffix = label.querySelector('.requiredSuffix');
      if (requiredSuffix) {
        var textNode = Array.from(label.childNodes).find(function (node) {
          return node.nodeType === 3 && node.textContent.trim();
        });
        if (textNode) {
          textNode.textContent = text + '\u00a0';
        } else {
          label.insertBefore(document.createTextNode(text + '\u00a0'), requiredSuffix);
        }
      } else {
        label.textContent = text;
      }
    }

    var fieldMap = {
      firstname: 'firstname',
      lastname: 'lastname',
      email: 'emailaddress1',
      phone: 'mobilephone',
      companyName: 'companyname',
      role: 'nor_rolecode',
      country: 'nor_country',
      market: 'nor_marketsegment',
      division: 'nor_division',
      inquiryType: 'nor_noricansalescategory',
      inquirySubtype: 'nor_noricansalesprocess',
      inquiry: 'description'
    };

    if (translations.labels) {
      Object.keys(translations.labels).forEach(function (key) {
        var fieldName = fieldMap[key];
        if (fieldName) setLabelForField(fieldName, translations.labels[key]);
      });
    }

    if (translations.placeholders) {
      Object.keys(translations.placeholders).forEach(function (key) {
        var fieldName = fieldMap[key];
        if (!fieldName) return;
        var field = document.querySelector('[name="' + fieldName + '"]');
        if (field) {
          field.setAttribute('placeholder', translations.placeholders[key]);
        }
      });
    }

    if (translations.submit) {
      var submitButton = document.querySelector('button.submitButton[type="submit"], button.primaryButton[type="submit"], button[type="submit"]');
      if (submitButton) {
        var textTarget = submitButton.querySelector('span') || submitButton;
        textTarget.textContent = translations.submit;
      }
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
        applyOptions(data.rules);
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
