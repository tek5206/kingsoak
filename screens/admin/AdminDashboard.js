import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  RefreshControl, TextInput, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { Colors, StatusConfig, CategoryConfig } from '../../constants/theme';

const FILTERS = ['all', 'pending', 'in_progress', 'pending_approval', 'needs_revision', 'completed'];

// FIX: Kategori normalizasyonu
function getCategories(job) {
  if (Array.isArray(job.categories) && job.categories.length > 0) return job.categories;
  if (job.category) return [job.category];
  return [];
}

export default function AdminDashboard({ navigation, route }) {
  const { userName } = route.params || {};
  const [jobs, setJobs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState('all');
  const [search, setSearch]         = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const insets = useSafeAreaInsets();

  // FIX: onSnapshot'u ref'te tut — pull-to-refresh yeniden abone olmak yerine
  //      snapshot zaten gerçek zamanlı; refreshing bayrağını manuel kaldır
  const unsubRef = useRef(null);

  const subscribe = useCallback(() => {
    if (unsubRef.current) unsubRef.current(); // önceki listener'ı temizle
    const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    unsubRef.current = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setRefreshing(false); // FIX: veri gelince refreshing'i kapat
    }, () => {
      setLoading(false);
      setRefreshing(false);
    });
  }, []);

  useEffect(() => {
    subscribe();
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [subscribe]);

  // FIX: pull-to-refresh gerçek veri yenilemesi — listener'ı yeniden başlat
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    subscribe();
  }, [subscribe]);

  const filteredJobs = jobs.filter(j => {
    const matchStatus = filter === 'all' || j.status === filter;
    const matchSearch = search === '' ||
      j.title?.toLowerCase().includes(search.toLowerCase()) ||
      j.assignedToName?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === 'all' ? jobs.length : jobs.filter(j => j.status === f).length;
    return acc;
  }, {});

  const currentLabel = filter === 'all' ? 'All Jobs' : StatusConfig[filter]?.label || filter;
  const currentSc    = filter !== 'all' ? StatusConfig[filter] : null;

  const renderJob = ({ item }) => {
    const sc = StatusConfig[item.status] || StatusConfig.pending;

    // FIX: category normalizasyonu
    const cats        = getCategories(item);
    const primaryCat  = cats[0] || 'General';
    const cc          = CategoryConfig[primaryCat] || CategoryConfig.General;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AdminJobDetail', { jobId: item.id })}
        activeOpacity={0.75}
      >
        <View style={styles.cardTop}>
          <View style={[styles.catDot, { backgroundColor: cc.color }]} />
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>👤 {item.assignedToName || 'Unassigned'}</Text>
          {item.scheduledDate
            ? <Text style={styles.metaText}>📅 {item.scheduledDate}</Text>
            : null}
        </View>

        {cats.length > 1 && (
          <Text style={styles.extraCats}>+{cats.slice(1).join(', ')}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Admin Panel</Text>
          <Text style={styles.headerName}>{userName || 'Admin'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowFilter(true)}>
            <Text style={styles.headerBtnText}>Filter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, styles.headerBtnPrimary]}
            onPress={() => navigation.navigate('CreateJob')}
          >
            <Text style={[styles.headerBtnText, { color: Colors.primary }]}>+ New Job</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => signOut(auth)}>
            <Text style={styles.headerBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search jobs or engineers…"
          placeholderTextColor={Colors.textMuted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Active filter label */}
      <View style={styles.filterLabel}>
        <Text style={styles.filterLabelText}>
          {currentLabel}{currentSc ? '' : ''} — {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} size="large" />
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={j => j.id}
          renderItem={renderJob}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No jobs found</Text>
            </View>
          }
        />
      )}

      {/* Filter modal */}
      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFilter(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.modalTitle}>Filter by Status</Text>
          {FILTERS.map(f => {
            const sc = f === 'all' ? null : StatusConfig[f];
            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterOption, filter === f && styles.filterOptionActive]}
                onPress={() => { setFilter(f); setShowFilter(false); }}
              >
                <Text style={[styles.filterOptionText, filter === f && { color: Colors.primary }]}>
                  {sc ? sc.label : 'All Jobs'} ({counts[f]})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 16 },
  headerSub:  { fontSize: 12, color: Colors.accentLight },
  headerName: { fontSize: 20, fontWeight: '800', color: Colors.white },
  headerBtn:  { backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  headerBtnPrimary: { backgroundColor: Colors.accent },
  headerBtnText:    { color: Colors.accentLight, fontSize: 12, fontWeight: '600' },

  searchBar:   { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  searchInput: { backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },

  filterLabel:     { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  filterLabelText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  listContent: { padding: 14, paddingBottom: 40 },

  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  catDot:       { width: 8, height: 8, borderRadius: 4 },
  cardTitle:    { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  statusPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusPillText:{ fontSize: 11, fontWeight: '700' },
  cardMeta:     { flexDirection: 'row', gap: 16 },
  metaText:     { fontSize: 12, color: Colors.textMuted },
  extraCats:    { fontSize: 11, color: Colors.textMuted, marginTop: 4 },

  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 15, color: Colors.textMuted },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  modalSheet:   { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:   { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16 },
  filterOption:       { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  filterOptionActive: { backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 8 },
  filterOptionText:   { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
});