# Kings Oak — Field Service Management App

<p align="center">
  <img src="assets/logo.png" alt="Kings Oak Logo" width="120" />
</p>

<p align="center">
  <strong>Mobile-first job management platform for field engineers and operations teams</strong><br/>
  Built with Expo · React Native · Firebase
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white" />
  <img src="https://img.shields.io/badge/React%20Native-0.81.5-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase-12.x-FFCA28?logo=firebase&logoColor=black" />
  <img src="https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Platform-iOS%20%7C%20Android-lightgrey" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Job Lifecycle](#job-lifecycle)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Firebase Setup](#firebase-setup)
- [Deployment](#deployment)
- [Security](#security)

---

## Overview

Kings Oak is a **field service management application** built for Kings Oak Ltd. It connects office administrators with on-site engineers, enabling end-to-end job tracking from assignment through to approval — with real-time push notifications and email alerts at every step.

The app supports two distinct user roles:

| Role | Capabilities |
|---|---|
| **Admin** | Create, assign, edit and approve jobs; view all engineers; receive approval requests |
| **Engineer** | View assigned jobs; start work; submit photo evidence and notes; respond to revisions |

---

## Features

### Admin
- Create and assign jobs with title, description, address, category, priority, and scheduled date
- Real-time dashboard with status filtering and engineer search
- Review photo submissions; approve or request revision with comments
- Edit job details inline at any time
- Receive push notifications and email alerts when work is submitted for approval

### Engineer
- Personal job list filtered by Active / Completed / All
- Start job, upload photo evidence (camera or library), add notes
- Re-submit work after a manager revision request
- Receive push notifications and email alerts on new assignments and status changes

### Platform
- Real-time data sync via Firestore `onSnapshot`
- Expo Push Notifications (iOS & Android)
- Transactional email via Gmail / Nodemailer (Cloud Functions)
- Image compression before upload (`expo-image-manipulator`)
- Firebase Storage for photo assets
- Role-based access control via Firestore Security Rules

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              React Native (Expo)            │
│                                             │
│  ┌──────────────┐    ┌────────────────────┐ │
│  │    Admin UI  │    │   Engineer UI      │ │
│  │  Dashboard   │    │   Dashboard        │ │
│  │  Job Detail  │    │   Job Detail       │ │
│  │  Create Job  │    │   Photo Upload     │ │
│  └──────┬───────┘    └────────┬───────────┘ │
│         │                    │              │
└─────────┼────────────────────┼─────────────┘
          │   Firebase SDK     │
          ▼                    ▼
┌─────────────────────────────────────────────┐
│                  Firebase                   │
│                                             │
│  ┌────────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Firestore  │  │  Auth    │  │ Storage │ │
│  │  /jobs     │  │  Email/  │  │  Photos │ │
│  │  /users    │  │  Password│  │         │ │
│  └─────┬──────┘  └──────────┘  └─────────┘ │
│        │ triggers                           │
│        ▼                                   │
│  ┌─────────────────────────────────────┐   │
│  │       Cloud Functions (Node 20)     │   │
│  │  onJobCreated  → notify engineer    │   │
│  │  onJobUpdated  → notify admin /     │   │
│  │                  engineer           │   │
│  │  Channels: Expo Push + Email        │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## Job Lifecycle

```
         Admin creates job
               │
               ▼
           [pending]  ──────────────────────────────────────┐
               │                                            │
         Engineer starts                              Admin edits
               │                                       (any time)
               ▼
         [in_progress]
               │
        Engineer submits
        (photos + notes)
               │
               ▼
      [pending_approval]  ◄─────────────────────────────────┐
               │                                            │
        ┌──────┴──────┐                                     │
        │             │                                     │
    Admin          Admin                                    │
   approves      requests                                   │
        │        revision                                   │
        │             │                                     │
        ▼             ▼                                     │
   [completed]  [needs_revision] ──► Engineer resubmits ───┘
```

Each status transition triggers a **push notification** and **email** to the relevant party.

---

## Project Structure

```
kingsoak/
│
├── App.js                          # Root: auth state, role-based navigation
├── firebase.js                     # Firebase app initialisation
├── firestore.rules                 # Firestore Security Rules
│
├── constants/
│   └── theme.js                    # Colors, StatusConfig, CategoryConfig, PriorityConfig
│
├── hooks/
│   └── usePushNotifications.js     # Expo push token registration & Firestore sync
│
├── utils/
│   └── dateHelpers.js              # DD/MM/YYYY parse, validate, format, compare
│
├── screens/
│   ├── LoginScreen.js
│   ├── admin/
│   │   ├── AdminDashboard.js       # All jobs; filter, search, real-time
│   │   ├── AdminJobDetail.js       # View/edit/approve/reject a job
│   │   └── CreateJobScreen.js      # Create or edit a job
│   └── engineer/
│       ├── EngineerDashboard.js    # Assigned jobs; Active / Completed tabs
│       └── EngineerJobDetail.js    # Start job, upload photos, submit
│
└── functions/
    ├── index.js                    # Cloud Functions: onJobCreated, onJobUpdated
    ├── package.json
    └── .env.local                  # Local secrets (never commit)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Firebase CLI](https://firebase.google.com/docs/cli)
- A physical iOS or Android device (push notifications require a real device)

### 1. Clone & install

```bash
git clone https://github.com/your-org/kingsoak.git
cd kingsoak
npm install
```

### 2. Configure Firebase

Copy your Firebase project config into `firebase.js`:

```js
// firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth }       from 'firebase/auth';
import { getFirestore }  from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
```

### 3. Update the Storage bucket constant

In `screens/engineer/EngineerJobDetail.js`, set your bucket name:

```js
const BUCKET = 'your-project.firebasestorage.app';
```

### 4. Start the development server

```bash
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

---

## Environment Variables

Cloud Functions use **Firebase Secret Manager** in production and a local `.env.local` file for the emulator.

### Production (Secret Manager)

```bash
firebase functions:secrets:set GMAIL_USER
firebase functions:secrets:set GMAIL_PASS
```

### Local emulator

Create `functions/.env.local` (never commit this file):

```env
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-gmail-app-password
```

> **Gmail App Password:** Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) and generate a 16-character app password. Do **not** use your main Gmail password.

Add to `functions/.gitignore`:

```
.env.local
```

---

## Firebase Setup

### Firestore indexes

The app queries jobs ordered by `createdAt` and filtered by `assignedTo`. Create composite indexes in the Firebase console or via `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "jobs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "assignedTo", "order": "ASCENDING" },
        { "fieldPath": "createdAt",  "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Firestore Security Rules

Deploy the included `firestore.rules` file:

```bash
firebase deploy --only firestore:rules
```

**Rule summary:**

| Collection | Admin | Engineer |
|---|---|---|
| `users` | Full read/write | Own profile read; own `expoPushToken` update only |
| `jobs` | Full read/write | Read own jobs; update `status`, `photos`, `engineerNote` only |

### Cloud Functions — deploy

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Functions are deployed to `europe-west1` region.

---

## Deployment

### Build for production (EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure
eas build:configure

# Build
eas build --platform all
```

### Over-the-air updates (EAS Update)

```bash
eas update --branch production --message "Release notes here"
```

---

## Security

| Area | Implementation |
|---|---|
| Authentication | Firebase Email/Password — all routes require a signed-in user |
| Authorisation | Firestore Security Rules enforce role-based access at the database level |
| Push tokens | Stored per-user in Firestore; only writable by the owning user |
| Email credentials | Firebase Secret Manager in production; local `.env.local` for development |
| Photo uploads | Firebase Auth token refreshed before each upload; 30-second timeout per file |
| Date validation | `utils/dateHelpers.js` validates DD/MM/YYYY before any Firestore write |

---

## Notification Flow

```
Event                        │  Who receives        │  Channels
─────────────────────────────┼──────────────────────┼──────────────────
Job created & assigned       │  Engineer            │  Push + Email
Engineer submits for review  │  All admins          │  Push + Email
Admin approves               │  Engineer            │  Push
Admin requests revision      │  Engineer            │  Push + Email
```

---

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "feat: description"`
3. Push and open a Pull Request

Please follow the existing code style and ensure Firestore rules are updated if new collections or access patterns are introduced.

---

<p align="center">
  © 2025 Kings Oak Ltd — All rights reserved
</p>