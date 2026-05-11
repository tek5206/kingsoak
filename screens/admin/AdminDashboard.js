import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
  RefreshControl, TextInput,
} from 'react-native';
import {
  collection, query, orderBy, onSnapshot,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { Colors, StatusConfig, CategoryConfig } from '../../constants/theme';

export default function AdminDashboard({ navigation, route }) {
  const { userName } = route.params || {};
  const [jobs, setJobs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState('all');
  const [search, setSearch]       = useState('');

  const FILTERS = ['all', 'pending', 'in_progress', 'pending_approval', 'needs_revision', 'completed'];

  useEffect(() => {
    const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setRefreshing(false);
    });
    return unsub;
  }, []);

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

  const onRefresh = useCallback(() => setRefreshing(true), []);

  const handleLogout = () => signOut(auth);

  const renderJob = ({ item }) => {
    const sc = StatusConfig[item.status] || StatusConfig.pending;
    const cc = CategoryConfig[item.category] || CategoryConfig.General;
    return (
      <TouchableOpacity
        style={styles.jobCard}
        onPress={() => navigation.navigate('AdminJobDetail', { jobId: item.id })}
        activeOpacity={0.85}
      >
        <View style={styles.jobCardTop}>
          <View style={[styles.catBadge, { backgroundColor: cc.bg }]}>
            <Text style={styles.catIcon}>{cc.icon}</Text>
            <Text style={[styles.catText, { color: cc.color }]}>{item.category}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>

        <Text style={styles.jobTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.jobAddress} numberOfLines={1}>📍 {item.address || 'No address'}</Text>

        <View style={styles.jobCardBottom}>
          <Text style={styles.jobMeta}>👤 {item.assignedToName || 'Unassigned'}</Text>
          <Text style={styles.jobMeta}>
            {item.scheduledDate
              ? `📅 ${item.scheduledDate}`
              : '📅 Not scheduled'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Welcome back,</Text>
          <Text style={styles.headerName}>{userName || 'Admin'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{counts.all}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: Colors.pending }]}>{counts.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: Colors.inProgress }]}>{counts.in_progress}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: Colors.completed }]}>{counts.completed}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search jobs or engineers..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Filter tabs */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={f => f}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item: f }) => (
          <TouchableOpacity
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : StatusConfig[f]?.label || f}{' '}
              <Text style={styles.filterCount}>({counts[f]})</Text>
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Job list */}
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} size="large" />
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={j => j.id}
          renderItem={renderJob}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No jobs found</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateJob')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+ New Job</Text>
      </TouchableOpacity>
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

  statsRow: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  statBox:   { flex: 1, alignItems: 'center' },
  statNum:   { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  searchWrap: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.surface },
  searchInput: {
    backgroundColor: Colors.background,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border,
  },

  filterList: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.surface },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, marginRight: 8,
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText:      { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  filterTextActive:{ color: Colors.white },
  filterCount:     { fontWeight: '400' },

  listContent: { padding: 14, paddingBottom: 100 },

  jobCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14, padding: 16,
    marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  jobCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },

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

  jobTitle:   { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  jobAddress: { fontSize: 12, color: Colors.textMuted, marginBottom: 10 },

  jobCardBottom: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 10,
  },
  jobMeta: { fontSize: 12, color: Colors.textSecondary },

  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: Colors.textMuted },

  fab: {
    position: 'absolute', bottom: 24, right: 20, left: 20,
    backgroundColor: Colors.accent,
    borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 3, borderBottomColor: '#9A7A30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
});
