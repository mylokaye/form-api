# Form Intelligence API — Architecture Plan

## 0. Executive Summary

The existing `inquiry.html` (5134 lines) packs field enrichment, geolocation, translation, attribution tracking, and conditional logic into **one monolithic frontend script**. This works but creates pain: logic is duplicated across forms, changes require HTML deploys, and AI/validation features are hard to add. The API extracts a *control plane* — a thin backend that returns JSON instructions the frontend interprets.

The API **never touches CRM submission**. It is read-only except for its own storage. Forms still submit directly to Dynamics 365.

---

## 1. Recommended Architecture

```
┌─────────────────────┐     POST /api/form/{formId}/evaluate     ┌──────────────────────┐
│   HTML Form Page    │ ───────────────────────────────────────► │   Express.js API     │
│   (inquiry.html)    │                                          │   (Vercel)           │
│                     │ ◄─────────────────────────────────────── │                      │
│  form-intelligence  │     JSON response                       │  ┌────────────────┐   │
│  .js (thin client)  │     { rules, enrichments }              │  │  Rule Engine   │   │
│                     │                                          │  └────────────────┘   │
│  submits directly   │                                          │  ┌────────────────┐   │
│  to Dynamics 365    │                                          │  │  JSON configs  │   │
└─────────────────────┘                                          │  └────────────────┘   │
                                                                 └──────────────────────┘
```

**Key principle**: The frontend sends field values + context once (on load, on change, on submit). The API returns all instructions in a single response. The frontend applies them.

---

## 2. Simplest Viable Stack

| Layer | Choice | Rationale |
|---|---|---|
| **API framework** | Express.js (Node) | Same language as frontend; native on Vercel |
| **Hosting** | Vercel (free tier) | Deploys from GitHub push; serves API + static files |
| **Database** | None initially; JSON files in repo for rules/translations | Zero infrastructure until needed |
| **Auth** | None initially; simple API key later | Keep MVP frictionless |
| **Frontend client** | Single `form-intelligence.js` loaded as ES module | ~200 lines, not 3700 |

**What we are NOT building in MVP**: database, user auth, audit logging, admin dashboard, WebSockets, message queues, Redis.

---

## 3. Folder / Project Structure

```
form-api/
├── api/
│   ├── index.js             # Express app entry (Vercel serverless entry)
│   ├── routes/
│   │   ├── evaluate.js      # POST /api/form/:formId/evaluate
│   │   ├── config.js        # GET /api/form/:formId/config
│   │   └── health.js        # GET /api/health
│   ├── engine/
│   │   ├── rules.js         # Rule evaluator (visibility, conditional logic)
│   │   └── enrich.js        # Geolocation, website metadata
│   └── middleware/
│       └── validate.js      # Request validation middleware
├── config/
│   ├── forms/
│   │   ├── inquiry.json     # Per-form rules, field definitions
│   │   └── contact.json
│   └── translations/
│       └── inquiry.json     # Translation strings (extracted from frontend)
├── tests/
│   ├── test-rules.js
│   ├── test-validate.js
│   └── test-evaluate.js
├── public/
│   ├── inquiry.html         # Existing form (or kept at root)
│   └── form-intelligence.js # Thin client to load, call, apply
├── package.json
├── vercel.json              # Routes /api/* to Express, static to public/
└── README.md
```

**Decision rationale:** JSON files in `config/` keep rules versioned in Git alongside code. No database means zero operational cost during MVP. Each form gets its own config file — adding a new form is `cp inquiry.json newform.json`. The Express API and static files are served from the same Vercel project — one `git push` deploys everything.

---

## 4. API Design Philosophy

**A single endpoint does everything:**

```http
POST /api/form/{formId}/evaluate
Content-Type: application/json

{
  "formId": "inquiry",
  "fields": {
    "firstname": "John",
    "lastname": "Doe",
    "emailaddress1": "john@acme.com",
    "nor_country": "United States",
    "nor_noricansalescategory": "Equipment"
  },
  "context": {
    "url": "https://norican.com/inquiry?mtm_source=google",
    "referrer": "https://google.com",
    "userAgent": "Mozilla/5.0...",
    "language": "en-US",
    "ip": "203.0.113.1"
  },
  "version": "1.0"
}
```

Response:

