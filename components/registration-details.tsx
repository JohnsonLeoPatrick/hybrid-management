import React from 'react';
import type {RegistrationRequest} from '@/types/onboarding';
import { HEALTH_QUESTIONS } from '@/lib/registration';
import hybridForm from '@/lib/hybrid-google-form.json';

export function RegistrationDetails({request}:{request:RegistrationRequest}){
 const fields:Array<[string,string|null]>=[['Phone',request.phone],['Email',request.email],['IC / Passport',request.ic],['Date of birth',request.dob],['Gender',request.gender],['Address',request.address],['Emergency contact',request.emergencyName],['Emergency phone',request.emergencyPhone],['Notes',request.notes]];
 if (request.formAnswers) {
  const answers = request.formAnswers;
  fields.push(['Age',String(answers.age)],['Relationship status',answers.relationshipStatus],...HEALTH_QUESTIONS.map(([key,label]):[string,string]=>[label,answers.health[key] || '']),['Further health details',answers.healthDetails],['How did you find out about Hybrid?',answers.referral === 'Other' ? answers.referralOther : answers.referral]);
  for (const [id,value] of Object.entries(answers.responses || {})) fields.push([hybridForm.fields.find(field=>field.id === id.split('.')[0])?.label + (id.includes('.') ? ` (${id.split('.')[1]})` : ''),value]);
 }
 return <dl className="detail-grid registration-details">{request.photo && <div className="detail-full"><dt>Member photo</dt><dd><img className="registration-photo" src={request.photo} alt={`Photo of ${request.name}`} width={160} height={160}/></dd></div>}{fields.map(([label,value])=><div key={label} className={['Address','Notes'].includes(label)?'detail-full':''}><dt>{label}</dt><dd>{value||'—'}</dd></div>)}</dl>;
}
