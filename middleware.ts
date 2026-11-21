import { NextRequest, NextResponse } from 'next/server';
import { gymQrTokenPattern } from './lib/gym-check-in';

export function middleware(request: NextRequest) {
 if (request.nextUrl.pathname !== '/') return NextResponse.next();
 const host = request.headers.get('host')?.split(':')[0].toLowerCase();
 const destination = request.nextUrl.clone();
 if (host === 'register.hybridcombativegym.com') {
  destination.pathname = '/join/dd';
 } else if (host === 'checkin.hybridcombativegym.com') {
  const token = process.env.GYM_CHECK_IN_TOKEN || '';
  if (!gymQrTokenPattern.test(token)) {
   return new NextResponse('Check-in is unavailable. Please speak to reception.', { status: 503 });
  }
  destination.pathname = `/check-in/${token}`;
 } else {
  return NextResponse.next();
 }
 return NextResponse.rewrite(destination);
}

export const config = { matcher: '/' };
