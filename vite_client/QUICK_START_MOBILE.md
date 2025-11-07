# Quick Start - Mobile App

## 🚀 Fast Setup (5 minutes)

### Step 1: Install Dependencies
```bash
cd vite_client
npm install
```

### Step 2: Build the Web App
```bash
npm run build
```

### Step 3: Add Mobile Platforms

**For Android:**
```bash
npx cap add android
npx cap sync
```

**For iOS (macOS only):**
```bash
npx cap add ios
npx cap sync
```

### Step 4: Open in Native IDE

**Android:**
```bash
npm run android
```
This will open Android Studio.

**iOS:**
```bash
npm run ios
```
This will open Xcode.

### Step 5: Run the App

- **Android:** Click the green "Run" button in Android Studio
- **iOS:** Click the "Run" button in Xcode (or press Cmd+R)

## 📝 Important Notes

1. **First Time Setup:**
   - Android: Install Android Studio and SDK
   - iOS: Install Xcode (macOS only) and CocoaPods

2. **After Making Changes:**
   ```bash
   npm run build
   npx cap sync
   ```
   Then rebuild in your native IDE.

3. **API Configuration:**
   - Update `capacitor.config.js` if your backend URL is different
   - Or set environment variables in your build process

## 🔧 Troubleshooting

**"Command not found: cap"**
- Run `npm install` first

**"Platform already exists"**
- Delete `android/` or `ios/` folder and run `npx cap add` again

**App shows blank screen**
- Check browser console for errors
- Verify API URL in `capacitor.config.js`
- Ensure backend CORS allows mobile app origin

For detailed setup, see [MOBILE_APP_SETUP.md](./MOBILE_APP_SETUP.md)

