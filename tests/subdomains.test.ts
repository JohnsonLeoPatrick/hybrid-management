import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { REGISTRATION_ORIGIN, registrationLink } from '../lib/registration';
import { CHECK_IN_ORIGIN, gymCheckInLink } from '../lib/gym-check-in';

const token = '11111111-1111-4111-8111-111111111111';
const request = (url: string) => new NextRequest(url, { headers: { host: new URL(url).host } });

test('public subdomain roots open the existing forms and keep staff routing intact', () => {
 const previous = process.env.GYM_CHECK_IN_TOKEN;
 process.env.GYM_CHECK_IN_TOKEN = token;
 try {
  for (const [host, path] of [
   ['register.hybridcombativegym.com', '/join/dd'],
   ['checkin.hybridcombativegym.com', `/check-in/${token}`],
  ]) {
   const response = middleware(request(`https://${host}/?source=qr`));
   assert.equal(response.headers.get('x-middleware-rewrite'), `https://${host}${path}?source=qr`);
  }
  for (const url of [
   'https://management.hybridcombativegym.com/',
   'https://hybrid-management.vercel.app/',
   'http://localhost:3000/',
   'https://register.hybridcombativegym.com/join/ab',
   `https://checkin.hybridcombativegym.com/check-in/${token}`,
   'https://register.hybridcombativegym.com.evil.example/',
  ]) {
   assert.equal(middleware(request(url)).headers.get('x-middleware-next'), '1');
  }
  for (const value of ['', '../member', 'not-a-token']) {
   process.env.GYM_CHECK_IN_TOKEN = value;
   assert.equal(middleware(request(`${CHECK_IN_ORIGIN}/`)).status, 503);
  }
 } finally {
  if (previous === undefined) delete process.env.GYM_CHECK_IN_TOKEN;
  else process.env.GYM_CHECK_IN_TOKEN = previous;
 }
});

test('new QR codes use the public subdomains with their branch and token', () => {
 assert.equal(registrationLink(REGISTRATION_ORIGIN, 'DD'), 'https://register.hybridcombativegym.com/join/dd');
 assert.equal(gymCheckInLink(CHECK_IN_ORIGIN, token), `https://checkin.hybridcombativegym.com/check-in/${token}`);
});
