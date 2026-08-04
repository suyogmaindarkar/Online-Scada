// ═══════════════════════════════════════════════════════════
// RecipeForm — Blue theme + auto-version note
//
// Task Bundle applied:
//   ✅ T053  — Shows auto-version hint on edit
//   ✅ BONUS — Blue theme rebrand
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Info } from 'lucide-react';
import { tagAPI } from '../../services/api';

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
  btnPrimary: '#081B43',
  btnHover:   '#123E8A',
  success:    '#16A34A',
  danger:     '#DC2626',
  warning:    '#F59E0B',
};

const RecipeForm = ({ recipe, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    recipeName: '',
    description: '',
    category: 'Default',
    version: '1.0',
    parameters: [],
    isActive: true,
    changeNote: '', // T053
  });

  const [availableTags, setAvailableTags] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const res = await tagAPI.getAll();
        const tags = res.data?.tags || res.data?.data || res.data || [];
        setAvailableTags(Array.isArray(tags) ? tags : []);
      } catch (err) {
        console.error('Failed to load tags', err);
      }
    };
    loadTags();
  }, []);

  useEffect(() => {
    if (recipe) {
      setFormData({
        recipeName: recipe.recipeName || '',
        description: recipe.description || '',
        category: recipe.category || 'Default',
        version: recipe.version || '1.0',
        parameters: recipe.parameters || [],
        isActive: recipe.isActive !== undefined ? recipe.isActive : true,
        changeNote: '',
      });
    }
  }, [recipe]);

  const handleAddParameter = () => {
    setFormData((prev) => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        { tagName: '', value: '', unit: '', description: '' },
      ],
    }));
  };

  const handleParameterChange = (index, field, value) => {
    const updated = [...formData.parameters];
    updated[index][field] = value;
    if (field === 'tagName') {
      const tag = availableTags.find((t) => t.tagName === value);
      if (tag) updated[index].unit = tag.unit || '';
    }
    setFormData({ ...formData, parameters: updated });
  };

  const handleRemoveParameter = (index) => {
    setFormData({ ...formData, parameters: formData.parameters.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.recipeName.trim()) return setError('Recipe name is required');
    if (formData.parameters.length === 0) return setError('Add at least one parameter');
    for (const p of formData.parameters) {
      if (!p.tagName || p.value === '') return setError('All parameters must have tag name and value');
    }

    const dataToSend = {
      ...formData,
      parameters: formData.parameters.map((p) => ({
        ...p,
        value: isNaN(p.value) ? p.value : Number(p.value),
      })),
    };

    try {
      setSaving(true);
      await onSubmit(dataToSend);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: C.cardSubtle,
    border: `1px solid ${C.border}`,
    color: C.heading,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8, 27, 67, 0.50)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: C.card,
          borderRadius: '16px',
          width: '100%',
          maxWidth: '840px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${C.border}`,
          boxShadow: '0px 24px 80px rgba(8, 27, 67, 0.20)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <h2 className="text-xl font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
            {recipe ? 'Edit Recipe' : 'Create New Recipe'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: C.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; e.currentTarget.style.color = C.brand; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {error && (
              <div
                className="p-3 rounded-lg text-sm flex items-center gap-2"
                style={{ background: '#FEE2E2', border: `1px solid ${C.danger}`, color: '#B91C1C' }}
              >
                ❌ {error}
              </div>
            )}

            {/* ✅ T053: Auto-version notice on edit */}
            {recipe && (
              <div
                className="p-3 rounded-lg flex items-start gap-2 text-xs"
                style={{ background: C.cardHover, border: `1px solid ${C.brand}30`, color: C.brand }}
              >
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Auto-versioning:</strong> If you change any parameter values, the recipe version will auto-bump from <strong>v{recipe.version}</strong> and the current version will be saved to history.
                </div>
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Recipe Name *">
                <input
                  type="text"
                  value={formData.recipeName}
                  onChange={(e) => setFormData({ ...formData, recipeName: e.target.value })}
                  className="w-full rounded px-3 py-2 outline-none text-sm"
                  style={inputStyle}
                  placeholder="e.g. Product A Recipe"
                  required
                  onFocus={(e) => e.target.style.borderColor = C.brand}
                  onBlur={(e) => e.target.style.borderColor = C.border}
                />
              </FormField>
              <FormField label="Category">
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded px-3 py-2 outline-none text-sm"
                  style={inputStyle}
                  placeholder="e.g. Production"
                  onFocus={(e) => e.target.style.borderColor = C.brand}
                  onBlur={(e) => e.target.style.borderColor = C.border}
                />
              </FormField>
            </div>

            <FormField label="Description">
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded px-3 py-2 outline-none text-sm"
                style={inputStyle}
                rows="2"
                placeholder="Recipe description..."
                onFocus={(e) => e.target.style.borderColor = C.brand}
                onBlur={(e) => e.target.style.borderColor = C.border}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={recipe ? 'Version (auto-managed)' : 'Version'}>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="w-full rounded px-3 py-2 outline-none text-sm"
                  style={inputStyle}
                  placeholder="1.0"
                  disabled={!!recipe}
                  title={recipe ? 'Auto-bumped when parameters change' : ''}
                />
              </FormField>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4"
                    style={{ accentColor: C.brand }}
                  />
                  <span className="text-sm" style={{ color: C.text }}>Active (allow execution)</span>
                </label>
              </div>
            </div>

            {/* Change note (edit only) */}
            {recipe && (
              <FormField label="Change Note (optional)">
                <input
                  type="text"
                  value={formData.changeNote}
                  onChange={(e) => setFormData({ ...formData, changeNote: e.target.value })}
                  className="w-full rounded px-3 py-2 outline-none text-sm"
                  style={inputStyle}
                  placeholder="e.g. Increased temperature setpoint by 5°C"
                  onFocus={(e) => e.target.style.borderColor = C.brand}
                  onBlur={(e) => e.target.style.borderColor = C.border}
                />
              </FormField>
            )}

            {/* Parameters */}
            <div className="pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-3 mt-4">
                <h3 className="font-bold text-sm" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
                  Parameters ({formData.parameters.length})
                </h3>
                <button
                  type="button"
                  onClick={handleAddParameter}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-white text-xs font-semibold"
                  style={{ background: C.brand }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Parameter
                </button>
              </div>

              {formData.parameters.length === 0 && (
                <div
                  className="text-center py-8 rounded-lg text-sm"
                  style={{ background: C.cardSubtle, color: C.subtle, border: `2px dashed ${C.border}` }}
                >
                  No parameters added. Click "Add Parameter" to start.
                </div>
              )}

              <div className="space-y-2">
                {formData.parameters.map((param, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg"
                    style={{ background: C.cardSubtle, border: `1px solid ${C.border}` }}
                  >
                    <div className="col-span-4">
                      <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: C.muted }}>Tag *</label>
                      <select
                        value={param.tagName}
                        onChange={(e) => handleParameterChange(index, 'tagName', e.target.value)}
                        className="w-full rounded px-2 py-1.5 outline-none text-xs"
                        style={{ background: C.card, border: `1px solid ${C.border}`, color: C.heading }}
                        required
                      >
                        <option value="">Select tag...</option>
                        {availableTags.map((tag) => (
                          <option key={tag._id} value={tag.tagName}>{tag.tagName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: C.muted }}>Value *</label>
                      <input
                        type="text"
                        value={param.value}
                        onChange={(e) => handleParameterChange(index, 'value', e.target.value)}
                        className="w-full rounded px-2 py-1.5 outline-none text-xs"
                        style={{ background: C.card, border: `1px solid ${C.border}`, color: C.heading }}
                        placeholder="Value"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: C.muted }}>Unit</label>
                      <input
                        type="text"
                        value={param.unit}
                        onChange={(e) => handleParameterChange(index, 'unit', e.target.value)}
                        className="w-full rounded px-2 py-1.5 outline-none text-xs"
                        style={{ background: C.card, border: `1px solid ${C.border}`, color: C.heading }}
                        placeholder="°C"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: C.muted }}>Notes</label>
                      <input
                        type="text"
                        value={param.description}
                        onChange={(e) => handleParameterChange(index, 'description', e.target.value)}
                        className="w-full rounded px-2 py-1.5 outline-none text-xs"
                        style={{ background: C.card, border: `1px solid ${C.border}`, color: C.heading }}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveParameter(index)}
                        className="p-1.5 rounded text-white"
                        style={{ background: C.danger }}
                        title="Remove parameter"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="px-6 py-4 flex justify-end gap-2"
            style={{ borderTop: `1px solid ${C.border}`, background: C.cardSubtle }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-semibold text-sm"
              style={{ background: C.card, color: C.text, border: `1px solid ${C.border}` }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg font-semibold text-white text-sm disabled:opacity-50"
              style={{
                background: C.btnPrimary,
                boxShadow: '0px 2px 6px rgba(8, 27, 67, 0.25)',
                fontFamily: "'Montserrat', sans-serif",
              }}
              onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = C.btnHover; }}
              onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = C.btnPrimary; }}
            >
              {saving ? 'Saving...' : recipe ? 'Update Recipe' : 'Create Recipe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const FormField = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold mb-1.5 uppercase" style={{ color: C.muted }}>
      {label}
    </label>
    {children}
  </div>
);

export default RecipeForm;