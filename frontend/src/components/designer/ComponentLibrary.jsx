import { useState, useMemo } from 'react';
import {
  Search, ChevronDown, ChevronRight, Package, X, Layers, Shapes, Cog, Wrench, ArrowRight,
  Droplets, Cylinder, Radio, GitBranch, Lightbulb, Monitor, SlidersHorizontal,
  Snowflake, Zap, ShieldAlert, Workflow, Gauge, SquareDashed, MessageSquare,
  PanelsTopLeft, Filter, Power, RadioTower, CircleDot, ToggleRight,
} from 'lucide-react';
import {
  LIBRARY_CATEGORIES,
  LIBRARY_COMPONENTS,
  searchComponents,
  getCategoryStats,
} from '../../config/componentLibrary';
import COLORS from '../../theme/colors';

// ═══════════════════════════════════════════════════════════
// ComponentLibrary — Sprint F Phase 2
// Sidebar panel with categorized HMI symbol library
// ═══════════════════════════════════════════════════════════

const ComponentLibrary = ({ onAddComponent }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [expandedSubcategories, setExpandedSubcategories] = useState({});

  const filteredComponents = useMemo(() => {
    let components = LIBRARY_COMPONENTS;
    if (searchQuery.trim()) components = searchComponents(searchQuery);
    if (selectedCategory) components = components.filter((c) => c.category === selectedCategory);
    return components;
  }, [searchQuery, selectedCategory]);

  const groupedComponents = useMemo(() => {
    const groups = {};
    filteredComponents.forEach((comp) => {
      if (!groups[comp.category]) groups[comp.category] = {};
      if (!groups[comp.category][comp.subcategory]) groups[comp.category][comp.subcategory] = [];
      groups[comp.category][comp.subcategory].push(comp);
    });
    return groups;
  }, [filteredComponents]);

  const categoryStats = getCategoryStats();

  const toggleSubcategory = (key) => {
    setExpandedSubcategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleComponentClick = (component) => {
    if (onAddComponent) onAddComponent(component);
  };

  const handleDragStart = (e, component) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'library-component',
      componentId: component.id,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      className="w-64 h-full flex flex-col select-none"
      style={{
        background: '#FFFFFF',
        borderRight: `1px solid ${COLORS.lineDefault}`,
      }}
    >
      {/* ═══════════ HEADER ═══════════ */}
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{
          background: 'linear-gradient(90deg, #F8FAFC 0%, #EEF6FF 100%)',
          borderBottom: `1px solid ${COLORS.lineDefault}`,
        }}
      >
        <Package size={14} style={{ color: COLORS.brandAccent }} />
        <p
          className="text-[11px] font-bold"
          style={{ color: COLORS.heading, fontFamily: COLORS.fonts.heading }}
        >
          Component Library
        </p>
        <span
          className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded"
          style={{
            background: 'rgba(255,255,255,0.7)',
            color: COLORS.inkMuted,
          }}
        >
          {LIBRARY_COMPONENTS.length}
        </span>
      </div>

      {/* ═══════════ SEARCH ═══════════ */}
      <div
        className="px-2 py-1.5 relative"
        style={{ borderBottom: `1px solid ${COLORS.lineDefault}` }}
      >
        <Search
          size={11}
          className="absolute left-4 top-1/2 -translate-y-1/2"
          style={{ color: COLORS.inkSubtle }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search components..."
          className="w-full pl-6 pr-7 py-1 text-[11px] rounded outline-none transition-colors"
          style={{
            background: '#F8FAFC',
            border: `1px solid ${COLORS.lineDefault}`,
            color: COLORS.heading,
          }}
          onFocus={(e) => { e.target.style.borderColor = COLORS.brandAccent; }}
          onBlur={(e) => { e.target.style.borderColor = COLORS.lineDefault; }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 transition-colors"
            style={{ color: COLORS.inkSubtle }}
            onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.danger; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.inkSubtle; }}
            title="Clear search"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* ═══════════ CATEGORY FILTERS ═══════════ */}
      <div
        className="px-2 py-1.5 flex flex-wrap gap-1"
        style={{ borderBottom: `1px solid ${COLORS.lineDefault}` }}
      >
        <CategoryChip
          label="All"
           icon="Layers"
          count={LIBRARY_COMPONENTS.length}
          active={selectedCategory === null}
          onClick={() => setSelectedCategory(null)}
        />
        {categoryStats.map((cat) => (
          <CategoryChip
            key={cat.id}
            label={cat.label}
            icon={cat.icon}
            count={cat.count}
            color={cat.color}
            active={selectedCategory === cat.id}
            onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
          />
        ))}
      </div>

      {/* ═══════════ COMPONENTS LIST ═══════════ */}
      <div className="flex-1 overflow-y-auto">
        {filteredComponents.length === 0 ? (
          <div className="p-4 text-center">
            <Package size={24} className="mx-auto mb-2" style={{ color: COLORS.inkSubtle }} />
            <p className="text-[11px] italic" style={{ color: COLORS.inkSubtle }}>
              No components found
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-[10px] hover:underline font-semibold"
                style={{ color: COLORS.brandAccent }}
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          Object.entries(groupedComponents).map(([categoryId, subcategories]) => {
            const catInfo = LIBRARY_CATEGORIES.find((c) => c.id === categoryId);
            if (!catInfo) return null;

            return (
              <div
                key={categoryId}
                style={{ borderBottom: `1px solid ${COLORS.lineDefault}` }}
              >
                {/* Category Header */}
                <div
                  className="px-2 py-1 flex items-center gap-1"
                  style={{
                    background: '#F8FAFC',
                    borderLeft: `3px solid ${catInfo.color}`,
                  }}
                >
                   <LibraryIcon name={catInfo.icon} size={12} />
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: COLORS.heading }}
                  >
                    {catInfo.label}
                  </span>
                  <span
                    className="ml-auto text-[9px] font-mono"
                    style={{ color: COLORS.inkMuted }}
                  >
                    {Object.values(subcategories).flat().length}
                  </span>
                </div>

                {/* Subcategories */}
                {Object.entries(subcategories).map(([subcatName, components]) => {
                  const subcatKey = `${categoryId}_${subcatName}`;
                  const isExpanded = searchQuery
                    ? true
                    : selectedCategory === categoryId
                    ? true
                    : expandedSubcategories[subcatKey] !== false;

                  return (
                    <div key={subcatKey}>
                      {/* Subcategory Header */}
                      <button
                        onClick={() => toggleSubcategory(subcatKey)}
                        className="w-full flex items-center gap-1 px-2 py-1 text-[10px] font-semibold transition-colors"
                        style={{
                          background: '#FFFFFF',
                          color: COLORS.inkBody,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surfaceHover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
                      >
                        {isExpanded ? (
                          <ChevronDown size={9} style={{ color: COLORS.brandAccent }} />
                        ) : (
                          <ChevronRight size={9} style={{ color: COLORS.inkMuted }} />
                        )}
                        <span className="flex-1 text-left">{subcatName}</span>
                        <span
                          className="text-[9px] font-normal font-mono"
                          style={{ color: COLORS.inkMuted }}
                        >
                          {components.length}
                        </span>
                      </button>

                      {/* Components */}
                      {isExpanded && (
                        <div style={{ background: '#FFFFFF' }}>
                          {components.map((comp) => (
                            <ComponentItem
                              key={comp.id}
                              component={comp}
                              onClick={() => handleComponentClick(comp)}
                              onDragStart={(e) => handleDragStart(e, comp)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* ═══════════ FOOTER TIP ═══════════ */}
      <div
        className="px-3 py-2"
        style={{
          background: '#F8FAFC',
          borderTop: `1px solid ${COLORS.lineDefault}`,
        }}
      >
        <p
          className="text-[9px] italic leading-tight"
          style={{ color: COLORS.inkMuted }}
        >
           <strong>Click</strong> to add · <strong>Drag</strong> onto canvas
        </p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// CATEGORY CHIP (filter button)
// ═══════════════════════════════════════════════════════════
const CategoryChip = ({ label, icon, count, color, active, onClick }) => (
  <button
    onClick={onClick}
    title={label}
    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all"
    style={{
      background: active ? (color || COLORS.brandAccent) : 'rgba(255,255,255,0.9)',
      color: active ? '#FFFFFF' : COLORS.inkBody,
      border: `1px solid ${active ? (color || COLORS.brandAccent) : COLORS.lineDefault}`,
      boxShadow: active ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
    }}
    onMouseEnter={(e) => {
      if (!active) e.currentTarget.style.background = '#FFFFFF';
    }}
    onMouseLeave={(e) => {
      if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.9)';
    }}
  >
    <LibraryIcon name={icon} size={11} />
    <span className="font-mono">{count}</span>
  </button>
);

const ICONS = {
  Shapes, Cog, Wrench, Droplets, Cylinder, Radio, GitBranch, Lightbulb, Monitor,
  SlidersHorizontal, Snowflake, Zap, ShieldAlert, Workflow, Gauge, SquareDashed,
  MessageSquare, PanelsTopLeft, Filter, Power, RadioTower, CircleDot, ToggleRight,
  Layers, ArrowRight,
};

const LibraryIcon = ({ name, size = 14 }) => {
  const Icon = ICONS[name] || Shapes;
  return <Icon size={size} aria-hidden="true" />;
};

// ═══════════════════════════════════════════════════════════
// COMPONENT ITEM (single row)
// ═══════════════════════════════════════════════════════════
const ComponentItem = ({ component, onClick, onDragStart }) => (
  <div
    draggable
    onDragStart={onDragStart}
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer group transition-all"
    style={{ borderLeft: '2px solid transparent' }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = COLORS.surfaceHover;
      e.currentTarget.style.borderLeftColor = COLORS.brandAccent;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.borderLeftColor = 'transparent';
    }}
    title={`${component.name}\n${component.description}\n\nClick or drag to add`}
  >
    {/* Icon or SVG thumbnail */}
    <div
      className="w-10 h-10 flex items-center justify-center text-sm shrink-0 rounded overflow-hidden transition-colors"
      style={{
        background: '#FFFFFF',
        border: `1px solid ${COLORS.lineDefault}`,
      }}
    >
      {component.thumbnail ? (
        <img
          src={component.thumbnail}
          alt={component.name}
          className="w-full h-full object-contain p-0.5"
          draggable={false}
        />
      ) : (
        <LibraryIcon name={component.icon} size={16} />
      )}
    </div>

    {/* Text info */}
    <div className="flex-1 min-w-0">
      <p
        className="text-[11px] font-medium truncate"
        style={{ color: COLORS.heading }}
      >
        {component.name}
      </p>
      <p
        className="text-[9px] truncate italic"
        style={{ color: COLORS.inkMuted }}
      >
        {component.subcategory}
      </p>
    </div>

    {/* Drag indicator */}
    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
      <Layers size={10} style={{ color: COLORS.brandAccent }} />
    </div>
  </div>
);

export default ComponentLibrary;
