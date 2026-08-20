// ═══════════════════════════════════════════════════════════
// AlarmNotificationContext — GLOBAL alarm notification handler
// ✅ FIXED: Skip API calls + socket listeners when no userToken
//          or on super-admin pages
// ═══════════════════════════════════════════════════════════

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import socketService from '../services/socket';
import { settingsAPI } from '../services/api';
import { useToast } from './ToastContext';

const AlarmNotificationContext = createContext(null);

const LS_ENABLED = 'onlinescada.alarmSoundEnabled';
const LS_VOLUME  = 'onlinescada.alarmSoundVolume';
const DEDUP_WINDOW_MS = 3000;

// ─── Helper: Is this a workspace user context? ─────────────
// Returns false if: on super-admin route, or no userToken exists
const isWorkspaceUserContext = () => {
  if (typeof window === 'undefined') return false;
  if (window.location.pathname.startsWith('/super-admin')) return false;
  if (!localStorage.getItem('userToken')) return false;
  return true;
};

export const AlarmNotificationProvider = ({ children }) => {
  const { showToast } = useToast();

  const [soundEnabled, setSoundEnabledState] = useState(() => {
    const stored = localStorage.getItem(LS_ENABLED);
    return stored === null ? true : stored === 'true';
  });

  const [soundVolume, setSoundVolumeState] = useState(() => {
    const stored = localStorage.getItem(LS_VOLUME);
    const parsed = parseInt(stored);
    return isNaN(parsed) ? 70 : Math.max(0, Math.min(100, parsed));
  });

  const soundEnabledRef = useRef(soundEnabled);
  const soundVolumeRef  = useRef(soundVolume);
  const audioRef        = useRef(null);
  const recentAlarmsRef = useRef(new Map());

  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { soundVolumeRef.current  = soundVolume;  }, [soundVolume]);

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
  // Load Settings defaults on mount
  // ✅ FIXED: Only if user is logged in (skip on super-admin/login pages)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    // ✅ Guard: don't call API if we're not a workspace user
    if (!isWorkspaceUserContext()) return;

    const loadFromSettings = async () => {
      try {
        const res = await settingsAPI.getAll();
        const n = res.data?.data?.notifications || {};

        if (localStorage.getItem(LS_ENABLED) === null && typeof n.enableSoundAlerts === 'boolean') {
          setSoundEnabled(n.enableSoundAlerts);
        }
        if (localStorage.getItem(LS_VOLUME) === null && typeof n.alarmSoundVolume === 'number') {
          setSoundVolume(n.alarmSoundVolume);
        }
      } catch {
        // Silent fallback
      }
    };
    loadFromSettings();

    // Request browser notification permission (only for workspace users)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  // Play audio file with WebAudio fallback
  // ═══════════════════════════════════════════════════════════
  const playAlarmSound = useCallback((priority = 'MEDIUM') => {
    const enabled = soundEnabledRef.current;
    const volume  = soundVolumeRef.current;
    if (!enabled) return;

    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/alarm.mp3');
        audioRef.current.preload = 'auto';
      }
      audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
      audioRef.current.currentTime = 0;

      const playPromise = audioRef.current.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(() => playFallbackBeep(priority, volume));
      }
    } catch {
      playFallbackBeep(priority, volume);
    }
  }, []);

  const playFallbackBeep = (priority, volume) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const gainVal = (volume / 100) * 0.3;

      const patterns = {
        CRITICAL: [
          { delay: 0,   freq: 1000, duration: 0.15 },
          { delay: 180, freq: 1000, duration: 0.15 },
          { delay: 360, freq: 1000, duration: 0.15 },
          { delay: 540, freq: 1000, duration: 0.25 },
        ],
        HIGH:   [{ delay: 0, freq: 880, duration: 0.15 }, { delay: 220, freq: 880, duration: 0.15 }],
        MEDIUM: [{ delay: 0, freq: 660, duration: 0.20 }],
        LOW:    [{ delay: 0, freq: 440, duration: 0.15 }],
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

  const showBrowserNotification = useCallback((alarm) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const notif = new Notification(`🚨 ${alarm.priority || 'ALARM'}: ${alarm.alarmName}`, {
        body: alarm.message || `Tag ${alarm.tag} triggered`,
        icon: '/favicon.ico',
        tag: `alarm-${alarm.alarmName}`,
        requireInteraction: alarm.priority === 'CRITICAL',
        silent: soundEnabledRef.current,
      });
      notif.onclick = () => { window.focus(); notif.close(); };
      if (alarm.priority !== 'CRITICAL') setTimeout(() => notif.close(), 8000);
    } catch (err) {
      console.warn('Browser notification failed:', err.message);
    }
  }, []);

  const testSound = useCallback((priority = 'MEDIUM') => {
    playAlarmSound(priority);
  }, [playAlarmSound]);

  // ═══════════════════════════════════════════════════════════
  // GLOBAL SOCKET LISTENERS
  // ✅ FIXED: Only register listeners if workspace user is active
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    // ✅ Guard: no listeners on super-admin or logged-out pages
    if (!isWorkspaceUserContext()) return;

    const handleAlarmTriggered = (alarm) => {
      if (!alarm || !alarm.alarmName) return;

      const now = Date.now();
      const recentTime = recentAlarmsRef.current.get(alarm.alarmName);
      if (recentTime && (now - recentTime) < DEDUP_WINDOW_MS) return;
      recentAlarmsRef.current.set(alarm.alarmName, now);

      for (const [key, ts] of recentAlarmsRef.current.entries()) {
        if (now - ts > 60000) recentAlarmsRef.current.delete(key);
      }

      const alarmSoundOk = alarm.soundEnabled !== false;
      if (alarmSoundOk) playAlarmSound(alarm.priority || 'MEDIUM');

      showBrowserNotification(alarm);

      const toastType =
        alarm.priority === 'CRITICAL' ? 'error' :
        alarm.priority === 'HIGH'     ? 'warning' :
        alarm.priority === 'MEDIUM'   ? 'warning' : 'info';

      showToast(
        `🚨 ${alarm.priority || 'ALARM'}: ${alarm.alarmName}${alarm.message ? ` — ${alarm.message}` : ''}`,
        toastType,
        alarm.priority === 'CRITICAL' ? 8000 : 4000
      );
    };

    const handleAlarmCleared = (alarm) => {
      if (!alarm || !alarm.alarmName) return;
      recentAlarmsRef.current.delete(alarm.alarmName);
      showToast(`✅ Cleared: ${alarm.alarmName}`, 'success', 2500);
    };

    socketService.on('alarmTriggered', handleAlarmTriggered);
    socketService.on('alarmCleared', handleAlarmCleared);

    return () => {
      socketService.off('alarmTriggered', handleAlarmTriggered);
      socketService.off('alarmCleared', handleAlarmCleared);
    };
  }, [playAlarmSound, showBrowserNotification, showToast]);

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

export const useAlarmNotification = () => {
  const ctx = useContext(AlarmNotificationContext);
  if (!ctx) {
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