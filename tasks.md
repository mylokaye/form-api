Country/IP enrichment
The HTML still has IP lookup and country inference logic. The architecture already intended this to move server-side. The API should return something like:

"fieldValues": {
  "nor_country": { "value": "Germany", "reason": "ip_country" }
}
Email domain -> website derivation
Logic that turns john@example.com into https://example.com, ignores Gmail/Outlook/etc., and writes websiteurl can move to API rules/enrichment. The client sends email, API returns website value.

Website metadata enrichment
Microlink/API calls and formatted website info are better server-side. This avoids browser CORS issues and keeps third-party calls out of the form.


UTM/MTM field mapping rules
The browser still needs to read URL params, but the mapping of param names -> hidden Dynamics fields can be config/API-driven.

Campaign/source lookup mappings
If there are hardcoded mappings from URL/domain/source to campaign IDs or names, move those into inquiry.json.

Option lists and dependent option rules
You already started this for division/category/process. Any remaining hardcoded datalist/select options should move to inquiry.json.