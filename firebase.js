import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            'AIzaSyB6jEek__xljHlruC22VX3Mo0oQsS9RGPE',
  authDomain:        'kings-oak-demo.firebaseapp.com',
  projectId:         'kings-oak-demo',
  storageBucket:     'kings-oak-demo.firebasestorage.app',
  messagingSenderId: '368241787491',
  appId:             '1:368241787491:web:482a43ad49bf29e1636e56',
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app);
