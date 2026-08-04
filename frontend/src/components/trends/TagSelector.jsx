// ═══════════════════════════════════════════════════════════
// TagSelector Component — Blue theme rebrand
//
// Task Bundle applied:
//   ✅ BONUS — Blue theme, Lucide icons (no emojis)
//   ✅ BONUS — Better empty states + disabled tag when max reached
//   ✅ BONUS — Color chip preview matches chart line colors
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Search, Tag as TagIcon, X, Check, AlertCircle } from 'lucide-react';

// ─── Same palette as parent Trends.jsx ───
const CHART_COLORS = [
  '#2563EB', '#16A34A', '#DC2626', '#F59E0B',
  '#9333EA', '#0891B2', '#EA580C', '#0F3D91',
];

// ─── Theme ───
const C = {
  card:       '#FFFFFF',
  cardSubtle: '#F8FAFC',
  cardHover:  '#EEF6FF',
  border:     '#E5E7EB',
  heading:    '#081B43',
  text:       '#334155',
  muted:      '#5F6B7A',
  subtle:     '#94A3B8',
  brand:      '#2563EB',
  brandDark:  '#0F3D91',
};

const TagSelector = ({
  availableTags = [],
  selectedTags = [],
  onTagSelect,
  onTagRemove,
  maxTags = 8,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const safeTags = Array.isArray(availableTags) ? availableTags : [];

  const filteredTags = safeTags.filter((tag) => {
    if (!tag) return false;
    const name = tag.tagName || tag.name || '';
    const addr = tag.address || tag.plcAddress || '';
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      addr.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const isSelected = (tagId) => selectedTags.some((t) => t.tagId === tagId);
  const maxReached = selectedTags.length >= maxTags;

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
      }}
    >
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <TagIcon size={16} style={{ color: C.brand }} />
        <h3
          style={{
            color: C.heading,
            fontWeight: 700,
            fontSize: '14px',
            fontFamily: "'Montserrat', sans-serif",
            flex: 1,
          }}
        >
          Tag Selection
        </h3>
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '4px',
            background: maxReached ? '#FEF3C7' : C.cardHover,
            color: maxReached ? '#B45309' : C.brand,
          }}
        >
          {selectedTags.length}/{maxTags}
        </span>
      </div>

      {/* ─── Search ─── */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: C.subtle,
          }}
        />
        <input
          type="text"
          placeholder="Search tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 32px 8px 32px',
            fontSize: '13px',
            background: C.cardSubtle,
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            outline: 'none',
            color: C.heading,
            fontFamily: "'Inter', sans-serif",
          }}
          onFocus={(e) => { e.target.style.borderColor = C.brand; }}
          onBlur={(e) => { e.target.style.borderColor = C.border; }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: C.subtle,
              padding: '2px',
              display: 'flex',
            }}
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ─── Selected Tags (chips) ─── */}
      {selectedTags.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <p
            style={{
              fontSize: '10px',
              color: C.muted,
              marginBottom: '6px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Selected
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {selectedTags.map((tag, index) => {
              const color = CHART_COLORS[index % CHART_COLORS.length];
              return (
                <div
                  key={tag.tagId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: `${color}15`,
                    border: `1px solid ${color}40`,
                    color: color,
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tag.tagName}
                  </span>
                  <button
                    onClick={() => onTagRemove(tag.tagId)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: color,
                      padding: 0,
                      display: 'flex',
                      opacity: 0.7,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.7; }}
                    title="Remove"
                  >
                    <X size={11} strokeWidth={3} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Available count ─── */}
      <div
        style={{
          fontSize: '11px',
          color: C.subtle,
          marginBottom: '6px',
          fontWeight: 500,
        }}
      >
        Available: <span style={{ fontWeight: 700, color: C.text }}>{filteredTags.length}</span>
        {searchQuery && <span> / {safeTags.length}</span>}
      </div>

      {/* ─── Available Tags List ─── */}
      <div
        style={{
          maxHeight: '288px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {safeTags.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <AlertCircle size={20} style={{ color: C.subtle, margin: '0 auto 6px', display: 'block' }} />
            <p style={{ fontSize: '12px', color: C.muted }}>No tags in database</p>
          </div>
        ) : filteredTags.length === 0 ? (
          <p style={{ fontSize: '12px', color: C.muted, textAlign: 'center', padding: '12px 0' }}>
            No tags match "{searchQuery}"
          </p>
        ) : (
          filteredTags.map((tag) => {
            const tagId = tag._id || tag.id;
            const tagName = tag.tagName || tag.name;
            const selected = isSelected(tagId);
            const disabled = maxReached && !selected;

            return (
              <div
                key={tagId}
                onClick={() => {
                  if (selected) {
                    onTagRemove(tagId);
                  } else if (!disabled) {
                    onTagSelect({
                      tagId: tagId,
                      tagName: tagName,
                      unit: tag.unit || '',
                    });
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  fontSize: '12px',
                  background: selected ? C.cardHover : 'transparent',
                  border: `1px solid ${selected ? C.brand : 'transparent'}`,
                  opacity: disabled ? 0.4 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!selected && !disabled) e.currentTarget.style.background = C.cardSubtle;
                }}
                onMouseLeave={(e) => {
                  if (!selected && !disabled) e.currentTarget.style.background = 'transparent';
                }}
                title={disabled ? `Maximum ${maxTags} tags reached` : selected ? 'Click to remove' : 'Click to add'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: selected ? C.brand : C.border,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      color: C.heading,
                      fontWeight: selected ? 600 : 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tagName}
                  </span>
                  {tag.unit && (
                    <span style={{ color: C.subtle, fontSize: '10px', flexShrink: 0 }}>
                      ({tag.unit})
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {(tag.address || tag.plcAddress) && (
                    <span
                      style={{
                        color: C.subtle,
                        fontSize: '10px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {tag.address || tag.plcAddress}
                    </span>
                  )}
                  {selected && <Check size={12} style={{ color: C.brand }} strokeWidth={3} />}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TagSelector;