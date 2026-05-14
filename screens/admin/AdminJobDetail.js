import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  Alert, Image, Linking, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, onSnapshot, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Colors, StatusConfig, CategoryConfig, PriorityConfig } from '../../constants/theme';

export default function AdminJobDetail({ navigation, route }) {
  const { jobId } = route.params;
  const [job, setJob]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Edit mode state
  const [editMode, setEditMode]         = useState(false);
  const [editTitle, setEditTitle]       = useState('');
  const [editAddress, setEditAddress]   = useState('');
  const [editDate, setEditDate]         = useState('');
  const [editDesc, setEditDesc]         = useState('');

  // Admin comment for approval/revision
  const [adminComment, setAdminComment] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'jobs', jobId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setJob(data);
        if (!editMode) {
          setEditTitle(data.title || '');
          setEditAddress(data.address || '');
          setEditDate(data.scheduledDate || '');
          setEditDesc(data.description || '');
          setAdminComment(data.adminComment || '');
        }
      }
      setLoading(false);
    });
    return unsub;
  }, [jobId]);

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'jobs', jobId), {
        title: editTitle.trim(),
        address: editAddress.trim(),
        scheduledDate: editDate.trim(),
        description: editDesc.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditMode(false);
      Alert.alert('Saved', 'Job details updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (newStatus) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'jobs', jobId), {
        status: newStatus,
        adminComment: adminComment.trim(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = () =>
    Alert.alert('Approve Job', 'Mark this job as completed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => updateStatus('completed') },
    ]);

  const handleRevision = () =>
    Alert.alert('Request Revision', 'Send job back to engineer for revision?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Request Revision', style: 'destructive', onPress: () => updateStatus('needs_revision') },
    ]);

  const handleDelete = () =>
    Alert.alert('Delete Job', 'This action cannot be undone. Delete this job?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'jobs', jobId));
            navigation.goBack();
          } catch {
            Alert.alert('Error', 'Failed to delete job.');
          }
        },
      },
    ]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.notFound}>Job not found.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>← Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sc = StatusConfig[job.status] || StatusConfig.pending;
  const cc = CategoryConfig[job.category] || CategoryConfig.General;
  const pc = PriorityConfig[job.priority] || PriorityConfig.medium;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Status banner */}
          <View style={[styles.statusBanner, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[styles.statusLabel, { color: sc.color }]}>{sc.label}</Text>
          </View>

          {/* Title & badges — editable */}
          <View style={styles.card}>
            {editMode ? (
              <>
                <Text style={styles.editLabel}>Title</Text>
                <TextInput style={styles.editInput} value={editTitle} onChangeText={setEditTitle} placeholder="Job title" placeholderTextColor={Colors.textMuted} />
                <Text style={styles.editLabel}>Description</Text>
                <TextInput style={[styles.editInput, { minHeight: 80, textAlignVertical: 'top' }]} value={editDesc} onChangeText={setEditDesc} placeholder="Description (optional)" placeholderTextColor={Colors.textMuted} multiline />
              </>
            ) : (
              <>
                <Text style={styles.jobTitle}>{job.title}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: cc.bg }]}>
                    <Text style={styles.badgeIcon}>{cc.icon}</Text>
                    <Text style={[styles.badgeText, { color: cc.color }]}>{job.category}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: pc.bg }]}>
                    <Text style={[styles.badgeText, { color: pc.color }]}>{pc.label} Priority</Text>
                  </View>
                </View>
                {job.description ? <Text style={styles.description}>{job.description}</Text> : null}
              </>
            )}
          </View>

          {/* Details — editable */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Details</Text>
              {!editMode ? (
                <TouchableOpacity onPress={() => setEditMode(true)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={() => setEditMode(false)} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveEdit} style={styles.saveBtn}>
                    <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {editMode ? (
              <>
                <Text style={styles.editLabel}>Address</Text>
                <TextInput style={styles.editInput} value={editAddress} onChangeText={setEditAddress} placeholder="Address" placeholderTextColor={Colors.textMuted} />
                <Text style={styles.editLabel}>Scheduled Date (DD/MM/YYYY)</Text>
                <TextInput style={styles.editInput} value={editDate} onChangeText={setEditDate} placeholder="e.g. 22/05/2026" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
              </>
            ) : (
              <>
                <Row label="Assigned To" value={job.assignedToName || '—'} />
                <Row label="Address"     value={job.address || '—'} />
                <Row label="Scheduled"   value={job.scheduledDate || 'Not set'} />
              </>
            )}
          </View>

          {/* Engineer notes */}
          {job.engineerNote ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Engineer Notes</Text>
              <Text style={styles.noteText}>{job.engineerNote}</Text>
            </View>
          ) : null}

          {/* Admin previous comment */}
          {job.adminComment && job.status !== 'pending_approval' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Your Previous Comment</Text>
              <Text style={styles.noteText}>{job.adminComment}</Text>
            </View>
          ) : null}

          {/* Photos */}
          {job.photos && job.photos.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Submitted Photos ({job.photos.length})</Text>
              <View style={styles.photoGrid}>
                {job.photos.map((uri, i) => (
                  <TouchableOpacity key={i} onPress={() => Linking.openURL(uri)} activeOpacity={0.8}>
                    <Image source={{ uri }} style={styles.photo} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {/* Admin review area */}
          {job.status === 'pending_approval' && (
            <View style={styles.actionArea}>
              <Text style={styles.sectionTitle}>Review Submission</Text>
              <Text style={styles.editLabel}>Comment for engineer (optional)</Text>
              <TextInput
                style={[styles.editInput, { minHeight: 80, textAlignVertical: 'top', marginBottom: 14 }]}
                value={adminComment}
                onChangeText={setAdminComment}
                placeholder="Leave a comment for the engineer..."
                placeholderTextColor={Colors.textMuted}
                multiline
              />
              {saving ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.approveBtn} onPress={handleApprove}>
                    <Text style={styles.actionBtnText}>✓ Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.revisionBtn} onPress={handleRevision}>
                    <Text style={styles.actionBtnText}>↩ Revision</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({ label, value }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  label: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  value: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600', flex: 2, textAlign: 'right' },
});

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { width: 60 },
  backText:    { color: Colors.accentLight, fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },
  deleteBtn:   { width: 60, alignItems: 'flex-end' },
  deleteText:  { color: '#FF7070', fontSize: 14, fontWeight: '600' },

  statusBanner: { marginHorizontal: 16, marginTop: 14, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  statusLabel:  { fontSize: 15, fontWeight: '700' },

  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: Colors.border },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  editBtn:       { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  editBtnText:   { color: Colors.white, fontSize: 13, fontWeight: '600' },
  editActions:   { flexDirection: 'row', gap: 8 },
  cancelBtn:     { backgroundColor: Colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  saveBtn:       { backgroundColor: Colors.completed, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  saveBtnText:   { color: Colors.white, fontSize: 13, fontWeight: '600' },

  editLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  editInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.background },

  jobTitle:    { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  badgeRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeIcon:   { fontSize: 12, marginRight: 4 },
  badgeText:   { fontSize: 12, fontWeight: '700' },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },

  noteText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo:     { width: 90, height: 90, borderRadius: 10 },

  actionArea: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginHorizontal: 16, marginTop: 12, marginBottom: 30, borderWidth: 1, borderColor: Colors.border },
  actionRow:  { flexDirection: 'row', gap: 12, marginTop: 4 },
  approveBtn: { flex: 1, backgroundColor: Colors.completed, borderRadius: 10, height: 46, alignItems: 'center', justifyContent: 'center' },
  revisionBtn:{ flex: 1, backgroundColor: Colors.needsRevision, borderRadius: 10, height: 46, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

  notFound: { fontSize: 16, color: Colors.textMuted, marginBottom: 12 },
  backLink:  { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  content:   { paddingBottom: 40 },
});