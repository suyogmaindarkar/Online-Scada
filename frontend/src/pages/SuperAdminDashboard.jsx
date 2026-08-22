// ═══════════════════════════════════════════════════════════
// SuperAdminDashboard — Platform control center
// Added: Export All Users CSV button
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext';
import { superAdminAPI } from '../services/api';
import CompanyCard from '../components/superAdmin/CompanyCard';
import CreateCompanyModal from '../components/superAdmin/CreateCompanyModal';
import EditCompanyModal from '../components/superAdmin/EditCompanyModal';
import ResetPasswordModal from '../components/superAdmin/ResetPasswordModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  ShieldCheck, LogOut, Plus, Search, Loader2, RefreshCw,
  Building2, Users, TrendingUp, AlertTriangle, Filter, Download,
} from 'lucide-react';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { superAdmin, logout } = useSuperAdminAuth();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [search, setSearch]       = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showCreate, setShowCreate]           = useState(false);
  const [editingCompany, setEditingCompany]   = useState(null);
  const [resetPasswordCompany, setResetPasswordCompany] = useState(null);
  const [deletingCompany, setDeletingCompany] = useState(null);

  const loadCompanies = async () => {
    try {
      const res = await superAdminAPI.listCompanies();
      setCompanies(res.data.data || []);
    } catch (err) {
      console.error('Failed to load companies:', err);
      if (err.response?.status === 401) {
        logout();
        navigate('/super-admin/login');
      }
    }
  };

  useEffect(() => {
    loadCompanies().finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCompanies();
    setRefreshing(false);
  };

  const handleExportUsers = async () => {
    try {
      setExporting(true);
      const res = await superAdminAPI.exportAllUsersCSV();
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `onlinescada_all_users_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export users CSV: ' + (err.response?.data?.message || err.message));
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Sign out of Super Admin?')) {
      logout();
      navigate('/super-admin/login');
    }
  };

  const handleSuspend = async (company) => {
    const reason = prompt(`Suspend "${company.companyName}"?\nEnter reason (optional):`, 'Payment overdue');
    if (reason === null) return;
    try {
      await superAdminAPI.updateCompany(company._id, {
        isSuspended: true,
        suspensionReason: reason,
      });
      await loadCompanies();
    } catch (err) {
      alert('Suspend failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleActivate = async (company) => {
    try {
      await superAdminAPI.updateCompany(company._id, {
        isActive: true,
        isSuspended: false,
        suspensionReason: '',
      });
      await loadCompanies();
    } catch (err) {
      alert('Activate failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async () => {
    if (!deletingCompany) return;
    try {
      await superAdminAPI.deleteCompany(deletingCompany._id);
      setDeletingCompany(null);
      await loadCompanies();
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const filtered = companies.filter(c => {
    const searchLower = search.toLowerCase();
    if (search && !c.companyName.toLowerCase().includes(searchLower) &&
        !c.slug.toLowerCase().includes(searchLower) &&
        !c.contactEmail.toLowerCase().includes(searchLower)) return false;
    if (planFilter !== 'all' && c.plan !== planFilter) return false;
    if (statusFilter === 'active' && (!c.isActive || c.isSuspended || c.isExpiredNow)) return false;
    if (statusFilter === 'suspended' && !c.isSuspended) return false;
    if (statusFilter === 'expired' && !c.isExpiredNow) return false;
    return true;
  });

  const totalCompanies = companies.length;
  const activeCompanies = companies.filter(c => c.isActive && !c.isSuspended && !c.isExpiredNow).length;
  const totalUsers = companies.reduce((sum, c) => sum + (c.stats?.userCount || 0), 0);
  const suspendedCount = companies.filter(c => c.isSuspended || c.isExpiredNow).length;

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0F172A',
      }}>
        <Loader2 style={{ width: 48, height: 48, color: '#DC2626', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0F172A 0%, #020617 100%)',
      color: '#F8FAFC',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* HEADER */}
      <header style={{
        padding: '16px 24px',
        background: 'rgba(15,23,42,0.9)',
        borderBottom: '1px solid rgba(148,163,184,0.15)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '10px',
          background: 'linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldCheck style={{ width: 22, height: 22, color: '#FFFFFF' }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{
            fontSize: '16px', fontWeight: 700, color: '#F8FAFC', margin: 0,
            fontFamily: "'Montserrat', sans-serif",
          }}>
            Super Admin <span style={{ color: '#DC2626' }}>·</span> Platform Control
          </p>
          <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
            Signed in as <strong style={{ color: '#F1F5F9' }}>{superAdmin?.fullName || superAdmin?.email}</strong>
          </p>
        </div>

        {/* Export Users CSV Button */}
        <button
          onClick={handleExportUsers}
          disabled={exporting}
          style={{
            ...darkButtonStyle,
            background: '#16A34A',
            color: '#FFFFFF',
            border: 'none',
          }}
          title="Export Directory of All Users across all Workspaces to CSV"
        >
          {exporting ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Download style={{ width: 14, height: 14 }} />}
          Export Users CSV
        </button>

        <button onClick={handleRefresh} disabled={refreshing} style={darkButtonStyle} title="Refresh companies">
          <RefreshCw style={{ width: 14, height: 14, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
        <button onClick={handleLogout} style={{ ...darkButtonStyle, background: 'rgba(220,38,38,0.15)', color: '#FCA5A5', borderColor: 'rgba(220,38,38,0.3)' }}>
          <LogOut style={{ width: 14, height: 14 }} />
          Sign Out
        </button>
      </header>

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* STATS ROW */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px',
          marginBottom: '20px',
        }}>
          <StatCard icon={Building2} label="Total Companies" value={totalCompanies} color="#2563EB" />
          <StatCard icon={TrendingUp} label="Active" value={activeCompanies} color="#16A34A" />
          <StatCard icon={Users} label="Total Users" value={totalUsers} color="#9333EA" />
          <StatCard icon={AlertTriangle} label="Suspended/Expired" value={suspendedCount} color="#DC2626" />
        </div>

        {/* CONTROLS BAR */}
        <div style={{
          display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '240px' }}>
            <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#64748B' }} />
            <input
              type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, slug, or email…"
              style={{
                width: '100%', padding: '9px 12px 9px 32px',
                borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)',
                background: 'rgba(15,23,42,0.6)', color: '#F8FAFC',
                fontSize: '13px', outline: 'none',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#2563EB'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.2)'; }}
            />
          </div>

          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} style={darkSelectStyle}>
            <option value="all">All Plans</option>
            <option value="trial">Trial</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={darkSelectStyle}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="expired">Expired</option>
          </select>

          <button onClick={() => setShowCreate(true)}
            style={{
              padding: '9px 16px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
              color: '#FFFFFF', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              fontFamily: "'Montserrat', sans-serif",
              boxShadow: '0px 4px 12px rgba(22,163,74,0.3)',
            }}>
            <Plus style={{ width: 14, height: 14 }} />
            Create Company
          </button>
        </div>

        {/* COMPANY GRID */}
        {filtered.length === 0 ? (
          <div style={{
            padding: '60px 20px', textAlign: 'center',
            background: 'rgba(15,23,42,0.5)', borderRadius: '12px',
            border: '1px solid rgba(148,163,184,0.1)',
          }}>
            <Filter style={{ width: 40, height: 40, color: '#64748B', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '16px', color: '#CBD5E1', fontWeight: 700 }}>
              {companies.length === 0 ? 'No companies yet' : 'No matches'}
            </p>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
              {companies.length === 0 ? 'Create your first company to get started' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px',
          }}>
            {filtered.map(company => (
              <CompanyCard
                key={company._id}
                company={company}
                onEdit={setEditingCompany}
                onResetPassword={setResetPasswordCompany}
                onSuspend={handleSuspend}
                onActivate={handleActivate}
                onDelete={setDeletingCompany}
              />
            ))}
          </div>
        )}
      </div>

      <CreateCompanyModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => loadCompanies()}
      />

      <EditCompanyModal
        isOpen={!!editingCompany}
        onClose={() => setEditingCompany(null)}
        company={editingCompany}
        onUpdated={() => loadCompanies()}
      />

      <ResetPasswordModal
        isOpen={!!resetPasswordCompany}
        onClose={() => setResetPasswordCompany(null)}
        company={resetPasswordCompany}
      />

      <ConfirmDialog
        isOpen={!!deletingCompany}
        onClose={() => setDeletingCompany(null)}
        onConfirm={handleDelete}
        title="Delete Company?"
        message={`This will PERMANENTLY delete "${deletingCompany?.companyName}" and ALL its data. This action cannot be undone.`}
        confirmText="Delete Forever"
        confirmColor="red"
        icon="warning"
      />
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div style={{
    padding: '14px 16px', borderRadius: '10px',
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(148,163,184,0.15)',
    display: 'flex', alignItems: 'center', gap: '12px',
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: '10px',
      background: `${color}20`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon style={{ width: 20, height: 20, color }} />
    </div>
    <div>
      <p style={{ fontSize: '10px', color: '#94A3B8', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{
        fontSize: '20px', fontWeight: 700, color: '#F8FAFC', margin: 0,
        fontFamily: "'Montserrat', sans-serif",
      }}>
        {value}
      </p>
    </div>
  </div>
);

const darkButtonStyle = {
  padding: '8px 12px', borderRadius: '8px',
  border: '1px solid rgba(148,163,184,0.2)',
  background: 'rgba(15,23,42,0.6)', color: '#F1F5F9',
  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '6px',
};

const darkSelectStyle = {
  padding: '9px 12px', borderRadius: '8px',
  border: '1px solid rgba(148,163,184,0.2)',
  background: 'rgba(15,23,42,0.6)', color: '#F8FAFC',
  fontSize: '13px', outline: 'none', cursor: 'pointer',
  fontFamily: 'inherit',
};

export default SuperAdminDashboard;