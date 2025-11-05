#!/bin/bash
# Simple script to install Android SDK components and build

set -e

# Set Java home
export JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.15/libexec/openjdk.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH

ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

cd /Volumes/DPC/work/ai/happy

echo "=== Installing Android SDK Components ==="

# Install platform-tools
if [ ! -d "$ANDROID_HOME/platform-tools" ]; then
    echo "Installing platform-tools..."
    $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" <<< "y"
fi

# Install platform
if [ ! -d "$ANDROID_HOME/platforms/android-36" ]; then
    echo "Installing Android SDK Platform 36..."
    $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --sdk_root=$ANDROID_HOME "platforms;android-36" <<< "y"
fi

# Install build-tools
if [ ! -d "$ANDROID_HOME/build-tools/36.0.0" ]; then
    echo "Installing Android Build Tools 36.0.0..."
    $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --sdk_root=$ANDROID_HOME "build-tools;36.0.0" <<< "y"
fi

# Accept licenses
echo "Accepting Android licenses..."
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --sdk_root=$ANDROID_HOME --licenses <<< "y" || true

echo ""
echo "=== Starting Expo Android Build ==="
cd /Volumes/DPC/work/ai/happy
./node_modules/.bin/expo run:android
