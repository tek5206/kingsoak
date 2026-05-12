import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { Colors, StatusConfig, CategoryConfig } from '../../constants/theme';

export default function EngineerDashboard({ navigation, route }) {
  const { userName } = route.params || {};
  const [jobs, setJobs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState('active');

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'jobs'),
      where('assignedTo', '==', uid),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setRefreshing(false);
    });
    return unsub;
  }, [uid]);

  const ACTIVE_STATUSES = ['pending', 'in_progress', 'needs_revision'];

  const filteredJobs = jobs.filter(j => {
    if (filter === 'active') return ACTIVE_STATUSES.includes(j.status);
    if (filter === 'completed') return j.status === 'completed' || j.status === 'pending_approval';
    return true;
  });

  const activeCt    = jobs.filter(j => ACTIVE_STATUSES.includes(j.status)).length;
  const completedCt = jobs.filter(j => j.status === 'completed' || j.status === 'pending_approval').length;

  const renderJob = ({ item }) => {
    const sc = StatusConfig[item.status] || StatusConfig.pending;
    const cc = CategoryConfig[item.category] || CategoryConfig.General;
    const isRevision = item.status === 'needs_revision';

    return (
      <TouchableOpacity
        style={[styles.card, isRevision && styles.cardRevision]}
        onPress={() => navigation.navigate('EngineerJobDetail', { jobId: item.id })}
        activeOpacity={0.85}
      >
        {isRevision && (
          <View style={styles.revisionBanner}>
            <Text style={styles.revisionBannerText}>Revision Requested</Text>
          </View>
        )}

        <View style={styles.cardTop}>
          <View style={[styles.catBadge, { backgroundColor: cc.bg }]}>
            <Text style={[styles.catText, { color: cc.color }]}>{item.category}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardAddress} numberOfLines={1}>📍 {item.address || 'No address'}</Text>

        <View style={styles.cardBottom}>
          <Text style={styles.cardMeta}>
            {item.scheduledDate ? ` ${item.scheduledDate}` : '📅 Not scheduled'}
          </Text>
          <Text style={styles.viewMore}>View →</Text>
        </View>
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
          { key: 'active',   label: 'Active',    count: activeCt    },
          { key: 'completed',label: 'Completed', count: completedCt },
          { key: 'all',      label: 'All',       count: jobs.length },
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
            <RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} tintColor={Colors.primary} />
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

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerSub:  { fontSize: 12, color: Colors.accentLight },
  headerName: { fontSize: 20, fontWeight: '800', color: Colors.white },
  logoutBtn:  {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  logoutText: { color: Colors.accentLight, fontSize: 13, fontWeight: '600' },

  summaryRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  summaryBox:     { flex: 1, alignItems: 'center', paddingVertical: 14 },
  summaryDivider: {
    borderLeftWidth: 1, borderRightWidth: 1,
    borderLeftColor: Colors.divider, borderRightColor: Colors.divider,
  },
  summaryNum:   { fontSize: 22, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12, paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText:       { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: Colors.white },

  listContent: { padding: 14, paddingBottom: 40 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardRevision: { borderColor: Colors.needsRevision },

  revisionBanner: {
    backgroundColor: Colors.needsRevisionBg,
    borderRadius: 8, paddingVertical: 6,
    alignItems: 'center', marginBottom: 10,
  },
  revisionBannerText: { color: Colors.needsRevision, fontWeight: '700', fontSize: 13 },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },

  catBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  catIcon: { fontSize: 12, marginRight: 4 },
  catText: { fontSize: 11, fontWeight: '700' },

  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  cardTitle:   { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  cardAddress: { fontSize: 12, color: Colors.textMuted, marginBottom: 10 },
  cardBottom:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 10,
  },
  cardMeta: { fontSize: 12, color: Colors.textSecondary },
  viewMore:  { fontSize: 13, color: Colors.primary, fontWeight: '700' },

  empty:     { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, color: Colors.textMuted },
});
