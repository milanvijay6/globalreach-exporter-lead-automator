# Mobile Setup Guide

This guide explains how to set up and build the GlobalReach app for Android and iOS using Capacitor.

## Prerequisites

### For Android Development:
- Node.js 20+ installed
- Java Development Kit (JDK) 17 or higher
- Android Studio installed
- Android SDK installed (via Android Studio)

### For iOS Development:
- macOS (required for iOS development)
- Xcode 14+ installed
- CocoaPods installed: `sudo gem install cocoapods`
- Node.js 20+ installed

## Initial Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the React app:**
   ```bash
   npm run build:react
   ```

3. **Initialize Capacitor (if not already done):**
   ```bash
   npx cap init
   ```
   - App name: `GlobalReach Automator`
   - App ID: `com.globalreach.exporter`
   - Web dir: `dist`

## Android Setup

1. **Add Android platform:**
   ```bash
   npm run cap:add:android
   ```

2. **Sync Capacitor:**
   ```bash
   npm run cap:sync
   ```

3. **Open in Android Studio:**
   ```bash
   npm run cap:open:android
   ```

4. **Build and Run:**
   - In Android Studio, click "Run" or press Shift+F10
   - Or use command line: `./gradlew assembleDebug` (from android folder)

## iOS Setup

1. **Add iOS platform:**
   ```bash
   npm run cap:add:ios
   ```

2. **Install CocoaPods dependencies:**
   ```bash
   cd ios/App
   pod install
   cd ../..
   ```

3. **Sync Capacitor:**
   ```bash
   npm run cap:sync
   ```

4. **Open in Xcode:**
   ```bash
   npm run cap:open:ios
   ```

5. **Build and Run:**
   - In Xcode, select a simulator or device
   - Click "Run" or press Cmd+R

## Development Workflow

### Making Changes

1. **Update your React code**
2. **Build the app:**
   ```bash
   npm run build:react
   ```

3. **Sync to native projects:**
   ```bash
   npm run cap:sync
   ```

4. **Test in native app** (Android Studio or Xcode)

### Quick Commands

- `npm run build:android` - Build React app and sync to Android
- `npm run build:ios` - Build React app and sync to iOS
- `npm run cap:sync` - Sync web assets to native projects
- `npm run cap:copy` - Copy web assets only
- `npm run cap:update` - Update Capacitor and plugins

## Platform-Specific Features

The app automatically detects the platform and adjusts UI accordingly:
- **Web**: Full desktop experience
- **Desktop (Electron)**: Native desktop app
- **Android**: Mobile-optimized UI with bottom navigation
- **iOS**: Mobile-optimized UI with safe area support

## Building for Production

### Android

1. **Generate a signed APK:**
   - Open Android Studio
   - Build → Generate Signed Bundle / APK
   - Follow the wizard to create a release build

2. **Or use command line:**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

### iOS

1. **Archive in Xcode:**
   - Open Xcode
   - Product → Archive
   - Follow the App Store Connect process

2. **Or use command line:**
   ```bash
   xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release archive
   ```

## Troubleshooting

### Android Issues

- **Gradle sync failed**: Make sure Android SDK is properly installed
- **Build errors**: Check that Java JDK 17+ is installed and JAVA_HOME is set
- **App crashes on launch**: Check logcat: `adb logcat`

### iOS Issues

- **Pod install fails**: Run `pod repo update` then `pod install` again
- **Build errors**: Make sure Xcode Command Line Tools are installed: `xcode-select --install`
- **Signing errors**: Configure signing in Xcode project settings

### General Issues

- **Changes not appearing**: Run `npm run cap:sync` after building
- **Plugin not working**: Make sure plugin is installed: `npm install @capacitor/plugin-name`
- **Web assets not updating**: Clear app data and rebuild

## Testing on Devices

### Android
1. Enable Developer Options on your Android device
2. Enable USB Debugging
3. Connect device via USB
4. Run `adb devices` to verify connection
5. Build and run from Android Studio

### iOS
1. Connect iOS device via USB
2. Trust the computer on your device
3. In Xcode, select your device from the device list
4. You may need to configure code signing in Xcode

## Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/)
- [iOS Developer Guide](https://developer.apple.com/ios/)