```json
{
  "version": "1.0",
  "formId": "inquiry",
  "rules": {
    "visibility": {
      "nor_state": { "visible": false, "reason": "country_not_us" },
      "nor_noricansalesprocess": { "visible": true }
    },
    "required": {
      "nor_state": false,
      "nor_noricansalesprocess": true
    },
    "options": {
      "nor_noricansalesprocess": {
        "values": [
          { "value": "100000001", "label": "New Equipment" },
          { "value": "100000002", "label": "Service" }
        ],
        "filteredBy": "nor_noricansalescategory"
      }
    }
  },
  "enrichments": {
    "country": { "value": "United States", "confidence": 0.95, "source": "ip" },
    "companyName": { "value": "Acme Corp", "confidence": 0.7, "source": "email_domain" },
    "website": { "value": "https://acme.com", "source": "email_domain" }
  },
  "translations": {
    "labels": {
      "firstname": "First name",
      "lastname": "Last name"
    },
    "placeholders": {
      "firstname": "John"
    }
  },

  "meta": {
    "evaluated_at": "2026-05-26T12:00:00Z",
    "duration_ms": 234,
    "version_applied": "1.0"
  }
}
```

**Why one endpoint:**
- Atomic: one network round-trip per form load + per meaningful change
- Predictable: frontend always knows what to expect
- Cacheable: response can be cached by form version + field hash
- Debuggable: full response visible in DevTools


---

## 5. Rule Engine Strategy

**Do not build a generic rule engine yet. Use a declarative JSON approach.**

```json
// config/forms/inquiry.json (excerpt)
{
  "version": "1.0",
  "rules": [
    {
      "id": "state_visibility",
      "type": "visibility",
      "field": "nor_state",
      "condition": {
        "field": "nor_country",
        "op": "eq",
        "value": "United States"
      },
      "actions": [
        { "type": "set_visible", "value": true }
      ]
    },
    {
      "id": "process_options_filter",
      "type": "options_filter",
      "field": "nor_noricansalesprocess",
      "depends_on": "nor_noricansalescategory",
      "mapping": {
        "Equipment": ["New Equipment", "Service", "Parts"],
        "Service": ["Repair", "Maintenance", "Consulting"]
      }
    }
  ]
}
```

**Why not a custom DSL or Drools-like engine?**
- JSON is parseable by any frontend (useful if rules ever run client-side)
- No learning curve for future rule editor UI
- Git-diffable, reviewable in PRs
- Fast enough for sub-50ms evaluation

**Evaluation flow in `api/engine/rules.js`:**
1. Load rules for form from `config/forms/{formId}.json`
2. Iterate rules in order
3. Each rule checks its condition against current field values
4. Collect actions into the response
5. Return `{ visibility: ..., required: ..., options: ... }`

---

## 6. JSON Response Structure (detailed)

The response has **seven sections**, each optional:

| Section | Purpose | When populated |
|---|---|---|
| `rules` | Visibility, required, and filtered options | Every request |
| `enrichments` | Auto-filled field values (geo, company, website) | On load (or when fields change) |
| `translations` | i18next-compatible label/placeholder/hint strings | On load (when language specified) |
| `meta` | Timing, version, warnings | Every request |

**Design rules:**
- All sections return `null` or empty array if not applicable
- Frontend merges response into its state, never replaces blindly
- Boolean `valid` in validation means "frontend should not block submission on this" — final validation remains on the frontend so the form works offline

---

## 7. Versioning Strategy

**Simple: Git-based, with explicit version in config files.**

```
config/forms/
├── inquiry.json          # Always the current version
├── v1.0/
│   └── inquiry.json      # Archived snapshot
└── v1.1/
    └── inquiry.json
```

- The API always loads `config/forms/{formId}.json` as the "live" version
- The request can include `"version": "1.0"` — if specified, API loads from the archived directory
- Frontend pins to a version in its config
- When you deploy a new version, copy the current config to `v{version}/` before modifying

**No URL path versioning (no `/v1/`, `/v2/`).** Version is in the request body. This avoids code duplication — one codebase, multiple rule versions.

---

## 8. Security Considerations (MVP)

| Concern | MVP approach |
|---|---|
| **Input validation** | Express middleware validates request body shape and types |
| **CORS** | Restrict to known origins via `cors` npm package |
| **Data exposure** | Never log full field values in production; log field names and lengths |
| **No PII in URLs** | POST body only, never query params |

**What we are NOT doing in MVP:**
- OAuth / JWT / API keys
- Encryption at rest (no database)
- Audit logging
- IP allowlisting
- Request signing

---

## 9. Scaling Path

```
Phase 1 (MVP)           Phase 2                  Phase 3
─────────────           ──────────               ──────────
JSON files in Git       SQLite → PostgreSQL       Read replicas
Vercel serverless       Vercel Pro (team)         Multi-region
In-memory rate limit    Upstash Redis             Rate limiting per key
No monitoring           Sentry                    Datadog / Grafana
Git push = deploy       Preview deploys           Staging + canary
```

**Checks before moving to each phase:**
- Phase 2: when you have 5+ forms or 2+ developers touching rules
- Phase 3: when latency exceeds 200ms P95 or you have non-dev stakeholders

---

## 10. Dashboard / Admin Evolution

**MVP: configs are edited in code (GitHub PRs).**

