import React from 'react';
import type {RegistrationRequest} from '@/types/onboarding';

export function RegistrationDetails({request}:{request:RegistrationRequest}){
 const fields:Array<[string,string|null]>=[['Phone',request.phone],['Email',request.email],['IC / Passport',request.ic],['Date of birth',request.dob],['Gender',request.gender],['Address',request.address],['Emergency contact',request.emergencyName],['Emergency phone',request.emergencyPhone],['Notes',request.notes]];
 return <dl className="detail-grid registration-details">{fields.map(([label,value])=><div key={label} className={['Address','Notes'].includes(label)?'detail-full':''}><dt>{label}</dt><dd>{value||'—'}</dd></div>)}</dl>;
}
