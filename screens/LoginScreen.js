import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert, Image,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Colors } from '../constants/theme';
import { Feather } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [pwVisible, setPwVisible] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password.trim());
    } catch {
      Alert.alert('Login Failed', 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>KINGS OAK</Text>
          <View style={styles.brandLine} />
          <Text style={styles.brandSub}>PROPERTY SOLUTIONS</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSub}>Enter your information to continue</Text>
          </View>

          <Text style={styles.label}>EMAIL</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.inputText}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={[styles.inputText, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!pwVisible}
            />
            <TouchableOpacity onPress={() => setPwVisible(v => !v)} style={styles.eyeBtn}>
  <Feather
    name={pwVisible ? 'eye-off' : 'eye'}
    size={20}
    color="#6B7C93"
  />
</TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#0B1D2E" size="small" />
              : <Text style={styles.btnText}>Log In</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>© 2025 Kings Oak Ltd</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const BG = '#0D2137'; 

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: BG },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    backgroundColor: BG,
  },

  // Hero
  hero:      { alignItems: 'center', marginBottom: 32 },
  logo:      { width: 120, height: 120, marginBottom: 14 },
  brandName: {
    fontSize: 24, fontWeight: '900', color: '#FFFFFF',
    letterSpacing: 7, marginBottom: 10,
  },
  brandLine: {
    width: 40, height: 2,
    backgroundColor: '#C9A84C',
    borderRadius: 2, marginBottom: 10,
  },
  brandSub: {
    fontSize: 11, color: '#C9A84C',
    letterSpacing: 2.5, fontWeight: '600',
  },

  // Card
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingVertical: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  cardHeader: { marginBottom: 24 },
  cardTitle:  { fontSize: 22, fontWeight: '800', color: BG },
  cardSub:    { fontSize: 13, color: '#8A9BB5', marginTop: 4 },

  label: {
    fontSize: 11, fontWeight: '700',
    color: '#4A6080', letterSpacing: 1.5,
    marginBottom: 8, marginTop: 14,
  },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#D8E2F0',
    borderRadius: 12, backgroundColor: '#F6F8FB',
    paddingHorizontal: 16, height: 52,
  },
  inputText: { flex: 1, fontSize: 15, color: BG },
  eyeBtn:    { paddingLeft: 10 },

  btn: {
    marginTop: 26,
    backgroundColor: '#C9A84C',
    borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 3, borderBottomColor: '#9A7A30',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  btnText: {
    fontSize: 16, fontWeight: '800',
    color: BG, letterSpacing: 0.5,
  },

  footer: {
    marginTop: 30, fontSize: 11,
    color: '#2A4A6A', textAlign: 'center',
  },
});