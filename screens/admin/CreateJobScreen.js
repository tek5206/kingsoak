import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, addDoc, getDocs, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Colors, CategoryConfig, PriorityConfig } from '../../constants/theme';

const CATEGORIES = Object.keys(CategoryConfig);
const PRIORITIES = Object.keys(PriorityConfig);

export default function CreateJobScreen({ navigation }) {
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress]       = useState('');
  const [category, setCategory]     = useState('General');
  const [priority, setPriority]     = useState('medium');
  const [engineers, setEngineers]   = useState([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedName, setAssignedName] = useState('');
  const [showDate, setShowDate]     = useState(false);
  const [scheduledDate, setScheduledDate] = useState(null);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'engineer'))
      );
      setEngineers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  const handleCreate = async () => {
    if (!title.trim())     { Alert.alert('Error', 'Job title is required.'); return; }
    if (!assignedTo)       { Alert.alert('Error', 'Please assign to an engineer.'); return; }

    setLoading(true);
    try {
      await addDoc(collection(db, 'jobs'), {
        title:          title.trim(),
        description:    description.trim(),
        address:        address.trim(),
        category,
        priority,
        assignedTo,
        assignedToName: assignedName,
        status:         'pending',
        scheduledDate:  scheduledDate
          ? scheduledDate.toLocaleDateString('en-GB')
          : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Success', 'Job created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to create job. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Job</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Title */}
        <Text style={styles.label}>Job Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Fix leaking pipe in bathroom"
          placeholderTextColor={Colors.textMuted}
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the job in detail..."
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={4}
        />

        {/* Address */}
        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="e.g. 10 Downing St, London SW1A 2AA"
          placeholderTextColor={Colors.textMuted}
        />

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {CATEGORIES.map(c => {
            const cc = CategoryConfig[c];
            const active = category === c;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.chip, active && { backgroundColor: cc.bg, borderColor: cc.color }]}
                onPress={() => setCategory(c)}
              >
                <Text style={styles.chipIcon}>{cc.icon}</Text>
                <Text style={[styles.chipText, active && { color: cc.color, fontWeight: '700' }]}>
                  {c}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Priority */}
        <Text style={styles.label}>Priority</Text>
        <View style={styles.priorityRow}>
          {PRIORITIES.map(p => {
            const pc = PriorityConfig[p];
            const active = priority === p;
            return (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityBtn,
                  active && { backgroundColor: pc.bg, borderColor: pc.color },
                ]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.priorityText, active && { color: pc.color, fontWeight: '700' }]}>
                  {pc.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Assign to */}
        <Text style={styles.label}>Assign To *</Text>
        {engineers.length === 0 ? (
          <Text style={styles.noEngineers}>No engineers found in the system.</Text>
        ) : (
          engineers.map(eng => {
            const active = assignedTo === eng.id;
            return (
              <TouchableOpacity
                key={eng.id}
                style={[styles.engineerRow, active && styles.engineerRowActive]}
                onPress={() => {
                  setAssignedTo(eng.id);
                  setAssignedName(`${eng.name} ${eng.surname}`.trim());
                }}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(eng.name?.[0] || '?').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.engineerName, active && { color: Colors.primary }]}>
                    {eng.name} {eng.surname}
                  </Text>
                  <Text style={styles.engineerEmail}>{eng.email}</Text>
                </View>
                {active && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })
        )}

        {/* Scheduled date */}
        <Text style={styles.label}>Scheduled Date</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDate(true)}>
          <Text style={styles.dateBtnText}>
            {scheduledDate
              ? scheduledDate.toLocaleDateString('en-GB')
              : 'Select a date'}
          </Text>
        </TouchableOpacity>

        {showDate && (
          <DateTimePicker
            value={scheduledDate || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(_, date) => {
              setShowDate(false);
              if (date) setScheduledDate(date);
            }}
            minimumDate={new Date()}
          />
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.primary} />
            : <Text style={styles.submitText}>Create Job</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { width: 60 },
  backText:    { color: Colors.accentLight, fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },

  content: { padding: 16, paddingBottom: 60 },

  label: {
    fontSize: 13, fontWeight: '600',
    color: Colors.textSecondary, marginBottom: 6, marginTop: 16,
  },
  input: {
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 14,
    fontSize: 15, color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  multiline: { height: 100, textAlignVertical: 'top' },

  chipRow: { marginBottom: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, marginRight: 8,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipIcon: { fontSize: 14, marginRight: 5 },
  chipText: { fontSize: 13, color: Colors.textSecondary },

  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  priorityText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },

  noEngineers: { color: Colors.textMuted, fontSize: 14, marginBottom: 8 },

  engineerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12, padding: 14,
    marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  engineerRowActive: { borderColor: Colors.primary, backgroundColor: '#EEF4FF' },

  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  avatarText:    { color: Colors.white, fontWeight: '700', fontSize: 16 },
  engineerName:  { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  engineerEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  checkmark:     { fontSize: 18, color: Colors.primary, fontWeight: '700' },

  dateBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  dateBtnText: { fontSize: 15, color: Colors.textPrimary },

  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 28,
    borderBottomWidth: 3, borderBottomColor: '#9A7A30',
  },
  btnDisabled: { opacity: 0.6 },
  submitText:  { fontSize: 16, fontWeight: '700', color: Colors.primary },
});
