import { useState, useEffect, useCallback } from 'react';
import MenuBar from '../components/designer/MenuBar';
import DesignerToolbar from '../components/designer/DesignerToolbar';
import LeftSidebar from '../components/designer/LeftSidebar';
import DesignCanvas from '../components/designer/DesignCanvas';
import ScreenExplorer from '../components/designer/ScreenExplorer';
import PropertyTree from '../components/designer/PropertyTree';
import PropertyTable from '../components/designer/PropertyTable';
import EventsTab from '../components/designer/EventsTab';
import AnimationTab from '../components/designer/AnimationTab';
import Modal from '../components/ui/Modal';
import { screenAPI, tagAPI, settingsAPI } from '../services/api';
import socketService from '../services/socket';
import { useNavigate } from 'react-router-dom';
import { normalizeColor } from '../utils/colorUtils';
import StatusBar from '../components/designer/StatusBar';
import BindingDialog from '../components/designer/BindingDialog';
import { setBinding, removeBinding } from '../utils/bindingUtils';
import DirectConnectionDialog from '../components/designer/DirectConnectionDialog';
import { useToast } from '../context/ToastContext';
import COLORS from '../theme/colors';

const GraphicDesigner = () => {
  const { showToast } = useToast();

  // ─── State ──────────────────────────────────────────────
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tags, setTags] = useState([]);
  const [screens, setScreens] = useState([]);
  const [currentScreen, setCurrentScreen] = useState(null);
  const [liveValues, setLiveValues] = useState({});
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [screenName, setScreenName] = useState('');
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(700);
  const [canvasBg, setCanvasBg] = useState('#ffffff');
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [activePropertyCategory, setActivePropertyCategory] = useState('geometry');
  const [activeTab, setActiveTab] = useState('properties');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [socketConnected, setSocketConnected] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(null);

  // ✅ NEW: Store loaded defaults so New Screen also uses them
  const [defaultCanvasSettings, setDefaultCanvasSettings] = useState({
    width: 1200,
    height: 700,
    bg: '#ffffff',
    gridSize: 10,
    showGrid: true,
  });

  // Undo/Redo stacks
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Clipboard
  const [clipboard, setClipboard] = useState(null);

  // Binding Dialog State (Sprint C)
  const [bindingDialogOpen, setBindingDialogOpen] = useState(false);
  const [bindingContext, setBindingContext] = useState({
    propertyKey: '',
    propertyLabel: '',
    propertyType: 'text',
  });

  // Sprint D2: Direct Connections state
  const [directConnections, setDirectConnections] = useState([]);
  const [connectionsDialogOpen, setConnectionsDialogOpen] = useState(false);

  const navigate = useNavigate();
  const selectedElement = elements.find((el) => el.id === selectedId);

  // Auto-switch to Element Specific tab when selecting a specialized element
  useEffect(() => {
    if (selectedElement) {
      const specialTypes = [
        'motor', 'tank', 'pump', 'valve', 'bar',
        'ioField', 'numericDisplay', 'button',
        'checkBox', 'radioButton', 'comboBox', 'listBox',
        'svgSymbol',
      ];
      if (specialTypes.includes(selectedElement.type)) {
        setActivePropertyCategory('elementSpecific');
      } else {
        setActivePropertyCategory('geometry');
      }
    }
  }, [selectedId]);

  // ═══════════════════════════════════════════════════════════
  // ✅ NEW: Load canvas defaults from Settings on mount
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const loadCanvasDefaults = async () => {
      try {
        const res = await settingsAPI.getAll();
        const appearance = res.data?.data?.appearance || {};

        const defaults = {
          width:    appearance.canvasDefaultWidth  || 1200,
          height:   appearance.canvasDefaultHeight || 700,
          bg:       appearance.canvasDefaultBg     || '#ffffff',
          gridSize: appearance.gridSize            || 10,
          showGrid: appearance.showGrid !== false,
        };

        setDefaultCanvasSettings(defaults);

        // Only apply to current canvas if no screen is loaded (i.e. blank state)
        if (!currentScreen && elements.length === 0) {
          setCanvasWidth(defaults.width);
          setCanvasHeight(defaults.height);
          setCanvasBg(defaults.bg);
          setGridSize(defaults.gridSize);
          setShowGrid(defaults.showGrid);
        }
      } catch (err) {
        console.warn('Could not load canvas defaults from Settings:', err.message);
      }
    };

    loadCanvasDefaults();
  }, []); // Run once on mount

  // ─── Load Data ──────────────────────────────────────────
  useEffect(() => {
    loadTags();
    loadScreens();

    const handleTagsUpdate = (updates) => {
      setLiveValues((prev) => {
        const updated = { ...prev };
        updates.forEach((u) => { updated[u.tagName] = u.value; });
        return updated;
      });
    };

    const handleInitialTags = (initial) => {
      const values = {};
      initial.forEach((t) => { values[t.tagName] = t.value; });
      setLiveValues(values);
    };

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    if (socketService.isConnected && socketService.isConnected()) {
      setSocketConnected(true);
    }

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('tagsUpdate', handleTagsUpdate);
    socketService.on('initialTags', handleInitialTags);

    return () => {
      socketService.off('tagsUpdate', handleTagsUpdate);
      socketService.off('initialTags', handleInitialTags);
    };
  }, []);

  const loadTags = async () => {
    try {
      const res = await tagAPI.getAll();
      setTags(res.data.data || []);
    } catch (err) { console.error('Failed to load tags:', err); }
  };

  const loadScreens = async () => {
    try {
      const res = await screenAPI.getAll();
      setScreens(res.data.data || []);
    } catch (err) { console.error('Failed to load screens:', err); }
  };

  // ─── Undo/Redo ──────────────────────────────────────────
  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-50), JSON.stringify(elements)]);
    setRedoStack([]);
  }, [elements]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, JSON.stringify(elements)]);
    setUndoStack((u) => u.slice(0, -1));
    setElements(JSON.parse(prev));
  }, [undoStack, elements]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, JSON.stringify(elements)]);
    setRedoStack((r) => r.slice(0, -1));
    setElements(JSON.parse(next));
  }, [redoStack, elements]);

  // ─── Element Actions ────────────────────────────────────
  const handleAddElement = useCallback((newElement) => {
    pushUndo();
    const id = `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setElements((prev) => [...prev, { ...newElement, id }]);
    setSelectedId(id);
  }, [pushUndo]);

  const handleAddComponent = useCallback((component) => {
    if (!component || !component.template) return;

    pushUndo();
    const id = `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const centerX = Math.round(canvasWidth / 2 - (component.template.width || 100) / 2);
    const centerY = Math.round(canvasHeight / 2 - (component.template.height || 100) / 2);

    const newElement = {
      ...component.template,
      id,
      x: centerX,
      y: centerY,
    };

    setElements((prev) => [...prev, newElement]);
    setSelectedId(id);
  }, [pushUndo, canvasWidth, canvasHeight]);

  const handleUpdateElement = useCallback((id, updates) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  }, []);

  const handleDeleteElement = useCallback((id) => {
    pushUndo();
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedId(null);
  }, [pushUndo]);

  // ─── Clipboard ──────────────────────────────────────────
  const handleCut = useCallback(() => {
    if (!selectedId) return;
    const el = elements.find((e) => e.id === selectedId);
    if (!el) return;
    setClipboard({ ...el });
    handleDeleteElement(selectedId);
  }, [selectedId, elements, handleDeleteElement]);

  const handleCopy = useCallback(() => {
    if (!selectedId) return;
    const el = elements.find((e) => e.id === selectedId);
    if (!el) return;
    setClipboard({ ...el });
  }, [selectedId, elements]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    pushUndo();
    const id = `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newEl = {
      ...clipboard,
      id,
      x: (clipboard.x || 0) + 20,
      y: (clipboard.y || 0) + 20,
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(id);
  }, [clipboard, pushUndo]);

  // ─── Binding Handlers ───────────────────────────────────
  const handleOpenBinding = useCallback((propertyKey, propertyLabel, propertyType = 'text') => {
    setBindingContext({ propertyKey, propertyLabel, propertyType });
    setBindingDialogOpen(true);
  }, []);

  const handleSaveBinding = useCallback((binding) => {
    if (!selectedId) return;
    const el = elements.find((e) => e.id === selectedId);
    if (!el) return;
    pushUndo();
    const updated = setBinding(el, bindingContext.propertyKey, binding);
    handleUpdateElement(selectedId, { dynamicBindings: updated.dynamicBindings });
  }, [selectedId, elements, bindingContext.propertyKey, pushUndo, handleUpdateElement]);

  const handleRemoveBinding = useCallback(() => {
    if (!selectedId) return;
    const el = elements.find((e) => e.id === selectedId);
    if (!el) return;
    pushUndo();
    const updated = removeBinding(el, bindingContext.propertyKey);
    handleUpdateElement(selectedId, { dynamicBindings: updated.dynamicBindings });
  }, [selectedId, elements, bindingContext.propertyKey, pushUndo, handleUpdateElement]);

  const getPropertyType = (propertyKey) => {
    const colorProps = ['fill', 'stroke', 'fontColor', 'shadowColor',
      'motorRunningColor', 'motorStoppedColor', 'motorFaultColor',
      'tankLiquidColor', 'pumpRunningColor', 'pumpStoppedColor',
      'valveOpenColor', 'valveClosedColor', 'valvePartialColor',
      'barNormalColor', 'barWarningColor', 'barCriticalColor',
      'buttonPressedColor', 'buttonDisabledColor',
      'symbolTint',
      'listSelectionColor',
    ];
    const numberProps = ['x', 'y', 'width', 'height', 'rotation', 'opacity',
      'strokeWidth', 'fontSize', 'cornerRadius',
      'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'shadowOpacity',
      'motorRPM', 'tankMinLevel', 'tankMaxLevel', 'tankWarningHigh', 'tankWarningLow',
      'pumpFlowRate', 'pumpRPM', 'valvePosition',
      'barMin', 'barMax', 'barWarningHigh', 'barWarningLow',
      'ioDecimals', 'ioMinValue', 'ioMaxValue', 'numDecimals',
      'buttonRepeatDelay', 'layer',
    ];
    const boolProps = ['isVisible', 'operatorControlEnable'];

    if (colorProps.includes(propertyKey)) return 'color';
    if (numberProps.includes(propertyKey)) return 'number';
    if (boolProps.includes(propertyKey)) return 'boolean';
    return 'text';
  };

  // ─── Screen Actions ─────────────────────────────────────
  const handleNewScreen = () => {
    if (elements.length > 0 && !confirm('Discard current changes?')) return;
    setElements([]);
    setSelectedId(null);
    setDirectConnections([]);
    setCurrentScreen(null);
    setUndoStack([]);
    setRedoStack([]);

    // ✅ Apply Settings defaults when creating new screen
    setCanvasWidth(defaultCanvasSettings.width);
    setCanvasHeight(defaultCanvasSettings.height);
    setCanvasBg(defaultCanvasSettings.bg);
    setGridSize(defaultCanvasSettings.gridSize);
    setShowGrid(defaultCanvasSettings.showGrid);
  };

  const handleSave = async () => {
    if (currentScreen) {
      try {
        setSaving(true);
        await screenAPI.update(currentScreen._id, {
          elements,
          width: canvasWidth,
          height: canvasHeight,
          backgroundColor: canvasBg,
          directConnections,
        });
        showToast('Screen saved successfully', 'success');
        loadScreens();
      } catch (err) {
        showToast(err.response?.data?.message || 'Save failed', 'error');
      }
      finally { setSaving(false); }
    } else {
      setScreenName('');
      setShowSaveModal(true);
    }
  };

  const handleSaveAs = async () => {
    if (!screenName.trim()) {
      showToast('Please enter a screen name', 'warning');
      return;
    }
    try {
      setSaving(true);
      const res = await screenAPI.create({
        screenName,
        elements,
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: canvasBg,
        directConnections,
      });
      setCurrentScreen(res.data.data);
      setShowSaveModal(false);
      showToast(`Screen "${screenName}" saved`, 'success');
      loadScreens();
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    }
    finally { setSaving(false); }
  };

  const handleLoadScreen = async (screen) => {
    try {
      const res = await screenAPI.getOne(screen._id);
      const data = res.data.data;
      setElements(data.elements || []);
      setCanvasWidth(data.width || defaultCanvasSettings.width);
      setCanvasHeight(data.height || defaultCanvasSettings.height);
      setCanvasBg(data.backgroundColor || defaultCanvasSettings.bg);
      setDirectConnections(data.directConnections || []);
      setCurrentScreen(data);
      setSelectedId(null);
      setUndoStack([]);
      setRedoStack([]);
      showToast(`Loaded: ${data.screenName}`, 'success');
    } catch (err) {
      showToast('Failed to load screen', 'error');
    }
  };

  // ─── Keyboard Shortcuts ─────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z': e.preventDefault(); handleUndo(); break;
          case 'y': e.preventDefault(); handleRedo(); break;
          case 'c': e.preventDefault(); handleCopy(); break;
          case 'x': e.preventDefault(); handleCut(); break;
          case 'v': e.preventDefault(); handlePaste(); break;
          case 's': e.preventDefault(); handleSave(); break;
          case 'n': e.preventDefault(); handleNewScreen(); break;
          case 'o': e.preventDefault(); setShowLoadModal(true); break;
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) { e.preventDefault(); handleDeleteElement(selectedId); }
      }
      if (e.key === 'Escape') { setSelectedId(null); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleCopy, handleCut, handlePaste, handleSave, handleNewScreen, handleDeleteElement, selectedId]);

  return (
    <div className="h-full flex flex-col" style={{ background: '#F8FAFC' }}>
      <MenuBar
        onNew={handleNewScreen}
        onOpen={() => setShowLoadModal(true)}
        onSave={handleSave}
        onSaveAs={() => { setScreenName(''); setShowSaveModal(true); }}
        onRun={() => navigate('/runtime')}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={() => selectedId && handleDeleteElement(selectedId)}
        onSelectAll={() => {}}
        onDeselectAll={() => setSelectedId(null)}
        onZoomIn={() => setZoom((z) => Math.min(z + 10, 300))}
        onZoomOut={() => setZoom((z) => Math.max(z - 10, 25))}
        onZoomReset={() => setZoom(100)}
        onToggleGrid={() => setShowGrid((g) => !g)}
        showGrid={showGrid}
        currentScreen={currentScreen}
      />

      <DesignerToolbar
        onNew={handleNewScreen}
        onOpen={() => setShowLoadModal(true)}
        onSave={handleSave}
        onRun={() => navigate('/runtime')}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onZoomIn={() => setZoom((z) => Math.min(z + 10, 300))}
        onZoomOut={() => setZoom((z) => Math.max(z - 10, 25))}
        zoom={zoom}
        onToggleGrid={() => setShowGrid((g) => !g)}
        showGrid={showGrid}
        onToggleSnap={() => setSnapEnabled((s) => !s)}
        snapEnabled={snapEnabled}
        gridSize={gridSize}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        canvasBg={normalizeColor(canvasBg, '#ffffff')}
        onCanvasWidthChange={setCanvasWidth}
        onCanvasHeightChange={setCanvasHeight}
        onCanvasBgChange={setCanvasBg}
        onOpenConnections={() => setConnectionsDialogOpen(true)}
        connectionsCount={directConnections.length}
        saving={saving}
      />

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-shrink-0">
          <LeftSidebar
            onAddElement={handleAddElement}
            onAddComponent={handleAddComponent}
          />
        </div>

        <div className="flex-1 overflow-auto min-w-0">
          <DesignCanvas
            elements={elements}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={(id, updates) => {
              pushUndo();
              handleUpdateElement(id, updates);
              setRotationAngle(null);
            }}
            width={canvasWidth}
            height={canvasHeight}
            backgroundColor={canvasBg}
            liveValues={liveValues}
            onMouseMove={setMousePosition}
            onRotate={setRotationAngle}
            snapEnabled={snapEnabled}
            gridSize={gridSize}
          />
        </div>

        <div className="flex-shrink-0">
          <ScreenExplorer
            screens={screens}
            onLoadScreen={handleLoadScreen}
            currentScreen={currentScreen}
            onRefresh={loadScreens}
          />
        </div>
      </div>

      {/* Bottom: Property Panel */}
      <div
        className="h-[280px] min-h-[240px] flex flex-col"
        style={{
          borderTop: `2px solid ${COLORS.brandAccent}`,
          background: '#FFFFFF',
        }}
      >
        <div
          className="flex items-center px-1"
          style={{
            background: '#F1F5F9',
            borderBottom: `1px solid ${COLORS.lineDefault}`,
          }}
        >
          <span
            className="text-[11px] font-bold px-2 py-1.5"
            style={{ color: COLORS.heading, fontFamily: COLORS.fonts.heading }}
          >
            Object Properties
          </span>
          {selectedElement && (
            <span className="text-[10px] px-2" style={{ color: COLORS.inkMuted }}>
              — {selectedElement.type} ({selectedElement.id?.slice(-6)})
            </span>
          )}
          <div className="flex-1" />
          {selectedElement && (
            <button
              onClick={() => handleDeleteElement(selectedElement.id)}
              className="p-1 rounded transition-colors"
              style={{ color: COLORS.danger }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.dangerLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              title="Delete element"
            >
              <span className="text-[10px]">✕</span>
            </button>
          )}
        </div>

        <div
          className="flex"
          style={{
            background: '#F8FAFC',
            borderBottom: `1px solid ${COLORS.lineDefault}`,
          }}
        >
          {[
            { id: 'properties', label: 'Properties' },
            { id: 'events', label: 'Events' },
            { id: 'texts', label: 'Texts' },
            { id: 'animation', label: 'Animation' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-1.5 text-[11px] font-medium transition-colors"
                style={{
                  borderBottom: `2px solid ${isActive ? COLORS.brandAccent : 'transparent'}`,
                  color: isActive ? COLORS.brandAccent : COLORS.inkMuted,
                  background: isActive ? '#FFFFFF' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = COLORS.heading;
                    e.currentTarget.style.background = 'rgba(255,255,255,0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = COLORS.inkMuted;
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'properties' && (
            <>
              <PropertyTree
                elementType={selectedElement?.type}
                activeCategory={activePropertyCategory}
                onCategoryChange={setActivePropertyCategory}
              />
              <PropertyTable
                element={selectedElement}
                activeCategory={activePropertyCategory}
                tags={tags}
                onUpdate={handleUpdateElement}
                onOpenTagBinding={(key, label) => {
                  handleOpenBinding(key, label, getPropertyType(key));
                }}
              />
            </>
          )}

          {activeTab === 'events' && (
            <EventsTab
              element={selectedElement}
              tags={tags}
              onUpdate={handleUpdateElement}
            />
          )}

          {activeTab === 'texts' && (
            <div className="flex-1 flex items-center justify-center" style={{ background: '#FFFFFF' }}>
              <div className="text-center">
                <p className="text-[11px] italic" style={{ color: COLORS.inkSubtle }}>
                  Text properties will be here
                </p>
                <p className="text-[10px] mt-1" style={{ color: COLORS.inkSubtle }}>
                  (Coming in future update)
                </p>
              </div>
            </div>
          )}

          {activeTab === 'animation' && (
            <AnimationTab
              element={selectedElement}
              tags={tags}
              onUpdate={handleUpdateElement}
            />
          )}
        </div>
      </div>

      <StatusBar
        mousePosition={mousePosition}
        zoom={zoom}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        elementCount={elements.length}
        selectedElement={selectedElement}
        connected={socketConnected}
        showGrid={showGrid}
        rotationAngle={rotationAngle}
      />

      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save Screen As"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: COLORS.heading }}>
              Screen Name
            </label>
            <input
              type="text"
              value={screenName}
              onChange={(e) => setScreenName(e.target.value)}
              placeholder="e.g. Main Dashboard"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveAs()}
              className="w-full px-4 py-2.5 rounded-lg outline-none transition-all"
              style={{
                background: '#F8FAFC',
                border: `1px solid ${COLORS.lineDefault}`,
                color: COLORS.heading,
              }}
              onFocus={(e) => { e.target.style.borderColor = COLORS.brandAccent; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.lineDefault; }}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSaveModal(false)}
              className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors"
              style={{
                background: '#F1F5F9',
                color: COLORS.heading,
                border: `1px solid ${COLORS.lineDefault}`,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAs}
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white transition-colors"
              style={{
                background: COLORS.btnPrimary,
                boxShadow: COLORS.shadows.btn,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.btnHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.btnPrimary; }}
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        title="Load Screen"
        size="md"
      >
        {screens.length === 0 ? (
          <div className="text-center py-8">
            <p style={{ color: COLORS.inkMuted }}>No saved screens yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {screens.map((s) => (
              <button
                key={s._id}
                onClick={() => { handleLoadScreen(s); setShowLoadModal(false); }}
                className="w-full p-3 rounded-lg text-left transition-all"
                style={{
                  background: '#F8FAFC',
                  border: `1px solid ${COLORS.lineDefault}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = COLORS.surfaceHover;
                  e.currentTarget.style.borderColor = COLORS.brandAccent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#F8FAFC';
                  e.currentTarget.style.borderColor = COLORS.lineDefault;
                }}
              >
                <p className="font-semibold" style={{ color: COLORS.heading }}>
                  {s.screenName}
                </p>
                <p className="text-xs mt-0.5" style={{ color: COLORS.inkMuted }}>
                  {s.elements?.length || 0} elements • {new Date(s.updatedAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </Modal>

      <BindingDialog
        isOpen={bindingDialogOpen}
        onClose={() => setBindingDialogOpen(false)}
        propertyKey={bindingContext.propertyKey}
        propertyLabel={bindingContext.propertyLabel}
        propertyType={bindingContext.propertyType}
        element={selectedElement}
        tags={tags}
        liveValues={liveValues}
        onSave={handleSaveBinding}
        onRemove={handleRemoveBinding}
      />

      <DirectConnectionDialog
        isOpen={connectionsDialogOpen}
        onClose={() => setConnectionsDialogOpen(false)}
        connections={directConnections}
        tags={tags}
        onSave={(newConnections) => setDirectConnections(newConnections)}
      />
    </div>
  );
};

export default GraphicDesigner;