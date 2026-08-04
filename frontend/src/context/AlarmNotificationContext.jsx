// ═══════════════════════════════════════════════════════════
// AlarmNotificationContext — GLOBAL alarm notification handler
//
// Purpose:
//   Play alarm sounds & show notifications from ANY page in the app.
//   Not just when the user is on the Alarms page.
//
// Features:
//   ✅ Global socket listener for 'alarmTriggered' + 'alarmCleared'
//   ✅ Real audio file playback with WebAudio fallback
//   ✅ Volume + enabled state persisted in localStorage
//   ✅ Loads defaults from Settings API on mount
//   ✅ Different urgency per priority (CRITICAL = triple beep, others = single)
//   ✅ Dedupes rapid duplicate alarms (same alarm within 3s)
//   ✅ Browser notification (works even when tab is background)
//   ✅ Global toast notification with priority-colored style
//   ✅ Respects per-alarm soundEnabled flag from backend
// ═══════════════════════════════════════════════════════════

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import socketService from '../services/socket';
import { settingsAPI } from '../services/api';
import { useToast } from './ToastContext';

const AlarmNotificationContext = createContext(null);

// ─── LocalStorage keys (persist across navigation) ───
const LS_ENABLED = 'onlinescada.alarmSoundEnabled';
const LS_VOLUME = 'onlinescada.alarmSoundVolume';

// ─── Dedup window: same alarm within this window → sound plays only once ───
const DEDUP_WINDOW_MS = 3000;

