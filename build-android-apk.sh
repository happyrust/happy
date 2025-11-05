#!/bin/bash
# Android build script using Gradle (no device needed)

set -e

# Set Java home
export JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.15/libexec/openjdk.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH

# Set Android SDK
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Add common node paths - check which node exists
if [ -f "/opt/homebrew/bin/node" ]; then
    export PATH="/opt/homebrew/bin:$PATH"
elif [ -f "/usr/local/bin/node" ]; then
    export PATH="/usr/local/bin:$PATH"
fi

# Verify node is available
if ! command -v node >/dev/null 2>&1; then
    echo "错误: 找不到node命令，请确保已安装Node.js"
    exit 1
fi

echo "Node版本: $(node --version)"

cd /Volumes/DPC/work/ai/happy

echo "=== 使用 Java 17 构建 Android APK ==="
echo "Java版本:"
$JAVA_HOME/bin/java -version

echo ""
echo "=== 开始构建 Release APK ==="
cd android

# Ensure node is available for Gradle - set full path
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:$PATH
export NODE_PATH=/opt/homebrew/bin/node

# Create a symlink or ensure node is accessible
if [ ! -f "./node" ] && [ -f "/opt/homebrew/bin/node" ]; then
    ln -sf /opt/homebrew/bin/node ./node 2>/dev/null || true
fi

# Use init script to set PATH and run build
./gradlew assembleRelease \
  -Dorg.gradle.java.home=$JAVA_HOME \
  -Dorg.gradle.daemon=false \
  --init-script init.gradle \
  2>&1

echo ""
echo "=== 构建完成 ==="
if [ -f "app/build/outputs/apk/release/app-release.apk" ]; then
    echo "✓ APK文件位置:"
    echo "  $(pwd)/app/build/outputs/apk/release/app-release.apk"
    ls -lh app/build/outputs/apk/release/app-release.apk
else
    echo "✗ APK文件未找到"
fi