This is intentional:
- Changes are reviewed, tested, and deployed like code
- History is automatic (Git log)
- No separate UI to build and maintain
- Developers iterate fast; non-technical stakeholders can review via GitHub

**Future dashboard only when:**
- Multiple non-technical people need to edit rules
- A/B test results need visualisation
- You need feature flags toggled without deploys

The JSON file format is designed *for* a future UI — a dashboard would read/write the same JSON structure, so no data migration is needed.

---

## 11. GitHub Workflow

```
1. Edit config/forms/inquiry.json in feature branch
2. Commit + push
3. Open PR with before/after behaviour described
4. Automated test runs:
   - `npm test` (rule evaluation matches expected JSON)
   - JSON schema validation (config is well-formed)
   - lint (`npm run lint`)
5. Merge to main
6. Vercel auto-deploys from `main` (preview deploys for PRs)

```

**Key automation:**
- A GitHub Action that runs the current configs against sample payloads and reports diffs in PR comments
- A `validate-configs` script that ensures all referenced fields exist

---

## 12. Recommended First MVP

### What to build

| Component | Scope | Why |
|---|---|---|
| **Express API** | `POST /evaluate` + `GET /health` | Core API |
| **Rule engine** | Visibility, required, options filter | Replace inline `Country/State Visibility Helper` |
| **Enrichments** | IP→country (via API), email→domain, email→website | Replace geolocation + website metadata logic |
| **Translations endpoint** | Return i18n strings per form per language | Extract 300+ lines of translation resources |
| **Thin JS client** | `form-intelligence.js` (~200 lines) orchestrates call + DOM update | Replace 3700 lines of inline script |
| **Config for `inquiry`** | `config/forms/inquiry.json` | First form onboarded |

### What to explicitly NOT build (MVP)

- AI summaries / classification (calls OpenAI = cost + latency)
- Lead scoring (requires business logic agreement)
- Admin dashboard (edit configs in GitHub)
- A/B testing / feature flags (adds complexity)
- Database (JSON files suffice)

### Migration path for existing `inquiry.html`

1. Extract all field schemas, translation resources, and visibility rules into `config/forms/inquiry.json`
2. Replace the 3700-line inline script with `<script src="form-intelligence.js"></script>`
3. `form-intelligence.js` does:
   - On DOM ready: call `POST /evaluate` with context → receive enrichments + translations → populate fields
   - On field change: call `POST /evaluate` → receive visibility/options updates → apply to DOM
   - On submit: call `POST /evaluate` → receive validations → block or allow
4. Keep native validation (`Lead-Native Form Validation`) as-is — it is a safety net that works offline

### Redundancy and graceful degradation

Form should work without JavaScript (graceful degradation). The API enhances the experience but does not break core functionality. If the API is down, the form still submits to Dynamics, and native validation still works.

## 13. What Should Remain Frontend vs Backend

### Keep on frontend

- **Native browser validation** (`required`, `pattern`, `type="email"`) — works offline, instant feedback
- **The `Lead-Native Form Validation` script** — it is a last-resort guard that should never be replaced by network calls
- **Event dispatching** (`d365mktforms.fillLookupFromSearch`) — Dynamics proprietary API must be called from the form's window
- **MTM/UTM field population from URL params** — the data is already in the URL; no need to round-trip
- **Division auto-populate from hostname** — static mapping, zero benefit from server
- **Loading states, error toasts, UI animation** — these are UI concerns
- **CSP violation logging** — browser-only

### Move to backend

- **Geolocation (IP→country)** — needs server-side API; removes `freeipapi` call from browser
- **Website metadata** (`microlink.io`) — server-side fetch avoids CORS and third-party exposure
- **Email→company enrichment**
- **Translation resource serving** — centralise, version, cache
- **Conditional visibility logic** — single source of truth across multiple forms
- **Dependent dropdown options** — computed from backend data
- **Business validation rules** (e.g., "business email required for non-free domains") — consistent across all touchpoints

---

## 14. Summary of Key Decisions

| Decision | Choice | Alternative considered |
|---|---|---|---|
| Framework | Express.js (Node) | FastAPI (Python) |
| Database | None (JSON files) | SQLite, PostgreSQL |
| Auth | None (MVP) | API keys, JWT |
| API style | Single POST endpoint | GraphQL, many REST endpoints |
| Rule engine | Declarative JSON | Custom DSL, Drools, JSONata |
| Versioning | Git-based + body version | URL path versioning |
| Frontend client | Thin JS (<200 lines) | Full SPA framework |
| Hosting | Vercel | GitHub Pages (static only) |

The guiding principle throughout: **move logic to JSON, not to code**. Configuration over code means non-developers eventually get a UI, rules are reviewable in PRs, and the system remains auditable without a dedicated dashboard.
