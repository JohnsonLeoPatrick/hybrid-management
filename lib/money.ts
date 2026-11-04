// Money is validated at entry and added as integer sen, never floating-point ringgit.
export function toCents(value:number|string):number {
 const text=String(value);
 if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Enter a valid amount with at most 2 decimal places.');
 const [whole,fraction='']=text.split('.');
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if (!Number.isSafeInteger(cents) || cents>999999999999) throw new Error('Payment amount exceeds the supported limit.');
 return cents;
}
export function sumMoney(values:number[]):number {
 const cents=values.reduce((sum,value)=>{
  const next=sum+toCents(value);
  if (!Number.isSafeInteger(next)) throw new Error('Total exceeds the supported precision.');
  return next;
 },0);
 return cents/100;
}
export function durationPrice(price:number,planMonths:number,months:number):number {
 if (!Number.isSafeInteger(planMonths)||planMonths<1||!Number.isSafeInteger(months)||months<1) throw new Error('Duration must be positive whole months.');
 const numerator=BigInt(toCents(price))*BigInt(months),denominator=BigInt(planMonths);
 const cents=(numerator*2n+denominator)/(denominator*2n);
 if (cents>999999999999n) throw new Error('Duration exceeds the supported amount limit.');
 return Number(cents)/100;
}
