import type { Plan } from '@/types';
import type { MembershipSelection } from '@/lib/memberships';
import { addMonths, money, today } from '@/lib/utils';

export function MembershipChoices({plans,value,onChange,disabled=false}:{plans:Plan[];value:MembershipSelection[];onChange:(value:MembershipSelection[])=>void;disabled?:boolean}){
 function update(planId:string,change:Partial<MembershipSelection>){onChange(value.map(row=>row.planId===planId?{...row,...change}:row))}
 return <fieldset className="membership-choices" disabled={disabled}><legend>Choose class memberships</legend><p className="hint">Select one or more. Each membership keeps its own start date, expiry and payment.</p>
 {plans.map(plan=>{const row=value.find(s=>s.planId===plan.id);return <div className={'membership-choice'+(row?' selected':'')} key={plan.id}>
  <label className="membership-choice-label"><input type="checkbox" checked={!!row} onChange={event=>onChange(event.target.checked?[...value,{planId:plan.id,start:today(),months:plan.months,amount:plan.price}]:value.filter(s=>s.planId!==plan.id))}/><span><b>{plan.name}</b><small>{money(plan.price)} / {plan.months===1?'month':`${plan.months} months`}</small></span></label>
  {row&&<div className="membership-choice-details"><p className="hint">{plan.description} Included classes are enrolled automatically.</p><div className="form-grid">
   <label className="field">Start date<input type="date" value={row.start} onChange={e=>update(plan.id,{start:e.target.value})} required/></label>
   <label className="field">Duration (months)<input type="number" min="1" step="1" value={Number.isNaN(row.months)?'':row.months} onChange={e=>{const months=e.target.valueAsNumber;update(plan.id,{months,amount:Number.isFinite(months)?Math.round(plan.price*months/plan.months*100)/100:0})}} required/></label>
   <label className="field">Amount collected (RM)<input type="number" min="0" step="0.01" value={Number.isNaN(row.amount)?'':row.amount} onChange={e=>update(plan.id,{amount:e.target.valueAsNumber})} required/></label>
  </div>{row.start&&Number.isInteger(row.months)&&row.months>0&&<p className="renewal-preview">Expires {addMonths(row.start,row.months)}</p>}</div>}
 </div>})}
 {!plans.length&&<p className="error">Create an active plan for this branch before registering a membership.</p>}
 <p className="renewal-preview">{value.length} selected / Total collected: <b>{money(value.reduce((sum,row)=>sum+(Number.isFinite(row.amount)?row.amount:0),0))}</b></p>
 </fieldset>;
}
