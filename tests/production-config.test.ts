import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';

test('a clean production checkout loads only public Supabase settings without .env.local', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hybrid-production-config-'));
  try {
    copyFileSync('.env.production', join(directory, '.env.production'));
    const { loadedEnvFiles, parsedEnv } = loadEnvConfig(directory, false, undefined, true);
    assert.deepEqual(loadedEnvFiles.map(file => file.path), ['.env.production']);
    assert.deepEqual(Object.keys(parsedEnv || {}).sort(), ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL']);
    const publicKey = parsedEnv?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const projectUrl = parsedEnv?.NEXT_PUBLIC_SUPABASE_URL;
    assert.ok(publicKey?.startsWith('sb_publishable_'));
    assert.ok(projectUrl);
    assert.equal(new URL(projectUrl).protocol, 'https:');
    assert.equal(new URL(projectUrl).hostname, 'whcvxpncictpahscvrqe.supabase.co');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
