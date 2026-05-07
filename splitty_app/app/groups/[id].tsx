/**
 * Screen G — Group Summary
 *
 * Fetches three endpoints in parallel:
 *   GET /groups/:id          → group name + members
 *   GET /groups/:id/expenses → paginated expense list
 *   GET /groups/:id/balances → per-member net balances
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { DEV_USER_ID } from '@/constants/config';
import {
  getGroup,
  getGroupExpenses,
  getGroupBalances,
  type GroupDetail,
  type ExpenseSummary,
  type Balance,
} from '@/api/groups';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(minorUnits: number, currency = 'GBP') {
  const symbol = currency === 'GBP' ? '£' : currency;
  return `${symbol}${(minorUnits / 100).toFixed(2)}`;
}

function formatBalance(minorUnits: number) {
  const abs = (Math.abs(minorUnits) / 100).toFixed(2);
  return minorUnits >= 0 ? `+£${abs}` : `-£${abs}`;
}

function dateLabel(isoDate: string): string {
  const d = new Date(isoDate);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function groupExpensesByDate(expenses: ExpenseSummary[]) {
  const map = new Map<string, ExpenseSummary[]>();
  for (const e of expenses) {
    const label = dateLabel(e.created_at);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(e);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

// Greedy minimum-transactions settlement from a list of net balances.
interface Settlement {
  fromUserId: number;
  fromName: string;
  toUserId: number;
  toName: string;
  amount: number;
}

function computeSettlements(balances: Balance[]): Settlement[] {
  const creditors = balances
    .filter((b) => b.net_balance > 0)
    .map((b) => ({ ...b, remaining: b.net_balance }));
  const debtors = balances
    .filter((b) => b.net_balance < 0)
    .map((b) => ({ ...b, remaining: -b.net_balance }));

  const suggestions: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].remaining, creditors[j].remaining);
    if (amount > 0) {
      suggestions.push({
        fromUserId: debtors[i].user_id,
        fromName: debtors[i].name,
        toUserId: creditors[j].user_id,
        toName: creditors[j].name,
        amount,
      });
    }
    debtors[i].remaining -= amount;
    creditors[j].remaining -= amount;
    if (debtors[i].remaining === 0) i++;
    if (creditors[j].remaining === 0) j++;
  }

  return suggestions;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeroHeader({
  group,
  expenses,
  balances,
  onBack,
}: {
  group: GroupDetail;
  expenses: ExpenseSummary[];
  balances: Balance[];
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();

  const groupTotal = expenses.reduce((sum, e) => sum + e.total_amount, 0);
  const myBalance = balances.find((b) => b.user_id === DEV_USER_ID)?.net_balance ?? 0;
  const balanceColor = myBalance >= 0 ? Colors.positiveOnDark : Colors.negativeOnDark;

  return (
    <View style={[styles.hero, { paddingTop: insets.top }]}>
      <View style={styles.heroNav}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.heroNavBtn}>← Groups</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.heroNavBtn}>⋯</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.heroTitle}>{group.name}</Text>
      <Text style={styles.heroSubtitle}>
        {group.members.map((m) => m.name).join(', ')} · {expenses.length} expenses
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Group total</Text>
          <Text style={styles.statValue}>{formatAmount(groupTotal)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Your balance</Text>
          <Text style={[styles.statValue, { color: balanceColor }]}>
            {formatBalance(myBalance)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function TabBar({
  active,
  onChange,
}: {
  active: 'expenses' | 'balances';
  onChange: (tab: 'expenses' | 'balances') => void;
}) {
  return (
    <View style={styles.tabBar}>
      {(['expenses', 'balances'] as const).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, active === tab && styles.tabActive]}
          onPress={() => onChange(tab)}
        >
          <Text style={[styles.tabLabel, active === tab && styles.tabLabelActive]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ExpenseRow({
  expense,
  members,
  onPress,
}: {
  expense: ExpenseSummary;
  members: GroupDetail['members'];
  onPress: () => void;
}) {
  const creator = members.find((m) => m.user_id === expense.created_by);

  return (
    <TouchableOpacity style={styles.expenseRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.expenseIcon}>
        <Text style={styles.expenseTypeIcon}>{expense.type === 'itemised' ? '🧾' : '💸'}</Text>
      </View>
      <View style={styles.expenseMiddle}>
        <Text style={styles.expenseDesc} numberOfLines={1}>
          {expense.title}
        </Text>
        <View style={styles.expenseMetaRow}>
          {creator && (
            <Avatar userId={String(creator.user_id)} name={creator.name} size={16} />
          )}
          <Text style={styles.expenseMeta}>
            {' '}{creator?.name ?? '?'} paid · {dateLabel(expense.created_at)}
          </Text>
        </View>
      </View>
      <Text style={styles.expenseAmount}>
        {formatAmount(expense.total_amount, expense.currency)}
      </Text>
    </TouchableOpacity>
  );
}

function ExpensesTab({
  expenses,
  members,
  groupId,
}: {
  expenses: ExpenseSummary[];
  members: GroupDetail['members'];
  groupId: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase());
      // Without participant data in the summary, "Includes me" filters by creator.
      const matchesFilter = filter === 'all' || e.created_by === DEV_USER_ID;
      return matchesSearch && matchesFilter;
    });
  }, [expenses, search, filter]);

  const sections = groupExpensesByDate(filtered);

  return (
    <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search expenses…"
          placeholderTextColor={Colors.textLight}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterRow}>
        {(['all', 'mine'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All expenses' : 'Includes me'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {sections.length === 0 && (
        <Text style={styles.emptyText}>No expenses found.</Text>
      )}

      {sections.map(({ label, items }) => (
        <View key={label}>
          <Text style={styles.sectionHeader}>{label.toUpperCase()}</Text>
          {items.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              members={members}
              onPress={() => router.push(`/expense/${groupId}?expenseId=${e.id}`)}
            />
          ))}
        </View>
      ))}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

function BalancesTab({ balances }: { balances: Balance[] }) {
  const maxAbs = Math.max(...balances.map((b) => Math.abs(b.net_balance)), 1);
  const settlements = useMemo(() => computeSettlements(balances), [balances]);

  return (
    <ScrollView style={styles.tabContent}>
      {balances.map((balance) => {
        const isMe = balance.user_id === DEV_USER_ID;
        const isPositive = balance.net_balance > 0;
        const isZero = balance.net_balance === 0;
        const barWidth = (Math.abs(balance.net_balance) / maxAbs) * 100;
        const amountColor = isZero
          ? Colors.neutral
          : isPositive
          ? Colors.positive
          : Colors.negative;

        return (
          <View key={balance.user_id} style={styles.balanceRow}>
            <Avatar userId={String(balance.user_id)} name={balance.name} size={36} />
            <View style={styles.balanceMeta}>
              <Text style={styles.balanceName}>
                {balance.name}
                {isMe ? <Text style={styles.youTag}> (you)</Text> : null}
              </Text>
              {!isZero && (
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${barWidth}%`,
                        backgroundColor: isPositive ? Colors.positive : Colors.negative,
                      },
                    ]}
                  />
                </View>
              )}
            </View>
            <Text style={[styles.balanceAmount, { color: amountColor }]}>
              {isZero ? '—' : formatBalance(balance.net_balance)}
            </Text>
          </View>
        );
      })}

      {settlements.length > 0 && (
        <>
          <Text style={styles.settlementHeader}>Suggested settlements</Text>
          {settlements.map((s, i) => (
            <View key={i} style={styles.settlementRow}>
              <Avatar userId={String(s.fromUserId)} name={s.fromName} size={24} />
              <Text style={styles.settlementText}>
                {s.fromName} → {s.toName}
              </Text>
              <Text style={styles.settlementAmount}>{formatAmount(s.amount)}</Text>
              <TouchableOpacity style={styles.settleBtn}>
                <Text style={styles.settleBtnText}>Settle</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);

  const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<ExpenseSummary[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      getGroup(groupId),
      getGroupExpenses(groupId),
      getGroupBalances(groupId),
    ])
      .then(([g, page, b]) => {
        setGroup(g);
        setExpenses(page.items);
        setBalances(b);
      })
      .catch((e) => setError(e.message ?? 'Failed to load group'))
      .finally(() => setLoading(false));
  }

  useFocusEffect(useCallback(() => { load(); }, [groupId]));

  if (loading) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !group) {
    return (
      <View style={styles.centred}>
        <Text style={styles.errorText}>{error ?? 'Group not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <HeroHeader
        group={group}
        expenses={expenses}
        balances={balances}
        onBack={() => router.back()}
      />
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'expenses' ? (
        <ExpensesTab expenses={expenses} members={group.members} groupId={groupId} />
      ) : (
        <BalancesTab balances={balances} />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/expense/${groupId}`)}
      >
        <Text style={styles.fabText}>＋ New expense</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: 15, color: Colors.negative, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderStrong },
  retryBtnText: { fontSize: 15, fontWeight: '600', color: Colors.text },

  // Hero
  hero: { backgroundColor: Colors.heroBg, paddingHorizontal: 16, paddingBottom: 20 },
  heroNav: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 8 },
  heroNavBtn: { color: Colors.heroText, fontSize: 16 },
  heroTitle: { color: Colors.heroText, fontSize: 26, fontWeight: '700', marginTop: 4 },
  heroSubtitle: { color: Colors.heroMuted, fontSize: 13, marginTop: 4 },
  statsRow: { flexDirection: 'row', marginTop: 16, gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.heroCardBg,
    borderWidth: 1,
    borderColor: Colors.heroCardBorder,
    borderRadius: 8,
    padding: 12,
  },
  statLabel: { color: Colors.heroMuted, fontSize: 12, marginBottom: 4 },
  statValue: { color: Colors.heroText, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.tabActive },
  tabLabel: { fontSize: 14, color: Colors.tabInactive },
  tabLabelActive: { color: Colors.tabActive, fontWeight: '600' },

  // Tab content
  tabContent: { flex: 1 },

  // Search
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },

  // Filter chips
  filterRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.chipUnselected },
  filterChipActive: { backgroundColor: Colors.chipSelected },
  filterChipText: { fontSize: 13, color: Colors.chipUnselectedText },
  filterChipTextActive: { color: Colors.chipSelectedText, fontWeight: '600' },

  // Section headers
  sectionHeader: { fontSize: 11, fontWeight: '600', color: Colors.sectionHeader, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, letterSpacing: 0.5 },

  // Expense rows
  expenseRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  expenseIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  expenseTypeIcon: { fontSize: 20 },
  expenseMiddle: { flex: 1, marginRight: 8 },
  expenseDesc: { fontSize: 15, fontWeight: '600', color: Colors.text },
  expenseMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  expenseMeta: { fontSize: 12, color: Colors.textMuted },
  expenseAmount: { fontSize: 15, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] },
  emptyText: { textAlign: 'center', color: Colors.textMuted, fontSize: 15, paddingTop: 40 },

  // Balance rows
  balanceRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  balanceMeta: { flex: 1, marginLeft: 12, marginRight: 8 },
  balanceName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  youTag: { fontSize: 13, color: Colors.textMuted, fontWeight: '400' },
  barTrack: { height: 4, backgroundColor: Colors.border, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  balanceAmount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Settlements
  settlementHeader: { fontSize: 13, fontWeight: '600', color: Colors.sectionHeader, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  settlementRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  settlementText: { flex: 1, fontSize: 14, color: Colors.text },
  settlementAmount: { fontSize: 14, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] },
  settleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: Colors.borderStrong },
  settleBtnText: { fontSize: 13, fontWeight: '600', color: Colors.text },

  // FAB
  fab: { position: 'absolute', bottom: 28, right: 20, backgroundColor: Colors.fab, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  fabText: { color: Colors.fabText, fontWeight: '700', fontSize: 15 },
});
