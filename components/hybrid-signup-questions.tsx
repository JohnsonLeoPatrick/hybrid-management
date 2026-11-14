'use client';
import { useState } from 'react';
import source from '@/lib/hybrid-google-form.json';
import { HEALTH_QUESTIONS } from '@/lib/registration';

const names: Record<string, string> = {
 '835335530':'name', '1816972513':'dob', '1390327371':'age', '1034751384':'address',
 '260300504':'gender', '1298609699':'phone', '1264896309':'relationshipStatus',
 '1807771573':'healthDetails', '1170131668':'referral',
};
const healthIds = ['288193178','13163432','685185184','1043199006','1863285032','1060537411','1565434560'];
healthIds.forEach((id, index) => { names[id] = HEALTH_QUESTIONS[index][0]; });

export function HybridSignupQuestions() {
 const [other, setOther] = useState<Record<string, boolean>>({});
 return <div className="hybrid-signup-questions">
  <h3>Member details</h3>
  <label className="field">Email *<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>
  {source.fields.map(field => {
   const name = names[field.id] || `question.${field.id}`;
   if (field.type === 8) return <section key={field.id} className="signup-section"><h3>{field.label}</h3>{field.description && <div className="signup-rules">{field.description.split('\n').map((rule, index) => <p key={index}>{rule}</p>)}</div>}</section>;
   if (field.type === 2) return <fieldset key={field.id} className="signup-question"><legend>{field.label}{field.required && ' *'}</legend><div className="signup-options">{field.options.map(option => <label key={option}><input type="radio" name={name} value={option} required={field.required} onChange={() => setOther(values => ({...values, [name]:option === 'Other'}))}/>{option}</label>)}</div>{other[name] && <input aria-label={`${field.label} — Other`} name={name === 'referral' ? 'referralOther' : `question.${field.id}.other`} maxLength={250} required/>}</fieldset>;
   if (field.type === 3) return <fieldset key={field.id} className="signup-question"><legend>{field.label}{field.required && ' *'}</legend><label className="field">Contact detail<select name={name} required={field.required}><option value="">Select</option>{field.options.map(option => <option key={option}>{option}</option>)}</select></label><div className="form-grid"><label className="field">Name<input name={field.id === '2011207499' ? 'emergencyName' : `question.${field.id}.name`} maxLength={120}/></label><label className="field">Phone no.<input name={field.id === '2011207499' ? 'emergencyPhone' : `question.${field.id}.phone`} type="tel" maxLength={30} required={field.required}/></label></div></fieldset>;
   const inputType = name === 'dob' ? 'date' : name === 'age' ? 'number' : name === 'phone' ? 'tel' : 'text';
   return <label key={field.id} className="field">{field.label}{field.required && ' *'}{field.type === 1 ? <textarea name={name} rows={3} maxLength={name === 'address' ? 500 : 1000} required={field.required}/> : <input name={name} type={inputType} min={name === 'age' ? 1 : name === 'dob' ? '1900-01-01' : undefined} max={name === 'age' ? 125 : name === 'dob' ? new Date().toISOString().slice(0,10) : undefined} maxLength={name === 'name' ? 120 : 250} required={field.required}/>}</label>;
  })}
 </div>;
}
