/**
 * Screen E.4 — Paid By sub-screen
 *
 * Toggle between "One person" (single-select list) and
 * "Multiple payers" (amount inputs per person).
 *
 * In edit mode (expenseId set in context): PUTs payments immediately before
 * navigating back, so the main screen doesn't need to do it.
 */
import React, { useState } from 'react';
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { setPayments } from '@/api/expenses';
import { useExpenseForm } from './ExpenseFormContext';

export default function PaidByScreen() {
  const router = useRouter();
  const {
    expenseId,
    members,
    amountText,
    payerMode: mode, setPayerMode: setMode,
    singlePayerId, setSinglePayerId,
    multiPayerAmounts: multiAmounts, setMultiPayerAmounts: setMultiAmounts,
  } = useExpenseForm();

  const isEditMode = expenseId !== null;
  const expenseTotal = Math.round(parseFloat(amountText || '0') * 100);
  const [saving, setSaving] = useState(false);

  const totalEntered = Object.values(multiAmounts).reduce(
    (sum, v) => sum + (parseFloat(v || '0') * 100),
    0,
  );
  const difference = Math.abs(totalEntered - expenseTotal);
  const amountsMatch = difference <= 1;

  function setMultiAmount(userId: number, value: string) {
    setMultiAmounts({ ...multiAmounts, [String(userId)]: value });
  }

  function buildPayments(overridePayerId?: number) {
    if (mode === 'multi') {
      return Object.entries(multiAmounts)
        .filter(([, v]) => parseFloat(v || '0') > 0)
        .map(([userId, v]) => ({
          paid_by: parseInt(userId, 10),
          amount: Math.round(parseFloat(v) * 100),
        }));
    }
    const payerId = overridePayerId ?? singlePayerId;
    return [{ paid_by: payerId, amount: expenseTotal }];
  }

  async function goBack(overridePayerId?: number) {
    if (isEditMode) {
      setSaving(true);
      try {
        await setPayments(expenseId!, buildPayments(overridePayerId));
      } catch {
        Alert.alert('Error', 'Could not update payments');
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    router.back();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} disabled={saving}>
            <Text style={[styles.headerBtn, saving && styles.headerBtnDisabled]}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paid by</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Mode toggle */}
          <View style={styles.segmentWrap}>
            <TouchableOpacity
              style={[styles.segment, mode === 'one' && styles.segmentActive]}
              onPress={() => setMode('one')}
              disabled={saving}
            >
              <Text style={[styles.segmentText, mode === 'one' && styles.segmentTextActive]}>
                One person
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segment, mode === 'multi' && styles.segmentActive]}
              onPress={() => setMode('multi')}
              disabled={saving}
            >
              <Text style={[styles.segmentText, mode === 'multi' && styles.segmentTextActive]}>
                Multiple payers
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'one' ? (
            /* Single payer list — tap selects and goes back (PUT first if edit mode) */
            <View style={styles.listSection}>
              {members.map((member) => {
                const selected = singlePayerId === member.user_id;
                return (
                  <TouchableOpacity
                    key={member.user_id}
                    style={styles.personRow}
                    disabled={saving}
                    onPress={() => {
                      setSinglePayerId(member.user_id);
                      goBack(member.user_id);
                    }}
                  >
                    <Avatar userId={String(member.user_id)} name={member.name} size={32} />
                    <Text style={styles.personName}>{member.name}</Text>
                    {saving && selected ? (
                      <ActivityIndicator size="small" color={Colors.positive} />
                    ) : selected ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            /* Multiple payer amount inputs */
            <View style={styles.listSection}>
              <Text style={styles.helperText}>Leave blank if not a payer</Text>
              {members.map((member) => (
                <View key={member.user_id} style={styles.personRow}>
                  <Avatar userId={String(member.user_id)} name={member.name} size={32} />
                  <Text style={styles.personName}>{member.name}</Text>
                  <View style={styles.amountInputWrap}>
                    <Text style={styles.currencySymbol}>£</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="decimal-pad"
                      value={multiAmounts[String(member.user_id)] ?? ''}
                      onChangeText={(v) => setMultiAmount(member.user_id, v)}
                      editable={!saving}
                    />
                  </View>
                </View>
              ))}

              {/* Reconciliation */}
              <View style={styles.reconcile}>
                <View style={styles.reconcileRow}>
                  <Text style={styles.reconcileLabel}>Total entered</Text>
                  <Text style={styles.reconcileValue}>£{(totalEntered / 100).toFixed(2)}</Text>
                </View>
                <View style={styles.reconcileRow}>
                  <Text style={styles.reconcileLabel}>Expense total</Text>
                  <Text style={styles.reconcileValue}>
                    £{(expenseTotal / 100).toFixed(2)}
                  </Text>
                </View>
                {totalEntered > 0 && (
                  <Text
                    style={[
                      styles.reconcileNote,
                      amountsMatch ? styles.reconcileOk : styles.reconcileWarn,
                    ]}
                  >
                    {amountsMatch
                      ? '✓ Amounts match the total'
                      : `Difference: £${(difference / 100).toFixed(2)}`}
                  </Text>
                )}
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Footer Done button — only in multi-payer mode */}
        {mode === 'multi' && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.doneBtn, (!amountsMatch || saving) && styles.doneBtnDisabled]}
              disabled={!amountsMatch || saving}
              onPress={() => goBack()}
            >
              {saving ? (
                <ActivityIndicator color={Colors.primaryText} />
              ) : (
                <Text style={styles.doneBtnText}>Done</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  headerBtn: { fontSize: 16, color: Colors.text },
  headerBtnDisabled: { color: Colors.textLight },
  headerSpacer: { width: 60 },

  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnDisabled: { backgroundColor: Colors.neutral },
  doneBtnText: { color: Colors.primaryText, fontSize: 17, fontWeight: '700' },

  segmentWrap: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
  },
  segmentActive: { backgroundColor: Colors.primary },
  segmentText: { fontSize: 14, color: Colors.textMuted },
  segmentTextActive: { color: Colors.primaryText, fontWeight: '600' },

  listSection: { paddingHorizontal: 16 },
  helperText: { fontSize: 13, color: Colors.textMuted, marginBottom: 10 },

  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  personName: { flex: 1, fontSize: 16, color: Colors.text },
  checkmark: { fontSize: 18, color: Colors.positive, fontWeight: '700' },

  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 100,
    backgroundColor: Colors.inputBg,
  },
  currencySymbol: { fontSize: 14, color: Colors.textMuted, marginRight: 2 },
  amountInput: { flex: 1, fontSize: 15, color: Colors.text, fontVariant: ['tabular-nums'] },

  reconcile: {
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reconcileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reconcileLabel: { fontSize: 13, color: Colors.textMuted },
  reconcileValue: { fontSize: 13, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] },
  reconcileNote: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  reconcileOk: { color: Colors.positive },
  reconcileWarn: { color: Colors.warning },
});
