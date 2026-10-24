import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionRoutes, sectionForPath } from '../lib/section-routes';

test('workspace URLs resolve to their sections without duplicate paths', () => {
 assert.equal(sectionRoutes.Members, '/member');
 assert.equal(sectionRoutes['QR sign-up'], '/qr-code');
 assert.equal(new Set(Object.values(sectionRoutes)).size, Object.keys(sectionRoutes).length);
 for (const [section, path] of Object.entries(sectionRoutes)) assert.equal(sectionForPath(path), section);
});
