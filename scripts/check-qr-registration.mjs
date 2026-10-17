// Read-only check. No submissions, names or contact details are fetched.
try { process.loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; process.loadEnvFile('.env.production'); }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Supabase public configuration is missing.');
try {
 const response = await fetch(new URL('/rest/v1/rpc/registration_options', url), { method:'POST', headers:{apikey:key,'Content-Type':'application/json'}, body:JSON.stringify({branch_code:'dd'}), signal:AbortSignal.timeout(15000) });
 const data = await response.json();
 if (!response.ok) {
  if (data.code === 'PGRST202' || data.code === '42883') throw new Error('QR database update is not applied yet. Run supabase/003_qr_registration.sql once.');
  throw new Error(`QR options returned HTTP ${response.status}, code ${data.code || 'unknown'}.`);
 }
 if (!data?.branch) throw new Error('The DD branch is unavailable.');
 console.log(`PASS: public registration options available for ${data.branch.name}; personal-details signup.`);
 const privateResponse = await fetch(new URL('/rest/v1/registration_requests?select=id&limit=1',url), {headers:{apikey:key},signal:AbortSignal.timeout(15000)});
 if (privateResponse.ok) {
  const records=await privateResponse.json();
  if (!Array.isArray(records)||records.length) throw new Error('Anonymous request records were visible. Review access policies.');
  console.log('PASS: anonymous requests returned no registration records (empty-table checks alone do not prove RLS).');
 } else {
  const result=await privateResponse.json();
  if (result.code!=='42501') throw new Error(`Registration privacy check returned ${result.code||privateResponse.status}.`);
  console.log('PASS: anonymous registration reads are denied.');
 }
} catch(error) { console.error(error.message);process.exitCode=1; }
