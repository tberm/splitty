import { api } from './client';

// ─── Response types (mirror the OpenAPI schemas) ─────────────────────────────

export interface GroupListItem {
  id: number;
  name: string;
  created_by: number;
  created_at: string;
  member_count: number;
}

export interface GroupMember {
  user_id: number;
  name: string;
  email: string;
  joined_at: string;
}

export interface GroupDetail {
  id: number;
  name: string;
  created_by: number;
  created_at: string;
  members: GroupMember[];
}

export interface ExpenseSummary {
  id: number;
  title: string;
  currency: string;
  total_amount: number;   // minor units
  created_by: number;
  created_at: string;
  type: 'simple' | 'itemised';
}

export interface PaginatedExpenses {
  items: ExpenseSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface Balance {
  user_id: number;
  name: string;
  net_balance: number;    // minor units, positive = owed to them
}

// ─── API functions ────────────────────────────────────────────────────────────

export function listGroups(): Promise<GroupListItem[]> {
  return api.get<GroupListItem[]>('/api/v1/groups');
}

export function getGroup(groupId: number): Promise<GroupDetail> {
  return api.get<GroupDetail>(`/api/v1/groups/${groupId}`);
}

export function getGroupExpenses(groupId: number, pageSize = 100): Promise<PaginatedExpenses> {
  return api.get<PaginatedExpenses>(`/api/v1/groups/${groupId}/expenses?page_size=${pageSize}`);
}

export function getGroupBalances(groupId: number): Promise<Balance[]> {
  return api.get<Balance[]>(`/api/v1/groups/${groupId}/balances`);
}
