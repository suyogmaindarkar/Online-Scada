// ═══════════════════════════════════════════════════════════
// GraphicDesigner — All fixes applied:
//   ✅ #1  Auto-save (debounced, fires on navigation/tab-away)
//   ✅ #2  Delete screen works (passes handler to ScreenExplorer)
//   ✅ #3  Set startup screen (passes handler to ScreenExplorer)
//   ✅ #4  changeScreen event passes screens list to EventsTab
//   ✅ #5  Property panel scroll fixed (overflow-hidden → overflow-auto)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
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

const LS_PANEL_HEIGHT = 'onlinescada.designer.panelHeight';
const MIN_PANEL_HEIGHT = 150;
const MAX_PANEL_HEIGHT = 600;
const DEFAULT_PANEL_HEIGHT = 280;

// ── Auto-save debounce delay (ms) ──
const AUTO_SAVE_DELAY = 2000;

const GraphicDesigner = () => {
  const { showToast } = useToast();

  // ─── Core State ──────────────────────────────────────────
  const [elements, setElements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
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
  const [autoSaving, setAutoSaving] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [activePropertyCategory, setActivePropertyCategory] = useState('geometry');
  const [activeTab, setActiveTab] = useState('properties');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [socketConnected, setSocketConnected] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(null);
  const [defaultCanvasSettings, setDefaultCanvasSettings] = useState({
    width: 1200, height: 700, bg: '#ffffff', gridSize: 10, showGrid: true,
  });

  // ─── Undo/Redo ───
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // ─── Clipboard ───
  const [clipboard, setClipboard] = useState(null);

  // ─── Binding Dialog ───
  const [bindingDialogOpen, setBindingDialogOpen] = useState(false);
  const [bindingContext, setBindingContext] = useState({ propertyKey: '', propertyLabel: '', propertyType: 'text' });

  // ─── Direct Connections ───
  const [directConnections, setDirectConnections] = useState([]);
  const [connectionsDialogOpen, setConnectionsDialogOpen] = useState(false);

  // ─── Resizable Panel ───
  const [panelHeight, setPanelHeight] = useState(() => {
    const stored = localStorage.getItem(LS_PANEL_HEIGHT);
    const parsed = parseInt(stored);
    return isNaN(parsed) ? DEFAULT_PANEL_HEIGHT : Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, parsed));
  });
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  // ─── Auto-save refs ───
  const autoSaveTimerRef = useRef(null);
  const currentScreenRef = useRef(null);       // keep in sync with state
  const elementsRef = useRef([]);              // keep in sync
  const directConnectionsRef = useRef([]);
  const canvasWidthRef = useRef(1200);
  const canvasHeightRef = useRef(700);
  const canvasBgRef = useRef('#ffffff');
  const hasUnsavedChangesRef = useRef(false);

  const navigate = useNavigate();

  // ─── Keep refs in sync ───
  useEffect(() => { currentScreenRef.current = currentScreen; }, [currentScreen]);
  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { directConnectionsRef.current = directConnections; }, [directConnections]);
  useEffect(() => { canvasWidthRef.current = canvasWidth; }, [canvasWidth]);
  useEffect(() => { canvasHeightRef.current = canvasHeight; }, [canvasHeight]);
  useEffect(() => { canvasBgRef.current = canvasBg; }, [canvasBg]);

  // ─── Derived ───
  const selectedElement = selectedIds.length === 1
    ? elements.find((el) => el.id === selectedIds[0])
    : null;
  const selectedElements = elements.filter(el => selectedIds.includes(el.id));

  // Auto-switch to Element Specific tab when selecting a specialized element
  useEffect(() => {
    if (selectedElement) {
      const specialTypes = [
        'motor', 'tank', 'pump', 'valve', 'bar', 'ioField',
        'numericDisplay', 'button', 'checkBox', 'radioButton',
        'comboBox', 'listBox', 'svgSymbol',
      ];
      setActivePropertyCategory(specialTypes.includes(selectedElement.type) ? 'elementSpecific' : 'geometry');
    }
  }, [selectedIds]);


  // ✅ Create a new popup screen
