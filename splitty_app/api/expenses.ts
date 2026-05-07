import { api } from './client';

// ─── Shared input/output types ────────────────────────────────────────────────

export interface PaymentIn {
  paid_by: number;
  amount: number;
}

export interface PaymentOut {
  id: number;
  paid_by: number;
  amount: number;
  paid_at: string;
  notes: string | null;
}

export interface ParticipantOut {
  user_id: number;
  name: string;
  acknowledged: boolean;
}

export interface SimpleExpenseDetail {
  id: number;
  group_id: number;
  title: string;
  notes: string | null;
  currency: string;
  total_amount: number;
  created_by: number;
  created_at: string;
  has_receipt: boolean;
  payments: PaymentOut[];
  participants: ParticipantOut[];
  type: 'simple';
  split_method: 'even' | 'explicit';
}

export interface CreateSimpleExpenseIn {
  type: 'simple';
  title: string;
  notes?: string | null;
  currency: string;
  total_amount: number;
  payments: PaymentIn[];
  participant_ids?: number[] | null;
  split_method: 'even' | 'explicit';
}

export interface UpdateSimpleExpenseIn {
  type: 'simple';
  title?: string | null;
  notes?: string | null;
  currency?: string | null;
  total_amount?: number | null;
  split_method?: 'even' | 'explicit' | null;
}

// ─── API functions ────────────────────────────────────────────────────────────

export function createExpense(
  groupId: number,
  body: CreateSimpleExpenseIn,
): Promise<SimpleExpenseDetail> {
  return api.post<SimpleExpenseDetail>(`/api/v1/groups/${groupId}/expenses`, body);
}

export function getExpense(expenseId: number): Promise<SimpleExpenseDetail> {
  return api.get<SimpleExpenseDetail>(`/api/v1/expenses/${expenseId}`);
}

export function updateExpense(
  expenseId: number,
  body: UpdateSimpleExpenseIn,
): Promise<SimpleExpenseDetail> {
  return api.put<SimpleExpenseDetail>(`/api/v1/expenses/${expenseId}`, body);
}

export function setPayments(
  expenseId: number,
  payments: PaymentIn[],
): Promise<PaymentOut[]> {
  return api.put<PaymentOut[]>(`/api/v1/expenses/${expenseId}/payments`, payments);
}

export function setParticipants(
  expenseId: number,
  participantIds: number[],
): Promise<ParticipantOut[]> {
  return api.put<ParticipantOut[]>(`/api/v1/expenses/${expenseId}/participants`, participantIds);
}
