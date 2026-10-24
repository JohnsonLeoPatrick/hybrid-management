'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, Loader2, X } from 'lucide-react';
import type { Database, Payment } from '@/types';
import { buildInvoice, invoiceMoney, type InvoiceData } from '@/lib/invoice';

export function InvoiceButton({ db, payment, notify }: { db: Database; payment: Payment; notify: (message: string) => void }) {
 const [invoice, setInvoice] = useState<InvoiceData | null>(null);
 return <><button className="text-button invoice-trigger" onClick={() => {
  try { setInvoice(buildInvoice(db, payment)); }
  catch (error) { notify(error instanceof Error ? error.message : 'Could not generate invoice. Please try again.'); }
 }}><FileText size={15} aria-hidden="true"/>Generate invoice</button>{invoice && <InvoicePreview invoice={invoice} close={() => setInvoice(null)} notify={notify}/>}</>;
}

function InvoicePreview({ invoice, close, notify }: { invoice: InvoiceData; close: () => void; notify: (message: string) => void }) {
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 async function download() {
  if (busy) return;
  setBusy(true); setError('');
  try {
   const { createInvoicePdf, loadInvoiceFonts } = await import('@/lib/invoice-pdf');
   const pdf = createInvoicePdf(invoice, await loadInvoiceFonts());
   await pdf.save(`${invoice.number}.pdf`, { returnPromise: true });
   notify('Invoice PDF prepared. Check your downloads.');
  } catch (cause) {
   setError(cause instanceof Error ? cause.message : 'Could not download the invoice. Please try again.');
  } finally { setBusy(false); }
 }
 return createPortal(<div className="invoice-overlay" onClick={() => { if (!busy) close(); }}><section className="invoice-dialog" role="dialog" aria-modal="true" aria-labelledby="invoice-preview-title" onClick={event => event.stopPropagation()}>
  <header className="invoice-toolbar"><div><span className="invoice-toolbar-icon"><FileText size={20}/></span><div><h2 id="invoice-preview-title">Invoice preview</h2><p>Ready to save or share as a PDF</p></div></div><div className="invoice-toolbar-actions"><button className="invoice-download" disabled={busy} onClick={() => void download()}>{busy ? <Loader2 className="invoice-spinner" size={17}/> : <Download size={17}/>}<span>{busy ? 'Preparing PDF...' : 'Download PDF'}</span></button><button className="invoice-close" disabled={busy} onClick={close} aria-label="Close invoice preview"><X size={20}/></button></div></header>
  <div className="invoice-scroll"><article className="invoice-paper" aria-label={`Invoice ${invoice.number}`}>
   <div className="invoice-masthead"><div><div className="invoice-brand">HYBRID<span/></div><h3>{invoice.company.name}</h3><address>{invoice.company.address.map(line => <span key={line}>{line}</span>)}<span>{invoice.company.phone}</span><span>{invoice.company.website}</span></address></div><div className="invoice-title"><h1>Invoice</h1><span className="invoice-payment-status">{invoice.status}</span></div></div>
   <div className="invoice-number"><span>Invoice number</span><strong>{invoice.number}</strong></div>
   <div className="invoice-parties"><div className="invoice-bill-to"><span className="invoice-label">Bill to</span><h2>{invoice.memberName}</h2><p>{invoice.memberId}</p>{invoice.memberAddress && <p>{invoice.memberAddress}</p>}{invoice.memberEmail && <p>{invoice.memberEmail}</p>}{invoice.memberPhone && <p>{invoice.memberPhone}</p>}</div><dl className="invoice-meta"><div><dt>Payment date</dt><dd>{invoice.dateLabel}</dd></div><div><dt>Payment method</dt><dd>{invoice.method}</dd></div>{invoice.branch && <div><dt>Branch</dt><dd>{invoice.branch}</dd></div>}</dl></div>
   <div className="invoice-table-wrap"><table className="invoice-items"><thead><tr><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Amount</th></tr></thead><tbody><tr><td><strong>{invoice.description}</strong>{invoice.period && <span>Membership period: {invoice.period}</span>}</td><td>1</td><td>{invoiceMoney(invoice.amount)}</td></tr></tbody></table></div>
   <div className="invoice-total"><span>Invoice total</span><strong>{invoiceMoney(invoice.amount)}</strong></div>
   {(invoice.reference || invoice.notes) && <div className="invoice-additional">{invoice.reference && <div><span className="invoice-label">Payment reference</span><p>{invoice.reference}</p></div>}{invoice.notes && <div><span className="invoice-label">Notes</span><p>{invoice.notes}</p></div>}</div>}
   <footer className="invoice-footer"><strong>Thank you for being part of Hybrid.</strong><p>This invoice reflects the recorded payment amount and status. It does not change your payment record.</p><span>Hybrid Combative Academy & Gym</span></footer>
  </article></div>
  {error && <p className="invoice-error" role="alert">{error}</p>}<div className="invoice-preview-note" role="status">{busy ? 'Creating your PDF with Google Sans. Please keep this preview open.' : 'A4 document / MYR / The same payment keeps the same invoice number.'}</div>
 </section></div>, document.body);
}
