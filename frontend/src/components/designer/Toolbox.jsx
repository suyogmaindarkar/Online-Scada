// ═══════════════════════════════════════════════════════════
// Toolbox — Fixed:
//   ✅ #4  Removed SCADA Symbols group
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import {
  Square, Circle, Minus, Type, Pentagon, Triangle,
  Cylinder, Droplet, Cog, ToggleLeft, Gauge, Activity,
  BarChart3, ListChecks, Hash, TextCursor,
  Radio, Clock,
  CheckSquare, MousePointerClick, CircleDot,
  ChevronDown, ChevronRight, Search, Grid3X3,
} from 'lucide-react';
import COLORS from '../../theme/colors';

// ═══════════════════════════════════════════════════════════
// ELEMENT DEFINITIONS — SCADA Symbols group REMOVED (#4)
// ═══════════════════════════════════════════════════════════
const CATEGORIES = [
  {
    id: 'standard',
    label: 'Standard Objects',
    items: [
      { type: 'line',             icon: Minus,          label: 'Line'              },
      { type: 'polygon',          icon: Pentagon,        label: 'Polygon'           },
      { type: 'polyline',         icon: Triangle,        label: 'Polyline'          },
      { type: 'ellipse',          icon: Circle,          label: 'Ellipse'           },
      { type: 'circle',           icon: Circle,          label: 'Circle'            },
      { type: 'ellipseArc',       icon: Circle,          label: 'Ellipse Arc'       },
      { type: 'circularArc',      icon: Circle,          label: 'Circular Arc'      },
      { type: 'rectangle',        icon: Square,          label: 'Rectangle'         },
      { type: 'roundedRectangle', icon: Square,          label: 'Rounded Rectangle' },
      { type: 'text',             icon: Type,            label: 'Static Text'       },
      { type: 'connector',        icon: Minus,           label: 'Connector'         },
    ],
  },
  {
    id: 'smart',
    label: 'Smart Objects',
    items: [
      { type: 'ioField',       icon: TextCursor,      label: 'I/O Field'       },
      { type: 'bar',           icon: BarChart3,       label: 'Bar'             },
      { type: 'graphicObject', icon: Grid3X3,         label: 'Graphic Object'  },
      { type: 'statusDisplay', icon: Activity,        label: 'Status Display'  },
      { type: 'textList',      icon: ListChecks,      label: 'Text List'       },
      { type: 'comboBox',      icon: ChevronDown,     label: 'Combo Box'       },
      { type: 'listBox',       icon: ListChecks,      label: 'List Box'        },
      { type: 'numericDisplay',icon: Hash,            label: 'Numeric Display' },
      { type: 'textDisplay',   icon: Type,            label: 'Text Display'    },
      { type: 'digitalClock',  icon: Clock,           label: 'Digital Clock'   },
      // ✅ SCADA elements moved here so they're still accessible
      { type: 'tank',          icon: Cylinder,        label: 'Tank'            },
      { type: 'pump',          icon: Droplet,         label: 'Pump'            },
      { type: 'motor',         icon: Cog,             label: 'Motor'           },
      { type: 'valve',         icon: ToggleLeft,      label: 'Valve'           },
      { type: 'gauge',         icon: Gauge,           label: 'Gauge'           },
      { type: 'indicator',     icon: Activity,        label: 'Indicator'       },
      { type: 'pipe',          icon: Minus,           label: 'Pipe'            },
      { type: 'conveyor',      icon: Minus,           label: 'Conveyor'        },
    ],
  },
  {
    id: 'windows',
    label: 'Windows Objects',
    items: [
      { type: 'button',      icon: MousePointerClick, label: 'Button'       },
      { type: 'checkBox',    icon: CheckSquare,       label: 'Check Box'    },
      { type: 'radioButton', icon: CircleDot,         label: 'Radio Button' },
      { type: 'roundButton', icon: Radio,             label: 'Round Button' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// DEFAULT PROPERTIES per element type
// ═══════════════════════════════════════════════════════════
const getDefaults = (type) => {
  const baseDefaults = {
    x: 100, y: 100, width: 100, height: 80,
    rotation: 0, opacity: 1, strokeWidth: 1,
    stroke: '#1e293b', fontSize: 14,
    fontColor: '#081B43', fontFamily: 'Arial',
    text: '', boundTag: null,
  };

  const typeDefaults = {
    line:              { fill: 'transparent', stroke: '#2563EB', width: 100, height: 2, strokeWidth: 2 },
    polygon:           { fill: '#2563EB', width: 100, height: 100, sides: 5 },
    polyline:          { fill: 'transparent', stroke: '#2563EB', width: 100, height: 100, strokeWidth: 2 },
    ellipse:           { fill: '#16A34A', width: 120, height: 80 },
    circle:            { fill: '#16A34A', width: 80, height: 80 },
    ellipseArc:        { fill: 'transparent', stroke: '#2563EB', width: 100, height: 100, strokeWidth: 2 },
    circularArc:       { fill: 'transparent', stroke: '#2563EB', width: 100, height: 100, strokeWidth: 2 },
    rectangle:         { fill: '#2563EB', width: 120, height: 80, cornerRadius: 4 },
    roundedRectangle:  { fill: '#2563EB', width: 120, height: 80, cornerRadius: 16 },
    text:              { fill: 'transparent', text: 'Static Text', fontSize: 16, fontColor: '#081B43' },
    connector:         { fill: 'transparent', stroke: '#5F6B7A', strokeWidth: 2, width: 100, height: 2 },

    ioField:           { fill: '#F8FAFC', stroke: '#2563EB', width: 120, height: 30, fontColor: '#081B43', text: '0' },
    bar:               { fill: '#16A34A', width: 40, height: 200 },
    graphicObject:     { fill: '#EEF6FF', width: 100, height: 100 },
    statusDisplay:     { fill: '#0F172A', width: 120, height: 40, fontColor: '#16A34A', text: 'STATUS' },
    textList:          { fill: '#FFFFFF', width: 150, height: 100 },
    comboBox:          { fill: '#FFFFFF', stroke: '#2563EB', width: 120, height: 30 },
    listBox:           { fill: '#FFFFFF', stroke: '#2563EB', width: 150, height: 120 },
    numericDisplay:    { fill: '#0F172A', width: 100, height: 40, fontColor: '#2563EB' },
    textDisplay:       { fill: '#0F172A', width: 150, height: 40, fontColor: '#FFFFFF', text: 'Text' },
    digitalClock:      {
      fill: '#081B43', width: 200, height: 70, fontSize: 20, fontColor: '#FFFFFF',
      clockDisplayMode: 'timeAndDate', clockTimeFormat: '24h', clockShowSeconds: true,
      clockDateFormat: 'DD/MM/YYYY', clockShowTimezone: false, clockTimeSource: 'local',
      clockBackgroundColor: '#081B43', clockTextColor: '#FFFFFF', clockAccentColor: '#2563EB',
    },

    tank:              { fill: '#06b6d4', width: 80, height: 120 },
    pump:              { fill: '#06b6d4', width: 80, height: 80 },
    motor:             { fill: '#8b5cf6', width: 80, height: 80 },
    valve:             { fill: '#F59E0B', width: 80, height: 60 },
    gauge:             { fill: '#EC4899', width: 100, height: 100 },
    indicator:         { fill: '#16A34A', width: 40, height: 40 },
    pipe:              { fill: '#94A3B8', stroke: '#475569', strokeWidth: 3, width: 150, height: 10 },
    conveyor:          { fill: '#475569', width: 200, height: 30 },

    button:            { fill: '#2563EB', width: 100, height: 36, fontColor: '#FFFFFF', text: 'BUTTON' },
    checkBox:          { fill: 'transparent', stroke: '#2563EB', width: 20, height: 20 },
    radioButton:       { fill: 'transparent', stroke: '#2563EB', width: 20, height: 20 },
    roundButton:       { fill: '#2563EB', width: 60, height: 60, fontColor: '#FFFFFF', text: 'BTN' },
  };

  return { ...baseDefaults, ...(typeDefaults[type] || {}) };
};

// ═══════════════════════════════════════════════════════════
// MAIN TOOLBOX COMPONENT
// ═══════════════════════════════════════════════════════════
const Toolbox = ({ onAddElement }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({
    standard: true,
    smart: true,
    windows: false,
  });

  const toggleCategory = (id) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleClick = (type) => {
    onAddElement({ type, ...getDefaults(type) });
  };

  const filteredCategories = CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div
      className="w-52 h-full flex flex-col select-none"
      style={{ background: '#FFFFFF', borderRight: `1px solid ${COLORS.lineDefault}` }}
    >
      {/* Header */}
      <div className="px-3 py-2" style={{ background: '#F8FAFC', borderBottom: `1px solid ${COLORS.lineDefault}` }}>
        <p className="text-[11px] font-bold" style={{ color: COLORS.heading, fontFamily: COLORS.fonts.heading }}>
          Elements
        </p>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 relative" style={{ borderBottom: `1px solid ${COLORS.lineDefault}` }}>
        <Search size={11} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: COLORS.inkSubtle }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter elements..."
          className="w-full pl-6 pr-2 py-1 text-[11px] rounded outline-none transition-colors"
          style={{ background: '#F8FAFC', border: `1px solid ${COLORS.lineDefault}`, color: COLORS.heading }}
          onFocus={(e) => { e.target.style.borderColor = COLORS.brandAccent; }}
          onBlur={(e) => { e.target.style.borderColor = COLORS.lineDefault; }}
        />
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {filteredCategories.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-[11px] italic" style={{ color: COLORS.inkSubtle }}>
              No objects found for "{searchQuery}"
            </p>
          </div>
        ) : (
          filteredCategories.map((cat) => {
            const isExpanded = searchQuery ? true : expandedCategories[cat.id];
            return (
              <div key={cat.id}>
                {/* Category Header */}
                <button
                  onClick={() => !searchQuery && toggleCategory(cat.id)}
                  className="w-full flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold transition-colors"
                  style={{ color: COLORS.heading, background: '#F8FAFC', borderBottom: `1px solid ${COLORS.lineDefault}`, fontFamily: COLORS.fonts.heading }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surfaceHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                >
                  {isExpanded
                    ? <ChevronDown size={11} style={{ color: COLORS.brandAccent }} />
                    : <ChevronRight size={11} style={{ color: COLORS.inkMuted }} />}
                  <span className="flex-1 text-left uppercase text-[10px] tracking-wide">{cat.label}</span>
                  <span className="text-[9px] font-mono font-normal" style={{ color: COLORS.inkMuted }}>{cat.items.length}</span>
                </button>

                {/* Items */}
                {isExpanded && (
                  <div className="py-0.5">
                    {cat.items.map((item) => (
                      <ToolboxItem key={item.type} item={item} onClick={() => handleClick(item.type)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2" style={{ background: '#F8FAFC', borderTop: `1px solid ${COLORS.lineDefault}` }}>
        <p className="text-[9px] italic leading-tight" style={{ color: COLORS.inkMuted }}>
          Click any object to add it to the canvas
        </p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TOOLBOX ITEM
// ═══════════════════════════════════════════════════════════
const ToolboxItem = ({ item, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-2 px-4 py-1 text-left transition-all"
    style={{ background: 'transparent' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surfaceHover; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    title={`Add ${item.label}`}
  >
    <item.icon size={12} className="shrink-0" style={{ color: COLORS.inkMuted }} />
    <span className="text-[11px] truncate" style={{ color: COLORS.heading }}>{item.label}</span>
  </button>
);

export default Toolbox;
