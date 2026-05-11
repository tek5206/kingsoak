import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Colors } from '../constants/theme';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password.trim());
    } catch (err) {
      Alert.alert('Login Failed', 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {/* Logo / Header */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>KO</Text>
          </View>
          <Text style={styles.appName}>Kings Oak</Text>
          <Text style={styles.tagline}>Field Service Management</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.primary} />
              : <Text style={styles.btnText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>© 2025 Kings Oak Ltd</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  inner: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoArea:   { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  logoText:  { fontSize: 28, fontWeight: '800', color: Colors.primary },
  appName:   { fontSize: 26, fontWeight: '800', color: Colors.white, letterSpacing: 1 },
  tagline:   { fontSize: 13, color: Colors.accentLight, marginTop: 4 },

  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 20, fontWeight: '700',
    color: Colors.textPrimary, marginBottom: 20,
  },
  label: {
    fontSize: 13, fontWeight: '600',
    color: Colors.textSecondary, marginBottom: 6,
  },
  input: {
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 14,
    fontSize: 15, color: Colors.textPrimary,
    backgroundColor: Colors.surfaceAlt,
    marginBottom: 16,
  },
  btn: {
    backgroundColor: Colors.accent,
    borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
    borderBottomWidth: 3,
    borderBottomColor: '#9A7A30',
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { fontSize: 16, fontWeight: '700', color: Colors.primary },

  footer: { marginTop: 32, fontSize: 12, color: Colors.primaryLight },
});
