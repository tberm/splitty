/**
 * Screen E.3 — Items sub-screen
 *
 * Allows the user to photograph a receipt or manually add line items.
 * Three states for the receipt zone: empty | scanning | done.
 * Line items are editable. Footer shows reconciliation vs expense total.
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

interface LineItem {
  id: string;
  name: string;
  amount: string; // raw text input, e.g. "12.50"
}

export default function ItemsScreen() {
  const router = useRouter();
  const [scanState] = useState<'empty' | 'scanning' | 'done'>('empty');
  const [items, setItems] = useState<LineItem[]>([]);

  // These would come from the parent form in a real app.
  // For the mockup we use a placeholder value.
  const expenseTotal = 0;

  const itemsTotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.amount || '0') * 100);
  }, 0);

  const difference = itemsTotal - expenseTotal;

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: String(Date.now()), name: '', amount: '' },
    ]);
  }

  function updateItem(id: string, field: 'name' | 'amount', value: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Items</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.headerBtn, styles.headerBtnPrimary]}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Receipt zone */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Receipt</Text>

          {scanState === 'empty' && (
            <View style={styles.uploadZone}>
              <Text style={styles.uploadIcon}>🧾</Text>
              <Text style={styles.uploadHeading}>Tap to photograph receipt</Text>
              <Text style={styles.uploadSubtext}>
                We'll scan it and pull out the line items automatically
              </Text>
              <View style={styles.uploadBtnRow}>
                <TouchableOpacity style={styles.uploadBtn}>
                  <Text style={styles.uploadBtnText}>📷 Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.uploadBtn}>
                  <Text style={styles.uploadBtnText}>🖼 Library</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {scanState === 'scanning' && (
            <View style={styles.scanningZone}>
              <Text style={styles.scanningText}>Scanning receipt…</Text>
              <Text style={styles.scanningSubtext}>Identifying line items</Text>
            </View>
          )}

          {scanState === 'done' && (
            <View style={styles.scannedRow}>
              <View style={styles.scannedThumb} />
              <View style={styles.scannedMeta}>
                <Text style={styles.scannedDone}>Receipt scanned ✓</Text>
                <Text style={styles.scannedSubtext}>
                  {items.length} items detected · tap to rescan
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Line items */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>Line items</Text>
            <TouchableOpacity onPress={addItem}>
              <Text style={styles.addBtn}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 && (
            <Text style={styles.emptyItems}>No items yet. Scan a receipt or tap + Add.</Text>
          )}

          {items.map((item, index) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemIndex}>{index + 1}</Text>
              <TextInput
                style={styles.itemNameInput}
                placeholder="Item name"
                placeholderTextColor={Colors.textLight}
                value={item.name}
                onChangeText={(v) => updateItem(item.id, 'name', v)}
              />
              <View style={styles.itemAmountWrap}>
                <Text style={styles.currencySymbol}>£</Text>
                <TextInput
                  style={styles.itemAmountInput}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="decimal-pad"
                  value={item.amount}
                  onChangeText={(v) => updateItem(item.id, 'amount', v)}
                />
              </View>
              <TouchableOpacity onPress={() => removeItem(item.id)}>
                <Text style={styles.deleteBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Reconciliation footer */}
        {items.length > 0 && (
          <View style={styles.reconcile}>
            <View style={styles.reconcileRow}>
              <Text style={styles.reconcileLabel}>Items total</Text>
              <Text style={styles.reconcileValue}>
                £{(itemsTotal / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.reconcileRow}>
              <Text style={styles.reconcileLabel}>Expense total</Text>
              <Text style={styles.reconcileValue}>
                £{(expenseTotal / 100).toFixed(2)}
              </Text>
            </View>
            <Text
              style={[
                styles.reconcileNote,
                Math.abs(difference) <= 1 ? styles.reconcileOk : styles.reconcileWarn,
              ]}
            >
              {Math.abs(difference) <= 1
                ? '✓ Items match the total'
                : difference > 0
                ? `Items exceed total by £${(difference / 100).toFixed(2)}`
                : `£${(Math.abs(difference) / 100).toFixed(2)} of spend unaccounted`}
            </Text>
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

  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addBtn: { fontSize: 15, fontWeight: '600', color: Colors.text },

  // Upload zone
  uploadZone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.borderStrong,
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
  },
  uploadIcon: { fontSize: 40, marginBottom: 10 },
  uploadHeading: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  uploadSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  uploadBtnRow: { flexDirection: 'row', gap: 10 },
  uploadBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  uploadBtnText: { fontSize: 14, color: Colors.text },

  // Scanning
  scanningZone: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
  },
  scanningText: { fontSize: 16, fontWeight: '600', color: Colors.text },
  scanningSubtext: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },

  // Scanned
  scannedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scannedThumb: {
    width: 48,
    height: 64,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  scannedMeta: { flex: 1 },
  scannedDone: { fontSize: 15, fontWeight: '600', color: Colors.positive },
  scannedSubtext: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  // Items list
  emptyItems: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  itemIndex: { width: 20, fontSize: 13, color: Colors.textMuted, textAlign: 'right' },
  itemNameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.inputBg,
  },
  itemAmountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 8,
    paddingVertical: 8,
    width: 90,
  },
  currencySymbol: { fontSize: 14, color: Colors.textMuted, marginRight: 2 },
  itemAmountInput: { flex: 1, fontSize: 14, color: Colors.text, fontVariant: ['tabular-nums'] },
  deleteBtn: { fontSize: 16, color: Colors.textMuted, paddingHorizontal: 4 },

  // Reconcile
  reconcile: {
    marginHorizontal: 16,
    marginTop: 12,
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
