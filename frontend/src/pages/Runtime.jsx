import { useState, useEffect, useRef } from 'react';
import RuntimeCanvas from '../components/runtime/RuntimeCanvas';
import { screenAPI, tagAPI } from '../services/api';
import socketService from '../services/socket';
import {
  Monitor, ChevronLeft, ChevronRight, Maximize2, Minimize2,
  Wifi, WifiOff, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';
import {
  executeOnLoadConnections,
  executeOnChangeConnections,
} from '../utils/directConnectionUtils';



const Runtime = () => {
  const [screens, setScreens] = useState([]);
  const [currentScreen, setCurrentScreen] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liveValues, setLiveValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
const [tags, setTags] = useState([]);
  // Track update count for debug (bonus)
  const updateCountRef = useRef(0);
const prevLiveValuesRef = useRef({});
const onLoadFiredRef = useRef(new Set()); // Track which screens already fired onLoad

  // ────────────────────────────────────────────────────────────
  // Load screens
  // ────────────────────────────────────────────────────────────
  const loadScreens = async () => {
    try {
      setLoading(true);
      const res = await screenAPI.getAll();
      const allScreens = res?.data?.data || [];
      setScreens(allScreens);

      if (allScreens.length > 0) {
        const startup = allScreens.find((s) => s.isStartupScreen);
        const initial = startup || allScreens[0];
        setCurrentScreen(initial);
        setCurrentIndex(allScreens.findIndex((s) => s._id === initial._id));
      }
    } catch (err) {
      console.error('Failed to load screens:', err);
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────
  // Socket setup — PROPER handler references
  // ────────────────────────────────────────────────────────────
  
  // Add this at the top of your existing useEffect (before loadScreens)
useEffect(() => {
  tagAPI.getAll()
    .then(res => setTags(res.data?.data || []))
    .catch(() => setTags([]));
}, []);
  
  
  useEffect(() => {
    loadScreens();

    // Connect socket
    socketService.connect();

    // ✅ Check immediately if already connected (React StrictMode safe)
    if (socketService.isConnected()) {
      setConnected(true);
    }

    // ✅ NAMED handlers so we can properly remove them
    const handleConnect = () => {
      console.log('🟢 Runtime: socket connected');
      setConnected(true);
    };

    const handleDisconnect = () => {
      console.log('🔴 Runtime: socket disconnected');
      setConnected(false);
    };

    const handleTagsUpdate = (updates) => {
      if (!Array.isArray(updates) || updates.length === 0) return;

      updateCountRef.current += 1;

      setLiveValues((prev) => {
        const updated = { ...prev };
        updates.forEach((u) => {
          if (u && u.tagName !== undefined) {
            updated[u.tagName] = u.value;
          }
        });
        return updated;
      });
      setLastUpdate(new Date());
    };

    const handleInitialTags = (initial) => {
      if (!Array.isArray(initial)) return;

      const values = {};
      initial.forEach((t) => {
        if (t && t.tagName !== undefined) {
          values[t.tagName] = t.value;
        }
      });
      setLiveValues(values);
      setLastUpdate(new Date());
    };

    // Register handlers
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('tagsUpdate', handleTagsUpdate);
    socketService.on('initialTags', handleInitialTags);

    // Fullscreen listener
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // ✅ Cleanup: remove ONLY these specific handlers, not all
    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('tagsUpdate', handleTagsUpdate);
      socketService.off('initialTags', handleInitialTags);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []); // ← empty deps: run once (StrictMode-safe now)

  // ────────────────────────────────────────────────────────────
  // Screen navigation
  // ────────────────────────────────────────────────────────────
 const goToScreen = (index) => {
  if (index >= 0 && index < screens.length) {
    setCurrentIndex(index);
    setCurrentScreen(screens[index]);
    // Sprint D2: Reset onLoad tracker so new screen fires its onLoad connections
    onLoadFiredRef.current.delete(screens[index]._id);
  }
};

  const nextScreen = () => goToScreen(currentIndex + 1);
  const prevScreen = () => goToScreen(currentIndex - 1);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // ────────────────────────────────────────────────────────────
  // Sprint D2: Execute Direct Connections
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentScreen) return;
    const connections = currentScreen.directConnections || [];
    if (connections.length === 0) return;

    // Determine changed tags
    const prevValues = prevLiveValuesRef.current;
    const changedTags = new Set();
    for (const [tagName, value] of Object.entries(liveValues)) {
      if (prevValues[tagName] !== value) {
        changedTags.add(tagName);
      }
    }

    // Fire onLoad ONCE per screen (when it becomes active and has values)
    const screenId = currentScreen._id;
    if (!onLoadFiredRef.current.has(screenId) && Object.keys(liveValues).length > 0) {
      onLoadFiredRef.current.add(screenId);
      executeOnLoadConnections(connections, liveValues).then((results) => {
        if (results.length > 0) {
          console.log(`🚀 Fired ${results.length} onLoad connections for "${currentScreen.screenName}"`);
        }
      });
    }

    // Fire onChange for tags that changed
    if (changedTags.size > 0) {
      executeOnChangeConnections(connections, liveValues, changedTags);
    }

    prevLiveValuesRef.current = { ...liveValues };
  }, [liveValues, currentScreen]);

  


  // ────────────────────────────────────────────────────────────
  // Loading state
  // ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-400">Loading screens...</p>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // Empty state
  // ────────────────────────────────────────────────────────────
  if (screens.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="inline-flex p-4 bg-slate-800 rounded-full mb-4">
            <Monitor className="w-12 h-12 text-slate-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">No Screens Available</h2>
          <p className="text-slate-400 mb-6">
            Create a screen in the Graphic Designer first.
          </p>
          <a
            href="/designer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Go to Designer
          </a>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // Main render
  // ────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      {/* Top Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-t-xl p-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-bold text-white">Runtime</h1>
          </div>

          {/* Screen Selector */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={prevScreen}
              disabled={currentIndex === 0}
              className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded"
              title="Previous screen"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={currentScreen?._id || ''}
              onChange={(e) => {
                const idx = screens.findIndex((s) => s._id === e.target.value);
                goToScreen(idx);
              }}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm min-w-[200px]"
            >
              {screens.map((s, idx) => (
                <option key={s._id} value={s._id}>
                  {idx + 1}. {s.screenName}
                </option>
              ))}
            </select>

            <button
              onClick={nextScreen}
              disabled={currentIndex === screens.length - 1}
              className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded"
              title="Next screen"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="text-xs text-slate-500 ml-2">
              {currentIndex + 1} / {screens.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Last Update */}
          {lastUpdate && (
            <div className="text-xs text-slate-500">
              Last update: {lastUpdate.toLocaleTimeString()}
            </div>
          )}

          {/* Connection Status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
              connected
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}
          >
            {connected ? (
              <>
                <Wifi className="w-4 h-4 text-green-400" />
                <span className="text-xs font-medium text-green-400">LIVE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-400" />
                <span className="text-xs font-medium text-red-400">OFFLINE</span>
              </>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={loadScreens}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
            title="Refresh screens"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4" />
                Exit Fullscreen
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                Fullscreen
              </>
            )}
          </button>
        </div>
      </div>

      {/* Runtime Display */}
      <div className="flex-1 bg-creamDark border-x border-b border-gold/20 rounded-b-xl overflow-hidden relative">
        {/* Runtime Mode Badge */}
        <div className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-green-100 backdrop-blur-sm border border-green-500 rounded-md shadow-md">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-xs font-bold text-green-700 uppercase tracking-wider">
              Runtime Active
            </p>
          </div>
        </div>

        {/* Screen Name Badge */}
        <div className="absolute top-3 right-3 z-10 px-3 py-1.5 bg-white/90 backdrop-blur-sm border border-gold/30 rounded-md shadow-md">
          <p className="text-xs font-bold text-heading">
            {currentScreen?.screenName}
          </p>
        </div>

        {currentScreen ? (
          <RuntimeCanvas
            elements={currentScreen.elements || []}
            width={currentScreen.width || 1280}
            height={currentScreen.height || 720}
            backgroundColor={currentScreen.backgroundColor || '#ffffff'}
            liveValues={liveValues}
            tags={tags}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <AlertCircle className="w-12 h-12 text-slate-600" />
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="mt-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <span>Elements: {currentScreen?.elements?.length || 0}</span>
          <span>Live Tags: {Object.keys(liveValues).length}</span>
          <span>Canvas: {currentScreen?.width}×{currentScreen?.height}</span>
          <span>Updates received: {updateCountRef.current}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-blue-500 animate-pulse' : 'bg-red-500'
            }`}
          ></div>
          <span>{connected ? 'Real-time monitoring active' : 'Waiting for connection...'}</span>
        </div>
      </div>
    </div>
  );
};

export default Runtime;