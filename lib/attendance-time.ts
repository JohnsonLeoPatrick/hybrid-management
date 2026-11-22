export function attendanceTime(value?:string|null) {
 if(!value||!Number.isFinite(Date.parse(value)))return 'Time unavailable';
 return new Intl.DateTimeFormat('en-MY',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true,timeZone:'Asia/Kuala_Lumpur'}).format(new Date(value));
}
