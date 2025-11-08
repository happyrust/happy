import { AgentContentView } from '@/components/AgentContentView';
import { AgentInput } from '@/components/AgentInput';
import { ModelMode } from '@/components/PermissionModeSelector';
import { getSuggestions } from '@/components/autocomplete/suggestions';
import { ChatHeaderView } from '@/components/ChatHeaderView';
import { ChatList } from '@/components/ChatList';
import { Deferred } from '@/components/Deferred';
import { EmptyMessages } from '@/components/EmptyMessages';
import { VoiceAssistantStatusBar } from '@/components/VoiceAssistantStatusBar';
import { useDraft } from '@/hooks/useDraft';
import { useAutoMode } from '@/hooks/useAutoMode';
import { Modal } from '@/modal';
import { toggleAutoModeForSession, isAutoModeEnabledForSession } from '@/utils/autoModeUtils';
import { voiceHooks } from '@/realtime/hooks/voiceHooks';
import { startRealtimeSession, stopRealtimeSession, updateCurrentSessionId } from '@/realtime/RealtimeSession';
import { gitStatusSync } from '@/sync/gitStatusSync';
import { sessionAbort } from '@/sync/ops';
import { storage, useIsDataReady, useLocalSetting, useRealtimeStatus, useSessionMessages, useSessionUsage, useSetting } from '@/sync/storage';
import { useSession } from '@/sync/storage';
import { Session } from '@/sync/storageTypes';
import { sync } from '@/sync/sync';
import { t } from '@/text';
import { tracking, trackMessageSent } from '@/track';
import { isRunningOnMac } from '@/utils/platform';
import { useDeviceType, useHeaderHeight, useIsLandscape, useIsTablet } from '@/utils/responsive';
import { formatPathRelativeToHome, getSessionAvatarId, getSessionName, useSessionStatus } from '@/utils/sessionUtils';
import { isVersionSupported, MINIMUM_CLI_VERSION } from '@/utils/versionUtils';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';

export const SessionView = React.memo((props: { id: string }) => {
    const sessionId = props.id;
    const router = useRouter();
    const session = useSession(sessionId);
    const isDataReady = useIsDataReady();
    const { theme } = useUnistyles();
    const safeArea = useSafeAreaInsets();
    const isLandscape = useIsLandscape();
    const deviceType = useDeviceType();
    const headerHeight = useHeaderHeight();

    // Compute header props based on session state
    const headerProps = useMemo(() => {
        if (!isDataReady) {
            // Loading state - show empty header
            return {
                title: '',
                subtitle: undefined,
                avatarId: undefined,
                onAvatarPress: undefined,
                isConnected: false,
                flavor: null
            };
        }

        if (!session) {
            // Deleted state - show deleted message in header
            return {
                title: t('errors.sessionDeleted'),
                subtitle: undefined,
                avatarId: undefined,
                onAvatarPress: undefined,
                isConnected: false,
                flavor: null
            };
        }

        // Normal state - show session info
        const isConnected = session.presence === 'online';
        return {
            title: getSessionName(session),
            subtitle: session.metadata?.path ? formatPathRelativeToHome(session.metadata.path, session.metadata?.homeDir) : undefined,
            avatarId: getSessionAvatarId(session),
            onAvatarPress: () => router.push(`/session/${sessionId}/info`),
            isConnected: isConnected,
            flavor: session.metadata?.flavor || null,
            tintColor: isConnected ? '#000' : '#8E8E93'
        };
    }, [session, isDataReady, sessionId, router]);

    return (
        <>
            {/* Status bar shadow for landscape mode */}
            {isLandscape && deviceType === 'phone' && (
                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: safeArea.top,
                    backgroundColor: theme.colors.surface,
                    zIndex: 1000,
                    shadowColor: theme.colors.shadow.color,
                    shadowOffset: {
                        width: 0,
                        height: 2,
                    },
                    shadowOpacity: theme.colors.shadow.opacity,
                    shadowRadius: 3,
                    elevation: 5,
                }} />
            )}

            {/* Header - always shown, hidden in landscape mode on phone */}
            {!(isLandscape && deviceType === 'phone') && (
                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000
                }}>
                    <ChatHeaderView
                        {...headerProps}
                        onBackPress={() => router.back()}
                    />
                </View>
            )}

            {/* Content based on state */}
            <View style={{ flex: 1, paddingTop: !(isLandscape && deviceType === 'phone') ? safeArea.top + headerHeight : 0 }}>
                {!isDataReady ? (
                    // Loading state
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                    </View>
                ) : !session ? (
                    // Deleted state
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="trash-outline" size={48} color={theme.colors.textSecondary} />
                        <Text style={{ color: theme.colors.text, fontSize: 20, marginTop: 16, fontWeight: '600' }}>{t('errors.sessionDeleted')}</Text>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 15, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>{t('errors.sessionDeletedDescription')}</Text>
                    </View>
                ) : (
                    // Normal session view
                    <SessionViewLoaded key={sessionId} sessionId={sessionId} session={session} />
                )}
            </View>
        </>
    );
});


