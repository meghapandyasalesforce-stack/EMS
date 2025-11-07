# Mobile App Setup Guide - Paarsiv EMS

This guide will help you set up and build the Paarsiv EMS mobile app for iOS and Android using Capacitor.

## 📱 Prerequisites

### For Android Development:
- [Android Studio](https://developer.android.com/studio) (latest version)
- Java Development Kit (JDK) 17 or higher
- Android SDK (installed via Android Studio)

### For iOS Development (macOS only):
- [Xcode](https://developer.apple.com/xcode/) (latest version)
- [CocoaPods](https://cocoapods.org/) - Install with: `sudo gem install cocoapods`
- macOS with Xcode Command Line Tools

## 🚀 Installation Steps

### 1. Install Dependencies

```bash
cd vite_client
npm install
```

This will install all Capacitor dependencies including:
- `@capacitor/core` - Core Capacitor functionality
- `@capacitor/cli` - Capacitor CLI tools
- `@capacitor/android` - Android platform
- `@capacitor/ios` - iOS platform
- Various Capacitor plugins (App, StatusBar, SplashScreen, Keyboard, etc.)

### 2. Build the Web App

First, build your React app:

```bash
npm run build
```

This creates the `dist` folder that Capacitor will use.

### 3. Initialize Capacitor Platforms

#### For Android:

```bash
npx cap add android
npx cap sync
```

#### For iOS (macOS only):

```bash
npx cap add ios
npx cap sync
```

The `sync` command copies your web app build to the native projects.

## 🏗️ Building the Mobile App

### Android

1. **Open Android Studio:**
   ```bash
   npm run android
   ```
   Or manually:
   ```bash
   npx cap open android
   ```

2. **In Android Studio:**
   - Wait for Gradle sync to complete
   - Connect an Android device or start an emulator
   - Click the "Run" button (green play icon) or press `Shift + F10`

3. **Build APK/AAB:**
   - Go to `Build > Build Bundle(s) / APK(s) > Build APK(s)` for testing
   - Or `Build > Generate Signed Bundle / APK` for production release

### iOS (macOS only)

1. **Open Xcode:**
   ```bash
   npm run ios
   ```
   Or manually:
   ```bash
   npx cap open ios
   ```

2. **In Xcode:**
   - Select your development team in Signing & Capabilities
   - Connect an iOS device or select a simulator
   - Click the "Run" button or press `Cmd + R`

3. **Build for App Store:**
   - Go to `Product > Archive`
   - Follow the App Store Connect workflow

## 🔄 Development Workflow

### During Development:

1. **Make changes to your React app**
2. **Rebuild the web app:**
   ```bash
   npm run build
   ```
3. **Sync with native projects:**
   ```bash
   npx cap sync
   ```
4. **Test in native app** (the app will reload automatically if using live reload)

### Quick Commands:

```bash
# Build and sync for Android
npm run android

# Build and sync for iOS
npm run ios

# Just sync (after manual build)
npx cap sync

# Copy web assets only
npx cap copy
```

## ⚙️ Configuration

### App Configuration

Edit `capacitor.config.ts` to customize:
- App ID (currently: `com.paarsiv.ems`)
- App Name (currently: `Paarsiv EMS`)
- Server URL (for development)
- Plugin settings

### Android Configuration

- **App ID:** Edit `android/app/build.gradle` → `applicationId`
- **Permissions:** Edit `android/app/src/main/AndroidManifest.xml`
- **Icons & Splash:** Replace files in `android/app/src/main/res/`

### iOS Configuration

- **App ID:** Edit `ios/App/App.xcodeproj` → Signing & Capabilities
- **Permissions:** Edit `ios/App/App/Info.plist`
- **Icons & Splash:** Use Xcode Asset Catalog

## 📦 App Icons & Splash Screens

### Android Icons:
Place icons in `android/app/src/main/res/`:
- `mipmap-mdpi/ic_launcher.png` (48x48)
- `mipmap-hdpi/ic_launcher.png` (72x72)
- `mipmap-xhdpi/ic_launcher.png` (96x96)
- `mipmap-xxhdpi/ic_launcher.png` (144x144)
- `mipmap-xxxhdpi/ic_launcher.png` (192x192)

### iOS Icons:
Use Xcode Asset Catalog or place in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

### Splash Screens:
- Android: `android/app/src/main/res/drawable/splash.xml`
- iOS: Configure in Xcode or use `ios/App/App/Assets.xcassets/Splash.imageset/`

## 🔌 Available Capacitor Plugins

The app includes these Capacitor plugins:

- **@capacitor/app** - App lifecycle and URL handling
- **@capacitor/status-bar** - Status bar styling
- **@capacitor/splash-screen** - Splash screen control
- **@capacitor/keyboard** - Keyboard handling
- **@capacitor/filesystem** - File system access
- **@capacitor/camera** - Camera access
- **@capacitor/network** - Network status
- **@capacitor/haptics** - Haptic feedback

## 🌐 API Configuration

### Development:
The app is configured to connect to your backend API. Update the API base URL in:
- `src/utils/axios.js` or your API configuration file

### Production:
Update `capacitor.config.ts` server URL or use environment variables.

## 🐛 Troubleshooting

### Android Issues:

1. **Gradle sync fails:**
   - Open Android Studio
   - Go to `File > Invalidate Caches / Restart`
   - Clean project: `Build > Clean Project`

2. **Build errors:**
   - Check Java version: `java -version` (should be 17+)
   - Update Android SDK in Android Studio

3. **App crashes on launch:**
   - Check `adb logcat` for errors
   - Ensure API URL is correct
   - Verify CORS settings on backend

### iOS Issues:

1. **Pod install fails:**
   ```bash
   cd ios/App
   pod deintegrate
   pod install
   ```

2. **Signing errors:**
   - Select your development team in Xcode
   - Check Bundle Identifier matches your Apple Developer account

3. **Build errors:**
   - Clean build folder: `Product > Clean Build Folder` (Shift + Cmd + K)
   - Update CocoaPods: `sudo gem update cocoapods`

### General Issues:

1. **Changes not appearing:**
   - Run `npm run build` then `npx cap sync`
   - Restart the app

2. **Plugin not working:**
   - Ensure plugin is installed: `npm list @capacitor/[plugin-name]`
   - Run `npx cap sync` after installing new plugins

## 📱 Testing

### Android:
- Use Android Studio emulator or physical device
- Enable USB debugging on physical devices
- Test on multiple Android versions if possible

### iOS:
- Use Xcode simulator or physical device
- Test on multiple iOS versions
- Ensure you have valid provisioning profiles for physical devices

## 🚢 Production Build

### Android (APK/AAB):

1. **Generate keystore** (first time only):
   ```bash
   keytool -genkey -v -keystore paarsiv-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias paarsiv
   ```

2. **Configure signing:**
   - Edit `android/app/build.gradle`
   - Add signing config

3. **Build release:**
   - In Android Studio: `Build > Generate Signed Bundle / APK`
   - Or command line: `./gradlew assembleRelease`

### iOS:

1. **Archive in Xcode:**
   - `Product > Archive`
   - Upload to App Store Connect
   - Submit for review

## 📚 Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/)
- [iOS Developer Guide](https://developer.apple.com/ios/)
- [React Native vs Capacitor](https://capacitorjs.com/docs)

## 🆘 Support

For issues specific to:
- **Capacitor:** Check [Capacitor GitHub Issues](https://github.com/ionic-team/capacitor/issues)
- **App functionality:** Check the main project README
- **Backend API:** Check server documentation

---

**Note:** Make sure your backend server CORS settings allow requests from the mobile app. Update `server/server.js` CORS configuration if needed.

