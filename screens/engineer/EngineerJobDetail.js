import * as ImageManipulator from 'expo-image-manipulator';
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
  Alert, Image, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { Colors, StatusConfig, CategoryConfig } from '../../constants/theme';

const BUCKET = 'kings-oak-demo.firebasestorage.app';

export default function EngineerJobDetail({ navigation, route }) {
  const { jobId } = route.params;
  const [job, setJob]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [photos, setPhotos]   = useState([]);
  const [note, setNote]       = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'jobs', jobId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setJob(data);
        if (data.engineerNote && !note) setNote(data.engineerNote);
      }
      setLoading(false);
    });
    return unsub;
  }, [jobId]);

  const pickPhoto = async () => {
    Alert.alert('Add Photo', 'Choose an option', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission required', 'Camera access is needed.'); return; }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing: true, exif: false });
          if (!result.canceled) setPhotos(prev => [...prev, result.assets[0].uri]);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission required', 'Photo library access is needed.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, allowsEditing: true, exif: false });
          if (!result.canceled) setPhotos(prev => [...prev, result.assets[0].uri]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = (idx) => {
    Alert.alert('Remove Photo', 'Remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setPhotos(prev => prev.filter((_, i) => i !== idx)) },
    ]);
  };

  const uploadPhotos = async () => {
  const urls  = [];
  const token = await auth.currentUser.getIdToken();

  for (let i = 0; i < photos.length; i++) {
    const uri = photos[i];

    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 600 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
    );

    const filename    = `${Date.now()}_${i}.jpg`;
    const path        = `jobs/${jobId.slice(0, 8)}/${filename}`;
    const encodedPath = encodeURIComponent(path);
    const uploadUrl   = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=${encodedPath}`;

    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.onload = () => {
        if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(`Upload failed: ${xhr.responseText}`));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      const formData = new FormData();
      formData.append('file', { uri: compressed.uri, type: 'image/jpeg', name: filename });
      xhr.send(formData);
    });

    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media&token=${result.downloadTokens}`;
    urls.push(downloadUrl);

    // Her upload arasında bekle
    await new Promise(res => setTimeout(res, 800));
  }
  return urls;
};

  const handleStart = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'jobs', jobId), { status: 'in_progress', updatedAt: serverTimestamp() });
    } catch { Alert.alert('Error', 'Could not start the job.'); }
    finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    if (photos.length === 0) { Alert.alert('Photos required', 'Please take at least one photo.'); return; }
    Alert.alert('Submit for Approval', 'Submit this job for manager review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        onPress: async () => {
          setSaving(true);
          try {
            const uploadedUrls   = await uploadPhotos();
            const existingPhotos = job.photos || [];
            await updateDoc(doc(db, 'jobs', jobId), {
              status: 'pending_approval', engineerNote: note.trim(),
              photos: [...existingPhotos, ...uploadedUrls],
              submittedAt: serverTimestamp(), updatedAt: serverTimestamp(),
            });
            setPhotos([]);
            Alert.alert('Submitted!', 'Your work has been sent for manager review.');
          } catch (e) {
            console.error(e);
            Alert.alert('Error', `Failed to submit: ${e.message}`);
          } finally { setSaving(false); }
        },
      },
    ]);
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ flex: 1 }} color={Colors.primary} size="large" /></SafeAreaView>;
  if (!job)    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.notFound}>Job not found.</Text></View></SafeAreaView>;

  const sc = StatusConfig[job.status] || StatusConfig.pending;
  const cc = CategoryConfig[job.category] || CategoryConfig.General;
  const isPending   = job.status === 'pending';
  const canWork     = job.status === 'in_progress' || job.status === 'needs_revision';
  const isRevision  = job.status === 'needs_revision';
  const isSubmitted = job.status === 'pending_approval';
  const isDone      = job.status === 'completed';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.statusBanner, { backgroundColor: sc.bg, borderColor: sc.border }]}>
          <Text style={[styles.statusLabel, { color: sc.color }]}>{sc.label}</Text>
        </View>

        {isRevision && (
          <View style={styles.revisionCard}>
            <Text style={styles.revisionTitle}>Manager requested a revision</Text>
            <Text style={styles.revisionBody}>Please add more photos or update your notes, then resubmit.</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <View style={[styles.catBadge, { backgroundColor: cc.bg }]}>
     
            <Text style={[styles.catText, { color: cc.color }]}>{job.category}</Text>
          </View>
          {job.description ? <Text style={styles.description}>{job.description}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          <Row label="Address"   value={job.address || '—'} />
          <Row label="Scheduled" value={job.scheduledDate || 'Not set'} />
          <Row label="Priority"  value={job.priority ? job.priority.charAt(0).toUpperCase() + job.priority.slice(1) : '—'} />
        </View>

        {job.photos && job.photos.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Previously Submitted Photos</Text>
            <View style={styles.photoGrid}>
              {job.photos.map((uri, i) => <Image key={i} source={{ uri }} style={styles.photo} />)}
            </View>
          </View>
        )}

        {canWork && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{isRevision ? 'Add More Photos' : 'Submit Your Work'}</Text>
            <View style={styles.photoGrid}>
              {photos.map((uri, i) => (
                <TouchableOpacity key={i} onLongPress={() => removePhoto(i)} activeOpacity={0.8}>
                  <Image source={{ uri }} style={styles.photo} />
                  <View style={styles.removeOverlay}><Text style={styles.removeX}>✕</Text></View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhoto}>
                <Text style={styles.addPhotoIcon}>📷</Text>
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.photoHint}>Long press a photo to remove it</Text>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Notes (optional)</Text>
            <TextInput
              style={styles.noteInput} value={note} onChangeText={setNote}
              placeholder="Any notes for the manager..." placeholderTextColor={Colors.textMuted}
              multiline numberOfLines={3}
            />
          </View>
        )}

        <View style={styles.ctaArea}>
          {saving ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <>
              {isPending && (
                <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
                  <Text style={styles.ctaText}> Start Job</Text>
                </TouchableOpacity>
              )}
              {canWork && (
                <TouchableOpacity
                  style={[styles.submitBtn, photos.length === 0 && styles.btnDisabled]}
                  onPress={handleSubmit} disabled={photos.length === 0}
                >
                  <Text style={styles.ctaText}>Submit for Approval ({photos.length} photo{photos.length !== 1 ? 's' : ''})</Text>
                </TouchableOpacity>
              )}
              {isSubmitted && (
                <View style={styles.submittedBox}>
                  <Text style={styles.submittedText}>✅ Submitted — waiting for manager review</Text>
                </View>
              )}
              {isDone && (
                <View style={[styles.submittedBox, { backgroundColor: Colors.completedBg }]}>
                  <Text style={[styles.submittedText, { color: Colors.completed }]}>Job Completed & Approved!</Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
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
  backBtn: { width: 60 }, backText: { color: Colors.accentLight, fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },
  statusBanner: { marginHorizontal: 16, marginTop: 14, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  statusLabel: { fontSize: 15, fontWeight: '700' },
  revisionCard: { marginHorizontal: 16, marginTop: 10, backgroundColor: Colors.needsRevisionBg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.needsRevisionBorder },
  revisionTitle: { fontSize: 14, fontWeight: '700', color: Colors.needsRevision, marginBottom: 4 },
  revisionBody:  { fontSize: 13, color: Colors.needsRevision },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: Colors.border },
  jobTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  catBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 10 },
  catIcon: { fontSize: 12, marginRight: 4 }, catText: { fontSize: 12, fontWeight: '700' },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginTop: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  photo: { width: 90, height: 90, borderRadius: 10 },
  removeOverlay: { position: 'absolute', top: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  removeX: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addPhotoBtn: { width: 90, height: 90, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceAlt },
  addPhotoIcon: { fontSize: 22 }, addPhotoText: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },
  photoHint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  noteInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.background, height: 90, textAlignVertical: 'top' },
  ctaArea: { marginHorizontal: 16, marginTop: 16, marginBottom: 40, gap: 12 },
  startBtn: { backgroundColor: Colors.inProgress, borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: '#0F4870' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: Colors.accent },
  btnDisabled: { opacity: 0.4 }, ctaText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  submittedBox: { backgroundColor: Colors.pendingApprovalBg, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.pendingApprovalBorder },
  submittedText: { fontSize: 15, fontWeight: '700', color: Colors.pendingApproval },
  notFound: { fontSize: 16, color: Colors.textMuted },
  content:  { paddingBottom: 20 },
});