const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function enrichFromIp(ip) {
  if (!ip) return {};

  try {
    const data = await fetchJson(`https://freeipapi.com/api/json/${ip}`);
    return {
      country: {
        value: data.countryName || '',
        confidence: 0.95,
        source: 'ip'
      },
      city: data.cityName || ''
    };
  } catch {
    return {};
  }
}

function enrichFromEmail(email) {
  if (!email) return {};

  const domain = (email.split('@')[1] || '').trim().toLowerCase();
  if (!domain || !domain.includes('.')) return {};

  const freeDomains = [
    'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
    'icloud.com', 'aol.com', 'live.com', 'msn.com', 'proton.me',
    'protonmail.com'
  ];

  if (freeDomains.includes(domain)) {
    return { website: { value: '', source: 'email_domain_free' } };
  }

  return {
    website: { value: `https://${domain}`, source: 'email_domain' },
    companyName: { value: domain.split('.')[0], source: 'email_domain', confidence: 0.5 }
  };
}

async function evaluateEnrichments(fields, context) {
  const result = {};
  const ip = context?.ip || '';
  const email = fields?.emailaddress1 || '';

  const emailEnrich = enrichFromEmail(email);
  Object.assign(result, emailEnrich);

  if (ip) {
    const ipEnrich = await enrichFromIp(ip);
    if (ipEnrich.country) {
      result.country = ipEnrich.country;
    }
  }

  return result;
}

module.exports = { evaluateEnrichments };
