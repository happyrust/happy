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
        logFunction: ({ level, message }: { level: number; message: string }) => {
            if (level >= 2) {
                console.error(message);
            } else {
                console.warn(message);
            }
        },
    };
}

// Polyfill BatteryManager event methods on browsers that expose navigator.battery/getBattery
if (typeof navigator !== 'undefined') {
    const patchedBatteries = new WeakSet<any>();

    const ensureBatteryEventMethods = (battery: any) => {
        if (!battery || patchedBatteries.has(battery)) {
            return battery;
        }
        if (typeof battery.addEventListener !== 'function') {
            battery.addEventListener = () => {};
        }
        if (typeof battery.removeEventListener !== 'function') {
            battery.removeEventListener = () => {};
        }
        patchedBatteries.add(battery);
        return battery;
    };

    if (typeof (navigator as any).getBattery === 'function') {
        const originalGetBattery = (navigator as any).getBattery.bind(navigator);
        (navigator as any).getBattery = (...args: any[]) =>
            originalGetBattery(...args).then((battery: any) => ensureBatteryEventMethods(battery));
    }

    if ((navigator as any).battery) {
        ensureBatteryEventMethods((navigator as any).battery);
    }
}

import 'expo-router/entry';
