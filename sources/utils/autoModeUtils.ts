import { storage } from '@/sync/storage';
import { LocalSettings } from '@/sync/localSettings';

export interface AutoModeTemplate {
    id: string;
    name: string;
    content: string;
}

/**
 * Add a new template to auto mode templates
 */
export function addAutoModeTemplate(template: Omit<AutoModeTemplate, 'id'>): AutoModeTemplate {
    const templates = storage.getState().localSettings.autoModeTemplates;
    const newTemplate: AutoModeTemplate = {
        ...template,
        id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    
    storage.getState().applyLocalSettings({
        autoModeTemplates: [...templates, newTemplate],
    });
    
    return newTemplate;
}

/**
 * Update an existing template
 */
export function updateAutoModeTemplate(templateId: string, updates: Partial<Omit<AutoModeTemplate, 'id'>>): void {
    const templates = storage.getState().localSettings.autoModeTemplates;
    const updatedTemplates = templates.map(t =>
        t.id === templateId ? { ...t, ...updates } : t
    );
    
    storage.getState().applyLocalSettings({
        autoModeTemplates: updatedTemplates,
    });
}

/**
 * Delete a template
 */
export function deleteAutoModeTemplate(templateId: string): void {
    const templates = storage.getState().localSettings.autoModeTemplates;
    const filteredTemplates = templates.filter(t => t.id !== templateId);
    const selectedTemplateId = storage.getState().localSettings.autoModeSelectedTemplateId;
    
    storage.getState().applyLocalSettings({
        autoModeTemplates: filteredTemplates,
        // Clear selected template if it was deleted
        autoModeSelectedTemplateId: selectedTemplateId === templateId ? null : selectedTemplateId,
    });
}

/**
 * Set the selected template for auto mode
 */
export function setSelectedAutoModeTemplate(templateId: string | null): void {
    storage.getState().applyLocalSettings({
        autoModeSelectedTemplateId: templateId,
    });
}

/**
 * Toggle auto mode globally
 */
export function toggleAutoMode(enabled: boolean): void {
    storage.getState().applyLocalSettings({
        autoModeEnabled: enabled,
    });
}

/**
 * Toggle auto mode for a specific session
 */
export function toggleAutoModeForSession(sessionId: string, enabled: boolean): void {
    const sessionEnabled = storage.getState().localSettings.autoModeSessionEnabled;
    storage.getState().applyLocalSettings({
        autoModeSessionEnabled: {
            ...sessionEnabled,
            [sessionId]: enabled,
        },
    });
}

/**
 * Set per-session max cycles override
 */
export function setSessionAutoModeMaxCycles(sessionId: string, maxCycles: number): void {
    const sessionMaxCycles = storage.getState().localSettings.autoModeSessionMaxCycles;
    storage.getState().applyLocalSettings({
        autoModeSessionMaxCycles: {
            ...sessionMaxCycles,
            [sessionId]: maxCycles,
        },
    });
}

/**
 * Clear per-session max cycles override
 */
export function clearSessionAutoModeMaxCycles(sessionId: string): void {
    const sessionMaxCycles = storage.getState().localSettings.autoModeSessionMaxCycles;
    const updated = { ...sessionMaxCycles };
    delete updated[sessionId];
    storage.getState().applyLocalSettings({
        autoModeSessionMaxCycles: updated,
    });
}

/**
 * Get auto mode enabled state for a session.
 * Session-specific setting overrides global setting.
 * If session has no explicit setting, defaults to false (disabled).
 */
export function isAutoModeEnabledForSession(sessionId: string): boolean {
    const localSettings = storage.getState().localSettings;
    // If session has explicit setting, use it; otherwise default to false
    if (sessionId in localSettings.autoModeSessionEnabled) {
        return localSettings.autoModeSessionEnabled[sessionId];
    }
    return false;
}

/**
 * Check if a session has a specific override for auto mode (not using global setting)
 */
export function hasSessionAutoModeOverride(sessionId: string): boolean {
    const localSettings = storage.getState().localSettings;
    return sessionId in localSettings.autoModeSessionEnabled;
}

/**
 * Clear session-specific auto mode override (revert to global setting)
 */
export function clearSessionAutoModeOverride(sessionId: string): void {
    const sessionEnabled = storage.getState().localSettings.autoModeSessionEnabled;
    const updated = { ...sessionEnabled };
    delete updated[sessionId];
    storage.getState().applyLocalSettings({
        autoModeSessionEnabled: updated,
    });
}

/**
 * Set custom message for a session (overrides template selection)
 */
export function setSessionCustomMessage(sessionId: string, message: string): void {
    const customMessages = storage.getState().localSettings.autoModeCustomMessage;
    storage.getState().applyLocalSettings({
        autoModeCustomMessage: {
            ...customMessages,
            [sessionId]: message,
        },
    });
}

/**
 * Clear custom message for a session (revert to using templates)
 */
export function clearSessionCustomMessage(sessionId: string): void {
    const customMessages = storage.getState().localSettings.autoModeCustomMessage;
    const updated = { ...customMessages };
    delete updated[sessionId];
    storage.getState().applyLocalSettings({
        autoModeCustomMessage: updated,
    });
}

/**
 * Get the auto-send message for a session.
 * Priority: Custom message > Selected template > null
 */
export function getAutoSendMessage(sessionId: string): string | null {
    const localSettings = storage.getState().localSettings;
    
    // Check for custom message first
    const customMessage = localSettings.autoModeCustomMessage[sessionId];
    if (customMessage) {
        return customMessage;
    }
    
    // Fall back to selected template
    const selectedTemplate = localSettings.autoModeTemplates.find(
        t => t.id === localSettings.autoModeSelectedTemplateId
    );
    
    return selectedTemplate?.content || null;
}

/**
 * Check if a session has a custom message set
 */
export function hasSessionCustomMessage(sessionId: string): boolean {
    const localSettings = storage.getState().localSettings;
    return sessionId in localSettings.autoModeCustomMessage;
}

