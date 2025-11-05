import * as z from 'zod';

//
// Schema
//

export const LocalSettingsSchema = z.object({
    // Developer settings (device-specific)
    debugMode: z.boolean().describe('Enable debug logging'),
    devModeEnabled: z.boolean().describe('Enable developer menu in settings'),
    commandPaletteEnabled: z.boolean().describe('Enable CMD+K command palette (web only)'),
    themePreference: z.enum(['light', 'dark', 'adaptive']).describe('Theme preference: light, dark, or adaptive (follows system)'),
    markdownCopyV2: z.boolean().describe('Replace native paragraph selection with long-press modal for full markdown copy'),
    // CLI version acknowledgments - keyed by machineId
    acknowledgedCliVersions: z.record(z.string(), z.string()).describe('Acknowledged CLI versions per machine'),
    // Auto mode settings
    autoModeEnabled: z.boolean().describe('Enable auto mode - automatically send template messages when AI finishes responding'),
    autoModeTemplates: z.array(z.object({
        id: z.string(),
        name: z.string(),
        content: z.string(),
    })).describe('Auto mode templates that can be automatically sent'),
    autoModeSelectedTemplateId: z.string().nullable().describe('Currently selected template ID for auto mode'),
    autoModeMaxCycles: z.number().describe('Maximum number of auto-send cycles (0 = unlimited)'),
    // Per-session auto mode settings - keyed by sessionId
    autoModeSessionEnabled: z.record(z.string(), z.boolean()).describe('Per-session auto mode enable state'),
    autoModeCycleCount: z.record(z.string(), z.number()).describe('Per-session cycle count for auto mode'),
});

//
// NOTE: Local settings are device-specific and should NOT be synced.
// These are preferences that make sense to be different on each device.
//

const LocalSettingsSchemaPartial = LocalSettingsSchema.loose().partial();

export type LocalSettings = z.infer<typeof LocalSettingsSchema>;

//
// Defaults
//

export const localSettingsDefaults: LocalSettings = {
    debugMode: false,
    devModeEnabled: false,
    commandPaletteEnabled: false,
    themePreference: 'adaptive',
    markdownCopyV2: false,
    acknowledgedCliVersions: {},
    autoModeEnabled: false,
    autoModeTemplates: [
        {
            id: 'default_template_1',
            name: '提交并继续',
            content: '提交当前代码，更新Changelog, 然后继续执行你的建议',
        },
    ],
    autoModeSelectedTemplateId: 'default_template_1',
    autoModeMaxCycles: 0, // 0 = unlimited
    autoModeSessionEnabled: {},
    autoModeCycleCount: {},
};
Object.freeze(localSettingsDefaults);

//
// Parsing
//

export function localSettingsParse(settings: unknown): LocalSettings {
    const parsed = LocalSettingsSchemaPartial.safeParse(settings);
    if (!parsed.success) {
        return { ...localSettingsDefaults };
    }
    return { ...localSettingsDefaults, ...parsed.data };
}

//
// Applying changes
//

export function applyLocalSettings(settings: LocalSettings, delta: Partial<LocalSettings>): LocalSettings {
    return { ...localSettingsDefaults, ...settings, ...delta };
}
