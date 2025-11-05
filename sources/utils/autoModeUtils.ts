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
 * Get auto mode enabled state for a session (checks both global and session-specific)
 */
export function isAutoModeEnabledForSession(sessionId: string): boolean {
    const localSettings = storage.getState().localSettings;
    return localSettings.autoModeSessionEnabled[sessionId] ?? localSettings.autoModeEnabled;
}


