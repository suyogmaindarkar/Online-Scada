// ═══════════════════════════════════════════════════════════
// Runtime — FIXED
//   ✅ #1 Popups are draggable by their title bar
//   ✅ #2 Template elements NOT merged into startup screen
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

import RuntimeCanvas from '../components/runtime/RuntimeCanvas';
import {
  screenAPI, tagAPI,
  mergeTemplateElements, getTemplateScreen,
  getRegularScreens, getPopupScreens,
} from '../services/api';
import socketService from '../services/socket';
import { Monitor, Loader2, Play, X, Move } from 'lucide-react';
import {
  executeOnLoadConnections,
  executeOnChangeConnections,
} from '../utils/directConnectionUtils';
import { useNavigate } from 'react-router-dom';

const Runtime = () => {
  const navigate = useNavigate();
  const { userData, logoutUser } = useAuth();

  const [screens,             setScreens]             = useState([]);
  const [currentScreen,       setCurrentScreen]       = useState(null);
  const [liveValues,          setLiveValues]          = useState({});
  const [loading,             setLoading]             = useState(true);
  const [connected,           setConnected]           = useState(false);
  const [tags,                setTags]                = useState([]);
  const [showStartupSelector, setShowStartupSelector] = useState(false);
  const [selectedStartupId,   setSelectedStartupId]   = useState('');

  const [openPopups, setOpenPopups] = useState([]);

  const [viewportSize, setViewportSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  const updateCountRef    = useRef(0);
  const prevLiveValuesRef = useRef({});
  const onLoadFiredRef    = useRef(new Set());
  const runtimeDivRef     = useRef(null);

  useEffect(() => {
    const handleResize = () =>
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
    };
  }, []);

  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        const el = document.documentElement;
        if (el.requestFullscreen)            await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      } catch (err) {
        console.warn('[Runtime] Could not enter fullscreen:', err.message);
      }
    };
    enterFullscreen();
    return () => {
      if (document.fullscreenElement)
        document.exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        const doExit = async () => {
          if (document.fullscreenElement) {
            try { await document.exitFullscreen(); } catch {}
          }

          // ✅ MULTI-TENANT: Behavior based on role
          // Operators/Viewers → back to UserSelection (keep workspace)
          // Admin/Engineer → back to Designer
          const userRole = userData?.role;
          if (userRole === 'operator' || userRole === 'viewer') {
            await logoutUser();          // clear user token, keep workspace
            navigate('/select-user');
          } else {
            navigate('/designer');
          }
        };
        doExit();
      }
      if (e.key === 'Escape') {
        setOpenPopups(prev => {
          if (prev.length === 0) return prev;
          const topmost = prev[prev.length - 1];
          if (topmost.popupCloseable !== false) return prev.slice(0, -1);
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

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

  useEffect(() => {
    tagAPI.getAll()
      .then(res => setTags(res.data?.data || []))
      .catch(() => setTags([]));
  }, []);

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
        updates.forEach(u => {
          if (u && u.tagName !== undefined) updated[u.tagName] = u.value;
        });
        return updated;
      });
    };
    const handleInitialTags = (initial) => {
      if (!Array.isArray(initial)) return;
      const values = {};
      initial.forEach(t => {
        if (t && t.tagName !== undefined) values[t.tagName] = t.value;
      });
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

  const goToScreenByName = useCallback((screenName) => {
    setScreens(prevScreens => {
      const target = prevScreens.find(s =>
        s.screenName.toLowerCase() === screenName.toLowerCase() &&
        !s.isPopup && !s.isTemplate
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

  const openPopupByName = useCallback((popupName) => {
    setScreens(prevScreens => {
      const popup = prevScreens.find(s =>
        s.screenName.toLowerCase() === popupName.toLowerCase() &&
        s.isPopup === true
      );
      if (popup) {
        setOpenPopups(prev => {
          if (prev.some(p => p._id === popup._id)) return prev;
          return [...prev, popup];
        });
      } else {
        console.warn(`[Runtime] Popup not found: "${popupName}"`);
      }
      return prevScreens;
    });
  }, []);

  const closeTopPopup = useCallback(() => {
    setOpenPopups(prev => prev.slice(0, -1));
  }, []);

  const closePopupById = useCallback((id) => {
    setOpenPopups(prev => prev.filter(p => p._id !== id));
  }, []);

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
    if (
      !onLoadFiredRef.current.has(screenId) &&
      Object.keys(liveValues).length > 0
    ) {
      onLoadFiredRef.current.add(screenId);
      executeOnLoadConnections(connections, liveValues);
    }
    if (changedTags.size > 0)
      executeOnChangeConnections(connections, liveValues, changedTags);
    prevLiveValuesRef.current = { ...liveValues };
  }, [liveValues, currentScreen]);

  const getCanvasScale = () => {
    if (!currentScreen) return 1;
    const cw = currentScreen.width  || 1920;
    const ch = currentScreen.height || 1080;
    return Math.min(viewportSize.w / cw, viewportSize.h / ch);
  };

  const templateScreen = useMemo(() => getTemplateScreen(screens), [screens]);

  // ✅ #2 FIX: Template elements are NOT applied to:
  //   - popups, templates themselves, AND the startup screen.
  const mergedElements = useMemo(() => {
    if (!currentScreen) return [];
    if (
      currentScreen.isPopup ||
      currentScreen.isTemplate ||
      currentScreen.isStartupScreen   // ← startup screen excluded from template
    ) {
      return currentScreen.elements || [];
    }
    return mergeTemplateElements(currentScreen.elements || [], templateScreen);
  }, [currentScreen, templateScreen]);

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0F172A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999,
      }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{
            width: 48, height: 48, color: '#3B82F6',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px',
          }} />
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Loading runtime…</p>
        </div>
      </div>
    );
  }

  const regularScreens = getRegularScreens(screens);
  if (regularScreens.length === 0) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0F172A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999,
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '24px' }}>
          <div style={{
            display: 'inline-flex', padding: '20px',
            background: '#1E293B', borderRadius: '50%', marginBottom: '16px',
          }}>
            <Monitor style={{ width: 48, height: 48, color: '#475569' }} />
          </div>
          <h2 style={{
            color: '#FFF', fontSize: '22px', fontWeight: 700, marginBottom: '8px',
          }}>
            No Screens Available
          </h2>
          <p style={{ color: '#94A3B8', marginBottom: '24px', fontSize: '14px' }}>
            Create a screen in the Graphic Designer first.
          </p>
          <button
            onClick={() => {
              if (document.fullscreenElement)
                document.exitFullscreen().catch(() => {});
              navigate('/designer');
            }}
            style={{
              padding: '10px 24px', background: '#2563EB', color: '#FFF',
              borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '14px', fontWeight: 600,
            }}
          >
            Go to Designer
          </button>
        </div>
      </div>
    );
  }

  const scale = getCanvasScale();
  const cw    = currentScreen?.width  || 1920;
  const ch    = currentScreen?.height || 1080;

  return (
    <div
      ref={runtimeDivRef}
      style={{
        position: 'fixed', inset: 0, background: '#000000',
        overflow: 'hidden', zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {currentScreen && (
        <div style={{
          width: cw, height: ch,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
        }}>
          <RuntimeCanvas
            elements={mergedElements}
            width={cw}
            height={ch}
            backgroundColor={currentScreen.backgroundColor || '#ffffff'}
            liveValues={liveValues}
            tags={tags}
            screens={screens}
            onChangeScreen={goToScreenByName}
            onOpenPopup={openPopupByName}
            onClosePopup={closeTopPopup}
            noWrapper={true}
          />
        </div>
      )}

      {openPopups.map((popup, idx) => (
        <PopupOverlay
          key={popup._id}
          popup={popup}
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
// POPUP OVERLAY — ✅ #1 Draggable by title bar
// ═══════════════════════════════════════════════════════════
const PopupOverlay = ({
  popup,
  liveValues,
  tags,
  screens,
  zIndex,
  onClose,
  onChangeScreen,
  onOpenPopup,
  onClosePopup,
  viewportSize,
}) => {
  const isModal     = popup.popupModal !== false;
  const isCloseable = popup.popupCloseable !== false;
  const closeOnBg   = popup.popupCloseOnBackdrop !== false;

  const canvasW = popup.width  || 400;
  const canvasH = popup.height || 300;

  const TITLEBAR_H = 32;
  const BORDER_W   = 2;

  const totalW = canvasW + BORDER_W * 2;
  const totalH = canvasH + TITLEBAR_H + BORDER_W * 2;

  const availW = viewportSize.w - 80;
  const availH = viewportSize.h - 80;
  const scale  = Math.min(1, availW / totalW, availH / totalH);

  // Scaled outer dimensions (actual screen footprint)
  const scaledW = totalW * scale;
  const scaledH = totalH * scale;

  // ✅ Drag state — position is TOP-LEFT in screen px
  const [pos, setPos] = useState(() => ({
    x: (viewportSize.w - scaledW) / 2,
    y: (viewportSize.h - scaledH) / 2,
  }));

  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  // Re-center if viewport changes AND popup hasn't been manually moved
  const movedRef = useRef(false);
  useEffect(() => {
    if (movedRef.current) return;
    setPos({
      x: (viewportSize.w - scaledW) / 2,
      y: (viewportSize.h - scaledH) / 2,
    });
  }, [viewportSize.w, viewportSize.h, scaledW, scaledH]);

  const handleDragStart = (e) => {
    // Only left mouse button
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    movedRef.current = true;
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
  };

  const handleDragMove = (e) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    let nx = dragRef.current.origX + dx;
    let ny = dragRef.current.origY + dy;

    // Keep within viewport bounds (allow small overhang)
    const minX = -scaledW + 80;
    const minY = 0;
    const maxX = viewportSize.w - 80;
    const maxY = viewportSize.h - TITLEBAR_H * scale;
    nx = Math.max(minX, Math.min(maxX, nx));
    ny = Math.max(minY, Math.min(maxY, ny));

    setPos({ x: nx, y: ny });
  };

  const handleDragEnd = () => {
    dragRef.current.dragging = false;
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, []);

  return (
    <>
      {isModal && closeOnBg && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'transparent',
            zIndex: zIndex,
            cursor: 'pointer',
          }}
        />
      )}

      {/* Popup window — positioned via left/top, scaled from top-left */}
      <div
        style={{
          position: 'fixed',
          left: `${pos.x}px`,
          top:  `${pos.y}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width:  `${totalW}px`,
          height: `${totalH}px`,
          zIndex: zIndex + 1,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0px 16px 48px rgba(0,0,0,0.5), 0px 0px 0px 1px rgba(0,0,0,0.1)',
          border: `${BORDER_W}px solid rgba(37,99,235,0.7)`,
          background: popup.backgroundColor || '#FFFFFF',
        }}
      >
        {/* Title bar — DRAG HANDLE */}
        <div
          onMouseDown={handleDragStart}
          style={{
            height: `${TITLEBAR_H}px`,
            flexShrink: 0,
            background: 'linear-gradient(135deg, #0F3D91 0%, #081B43 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px 0 12px',
            fontSize: '12px',
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            gap: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            userSelect: 'none',
            cursor: 'move',
          }}
        >
          <span style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1,
          }}>
            <Move size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
            <span style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {popup.screenName}
            </span>
            <span style={{
              fontSize: '9px', fontWeight: 400, opacity: 0.55,
              fontFamily: 'monospace', flexShrink: 0,
            }}>
              {canvasW}×{canvasH}
            </span>
          </span>

          {isCloseable && (
            <button
              onClick={onClose}
              onMouseDown={(e) => e.stopPropagation()} // don't start drag on X
              title="Close (Esc)"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                cursor: 'pointer',
                padding: '4px 5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                flexShrink: 0,
                lineHeight: 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(220,38,38,0.85)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Canvas area — exact designed dimensions */}
        <div
          style={{
            width:    `${canvasW}px`,
            height:   `${canvasH}px`,
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
            background: popup.backgroundColor || '#FFFFFF',
          }}
        >
          <RuntimeCanvas
            elements={popup.elements || []}
            width={canvasW}
            height={canvasH}
            backgroundColor={popup.backgroundColor || '#FFFFFF'}
            liveValues={liveValues}
            tags={tags}
            screens={screens}
            onChangeScreen={onChangeScreen}
            onOpenPopup={onOpenPopup}
            onClosePopup={onClosePopup}
            noWrapperWidth={canvasW}
            noWrapperHeight={canvasH}
            noWrapper={true}
          />
        </div>
      </div>
    </>
  );
};

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

const StartupSelector = ({ screens, selectedId, onSelect, onConfirm }) => (
  <>
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100001,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
    }} />
    <div style={{
      position: 'fixed', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
      zIndex: 100002, background: '#FFFFFF', borderRadius: '16px',
      padding: '28px', width: '400px',
      boxShadow: '0px 32px 100px rgba(0,0,0,0.6)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px',
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: '#EEF6FF', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Monitor size={24} style={{ color: '#2563EB' }} />
        </div>
        <div>
          <p style={{
            fontSize: '17px', fontWeight: 700, color: '#081B43',
            margin: 0, fontFamily: "'Montserrat', sans-serif",
          }}>
            Select Start Screen
          </p>
          <p style={{ fontSize: '12px', color: '#5F6B7A', margin: '3px 0 0' }}>
            No startup screen defined. Choose which screen to open.
          </p>
        </div>
      </div>

      <div style={{
        maxHeight: '280px', overflowY: 'auto',
        marginBottom: '16px',
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}>
        {screens.map((s) => {
          const isSelected = selectedId === s._id;
          return (
            <button
              key={s._id}
              onClick={() => onSelect(s._id)}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: '8px',
                textAlign: 'left',
                border: `2px solid ${isSelected ? '#2563EB' : '#E5E7EB'}`,
                background: isSelected ? '#EEF6FF' : '#F8FAFC',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}
            >
              <div style={{
                width: '12px', height: '12px', borderRadius: '50%',
                border: `2px solid ${isSelected ? '#2563EB' : '#CBD5E1'}`,
                background: isSelected ? '#2563EB' : 'transparent',
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '13px',
                  fontWeight: isSelected ? 700 : 500,
                  color: '#081B43', margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {s.screenName}
                </p>
                <p style={{ fontSize: '11px', color: '#5F6B7A', margin: '2px 0 0' }}>
                  {s.elements?.length || 0} elements · {s.width || 1920}×{s.height || 1080}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{
        fontSize: '11px', color: '#5F6B7A', marginBottom: '16px',
        padding: '8px 10px', background: '#FEF9C3',
        borderRadius: '6px', border: '1px solid #FDE68A', lineHeight: '1.5',
      }}>
        💡 To avoid this popup: right-click a screen in the designer →{' '}
        <strong>"Set as Startup Screen"</strong>
      </div>

      <button
        onClick={onConfirm}
        style={{
          width: '100%', padding: '13px', borderRadius: '8px', border: 'none',
          background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
          color: '#FFFFFF', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        <Play size={16} /> Start Runtime
      </button>
    </div>
  </>
);

export default Runtime;