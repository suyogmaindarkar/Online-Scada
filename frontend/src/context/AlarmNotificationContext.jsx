// ═══════════════════════════════════════════════════════════
// AlarmNotificationContext — GLOBAL alarm notification handler
// ✅ Real audio playback (/alarm.mp3 & /sounds/alarm.mp3)
// ✅ Global Toast notifications on all pages
// ✅ Active alarms state sync + browser desktop notifications
// ═══════════════════════════════════════════════════════════

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import socketService from '../services/socket';
import { settingsAPI, alarmAPI } from '../services/api';
import { useToast } from './ToastContext';

const AlarmNotificationContext = createContext(null);

const LS_ENABLED = 'onlinescada.alarmSoundEnabled';
const LS_VOLUME  = 'onlinescada.alarmSoundVolume';
const DEDUP_WINDOW_MS = 2500;

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

  const [activeAlarms, setActiveAlarms] = useState([]);
  const soundEnabledRef = useRef(soundEnabled);
  const soundVolumeRef  = useRef(soundVolume);
  const audioRef        = useRef(null);
  const audioUnlockedRef = useRef(false);
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
  // User interaction unlock for browser autoplay policy
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          if (ctx.state === 'suspended') ctx.resume();
        }
        if (!audioRef.current) {
          audioRef.current = new Audio('/alarm.mp3');
          audioRef.current.volume = 0;
          audioRef.current.play().then(() => {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }).catch(() => {});
        }
        audioUnlockedRef.current = true;
      } catch {}
    };

    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // Load Settings & Active Alarms on mount / login
  // ═══════════════════════════════════════════════════════════
  const fetchActiveAlarms = useCallback(async () => {
    if (!localStorage.getItem('userToken')) return;
    try {
      const res = await alarmAPI.getActive();
      const alarms = res.data?.alarms || res.data?.data || [];
      setActiveAlarms(alarms);
    } catch {
      // Non-critical fallback
    }
  }, []);

  useEffect(() => {
    const loadFromSettings = async () => {
      if (!localStorage.getItem('userToken')) return;
      try {
        const res = await settingsAPI.getAll();
        const n = res.data?.data?.notifications || {};

        if (localStorage.getItem(LS_ENABLED) === null && typeof n.enableSoundAlerts === 'boolean') {
          setSoundEnabled(n.enableSoundAlerts);
        }
        if (localStorage.getItem(LS_VOLUME) === null && typeof n.alarmSoundVolume === 'number') {
          setSoundVolume(n.alarmSoundVolume);
        }
      } catch {}
    };

    loadFromSettings();
    fetchActiveAlarms();

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Safety polling for active alarms every 15 seconds
    const interval = setInterval(fetchActiveAlarms, 15000);
    return () => clearInterval(interval);
  }, [setSoundEnabled, setSoundVolume, fetchActiveAlarms]);

  // ═══════════════════════════════════════════════════════════
  // Play audio file (/alarm.mp3 -> /sounds/alarm.mp3 -> WebAudio)
  // ═══════════════════════════════════════════════════════════
  const playFallbackBeep = (priority, volume) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const gainVal = (volume / 100) * 0.35;

      const patterns = {
        CRITICAL: [
          { delay: 0,   freq: 1000, duration: 0.15 },
          { delay: 180, freq: 1000, duration: 0.15 },
          { delay: 360, freq: 1000, duration: 0.15 },
          { delay: 540, freq: 1000, duration: 0.30 },
        ],
        HIGH:   [{ delay: 0, freq: 880, duration: 0.15 }, { delay: 220, freq: 880, duration: 0.15 }],
        MEDIUM: [{ delay: 0, freq: 660, duration: 0.20 }],
        LOW:    [{ delay: 0, freq: 440, duration: 0.15 }],
      };

      const pattern = patterns[priority] || patterns.MEDIUM;
      pattern.forEach(({ delay, freq, duration }) => {
        setTimeout(() => {
          try {
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
          } catch {}
        }, delay);
      });
    } catch (e) {
      console.warn('Audio playback failed:', e.message);
    }
  };

  const playAlarmSound = useCallback((priority = 'MEDIUM') => {
    const enabled = soundEnabledRef.current;
    const volume  = soundVolumeRef.current;
    if (!enabled) return;

    try {
      const audio = new Audio('/alarm.mp3');
      audio.volume = Math.max(0, Math.min(1, volume / 100));
      audio.preload = 'auto';

      const playPromise = audio.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(() => {
          // Try /sounds/alarm.mp3
          const altAudio = new Audio('/sounds/alarm.mp3');
          altAudio.volume = Math.max(0, Math.min(1, volume / 100));
          const altPromise = altAudio.play();
          if (altPromise && altPromise.catch) {
            altPromise.catch(() => playFallbackBeep(priority, volume));
          }
        });
      }
    } catch {
      playFallbackBeep(priority, volume);
    }
  }, []);

  const showBrowserNotification = useCallback((alarm) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const notif = new Notification(`🚨 ${alarm.priority || 'ALARM'}: ${alarm.alarmName}`, {
        body: alarm.message || `Tag ${alarm.tag} triggered value ${alarm.value ?? ''}`,
        icon: '/favicon.svg',
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
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const handleAlarmTriggered = (alarm) => {
      if (!alarm || !alarm.alarmName) return;

      const now = Date.now();
      const recentTime = recentAlarmsRef.current.get(alarm.alarmName);
      if (recentTime && (now - recentTime) < DEDUP_WINDOW_MS) return;
      recentAlarmsRef.current.set(alarm.alarmName, now);

      for (const [key, ts] of recentAlarmsRef.current.entries()) {
        if (now - ts > 60000) recentAlarmsRef.current.delete(key);
      }

      // Update active alarms state
      setActiveAlarms((prev) => {
        const filtered = prev.filter((a) => a._id !== alarm._id && a.alarmName !== alarm.alarmName);
        return [{ ...alarm, isActive: true, triggeredAt: alarm.triggeredAt || new Date() }, ...filtered];
      });

      // Play alarm.mp3 sound
      const alarmSoundOk = alarm.soundEnabled !== false;
      if (alarmSoundOk) playAlarmSound(alarm.priority || 'MEDIUM');

      // Desktop notification
      showBrowserNotification(alarm);

      // Global floating toast across all pages
      const toastType =
        alarm.priority === 'CRITICAL' ? 'error' :
        alarm.priority === 'HIGH'     ? 'warning' :
        alarm.priority === 'MEDIUM'   ? 'warning' : 'info';

      showToast(
        `🚨 ${alarm.priority || 'ALARM'}: ${alarm.alarmName}${alarm.message ? ` — ${alarm.message}` : ''}`,
        toastType,
        alarm.priority === 'CRITICAL' ? 8000 : 5000
      );
    };

    const handleAlarmCleared = (alarm) => {
      if (!alarm || !alarm.alarmName) return;
      recentAlarmsRef.current.delete(alarm.alarmName);

      setActiveAlarms((prev) => prev.filter((a) => a._id !== alarm._id && a.alarmName !== alarm.alarmName));

      showToast(`✅ Cleared: ${alarm.alarmName}`, 'success', 3000);
    };

    const handleAlarmAcked = (alarm) => {
      if (!alarm || !alarm._id) return;
      setActiveAlarms((prev) =>
        prev.map((a) => (a._id === alarm._id ? { ...a, isAcknowledged: true } : a))
      );
    };

    socketService.on('alarmTriggered', handleAlarmTriggered);
    socketService.on('alarm:triggered', handleAlarmTriggered);
    socketService.on('alarmCleared', handleAlarmCleared);
    socketService.on('alarm:cleared', handleAlarmCleared);
    socketService.on('alarmAcknowledged', handleAlarmAcked);
    socketService.on('alarm:acknowledged', handleAlarmAcked);

    return () => {
      socketService.off('alarmTriggered', handleAlarmTriggered);
      socketService.off('alarm:triggered', handleAlarmTriggered);
      socketService.off('alarmCleared', handleAlarmCleared);
      socketService.off('alarm:cleared', handleAlarmCleared);
      socketService.off('alarmAcknowledged', handleAlarmAcked);
      socketService.off('alarm:acknowledged', handleAlarmAcked);
    };
  }, [playAlarmSound, showBrowserNotification, showToast]);

  const value = {
    soundEnabled,
    setSoundEnabled,
    soundVolume,
    setSoundVolume,
    testSound,
    playAlarmSound,
    activeAlarms,
    unreadCount: activeAlarms.filter((a) => !a.isAcknowledged).length,
    fetchActiveAlarms,
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
      activeAlarms: [],
      unreadCount: 0,
      fetchActiveAlarms: () => {},
    };
  }
  return ctx;
};

export default AlarmNotificationContext;