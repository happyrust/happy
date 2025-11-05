import { useEffect, useRef } from 'react';
import { Session } from '@/sync/storageTypes';
import { useSessionStatus } from '@/utils/sessionUtils';
import { useLocalSetting, storage } from '@/sync/storage';
import { sync } from '@/sync/sync';
import { SessionState } from '@/utils/sessionUtils';

/**
 * Hook to automatically send template messages when AI finishes responding.
 * Monitors session state transitions from 'thinking' to 'waiting' and sends
 * the selected template if auto mode is enabled.
 */
export function useAutoMode(sessionId: string, session: Session | null) {
    const sessionStatus = session ? useSessionStatus(session) : null;
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
    
    useEffect(() => {
        if (!session || !sessionStatus) {
            prevStateRef.current = null;
            hasSentRef.current = false;
            lastThinkingStateRef.current = 0;
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
                // Add a small delay to ensure the transition is complete
                const delay = Math.max(100, 200);
                const templateToSend = selectedTemplate.content;
                setTimeout(() => {
                    // Get fresh session state to verify we're still waiting
                    const currentSession = storage.getState().sessions[sessionId];
                    if (currentSession && !hasSentRef.current) {
                        // Double-check session is still online and waiting
                        if (currentSession.presence === 'online' && !currentSession.thinking) {
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
                        }
                    }
                }, delay);
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
        sessionId,
        autoModeEnabled,
        autoModeTemplates,
        autoModeSelectedTemplateId,
        autoModeSessionEnabled,
        autoModeMaxCycles,
        autoModeCycleCount,
    ]);
}

