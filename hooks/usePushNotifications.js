import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function usePushNotifications() {
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);
}

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log('Push notifications sadece gerçek cihazda çalışır.');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C9A84C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification izni verilmedi.');
    return;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '0e5b349a-e86b-4626-9b4f-7ca0a275d32e',
    });
    const expoPushToken = tokenData.data;

    const uid = auth.currentUser?.uid;
    if (uid && expoPushToken) {
      await updateDoc(doc(db, 'users', uid), { expoPushToken });
      console.log('Push token kaydedildi:', expoPushToken);
    }
  } catch (err) {
    console.error('Push token alınamadı:', err);
  }
}