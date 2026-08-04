import { useState } from 'react';
import {
  FileText, FolderOpen, Save, Printer, Undo2, Redo2,
  Scissors, Copy, Clipboard, Trash2, ZoomIn, ZoomOut,
  Grid3X3, Play, Settings, HelpCircle, Info,
  AlignLeft, AlignCenter, AlignRight, ArrowUp, ArrowDown,
  Layers,
} from 'lucide-react';
import COLORS from '../../theme/colors';

const MenuBar = ({
  onNew, onOpen, onSave, onSaveAs, onRun,
  onUndo, onRedo, canUndo, canRedo,
  onCut, onCopy, onPaste, onDelete,
  onSelectAll, onDeselectAll,
  onZoomIn, onZoomOut, onZoomReset,
  onToggleGrid, showGrid,
  currentScreen,
}) => {
  const [activeMenu, setActiveMenu] = useState(null);

  const closeMenu = () => setActiveMenu(null);

  const menus = {
    file: {
      label: 'File',
      items: [
        { label: 'New Screen', icon: FileText, shortcut: 'Ctrl+N', action: () => { onNew?.(); closeMenu(); }},
        { label: 'Open Screen...', icon: FolderOpen, shortcut: 'Ctrl+O', action: () => { onOpen?.(); closeMenu(); }},
        { divider: true },
        { label: 'Save', icon: Save, shortcut: 'Ctrl+S', action: () => { onSave?.(); closeMenu(); }},
        { label: 'Save As...', icon: Save, shortcut: 'Ctrl+Shift+S', action: () => { onSaveAs?.(); closeMenu(); }},
        { divider: true },
        { label: 'Print...', icon: Printer, shortcut: 'Ctrl+P', disabled: true },
      ],
    },
    edit: {
      label: 'Edit',
      items: [
        { label: 'Undo', icon: Undo2, shortcut: 'Ctrl+Z', action: () => { onUndo?.(); closeMenu(); }, disabled: !canUndo },
        { label: 'Redo', icon: Redo2, shortcut: 'Ctrl+Y', action: () => { onRedo?.(); closeMenu(); }, disabled: !canRedo },
        { divider: true },
        { label: 'Cut', icon: Scissors, shortcut: 'Ctrl+X', action: () => { onCut?.(); closeMenu(); }},
        { label: 'Copy', icon: Copy, shortcut: 'Ctrl+C', action: () => { onCopy?.(); closeMenu(); }},
        { label: 'Paste', icon: Clipboard, shortcut: 'Ctrl+V', action: () => { onPaste?.(); closeMenu(); }},
        { label: 'Delete', icon: Trash2, shortcut: 'Del', action: () => { onDelete?.(); closeMenu(); }},
        { divider: true },
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => { onSelectAll?.(); closeMenu(); }},
        { label: 'Deselect All', shortcut: 'Esc', action: () => { onDeselectAll?.(); closeMenu(); }},
      ],
    },
    view: {
      label: 'View',
      items: [
        { label: 'Zoom In', icon: ZoomIn, shortcut: 'Ctrl++', action: () => { onZoomIn?.(); closeMenu(); }},
        { label: 'Zoom Out', icon: ZoomOut, shortcut: 'Ctrl+-', action: () => { onZoomOut?.(); closeMenu(); }},
        { label: 'Zoom 100%', shortcut: 'Ctrl+0', action: () => { onZoomReset?.(); closeMenu(); }},
        { divider: true },
        { label: showGrid ? '✓ Show Grid' : '  Show Grid', icon: Grid3X3, action: () => { onToggleGrid?.(); closeMenu(); }},
      ],
    },
    arrange: {
      label: 'Arrange',
      items: [
        { label: 'Bring to Front', icon: ArrowUp, shortcut: 'Ctrl+Shift+↑', disabled: true },
        { label: 'Send to Back', icon: ArrowDown, shortcut: 'Ctrl+Shift+↓', disabled: true },
        { divider: true },
        { label: 'Align Left', icon: AlignLeft, disabled: true },
        { label: 'Align Center', icon: AlignCenter, disabled: true },
        { label: 'Align Right', icon: AlignRight, disabled: true },
        { divider: true },
        { label: 'Group', icon: Layers, shortcut: 'Ctrl+G', disabled: true },
        { label: 'Ungroup', icon: Layers, shortcut: 'Ctrl+Shift+G', disabled: true },
      ],
    },
    tools: {
      label: 'Tools',
      items: [
        { label: 'Run Screen', icon: Play, shortcut: 'F5', action: () => { onRun?.(); closeMenu(); }},
        { divider: true },
        { label: 'Settings...', icon: Settings, disabled: true },
      ],
    },
    help: {
      label: 'Help',
      items: [
        { label: 'Documentation', icon: HelpCircle, disabled: true },
        { label: 'About OnlineSCADA', icon: Info, disabled: true },
      ],
    },
  };

  return (
    <>
      {/* Backdrop to close menu */}
      {activeMenu && (
        <div className="fixed inset-0 z-40" onClick={closeMenu} />
      )}

      <div
        className="flex items-center h-7 px-1 select-none text-xs"
        style={{
          background: COLORS.btnPrimary,
          borderBottom: `1px solid ${COLORS.brandPrimary}`,
        }}
      >
        {Object.entries(menus).map(([key, menu]) => {
          const isOpen = activeMenu === key;
          return (
            <div key={key} className="relative">
              <button
                className="px-3 py-1 rounded-sm transition-all font-medium"
                style={{
                  background: isOpen ? COLORS.brandAccent : 'transparent',
                  color: isOpen ? '#FFFFFF' : '#DBEAFE',
                }}
                onClick={() => setActiveMenu(isOpen ? null : key)}
                onMouseEnter={(e) => {
                  if (!isOpen) {
                    if (activeMenu) setActiveMenu(key);
                    else e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isOpen) e.currentTarget.style.background = 'transparent';
                }}
              >
                {menu.label}
              </button>

              {/* Dropdown */}
              {isOpen && (
                <div
                  className="absolute top-full left-0 mt-0.5 w-56 rounded-md z-50 py-1"
                  style={{
                    background: '#FFFFFF',
                    border: `1px solid ${COLORS.lineDefault}`,
                    boxShadow: '0px 8px 24px rgba(8, 27, 67, 0.15)',
                  }}
                >
                  {menu.items.map((item, idx) =>
                    item.divider ? (
                      <div
                        key={idx}
                        className="h-px mx-2 my-1"
                        style={{ background: COLORS.lineDefault }}
                      />
                    ) : (
                      <button
                        key={idx}
                        onClick={item.action}
                        disabled={item.disabled}
                        className="w-full flex items-center gap-3 px-3 py-1.5 text-left text-xs transition-colors"
                        style={{
                          color: item.disabled ? COLORS.inkSubtle : COLORS.heading,
                          cursor: item.disabled ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          if (!item.disabled) {
                            e.currentTarget.style.background = COLORS.surfaceHover;
                            e.currentTarget.style.color = COLORS.brandAccent;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!item.disabled) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = COLORS.heading;
                          }
                        }}
                      >
                        {item.icon && <item.icon size={14} className="shrink-0" />}
                        {!item.icon && <span className="w-[14px]" />}
                        <span className="flex-1">{item.label}</span>
                        {item.shortcut && (
                          <span
                            className="text-[10px] ml-4 font-mono"
                            style={{ color: item.disabled ? COLORS.inkSubtle : COLORS.inkMuted }}
                          >
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Screen name indicator */}
        <div className="ml-auto flex items-center gap-2 pr-2">
          {currentScreen && (
            <span
              className="text-[10px] font-mono"
              style={{ color: '#B7C3D6' }}
            >
              {currentScreen.screenName}.pdl
            </span>
          )}
        </div>
      </div>
    </>
  );
};

export default MenuBar;