# Customer gym check-in

Customers scan a branch QR, enter an exact full name or member ID, and press Check in. The user confirmed gym visits only.

Settings contains a branch selector, QR preview, download, and public-page link. Reuse the existing dark and gold registration styling and QR library. A new /check-in/[token] route works without a staff login. No member list, suggestions, contact details, or profile data are returned.

Use a random branch token rather than a guessable branch-code URL. The database resolves exact names or IDs within that branch, refuses ambiguous names, assigns the Malaysia date, and inserts only general gym attendance. Repeated visits are idempotent. Record attendance even when membership is expired, matching existing reception behavior; access eligibility is outside this change.

Only a signed-in super administrator can retrieve the QR token from Settings. Private security-definer functions implement tightly scoped operations behind public security-invoker RPC wrappers. Tables stay private with RLS and no client grants. Limit attempts per branch token and minute. A QR link can be shared; this convenience flow does not prove physical presence or identity.

Staff Overview refreshes attendance only every 15 seconds while visible, preserving unsaved workspace edits. Existing staff check-in, history, registration, payments, and member records retain their behavior.

Approaches considered: a public member search would disclose a directory; customer accounts would add an unrequested login flow. Exact matching through a branch QR fits the requested one-field check-in.
