/**
 * Screen E.1 — Add/Edit Expense (main screen)
 *
 * Create mode: POST /groups/:groupId/expenses on Save.
 * Edit mode:   PUT  /expenses/:expenseId         on Save (title/amount/currency/split).
 *              Sub-screens (paid-by, who's involved) fire their own PUTs immediately.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { getGroup } from '@/api/groups';
import {
  createExpense,
  getExpense,
  updateExpense,
  setParticipants,
} from '@/api/expenses';
import { useExpenseForm } from './ExpenseFormContext';

const MAX_FACEPILE = 4;

function ParticipantFacepile({
  members,
  selectedIds,
}: {
  members: { userId: string; name: string }[];
  selectedIds: number[];
}) {
  const selected = members.filter((m) => selectedIds.includes(parseInt(m.userId, 10)));
  const visible = selected.slice(0, MAX_FACEPILE);
  const overflow = selected.length - visible.length;
  const AVATAR_SIZE = 28;
  const OVERLAP = 10;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
      {visible.map((m, i) => (
        <View
          key={m.userId}
          style={{
            marginLeft: i === 0 ? 0 : -OVERLAP,
            zIndex: visible.length - i,
            borderRadius: AVATAR_SIZE / 2,
            borderWidth: 2,
            borderColor: Colors.inputBg,
          }}
        >
          <Avatar userId={m.userId} name={m.name} size={AVATAR_SIZE} />
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={{
            marginLeft: -OVERLAP,
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
            backgroundColor: Colors.chipUnselected,
            borderWidth: 2,
            borderColor: Colors.inputBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textMuted }}>
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}

function formatAmount(minorUnits: number, currency = 'GBP') {
  const symbol = currency === 'GBP' ? '£' : '$';
  return `${symbol}${(minorUnits / 100).toFixed(2)}`;
}

export default function AddExpenseScreen() {
  const router = useRouter();
  const { groupId: groupIdParam, expenseId: expenseIdParam } =
    useLocalSearchParams<{ groupId: string; expenseId?: string }>();
  const groupId = parseInt(groupIdParam ?? '0', 10);
  const expenseId = expenseIdParam ? parseInt(expenseIdParam, 10) : null;
  const isEditMode = expenseId !== null;

  // ── Shared form state ────────────────────────────────────────────────────────
  const {
    members, setMembers,
    amountText, setAmountText,
    payerMode, setPayerMode,
    singlePayerId, setSinglePayerId,
    multiPayerAmounts, setMultiPayerAmounts,
    setExpenseId,
  } = useExpenseForm();

  // ── Local form state ─────────────────────────────────────────────────────────
  const [description, setDescription] = useState('');
  const [currency] = useState('GBP');
  const [participantIds, setParticipantIds] = useState<number[]>([]);
  const [itemCount] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingParticipants, setSavingParticipants] = useState(false);

  // ── Load data on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    setExpenseId(expenseId);

    const groupPromise = getGroup(groupId);
    const expensePromise = isEditMode ? getExpense(expenseId!) : Promise.resolve(null);

    Promise.all([groupPromise, expensePromise])
      .then(([group, expense]) => {
        setMembers(group.members);

        if (expense) {
          // Edit mode: pre-populate from fetched expense
          setDescription(expense.title);
          setAmountText((expense.total_amount / 100).toFixed(2));
          setParticipantIds(expense.participants.map((p) => p.user_id));

          if (expense.payments.length === 1) {
            setPayerMode('one');
            setSinglePayerId(expense.payments[0].paid_by);
          } else if (expense.payments.length > 1) {
            setPayerMode('multi');
            const amounts: Record<string, string> = {};
            for (const p of expense.payments) {
              amounts[String(p.paid_by)] = (p.amount / 100).toFixed(2);
            }
            setMultiPayerAmounts(amounts);
          }
        } else {
          // Create mode: all members selected by default
          setParticipantIds(group.members.map((m) => m.user_id));
        }
      })
      .catch(() => Alert.alert('Error', 'Could not load expense data'))
      .finally(() => setLoading(false));
  }, [groupId, expenseId]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const amountMinorUnits = Math.round(parseFloat(amountText || '0') * 100);
  const memberItems = members.map((m) => ({ userId: String(m.user_id), name: m.name }));
  const singlePayer = members.find((m) => m.user_id === singlePayerId);
  const splitCount = participantIds.length || 1;
  const sharePerPerson = splitCount > 0 ? Math.round(amountMinorUnits / splitCount) : 0;
  const canSave =
    description.trim().length > 0 && amountMinorUnits > 0 && participantIds.length > 0 && !saving;

  // ── Participant toggle ───────────────────────────────────────────────────────
  function toggleParticipant(userId: number) {
    setParticipantIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  // ── Close participant picker (PUT immediately in edit mode) ──────────────────
  async function closeParticipantPicker() {
    if (isEditMode) {
      setSavingParticipants(true);
      try {
        await setParticipants(expenseId!, participantIds);
      } catch {
        Alert.alert('Error', 'Could not update participants');
      } finally {
        setSavingParticipants(false);
      }
    }
    setPickerVisible(false);
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      if (isEditMode) {
        await updateExpense(expenseId!, {
          type: 'simple',
          title: description.trim(),
          currency,
          total_amount: amountMinorUnits,
          split_method: 'even',
        });
      } else {
        const payments =
          payerMode === 'one'
            ? [{ paid_by: singlePayerId, amount: amountMinorUnits }]
            : Object.entries(multiPayerAmounts)
                .filter(([, v]) => parseFloat(v || '0') > 0)
                .map(([userId, v]) => ({
                  paid_by: parseInt(userId, 10),
                  amount: Math.round(parseFloat(v) * 100),
                }));

        await createExpense(groupId, {
          type: 'simple',
          title: description.trim(),
          currency,
          total_amount: amountMinorUnits,
          payments,
          participant_ids: participantIds,
          split_method: 'even',
        });
      }
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  }

  // ── Loading screen (edit mode only — fields need pre-population) ─────────────
  if (loading && isEditMode) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header bar ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.headerBtn}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Expense' : 'Add Expense'}</Text>
          <TouchableOpacity disabled={!canSave} onPress={handleSave}>
            {saving ? (
              <ActivityIndicator size="small" color={Colors.text} />
            ) : (
              <Text style={[styles.headerBtn, styles.headerBtnPrimary, !canSave && styles.headerBtnDisabled]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Member picker modal ── */}
        <Modal
          visible={pickerVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeParticipantPicker}
        >
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Who's involved?</Text>
              <TouchableOpacity
                onPress={closeParticipantPicker}
                disabled={savingParticipants}
              >
                {savingParticipants ? (
                  <ActivityIndicator size="small" color={Colors.text} />
                ) : (
                  <Text style={styles.modalDone}>Done</Text>
                )}
              </TouchableOpacity>
            </View>
            <FlatList
              data={members}
              keyExtractor={(m) => String(m.user_id)}
              renderItem={({ item }) => {
                const selected = participantIds.includes(item.user_id);
                return (
                  <TouchableOpacity
                    style={styles.memberRow}
                    onPress={() => toggleParticipant(item.user_id)}
                    disabled={savingParticipants}
                  >
                    <Avatar userId={String(item.user_id)} name={item.name} size={36} />
                    <Text style={styles.memberName}>{item.name}</Text>
                    <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                      {selected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </SafeAreaView>
        </Modal>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Section: Who's involved ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Who's involved</Text>
            {loading ? (
              <ActivityIndicator style={{ marginVertical: 16 }} />
            ) : (
              <TouchableOpacity
                style={styles.summaryRow}
                onPress={() => setPickerVisible(true)}
              >
                <View style={styles.summaryRowLeft}>
                  <ParticipantFacepile
                    members={memberItems}
                    selectedIds={participantIds}
                  />
                  <Text style={styles.summaryRowText}>
                    {participantIds.length === 0
                      ? 'No one selected'
                      : participantIds.length === members.length
                      ? 'Everyone'
                      : `${participantIds.length} people`}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Section: Description ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Dinner at Nobu"
              placeholderTextColor={Colors.textLight}
              value={description}
              onChangeText={setDescription}
              returnKeyType="done"
            />
          </View>

          {/* ── Section: Amount ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Amount</Text>
            <View style={styles.amountRow}>
              <TouchableOpacity style={styles.currencyPill}>
                <Text style={styles.currencyPillText}>
                  {currency === 'GBP' ? '£' : '$'} {currency}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textLight}
                keyboardType="decimal-pad"
                value={amountText}
                onChangeText={setAmountText}
              />
            </View>
            <TouchableOpacity
              style={styles.receiptBtn}
              onPress={() => router.push('/expense/items')}
            >
              <Text style={styles.receiptBtnText}>
                {itemCount > 0
                  ? `${itemCount} items · ${formatAmount(amountMinorUnits)}`
                  : '🧾  Add items from receipt'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Section: Paid by ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Paid by</Text>
            <TouchableOpacity
              style={styles.summaryRow}
              onPress={() => router.push('/expense/paid-by')}
            >
              <View style={styles.summaryRowLeft}>
                {payerMode === 'one' && singlePayer && (
                  <Avatar userId={String(singlePayer.user_id)} name={singlePayer.name} size={28} />
                )}
                <Text style={styles.summaryRowText}>
                  {payerMode === 'multi'
                    ? 'Multiple payers'
                    : (singlePayer?.name ?? 'Unknown')}
                  {amountMinorUnits > 0 ? ` · ${formatAmount(amountMinorUnits, currency)}` : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <Text style={styles.helperText}>Tap to change who paid or split the bill</Text>
          </View>

          {/* ── Section: Split method ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Split method</Text>
            <TouchableOpacity
              style={styles.summaryRow}
              onPress={() => router.push('/expense/split')}
            >
              <View style={styles.summaryRowLeft}>
                <Text style={styles.summaryIcon}>⚖️</Text>
                <Text style={styles.summaryRowText}>
                  Even ÷ {splitCount}
                  {sharePerPerson > 0 ? ` · ${formatAmount(sharePerPerson, currency)} each` : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <Text style={styles.helperText}>Tap to customise the split</Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── Footer: Save button ── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            disabled={!canSave}
            onPress={handleSave}
          >
            {saving ? (
              <ActivityIndicator color={Colors.primaryText} />
            ) : (
              <Text style={styles.saveBtnText}>
                {isEditMode ? 'Save Changes' : 'Save Expense'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  headerBtn: { fontSize: 16, color: Colors.text },
  headerBtnPrimary: { fontWeight: '700' },
  headerBtnDisabled: { color: Colors.textLight },

  // Sections
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  // Member picker modal
  modalSafe: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  modalDone: { fontSize: 16, fontWeight: '700', color: Colors.text },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  memberName: { flex: 1, fontSize: 16, color: Colors.text },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: { fontSize: 13, fontWeight: '700', color: '#fff' },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 64 },

  // Description
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.inputBg,
    marginBottom: 12,
  },

  // Amount
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  currencyPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.chipUnselected,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencyPillText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'right',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.inputBg,
  },

  // Receipt button
  receiptBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.borderStrong,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  receiptBtnText: { fontSize: 14, color: Colors.textMuted },

  // Summary rows (Paid by, Split method)
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.inputBg,
    marginBottom: 6,
  },
  summaryRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  summaryIcon: { fontSize: 20 },
  summaryRowText: { fontSize: 15, color: Colors.text, flex: 1 },
  chevron: { fontSize: 20, color: Colors.textLight },
  helperText: { fontSize: 12, color: Colors.textMuted, marginBottom: 12 },

  // Footer
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: Colors.neutral },
  saveBtnText: { color: Colors.primaryText, fontSize: 17, fontWeight: '700' },
});
