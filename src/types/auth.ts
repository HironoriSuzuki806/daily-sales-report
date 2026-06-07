import type { Role } from '@/types/index';

/** Minimal user shape surfaced to layout components. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId?: string;
};
