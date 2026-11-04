import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../lib/seed';
import { checkIn, searchMembers } from '../lib/attendance';

test('reception search matches ID, name, and formatted phone within supplied branch scope', () => {
 const db = seed();
 const member = {...db.members[0], phone:'+60 12-345 6789'};
 assert.deepEqual(searchMembers([member], member.id.toLowerCase()), [member]);
 assert.deepEqual(searchMembers([member], member.name.toUpperCase()), [member]);
 assert.deepEqual(searchMembers([member], '60123456789'), [member]);
 assert.deepEqual(searchMembers([], member.id), []);
 assert.deepEqual(searchMembers([member], '  '), []);
});

test('gym and enrolled class check-ins coexist, reject duplicates, and preserve input', () => {
 const db = seed(), member = db.members[0], classId = member.classIds[0];
 const day = '2026-11-04';
 const gym = checkIn(db, member.id, null, day);
 assert.equal(db.attendance.length, 0);
 assert.equal(gym.attendance[0].classId, null);
 assert.throws(() => checkIn(gym, member.id, null, day), /Already checked in/);
 const both = checkIn(gym, member.id, classId, day);
 assert.equal(both.attendance.length, 2);
 assert.throws(() => checkIn(both, member.id, classId, day), /Already checked in/);
 assert.equal(checkIn(both, member.id, null, '2026-11-05').attendance.length, 3);
 assert.throws(() => checkIn(db, 'missing', null, day), /Member not found/);
 assert.throws(() => checkIn(db, member.id, 'missing', day), /enrolled/);
});
