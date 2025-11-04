import './sources/unistyles';
import 'react-native-reanimated';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

// Configure Reanimated logger early to prevent config.level errors
configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false,
});

import 'expo-router/entry';