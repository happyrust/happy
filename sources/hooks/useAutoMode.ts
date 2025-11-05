import { useEffect, useRef } from 'react';
import { Session } from '@/sync/storageTypes';
import { useSessionStatus } from '@/utils/sessionUtils';
import { useLocalSetting, storage, useSessionMessages } from '@/sync/storage';
import { sync } from '@/sync/sync';
import { SessionState } from '@/utils/sessionUtils';
import { Message } from '@/sync/typesMessage';

/**
 * Check if a session has any active operations that should prevent auto-reply:
 * - Running tool calls
 * - Pending permission requests
 * - Still thinking/processing
 */
function hasActiveOperations(session: Session | null, messages: Message[]): boolean {
    if (!session) return false;
    
    // Check if session is still thinking
    if (session.thinking) {
        return true;
    }
    
    // Check for pending permission requests
    if (session.agentState?.requests && Object.keys(session.agentState.requests).length > 0) {
        return true;
    }
    
    // Check for running tool calls in messages
    for (const message of messages) {
        if (message.kind === 'tool-call' && message.tool?.state === 'running') {
            return true;
        }
    }
    
    return false;
}

/**
 * Hook to automatically send template messages when AI finishes responding.
 * Monitors session state transitions from 'thinking' to 'waiting' and sends
 * the selected template if auto mode is enabled.
 * 
 * Improved detection: Only sends when AI has truly finished, checking for:
 * - No running tool calls
 * - No pending permission requests
 * - Session is not thinking
 */
export function useAutoMode(sessionId: string, session: Session | null) {
    const sessionStatus = session ? useSessionStatus(session) : null;
    const { messages } = useSessionMessages(sessionId);
    const autoModeEnabled = useLocalSetting('autoModeEnabled');
    const autoModeTemplates = useLocalSetting('autoModeTemplates');
    const autoModeSelectedTemplateId = useLocalSetting('autoModeSelectedTemplateId');
    const autoModeSessionEnabled = useLocalSetting('autoModeSessionEnabled');
    const autoModeMaxCycles = useLocalSetting('autoModeMaxCycles');
    const autoModeCycleCount = useLocalSetting('autoModeCycleCount');
    
    // Track previous state to detect transitions
    const prevStateRef = useRef<SessionState | null>(null);
    const hasSentRef = useRef(false); // Prevent sending multiple times for the same transition
    const lastThinkingStateRef = useRef<number>(0); // Track when thinking state started
    const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track pending checks
    
    useEffect(() => {
        // Cleanup timeout on unmount or when dependencies change
        return () => {
            if (checkTimeoutRef.current) {
                clearTimeout(checkTimeoutRef.current);
                checkTimeoutRef.current = null;
            }
        };
    }, [sessionId]);
    
    useEffect(() => {
        if (!session || !sessionStatus) {
            prevStateRef.current = null;
            hasSentRef.current = false;
            lastThinkingStateRef.current = 0;
            if (checkTimeoutRef.current) {
                clearTimeout(checkTimeoutRef.current);
                checkTimeoutRef.current = null;
            }
            return;
        }
        
        const currentState = sessionStatus.state;
        const prevState = prevStateRef.current;
        
        // Check if auto mode is enabled for this session
        const isSessionAutoModeEnabled = autoModeSessionEnabled[sessionId] ?? autoModeEnabled;
        
        // Only proceed if auto mode is enabled
        if (!isSessionAutoModeEnabled) {
            prevStateRef.current = currentState;
            hasSentRef.current = false;
            if (currentState !== 'thinking') {
                lastThinkingStateRef.current = 0;
            }
            return;
        }
        
        // Check if we have a selected template
        const selectedTemplate = autoModeTemplates.find(
            t => t.id === autoModeSelectedTemplateId
        );
        
        if (!selectedTemplate) {
            prevStateRef.current = currentState;
            hasSentRef.current = false;
            if (currentState !== 'thinking') {
                lastThinkingStateRef.current = 0;
            }
            return;
        }
        
        // Check cycle count limit
        const currentCycleCount = autoModeCycleCount[sessionId] || 0;
        if (autoModeMaxCycles > 0 && currentCycleCount >= autoModeMaxCycles) {
            // Cycle limit reached, don't send
            prevStateRef.current = currentState;
            hasSentRef.current = false;
            if (currentState !== 'thinking') {
                lastThinkingStateRef.current = 0;
            }
            return;
        }
        
        // Track when thinking state starts
        if (currentState === 'thinking' && prevState !== 'thinking') {
            lastThinkingStateRef.current = Date.now();
            hasSentRef.current = false;
        }
        
        // Detect transition from 'thinking' to 'waiting'
        if (prevState === 'thinking' && currentState === 'waiting' && !hasSentRef.current) {
            // Only send if session is online and not disconnected
            if (sessionStatus.isConnected && session.presence === 'online') {
                // Clear any existing timeout
                if (checkTimeoutRef.current) {
                    clearTimeout(checkTimeoutRef.current);
                    checkTimeoutRef.current = null;
                }
                
                // Function to check if it's safe to send auto-reply
                const checkAndSend = (attempt: number = 0) => {
                    // Maximum 5 attempts with increasing delays (500ms, 1000ms, 1500ms, 2000ms, 2500ms)
                    const maxAttempts = 5;
                    const baseDelay = 500;
                    const delay = baseDelay * (attempt + 1);
                    
                    // Get fresh session and messages state
                    const currentSession = storage.getState().sessions[sessionId];
                    const currentMessages = storage.getState().sessionMessages[sessionId]?.messages || [];
                    
                    if (!currentSession || hasSentRef.current) {
                        return;
                    }
                    
                    // Check if session is still online and not thinking
                    if (currentSession.presence !== 'online' || currentSession.thinking) {
                        return;
                    }
                    
                    // Check for active operations (running tools, pending permissions, etc.)
                    if (hasActiveOperations(currentSession, currentMessages)) {
                        // Still has active operations, check again after delay
                        if (attempt < maxAttempts) {
                            checkTimeoutRef.current = setTimeout(() => {
                                checkAndSend(attempt + 1);
                            }, delay);
                        }
                        return;
                    }
                    
                    // All checks passed - safe to send auto-reply
                    const templateToSend = selectedTemplate.content;
                    sync.sendMessage(sessionId, templateToSend);
                    hasSentRef.current = true;
                    
                    // Increment cycle count
                    const updatedCycleCount = storage.getState().localSettings.autoModeCycleCount;
                    storage.getState().applyLocalSettings({
                        autoModeCycleCount: {
                            ...updatedCycleCount,
                            [sessionId]: (updatedCycleCount[sessionId] || 0) + 1,
                        },
                    });
                };
                
                // Start checking after initial delay
                checkTimeoutRef.current = setTimeout(() => {
                    checkAndSend(0);
                }, 300);
            }
        }
        
        // Reset hasSent flag when entering thinking state
        if (currentState === 'thinking') {
            hasSentRef.current = false;
        }
        
        // Update previous state
        prevStateRef.current = currentState;
    }, [
        session,
        sessionStatus?.state,
        sessionStatus?.isConnected,
        session?.presence,
        session?.thinking,
        session?.agentState,
        messages,
        sessionId,
        autoModeEnabled,
        autoModeTemplates,
        autoModeSelectedTemplateId,
        autoModeSessionEnabled,
        autoModeMaxCycles,
        autoModeCycleCount,
    ]);
}

