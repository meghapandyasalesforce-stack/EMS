# 📱 Mobile App Installation Guide

Your Paarsiv EMS app can be installed on mobile devices in **two ways**:

## 🌐 Method 1: PWA (Progressive Web App) - Easiest!

**Users can install the app directly from their mobile browser** - No app store needed!

### How Users Install PWA:

#### **On Android (Chrome/Samsung Internet):**
1. Open the app in Chrome browser: `https://your-domain.com`
2. Look for the **"Add to Home Screen"** banner at the bottom
3. OR tap the **3-dot menu (⋮)** → **"Add to Home Screen"** or **"Install App"**
4. Tap **"Install"** or **"Add"**
5. The app icon will appear on the home screen like a native app!

#### **On iOS (Safari):**
1. Open the app in Safari browser: `https://your-domain.com`
2. Tap the **Share button (□↑)** at the bottom
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** in the top right
5. The app icon will appear on the home screen!

### Enable Install Prompt (Optional):

To show an automatic "Install App" button, add this component to your app:

```jsx
// Add to your main App.jsx or Header component
import { useEffect, useState } from 'react';

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  if (!showInstallButton) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="bg-blue-500 text-white px-4 py-2 rounded-lg"
    >
      📱 Install App
    </button>
  );
}
```

### PWA Requirements:
✅ **HTTPS required** (or localhost for development)  
✅ **Manifest.json** - ✅ Already configured  
✅ **Service Worker** - ✅ Already configured  
✅ **Icons** - ✅ Already configured (logo192.png, logo512.png)

---

## 📦 Method 2: Native App (Capacitor) - Full Native Experience

Build actual **.apk** (Android) or **.ipa** (iOS) files that can be installed like regular apps.

### For Android:

#### **Step 1: Build the App**
```bash
cd vite_client
npm run build
npx cap sync
```

#### **Step 2: Generate APK**

**Option A: Using Android Studio (Recommended)**
1. Open Android Studio:
   ```bash
   npm run android
   ```
2. Wait for Gradle sync
3. Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**
4. APK will be in: `android/app/build/outputs/apk/debug/app-debug.apk`

**Option B: Using Command Line**
```bash
cd android
./gradlew assembleDebug
# APK location: app/build/outputs/apk/debug/app-debug.apk
```

#### **Step 3: Install APK on Phone**

**Method 1: Direct Transfer**
1. Copy `app-debug.apk` to your phone (USB, email, cloud)
2. On phone: **Settings > Security > Enable "Unknown Sources"**
3. Open the APK file and tap **"Install"**

**Method 2: ADB (Android Debug Bridge)**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Method 3: QR Code (Easy!)**
1. Upload APK to a file sharing service
2. Generate QR code with the download link
3. Scan QR code with phone camera
4. Download and install

#### **Step 4: Release Build (For Production)**

For production, create a signed APK:

1. **Generate Keystore:**
   ```bash
   keytool -genkey -v -keystore paarsiv-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias paarsiv
   ```

2. **Configure in `android/app/build.gradle`:**
   ```gradle
   android {
       signingConfigs {
           release {
               storeFile file('paarsiv-release-key.jks')
               storePassword 'your-password'
               keyAlias 'paarsiv'
               keyPassword 'your-password'
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
           }
       }
   }
   ```

3. **Build Release APK:**
   ```bash
   cd android
   ./gradlew assembleRelease
   # APK location: app/build/outputs/apk/release/app-release.apk
   ```

### For iOS:

#### **Step 1: Build the App**
```bash
cd vite_client
npm run build
npx cap sync
```

#### **Step 2: Open in Xcode**
```bash
npm run ios
```

#### **Step 3: Build for Device**

1. **Connect iPhone/iPad via USB**
2. In Xcode:
   - Select your device from the device dropdown
   - Select your **Development Team** (Apple Developer account required)
   - Click **"Run"** button (▶️)
3. On your device: **Settings > General > VPN & Device Management** → Trust your developer

#### **Step 4: Create IPA for Distribution**

1. In Xcode: **Product > Archive**
2. Wait for archive to complete
3. **Distribute App** → Choose distribution method:
   - **App Store Connect** (for App Store)
   - **Ad Hoc** (for specific devices)
   - **Enterprise** (for internal distribution)
   - **Development** (for testing)

---

## 🎯 Quick Comparison

| Feature | PWA | Native App (Capacitor) |
|---------|-----|------------------------|
| **Installation** | From browser | APK/IPA file |
| **App Store** | ❌ Not needed | ✅ Optional |
| **Offline Support** | ✅ Yes (Service Worker) | ✅ Yes |
| **Native Features** | ⚠️ Limited | ✅ Full access |
| **Updates** | ✅ Automatic | ⚠️ Manual |
| **Distribution** | ✅ Just share URL | ⚠️ Need to distribute file |
| **Best For** | Quick deployment | Full native experience |

---

## 🚀 Recommended Approach

### For Quick Deployment:
**Use PWA** - Users can install directly from the website!

### For Full Native Features:
**Use Capacitor** - Build APK/IPA files for:
- App Store distribution
- Better performance
- Full native API access
- Push notifications (better support)

### For Both:
**Do both!** PWA for easy access, Native app for app stores.

---

## 📋 Checklist for PWA Installation

- [x] ✅ Manifest.json configured
- [x] ✅ Service Worker configured
- [x] ✅ Icons (192x192, 512x512) added
- [x] ✅ HTTPS enabled (required for PWA)
- [ ] ⚠️ Test install prompt on mobile device
- [ ] ⚠️ Verify offline functionality

## 📋 Checklist for Native App

- [x] ✅ Capacitor configured
- [x] ✅ Android/iOS platforms added
- [ ] ⚠️ App icons added (all sizes)
- [ ] ⚠️ Splash screens added
- [ ] ⚠️ Permissions configured
- [ ] ⚠️ Build and test APK/IPA

---

## 🔧 Troubleshooting

### PWA Not Showing Install Prompt?

1. **Check HTTPS:** PWA requires HTTPS (except localhost)
2. **Check Manifest:** Verify `manifest.json` is accessible
3. **Check Service Worker:** Verify it's registered
4. **Clear Cache:** Clear browser cache and try again
5. **Check Browser:** Some browsers don't support PWA install

### APK Won't Install?

1. **Enable Unknown Sources:** Settings > Security > Unknown Sources
2. **Check Android Version:** Ensure device supports the app
3. **Check Permissions:** Verify all permissions are granted
4. **Try Debug APK First:** Test with debug build before release

### iOS Build Fails?

1. **Check Apple Developer Account:** Need valid account
2. **Check Signing:** Verify code signing in Xcode
3. **Check Provisioning Profile:** Ensure it's valid
4. **Check Device UDID:** For ad-hoc distribution

---

## 📞 Need Help?

- **PWA Issues:** Check browser console for errors
- **Capacitor Issues:** See `MOBILE_APP_SETUP.md`
- **Build Issues:** Check native IDE logs (Android Studio/Xcode)

---

**Your app is ready to install! 🎉**

Choose the method that works best for your needs!

