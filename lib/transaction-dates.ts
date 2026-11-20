import {today} from './utils';

export function validateTransactionDate(value:string,label:string,minimum=today()) {
 const timestamp=Date.parse(value);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==value) {
  throw new Error(`Enter a valid ${label.toLowerCase()}.`);
 }
 if(value<minimum)throw new Error(`${label} cannot be before today (Malaysia time).`);
}