function SessionViewLoaded({ sessionId, session }: { sessionId: string, session: Session }) {
    const { theme } = useUnistyles();
    const router = useRouter();
    const safeArea = useSafeAreaInsets();
    const isLandscape = useIsLandscape();
    const deviceType = useDeviceType();
    const isTablet = useIsTablet();
    const headerHeight = useHeaderHeight();
    const [message, setMessage] = React.useState('');
    const realtimeStatus = useRealtimeStatus();
    const { messages, isLoaded } = useSessionMessages(sessionId);
    const acknowledgedCliVersions = useLocalSetting('acknowledgedCliVersions');
    const autoModeTemplates = useLocalSetting('autoModeTemplates');
    const autoModeSelectedTemplateId = useLocalSetting('autoModeSelectedTemplateId');

    // Check if CLI version is outdated and not already acknowledged
    const cliVersion = session.metadata?.version;
    const machineId = session.metadata?.machineId;
    const isCliOutdated = cliVersion && !isVersionSupported(cliVersion, MINIMUM_CLI_VERSION);
    const isAcknowledged = machineId && acknowledgedCliVersions[machineId] === cliVersion;
    const shouldShowCliWarning = isCliOutdated && !isAcknowledged;
    // Get permission mode from session object, default to 'default'
    const permissionMode = session.permissionMode || 'default';
    // Get model mode from session object, default to 'default'
    const modelMode = session.modelMode || 'default';
    const sessionStatus = useSessionStatus(session);
    const sessionUsage = useSessionUsage(sessionId);
    const alwaysShowContextSize = useSetting('alwaysShowContextSize');
    const experiments = useSetting('experiments');

    // Use draft hook for auto-saving message drafts
    const { clearDraft } = useDraft(sessionId, message, setMessage);

    // Enable auto mode - automatically send template when AI finishes responding
    useAutoMode(sessionId, session);

    // Handle dismissing CLI version warning
    const handleDismissCliWarning = React.useCallback(() => {
        if (machineId && cliVersion) {
            storage.getState().applyLocalSettings({
                acknowledgedCliVersions: {
                    ...acknowledgedCliVersions,
                    [machineId]: cliVersion
                }
            });
        }
    }, [machineId, cliVersion, acknowledgedCliVersions]);

    // Function to update permission mode
    const updatePermissionMode = React.useCallback((mode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'read-only' | 'safe-yolo' | 'yolo') => {
        storage.getState().updateSessionPermissionMode(sessionId, mode);
    }, [sessionId]);

    // Function to update model mode
    const updateModelMode = React.useCallback((mode: ModelMode) => {
        storage.getState().updateSessionModelMode(sessionId, mode);
    }, [sessionId]);

    // Get auto mode state for this session
    const [autoModeEnabled, setAutoModeEnabledState] = React.useState(() => 
        isAutoModeEnabledForSession(sessionId)
    );

    // Update local state when global or session-specific auto mode changes
    React.useEffect(() => {
        const unsubscribe = storage.subscribe((state) => {
            setAutoModeEnabledState(isAutoModeEnabledForSession(sessionId));
        });
        return unsubscribe;
    }, [sessionId]);

    // Function to update auto mode
    const updateAutoMode = React.useCallback((enabled: boolean) => {
        toggleAutoModeForSession(sessionId, enabled);
        setAutoModeEnabledState(enabled);
    }, [sessionId]);

    // Repeat send state tracking
    const repeatSendStateRef = React.useRef<{
        active: boolean;
        message: string;
        totalTimes: number;
        sentCount: number;
        lastSentAt: number;
    } | null>(null);
    
    // Function to initiate repeat send
    const handleSendMultiple = React.useCallback((times: number, messageText: string) => {
        if (!messageText.trim()) return;
        
        // Initialize repeat send state
        repeatSendStateRef.current = {
            active: true,
            message: messageText,
            totalTimes: times,
            sentCount: 0,
            lastSentAt: 0,
        };
        
        // Send the first message immediately
        sync.sendMessage(sessionId, messageText);
        trackMessageSent();
        repeatSendStateRef.current.sentCount = 1;
        repeatSendStateRef.current.lastSentAt = Date.now();
        
        // If only sending once, we're done
        if (times === 1) {
            repeatSendStateRef.current = null;
        }
    }, [sessionId]);

    // Check if session has active operations (similar to useAutoMode logic)
    const hasActiveOperations = React.useCallback((currentSession: Session | null): boolean => {
        if (!currentSession) return false;
        
        // Check if session is still thinking
        if (currentSession.thinking) return true;
        
        // Check for pending permission requests
        if (currentSession.agentState?.requests && Object.keys(currentSession.agentState.requests).length > 0) {
            return true;
        }
        
        // Check for running tool calls in messages
        const currentMessages = storage.getState().sessionMessages[sessionId]?.messages || [];
        for (const message of currentMessages) {
            if (message.kind === 'tool-call' && message.tool?.state === 'running') {
                return true;
            }
        }
        
        return false;
    }, [sessionId]);
    
    // Monitor session state for repeat send continuation
    const prevSessionStateRef = React.useRef<string | null>(null);
    const checkTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    
    React.useEffect(() => {
        // Cleanup timeout on unmount
        return () => {
            if (checkTimeoutRef.current) {
                clearTimeout(checkTimeoutRef.current);
                checkTimeoutRef.current = null;
            }
        };
    }, [sessionId]);
    
    React.useEffect(() => {
        if (!session) {
            prevSessionStateRef.current = null;
            if (checkTimeoutRef.current) {
                clearTimeout(checkTimeoutRef.current);
                checkTimeoutRef.current = null;
            }
            return;
        }
        
        const currentState = sessionStatus.state;
        const prevState = prevSessionStateRef.current;
        
        // Check if we have an active repeat send
        const repeatState = repeatSendStateRef.current;
        if (!repeatState || !repeatState.active) {
            prevSessionStateRef.current = currentState;
            return;
        }
        
        // Detect transition from 'thinking' to 'waiting' (AI finished responding)
        if (prevState === 'thinking' && currentState === 'waiting') {
            // Check if session is still online
            if (sessionStatus.isConnected && session.presence === 'online') {
                // Check if we need to send more messages
                if (repeatState.sentCount < repeatState.totalTimes) {
                    // Clear any existing timeout
                    if (checkTimeoutRef.current) {
                        clearTimeout(checkTimeoutRef.current);
                        checkTimeoutRef.current = null;
                    }
                    
                    // Function to check if it's safe to send next message
                    const checkAndSend = (attempt: number = 0) => {
                        const maxAttempts = 5;
                        const baseDelay = 500;
                        const delay = baseDelay * (attempt + 1);
                        
                        const currentRepeatState = repeatSendStateRef.current;
                        if (!currentRepeatState || !currentRepeatState.active) return;
                        
                        // Get fresh session state
                        const currentSession = storage.getState().sessions[sessionId];
                        if (!currentSession) return;
                        
                        // Check if session is still online and not thinking
                        if (currentSession.presence !== 'online' || currentSession.thinking) {
                            return;
                        }
                        
                        // Check for active operations (running tools, pending permissions, etc.)
                        if (hasActiveOperations(currentSession)) {
                            // Still has active operations, check again after delay
                            if (attempt < maxAttempts) {
                                checkTimeoutRef.current = setTimeout(() => {
                                    checkAndSend(attempt + 1);
                                }, delay);
                            }
                            return;
                        }
                        
                        // All checks passed - safe to send next message
                        sync.sendMessage(sessionId, currentRepeatState.message);
                        trackMessageSent();
                        currentRepeatState.sentCount += 1;
                        currentRepeatState.lastSentAt = Date.now();
                        
                        // Check if we're done
                        if (currentRepeatState.sentCount >= currentRepeatState.totalTimes) {
                            repeatSendStateRef.current = null;
                        }
                    };
                    
                    // Start checking after initial delay
                    checkTimeoutRef.current = setTimeout(() => {
                        checkAndSend(0);
                    }, 300);
                }
            } else {
                // Connection lost, cancel repeat send
                repeatSendStateRef.current = null;
            }
        }
        
        prevSessionStateRef.current = currentState;
    }, [session, sessionStatus.state, sessionStatus.isConnected, session?.presence, session?.thinking, session?.agentState, sessionId, hasActiveOperations]);

    // Memoize header-dependent styles to prevent re-renders
    const headerDependentStyles = React.useMemo(() => ({
        contentContainer: {
            flex: 1
        },
        flatListStyle: {
            marginTop: 0 // No marginTop needed since header is handled by parent
        },
    }), []);


    // Handle microphone button press - memoized to prevent button flashing
    const handleMicrophonePress = React.useCallback(async () => {
        if (realtimeStatus === 'connecting') {
            return; // Prevent actions during transitions
        }
        if (realtimeStatus === 'disconnected' || realtimeStatus === 'error') {
            try {
                const initialPrompt = voiceHooks.onVoiceStarted(sessionId);
                await startRealtimeSession(sessionId, initialPrompt);
                tracking?.capture('voice_session_started', { sessionId });
            } catch (error) {
                console.error('Failed to start realtime session:', error);
                Modal.alert(t('common.error'), t('errors.voiceSessionFailed'));
                tracking?.capture('voice_session_error', { error: error instanceof Error ? error.message : 'Unknown error' });
            }
        } else if (realtimeStatus === 'connected') {
            await stopRealtimeSession();
            tracking?.capture('voice_session_stopped');

            // Notify voice assistant about voice session stop
            voiceHooks.onVoiceStopped();
        }
    }, [realtimeStatus, sessionId]);

    // Memoize mic button state to prevent flashing during chat transitions
    const micButtonState = useMemo(() => ({
        onMicPress: handleMicrophonePress,
        isMicActive: realtimeStatus === 'connected' || realtimeStatus === 'connecting'
    }), [handleMicrophonePress, realtimeStatus]);

    // Trigger session visibility and initialize git status sync
    React.useLayoutEffect(() => {

        // Trigger session sync
        sync.onSessionVisible(sessionId);

        // Update realtime session ID if voice is active to ensure messages go to current session
        if (realtimeStatus === 'connected') {
            updateCurrentSessionId(sessionId);
        }

        // Initialize git status sync for this session
        gitStatusSync.getSync(sessionId);
    }, [sessionId, realtimeStatus]);

    let content = (
        <>
            <Deferred>
                {messages.length > 0 && (
                    <ChatList session={session} />
                )}
            </Deferred>
        </>
    );
    const placeholder = messages.length === 0 ? (
        <>
            {isLoaded ? (
                <EmptyMessages session={session} />
            ) : (
                <ActivityIndicator size="small" color={theme.colors.textSecondary} />
            )}
        </>
    ) : null;

    const input = (
        <AgentInput
            placeholder={t('session.inputPlaceholder')}
            value={message}
            onChangeText={setMessage}
            sessionId={sessionId}
            permissionMode={permissionMode}
            onPermissionModeChange={updatePermissionMode}
            modelMode={modelMode}
            onModelModeChange={updateModelMode}
            autoModeEnabled={autoModeEnabled}
            onAutoModeChange={updateAutoMode}
            autoModeTemplates={autoModeTemplates}
            autoModeSelectedTemplateId={autoModeSelectedTemplateId}
            metadata={session.metadata}
            connectionStatus={{
                text: sessionStatus.statusText,
                color: sessionStatus.statusColor,
                dotColor: sessionStatus.statusDotColor,
                isPulsing: sessionStatus.isPulsing
            }}
            onSend={() => {
                if (message.trim()) {
                    setMessage('');
                    clearDraft();
                    sync.sendMessage(sessionId, message);
                    trackMessageSent();
                }
            }}
            onSendMultiple={handleSendMultiple}
            onMicPress={micButtonState.onMicPress}
            isMicActive={micButtonState.isMicActive}
            onAbort={() => sessionAbort(sessionId)}
            showAbortButton={sessionStatus.state === 'thinking' || sessionStatus.state === 'waiting'}
            onFileViewerPress={experiments ? () => router.push(`/session/${sessionId}/files`) : undefined}
            // Autocomplete configuration
            autocompletePrefixes={['@', '/']}
            autocompleteSuggestions={(query) => getSuggestions(sessionId, query)}
            usageData={sessionUsage ? {
                inputTokens: sessionUsage.inputTokens,
                outputTokens: sessionUsage.outputTokens,
                cacheCreation: sessionUsage.cacheCreation,
                cacheRead: sessionUsage.cacheRead,
                contextSize: sessionUsage.contextSize
            } : session.latestUsage ? {
                inputTokens: session.latestUsage.inputTokens,
                outputTokens: session.latestUsage.outputTokens,
                cacheCreation: session.latestUsage.cacheCreation,
                cacheRead: session.latestUsage.cacheRead,
                contextSize: session.latestUsage.contextSize
            } : undefined}
            alwaysShowContextSize={alwaysShowContextSize}
        />
    );


    return (
        <>
            {/* Voice Assistant Status Bar - positioned as overlay at top */}
            {!isTablet && !(isLandscape && deviceType === 'phone') && realtimeStatus !== 'disconnected' && (
                <View style={{
                    position: 'absolute',
                    top: 0, // Position at top since header is handled by parent
                    left: 0,
                    right: 0,
                    zIndex: 999 // Below header but above content
                }}>
                    <VoiceAssistantStatusBar variant="full" />
                </View>
            )}

            {/* CLI Version Warning Overlay - Subtle centered pill */}
            {shouldShowCliWarning && !(isLandscape && deviceType === 'phone') && (
                <Pressable
                    onPress={handleDismissCliWarning}
                    style={{
                        position: 'absolute',
                        top: safeArea.top + headerHeight + ((!isTablet && realtimeStatus !== 'disconnected') ? 48 : 0) + 8, // Position below header and voice bar if present
                        alignSelf: 'center',
                        backgroundColor: '#FFF3CD',
                        borderRadius: 100, // Fully rounded pill
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        flexDirection: 'row',
                        alignItems: 'center',
                        zIndex: 998, // Below voice bar but above content
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 4,
                        elevation: 4,
                    }}
                >
                    <Ionicons name="warning-outline" size={14} color="#FF9500" style={{ marginRight: 6 }} />
                    <Text style={{
                        fontSize: 12,
                        color: '#856404',
                        fontWeight: '600'
                    }}>
                        {t('sessionInfo.cliVersionOutdated')}
                    </Text>
                    <Ionicons name="close" size={14} color="#856404" style={{ marginLeft: 8 }} />
                </Pressable>
            )}

            {/* Main content area - no padding since header is overlay */}
            <View style={{ flexBasis: 0, flexGrow: 1, paddingBottom: safeArea.bottom + ((isRunningOnMac() || Platform.OS === 'web') ? 32 : 0) }}>
                <AgentContentView
                    content={content}
                    input={input}
                    placeholder={placeholder}
                />
            </View >

            {/* Back button for landscape phone mode when header is hidden */}
            {
                isLandscape && deviceType === 'phone' && (
                    <Pressable
                        onPress={() => router.back()}
                        style={{
                            position: 'absolute',
                            top: safeArea.top + 8,
                            left: 16,
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: `rgba(${theme.dark ? '28, 23, 28' : '255, 255, 255'}, 0.9)`,
                            alignItems: 'center',
                            justifyContent: 'center',
                            ...Platform.select({
                                ios: {
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 4,
                                },
                                android: {
                                    elevation: 2,
                                }
                            }),
                        }}
                        hitSlop={15}
                    >
                        <Ionicons
                            name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
                            size={Platform.select({ ios: 28, default: 24 })}
                            color="#000"
                        />
                    </Pressable>
                )
            }
        </>
    )
}
