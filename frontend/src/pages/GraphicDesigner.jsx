// ═══════════════════════════════════════════════════════════
// GraphicDesigner — Round 7 Enhancements
//
// Task Bundle applied:
//   ✅ T033  — Duplicate element (Ctrl+D)
//   ✅ T035  — Multi-select (Shift+Click, Ctrl+A) with array-based selectedIds
//   ✅ T036  — Group/Ungroup (Ctrl+G / Ctrl+Shift+G) — logical groups via groupId
//   ✅ T037  — Align tools (6 directions, smart: 1=canvas, 2+=first)
//   ✅ T038  — Z-order: Bring Forward/Backward + to Front/Back
//   ✅ BONUS — Resizable property panel (drag handle, localStorage persistence)
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

// ─── LocalStorage key for panel height ───
const LS_PANEL_HEIGHT = 'onlinescada.designer.panelHeight';
const MIN_PANEL_HEIGHT = 150;
const MAX_PANEL_HEIGHT = 600;
const DEFAULT_PANEL_HEIGHT = 280;

const GraphicDesigner = () => {
  const { showToast } = useToast();

  // ─── State ──────────────────────────────────────────────
  const [elements, setElements] = useState([]);

  // ✅ T035: Multi-select — array of IDs instead of single ID
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
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [activePropertyCategory, setActivePropertyCategory] = useState('geometry');
  const [activeTab, setActiveTab] = useState('properties');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [socketConnected, setSocketConnected] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(null);

  // ─── Defaults from Settings ───
  const [defaultCanvasSettings, setDefaultCanvasSettings] = useState({
    width: 1200,
    height: 700,
    bg: '#ffffff',
    gridSize: 10,
    showGrid: true,
  });

  // ─── Undo/Redo ───
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // ─── Clipboard ───
  const [clipboard, setClipboard] = useState(null);

  // ─── Binding Dialog ───
  const [bindingDialogOpen, setBindingDialogOpen] = useState(false);
  const [bindingContext, setBindingContext] = useState({
    propertyKey: '',
    propertyLabel: '',
    propertyType: 'text',
  });

  // ─── Direct Connections ───
  const [directConnections, setDirectConnections] = useState([]);
  const [connectionsDialogOpen, setConnectionsDialogOpen] = useState(false);

  // ─── BONUS: Resizable Property Panel ───
  const [panelHeight, setPanelHeight] = useState(() => {
    const stored = localStorage.getItem(LS_PANEL_HEIGHT);
    const parsed = parseInt(stored);
    return isNaN(parsed) ? DEFAULT_PANEL_HEIGHT : Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, parsed));
  });
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  const navigate = useNavigate();

  // ─── Derived: single selected element (for property panel when 1 selected) ───
  const selectedElement = selectedIds.length === 1
    ? elements.find((el) => el.id === selectedIds[0])
    : null;

  const selectedElements = elements.filter(el => selectedIds.includes(el.id));

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
  }, [selectedIds]);

  // ═══════════════════════════════════════════════════════════
  // BONUS: Panel resize drag handler
  // ═══════════════════════════════════════════════════════════
  const handlePanelResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizingPanel(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = panelHeight;
  }, [panelHeight]);

  useEffect(() => {
    if (!isResizingPanel) return;

    const handleMouseMove = (e) => {
      // Delta is INVERTED — dragging up increases panel height
      const delta = resizeStartY.current - e.clientY;
      const newHeight = Math.max(
        MIN_PANEL_HEIGHT,
        Math.min(MAX_PANEL_HEIGHT, resizeStartHeight.current + delta)
      );
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingPanel(false);
      // Persist
      localStorage.setItem(LS_PANEL_HEIGHT, String(panelHeight));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection while dragging
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

  // ─── Load canvas defaults from Settings ───
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
        console.warn('Could not load canvas defaults from Settings:', err.message);
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

  // ═══════════════════════════════════════════════════════════
  // ✅ T035: Multi-select handlers
  // ═══════════════════════════════════════════════════════════
  const handleSelect = useCallback((id, shiftKey = false) => {
    if (id === null) {
      // Deselect all
      setSelectedIds([]);
      return;
    }

    // ✅ T036: If element is part of a group, select ALL group members
    const element = elements.find(el => el.id === id);
    let idsToSelect = [id];

    if (element?.groupId) {
      // Select all members of the same group
      idsToSelect = elements
        .filter(el => el.groupId === element.groupId)
        .map(el => el.id);
    }

    setSelectedIds(prev => {
      if (shiftKey) {
        // Toggle: if already selected, remove; else add
        const alreadySelected = idsToSelect.every(id => prev.includes(id));
        if (alreadySelected) {
          return prev.filter(existingId => !idsToSelect.includes(existingId));
        } else {
          return [...new Set([...prev, ...idsToSelect])];
        }
      } else {
        // Replace selection
        return idsToSelect;
      }
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
    setElements((prev) => [...prev, { ...newElement, id }]);
    setSelectedIds([id]);
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
    setSelectedIds([id]);
  }, [pushUndo, canvasWidth, canvasHeight]);

  const handleUpdateElement = useCallback((id, updates) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  }, []);

  // ✅ Multi-update: apply same updates to all selected elements
  const handleUpdateMultiple = useCallback((updates) => {
    setElements(prev =>
      prev.map(el => selectedIds.includes(el.id) ? { ...el, ...updates } : el)
    );
  }, [selectedIds]);

  const handleDeleteElement = useCallback((id) => {
    pushUndo();
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedIds(prev => prev.filter(sid => sid !== id));
  }, [pushUndo]);

  // ✅ Delete all selected
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushUndo();
    setElements(prev => prev.filter(el => !selectedIds.includes(el.id)));
    const count = selectedIds.length;
    setSelectedIds([]);
    showToast(`Deleted ${count} element${count > 1 ? 's' : ''}`, 'success', 1500);
  }, [selectedIds, pushUndo, showToast]);

  // ═══════════════════════════════════════════════════════════
  // ✅ T033: Duplicate (Ctrl+D)
  // ═══════════════════════════════════════════════════════════
  const handleDuplicate = useCallback(() => {
    if (selectedIds.length === 0) {
      showToast('Select an element to duplicate', 'warning', 1500);
      return;
    }

    pushUndo();
    const idMap = new Map(); // oldId → newId (for preserving groupId)
    const newElements = selectedElements.map(el => {
      const newId = `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      idMap.set(el.id, newId);
      return {
        ...JSON.parse(JSON.stringify(el)), // deep clone
        id: newId,
        x: (el.x || 0) + 20,
        y: (el.y || 0) + 20,
      };
    });

    // ✅ If duplicating a group, preserve group relationship with NEW groupId
    const oldGroupIds = new Set(selectedElements.map(el => el.groupId).filter(Boolean));
    if (oldGroupIds.size > 0) {
      const groupIdMap = new Map();
      oldGroupIds.forEach(oldGid => {
        groupIdMap.set(oldGid, `grp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
      });
      newElements.forEach(el => {
        if (el.groupId && groupIdMap.has(el.groupId)) {
          el.groupId = groupIdMap.get(el.groupId);
        }
      });
    }

    setElements(prev => [...prev, ...newElements]);
    setSelectedIds(newElements.map(e => e.id));
    showToast(`Duplicated ${newElements.length} element${newElements.length > 1 ? 's' : ''}`, 'success', 1500);
  }, [selectedIds, selectedElements, pushUndo, showToast]);

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
      x: (el.x || 0) + 20,
      y: (el.y || 0) + 20,
    }));
    setElements(prev => [...prev, ...newElements]);
    setSelectedIds(newElements.map(e => e.id));
  }, [clipboard, pushUndo]);

  // ═══════════════════════════════════════════════════════════
  // ✅ T036: Group / Ungroup
  // ═══════════════════════════════════════════════════════════
  const handleGroup = useCallback(() => {
    if (selectedIds.length < 2) {
      showToast('Select 2 or more elements to group', 'warning', 2000);
      return;
    }

    pushUndo();
    const groupId = `grp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    setElements(prev =>
      prev.map(el => selectedIds.includes(el.id) ? { ...el, groupId } : el)
    );

    showToast(`Grouped ${selectedIds.length} elements`, 'success', 1500);
  }, [selectedIds, pushUndo, showToast]);

  const handleUngroup = useCallback(() => {
    const groupedSelected = selectedElements.filter(el => el.groupId);
    if (groupedSelected.length === 0) {
      showToast('No grouped elements selected', 'warning', 2000);
      return;
    }

    pushUndo();
    const groupIdsToRemove = new Set(groupedSelected.map(el => el.groupId));

    setElements(prev =>
      prev.map(el => {
        if (el.groupId && groupIdsToRemove.has(el.groupId)) {
          const { groupId, ...rest } = el;
          return rest;
        }
        return el;
      })
    );

    showToast('Ungrouped', 'success', 1500);
  }, [selectedElements, pushUndo, showToast]);

  // ═══════════════════════════════════════════════════════════
  // ✅ T037: Align Tools
  // ═══════════════════════════════════════════════════════════
  const handleAlign = useCallback((direction) => {
    if (selectedIds.length === 0) return;

    pushUndo();

    // Reference: canvas if 1 selected, first selected if 2+
    let refX, refY, refWidth, refHeight;

    if (selectedIds.length === 1) {
      // Align to canvas
      refX = 0;
      refY = 0;
      refWidth = canvasWidth;
      refHeight = canvasHeight;
    } else {
      // Align to first selected
      const first = elements.find(el => el.id === selectedIds[0]);
      refX = first.x;
      refY = first.y;
      refWidth = first.width;
      refHeight = first.height;
    }

    setElements(prev => prev.map(el => {
      if (!selectedIds.includes(el.id)) return el;
      // Skip the reference element itself when 2+ selected
      if (selectedIds.length > 1 && el.id === selectedIds[0]) return el;

      const updates = {};
      switch (direction) {
        case 'left':
          updates.x = refX;
          break;
        case 'centerH':
          updates.x = refX + (refWidth - el.width) / 2;
          break;
        case 'right':
          updates.x = refX + refWidth - el.width;
          break;
        case 'top':
          updates.y = refY;
          break;
        case 'centerV':
          updates.y = refY + (refHeight - el.height) / 2;
          break;
        case 'bottom':
          updates.y = refY + refHeight - el.height;
          break;
        default:
          return el;
      }
      return { ...el, ...updates };
    }));

    const dirLabel = {
      left: 'Left', centerH: 'Center Horizontally', right: 'Right',
      top: 'Top', centerV: 'Center Vertically', bottom: 'Bottom',
    }[direction];
    showToast(`Aligned ${dirLabel}`, 'success', 1500);
  }, [selectedIds, elements, canvasWidth, canvasHeight, pushUndo, showToast]);

  // ─── Distribute (bonus) — requires 3+ selected ───
  const handleDistribute = useCallback((axis) => {
    if (selectedIds.length < 3) {
      showToast('Select 3+ elements to distribute', 'warning', 2000);
      return;
    }

    pushUndo();

    // Get selected elements, sort by position on axis
    const sels = selectedElements
      .slice()
      .sort((a, b) => (axis === 'horizontal' ? a.x - b.x : a.y - b.y));

    const first = sels[0];
    const last = sels[sels.length - 1];

    if (axis === 'horizontal') {
      const totalSpace = (last.x + last.width) - first.x;
      const totalObjWidth = sels.reduce((sum, el) => sum + el.width, 0);
      const gap = (totalSpace - totalObjWidth) / (sels.length - 1);

      let currentX = first.x + first.width + gap;
      const updates = new Map();
      for (let i = 1; i < sels.length - 1; i++) {
        updates.set(sels[i].id, { x: currentX });
        currentX += sels[i].width + gap;
      }
      setElements(prev => prev.map(el => updates.has(el.id) ? { ...el, ...updates.get(el.id) } : el));
    } else {
      const totalSpace = (last.y + last.height) - first.y;
      const totalObjHeight = sels.reduce((sum, el) => sum + el.height, 0);
      const gap = (totalSpace - totalObjHeight) / (sels.length - 1);

      let currentY = first.y + first.height + gap;
      const updates = new Map();
      for (let i = 1; i < sels.length - 1; i++) {
        updates.set(sels[i].id, { y: currentY });
        currentY += sels[i].height + gap;
      }
      setElements(prev => prev.map(el => updates.has(el.id) ? { ...el, ...updates.get(el.id) } : el));
    }

    showToast(`Distributed ${axis === 'horizontal' ? 'horizontally' : 'vertically'}`, 'success', 1500);
  }, [selectedIds, selectedElements, pushUndo, showToast]);

  // ═══════════════════════════════════════════════════════════
  // ✅ T038: Z-Order (Bring Forward / Send Backward / Front / Back)
  // ═══════════════════════════════════════════════════════════
  const handleZOrder = useCallback((operation) => {
    if (selectedIds.length === 0) return;

    pushUndo();

    setElements(prev => {
      // Separate selected from unselected, but preserve original order
      const selected = prev.filter(el => selectedIds.includes(el.id));
      const unselected = prev.filter(el => !selectedIds.includes(el.id));

      switch (operation) {
        case 'front':
          // Selected go to end (top of stack)
          return [...unselected, ...selected];

        case 'back':
          // Selected go to start (bottom of stack)
          return [...selected, ...unselected];

        case 'forward': {
          // Move each selected element one position forward
          const result = [...prev];
          // Process from top to bottom to avoid index issues
          for (let i = result.length - 1; i >= 0; i--) {
            if (selectedIds.includes(result[i].id) && i < result.length - 1) {
              // Only swap if the next element is not also selected
              if (!selectedIds.includes(result[i + 1].id)) {
                [result[i], result[i + 1]] = [result[i + 1], result[i]];
              }
            }
          }
          return result;
        }

        case 'backward': {
          const result = [...prev];
          for (let i = 0; i < result.length; i++) {
            if (selectedIds.includes(result[i].id) && i > 0) {
              if (!selectedIds.includes(result[i - 1].id)) {
                [result[i], result[i - 1]] = [result[i - 1], result[i]];
              }
            }
          }
          return result;
        }

        default:
          return prev;
      }
    });

    const opLabel = { front: 'to Front', back: 'to Back', forward: 'Forward', backward: 'Backward' }[operation];
    showToast(`Sent ${opLabel}`, 'success', 1500);
  }, [selectedIds, pushUndo, showToast]);

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
      } finally { setSaving(false); }
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
    } finally { setSaving(false); }
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

  // ─── Keyboard Shortcuts ─────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if (e.ctrlKey || e.metaKey) {
        // Shift combinations first
        if (e.shiftKey) {
          switch (e.key.toLowerCase()) {
            case 'g':
              e.preventDefault();
              handleUngroup();
              return;
            case 'arrowup':
              e.preventDefault();
              handleZOrder('front');
              return;
            case 'arrowdown':
              e.preventDefault();
              handleZOrder('back');
              return;
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
          case 'd': e.preventDefault(); handleDuplicate(); break;         // ✅ T033
          case 'a': e.preventDefault(); handleSelectAll(); break;         // ✅ T035
          case 'g': e.preventDefault(); handleGroup(); break;              // ✅ T036
        }
      }

      // Z-order without ctrl
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
  }, [handleUndo, handleRedo, handleCopy, handleCut, handlePaste, handleSave, handleNewScreen,
      handleDeleteSelected, handleDuplicate, handleSelectAll, handleGroup, handleUngroup, handleZOrder,
      selectedIds]);

  // ─── Selected element for property panel header ───
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
        // ✅ Round 7 additions
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
              setElements(prev => prev.map(el =>
                idsToUpdate.includes(el.id) ? { ...el, ...updates } : el
              ));
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

      {/* ═══════════ BONUS: RESIZE HANDLE ═══════════ */}
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
        {/* Visual handle indicator (3 dots) */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            gap: '3px',
            pointerEvents: 'none',
          }}
        >
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: '3px',
                height: '3px',
                borderRadius: '50%',
                background: isResizingPanel ? '#FFFFFF' : COLORS.inkSubtle,
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom: Property Panel */}
      <div
        className="flex flex-col"
        style={{
          height: `${panelHeight}px`,
          minHeight: `${MIN_PANEL_HEIGHT}px`,
          maxHeight: `${MAX_PANEL_HEIGHT}px`,
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
          {selectedForHeader && (
            <span className="text-[10px] px-2" style={{ color: COLORS.inkMuted }}>
              — {selectedIds.length > 1
                ? `${selectedIds.length} objects selected`
                : `${selectedForHeader.type} (${selectedForHeader.id?.slice(-6)})`}
            </span>
          )}
          <div className="flex-1" />
          {selectedIds.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="p-1 rounded transition-colors"
              style={{ color: COLORS.danger }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.dangerLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              title={`Delete ${selectedIds.length} element(s)`}
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
                multiSelectCount={selectedIds.length > 1 ? selectedIds.length : 0}
              />
              <PropertyTable
                element={selectedElement}
                activeCategory={activePropertyCategory}
                tags={tags}
                onUpdate={handleUpdateElement}
                onOpenTagBinding={(key, label) => {
                  handleOpenBinding(key, label, getPropertyType(key));
                }}
                // ✅ Multi-select support
                selectedElements={selectedElements}
                onUpdateMultiple={handleUpdateMultiple}
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
        selectedCount={selectedIds.length}
        connected={socketConnected}
        showGrid={showGrid}
        rotationAngle={rotationAngle}
      />

      {/* Save Modal */}
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

      {/* Load Modal */}
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