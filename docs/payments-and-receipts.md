# Payments and e-receipts

On Overview, choose **Walk-in / product sale** under Quick actions to collect payment without creating a member. This collection does not require unlocking the payment ledger. The sale is recorded in Payments, where viewing it still requires the payment password. The same sale button remains available in Payments. Enter up to 20 items with whole quantities and unit prices. Customer name and email are optional. Membership payments retain their existing workflow.

New payments receive sequential receipt numbers within their branch. KIP uses `KIP-000001` and BD uses `BD-000001`. Database transactions serialize number allocation; failed transactions do not consume numbers. Voided numbers are retained and never reused. Existing historical receipt identifiers remain compatible.

Admins with unlocked payment access can choose **Void payment** and enter a reason. The original payment and amount remain visible alongside the void reason, actor, and time. Voided records cannot be edited or restored and are excluded from collected revenue and ledger export totals. Voiding does not transfer money or issue a refund. Correct an entry by voiding it and recording a new payment. Payment deletion and changes to historical payment fields are blocked in the database.

**Generate e-receipt** creates a PDF on demand for download or email attachment. The system stores payment data and receipt numbers, not PDF copies. Regenerating a voided payment's receipt displays its current Void status and reason. No email is sent automatically.

Apply `supabase/migrations/20261122192012_retail_receipts_and_void.sql` before deploying the matching frontend. The migration preserves the previous membership payment writer during rollout. Do not remove the new columns after accepting retail sales; old clients cannot display those sales completely.
