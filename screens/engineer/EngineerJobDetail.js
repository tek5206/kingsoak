import * as ImageManipulator from 'expo-image-manipulator';
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  Alert, Image, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { Colors, StatusConfig, CategoryConfig } from '../../constants/theme';

const BUCKET = 'kings-oak-demo.firebasestorage.app';

// ─── Kategori normalizasyonu (eski: string, yeni: array) ─────────────────────
function getCategories(job) {
  if (Array.isArray(job.categories) && job.categories.length > 0) return job.categories;
  if (job.category) return [job.category];
  return [];
}

// ─── Storage: tek fotoğraf yükle (token otomatik yenilenir) ─────────────────
async function uploadOnePhoto(uri, jobId, index) {
  // FIX: Her yükleme öncesi token tazele — böylece uzun işlemlerde expire olmaz
  const token = await auth.currentUser.getIdToken(/* forceRefresh */ true);

  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
  );

  const filename    = `${Date.now()}_${index}.jpg`;
  const path        = `jobs/${jobId.slice(0, 8)}/${filename}`;
  const encodedPath = encodeURIComponent(path);
  const uploadUrl   = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=${encodedPath}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          // downloadTokens garantili değil; yoksa token parametresiz URL dön
          const downloadUrl = res.downloadTokens
            ? `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media&token=${res.downloadTokens}`
            : `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media`;
          resolve(downloadUrl);
        } catch (e) {
          reject(new Error('Upload response parse error'));
        }
      } else {
        // FIX: Hata detayını yut değil, fırlat
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText)?.error?.message || msg; } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.timeout = 30000; // 30 saniye timeout

    const formData = new FormData();
    formData.append('file', { uri: compressed.uri, type: 'image/jpeg', name: filename });
    xhr.send(formData);
  });
}

// ─── Storage: tüm fotoğrafları sırayla yükle ─────────────────────────────────
async function uploadPhotos(photos, jobId) {
  const urls = [];
  for (let i = 0; i < photos.length; i++) {
    // FIX: 800ms arbitrary delay kaldırıldı; ardışık upload zaten sıralı
    const url = await uploadOnePhoto(photos[i], jobId, i);
    urls.push(url);
  }
  return urls;
}

