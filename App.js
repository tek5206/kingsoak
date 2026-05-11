import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Colors } from './constants/theme';

import LoginScreen       from './screens/LoginScreen';
import AdminDashboard    from './screens/admin/AdminDashboard';
import CreateJobScreen   from './screens/admin/CreateJobScreen';
import AdminJobDetail    from './screens/admin/AdminJobDetail';
import EngineerDashboard from './screens/engineer/EngineerDashboard';
import EngineerJobDetail from './screens/engineer/EngineerJobDetail';

const Stack = createStackNavigator();
const NO_HEADER = { headerShown: false };

export default function App() {
  const [user, setUser]         = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          setUserInfo(snap.exists() ? snap.data() : null);
        } catch (e) {
          setUserInfo(null);
        }
      } else {
        setUser(null);
        setUserInfo(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const userName = userInfo
    ? `${userInfo.name || ''} ${userInfo.surname || ''}`.trim()
    : '';

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={NO_HEADER}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : userInfo?.role === 'admin' ? (
          <>
            <Stack.Screen
              name="AdminDashboard"
              component={AdminDashboard}
              initialParams={{ userName }}
            />
            <Stack.Screen name="CreateJob"     component={CreateJobScreen} />
            <Stack.Screen name="AdminJobDetail" component={AdminJobDetail} />
          </>
        ) : (
          <>
            <Stack.Screen
              name="EngineerDashboard"
              component={EngineerDashboard}
              initialParams={{ userName }}
            />
            <Stack.Screen name="EngineerJobDetail" component={EngineerJobDetail} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
