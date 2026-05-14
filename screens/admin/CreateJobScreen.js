import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, addDoc, getDocs, serverTimestamp, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Colors, CategoryConfig, PriorityConfig } from '../../constants/theme';

const CATEGORIES = Object.keys(CategoryConfig);
const PRIORITIES = Object.keys(PriorityConfig);

export default function CreateJobScreen({ navigation, route }) {
  const editJobId = route.params?.jobId || null;
  const isEdit = !!editJobId;

  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [address, setAddress]           = useState('');
  const [categories, setCategories]     = useState([]);
  const [priority, setPriority]         = useState('medium');
  const [engineers, setEngineers]       = useState([]);
  const [assignedTo, setAssignedTo]     = useState('');
  const [assignedName, setAssignedName] = useState('');
  const [showDate, setShowDate]         = useState(false);
  const [scheduledDate, setScheduledDate] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);

  // Load engineers
  useEffect(() => {
    (async () => {
      const snap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'engineer'))
      );
      setEngineers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  // Load existing job data if edit mode
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'jobs', editJobId));
        if (snap.exists()) {
          const data = snap.data();
          setTitle(data.title || '');
          setDescription(data.description || '');
          setAddress(data.address || '');
          setCategories(data.categories || (data.category ? [data.category] : []));
          setPriority(data.priority || 'medium');
          setAssignedTo(data.assignedTo || '');
          setAssignedName(data.assignedToName || '');
          if (data.scheduledDate) {
            const parts = data.scheduledDate.split('/');
            if (parts.length === 3) {
              setScheduledDate(new Date(parts[2], parts[1] - 1, parts[0]));
            }
          }
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to load job data.');
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [editJobId]);

  const toggleCategory = (c) => {
    setCategories(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim())           { Alert.alert('Error', 'Job title is required.'); return; }
    if (categories.length === 0) { Alert.alert('Error', 'Please select at least one category.'); return; }
    if (!assignedTo)             { Alert.alert('Error', 'Please assign to an engineer.'); return; }

    setLoading(true);
    try {
      const dateStr = scheduledDate ? scheduledDate.toLocaleDateString('en-GB') : null;

      if (isEdit) {
        await updateDoc(doc(db, 'jobs', editJobId), {
          title:          title.trim(),
          description:    description.trim(),
          address:        address.trim(),
          category:       categories[0],
          categories,
          priority,
          assignedTo,
          assignedToName: assignedName,
          scheduledDate:  dateStr,
          updatedAt:      serverTimestamp(),
        });
        Alert.alert('Success', 'Job updated successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await addDoc(collection(db, 'jobs'), {
          title:          title.trim(),
          description:    description.trim(),
          address:        address.trim(),
          category:       categories[0],
          categories,
          priority,
          assignedTo,
          assignedToName: assignedName,
          status:         'pending',
          scheduledDate:  dateStr,
          createdAt:      serverTimestamp(),
          updatedAt:      serverTimestamp(),
        });
        Alert.alert('Success', 'Job created successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      Alert.alert('Error', isEdit ? 'Failed to update job.' : 'Failed to create job.');
    } finally {
      setLoading(false);
    }
  };

  const selectedEngineer = engineers.find(e => e.id === assignedTo);

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Job' : 'Create Job'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Job Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Fix leaking pipe in bathroom"
          placeholderTextColor={Colors.textMuted}
        />

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

        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="e.g. 10 Downing St, London SW1A 2AA"
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.label}>
          Category * {categories.length > 0 && <Text style={styles.labelCount}>({categories.length} selected)</Text>}
        </Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map(c => {
            const cc     = CategoryConfig[c];
            const active = categories.includes(c);
            return (
              <TouchableOpacity
                key={c}
                style={[styles.catChip, active && { backgroundColor: cc.bg, borderColor: cc.color }]}
                onPress={() => toggleCategory(c)}
              >
                <Text style={styles.catChipIcon}>{cc.icon}</Text>
                <Text style={[styles.catChipText, active && { color: cc.color, fontWeight: '700' }]}>{c}</Text>
                {active && <Text style={[styles.catCheck, { color: cc.color }]}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Priority</Text>
        <View style={styles.priorityRow}>
          {PRIORITIES.map(p => {
            const pc     = PriorityConfig[p];
            const active = priority === p;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.priorityBtn, active && { backgroundColor: pc.bg, borderColor: pc.color }]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.priorityText, active && { color: pc.color, fontWeight: '700' }]}>
                  {pc.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Assign To *</Text>
        <TouchableOpacity
          style={[styles.dropdown, assignedTo && styles.dropdownActive]}
          onPress={() => setShowDropdown(true)}
        >
          {selectedEngineer ? (
            <View style={styles.dropdownSelected}>
              <View style={styles.dropdownAvatar}>
                <Text style={styles.dropdownAvatarText}>
                  {(selectedEngineer.name?.[0] || '?').toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.dropdownName}>
                  {selectedEngineer.name} {selectedEngineer.surname}
                </Text>
                <Text style={styles.dropdownEmail}>{selectedEngineer.email}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.dropdownPlaceholder}>Select an engineer...</Text>
          )}
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>

        <Modal
          visible={showDropdown}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDropdown(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowDropdown(false)}
          >
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Select Engineer</Text>
              {engineers.length === 0 ? (
                <Text style={styles.noEngineers}>No engineers found.</Text>
              ) : (
                engineers.map(eng => {
                  const active = assignedTo === eng.id;
                  return (
                    <TouchableOpacity
                      key={eng.id}
                      style={[styles.modalRow, active && styles.modalRowActive]}
                      onPress={() => {
                        setAssignedTo(eng.id);
                        setAssignedName(`${eng.name} ${eng.surname}`.trim());
                        setShowDropdown(false);
                      }}
                    >
                      <View style={[styles.modalAvatar, active && { backgroundColor: Colors.accent }]}>
                        <Text style={styles.modalAvatarText}>
                          {(eng.name?.[0] || '?').toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalName, active && { color: Colors.primary }]}>
                          {eng.name} {eng.surname}
                        </Text>
                        <Text style={styles.modalEmail}>{eng.email}</Text>
                      </View>
                      {active && <Text style={styles.modalCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        <Text style={styles.label}>Scheduled Date</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDate(true)}>
          <Text style={styles.dateBtnText}>
            {scheduledDate ? scheduledDate.toLocaleDateString('en-GB') : 'Select a date'}
          </Text>
          <Text style={styles.dateIcon}>📅</Text>
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

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.primary} />
            : <Text style={styles.submitText}>{isEdit ? 'Save Changes' : 'Create Job'}</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { width: 60 },
  backText:    { color: Colors.accentLight, fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },

  content: { padding: 16, paddingBottom: 60 },

  label:      { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8, marginTop: 18 },
  labelCount: { fontSize: 12, color: Colors.primary, fontWeight: '700' },

  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 14, fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.surface,
  },
  multiline: { height: 100, textAlignVertical: 'top' },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface, gap: 5,
  },
  catChipIcon: { fontSize: 14 },
  catChipText: { fontSize: 13, color: Colors.textSecondary },
  catCheck:    { fontSize: 12, fontWeight: '800' },

  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  priorityText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },

  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  dropdownActive:      { borderColor: Colors.primary },
  dropdownSelected:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dropdownAvatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  dropdownAvatarText:  { color: Colors.white, fontWeight: '700', fontSize: 14 },
  dropdownName:        { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  dropdownEmail:       { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  dropdownPlaceholder: { fontSize: 15, color: Colors.textMuted, flex: 1 },
  dropdownArrow:       { fontSize: 12, color: Colors.textMuted },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalBox: {
    backgroundColor: Colors.surface, borderRadius: 20,
    padding: 20, width: '88%', maxHeight: '80%', elevation: 10,
  },
  modalTitle:      { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16 },
  noEngineers:     { color: Colors.textMuted, fontSize: 14 },
  modalRow:        { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  modalRowActive:  { borderColor: Colors.primary, backgroundColor: '#EEF4FF' },
  modalAvatar:     { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  modalAvatarText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  modalName:       { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  modalEmail:      { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  modalCheck:      { fontSize: 20, color: Colors.primary, fontWeight: '700' },

  dateBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.border },
  dateBtnText: { fontSize: 15, color: Colors.textPrimary },
  dateIcon:    { fontSize: 16 },

  submitBtn:   { backgroundColor: Colors.accent, borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 28, borderBottomWidth: 3, borderBottomColor: '#9A7A30' },
  btnDisabled: { opacity: 0.6 },
  submitText:  { fontSize: 16, fontWeight: '700', color: Colors.primary },
});