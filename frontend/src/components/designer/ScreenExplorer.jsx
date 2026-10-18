// ═══════════════════════════════════════════════════════════
// ScreenExplorer — FIXED:
//   ✅ No nested <button> inside <button> (GroupHeader uses div)
//   ✅ All 4 groups: Process Pictures / Template / Popups / My Screens
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import {
  FolderOpen, FileText, ChevronRight, ChevronDown,
  RefreshCw, Star, Trash2, MoreVertical, Home,
  LineChart, BellRing, History, Table2, BarChart3, Globe,
  Search, Package, Layout, Layers, Plus,
} from 'lucide-react';

const PROCESS_PICTURES = [
  {
    type: 'trendControl', icon: LineChart, label: 'Trend Chart',
    description: 'Live tag history chart', color: '#2563EB',
    defaults: {
      type: 'trendControl', width: 500, height: 300,
      trendTags: [], trendTimeRange: '5m', trendUpdateInterval: 2000,
      trendShowLegend: true, trendShowGrid: true, trendShowAxis: true,
      trendLineColors: ['#2563EB', '#DC2626', '#16A34A', '#F59E0B', '#9333EA'],
      trendBackgroundColor: '#FFFFFF', trendTextColor: '#334155',
      trendTitle: 'Trend Chart', trendYMin: null, trendYMax: null,
    },
  },
  {
    type: 'alarmControl', icon: BellRing, label: 'Alarm List',
    description: 'Live active alarms', color: '#DC2626',
    defaults: {
      type: 'alarmControl', width: 600, height: 300,
      alarmMaxRows: 50, alarmShowColumns: ['time', 'priority', 'source', 'message'],
      alarmFilterPriority: 'all', alarmRefreshInterval: 2000,
      alarmColorScheme: 'severity', alarmTitle: 'Active Alarms',
      alarmBackgroundColor: '#FFFFFF', alarmHeaderColor: '#081B43', alarmTextColor: '#334155',
    },
  },
  {
    type: 'alarmHistoryControl', icon: History, label: 'Alarm History',
    description: 'Historical alarm log', color: '#9333EA',
    defaults: {
      type: 'alarmHistoryControl', width: 600, height: 300,
      alarmHistMaxRows: 100, alarmHistTimeRange: '24h',
      alarmHistShowColumns: ['time', 'priority', 'source', 'message', 'acknowledged'],
      alarmHistFilterPriority: 'all', alarmHistTitle: 'Alarm History',
      alarmHistBackgroundColor: '#FFFFFF', alarmHistHeaderColor: '#081B43', alarmHistTextColor: '#334155',
    },
  },
  {
    type: 'tableControl', icon: Table2, label: 'Data Table',
    description: 'Tag values in table format', color: '#0891B2',
    defaults: {
      type: 'tableControl', width: 400, height: 250,
      tableColumns: [{ header: 'Tag', field: 'tagName' }, { header: 'Value', field: 'value' }, { header: 'Unit', field: 'unit' }],
      tableTags: [], tableRefreshInterval: 1000, tableTitle: 'Data Table',
      tableShowHeader: true, tableAlternateRows: true,
      tableBackgroundColor: '#FFFFFF', tableHeaderColor: '#081B43',
      tableTextColor: '#334155', tableBorderColor: '#E5E7EB',
    },
  },
  {
    type: 'barChartControl', icon: BarChart3, label: 'Bar Chart',
    description: 'Compare multiple tags', color: '#16A34A',
    defaults: {
      type: 'barChartControl', width: 400, height: 300,
      barChartTags: [], barChartOrientation: 'vertical',
      barChartShowValues: true, barChartShowLegend: false,
      barChartColors: ['#2563EB', '#DC2626', '#16A34A', '#F59E0B'],
      barChartRefreshInterval: 1000, barChartTitle: 'Bar Chart',
      barChartBackgroundColor: '#FFFFFF', barChartTextColor: '#334155',
      barChartYMin: 0, barChartYMax: 100,
    },
  },
  {
    type: 'webFrameControl', icon: Globe, label: 'Web Frame',
    description: 'Embedded webpage', color: '#EA580C',
    defaults: {
      type: 'webFrameControl', width: 500, height: 350,
      webUrl: 'https://www.example.com', webShowBorder: true,
      webBorderColor: '#E5E7EB', webTitle: 'Web Frame',
    },
  },
];

