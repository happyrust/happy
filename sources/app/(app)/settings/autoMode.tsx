import { Platform, ScrollView, Text, TextInput, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { useLocalSetting, useLocalSettingMutable } from '@/sync/storage';
import { Switch } from '@/components/Switch';
import { t } from '@/text';
import { useUnistyles } from 'react-native-unistyles';
import { useState, useEffect } from 'react';
import { 
    addAutoModeTemplate, 
    updateAutoModeTemplate, 
    deleteAutoModeTemplate, 
    setSelectedAutoModeTemplate,
    toggleAutoMode 
} from '@/utils/autoModeUtils';
import { Modal } from '@/modal';
import { storage } from '@/sync/storage';

export default function AutoModeSettingsScreen() {
    const { theme } = useUnistyles();
    const [autoModeEnabled, setAutoModeEnabled] = useLocalSettingMutable('autoModeEnabled');
    const autoModeTemplates = useLocalSetting('autoModeTemplates');
    const autoModeSelectedTemplateId = useLocalSetting('autoModeSelectedTemplateId');
    const [autoModeMaxCycles, setAutoModeMaxCycles] = useLocalSettingMutable('autoModeMaxCycles');
    const autoModeCycleCount = useLocalSetting('autoModeCycleCount');
    const [editingTemplate, setEditingTemplate] = useState<{ id: string; name: string; content: string } | null>(null);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateContent, setNewTemplateContent] = useState('');
    const [maxCyclesInput, setMaxCyclesInput] = useState(String(autoModeMaxCycles));

    // Sync input with setting value
    useEffect(() => {
        setMaxCyclesInput(String(autoModeMaxCycles));
    }, [autoModeMaxCycles]);

    const handleMaxCyclesChange = (text: string) => {
        setMaxCyclesInput(text);
        const numValue = parseInt(text, 10);
        if (!isNaN(numValue) && numValue >= 0) {
            setAutoModeMaxCycles(numValue);
        } else if (text === '') {
            setAutoModeMaxCycles(0);
        }
    };

    const handleResetCycleCount = (sessionId?: string) => {
        const currentCycleCount = storage.getState().localSettings.autoModeCycleCount;
        if (sessionId) {
            const updated = { ...currentCycleCount };
            delete updated[sessionId];
            storage.getState().applyLocalSettings({
                autoModeCycleCount: updated,
            });
        } else {
            // Reset all
            storage.getState().applyLocalSettings({
                autoModeCycleCount: {},
            });
        }
    };

    const selectedTemplate = autoModeTemplates.find(t => t.id === autoModeSelectedTemplateId);

    const handleAddTemplate = () => {
        if (!newTemplateName.trim() || !newTemplateContent.trim()) {
            Modal.alert(t('common.error'), 'Template name and content are required');
            return;
        }
        addAutoModeTemplate({
            name: newTemplateName.trim(),
            content: newTemplateContent.trim(),
        });
        setNewTemplateName('');
        setNewTemplateContent('');
    };

    const handleEditTemplate = (template: { id: string; name: string; content: string }) => {
        setEditingTemplate(template);
        setNewTemplateName(template.name);
        setNewTemplateContent(template.content);
    };

    const handleSaveEdit = () => {
        if (!editingTemplate || !newTemplateName.trim() || !newTemplateContent.trim()) {
            Modal.alert(t('common.error'), 'Template name and content are required');
            return;
        }
        updateAutoModeTemplate(editingTemplate.id, {
            name: newTemplateName.trim(),
            content: newTemplateContent.trim(),
        });
        setEditingTemplate(null);
        setNewTemplateName('');
        setNewTemplateContent('');
    };

    const handleDeleteTemplate = async (templateId: string) => {
        const confirmed = await Modal.confirm(
            'Delete Template',
            'Are you sure you want to delete this template?',
            {
                cancelText: 'Cancel',
                confirmText: 'Delete',
                destructive: true,
            }
        );
        if (confirmed) {
            deleteAutoModeTemplate(templateId);
        }
    };

    const handleSelectTemplate = (templateId: string) => {
        setSelectedAutoModeTemplate(templateId);
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
            <ItemList style={{ paddingTop: 0 }}>
                {/* Auto Mode Toggle */}
                <ItemGroup 
                    title="Auto Mode"
                    footer="When enabled, automatically sends the selected template message when AI finishes responding."
                >
                    <Item
                        title="Enable Auto Mode"
                        subtitle={autoModeEnabled ? "Auto mode is enabled" : "Auto mode is disabled"}
                        icon={<Ionicons name="play-circle-outline" size={29} color="#34C759" />}
                        rightElement={
                            <Switch
                                value={autoModeEnabled}
                                onValueChange={setAutoModeEnabled}
                            />
                        }
                        showChevron={false}
                    />
                </ItemGroup>

                {/* Cycle Settings */}
                {autoModeEnabled && (
                    <ItemGroup 
                        title="Cycle Settings"
                        footer={autoModeMaxCycles === 0 
                            ? "Unlimited cycles - will continue automatically until manually disabled"
                            : `Maximum ${autoModeMaxCycles} cycle${autoModeMaxCycles === 1 ? '' : 's'}. After reaching the limit, auto mode will stop for this session.`
                        }
                    >
                        <View style={{ padding: 16 }}>
                            <Text style={{ 
                                fontSize: 17, 
                                fontWeight: '600', 
                                color: theme.colors.text,
                                marginBottom: 8 
                            }}>
                                Maximum Cycles (0 = unlimited)
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: theme.colors.input.background,
                                    color: theme.colors.text,
                                    borderRadius: 8,
                                    padding: 12,
                                    fontSize: 16,
                                    borderWidth: 1,
                                    borderColor: theme.colors.input.border,
                                    marginBottom: 8,
                                }}
                                placeholder="Enter number (0 for unlimited)"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={maxCyclesInput}
                                onChangeText={handleMaxCyclesChange}
                                keyboardType="numeric"
                            />
                            <Text style={{ 
                                fontSize: 13, 
                                color: theme.colors.textSecondary,
                                marginBottom: 16 
                            }}>
                                {autoModeMaxCycles === 0 
                                    ? "Unlimited cycles"
                                    : `Maximum ${autoModeMaxCycles} cycle${autoModeMaxCycles === 1 ? '' : 's'}`
                                }
                            </Text>
                            
                            {Object.keys(autoModeCycleCount).length > 0 && (
                                <>
                                    <Text style={{ 
                                        fontSize: 17, 
                                        fontWeight: '600', 
                                        color: theme.colors.text,
                                        marginBottom: 8 
                                    }}>
                                        Current Cycle Counts
                                    </Text>
                                    {Object.entries(autoModeCycleCount).map(([sessionId, count]) => (
                                        <View key={sessionId} style={{
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            paddingVertical: 8,
                                            paddingHorizontal: 12,
                                            backgroundColor: theme.colors.surface,
                                            borderRadius: 8,
                                            marginBottom: 8,
                                        }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ 
                                                    fontSize: 14, 
                                                    color: theme.colors.text,
                                                    fontWeight: '500'
                                                }}>
                                                    Session: {sessionId.substring(0, 8)}...
                                                </Text>
                                                <Text style={{ 
                                                    fontSize: 12, 
                                                    color: theme.colors.textSecondary,
                                                    marginTop: 2
                                                }}>
                                                    {count} / {autoModeMaxCycles === 0 ? '∞' : autoModeMaxCycles}
                                                </Text>
                                            </View>
                                            <Pressable
                                                onPress={async () => {
                                                    const confirmed = await Modal.confirm(
                                                        'Reset Cycle Count',
                                                        'Reset cycle count for this session?',
                                                        {
                                                            cancelText: 'Cancel',
                                                            confirmText: 'Reset',
                                                        }
                                                    );
                                                    if (confirmed) {
                                                        handleResetCycleCount(sessionId);
                                                    }
                                                }}
                                                style={{ padding: 4 }}
                                            >
                                                <Ionicons name="refresh-outline" size={20} color={theme.colors.textSecondary} />
                                            </Pressable>
                                        </View>
                                    ))}
                                    <Pressable
                                        onPress={async () => {
                                            const confirmed = await Modal.confirm(
                                                'Reset All Cycle Counts',
                                                'Reset cycle counts for all sessions?',
                                                {
                                                    cancelText: 'Cancel',
                                                    confirmText: 'Reset All',
                                                    destructive: true,
                                                }
                                            );
                                            if (confirmed) {
                                                handleResetCycleCount();
                                            }
                                        }}
                                        style={{
                                            backgroundColor: theme.colors.button.secondary,
                                            padding: 12,
                                            borderRadius: 8,
                                            alignItems: 'center',
                                            marginTop: 8,
                                        }}
                                    >
                                        <Text style={{ color: theme.colors.button.secondaryText, fontWeight: '600' }}>
                                            Reset All Cycle Counts
                                        </Text>
                                    </Pressable>
                                </>
                            )}
                        </View>
                    </ItemGroup>
                )}

                {/* Selected Template */}
                {autoModeEnabled && (
                    <ItemGroup 
                        title="Selected Template"
                        footer={selectedTemplate 
                            ? `Current template: "${selectedTemplate.name}"`
                            : "No template selected. Add a template below to get started."
                        }
                    >
                        {selectedTemplate ? (
                            <Item
                                title={selectedTemplate.name}
                                subtitle={selectedTemplate.content.length > 50 
                                    ? selectedTemplate.content.substring(0, 50) + '...' 
                                    : selectedTemplate.content}
                                icon={<Ionicons name="document-text-outline" size={29} color="#007AFF" />}
                                showChevron={false}
                            />
                        ) : (
                            <Item
                                title="No template selected"
                                subtitle="Select a template from the list below"
                                icon={<Ionicons name="document-outline" size={29} color="#8E8E93" />}
                                showChevron={false}
                            />
                        )}
                    </ItemGroup>
                )}

                {/* Templates List */}
                <ItemGroup 
                    title="Templates"
                    footer="Templates are automatically sent when AI finishes responding (if auto mode is enabled)."
                >
                    {autoModeTemplates.length === 0 ? (
                        <Item
                            title="No templates"
                            subtitle="Add your first template below"
                            icon={<Ionicons name="add-circle-outline" size={29} color="#8E8E93" />}
                            showChevron={false}
                        />
                    ) : (
                        autoModeTemplates.map((template) => (
                            <Item
                                key={template.id}
                                title={template.name}
                                subtitle={template.content.length > 50 
                                    ? template.content.substring(0, 50) + '...' 
                                    : template.content}
                                icon={
                                    template.id === autoModeSelectedTemplateId ? (
                                        <Ionicons name="checkmark-circle" size={29} color="#34C759" />
                                    ) : (
                                        <Ionicons name="ellipse-outline" size={29} color="#8E8E93" />
                                    )
                                }
                                onPress={() => handleSelectTemplate(template.id)}
                                rightElement={
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <Pressable
                                            onPress={() => handleEditTemplate(template)}
                                            style={{ padding: 4 }}
                                        >
                                            <Ionicons name="pencil-outline" size={20} color={theme.colors.textSecondary} />
                                        </Pressable>
                                        <Pressable
                                            onPress={() => handleDeleteTemplate(template.id)}
                                            style={{ padding: 4 }}
                                        >
                                            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                        </Pressable>
                                    </View>
                                }
                                showChevron={false}
                            />
                        ))
                    )}
                </ItemGroup>

                {/* Add/Edit Template */}
                <ItemGroup title={editingTemplate ? "Edit Template" : "Add Template"}>
                    <View style={{ padding: 16 }}>
                        <Text style={{ 
                            fontSize: 17, 
                            fontWeight: '600', 
                            color: theme.colors.text,
                            marginBottom: 8 
                        }}>
                            Template Name
                        </Text>
                        <TextInput
                            style={{
                                backgroundColor: theme.colors.input.background,
                                color: theme.colors.text,
                                borderRadius: 8,
                                padding: 12,
                                fontSize: 16,
                                borderWidth: 1,
                                borderColor: theme.colors.input.border,
                                marginBottom: 16,
                            }}
                            placeholder="Enter template name"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newTemplateName}
                            onChangeText={setNewTemplateName}
                        />
                        <Text style={{ 
                            fontSize: 17, 
                            fontWeight: '600', 
                            color: theme.colors.text,
                            marginBottom: 8 
                        }}>
                            Template Content
                        </Text>
                        <TextInput
                            style={{
                                backgroundColor: theme.colors.input.background,
                                color: theme.colors.text,
                                borderRadius: 8,
                                padding: 12,
                                fontSize: 16,
                                borderWidth: 1,
                                borderColor: theme.colors.input.border,
                                minHeight: 100,
                                textAlignVertical: 'top',
                                marginBottom: 16,
                            }}
                            placeholder="Enter template content (this will be sent automatically)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newTemplateContent}
                            onChangeText={setNewTemplateContent}
                            multiline
                        />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            {editingTemplate && (
                                <Pressable
                                    onPress={() => {
                                        setEditingTemplate(null);
                                        setNewTemplateName('');
                                        setNewTemplateContent('');
                                    }}
                                    style={{
                                        flex: 1,
                                        backgroundColor: theme.colors.button.secondary,
                                        padding: 12,
                                        borderRadius: 8,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Text style={{ color: theme.colors.button.secondaryText, fontWeight: '600' }}>
                                        Cancel
                                    </Text>
                                </Pressable>
                            )}
                            <Pressable
                                onPress={editingTemplate ? handleSaveEdit : handleAddTemplate}
                                style={{
                                    flex: 1,
                                    backgroundColor: theme.colors.button.primary,
                                    padding: 12,
                                    borderRadius: 8,
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: theme.colors.button.primaryText, fontWeight: '600' }}>
                                    {editingTemplate ? 'Save' : 'Add Template'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </ItemGroup>
            </ItemList>
        </ScrollView>
    );
}

