/**
 * Screen E.5 — Split method sub-screen
 *
 * Four split modes via a segmented control:
 *   Even    — read-only equal shares
 *   Exact £ — amount per person with remaining tracker
 *   Percent — percentage per person (must sum to 100%)
 *   Shares  — integer share count per person (−/count/+)
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
import { MOCK_GROUP } from '@/constants/mockData';

type SplitMode = 'even' | 'amounts' | 'percent' | 'shares';

// In a real app these would come from form state passed via navigation params.
const PARTICIPANTS = MOCK_GROUP.members;
const EXPENSE_TOTAL = 0; // placeholder

function initialRecord<T>(defaultVal: T) {
  return Object.fromEntries(PARTICIPANTS.map((m) => [m.id, defaultVal])) as Record<string, T>;
}

export default function SplitScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<SplitMode>('even');
  const [amounts, setAmounts] = useState<Record<string, string>>(initialRecord(''));
  const [percents, setPercents] = useState<Record<string, string>>(initialRecord(''));
  const [shares, setShares] = useState<Record<string, number>>(initialRecord(1));

  const count = PARTICIPANTS.length;
  const evenShare = count > 0 ? Math.round(EXPENSE_TOTAL / count) : 0;

  const totalAmounts = Object.values(amounts).reduce(
    (s, v) => s + (parseFloat(v || '0') * 100), 0,
  );
  const remaining = EXPENSE_TOTAL - totalAmounts;
  const amountsMatch = Math.abs(remaining) <= 1;

  const totalPercent = Object.values(percents).reduce(
    (s, v) => s + parseFloat(v || '0'), 0,
  );
  const percentOk = Math.abs(totalPercent - 100) < 0.01;

  const totalShares = Object.values(shares).reduce((s, v) => s + v, 0);

  const MODE_LABELS: { key: SplitMode; label: string }[] = [
    { key: 'even', label: 'Even' },
    { key: 'amounts', label: 'Exact £' },
    { key: 'percent', label: 'Percent' },
    { key: 'shares', label: 'Shares' },
  ];

  function adjustShares(userId: string, delta: number) {
    setShares((prev) => ({
      ...prev,
      [userId]: Math.max(1, (prev[userId] ?? 1) + delta),
    }));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Split method</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.headerBtn, styles.headerBtnPrimary]}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Mode selector */}
        <View style={styles.segmentWrap}>
          {MODE_LABELS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.segment, mode === key && styles.segmentActive]}
              onPress={() => setMode(key)}
            >
              <Text style={[styles.segmentText, mode === key && styles.segmentTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.listSection}>

          {/* ── Even ── */}
          {mode === 'even' && (
            <>
              <Text style={styles.helperText}>
                Each person owes £{(evenShare / 100).toFixed(2)}
              </Text>
              {PARTICIPANTS.map((member) => (
                <View key={member.id} style={styles.personRow}>
                  <Avatar userId={member.id} name={member.name} size={32} />
                  <Text style={styles.personName}>{member.name}</Text>
                  <Text style={styles.readonlyAmount}>
                    £{(evenShare / 100).toFixed(2)}
                  </Text>
                </View>
              ))}
            </>
          )}

          {/* ── Exact amounts ── */}
          {mode === 'amounts' && (
            <>
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
                      value={amounts[member.id]}
                      onChangeText={(v) =>
                        setAmounts((prev) => ({ ...prev, [member.id]: v }))
                      }
                    />
                  </View>
                </View>
              ))}
              <View style={styles.reconcile}>
                <View style={styles.reconcileRow}>
                  <Text style={styles.reconcileLabel}>Remaining to assign</Text>
                  <Text
                    style={[
                      styles.reconcileValue,
                      amountsMatch ? styles.reconcileOk : styles.reconcileWarn,
                    ]}
                  >
                    {remaining >= 0 ? '' : '-'}£{(Math.abs(remaining) / 100).toFixed(2)}
                  </Text>
                </View>
                {amountsMatch && (
                  <Text style={[styles.reconcileNote, styles.reconcileOk]}>
                    ✓ Fully assigned
                  </Text>
                )}
              </View>
            </>
          )}

          {/* ── Percent ── */}
          {mode === 'percent' && (
            <>
              {PARTICIPANTS.map((member) => {
                const pct = parseFloat(percents[member.id] || '0');
                const computed = Math.round((pct / 100) * EXPENSE_TOTAL);
                return (
                  <View key={member.id} style={styles.personRow}>
                    <Avatar userId={member.id} name={member.name} size={32} />
                    <Text style={styles.personName}>{member.name}</Text>
                    <View style={styles.percentWrap}>
                      <TextInput
                        style={styles.percentInput}
                        placeholder="0"
                        placeholderTextColor={Colors.textLight}
                        keyboardType="decimal-pad"
                        value={percents[member.id]}
                        onChangeText={(v) =>
                          setPercents((prev) => ({ ...prev, [member.id]: v }))
                        }
                      />
                      <Text style={styles.percentSign}>%</Text>
                    </View>
                    <Text style={styles.readonlyAmount}>
                      £{(computed / 100).toFixed(2)}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.reconcile}>
                <View style={styles.reconcileRow}>
                  <Text style={styles.reconcileLabel}>Total percentage</Text>
                  <Text
                    style={[
                      styles.reconcileValue,
                      percentOk ? styles.reconcileOk : styles.reconcileWarn,
                    ]}
                  >
                    {totalPercent.toFixed(1)}%
                  </Text>
                </View>
                {percentOk && (
                  <Text style={[styles.reconcileNote, styles.reconcileOk]}>
                    ✓ Adds up to 100%
                  </Text>
                )}
              </View>
            </>
          )}

          {/* ── Shares ── */}
          {mode === 'shares' && (
            <>
              {PARTICIPANTS.map((member) => {
                const s = shares[member.id] ?? 1;
                const computed =
                  totalShares > 0 ? Math.round((s / totalShares) * EXPENSE_TOTAL) : 0;
                return (
                  <View key={member.id} style={styles.personRow}>
                    <Avatar userId={member.id} name={member.name} size={32} />
                    <Text style={styles.personName}>{member.name}</Text>
                    <View style={styles.sharesControl}>
                      <TouchableOpacity
                        style={styles.sharesBtn}
                        onPress={() => adjustShares(member.id, -1)}
                      >
                        <Text style={styles.sharesBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.sharesCount}>{s}</Text>
                      <TouchableOpacity
                        style={styles.sharesBtn}
                        onPress={() => adjustShares(member.id, 1)}
                      >
                        <Text style={styles.sharesBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.readonlyAmount}>
                      £{(computed / 100).toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </>
          )}
        </View>

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
  segmentText: { fontSize: 13, color: Colors.textMuted },
  segmentTextActive: { color: Colors.primaryText, fontWeight: '600' },

  listSection: { paddingHorizontal: 16 },
  helperText: { fontSize: 13, color: Colors.textMuted, marginBottom: 10 },

  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  personName: { flex: 1, fontSize: 15, color: Colors.text },
  readonlyAmount: { fontSize: 15, color: Colors.textMuted, fontVariant: ['tabular-nums'] },

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
  amountInput: { flex: 1, fontSize: 14, color: Colors.text, fontVariant: ['tabular-nums'] },

  percentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 70,
    backgroundColor: Colors.inputBg,
  },
  percentInput: { flex: 1, fontSize: 14, color: Colors.text },
  percentSign: { fontSize: 14, color: Colors.textMuted },

  sharesControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  sharesBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.inputBg,
  },
  sharesBtnText: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sharesCount: {
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },

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
    marginBottom: 4,
  },
  reconcileLabel: { fontSize: 13, color: Colors.textMuted },
  reconcileValue: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  reconcileNote: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  reconcileOk: { color: Colors.positive },
  reconcileWarn: { color: Colors.warning },
});
