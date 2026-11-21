import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspaceSession, WORKSPACE_SESSION_MS } from '../lib/auth-session';

const token=(payload:object)=>`header.${btoa(JSON.stringify(payload)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}.signature`;

test('the session ends 24 hours after authentication, including after refresh or MFA',()=>{
 const timestamp=1800000000;
 const claims={session_id:'same-session',amr:[{method:'password',timestamp}],iat:timestamp};
 const original=workspaceSession(token(claims));
 assert.deepEqual(original,{id:'same-session',expiresAt:timestamp*1000+WORKSPACE_SESSION_MS});
 assert.deepEqual(workspaceSession(token({...claims,iat:timestamp+3600,exp:timestamp+7200})),original);
 assert.deepEqual(workspaceSession(token({...claims,amr:[...claims.amr,{method:'totp',timestamp:timestamp+600}]})),original);
 assert.deepEqual(workspaceSession(token({...claims,session_id:'new-session',amr:[{method:'password',timestamp:timestamp+1000}]})),{id:'new-session',expiresAt:(timestamp+1000)*1000+WORKSPACE_SESSION_MS});
});

test('missing, malformed, and invalid session timing cannot create a persistent login',()=>{
 for(const value of ['', 'invalid', token({session_id:'session'}), token({amr:[{timestamp:1800000000}]}),token({session_id:'session',amr:[{timestamp:'1800000000'}]}),token({session_id:'session',amr:[{timestamp:-1}]})])assert.equal(workspaceSession(value),null);
});
