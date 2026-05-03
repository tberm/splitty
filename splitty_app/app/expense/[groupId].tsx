/**
 * Screen E.1 — Add/Edit Expense (main screen)
 *
 * Sections:
 *   - Who's involved (participant chips)
 *   - Description (text input)
 *   - Amount (currency pill + numeric input, receipt button)
 *   - Paid by (tappable summary row → E.4)
 *   - Split method (tappable summary row → E.5)
 * Footer: "Save Expense" button
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { MOCK_GROUP, CURRENT_USER_ID } from '@/constants/mockData';

function formatAmount(minorUnits: number, currency = 'GBP') {
  const symbol = currency === 'GBP' ? '£' : '$';
  return `${symbol}${(minorUnits / 100).toFixed(2)}`;
}

export default function AddExpenseScreen() {
  const router = useRouter();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [currency] = useState('GBP');
  const [participantIds, setParticipantIds] = useState<string[]>(
    MOCK_GROUP.members.map((m) => m.id), // all members selected by default
  );
  const [itemCount] = useState(0); // set when items are added (E.3 flow)

  // Derived
  const amountMinorUnits = Math.round(parseFloat(amountText || '0') * 100);
  const payer = MOCK_GROUP.members.find((m) => m.id === CURRENT_USER_ID);
  const splitCount = participantIds.length || 1;
  const sharePerPerson = splitCount > 0 ? Math.round(amountMinorUnits / splitCount) : 0;

  const canSave = description.trim().length > 0 && amountMinorUnits > 0 && participantIds.length > 0;

  // ── Participant chip toggle ──────────────────────────────────────────────────
  function toggleParticipant(userId: string) {
    setParticipantIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
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
          <Text style={styles.headerTitle}>Add Expense</Text>
          <TouchableOpacity disabled={!canSave}>
            <Text style={[styles.headerBtn, styles.headerBtnPrimary, !canSave && styles.headerBtnDisabled]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Section: Who's involved ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Who's involved</Text>
            <View style={styles.chipWrap}>
              {MOCK_GROUP.members.map((member) => {
                const selected = participantIds.includes(member.id);
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleParticipant(member.id)}
                  >
                    <Avatar userId={member.id} name={member.name} size={24} />
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {member.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {/* "+ Add" chip (out of scope, visual placeholder only) */}
              <TouchableOpacity style={[styles.chip, styles.chipAdd]}>
                <Text style={styles.chipAddText}>+ Add</Text>
              </TouchableOpacity>
            </View>
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
              {/* Currency pill */}
              <TouchableOpacity style={styles.currencyPill}>
                <Text style={styles.currencyPillText}>
                  {currency === 'GBP' ? '£' : '$'} {currency}
                </Text>
              </TouchableOpacity>
              {/* Amount input */}
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textLight}
                keyboardType="decimal-pad"
                value={amountText}
                onChangeText={setAmountText}
              />
            </View>
            {/* Receipt button */}
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
                {payer && <Avatar userId={payer.id} name={payer.name} size={28} />}
                <Text style={styles.summaryRowText}>
                  {payer?.name ?? 'Unknown'}
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
          >
            <Text style={styles.saveBtnText}>Save Expense</Text>
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

  // Participant chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.chipUnselected,
  },
  chipSelected: { backgroundColor: Colors.chipSelected },
  chipText: { fontSize: 14, color: Colors.chipUnselectedText },
  chipTextSelected: { color: Colors.chipSelectedText, fontWeight: '600' },
  chipAdd: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.borderStrong,
    backgroundColor: 'transparent',
  },
  chipAddText: { fontSize: 14, color: Colors.textMuted },

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