export const AlarmNotificationProvider = ({ children }) => {
  const { showToast } = useToast();

  // Sound state — initialize from localStorage
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    const stored = localStorage.getItem(LS_ENABLED);
    return stored === null ? true : stored === 'true';
  });

  const [soundVolume, setSoundVolumeState] = useState(() => {
    const stored = localStorage.getItem(LS_VOLUME);
    const parsed = parseInt(stored);
    return isNaN(parsed) ? 70 : Math.max(0, Math.min(100, parsed));
  });

  // Refs to avoid re-subscribing socket on every state change
  const soundEnabledRef = useRef(soundEnabled);
  const soundVolumeRef = useRef(soundVolume);
  const audioRef = useRef(null);
  const recentAlarmsRef = useRef(new Map()); // alarmName → timestamp (for dedup)

  // Keep refs in sync with state
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { soundVolumeRef.current = soundVolume; }, [soundVolume]);

  // ─── Persist to localStorage whenever changed ───
  const setSoundEnabled = useCallback((val) => {
    setSoundEnabledState(val);
    localStorage.setItem(LS_ENABLED, String(val));
  }, []);

  const setSoundVolume = useCallback((val) => {
    const clamped = Math.max(0, Math.min(100, val));
    setSoundVolumeState(clamped);
    localStorage.setItem(LS_VOLUME, String(clamped));
  }, []);

  // ═══════════════════════════════════════════════════════════
  // Load Settings defaults on mount (only if localStorage empty)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const loadFromSettings = async () => {
      try {
        const res = await settingsAPI.getAll();
        const n = res.data?.data?.notifications || {};

        // Only apply from Settings if user hasn't explicitly set values via localStorage
        if (localStorage.getItem(LS_ENABLED) === null && typeof n.enableSoundAlerts === 'boolean') {
          setSoundEnabled(n.enableSoundAlerts);
        }
        if (localStorage.getItem(LS_VOLUME) === null && typeof n.alarmSoundVolume === 'number') {
          setSoundVolume(n.alarmSoundVolume);
        }
      } catch {
        // Silent fallback — use defaults
      }
    };
    loadFromSettings();

    // Request browser notification permission (once)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  // Play audio file with fallback to WebAudio beep
  // ═══════════════════════════════════════════════════════════
  const playAlarmSound = useCallback((priority = 'MEDIUM') => {
    const enabled = soundEnabledRef.current;
    const volume = soundVolumeRef.current;
    if (!enabled) return;

    try {
      // Try real audio file first
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/alarm.mp3');
        audioRef.current.preload = 'auto';
      }
      audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
      audioRef.current.currentTime = 0;

      const playPromise = audioRef.current.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(() => {
          // File missing OR autoplay blocked → fallback
          playFallbackBeep(priority, volume);
        });
      }
    } catch {
      playFallbackBeep(priority, volume);
    }
  }, []);

  // ─── WebAudio fallback — different pattern per priority ───
  const playFallbackBeep = (priority, volume) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const gainVal = (volume / 100) * 0.3; // Cap at 0.3 to avoid harshness

      // Different beep patterns per priority
      const patterns = {
        CRITICAL: [
          { delay: 0,   freq: 1000, duration: 0.15 },
          { delay: 180, freq: 1000, duration: 0.15 },
          { delay: 360, freq: 1000, duration: 0.15 },
          { delay: 540, freq: 1000, duration: 0.25 }, // Longer final beep
        ],
        HIGH: [
          { delay: 0,   freq: 880, duration: 0.15 },
          { delay: 220, freq: 880, duration: 0.15 },
        ],
        MEDIUM: [
          { delay: 0, freq: 660, duration: 0.20 },
        ],
        LOW: [
          { delay: 0, freq: 440, duration: 0.15 },
        ],
      };

      const pattern = patterns[priority] || patterns.MEDIUM;

      pattern.forEach(({ delay, freq, duration }) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(gainVal, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + duration);
        }, delay);
      });
    } catch (e) {
      console.warn('Audio playback failed:', e.message);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // Show browser notification (works even when tab unfocused)
  // ═══════════════════════════════════════════════════════════
  const showBrowserNotification = useCallback((alarm) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      const notif = new Notification(`🚨 ${alarm.priority || 'ALARM'}: ${alarm.alarmName}`, {
        body: alarm.message || `Tag ${alarm.tag} triggered`,
        icon: '/favicon.ico',
        tag: `alarm-${alarm.alarmName}`, // Dedup by tag (browser handles)
        requireInteraction: alarm.priority === 'CRITICAL', // Critical stays visible
        silent: soundEnabledRef.current, // We play our own sound
      });

      // Click notification → focus the tab
      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      // Auto-close non-critical after 8s
      if (alarm.priority !== 'CRITICAL') {
        setTimeout(() => notif.close(), 8000);
      }
    } catch (err) {
      console.warn('Browser notification failed:', err.message);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  // Test sound (called from Alarms page or Settings)
  // ═══════════════════════════════════════════════════════════
  const testSound = useCallback((priority = 'MEDIUM') => {
    playAlarmSound(priority);
  }, [playAlarmSound]);

  // ═══════════════════════════════════════════════════════════
  // GLOBAL SOCKET LISTENERS
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const handleAlarmTriggered = (alarm) => {
      if (!alarm || !alarm.alarmName) return;

      // ─── Dedup: skip if same alarm fired within DEDUP_WINDOW_MS ───
      const now = Date.now();
      const recentTime = recentAlarmsRef.current.get(alarm.alarmName);
      if (recentTime && (now - recentTime) < DEDUP_WINDOW_MS) {
        return; // Skip — recent duplicate
      }
      recentAlarmsRef.current.set(alarm.alarmName, now);

      // Cleanup old dedup entries (older than 60s)
      for (const [key, ts] of recentAlarmsRef.current.entries()) {
        if (now - ts > 60000) recentAlarmsRef.current.delete(key);
      }

      // ─── Play sound (respects global enabled + per-alarm soundEnabled) ───
      const alarmSoundOk = alarm.soundEnabled !== false;
      if (alarmSoundOk) {
        playAlarmSound(alarm.priority || 'MEDIUM');
      }

      // ─── Browser notification (also for background tabs) ───
      showBrowserNotification(alarm);

      // ─── In-app toast ───
      const toastType =
        alarm.priority === 'CRITICAL' ? 'error' :
        alarm.priority === 'HIGH' ? 'warning' :
        alarm.priority === 'MEDIUM' ? 'warning' :
        'info';

      showToast(
        `🚨 ${alarm.priority || 'ALARM'}: ${alarm.alarmName}${alarm.message ? ` — ${alarm.message}` : ''}`,
        toastType,
        alarm.priority === 'CRITICAL' ? 8000 : 4000
      );
    };

    const handleAlarmCleared = (alarm) => {
      if (!alarm || !alarm.alarmName) return;
      // Clear dedup entry so re-trigger sounds again
      recentAlarmsRef.current.delete(alarm.alarmName);
      // Optional: soft toast for cleared alarms (not urgent)
      showToast(`✅ Cleared: ${alarm.alarmName}`, 'success', 2500);
    };

    socketService.on('alarmTriggered', handleAlarmTriggered);
    socketService.on('alarmCleared', handleAlarmCleared);

    return () => {
      socketService.off('alarmTriggered', handleAlarmTriggered);
      socketService.off('alarmCleared', handleAlarmCleared);
    };
  }, [playAlarmSound, showBrowserNotification, showToast]);

  // ═══════════════════════════════════════════════════════════
  // Context value
  // ═══════════════════════════════════════════════════════════
  const value = {
    soundEnabled,
    setSoundEnabled,
    soundVolume,
    setSoundVolume,
    testSound,
    playAlarmSound,
  };

  return (
    <AlarmNotificationContext.Provider value={value}>
      {children}
    </AlarmNotificationContext.Provider>
  );
};

// ═══════════════════════════════════════════════════════════
// Hook to use in any component
// ═══════════════════════════════════════════════════════════
export const useAlarmNotification = () => {
  const ctx = useContext(AlarmNotificationContext);
  if (!ctx) {
    // Fallback for components rendered outside provider (safety)
    console.warn('useAlarmNotification called outside AlarmNotificationProvider');
    return {
      soundEnabled: true,
      setSoundEnabled: () => {},
      soundVolume: 70,
      setSoundVolume: () => {},
      testSound: () => {},
      playAlarmSound: () => {},
    };
  }
  return ctx;
};

export default AlarmNotificationContext;