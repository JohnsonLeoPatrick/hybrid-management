# Daily reconciliation and reception permissions

**Temporarily disabled at the user's request.** Do not restore daily reconciliation unless the user explicitly asks. Its implementation and database RPC remain available for restoration. Both the Overview shortcut and the reconciliation panel in Payments are removed. Payment requests remain available through the separate manager request inbox in Payments.

To restore, import `DailyReconciliation` into `components/management.tsx` and render it in Payments with `branch`, `role`, and `paymentRevision={db.payments.map(p=>p.id+p.status).join(',')}`. Restore the Overview quick action linking to Payments in `components/reception-dashboard.tsx`. Recheck both branches and the limited STAFF view before deploying.

Cross-check of the requested permissions: issuing and viewing e-receipts, immutable payment details, payment deletion prevention, admin voiding, and manager-only Reports already existed. This change adds staff void/refund requests, PDF sharing, daily reconciliation, manager-only ledger exports, and database-enforced admin-only payment updates.

Both KIP and BD use the same code and database policies. Select a branch, open **Overview → Daily reconciliation** or **Payments → Open reconciliation**, and unlock Payments. The report defaults to today's Malaysia business date. Reception staff can see today's branch totals only. Managers can select an earlier date and enter actual cash, bank/QR, card, and other collections to see differences.

Reports calculate receipt counts, current net recorded collections by method, unpaid receipts, void/full-refund details, receipt sequence gaps, and memberships starting without a collection. Review exception flags against registrations and actual bank/card statements. Counts of missing receipt numbers are branch-wide, so receipts issued on another day do not appear as false daily gaps. Exception detail lists are limited to 100 rows per category. Report values reflect current payment status for the selected payment date; these are not immutable historical closing snapshots. Later reversals change those totals.

Staff request a void or full refund from the payment ledger. Managers review pending requests in reconciliation, then use the receipt's **Void payment** or **Record full refund** action. The system records a full refund only after the manager confirms money was returned outside the system. It does not transfer money or support partial refunds. The existing audit fields retain the reason, actor, and time. Completing a reversal automatically resolves pending requests. Requests can also be declined.

**Share PDF / WhatsApp** generates the existing PDF on demand. On supported devices, choose WhatsApp in the native share sheet. Otherwise download the PDF, open WhatsApp, and attach it manually. No receipt files are uploaded or archived, and nothing is sent automatically.

No daily report rows, PDF copies, or actual counted amounts are stored. Only compact request audit records are new. Indexed aggregation avoids downloading payment history for reconciliation. Payment-access polling now runs once per minute and on focus; the database enforces access on every request. Overview arrival polling runs every 30 seconds instead of 15 seconds.