const handleCreatePopup = () => {
  // Auto-save current before switching
  if (currentScreenRef.current && hasUnsavedChangesRef.current) {
    performSave(true);
  }
  const popupName = prompt('Enter popup screen name:', `Popup_${Date.now()}`);
  if (!popupName || !popupName.trim()) return;

  screenAPI.create({
    screenName: popupName.trim(),
    width: 600,
    height: 400,
    backgroundColor: '#FFFFFF',
    elements: [],
    directConnections: [],
    isPopup: true,
    popupModal: true,
    popupCloseable: true,
    popupCloseOnBackdrop: true,
  })
    .then(res => {
      showToast(`Popup "${popupName}" created`, 'success');
      loadScreens();
      // Auto-open the new popup for editing
      handleLoadScreen(res.data.data);
    })
    .catch(err => {
      showToast(err.response?.data?.message || 'Failed to create popup', 'error');
    });
};

// ✅ Create a new template screen (only allowed if none exists)
const handleCreateTemplate = () => {
  const existingTemplate = screens.find(s => s.isTemplate === true);
  if (existingTemplate) {
    showToast('A template screen already exists', 'warning');
    return;
  }
  if (currentScreenRef.current && hasUnsavedChangesRef.current) {
    performSave(true);
  }
  const name = prompt('Enter template screen name:', 'Master Template');
  if (!name || !name.trim()) return;

  screenAPI.create({
    screenName: name.trim(),
    width: defaultCanvasSettings.width,
    height: defaultCanvasSettings.height,
    backgroundColor: defaultCanvasSettings.bg,
    elements: [],
    directConnections: [],
    isTemplate: true,
  })
    .then(res => {
      showToast(`Template "${name}" created`, 'success');
      loadScreens();
      handleLoadScreen(res.data.data);
    })
    .catch(err => {
      showToast(err.response?.data?.message || 'Failed to create template', 'error');
    });
};


  // ═══════════════════════════════════════════════════════════
  // #1 AUTO-SAVE LOGIC
  // ═══════════════════════════════════════════════════════════

  // Perform the actual save (used by both manual and auto-save)
  const performSave = useCallback(async (silent = false) => {
    const screen = currentScreenRef.current;
    if (!screen) return; // Nothing to save if no screen exists yet

    try {
      if (!silent) setSaving(true);
      else setAutoSaving(true);

      await screenAPI.update(screen._id, {
        elements: elementsRef.current,
        width: canvasWidthRef.current,
        height: canvasHeightRef.current,
        backgroundColor: canvasBgRef.current,
        directConnections: directConnectionsRef.current,
      });

      hasUnsavedChangesRef.current = false;
      if (silent) {
        // Show subtle auto-save indicator briefly
        setAutoSaving(false);
      } else {
        showToast('Screen saved successfully', 'success');
        loadScreens();
      }
    } catch (err) {
      setAutoSaving(false);
      if (!silent) showToast(err.response?.data?.message || 'Save failed', 'error');
      else console.warn('Auto-save failed:', err.message);
    } finally {
      if (!silent) setSaving(false);
    }
  }, [showToast]);

  // Schedule auto-save whenever elements/canvas change
  const scheduleAutoSave = useCallback(() => {
    if (!currentScreenRef.current) return; // Only auto-save if screen is saved (has ID)
    hasUnsavedChangesRef.current = true;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      performSave(true); // silent auto-save
    }, AUTO_SAVE_DELAY);
  }, [performSave]);

  // Auto-save on page unload / navigation away
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChangesRef.current && currentScreenRef.current) {
        // Try to auto-save synchronously (best effort)
        performSave(true);
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also save on component unmount (navigating to another page)
      if (hasUnsavedChangesRef.current && currentScreenRef.current) {
        performSave(true);
      }
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [performSave]);

  // Panel resize handler
  const handlePanelResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizingPanel(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = panelHeight;
  }, [panelHeight]);

  useEffect(() => {
    if (!isResizingPanel) return;
    const handleMouseMove = (e) => {
      const delta = resizeStartY.current - e.clientY;
      const newHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, resizeStartHeight.current + delta));
      setPanelHeight(newHeight);
    };
    const handleMouseUp = () => {
      setIsResizingPanel(false);
      localStorage.setItem(LS_PANEL_HEIGHT, String(panelHeight));
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingPanel, panelHeight]);

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
    if (socketService.isConnected && socketService.isConnected()) setSocketConnected(true);
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

  // Load canvas defaults
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
        if (!currentScreen && elements.length === 0) {
          setCanvasWidth(defaults.width);
          setCanvasHeight(defaults.height);
          setCanvasBg(defaults.bg);
          setGridSize(defaults.gridSize);
          setShowGrid(defaults.showGrid);
        }
      } catch (err) {
        console.warn('Could not load canvas defaults:', err.message);
      }
    };
    loadCanvasDefaults();
  }, []);

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

  // ─── Select ─────────────────────────────────────────────
  const handleSelect = useCallback((id, shiftKey = false) => {
    if (id === null) { setSelectedIds([]); return; }
    const element = elements.find(el => el.id === id);
    let idsToSelect = [id];
    if (element?.groupId) {
      idsToSelect = elements.filter(el => el.groupId === element.groupId).map(el => el.id);
    }
    setSelectedIds(prev => {
      if (shiftKey) {
        const alreadySelected = idsToSelect.every(id => prev.includes(id));
        return alreadySelected
          ? prev.filter(existingId => !idsToSelect.includes(existingId))
          : [...new Set([...prev, ...idsToSelect])];
      }
      return idsToSelect;
    });
  }, [elements]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(elements.map(el => el.id));
    showToast(`Selected ${elements.length} elements`, 'info', 1500);
  }, [elements, showToast]);

  // ─── Element Actions ────────────────────────────────────
  const handleAddElement = useCallback((newElement) => {
    pushUndo();
    const id = `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setElements((prev) => {
      const updated = [...prev, { ...newElement, id }];
      scheduleAutoSave();
      return updated;
    });
    setSelectedIds([id]);
  }, [pushUndo, scheduleAutoSave]);

  const handleAddComponent = useCallback((component) => {
    if (!component || !component.template) return;
    pushUndo();
    const id = `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const centerX = Math.round(canvasWidth / 2 - (component.template.width || 100) / 2);
    const centerY = Math.round(canvasHeight / 2 - (component.template.height || 100) / 2);
    const newElement = { ...component.template, id, x: centerX, y: centerY };
    setElements((prev) => {
      const updated = [...prev, newElement];
      scheduleAutoSave();
      return updated;
    });
    setSelectedIds([id]);
  }, [pushUndo, canvasWidth, canvasHeight, scheduleAutoSave]);

  const handleUpdateElement = useCallback((id, updates) => {
    setElements((prev) => {
      const updated = prev.map((el) => (el.id === id ? { ...el, ...updates } : el));
      scheduleAutoSave();
      return updated;
    });
  }, [scheduleAutoSave]);

  const handleUpdateMultiple = useCallback((updates) => {
    setElements(prev => {
      const updated = prev.map(el => selectedIds.includes(el.id) ? { ...el, ...updates } : el);
      scheduleAutoSave();
      return updated;
    });
  }, [selectedIds, scheduleAutoSave]);

  const handleDeleteElement = useCallback((id) => {
    pushUndo();
    setElements((prev) => {
      const updated = prev.filter((el) => el.id !== id);
      scheduleAutoSave();
      return updated;
    });
    setSelectedIds(prev => prev.filter(sid => sid !== id));
  }, [pushUndo, scheduleAutoSave]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushUndo();
    setElements(prev => {
      const updated = prev.filter(el => !selectedIds.includes(el.id));
      scheduleAutoSave();
      return updated;
    });
    const count = selectedIds.length;
    setSelectedIds([]);
    showToast(`Deleted ${count} element${count > 1 ? 's' : ''}`, 'success', 1500);
  }, [selectedIds, pushUndo, showToast, scheduleAutoSave]);

  // ─── Duplicate ──────────────────────────────────────────
  const handleDuplicate = useCallback(() => {
    if (selectedIds.length === 0) { showToast('Select an element to duplicate', 'warning', 1500); return; }
    pushUndo();
    const idMap = new Map();
    const newElements = selectedElements.map(el => {
      const newId = `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      idMap.set(el.id, newId);
      return { ...JSON.parse(JSON.stringify(el)), id: newId, x: (el.x || 0) + 20, y: (el.y || 0) + 20 };
    });
    const oldGroupIds = new Set(selectedElements.map(el => el.groupId).filter(Boolean));
    if (oldGroupIds.size > 0) {
      const groupIdMap = new Map();
      oldGroupIds.forEach(oldGid => { groupIdMap.set(oldGid, `grp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`); });
      newElements.forEach(el => { if (el.groupId && groupIdMap.has(el.groupId)) el.groupId = groupIdMap.get(el.groupId); });
    }
    setElements(prev => {
      const updated = [...prev, ...newElements];
      scheduleAutoSave();
      return updated;
    });
    setSelectedIds(newElements.map(e => e.id));
    showToast(`Duplicated ${newElements.length} element${newElements.length > 1 ? 's' : ''}`, 'success', 1500);
  }, [selectedIds, selectedElements, pushUndo, showToast, scheduleAutoSave]);

  // ─── Clipboard ──────────────────────────────────────────
  const handleCut = useCallback(() => {
    if (selectedIds.length === 0) return;
    setClipboard(JSON.parse(JSON.stringify(selectedElements)));
    handleDeleteSelected();
  }, [selectedIds, selectedElements, handleDeleteSelected]);

  const handleCopy = useCallback(() => {
    if (selectedIds.length === 0) return;
    setClipboard(JSON.parse(JSON.stringify(selectedElements)));
    showToast(`Copied ${selectedIds.length} element${selectedIds.length > 1 ? 's' : ''}`, 'info', 1500);
  }, [selectedIds, selectedElements, showToast]);

  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.length === 0) return;
    pushUndo();
    const newElements = clipboard.map(el => ({
      ...JSON.parse(JSON.stringify(el)),
      id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      x: (el.x || 0) + 20, y: (el.y || 0) + 20,
    }));
    setElements(prev => {
      const updated = [...prev, ...newElements];
      scheduleAutoSave();
      return updated;
    });
    setSelectedIds(newElements.map(e => e.id));
  }, [clipboard, pushUndo, scheduleAutoSave]);

  // ─── Group/Ungroup ──────────────────────────────────────
  const handleGroup = useCallback(() => {
    if (selectedIds.length < 2) { showToast('Select 2 or more elements to group', 'warning', 2000); return; }
    pushUndo();
    const groupId = `grp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setElements(prev => {
      const updated = prev.map(el => selectedIds.includes(el.id) ? { ...el, groupId } : el);
      scheduleAutoSave();
      return updated;
    });
    showToast(`Grouped ${selectedIds.length} elements`, 'success', 1500);
  }, [selectedIds, pushUndo, showToast, scheduleAutoSave]);

  const handleUngroup = useCallback(() => {
    const groupedSelected = selectedElements.filter(el => el.groupId);
    if (groupedSelected.length === 0) { showToast('No grouped elements selected', 'warning', 2000); return; }
    pushUndo();
    const groupIdsToRemove = new Set(groupedSelected.map(el => el.groupId));
    setElements(prev => {
      const updated = prev.map(el => {
        if (el.groupId && groupIdsToRemove.has(el.groupId)) { const { groupId, ...rest } = el; return rest; }
        return el;
      });
      scheduleAutoSave();
      return updated;
    });
    showToast('Ungrouped', 'success', 1500);
  }, [selectedElements, pushUndo, showToast, scheduleAutoSave]);

  // ─── Align ──────────────────────────────────────────────
  const handleAlign = useCallback((direction) => {
    if (selectedIds.length === 0) return;
    pushUndo();
    let refX, refY, refWidth, refHeight;
    if (selectedIds.length === 1) { refX = 0; refY = 0; refWidth = canvasWidth; refHeight = canvasHeight; }
    else {
      const first = elements.find(el => el.id === selectedIds[0]);
      refX = first.x; refY = first.y; refWidth = first.width; refHeight = first.height;
    }
    setElements(prev => {
      const updated = prev.map(el => {
        if (!selectedIds.includes(el.id)) return el;
        if (selectedIds.length > 1 && el.id === selectedIds[0]) return el;
        const updates = {};
        switch (direction) {
          case 'left':    updates.x = refX; break;
          case 'centerH': updates.x = refX + (refWidth - el.width) / 2; break;
          case 'right':   updates.x = refX + refWidth - el.width; break;
          case 'top':     updates.y = refY; break;
          case 'centerV': updates.y = refY + (refHeight - el.height) / 2; break;
          case 'bottom':  updates.y = refY + refHeight - el.height; break;
        }
        return { ...el, ...updates };
      });
      scheduleAutoSave();
      return updated;
    });
    const dirLabel = { left: 'Left', centerH: 'Center H', right: 'Right', top: 'Top', centerV: 'Center V', bottom: 'Bottom' }[direction];
    showToast(`Aligned ${dirLabel}`, 'success', 1500);
  }, [selectedIds, elements, canvasWidth, canvasHeight, pushUndo, showToast, scheduleAutoSave]);

  const handleDistribute = useCallback((axis) => {
    if (selectedIds.length < 3) { showToast('Select 3+ elements to distribute', 'warning', 2000); return; }
    pushUndo();
    const sels = selectedElements.slice().sort((a, b) => axis === 'horizontal' ? a.x - b.x : a.y - b.y);
    const first = sels[0]; const last = sels[sels.length - 1];
    if (axis === 'horizontal') {
      const totalObjWidth = sels.reduce((sum, el) => sum + el.width, 0);
      const gap = ((last.x + last.width) - first.x - totalObjWidth) / (sels.length - 1);
      let currentX = first.x + first.width + gap;
      const updates = new Map();
      for (let i = 1; i < sels.length - 1; i++) { updates.set(sels[i].id, { x: currentX }); currentX += sels[i].width + gap; }
      setElements(prev => { const updated = prev.map(el => updates.has(el.id) ? { ...el, ...updates.get(el.id) } : el); scheduleAutoSave(); return updated; });
    } else {
      const totalObjHeight = sels.reduce((sum, el) => sum + el.height, 0);
      const gap = ((last.y + last.height) - first.y - totalObjHeight) / (sels.length - 1);
      let currentY = first.y + first.height + gap;
      const updates = new Map();
      for (let i = 1; i < sels.length - 1; i++) { updates.set(sels[i].id, { y: currentY }); currentY += sels[i].height + gap; }
      setElements(prev => { const updated = prev.map(el => updates.has(el.id) ? { ...el, ...updates.get(el.id) } : el); scheduleAutoSave(); return updated; });
    }
    showToast(`Distributed ${axis === 'horizontal' ? 'horizontally' : 'vertically'}`, 'success', 1500);
  }, [selectedIds, selectedElements, pushUndo, showToast, scheduleAutoSave]);

  // ─── Z-Order ────────────────────────────────────────────
  const handleZOrder = useCallback((operation) => {
    if (selectedIds.length === 0) return;
    pushUndo();
    setElements(prev => {
      const selected = prev.filter(el => selectedIds.includes(el.id));
      const unselected = prev.filter(el => !selectedIds.includes(el.id));
      let result;
      switch (operation) {
        case 'front': result = [...unselected, ...selected]; break;
        case 'back':  result = [...selected, ...unselected]; break;
        case 'forward': {
          result = [...prev];
          for (let i = result.length - 1; i >= 0; i--) {
            if (selectedIds.includes(result[i].id) && i < result.length - 1 && !selectedIds.includes(result[i + 1].id)) {
              [result[i], result[i + 1]] = [result[i + 1], result[i]];
            }
          }
          break;
        }
        case 'backward': {
          result = [...prev];
          for (let i = 0; i < result.length; i++) {
            if (selectedIds.includes(result[i].id) && i > 0 && !selectedIds.includes(result[i - 1].id)) {
              [result[i], result[i - 1]] = [result[i - 1], result[i]];
            }
          }
          break;
        }
        default: result = prev;
      }
      scheduleAutoSave();
      return result;
    });
    const opLabel = { front: 'to Front', back: 'to Back', forward: 'Forward', backward: 'Backward' }[operation];
    showToast(`Sent ${opLabel}`, 'success', 1500);
  }, [selectedIds, pushUndo, showToast, scheduleAutoSave]);

  // ─── Binding Handlers ───────────────────────────────────
  const handleOpenBinding = useCallback((propertyKey, propertyLabel, propertyType = 'text') => {
    setBindingContext({ propertyKey, propertyLabel, propertyType });
    setBindingDialogOpen(true);
  }, []);

  const handleSaveBinding = useCallback((binding) => {
    if (selectedIds.length !== 1) return;
    const el = elements.find((e) => e.id === selectedIds[0]);
    if (!el) return;
    pushUndo();
    const updated = setBinding(el, bindingContext.propertyKey, binding);
    handleUpdateElement(selectedIds[0], { dynamicBindings: updated.dynamicBindings });
  }, [selectedIds, elements, bindingContext.propertyKey, pushUndo, handleUpdateElement]);

  const handleRemoveBinding = useCallback(() => {
    if (selectedIds.length !== 1) return;
    const el = elements.find((e) => e.id === selectedIds[0]);
    if (!el) return;
    pushUndo();
    const updated = removeBinding(el, bindingContext.propertyKey);
    handleUpdateElement(selectedIds[0], { dynamicBindings: updated.dynamicBindings });
  }, [selectedIds, elements, bindingContext.propertyKey, pushUndo, handleUpdateElement]);

  const getPropertyType = (propertyKey) => {
    const colorProps = ['fill', 'stroke', 'fontColor', 'shadowColor',
      'motorRunningColor', 'motorStoppedColor', 'motorFaultColor',
      'tankLiquidColor', 'pumpRunningColor', 'pumpStoppedColor',
      'valveOpenColor', 'valveClosedColor', 'valvePartialColor',
      'barNormalColor', 'barWarningColor', 'barCriticalColor',
      'buttonPressedColor', 'buttonDisabledColor',
      'symbolTint', 'listSelectionColor',
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
    setSelectedIds([]);
    setDirectConnections([]);
    setCurrentScreen(null);
    setUndoStack([]);
    setRedoStack([]);

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
      setSelectedIds([]);
      setUndoStack([]);
      setRedoStack([]);
      showToast(`Loaded: ${data.screenName}`, 'success');
    } catch (err) {
      showToast('Failed to load screen', 'error');
    }
  };

  // ✅ Delete screen
  const handleDeleteScreen = async (screen) => {
    try {
      await screenAPI.delete(screen._id);
      showToast(`Deleted screen "${screen.screenName}"`, 'success');
      if (currentScreen?._id === screen._id) {
        handleNewScreen();
      }
      loadScreens();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete screen', 'error');
    }
  };

  // ✅ Set startup screen
  const handleSetStartupScreen = async (screen) => {
    try {
      await screenAPI.update(screen._id, { isStartupScreen: true });
      showToast(`"${screen.screenName}" set as startup screen`, 'success');
      loadScreens();
      if (currentScreen?._id === screen._id) {
        setCurrentScreen(prev => ({ ...prev, isStartupScreen: true }));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to set startup screen', 'error');
    }
  };

  // ─── Keyboard Shortcuts ─────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey) {
          switch (e.key.toLowerCase()) {
            case 'g': e.preventDefault(); handleUngroup(); return;
            case 'arrowup': e.preventDefault(); handleZOrder('front'); return;
            case 'arrowdown': e.preventDefault(); handleZOrder('back'); return;
          }
        }

        switch (e.key.toLowerCase()) {
          case 'z': e.preventDefault(); handleUndo(); break;
          case 'y': e.preventDefault(); handleRedo(); break;
          case 'c': e.preventDefault(); handleCopy(); break;
          case 'x': e.preventDefault(); handleCut(); break;
          case 'v': e.preventDefault(); handlePaste(); break;
          case 's': e.preventDefault(); handleSave(); break;
          case 'n': e.preventDefault(); handleNewScreen(); break;
          case 'o': e.preventDefault(); setShowLoadModal(true); break;
          case 'd': e.preventDefault(); handleDuplicate(); break;
          case 'a': e.preventDefault(); handleSelectAll(); break;
          case 'g': e.preventDefault(); handleGroup(); break;
        }
      }

      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (e.key === 'PageUp') { e.preventDefault(); handleZOrder('forward'); }
        if (e.key === 'PageDown') { e.preventDefault(); handleZOrder('backward'); }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) { e.preventDefault(); handleDeleteSelected(); }
      }
      if (e.key === 'Escape') { setSelectedIds([]); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleCopy, handleCut, handlePaste, handleSave, handleNewScreen, handleDeleteSelected, handleDuplicate, handleSelectAll, handleGroup, handleUngroup, handleZOrder, selectedIds]);

  const selectedForHeader = selectedElement || (selectedIds.length > 1 ? { type: `${selectedIds.length} objects`, id: selectedIds[0] } : null);

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
        onDelete={handleDeleteSelected}
        onSelectAll={handleSelectAll}
        onDeselectAll={() => setSelectedIds([])}
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
        selectedCount={selectedIds.length}
        onDuplicate={handleDuplicate}
        onGroup={handleGroup}
        onUngroup={handleUngroup}
        onAlign={handleAlign}
        onDistribute={handleDistribute}
        onZOrder={handleZOrder}
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
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onUpdate={(id, updates) => {
              pushUndo();
              handleUpdateElement(id, updates);
              setRotationAngle(null);
            }}
            onUpdateMultiple={(idsToUpdate, updates) => {
              pushUndo();
              setElements(prev => {
                const updated = prev.map(el => idsToUpdate.includes(el.id) ? { ...el, ...updates } : el);
                scheduleAutoSave();
                return updated;
              });
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
            onDeleteScreen={handleDeleteScreen}
            onSetStartupScreen={handleSetStartupScreen}
            onAddElement={handleAddElement}
            onCreatePopup={handleCreatePopup}
            onCreateTemplate={handleCreateTemplate}
          />
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handlePanelResizeStart}
        style={{
          height: '6px',
          background: isResizingPanel ? COLORS.brandAccent : '#F1F5F9',
          borderTop: `1px solid ${COLORS.lineDefault}`,
          borderBottom: `1px solid ${COLORS.lineDefault}`,
          cursor: 'ns-resize',
          position: 'relative',
          userSelect: 'none',
          transition: isResizingPanel ? 'none' : 'background 0.15s ease',
        }}
        onMouseEnter={(e) => { if (!isResizingPanel) e.currentTarget.style.background = COLORS.surfaceHover; }}
        onMouseLeave={(e) => { if (!isResizingPanel) e.currentTarget.style.background = '#F1F5F9'; }}
        title="Drag to resize property panel"
      >
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', gap: '3px', pointerEvents: 'none' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: isResizingPanel ? '#FFFFFF' : COLORS.inkSubtle }} />
          ))}
        </div>
      </div>

      {/* Property Panel */}
      <div className="flex flex-col" style={{ height: `${panelHeight}px`, minHeight: `${MIN_PANEL_HEIGHT}px`, maxHeight: `${MAX_PANEL_HEIGHT}px`, borderTop: `2px solid ${COLORS.brandAccent}`, background: '#FFFFFF' }}>
        {/* Panel header */}
        <div className="flex items-center px-1" style={{ background: '#F1F5F9', borderBottom: `1px solid ${COLORS.lineDefault}`, flexShrink: 0 }}>
          <span className="text-[11px] font-bold px-2 py-1.5" style={{ color: COLORS.heading, fontFamily: COLORS.fonts.heading }}>Object Properties</span>
          {selectedForHeader && (
            <span className="text-[10px] px-2" style={{ color: COLORS.inkMuted }}>
              — {selectedIds.length > 1 ? `${selectedIds.length} objects selected` : `${selectedForHeader.type} (${selectedForHeader.id?.slice(-6)})`}
            </span>
          )}
          {/* Auto-save indicator */}
          {autoSaving && (
            <span className="text-[10px] px-2 ml-2" style={{ color: COLORS.brandAccent }}>
              💾 Auto-saving…
            </span>
          )}
          {currentScreen && !autoSaving && hasUnsavedChangesRef.current && (
            <span className="text-[10px] px-2 ml-2" style={{ color: COLORS.warning }}>
              ● Unsaved changes
            </span>
          )}
          <div className="flex-1" />
          {selectedIds.length > 0 && (
            <button onClick={handleDeleteSelected} className="p-1 rounded transition-colors" style={{ color: COLORS.danger }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.dangerLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              title={`Delete ${selectedIds.length} element(s)`}>
              <span className="text-[10px]">✕</span>
            </button>
          )}
        </div>

        {currentScreen?.isTemplate && (
          <span style={{
            marginLeft: '8px', padding: '2px 8px', borderRadius: '4px',
            background: 'rgba(147,51,234,0.15)', color: '#9333EA',
            fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em',
          }}>
            ⚙ TEMPLATE — elements appear on all screens
          </span>
        )}
        {currentScreen?.isPopup && (
          <span style={{
            marginLeft: '8px', padding: '2px 8px', borderRadius: '4px',
            background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
            fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em',
          }}>
            🪟 POPUP {currentScreen.width}×{currentScreen.height}
          </span>
        )}

        {/* Tab bar */}
        <div className="flex" style={{ background: '#F8FAFC', borderBottom: `1px solid ${COLORS.lineDefault}`, flexShrink: 0 }}>
          {[
            { id: 'properties', label: 'Properties' },
            { id: 'events', label: 'Events' },
            { id: 'texts', label: 'Texts' },
            { id: 'animation', label: 'Animation' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="px-4 py-1.5 text-[11px] font-medium transition-colors"
                style={{
                  borderBottom: `2px solid ${isActive ? COLORS.brandAccent : 'transparent'}`,
                  color: isActive ? COLORS.brandAccent : COLORS.inkMuted,
                  background: isActive ? '#FFFFFF' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = COLORS.heading; e.currentTarget.style.background = 'rgba(255,255,255,0.5)'; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = COLORS.inkMuted; e.currentTarget.style.background = 'transparent'; } }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          {activeTab === 'properties' && (
            <div className="flex h-full overflow-hidden">
              <PropertyTree
                elementType={selectedElement?.type}
                activeCategory={activePropertyCategory}
                onCategoryChange={setActivePropertyCategory}
                multiSelectCount={selectedIds.length > 1 ? selectedIds.length : 0}
              />
              <div className="flex-1 overflow-auto min-h-0">
                <PropertyTable
                  element={selectedElement}
                  activeCategory={activePropertyCategory}
                  tags={tags}
                  onUpdate={handleUpdateElement}
                  onOpenTagBinding={(key, label) => handleOpenBinding(key, label, getPropertyType(key))}
                  selectedElements={selectedElements}
                  onUpdateMultiple={handleUpdateMultiple}
                />
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="h-full overflow-hidden">
              <EventsTab
                element={selectedElement}
                tags={tags}
                screens={screens}
                onUpdate={handleUpdateElement}
              />
            </div>
          )}

          {activeTab === 'texts' && (
            <div className="flex-1 flex items-center justify-center h-full" style={{ background: '#FFFFFF' }}>
              <p className="text-[11px] italic" style={{ color: COLORS.inkSubtle }}>Text properties will be here</p>
            </div>
          )}

          {activeTab === 'animation' && (
            <div className="h-full overflow-auto">
              <AnimationTab
                element={selectedElement}
                tags={tags}
                onUpdate={handleUpdateElement}
              />
            </div>
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
        selectedCount={selectedIds.length}
        connected={socketConnected}
        showGrid={showGrid}
        rotationAngle={rotationAngle}
      />

      {/* Save Modal */}
      <Modal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} title="Save Screen As" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: COLORS.heading }}>Screen Name</label>
            <input type="text" value={screenName} onChange={(e) => setScreenName(e.target.value)}
              placeholder="e.g. Main Dashboard" autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveAs()}
              className="w-full px-4 py-2.5 rounded-lg outline-none transition-all"
              style={{ background: '#F8FAFC', border: `1px solid ${COLORS.lineDefault}`, color: COLORS.heading }}
              onFocus={(e) => { e.target.style.borderColor = COLORS.brandAccent; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.lineDefault; }} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowSaveModal(false)} className="flex-1 px-4 py-2.5 rounded-lg font-medium"
              style={{ background: '#F1F5F9', color: COLORS.heading, border: `1px solid ${COLORS.lineDefault}` }}>Cancel</button>
            <button onClick={handleSaveAs} className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white"
              style={{ background: COLORS.btnPrimary }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.btnHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.btnPrimary; }}>Save</button>
          </div>
        </div>
      </Modal>

      {/* Load Modal */}
      <Modal isOpen={showLoadModal} onClose={() => setShowLoadModal(false)} title="Load Screen" size="md">
        {screens.length === 0 ? (
          <div className="text-center py-8"><p style={{ color: COLORS.inkMuted }}>No saved screens yet</p></div>
        ) : (
          <div className="space-y-2">
            {screens.map((s) => (
              <button key={s._id} onClick={() => { handleLoadScreen(s); setShowLoadModal(false); }}
                className="w-full p-3 rounded-lg text-left transition-all"
                style={{ background: '#F8FAFC', border: `1px solid ${COLORS.lineDefault}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surfaceHover; e.currentTarget.style.borderColor = COLORS.brandAccent; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = COLORS.lineDefault; }}>
                <div className="flex items-center gap-2">
                  <p className="font-semibold" style={{ color: COLORS.heading }}>{s.screenName}</p>
                  {s.isStartupScreen && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded"
                      style={{ background: '#FEF3C7', color: '#92400E' }}>⭐ STARTUP</span>
                  )}
                </div>
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
        onSave={(newConnections) => { setDirectConnections(newConnections); scheduleAutoSave(); }}
      />
    </div>
  );
};

export default GraphicDesigner;