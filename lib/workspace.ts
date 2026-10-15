import type { Database } from '@/types';

export function emptyDatabase(): Database {
  return { branches: [], plans: [], classes: [], members: [], memberships: [], payments: [], renewals: [], attendance: [], staff: [] };
}
