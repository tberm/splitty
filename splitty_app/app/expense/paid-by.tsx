/**
 * Screen E.4 — Paid By sub-screen
 *
 * Toggle between "One person" (single-select list) and
 * "Multiple payers" (amount inputs per person).
 * Shows a running total + reconciliation note.
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { MOCK_GROUP, CURRENT_USER_ID } from '@/constants/mockData';

// In a real app these would come from form state passed via navigation params.
const PARTICIPANTS = MOCK_GROUP.members;
const EXPENSE_TOTAL = 0; // placeholder

export default function PaidByScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'one' | 'multi'>('one');
  const [singlePayerId, setSinglePayerId] = useState(CURRENT_USER_ID);
  const [multiAmounts, setMultiAmounts] = useState<Record<string, string>>({});

  const totalEntered = Object.values(multiAmounts).reduce(
    (sum, v) => sum + (parseFloat(v || '0') * 100),
    0,
  );
  const difference = Math.abs(totalEntered - EXPENSE_TOTAL);
  const amountsMatch = difference <= 1;

  function setMultiAmount(userId: string, value: string) {
    setMultiAmounts((prev) => ({ ...prev, [userId]: value }));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paid by</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.headerBtn, styles.headerBtnPrimary]}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Mode toggle */}
        <View style={styles.segmentWrap}>
          <TouchableOpacity
            style={[styles.segment, mode === 'one' && styles.segmentActive]}
            onPress={() => setMode('one')}
          >
            <Text style={[styles.segmentText, mode === 'one' && styles.segmentTextActive]}>
              One person
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, mode === 'multi' && styles.segmentActive]}
            onPress={() => setMode('multi')}
          >
            <Text style={[styles.segmentText, mode === 'multi' && styles.segmentTextActive]}>
              Multiple payers
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'one' ? (
          /* Single payer list */
          <View style={styles.listSection}>
            {PARTICIPANTS.map((member) => {
              const selected = singlePayerId === member.id;
              return (
                <TouchableOpacity
                  key={member.id}
                  style={styles.personRow}
                  onPress={() => setSinglePayerId(member.id)}
                >
                  <Avatar userId={member.id} name={member.name} size={32} />
                  <Text style={styles.personName}>{member.name}</Text>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* Multiple payer amount inputs */
          <View style={styles.listSection}>
            <Text style={styles.helperText}>Leave blank if not a payer</Text>
            {PARTICIPANTS.map((member) => (
              <View key={member.id} style={styles.personRow}>
                <Avatar userId={member.id} name={member.name} size={32} />
                <Text style={styles.personName}>{member.name}</Text>
                <View style={styles.amountInputWrap}>
                  <Text style={styles.currencySymbol}>£</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="decimal-pad"
                    value={multiAmounts[member.id] ?? ''}
                    onChangeText={(v) => setMultiAmount(member.id, v)}
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
                  £{(EXPENSE_TOTAL / 100).toFixed(2)}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
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
  headerBtnPrimary: { fontWeight: '700' },

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
