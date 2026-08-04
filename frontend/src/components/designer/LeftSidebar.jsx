import { useState } from 'react';
import { Wrench, Package } from 'lucide-react';
import Toolbox from './Toolbox';
import ComponentLibrary from './ComponentLibrary';
import COLORS from '../../theme/colors';

// ═══════════════════════════════════════════════════════════
// LeftSidebar — Sprint F Phase 3
// Wrapper that toggles between Toolbox and Component Library
// ═══════════════════════════════════════════════════════════

const LeftSidebar = ({ onAddElement, onAddComponent }) => {
  const [activePanel, setActivePanel] = useState('toolbox'); // 'toolbox' | 'library'

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: '#FFFFFF' }}
    >
      {/* ─── TOGGLE BUTTONS ─── */}
      <div
        className="flex"
        style={{
          background: '#F8FAFC',
          borderBottom: `1px solid ${COLORS.lineDefault}`,
        }}
      >
        <ToggleButton
          active={activePanel === 'toolbox'}
          onClick={() => setActivePanel('toolbox')}
          icon={Wrench}
          label="Toolbox"
        />
        <ToggleButton
          active={activePanel === 'library'}
          onClick={() => setActivePanel('library')}
          icon={Package}
          label="Library"
        />
      </div>

      {/* ─── ACTIVE PANEL ─── */}
      <div className="flex-1 overflow-hidden">
        {activePanel === 'toolbox' && (
          <Toolbox onAddElement={onAddElement} />
        )}
        {activePanel === 'library' && (
          <ComponentLibrary onAddComponent={onAddComponent} />
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TOGGLE BUTTON
// ═══════════════════════════════════════════════════════════
const ToggleButton = ({ active, onClick, icon: Icon, label, badge }) => (
  <button
    onClick={onClick}
    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-semibold transition-all relative"
    style={{
      background: active ? '#FFFFFF' : 'transparent',
      color: active ? COLORS.brandAccent : COLORS.inkMuted,
      borderBottom: `2px solid ${active ? COLORS.brandAccent : 'transparent'}`,
      fontFamily: COLORS.fonts.heading,
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
        e.currentTarget.style.color = COLORS.heading;
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = COLORS.inkMuted;
      }
    }}
    title={label}
  >
    <Icon size={13} />
    <span>{label}</span>
    {badge && (
      <span
        className="text-[9px] font-mono px-1 rounded"
        style={{
          background: 'rgba(37, 99, 235, 0.15)',
          color: COLORS.brandAccent,
        }}
      >
        {badge}
      </span>
    )}
  </button>
);

export default LeftSidebar;