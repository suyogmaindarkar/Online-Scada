// ═══════════════════════════════════════════════════════════
// RecipeList — Blue theme + Duplicate + Version buttons
//
// Task Bundle applied:
//   ✅ T053  — Version badge + "History" button
//   ✅ T054  — "Duplicate" button
//   ✅ BONUS — Blue theme rebrand, showing execution count
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { Play, Edit, Trash2, Eye, Copy, History as HistoryIcon, FileText } from 'lucide-react';

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
  success:    '#16A34A',
  danger:     '#DC2626',
  warning:    '#F59E0B',
  purple:     '#9333EA',
};

const RecipeList = ({ recipes, onExecute, onEdit, onDelete, onView, onDuplicate, onViewVersions }) => {
  if (!recipes || recipes.length === 0) {
    return (
      <div
        className="p-12 text-center rounded-2xl"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: C.subtle }} />
        <h3 className="text-lg font-semibold mb-2" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
          No Matching Recipes
        </h3>
        <p style={{ color: C.muted }}>Try adjusting your search or filter</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Recipe Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Params</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Version</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Executed</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Status</th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((recipe, idx) => (
              <tr
                key={recipe._id}
                style={{
                  borderBottom: idx < recipes.length - 1 ? `1px solid ${C.border}` : 'none',
                  background: C.card,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.cardSubtle; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = C.card; }}
              >
                <td className="px-4 py-3">
                  <div className="font-semibold" style={{ color: C.heading }}>{recipe.recipeName}</div>
                  {recipe.description && (
                    <div className="text-xs mt-1" style={{ color: C.muted }}>
                      {recipe.description.length > 60
                        ? recipe.description.slice(0, 60) + '...'
                        : recipe.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-0.5 text-xs rounded font-semibold"
                    style={{ background: C.cardHover, color: C.brand }}
                  >
                    {recipe.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: C.text }}>
                  <span className="font-semibold">{recipe.parameters?.length || 0}</span>
                  <span className="text-xs ml-1" style={{ color: C.muted }}>tags</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="font-mono text-xs font-bold px-2 py-0.5 rounded"
                    style={{ background: C.cardSubtle, color: C.purple, border: `1px solid ${C.purple}30` }}
                    title={`Auto-bumps on parameter change`}
                  >
                    v{recipe.version}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: C.muted }}>
                  {recipe.executionCount > 0 ? (
                    <div>
                      <div className="font-semibold" style={{ color: C.text }}>{recipe.executionCount}x</div>
                      {recipe.lastExecutedAt && (
                        <div className="text-[10px]">
                          {new Date(recipe.lastExecutedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: C.subtle }}>Never</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-0.5 text-xs rounded font-semibold"
                    style={{
                      background: recipe.isActive ? '#DCFCE7' : '#FEE2E2',
                      color: recipe.isActive ? '#15803D' : '#B91C1C',
                    }}
                  >
                    {recipe.isActive ? '● Active' : '○ Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1.5">
                    <TableActionButton
                      variant="blue"
                      icon={Eye}
                      onClick={() => onView(recipe)}
                      title="View Details"
                    />

                    <TableActionButton
                      variant="green"
                      icon={Play}
                      onClick={() => onExecute(recipe)}
                      disabled={!recipe.isActive}
                      title={recipe.isActive ? 'Execute Recipe' : 'Recipe is inactive'}
                    />

                    <TableActionButton
                      variant="blue"
                      icon={Edit}
                      onClick={() => onEdit(recipe)}
                      title="Edit Recipe"
                    />

                    <TableActionButton
                      variant="purple"
                      icon={Copy}
                      onClick={() => onDuplicate(recipe)}
                      title="Duplicate as template"
                    />

                    <TableActionButton
                      variant="amber"
                      icon={HistoryIcon}
                      onClick={() => onViewVersions(recipe)}
                      title="Version history"
                    />

                    <TableActionButton
                      variant="red"
                      icon={Trash2}
                      onClick={() => onDelete(recipe)}
                      title="Delete Recipe"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TableActionButton = ({ variant = 'blue', icon: Icon, onClick, title, disabled }) => {
  const styles = {
    green: {
      bg: '#F0FDF4',
      bgHover: '#DCFCE7',
      color: '#16A34A',
      border: '#BBF7D0',
    },
    orange: {
      bg: '#FFF7ED',
      bgHover: '#FFEDD5',
      color: '#EA580C',
      border: '#FED7AA',
    },
    blue: {
      bg: '#EFF6FF',
      bgHover: '#DBEAFE',
      color: '#2563EB',
      border: '#BFDBFE',
    },
    red: {
      bg: '#FEF2F2',
      bgHover: '#FEE2E2',
      color: '#DC2626',
      border: '#FECACA',
    },
    amber: {
      bg: '#FFFBEB',
      bgHover: '#FEF3C7',
      color: '#D97706',
      border: '#FDE68A',
    },
    purple: {
      bg: '#FAF5FF',
      bgHover: '#F3E8FF',
      color: '#9333EA',
      border: '#E9D5FF',
    },
  };

  const s = styles[variant] || styles.blue;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = s.bgHover;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = s.bg;
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
};

export default RecipeList;