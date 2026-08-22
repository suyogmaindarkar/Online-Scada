// ═══════════════════════════════════════════════════════════
// Recipes Page — Blue theme + full task bundle
//
// Task Bundle applied:
//   ✅ T051  — Execute with confirmation dialog + optional note
//   ✅ T052  — Execution Log tab (with filters + detail view)
//   ✅ T053  — Version history badge + restore modal
//   ✅ T054  — Duplicate button (template creation)
//   ✅ UI FIX 2: Fixed Create Recipe button styling and contrast.
//   ✅ UI FIX 3: Removed header icon badge for left-alignment.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  Plus, Search, FileText, ListChecks, History as HistoryIcon,
  RefreshCw, Loader2, X, Play, Copy, Clock, CheckCircle,
  XCircle, AlertTriangle, ArrowUpDown,
} from 'lucide-react';
import { recipeAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import RecipeList from '../components/recipes/RecipeList';
import RecipeForm from '../components/recipes/RecipeForm';
import RecipeExecute from '../components/recipes/RecipeExecute';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';

// ─── Theme ───
const C = {
  bg:         '#F8FAFC',
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
  btnPrimary: '#081B43',
  btnHover:   '#123E8A',
  success:    '#16A34A',
  warning:    '#F59E0B',
  danger:     '#DC2626',
  purple:     '#9333EA',
};

const STATUS_COLORS = {
  SUCCESS:   { bg: '#DCFCE7', text: '#15803D', border: '#16A34A' },
  PARTIAL:   { bg: '#FEF3C7', text: '#78350F', border: '#F59E0B' },
  FAILED:    { bg: '#FEE2E2', text: '#7F1D1D', border: '#DC2626' },
  CANCELLED: { bg: '#F1F5F9', text: '#334155', border: '#94A3B8' },
};

const Recipes = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('recipes');

  // Recipes state
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [executingRecipe, setExecutingRecipe] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Duplicate state
  const [duplicating, setDuplicating] = useState(null);
  const [duplicateName, setDuplicateName] = useState('');

  // Version history state
  const [viewingVersions, setViewingVersions] = useState(null);
  const [versionHistory, setVersionHistory] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(null);

  // View details state
  const [viewingRecipe, setViewingRecipe] = useState(null);

  // Logs state
  const [logs, setLogs] = useState([]);
  const [logSummary, setLogSummary] = useState({ total: 0, success: 0, partial: 0, failed: 0 });
  const [logsLoading, setLogsLoading] = useState(false);
  const [logStatusFilter, setLogStatusFilter] = useState('');
  const [logRecipeFilter, setLogRecipeFilter] = useState('');
  const [viewingLog, setViewingLog] = useState(null);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const res = await recipeAPI.getAll();
      setRecipes(res.data?.recipes || []);
    } catch (err) {
      console.error('Failed to load recipes', err);
      setError('Failed to load recipes');
      showToast('Failed to load recipes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await recipeAPI.getCategories();
      setCategories(res.data?.categories || []);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      const filters = {};
      if (logStatusFilter) filters.status = logStatusFilter;
      if (logRecipeFilter) filters.recipeId = logRecipeFilter;
      const res = await recipeAPI.getLogs(filters);
      setLogs(res.data?.logs || []);
      setLogSummary(res.data?.summary || { total: 0, success: 0, partial: 0, failed: 0 });
    } catch (err) {
      console.error('Failed to load logs', err);
      showToast('Failed to load execution logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
    loadCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') loadLogs();
  }, [activeTab, logStatusFilter, logRecipeFilter]);

  const handleSubmit = async (data) => {
    try {
      let result;
      if (editingRecipe) {
        result = await recipeAPI.update(editingRecipe._id, data);
        const bumped = result?.data?.versionBumped;
        const newVersion = result?.data?.recipe?.version;
        showToast(
          bumped
            ? `Recipe updated & auto-bumped to v${newVersion}`
            : `Recipe "${data.recipeName}" updated`,
          'success'
        );
      } else {
        await recipeAPI.create(data);
        showToast(`Recipe "${data.recipeName}" created`, 'success');
      }
      setShowForm(false);
      setEditingRecipe(null);
      loadRecipes();
      loadCategories();
    } catch (err) {
      showToast(err.response?.data?.message || 'Operation failed', 'error');
      throw err;
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return;
    try {
      await recipeAPI.delete(deleteConfirm._id);
      showToast(`Recipe "${deleteConfirm.recipeName}" deleted`, 'success');
      setDeleteConfirm(null);
      loadRecipes();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  const handleExecute = async (id, note = '') => {
    try {
      const res = await recipeAPI.execute(id, note);
      loadRecipes();
      if (activeTab === 'logs') loadLogs();
      showToast(
        res.data?.status === 'SUCCESS' ? 'Recipe executed successfully' :
        res.data?.status === 'PARTIAL' ? 'Recipe partially executed' :
        'Recipe execution completed',
        res.data?.status === 'FAILED' ? 'error' :
        res.data?.status === 'PARTIAL' ? 'warning' : 'success'
      );
      return res.data;
    } catch (err) {
      showToast(err.response?.data?.message || 'Execution failed', 'error');
      throw err;
    }
  };

  const handleOpenDuplicate = (recipe) => {
    setDuplicating(recipe);
    setDuplicateName(`${recipe.recipeName} (Copy)`);
  };

  const handleDuplicate = async () => {
    if (!duplicating) return;
    try {
      const res = await recipeAPI.duplicate(duplicating._id, duplicateName);
      showToast(`Duplicated as "${res.data?.recipe?.recipeName}"`, 'success');
      setDuplicating(null);
      setDuplicateName('');
      loadRecipes();
    } catch (err) {
      showToast(err.response?.data?.message || 'Duplicate failed', 'error');
    }
  };

  const handleOpenVersions = async (recipe) => {
    setViewingVersions(recipe);
    setLoadingVersions(true);
    try {
      const res = await recipeAPI.getVersions(recipe._id);
      setVersionHistory(res.data?.history || []);
    } catch (err) {
      showToast('Failed to load version history', 'error');
      setVersionHistory([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRestoreVersion = async () => {
    if (!restoreConfirm || !viewingVersions) return;
    try {
      const res = await recipeAPI.restoreVersion(viewingVersions._id, restoreConfirm.versionIndex);
      showToast(res.data?.message || 'Version restored', 'success');
      setRestoreConfirm(null);
      setViewingVersions(null);
      loadRecipes();
    } catch (err) {
      showToast(err.response?.data?.message || 'Restore failed', 'error');
    }
  };

  const filteredRecipes = recipes.filter((r) => {
    const matchesSearch = r.recipeName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !filterCategory || r.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 space-y-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ═══════════ HEADER ═══════════ */}
      <div
        className="p-5 rounded-2xl"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
              Recipe Management
            </h1>
            <p className="text-sm mt-0.5" style={{ color: C.muted }}>
              Create, version & execute PLC parameter sets
            </p>
          </div>

          {activeTab === 'recipes' && (
            <button
              onClick={() => { setEditingRecipe(null); setShowForm(true); }}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              title="Create a new recipe"
            >
              <Plus className="w-5 h-5 text-white" />
              <span className="text-white">Create Recipe</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══════════ TABS ═══════════ */}
      <div
        className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: C.cardSubtle, border: `1px solid ${C.border}` }}
      >
        <TabButton
          active={activeTab === 'recipes'}
          onClick={() => setActiveTab('recipes')}
          icon={FileText}
          label={`Recipes (${recipes.length})`}
        />
        <TabButton
          active={activeTab === 'logs'}
          onClick={() => setActiveTab('logs')}
          icon={ListChecks}
          label={`Execution Log (${logSummary.total})`}
        />
      </div>

      {/* ═══════════ STATS (recipes tab) ═══════════ */}
      {activeTab === 'recipes' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Recipes" value={recipes.length} color={C.brand} icon={FileText} />
          <StatCard label="Active" value={recipes.filter(r => r.isActive).length} color={C.success} icon={CheckCircle} />
          <StatCard label="Categories" value={categories.length} color={C.purple} icon={ListChecks} />
          <StatCard label="Parameters" value={recipes.reduce((s, r) => s + (r.parameters?.length || 0), 0)} color={C.warning} icon={ArrowUpDown} />
        </div>
      )}

      {/* ═══════════ STATS (logs tab) ═══════════ */}
      {activeTab === 'logs' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Executions" value={logSummary.total} color={C.brand} icon={ListChecks} />
          <StatCard label="Success" value={logSummary.success} color={C.success} icon={CheckCircle} />
          <StatCard label="Partial" value={logSummary.partial} color={C.warning} icon={AlertTriangle} />
          <StatCard label="Failed" value={logSummary.failed} color={C.danger} icon={XCircle} />
        </div>
      )}

      {/* ═══════════ FILTERS ═══════════ */}
      {activeTab === 'recipes' && (
        <div
          className="p-3 rounded-xl"
          style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.04)' }}
        >
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.subtle }} />
              <input
                type="text"
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded pl-10 pr-3 py-2 outline-none text-sm"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
                onFocus={(e) => e.target.style.borderColor = C.brand}
                onBlur={(e) => e.target.style.borderColor = C.border}
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-48 rounded px-3 py-2 outline-none text-sm"
              style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
              onFocus={(e) => e.target.style.borderColor = C.brand}
              onBlur={(e) => e.target.style.borderColor = C.border}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div
          className="p-3 rounded-xl"
          style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.04)' }}
        >
          <div className="flex gap-3 items-center">
            <select
              value={logStatusFilter}
              onChange={(e) => setLogStatusFilter(e.target.value)}
              className="rounded px-3 py-2 outline-none text-sm"
              style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">✅ Success</option>
              <option value="PARTIAL">⚠️ Partial</option>
              <option value="FAILED">❌ Failed</option>
              <option value="CANCELLED">⊘ Cancelled</option>
            </select>

            <select
              value={logRecipeFilter}
              onChange={(e) => setLogRecipeFilter(e.target.value)}
              className="rounded px-3 py-2 outline-none text-sm min-w-[200px]"
              style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
            >
              <option value="">All Recipes</option>
              {recipes.map((r) => (
                <option key={r._id} value={r._id}>{r.recipeName}</option>
              ))}
            </select>

            <button
              onClick={loadLogs}
              disabled={logsLoading}
              className="flex items-center gap-1 px-3 py-2 rounded text-sm font-semibold"
              style={{ background: C.card, color: C.text, border: `1px solid ${C.border}` }}
            >
              <RefreshCw size={14} className={logsLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ ERROR ═══════════ */}
      {error && (
        <div
          className="p-3 rounded-lg text-sm flex items-center gap-2"
          style={{ background: '#FEE2E2', border: `1px solid ${C.danger}`, color: '#B91C1C' }}
        >
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* ═══════════ CONTENT ═══════════ */}
      {activeTab === 'recipes' && (
        loading ? (
          <LoadingCard message="Loading recipes..." />
        ) : filteredRecipes.length === 0 && !searchQuery && !filterCategory ? (
          <EmptyStateCard
            icon={FileText}
            title="No Recipes Yet"
            hint="Create your first recipe to start automating parameter sets"
            action={{
              label: '+ Create Recipe',
              onClick: () => { setEditingRecipe(null); setShowForm(true); },
            }}
          />
        ) : (
          <RecipeList
            recipes={filteredRecipes}
            onExecute={(recipe) => setExecutingRecipe(recipe)}
            onEdit={(recipe) => { setEditingRecipe(recipe); setShowForm(true); }}
            onDelete={(recipe) => setDeleteConfirm(recipe)}
            onView={(recipe) => setViewingRecipe(recipe)}
            onDuplicate={handleOpenDuplicate}
            onViewVersions={handleOpenVersions}
          />
        )
      )}

      {activeTab === 'logs' && (
        logsLoading ? (
          <LoadingCard message="Loading execution logs..." />
        ) : logs.length === 0 ? (
          <EmptyStateCard
            icon={HistoryIcon}
            title="No Execution History"
            hint="Recipe executions will appear here"
          />
        ) : (
          <LogsList logs={logs} onView={setViewingLog} />
        )
      )}

      {/* ═══════════ MODALS ═══════════ */}
      {showForm && (
        <RecipeForm
          recipe={editingRecipe}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditingRecipe(null); }}
        />
      )}

      {executingRecipe && (
        <RecipeExecute
          recipe={executingRecipe}
          onExecute={handleExecute}
          onClose={() => setExecutingRecipe(null)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirmed}
        title="Delete Recipe?"
        message={`Delete "${deleteConfirm?.recipeName}"? This cannot be undone.`}
        confirmText="Delete"
        confirmColor="red"
        icon="warning"
      />

      {/* Duplicate modal */}
      <Modal
        isOpen={!!duplicating}
        onClose={() => { setDuplicating(null); setDuplicateName(''); }}
        title="Duplicate Recipe"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: C.text }}>
            Create a copy of <strong style={{ color: C.heading }}>{duplicating?.recipeName}</strong> as a template for a new recipe.
          </p>
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: C.heading }}>
              New Recipe Name
            </label>
            <input
              type="text"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              placeholder="Enter new name"
              className="w-full px-3 py-2 rounded-lg outline-none"
              style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
              onFocus={(e) => e.target.style.borderColor = C.brand}
              onBlur={(e) => e.target.style.borderColor = C.border}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleDuplicate()}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setDuplicating(null); setDuplicateName(''); }}
              className="flex-1 px-4 py-2 rounded-lg font-semibold"
              style={{ background: C.cardSubtle, color: C.heading, border: `1px solid ${C.border}` }}
            >
              Cancel
            </button>
            <button
              onClick={handleDuplicate}
              disabled={!duplicateName.trim()}
              className="flex-1 px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50"
              style={{ background: C.btnPrimary, fontFamily: "'Montserrat', sans-serif" }}
            >
              <Copy className="w-4 h-4 inline mr-2" />
              Duplicate
            </button>
          </div>
        </div>
      </Modal>

      {/* Version history modal */}
      <Modal
        isOpen={!!viewingVersions}
        onClose={() => { setViewingVersions(null); setVersionHistory([]); }}
        title={`Version History — ${viewingVersions?.recipeName || ''}`}
        size="lg"
      >
        {loadingVersions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.brand }} />
          </div>
        ) : versionHistory.length === 0 ? (
          <p className="text-center py-6" style={{ color: C.muted }}>
            No version history yet. History is created when parameters change.
          </p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            <p className="text-xs mb-3" style={{ color: C.muted }}>
              Current version: <strong style={{ color: C.brand }}>v{viewingVersions?.version}</strong> · {versionHistory.length} previous version(s)
            </p>
            {versionHistory.map((v, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded font-mono text-xs font-bold"
                      style={{ background: C.cardHover, color: C.brand }}
                    >
                      v{v.version}
                    </span>
                    <span className="text-xs" style={{ color: C.muted }}>
                      {v.savedBy} · {new Date(v.savedAt).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => setRestoreConfirm({ versionIndex: idx, version: v.version })}
                    className="px-3 py-1 text-xs rounded font-semibold text-white"
                    style={{ background: C.warning }}
                  >
                    Restore
                  </button>
                </div>
                {v.changeNote && (
                  <p className="text-xs mb-2 italic" style={{ color: C.text }}>
                    "{v.changeNote}"
                  </p>
                )}
                <p className="text-xs" style={{ color: C.subtle }}>
                  {v.parameters?.length || 0} parameter{v.parameters?.length !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!restoreConfirm}
        onClose={() => setRestoreConfirm(null)}
        onConfirm={handleRestoreVersion}
        title="Restore This Version?"
        message={`Restore parameters from v${restoreConfirm?.version}? Current version will be saved to history and a new version will be created.`}
        confirmText="Restore"
        confirmColor="yellow"
        icon="question"
      />

      {/* View Details modal */}
      <Modal
        isOpen={!!viewingRecipe}
        onClose={() => setViewingRecipe(null)}
        title={viewingRecipe?.recipeName || 'Recipe Details'}
        size="lg"
      >
        {viewingRecipe && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoField label="Category" value={viewingRecipe.category} />
              <InfoField label="Version" value={`v${viewingRecipe.version}`} />
              <InfoField label="Created By" value={viewingRecipe.createdBy} />
              <InfoField label="Created" value={new Date(viewingRecipe.createdAt).toLocaleString()} />
              <InfoField label="Executions" value={viewingRecipe.executionCount || 0} />
              <InfoField
                label="Last Executed"
                value={viewingRecipe.lastExecutedAt ? new Date(viewingRecipe.lastExecutedAt).toLocaleString() : 'Never'}
              />
            </div>
            {viewingRecipe.description && (
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: C.muted }}>DESCRIPTION</p>
                <p className="text-sm" style={{ color: C.text }}>{viewingRecipe.description}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: C.muted }}>
                PARAMETERS ({viewingRecipe.parameters?.length || 0})
              </p>
              <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                <table className="w-full text-sm">
                  <thead style={{ background: C.cardSubtle }}>
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: C.muted }}>Tag</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: C.muted }}>Value</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: C.muted }}>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingRecipe.parameters?.map((p, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td className="px-3 py-2 font-mono text-xs" style={{ color: C.heading }}>{p.tagName}</td>
                        <td className="px-3 py-2 font-mono text-xs font-bold" style={{ color: C.brand }}>{String(p.value)}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: C.muted }}>{p.unit || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* View Log detail modal */}
      <Modal
        isOpen={!!viewingLog}
        onClose={() => setViewingLog(null)}
        title="Execution Details"
        size="lg"
      >
        {viewingLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoField label="Recipe" value={viewingLog.recipeName} />
              <InfoField label="Version" value={`v${viewingLog.recipeVersion}`} />
              <InfoField label="Executed By" value={viewingLog.executedBy} />
              <InfoField label="Executed At" value={new Date(viewingLog.executedAt).toLocaleString()} />
              <InfoField label="Duration" value={`${viewingLog.durationMs}ms`} />
              <InfoField
                label="Status"
                value={
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      background: STATUS_COLORS[viewingLog.status]?.bg,
                      color: STATUS_COLORS[viewingLog.status]?.text,
                    }}
                  >
                    {viewingLog.status}
                  </span>
                }
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded" style={{ background: C.cardSubtle }}>
                <p className="text-2xl font-bold" style={{ color: C.heading }}>{viewingLog.totalParameters}</p>
                <p className="text-xs" style={{ color: C.muted }}>Total</p>
              </div>
              <div className="p-2 rounded" style={{ background: '#DCFCE7' }}>
                <p className="text-2xl font-bold" style={{ color: C.success }}>{viewingLog.successCount}</p>
                <p className="text-xs" style={{ color: '#15803D' }}>Success</p>
              </div>
              <div className="p-2 rounded" style={{ background: '#FEE2E2' }}>
                <p className="text-2xl font-bold" style={{ color: C.danger }}>{viewingLog.failedCount}</p>
                <p className="text-xs" style={{ color: '#B91C1C' }}>Failed</p>
              </div>
            </div>

            {viewingLog.note && (
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: C.muted }}>NOTE</p>
                <p className="text-sm italic" style={{ color: C.text }}>"{viewingLog.note}"</p>
              </div>
            )}

            {viewingLog.results?.failed?.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: C.danger }}>FAILED PARAMETERS</p>
                <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.danger}40` }}>
                  {viewingLog.results.failed.map((f, i) => (
                    <div key={i} className="px-3 py-2 text-xs" style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                      <span className="font-mono font-bold" style={{ color: C.heading }}>{f.tagName}</span>
                      <span className="ml-2" style={{ color: C.danger }}>{f.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors"
    style={{
      background: active ? C.brand : 'transparent',
      color: active ? '#FFFFFF' : C.muted,
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = C.heading; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = C.muted; }}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

const StatCard = ({ label, value, color, icon: Icon }) => (
  <div
    className="p-4 rounded-xl"
    style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.04)' }}
  >
    <div className="flex items-center gap-2 mb-1">
      {Icon && <Icon className="w-4 h-4" style={{ color }} />}
      <span className="text-xs font-semibold" style={{ color: C.muted }}>{label}</span>
    </div>
    <p className="text-2xl font-bold" style={{ color, fontFamily: "'Montserrat', sans-serif" }}>{value}</p>
  </div>
);

const LoadingCard = ({ message }) => (
  <div
    className="p-12 text-center rounded-2xl"
    style={{ background: C.card, border: `1px solid ${C.border}` }}
  >
    <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: C.brand }} />
    <p style={{ color: C.muted }}>{message}</p>
  </div>
);

const EmptyStateCard = ({ icon: Icon, title, hint, action }) => (
  <div
    className="p-12 text-center rounded-2xl"
    style={{ background: C.card, border: `1px solid ${C.border}` }}
  >
    <Icon className="w-12 h-12 mx-auto mb-3" style={{ color: C.subtle }} />
    <h3 className="text-lg font-semibold mb-2" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
      {title}
    </h3>
    <p className="text-sm mb-4" style={{ color: C.muted }}>{hint}</p>
    {action && (
      <button
        onClick={action.onClick}
        className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium transition-colors shadow-sm"
      >
        <Plus className="w-5 h-5 text-white" />
        <span className="text-white">+ Create Recipe</span>
      </button>
    )}
  </div>
);

const InfoField = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold mb-1" style={{ color: C.muted }}>{label.toUpperCase()}</p>
    <p className="text-sm" style={{ color: C.heading }}>{value}</p>
  </div>
);

const LogsList = ({ logs, onView }) => (
  <div
    className="rounded-2xl overflow-hidden"
    style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
  >
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Recipe</th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Version</th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Executed By</th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Result</th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Duration</th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Time</th>
            <th className="text-center px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, idx) => {
            const sc = STATUS_COLORS[log.status] || STATUS_COLORS.SUCCESS;
            return (
              <tr
                key={log._id}
                style={{
                  borderBottom: idx < logs.length - 1 ? `1px solid ${C.border}` : 'none',
                  background: C.card,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = C.cardSubtle}
                onMouseLeave={(e) => e.currentTarget.style.background = C.card}
              >
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-1 rounded text-xs font-bold"
                    style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
                  >
                    {log.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-sm" style={{ color: C.heading }}>{log.recipeName}</td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: C.brand }}>v{log.recipeVersion}</td>
                <td className="px-4 py-3 text-sm" style={{ color: C.text }}>{log.executedBy}</td>
                <td className="px-4 py-3 text-xs">
                  <span style={{ color: C.success }}>✓ {log.successCount}</span>
                  {log.failedCount > 0 && (
                    <span style={{ color: C.danger }} className="ml-2">✗ {log.failedCount}</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: C.muted }}>{log.durationMs}ms</td>
                <td className="px-4 py-3 text-xs" style={{ color: C.muted }}>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(log.executedAt).toLocaleString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onView(log)}
                    className="px-3 py-1 text-xs font-semibold rounded transition-colors"
                    style={{ background: C.cardHover, color: C.brand }}
                    title="View details"
                  >
                    Details
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

export default Recipes;