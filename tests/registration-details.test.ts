import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RegistrationDetails} from '../components/registration-details';
import type {RegistrationRequest} from '../types/onboarding';

const request:RegistrationRequest={id:'request',branchId:'dd',planId:null,name:'Member',phone:'+60 12 345 6789',email:'long-member-address@example.com',ic:'ID-123',dob:null,gender:'Other',address:'Apartment 123\nA long street address in Kuala Lumpur',emergencyName:'Emergency contact',emergencyPhone:'+60 12 987 6543',notes:'A long registration note. '.repeat(50),checkedInAt:'2026-10-24T00:00:00Z',status:'PENDING',memberId:null};
test('QR review preserves all personal fields and long values in labeled, wrapping detail rows',()=>{
 const html=renderToStaticMarkup(React.createElement(RegistrationDetails,{request}));
 assert.equal((html.match(/<dt>/g)||[]).length,9);
 assert.equal((html.match(/<dd>/g)||[]).length,9);
 for(const text of [request.email,request.phone,request.address,request.emergencyPhone,request.notes])assert.ok(html.includes(text));
 assert.match(html,/<dt>Date of birth<\/dt><dd>—<\/dd>/);
 assert.match(html,/class="detail-full"><dt>Address/);
 assert.match(html,/class="detail-full"><dt>Notes/);
});
test('QR review safely renders submitted text as text',()=>{
 const html=renderToStaticMarkup(React.createElement(RegistrationDetails,{request:{...request,notes:'<script>alert(1)</script>'}}));
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
});
