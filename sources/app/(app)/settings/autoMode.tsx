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
            Modal.alert(t('common.error'), t('settingsAutoMode.templateNameRequired'));
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
            Modal.alert(t('common.error'), t('settingsAutoMode.templateNameRequired'));
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
            t('settingsAutoMode.deleteTemplate'),
            t('settingsAutoMode.deleteTemplateMessage'),
            {
                cancelText: t('settingsAutoMode.cancel'),
                confirmText: t('settingsAutoMode.delete'),
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
                    title={t('settingsAutoMode.autoModeGroup')}
                    footer={t('settingsAutoMode.autoModeFooter')}
                >
                    <Item
                        title={t('settingsAutoMode.enableAutoMode')}
                        subtitle={autoModeEnabled ? t('settingsAutoMode.autoModeIsEnabled') : t('settingsAutoMode.autoModeIsDisabled')}
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
                        title={t('settingsAutoMode.cycleSettings')}
                        footer={autoModeMaxCycles === 0 
                            ? t('settingsAutoMode.cycleSettingsFooterUnlimited')
                            : t('settingsAutoMode.cycleSettingsFooterLimited', { count: autoModeMaxCycles })
                        }
                    >
                        <View style={{ padding: 16 }}>
                            <Text style={{ 
                                fontSize: 17, 
                                fontWeight: '600', 
                                color: theme.colors.text,
                                marginBottom: 8 
                            }}>
                                {t('settingsAutoMode.maximumCycles')}
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
                                placeholder={t('settingsAutoMode.enterNumber')}
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
                                    ? t('settingsAutoMode.unlimitedCycles')
                                    : t('settingsAutoMode.maximumCyclesCount', { count: autoModeMaxCycles })
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
                                        {t('settingsAutoMode.currentCycleCounts')}
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
                                                    {t('settingsAutoMode.sessionLabel', { id: sessionId })}
                                                </Text>
                                                <Text style={{ 
                                                    fontSize: 12, 
                                                    color: theme.colors.textSecondary,
                                                    marginTop: 2
                                                }}>
                                                    {t('settingsAutoMode.cycleProgress', { current: count, max: autoModeMaxCycles === 0 ? '∞' : String(autoModeMaxCycles) })}
                                                </Text>
                                            </View>
                                            <Pressable
                                                onPress={async () => {
                                                    const confirmed = await Modal.confirm(
                                                        t('settingsAutoMode.resetCycleCount'),
                                                        t('settingsAutoMode.resetCycleCountMessage'),
                                                        {
                                                            cancelText: t('settingsAutoMode.cancel'),
                                                            confirmText: t('common.reset'),
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
                                                t('settingsAutoMode.resetAllCycleCounts'),
                                                t('settingsAutoMode.resetAllCycleCountsMessage'),
                                                {
                                                    cancelText: t('settingsAutoMode.cancel'),
                                                    confirmText: t('settingsAutoMode.resetAll'),
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
                                            {t('settingsAutoMode.resetAllCycleCounts')}
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
                        title={t('settingsAutoMode.selectedTemplate')}
                        footer={selectedTemplate 
                            ? t('settingsAutoMode.selectedTemplateFooter', { name: selectedTemplate.name })
                            : t('settingsAutoMode.noTemplateSelected')
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
                                title={t('settingsAutoMode.noTemplateTitle')}
                                subtitle={t('settingsAutoMode.selectTemplateSubtitle')}
                                icon={<Ionicons name="document-outline" size={29} color="#8E8E93" />}
                                showChevron={false}
                            />
                        )}
                    </ItemGroup>
                )}

                {/* Templates List */}
                <ItemGroup 
                    title={t('settingsAutoMode.templates')}
                    footer={t('settingsAutoMode.templatesFooter')}
                >
                    {autoModeTemplates.length === 0 ? (
                        <Item
                            title={t('settingsAutoMode.noTemplates')}
                            subtitle={t('settingsAutoMode.addFirstTemplate')}
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
                <ItemGroup title={t('settingsAutoMode.addEditTemplate', { isEditing: !!editingTemplate })}>
                    <View style={{ padding: 16 }}>
                        <Text style={{ 
                            fontSize: 17, 
                            fontWeight: '600', 
                            color: theme.colors.text,
                            marginBottom: 8 
                        }}>
                            {t('settingsAutoMode.templateName')}
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
                            placeholder={t('settingsAutoMode.enterTemplateName')}
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
                            {t('settingsAutoMode.templateContent')}
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
                            placeholder={t('settingsAutoMode.enterTemplateContent')}
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
                                        {t('settingsAutoMode.cancel')}
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
                                    {editingTemplate ? t('settingsAutoMode.save') : t('settingsAutoMode.addTemplate')}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </ItemGroup>
            </ItemList>
        </ScrollView>
    );
}