const ScreenExplorer = ({
  screens,
  onLoadScreen,
  currentScreen,
  onRefresh,
  onDeleteScreen,
  onSetStartupScreen,
  onAddElement,
  onCreatePopup,
  onCreateTemplate,
}) => {
  const [expanded, setExpanded] = useState({ pictures: true, template: true, popups: true, screens: true });
  const [filter, setFilter] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const templateScreen = screens.find(s => s.isTemplate === true);
  const popupScreens   = screens.filter(s => s.isPopup === true);
  const regularScreens = screens.filter(s => !s.isTemplate && !s.isPopup);

  const filteredRegular  = regularScreens.filter(s => s.screenName.toLowerCase().includes(filter.toLowerCase()));
  const filteredPopups   = popupScreens.filter(s => s.screenName.toLowerCase().includes(filter.toLowerCase()));
  const filteredPictures = PROCESS_PICTURES.filter(p =>
    p.label.toLowerCase().includes(filter.toLowerCase()) ||
    p.description.toLowerCase().includes(filter.toLowerCase())
  );

  const handleContextMenu = (e, screen) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ screen, x: e.clientX, y: e.clientY });
  };
  const closeContextMenu = () => setContextMenu(null);
  const handleDeleteConfirm = (screen) => { setConfirmDeleteId(screen._id); closeContextMenu(); };
  const handleDeleteExecute = () => {
    const screen = screens.find(s => s._id === confirmDeleteId);
    if (screen && onDeleteScreen) onDeleteScreen(screen);
    setConfirmDeleteId(null);
  };
  const handleAddPicture = (picture) => { if (onAddElement) onAddElement({ ...picture.defaults }); };

  return (
    <>
      <div
        style={{ width: '224px', height: '100%', display: 'flex', flexDirection: 'column', userSelect: 'none', background: '#FFFFFF', borderLeft: '1px solid #E5E7EB' }}
        onClick={closeContextMenu}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#081B43', fontFamily: "'Montserrat', sans-serif" }}>Explorer</span>
          <button onClick={onRefresh}
            style={{ padding: '4px', borderRadius: '4px', background: 'transparent', color: '#5F6B7A', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF6FF'; e.currentTarget.style.color = '#2563EB'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5F6B7A'; }}
            title="Refresh">
            <RefreshCw size={12} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '6px 8px', borderBottom: '1px solid #E5E7EB', position: 'relative' }}>
          <Search size={11} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
          <input type="text" placeholder="Filter..." value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: '100%', padding: '4px 8px 4px 22px', fontSize: '11px', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: '4px', outline: 'none', color: '#081B43' }}
            onFocus={(e) => { e.target.style.borderColor = '#2563EB'; }}
            onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }} />
        </div>

        {/* Tree */}
        <div style={{ flex: 1, overflowY: 'auto', fontSize: '11px' }}>

          {/* ─── PROCESS PICTURES ─── */}
          <GroupHeader
            expanded={expanded.pictures}
            onToggle={() => toggle('pictures')}
            icon={<Package size={11} style={{ color: '#EA580C' }} />}
            label="Process Pictures"
            count={filteredPictures.length}
          />
          {expanded.pictures && (
            <div style={{ paddingTop: '2px', paddingBottom: '4px' }}>
              {filteredPictures.length === 0
                ? <EmptyRow text="No matches" />
                : filteredPictures.map((p) => (
                  <ProcessPictureItem key={p.type} picture={p} onClick={() => handleAddPicture(p)} />
                ))}
            </div>
          )}

          {/* ─── TEMPLATE ─── */}
          <GroupHeader
            expanded={expanded.template}
            onToggle={() => toggle('template')}
            icon={<Layers size={11} style={{ color: '#9333EA' }} />}
            label="Template"
            count={templateScreen ? 1 : 0}
            onAction={!templateScreen && onCreateTemplate ? () => onCreateTemplate() : null}
            actionTitle="Create template screen"
            actionColor="#9333EA"
          />
          {expanded.template && (
            <div style={{ paddingTop: '2px', paddingBottom: '4px' }}>
              {!templateScreen ? (
                <div style={{ padding: '6px 12px' }}>
                  <p style={{ fontSize: '10px', color: '#94A3B8', fontStyle: 'italic', margin: 0, lineHeight: 1.4 }}>
                    No template yet. Elements added here appear on all screens automatically.
                  </p>
                </div>
              ) : (
                <ScreenRow
                  screen={templateScreen}
                  isActive={currentScreen?._id === templateScreen._id}
                  color="#9333EA"
                  onLoad={onLoadScreen}
                  onContextMenu={handleContextMenu}
                />
              )}
            </div>
          )}

          {/* ─── POPUP SCREENS ─── */}
          <GroupHeader
            expanded={expanded.popups}
            onToggle={() => toggle('popups')}
            icon={<Layout size={11} style={{ color: '#F59E0B' }} />}
            label="Popup Screens"
            count={filteredPopups.length}
            onAction={onCreatePopup ? () => onCreatePopup() : null}
            actionTitle="Create new popup screen"
            actionColor="#F59E0B"
          />
          {expanded.popups && (
            <div style={{ paddingTop: '2px', paddingBottom: '4px' }}>
              {filteredPopups.length === 0
                ? <EmptyRow text={filter ? 'No match' : 'No popups yet · click + to create'} />
                : filteredPopups.map((p) => (
                  <ScreenRow
                    key={p._id}
                    screen={p}
                    isActive={currentScreen?._id === p._id}
                    color="#F59E0B"
                    onLoad={onLoadScreen}
                    onContextMenu={handleContextMenu}
                  />
                ))}
            </div>
          )}

          {/* ─── MY SCREENS ─── */}
          <GroupHeader
            expanded={expanded.screens}
            onToggle={() => toggle('screens')}
            icon={<FolderOpen size={11} style={{ color: '#2563EB' }} />}
            label="My Screens"
            count={filteredRegular.length}
          />
          {expanded.screens && (
            <div style={{ paddingTop: '2px', paddingBottom: '4px' }}>
              {filteredRegular.length === 0
                ? <EmptyRow text={filter ? 'No match' : 'No screens yet'} />
                : filteredRegular.map((s) => (
                  <ScreenRow
                    key={s._id}
                    screen={s}
                    isActive={currentScreen?._id === s._id}
                    color="#2563EB"
                    onLoad={onLoadScreen}
                    onContextMenu={handleContextMenu}
                  />
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '6px 12px', background: '#F8FAFC', borderTop: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: '9px', color: '#5F6B7A', margin: 0, lineHeight: 1.4 }}>
             Right-click any screen for options
          </p>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={closeContextMenu} />
          <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0px 8px 24px rgba(8,27,67,0.15)', minWidth: '180px', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #E5E7EB', background: '#F8FAFC' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#081B43', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contextMenu.screen.screenName}</p>
              {contextMenu.screen.isTemplate && (<span style={{ fontSize: '9px', color: '#9333EA', fontWeight: 700 }}>TEMPLATE</span>)}
              {contextMenu.screen.isPopup && (<span style={{ fontSize: '9px', color: '#F59E0B', fontWeight: 700 }}>POPUP</span>)}
            </div>
            <ContextMenuItem icon={<FileText size={12} />} label="Open Screen" onClick={() => { onLoadScreen(contextMenu.screen); closeContextMenu(); }} color="#334155" />
            {!contextMenu.screen.isTemplate && !contextMenu.screen.isPopup && (
              <ContextMenuItem icon={<Home size={12} />}
                label={contextMenu.screen.isStartupScreen ? 'Startup Screen ✓' : 'Set as Startup Screen'}
                onClick={() => { onSetStartupScreen(contextMenu.screen); closeContextMenu(); }}
                color={contextMenu.screen.isStartupScreen ? '#16A34A' : '#2563EB'}
                disabled={contextMenu.screen.isStartupScreen} />
            )}
            <div style={{ height: '1px', background: '#E5E7EB', margin: '2px 0' }} />
            <ContextMenuItem icon={<Trash2 size={12} />} label="Delete Screen" onClick={() => handleDeleteConfirm(contextMenu.screen)} color="#DC2626" danger />
          </div>
        </>
      )}

      {/* Delete Confirm */}
      {confirmDeleteId && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10000, background: '#FFFFFF', borderRadius: '12px', padding: '24px', width: '320px', boxShadow: '0px 20px 60px rgba(8,27,67,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={18} style={{ color: '#DC2626' }} />
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#081B43', margin: 0 }}>Delete Screen?</p>
                <p style={{ fontSize: '12px', color: '#5F6B7A', margin: '2px 0 0' }}>"{screens.find(s => s._id === confirmDeleteId)?.screenName}"</p>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#5F6B7A', marginBottom: '20px', lineHeight: 1.5 }}>This will permanently delete the screen and all its elements.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setConfirmDeleteId(null)}
                style={{ flex: 1, padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#F8FAFC', color: '#334155', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleDeleteExecute}
                style={{ flex: 1, padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#B91C1C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#DC2626'; }}>
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

// ✅ FIXED: GroupHeader uses <div> instead of <button> to avoid
// nested <button> inside <button> HTML violation.
// The action (+ button) is rendered as a sibling, not a child.
const GroupHeader = ({ expanded, onToggle, icon, label, count, onAction, actionTitle, actionColor }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      width: '100%',
      background: '#F8FAFC',
      border: 'none',
      borderBottom: '1px solid #E5E7EB',
      borderTop: '1px solid #E5E7EB',
    }}
  >
    {/* Main clickable toggle area */}
    <div
      onClick={onToggle}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 8px',
        cursor: 'pointer',
        color: '#081B43',
        fontFamily: "'Montserrat', sans-serif",
        minWidth: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF6FF'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {expanded
        ? <ChevronDown size={11} style={{ color: '#2563EB', flexShrink: 0 }} />
        : <ChevronRight size={11} style={{ color: '#5F6B7A', flexShrink: 0 }} />}
      {icon}
      <span style={{ flex: 1, textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#081B43', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#5F6B7A', fontWeight: 400, flexShrink: 0 }}>
        {count}
      </span>
    </div>

    {/* ✅ Action button is a SIBLING of the toggle div, not inside a button */}
    {onAction && (
      <button
        onClick={(e) => { e.stopPropagation(); onAction(); }}
        title={actionTitle}
        style={{
          padding: '4px 6px',
          borderRadius: '3px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: actionColor || '#2563EB',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          marginRight: '4px',
        }}
         onMouseEnter={(e) => { e.currentTarget.style.background = actionColor ? `${actionColor}22` : '#EEF6FF'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <Plus size={11} />
      </button>
    )}
  </div>
);

const EmptyRow = ({ text }) => (
  <p style={{ padding: '8px 16px', fontSize: '10px', color: '#94A3B8', fontStyle: 'italic', margin: 0 }}>{text}</p>
);

const ScreenRow = ({ screen, isActive, color, onLoad, onContextMenu }) => {
  const badge = screen.isTemplate ? 'T' : screen.isPopup ? 'P' : null;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '2px', paddingRight: '4px', paddingLeft: '4px' }}>
      <button
        onClick={() => onLoad(screen)}
        onContextMenu={(e) => onContextMenu(e, screen)}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '6px',
          padding: '4px 8px', borderRadius: '4px',
          background: isActive ? color : 'transparent',
          color: isActive ? '#FFFFFF' : '#334155',
          border: 'none', cursor: 'pointer', fontSize: '11px',
          fontWeight: isActive ? 600 : 500, textAlign: 'left', minWidth: 0,
        }}
        onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = '#EEF6FF'; e.currentTarget.style.color = color; } }}
        onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#334155'; } }}
        title={`${screen.screenName} — right-click for options`}>
        {badge ? <span style={{ fontSize: '10px', flexShrink: 0 }}>{badge}</span> : <FileText size={11} style={{ flexShrink: 0 }} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{screen.screenName}</span>
        {screen.isStartupScreen && (<Star size={9} style={{ flexShrink: 0, color: isActive ? '#FEF3C7' : '#F59E0B' }} fill="currentColor" />)}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onContextMenu(e, screen); }}
        style={{ padding: '2px', borderRadius: '3px', background: 'transparent', border: 'none', cursor: 'pointer', color: isActive ? '#FFFFFF' : '#94A3B8', flexShrink: 0, display: 'flex', alignItems: 'center' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.2)' : '#EEF6FF'; e.currentTarget.style.color = isActive ? '#FFFFFF' : color; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isActive ? '#FFFFFF' : '#94A3B8'; }}
        title="Screen options">
        <MoreVertical size={10} />
      </button>
    </div>
  );
};

const ProcessPictureItem = ({ picture, onClick }) => {
  const Icon = picture.icon;
  return (
    <button onClick={onClick}
      style={{ width: 'calc(100% - 8px)', marginLeft: '4px', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '4px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF6FF'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      title={`${picture.label} — ${picture.description}`}>
      <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: `${picture.color}15`, border: `1px solid ${picture.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={11} style={{ color: picture.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#081B43', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{picture.label}</p>
        <p style={{ fontSize: '9px', color: '#94A3B8', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{picture.description}</p>
      </div>
    </button>
  );
};

const ContextMenuItem = ({ icon, label, onClick, color, danger, disabled }) => (
  <button onClick={disabled ? undefined : onClick} disabled={disabled}
    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'transparent', border: 'none', color: disabled ? '#CBD5E1' : color || '#334155', fontSize: '12px', fontWeight: 500, cursor: disabled ? 'default' : 'pointer', textAlign: 'left' }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = danger ? '#FEE2E2' : '#F8FAFC'; }}
    onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = 'transparent'; }}>
    {icon}
    <span>{label}</span>
  </button>
);

export default ScreenExplorer;
