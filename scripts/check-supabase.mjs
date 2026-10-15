// Read-only connection check. Never prints keys or member records.
try { process.loadEnvFile('.env.local'); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Configure the Supabase URL and public key in .env.local first.');
  process.exit(1);
}
const headers = { apikey: key };
const get = async path => {
  const response = await fetch(new URL(path, url), { headers, signal: AbortSignal.timeout(15000) });
  return { response, body: await response.json() };
};
try {
  const { response: auth } = await get('/auth/v1/settings');
  if (!auth.ok) throw new Error(`Authentication endpoint returned HTTP ${auth.status}. Check the project URL and public key.`);
  console.log('PASS: Supabase is reachable and accepts the public key.');
  const tables = ['branches', 'staff', 'members', 'membership_plans', 'classes', 'memberships', 'membership_renewals', 'payments', 'attendance'];
  for (const table of tables) {
    const { response, body } = await get(`/rest/v1/${table}?select=id&limit=1`);
    if (response.ok) {
      // RLS-denied SELECTs can legitimately return an empty array instead of 403.
      // On an empty table this alone cannot prove the policies are configured correctly.
      if (!Array.isArray(body) || body.length > 0) throw new Error(`${table}: anonymous records were returned. Review grants and RLS before using real data.`);
      console.log(`PASS: ${table} exists; no rows returned to an anonymous visitor.`);
      continue;
    }
    if (body.code !== '42501') {
      throw new Error(`${table}: expected access denial; received HTTP ${response.status}, code ${body.code || 'unknown'}. Check that setup SQL ran successfully.`);
    }
    console.log(`PASS: ${table} exists and anonymous reads are denied.`);
  }
  console.log('Connection checks passed. No anonymous records were exposed by these requests. Empty-table checks alone do not prove RLS; staff sign-in and authenticated read/write checks still require your gym login.');
} catch (error) {
  console.error('Connection check failed:', error.message);
  if (error.cause?.code) console.error('Network code:', error.cause.code);
  process.exitCode = 1;
}