// ─── Bileşen ─────────────────────────────────────────────────────────────────
export default function EngineerJobDetail({ navigation, route }) {
  const { jobId } = route.params;
  const [job, setJob]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [photos, setPhotos]   = useState([]);
  const [note, setNote]       = useState('');

  // FIX: note'un ilk yüklemede Firestore'dan gelmesi için ref ile takip et
  const noteInitialized = useRef(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'jobs', jobId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setJob(data);
        // FIX: Sadece ilk kez (component mount) engineer note'unu set et;
        //      sonraki snapshot'larda kullanıcının yazdığını ezme
        if (!noteInitialized.current) {
          setNote(data.engineerNote || '');
          noteInitialized.current = true;
        }
      }
      setLoading(false);
    });
    return unsub;
  }, [jobId]); // FIX: note dependency'den kaldırıldı, ref ile yönetiliyor

  // ─── Fotoğraf seç ──────────────────────────────────────────────────────────
  const pickPhoto = async () => {
    Alert.alert('Add Photo', 'Choose an option', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission required', 'Camera access is needed.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.5, allowsEditing: true, exif: false,
          });
          if (!result.canceled) setPhotos(prev => [...prev, result.assets[0].uri]);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission required', 'Photo library access is needed.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5, allowsEditing: true, exif: false,
          });
          if (!result.canceled) setPhotos(prev => [...prev, result.assets[0].uri]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = (idx) => {
    Alert.alert('Remove Photo', 'Remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setPhotos(prev => prev.filter((_, i) => i !== idx)),
      },
    ]);
  };

  // ─── Aksiyonlar ────────────────────────────────────────────────────────────
  const handleStart = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'jobs', jobId), {
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      });
    } catch {
      Alert.alert('Error', 'Could not start the job.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      Alert.alert('Photos required', 'Please take at least one photo.');
      return;
    }

    Alert.alert('Submit for Approval', 'Submit this job for manager review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        onPress: async () => {
          setSaving(true);
          try {
            const uploadedUrls   = await uploadPhotos(photos, jobId);
            const existingPhotos = job.photos || [];
            await updateDoc(doc(db, 'jobs', jobId), {
              status:       'pending_approval',
              engineerNote: note.trim(),
              photos:       [...existingPhotos, ...uploadedUrls],
              submittedAt:  serverTimestamp(),
              updatedAt:    serverTimestamp(),
            });
            setPhotos([]);
            Alert.alert('Submitted!', 'Your work has been sent for manager review.');
          } catch (e) {
            Alert.alert('Upload Error', e.message || 'Failed to submit. Please try again.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
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
        </View>
      </SafeAreaView>
    );
  }

  const sc = StatusConfig[job.status] || StatusConfig.pending;

  // FIX: Kategori normalizasyonu — eski (string) ve yeni (array) kayıtları destekler
  const jobCategories = getCategories(job);
  const primaryCategory = jobCategories[0] || 'General';
  const cc = CategoryConfig[primaryCategory] || CategoryConfig.General;

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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.statusBanner, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[styles.statusLabel, { color: sc.color }]}>{sc.label}</Text>
          </View>

          {isRevision && (
            <View style={styles.revisionCard}>
              <Text style={styles.revisionTitle}>Manager requested a revision</Text>
              <Text style={styles.revisionBody}>
                Please add more photos or update your notes, then resubmit.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            {/* FIX: Tüm kategorileri göster */}
            <View style={styles.catRow}>
              {jobCategories.map(cat => {
                const catCfg = CategoryConfig[cat] || CategoryConfig.General;
                return (
                  <View key={cat} style={[styles.catBadge, { backgroundColor: catCfg.bg }]}>
                    <Text style={[styles.catText, { color: catCfg.color }]}>{cat}</Text>
                  </View>
                );
              })}
            </View>
            {job.description ? (
              <Text style={styles.description}>{job.description}</Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Details</Text>
            <Row label="Address"   value={job.address || '—'} />
            <Row label="Scheduled" value={job.scheduledDate || 'Not set'} />
            <Row label="Priority"  value={
              job.priority
                ? job.priority.charAt(0).toUpperCase() + job.priority.slice(1)
                : '—'
            } />
          </View>

          {job.photos && job.photos.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Previously Submitted Photos</Text>
              <View style={styles.photoGrid}>
                {job.photos.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.photo} />
                ))}
              </View>
            </View>
          )}

          {canWork && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {isRevision ? 'Add More Photos' : 'Submit Your Work'}
              </Text>
              <View style={styles.photoGrid}>
                {photos.map((uri, i) => (
                  <TouchableOpacity key={i} onLongPress={() => removePhoto(i)} activeOpacity={0.8}>
                    <Image source={{ uri }} style={styles.photo} />
                    <View style={styles.removeOverlay}>
                      <Text style={styles.removeX}>✕</Text>
                    </View>
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
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Any notes for the manager..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                scrollEnabled={false}
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
                    <Text style={styles.ctaText}>Start Job</Text>
                  </TouchableOpacity>
                )}
                {canWork && (
                  <TouchableOpacity
                    style={[styles.submitBtn, photos.length === 0 && styles.btnDisabled]}
                    onPress={handleSubmit}
                    disabled={photos.length === 0}
                  >
                    <Text style={styles.ctaText}>
                      Submit for Approval ({photos.length} photo{photos.length !== 1 ? 's' : ''})
                    </Text>
                  </TouchableOpacity>
                )}
                {isSubmitted && (
                  <View style={styles.submittedBox}>
                    <Text style={styles.submittedText}>⏳ Awaiting manager review…</Text>
                  </View>
                )}
                {isDone && (
                  <View style={[styles.submittedBox, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
                    <Text style={[styles.submittedText, { color: '#388E3C' }]}>✅ Job Completed</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Küçük yardımcı bileşen ──────────────────────────────────────────────────
function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 20 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  backBtn:     { padding: 4 },
  backText:    { color: Colors.white, fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },

  statusBanner: {
    margin: 16, marginBottom: 8,
    padding: 12, borderRadius: 10,
    borderWidth: 1, alignItems: 'center',
  },
  statusLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },

  revisionCard: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#FFF3E0', borderRadius: 10,
    padding: 14, borderLeftWidth: 4, borderLeftColor: '#FF9800',
  },
  revisionTitle: { fontSize: 14, fontWeight: '700', color: '#E65100', marginBottom: 4 },
  revisionBody:  { fontSize: 13, color: '#BF360C' },

  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  jobTitle:   { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  catRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  catBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  catText:    { fontSize: 12, fontWeight: '600' },
  description:{ fontSize: 13, color: Colors.textSecondary, marginTop: 6, lineHeight: 20 },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 10 },

  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  rowLabel:  { fontSize: 13, color: Colors.textMuted },
  rowValue:  { fontSize: 13, color: Colors.textPrimary, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  photoGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo:         { width: 90, height: 90, borderRadius: 10, backgroundColor: Colors.border },
  removeOverlay: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  removeX:       { color: '#fff', fontSize: 10, fontWeight: '700' },
  addPhotoBtn:   { width: 90, height: 90, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceAlt },
  addPhotoIcon:  { fontSize: 22 },
  addPhotoText:  { fontSize: 10, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },
  photoHint:     { fontSize: 11, color: Colors.textMuted, marginTop: 4 },

  noteInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: Colors.textPrimary,
    backgroundColor: Colors.background, minHeight: 100,
    textAlignVertical: 'top',
  },

  ctaArea:     { marginHorizontal: 16, marginTop: 16, marginBottom: 60, gap: 12 },
  startBtn:    { backgroundColor: Colors.inProgress, borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: '#0F4870' },
  submitBtn:   { backgroundColor: Colors.primary, borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: Colors.accent },
  btnDisabled: { opacity: 0.4 },
  ctaText:     { color: Colors.white, fontSize: 15, fontWeight: '700' },

  submittedBox:  { backgroundColor: Colors.pendingApprovalBg, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.pendingApprovalBorder },
  submittedText: { fontSize: 15, fontWeight: '700', color: Colors.pendingApproval },
  notFound:      { fontSize: 16, color: Colors.textMuted },
});