import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { Colors, StatusConfig, CategoryConfig } from '../../constants/theme';

const ACTIVE_STATUSES = ['pending', 'in_progress', 'needs_revision'];

// FIX: Kategori normalizasyonu
function getCategories(job) {
  if (Array.isArray(job.categories) && job.categories.length > 0) return job.categories;
  if (job.category) return [job.category];
  return [];
}

export default function EngineerDashboard({ navigation, route }) {
  const { userName } = route.params || {};
  const [jobs, setJobs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState('active');

  const uid = auth.currentUser?.uid;

  // FIX: Listener ref'te sakla — refresh gerçek yeniden abone olma
  const unsubRef = useRef(null);

  const subscribe = useCallback(() => {
    if (!uid) return;
    if (unsubRef.current) unsubRef.current();

    const q = query(
      collection(db, 'jobs'),
      where('assignedTo', '==', uid),
      orderBy('createdAt', 'desc'),
    );
    unsubRef.current = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setRefreshing(false); // FIX: veri gelince kapat
    }, () => {
      setLoading(false);
      setRefreshing(false);
    });
  }, [uid]);

  useEffect(() => {
    subscribe();
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [subscribe]);

  // FIX: Gerçek refresh — listener yeniden başlat
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    subscribe();
  }, [subscribe]);

  const filteredJobs = jobs.filter(j => {
    if (filter === 'active')    return ACTIVE_STATUSES.includes(j.status);
    if (filter === 'completed') return j.status === 'completed' || j.status === 'pending_approval';
    return true;
  });

  const activeCt    = jobs.filter(j => ACTIVE_STATUSES.includes(j.status)).length;
  const completedCt = jobs.filter(j => j.status === 'completed' || j.status === 'pending_approval').length;

  const renderJob = ({ item }) => {
    const sc = StatusConfig[item.status] || StatusConfig.pending;

    // FIX: category normalizasyonu
    const cats       = getCategories(item);
    const primaryCat = cats[0] || 'General';
    const cc         = CategoryConfig[primaryCat] || CategoryConfig.General;
    const isRevision = item.status === 'needs_revision';

    return (
      <TouchableOpacity
        style={[styles.card, isRevision && styles.cardRevision]}
        onPress={() => navigation.navigate('EngineerJobDetail', { jobId: item.id })}
        activeOpacity={0.75}
      >
        {isRevision && (
          <Text style={styles.revisionBadge}>⚠️ Revision Requested</Text>
        )}
        <View style={styles.cardTop}>
          <View style={[styles.catDot, { backgroundColor: cc.color }]} />
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>
        <Text style={styles.metaText}>
          {item.scheduledDate ? `📅 ${item.scheduledDate}` : '📅 Not scheduled'}
        </Text>
        <Text style={styles.viewMore}>View →</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>My Jobs</Text>
          <Text style={styles.headerName}>{userName || 'Engineer'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => signOut(auth)}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={[styles.summaryNum, { color: Colors.inProgress }]}>{activeCt}</Text>
          <Text style={styles.summaryLabel}>Active Jobs</Text>
        </View>
        <View style={[styles.summaryBox, styles.summaryDivider]}>
          <Text style={[styles.summaryNum, { color: Colors.completed }]}>{completedCt}</Text>
          <Text style={styles.summaryLabel}>Completed</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={[styles.summaryNum, { color: Colors.textPrimary }]}>{jobs.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'active',    label: 'Active',    count: activeCt    },
          { key: 'completed', label: 'Completed', count: completedCt },
          { key: 'all',       label: 'All',       count: jobs.length },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, filter === tab.key && styles.tabActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={[styles.tabText, filter === tab.key && styles.tabTextActive]}>
              {tab.label} ({tab.count})
            </Text>
          </TouchableOpacity>
        ))}
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
              <Text style={styles.emptyText}>No jobs here</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 16 },
  headerSub:  { fontSize: 12, color: Colors.accentLight },
  headerName: { fontSize: 20, fontWeight: '800', color: Colors.white },
  logoutBtn:  { backgroundColor: Colors.primaryLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  logoutText: { color: Colors.accentLight, fontSize: 13, fontWeight: '600' },

  summaryRow:     { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  summaryBox:     { flex: 1, alignItems: 'center', paddingVertical: 14 },
  summaryDivider: { borderLeftWidth: 1, borderRightWidth: 1, borderLeftColor: Colors.divider, borderRightColor: Colors.divider },
  summaryNum:     { fontSize: 22, fontWeight: '800' },
  summaryLabel:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  tabs:         { flexDirection: 'row', backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  tab:          { flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center', backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  tabActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText:      { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  tabTextActive:{ color: Colors.white },

  listContent: { padding: 14, paddingBottom: 40 },

  card:         { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardRevision: { borderColor: '#FF9800', borderWidth: 1.5 },
  revisionBadge:{ fontSize: 12, color: '#E65100', fontWeight: '700', marginBottom: 6 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catDot:       { width: 8, height: 8, borderRadius: 4 },
  cardTitle:    { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  statusPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusPillText:{ fontSize: 11, fontWeight: '700' },
  metaText:     { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  viewMore:     { fontSize: 12, color: Colors.primary, fontWeight: '700', textAlign: 'right' },

  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
});