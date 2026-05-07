import React, { createContext, useContext, useState } from 'react';
import { DEV_USER_ID } from '@/constants/config';
import type { GroupMember } from '@/api/groups';

interface ExpenseFormCtx {
  // null = create mode, number = edit mode
  expenseId: number | null;
  setExpenseId: (id: number | null) => void;

  // Loaded from API once the expense screen mounts
  members: GroupMember[];
  setMembers: (m: GroupMember[]) => void;

  amountText: string;
  setAmountText: (v: string) => void;

  payerMode: 'one' | 'multi';
  setPayerMode: (m: 'one' | 'multi') => void;

  // Integer user_id matching the API
  singlePayerId: number;
  setSinglePayerId: (id: number) => void;

  // Keyed by String(user_id)
  multiPayerAmounts: Record<string, string>;
  setMultiPayerAmounts: (a: Record<string, string>) => void;
}

const ExpenseFormContext = createContext<ExpenseFormCtx | null>(null);

export function ExpenseFormProvider({ children }: { children: React.ReactNode }) {
  const [expenseId, setExpenseId] = useState<number | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [amountText, setAmountText] = useState('');
  const [payerMode, setPayerMode] = useState<'one' | 'multi'>('one');
  const [singlePayerId, setSinglePayerId] = useState<number>(DEV_USER_ID);
  const [multiPayerAmounts, setMultiPayerAmounts] = useState<Record<string, string>>({});

  return (
    <ExpenseFormContext.Provider
      value={{
        expenseId, setExpenseId,
        members, setMembers,
        amountText, setAmountText,
        payerMode, setPayerMode,
        singlePayerId, setSinglePayerId,
        multiPayerAmounts, setMultiPayerAmounts,
      }}
    >
      {children}
    </ExpenseFormContext.Provider>
  );
}

export function useExpenseForm() {
  const ctx = useContext(ExpenseFormContext);
  if (!ctx) throw new Error('useExpenseForm must be used within ExpenseFormProvider');
  return ctx;
}
