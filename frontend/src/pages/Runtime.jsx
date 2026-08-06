// ═══════════════════════════════════════════════════════════
// Runtime — UPDATED with Template merge + Popup overlays
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import RuntimeCanvas from '../components/runtime/RuntimeCanvas';
import { screenAPI, tagAPI, mergeTemplateElements, getTemplateScreen, getRegularScreens, getPopupScreens } from '../services/api';
import socketService from '../services/socket';
import { Monitor, Loader2, Play, X } from 'lucide-react';
import {
  executeOnLoadConnections,
  executeOnChangeConnections,
} from '../utils/directConnectionUtils';
import { useNavigate } from 'react-router-dom';

const Runtime = () => {
  const navigate = useNavigate();

  const [screens,             setScreens]             = useState([]);
  const [currentScreen,       setCurrentScreen]       = useState(null);
  const [liveValues,          setLiveValues]          = useState({});
  const [loading,             setLoading]             = useState(true);
  const [connected,           setConnected]           = useState(false);
  const [tags,                setTags]                = useState([]);
  const [showStartupSelector, setShowStartupSelector] = useState(false);
  const [selectedStartupId,   setSelectedStartupId]   = useState('');

  // ✅ Popup stack — array of popup screen objects currently open
  const [openPopups, setOpenPopups] = useState([]);

  const [viewportSize, setViewportSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  const updateCountRef    = useRef(0);
  const prevLiveValuesRef = useRef({});
  const onLoadFiredRef    = useRef(new Set());
  const runtimeDivRef     = useRef(null);

  // ── Viewport resize ──────────────────────────────────────
  useEffect(() => {
    const handleResize = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
    };
  }, []);

  // ── Auto-fullscreen ──────────────────────────────────────
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      } catch (err) {
        console.warn('[Runtime] Could not enter fullscreen:', err.message);
      }
    };
    enterFullscreen();
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  // ── Ctrl+Q exit ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        const doExit = async () => {
          if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch {} }
          navigate('/designer');
        };
        doExit();
      }
      // ✅ ESC closes topmost popup
      if (e.key === 'Escape') {
        setOpenPopups(prev => {
          if (prev.length === 0) return prev;
          const topmost = prev[prev.length - 1];
          if (topmost.popupCloseable !== false) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // ── Load screens ──────────────────────────────────────────
  const loadScreens = async () => {
    try {
      setLoading(true);
      const res = await screenAPI.getAll();
      const allScreens = res?.data?.data || [];
      setScreens(allScreens);

      const regularScreens = getRegularScreens(allScreens);
      if (regularScreens.length > 0) {
        const startup = regularScreens.find(s => s.isStartupScreen === true);
        if (startup) {
          setCurrentScreen(startup);
        } else {
          setShowStartupSelector(true);
          setSelectedStartupId(regularScreens[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to load screens:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartupConfirm = () => {
    const selected = screens.find(s => s._id === selectedStartupId);
    if (selected) setCurrentScreen(selected);
    setShowStartupSelector(false);
  };

  // ── Tags ──────────────────────────────────────────────────
  useEffect(() => {
    tagAPI.getAll()
      .then(res => setTags(res.data?.data || []))
      .catch(() => setTags([]));
  }, []);

  // ── Socket setup ──────────────────────────────────────────
  useEffect(() => {
    loadScreens();
    socketService.connect();
    if (socketService.isConnected()) setConnected(true);

    const handleConnect    = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleTagsUpdate = (updates) => {
      if (!Array.isArray(updates) || updates.length === 0) return;
      updateCountRef.current += 1;
      setLiveValues(prev => {
        const updated = { ...prev };
        updates.forEach(u => { if (u && u.tagName !== undefined) updated[u.tagName] = u.value; });
        return updated;
      });
    };
    const handleInitialTags = (initial) => {
      if (!Array.isArray(initial)) return;
      const values = {};
      initial.forEach(t => { if (t && t.tagName !== undefined) values[t.tagName] = t.value; });
      setLiveValues(values);
    };

    socketService.on('connect',     handleConnect);
    socketService.on('disconnect',  handleDisconnect);
    socketService.on('tagsUpdate',  handleTagsUpdate);
    socketService.on('initialTags', handleInitialTags);

    return () => {
      socketService.off('connect',     handleConnect);
      socketService.off('disconnect',  handleDisconnect);
      socketService.off('tagsUpdate',  handleTagsUpdate);
      socketService.off('initialTags', handleInitialTags);
    };
  }, []);

  // ── Navigation callbacks ──────────────────────────────────
  const goToScreenByName = useCallback((screenName) => {
    setScreens(prevScreens => {
      const target = prevScreens.find(s =>
        s.screenName.toLowerCase() === screenName.toLowerCase() && !s.isPopup && !s.isTemplate
      );
      if (target) {
        setCurrentScreen(target);
        onLoadFiredRef.current.delete(target._id);
      } else {
        console.warn(`[Runtime] Screen not found: "${screenName}"`);
      }
      return prevScreens;
    });
  }, []);

  // ✅ Open popup — push onto stack
  const openPopupByName = useCallback((popupName) => {
    setScreens(prevScreens => {
      const popup = prevScreens.find(s =>
        s.screenName.toLowerCase() === popupName.toLowerCase() && s.isPopup === true
      );
      if (popup) {
        setOpenPopups(prev => {
          // Avoid duplicate popups
          if (prev.some(p => p._id === popup._id)) return prev;
          return [...prev, popup];
        });
      } else {
        console.warn(`[Runtime] Popup not found: "${popupName}"`);
      }
      return prevScreens;
    });
  }, []);

  // ✅ Close topmost popup
  const closeTopPopup = useCallback(() => {
    setOpenPopups(prev => prev.slice(0, -1));
  }, []);

  // ✅ Close specific popup by ID
  const closePopupById = useCallback((id) => {
    setOpenPopups(prev => prev.filter(p => p._id !== id));
  }, []);

  // ── Direct connections ────────────────────────────────────
  useEffect(() => {
    if (!currentScreen) return;
    const connections = currentScreen.directConnections || [];
    if (connections.length === 0) return;

    const prevValues = prevLiveValuesRef.current;
    const changedTags = new Set();
    for (const [tagName, value] of Object.entries(liveValues)) {
      if (prevValues[tagName] !== value) changedTags.add(tagName);
    }

    const screenId = currentScreen._id;
    if (!onLoadFiredRef.current.has(screenId) && Object.keys(liveValues).length > 0) {
      onLoadFiredRef.current.add(screenId);
      executeOnLoadConnections(connections, liveValues);
    }
    if (changedTags.size > 0) executeOnChangeConnections(connections, liveValues, changedTags);
    prevLiveValuesRef.current = { ...liveValues };
  }, [liveValues, currentScreen]);

  // ── Canvas scale ─────────────────────────────────────────
  const getCanvasScale = () => {
    if (!currentScreen) return 1;
    const cw = currentScreen.width  || 1920;
    const ch = currentScreen.height || 1080;
    return Math.min(viewportSize.w / cw, viewportSize.h / ch);
  };

  // ✅ Merge template elements INTO current screen
  const templateScreen = useMemo(() => getTemplateScreen(screens), [screens]);
  const mergedElements = useMemo(() => {
    if (!currentScreen) return [];
    return mergeTemplateElements(currentScreen.elements || [], templateScreen);
  }, [currentScreen, templateScreen]);

  // ── Loading / Empty states ───────────────────────────────
  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: 48, height: 48, color: '#3B82F6', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Loading runtime…</p>
        </div>
      </div>
    );
  }

  const regularScreens = getRegularScreens(screens);
  if (regularScreens.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '24px' }}>
          <div style={{ display: 'inline-flex', padding: '20px', background: '#1E293B', borderRadius: '50%', marginBottom: '16px' }}>
            <Monitor style={{ width: 48, height: 48, color: '#475569' }} />
          </div>
          <h2 style={{ color: '#FFF', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>No Screens Available</h2>
          <p style={{ color: '#94A3B8', marginBottom: '24px', fontSize: '14px' }}>Create a screen in the Graphic Designer first.</p>
          <button onClick={() => { if (document.fullscreenElement) document.exitFullscreen().catch(()=>{}); navigate('/designer'); }}
            style={{ padding: '10px 24px', background: '#2563EB', color: '#FFF', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
            Go to Designer
          </button>
        </div>
      </div>
    );
  }

  const scale = getCanvasScale();
  const cw = currentScreen?.width  || 1920;
  const ch = currentScreen?.height || 1080;

  return (
    <div ref={runtimeDivRef}
      style={{
        position: 'fixed', inset: 0, background: '#000000',
        overflow: 'hidden', zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      {/* Main screen with template merged in */}
      {currentScreen && (
        <div style={{
          width: cw, height: ch,
          transform: `scale(${scale})`, transformOrigin: 'center center',
          flexShrink: 0,
        }}>
          <RuntimeCanvas
            elements={mergedElements}
            width={cw} height={ch}
            backgroundColor={currentScreen.backgroundColor || '#ffffff'}
            liveValues={liveValues}
            tags={tags}
            screens={screens}
            onChangeScreen={goToScreenByName}
            onOpenPopup={openPopupByName}
            onClosePopup={closeTopPopup}
          />
        </div>
      )}

      {/* ✅ Popup overlays — stacked */}
      {openPopups.map((popup, idx) => (
        <PopupOverlay
          key={popup._id}
          popup={popup}
          templateScreen={templateScreen}
          liveValues={liveValues}
          tags={tags}
          screens={screens}
          zIndex={100000 + idx * 10}
          onClose={() => closePopupById(popup._id)}
          onChangeScreen={goToScreenByName}
          onOpenPopup={openPopupByName}
          onClosePopup={closeTopPopup}
          viewportSize={viewportSize}
        />
      ))}

      <CtrlQHint />

      {showStartupSelector && (
        <StartupSelector
          screens={regularScreens}
          selectedId={selectedStartupId}
          onSelect={setSelectedStartupId}
          onConfirm={handleStartupConfirm}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// POPUP OVERLAY COMPONENT
// ═══════════════════════════════════════════════════════════
const PopupOverlay = ({
  popup, templateScreen, liveValues, tags, screens, zIndex,
  onClose, onChangeScreen, onOpenPopup, onClosePopup, viewportSize,
}) => {
  const isModal      = popup.popupModal !== false;
  const isCloseable  = popup.popupCloseable !== false;
  const closeOnBg    = popup.popupCloseOnBackdrop !== false;

  const pw = popup.width  || 800;
  const ph = popup.height || 600;

  // Scale popup to fit viewport (leave 40px margin)
  const scaleX = (viewportSize.w - 40) / pw;
  const scaleY = (viewportSize.h - 40) / ph;
  const scale = Math.min(1, scaleX, scaleY); // never scale UP

  // ✅ Popups also inherit template elements
  const mergedElements = mergeTemplateElements(popup.elements || [], templateScreen);

  return (
    <>
      {/* Backdrop */}
      {isModal && (
        <div
          onClick={closeOnBg ? onClose : undefined}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: zIndex,
            cursor: closeOnBg ? 'pointer' : 'default',
          }}
        />
      )}

      {/* Popup window */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
          width: pw, height: ph,
          background: popup.backgroundColor || '#FFFFFF',
          borderRadius: '8px',
          boxShadow: '0px 25px 80px rgba(0,0,0,0.6)',
          zIndex: zIndex + 1,
          overflow: 'hidden',
          border: '2px solid rgba(245,158,11,0.5)',
        }}
      >
        {/* Popup title bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '28px',
          background: 'rgba(8,27,67,0.95)',
          color: '#FFF',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px',
          zIndex: 5,
          fontSize: '11px', fontFamily: "'Montserrat',sans-serif",
        }}>
          <span style={{ fontWeight: 700 }}>
            🪟 {popup.screenName}
          </span>
          {isCloseable && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none',
                color: '#FFF', cursor: 'pointer',
                padding: '2px', display: 'flex', alignItems: 'center',
                borderRadius: '4px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.7)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              title="Close popup (Esc)"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Popup canvas area */}
        <div style={{ position: 'absolute', top: '28px', left: 0, right: 0, bottom: 0 }}>
          <RuntimeCanvas
            elements={mergedElements}
            width={pw}
            height={ph - 28}
            backgroundColor={popup.backgroundColor || '#FFFFFF'}
            liveValues={liveValues}
            tags={tags}
            screens={screens}
            onChangeScreen={onChangeScreen}
            onOpenPopup={onOpenPopup}
            onClosePopup={onClosePopup}
          />
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// CTRL+Q HINT
// ═══════════════════════════════════════════════════════════
const CtrlQHint = () => {
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(1);
  useEffect(() => {
    const fadeTimer = setTimeout(() => setOpacity(0), 3000);
    const hideTimer = setTimeout(() => setVisible(false), 5000);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);
  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute', bottom: '16px', right: '16px',
      padding: '6px 12px', background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(8px)', borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.5)', fontSize: '11px',
      fontFamily: 'monospace', pointerEvents: 'none',
      transition: 'opacity 2s ease', opacity, zIndex: 999999,
    }}>
      Press <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Ctrl+Q</strong> to exit runtime
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// STARTUP SELECTOR
// ═══════════════════════════════════════════════════════════
const StartupSelector = ({ screens, selectedId, onSelect, onConfirm }) => (
  <>
    <div style={{ position: 'fixed', inset: 0, zIndex: 100001, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }} />
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      zIndex: 100002, background: '#FFFFFF', borderRadius: '16px',
      padding: '28px', width: '400px', boxShadow: '0px 32px 100px rgba(0,0,0,0.6)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#EEF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Monitor size={24} style={{ color: '#2563EB' }} />
        </div>
        <div>
          <p style={{ fontSize: '17px', fontWeight: 700, color: '#081B43', margin: 0, fontFamily: "'Montserrat',sans-serif" }}>Select Start Screen</p>
          <p style={{ fontSize: '12px', color: '#5F6B7A', margin: '3px 0 0' }}>No startup screen defined. Choose which screen to open.</p>
        </div>
      </div>
      <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {screens.map((s) => {
          const isSelected = selectedId === s._id;
          return (
            <button key={s._id} onClick={() => onSelect(s._id)}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: '8px', textAlign: 'left',
                border: `2px solid ${isSelected ? '#2563EB' : '#E5E7EB'}`,
                background: isSelected ? '#EEF6FF' : '#F8FAFC',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
              }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: `2px solid ${isSelected ? '#2563EB' : '#CBD5E1'}`, background: isSelected ? '#2563EB' : 'transparent', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: isSelected ? 700 : 500, color: '#081B43', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.screenName}</p>
                <p style={{ fontSize: '11px', color: '#5F6B7A', margin: '2px 0 0' }}>{s.elements?.length || 0} elements · {s.width || 1920}×{s.height || 1080}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: '11px', color: '#5F6B7A', marginBottom: '16px', padding: '8px 10px', background: '#FEF9C3', borderRadius: '6px', border: '1px solid #FDE68A', lineHeight: '1.5' }}>
        💡 To avoid this popup: right-click a screen in the designer → <strong>"Set as Startup Screen"</strong>
      </div>
      <button onClick={onConfirm}
        style={{
          width: '100%', padding: '13px', borderRadius: '8px', border: 'none',
          background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
          color: '#FFFFFF', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          fontFamily: "'Montserrat',sans-serif",
        }}>
        <Play size={16} /> Start Runtime
      </button>
    </div>
  </>
);

export default Runtime;