import './sources/unistyles';

// Configure Reanimated logger BEFORE importing any reanimated code
// This prevents "Cannot read properties of undefined (reading 'level')" error
if (typeof global !== 'undefined') {
    // @ts-ignore
    global._REANIMATED_VERSION_JS = '4.1.0';
    // @ts-ignore
    global.__reanimatedLoggerConfig = {
        level: 1, // 0: debug, 1: warn, 2: error
        strict: false,
    };
}

import 'expo-router/entry';