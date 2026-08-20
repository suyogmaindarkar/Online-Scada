// ═══════════════════════════════════════════════════════════
// CompanyCard — Individual company display in super admin dashboard
// Shows plan, status, usage bars with color-coded warnings
// ═══════════════════════════════════════════════════════════

import {
  Building2, Users, Cpu, Tag, Monitor,
  Pause, Play, Edit2, Trash2, Key,
  CheckCircle2, AlertTriangle, XCircle, Clock,
} from 'lucide-react';

// ─── Plan color config ───────────────────────────────────
const PLAN_COLORS = {
  trial:      { bg: '#FEF9C3', color: '#78350F', label: 'TRIAL' },
  starter:    { bg: '#DBEAFE', color: '#1E40AF', label: 'STARTER' },
  pro:        { bg: '#F3E8FF', color: '#6B21A8', label: 'PRO' },
  enterprise: { bg: '#DCFCE7', color: '#166534', label: 'ENTERPRISE' },
};

// ─── Usage bar with color threshold ──────────────────────
const UsageBar = ({ label, current, max, icon: Icon }) => {
  const pct = Math.min(100, (current / max) * 100);
  let color = '#16A34A'; // green
  if (pct >= 90) color = '#DC2626';       // red
  else if (pct >= 70) color = '#F59E0B';  // yellow

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icon style={{ width: 12, height: 12, color: '#5F6B7A' }} />
          <span style={{ fontSize: '11px', color: '#5F6B7A', fontWeight: 500 }}>{label}</span>
        </div>
        <span style={{ fontSize: '11px', fontFamily: 'monospace', color, fontWeight: 700 }}>
          {current}/{max}
        </span>
      </div>
      <div style={{ height: '4px', borderRadius: '2px', background: '#F1F5F9', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
};

const CompanyCard = ({ company, onEdit, onDelete, onResetPassword, onSuspend, onActivate }) => {
  const plan = PLAN_COLORS[company.plan] || PLAN_COLORS.trial;
  const limits = company.limits || {};
  const stats = company.stats || {};

  // Status color
  let statusColor = '#16A34A';
  let statusBg = '#DCFCE7';
  let statusText = 'ACTIVE';
  let StatusIcon = CheckCircle2;

  if (company.isExpiredNow) {
    statusColor = '#DC2626'; statusBg = '#FEE2E2'; statusText = 'EXPIRED'; StatusIcon = XCircle;
  } else if (company.isSuspended) {
    statusColor = '#F59E0B'; statusBg = '#FEF3C7'; statusText = 'SUSPENDED'; StatusIcon = AlertTriangle;
  } else if (!company.isActive) {
    statusColor = '#64748B'; statusBg = '#F1F5F9'; statusText = 'INACTIVE'; StatusIcon = Pause;
  }

  // Trial days remaining
  let trialInfo = null;
  if (company.plan === 'trial' && company.trialEndsAt) {
    const daysLeft = Math.ceil((new Date(company.trialEndsAt) - new Date()) / (24 * 60 * 60 * 1000));
    if (daysLeft > 0) {
      trialInfo = { text: `${daysLeft}d trial left`, color: daysLeft <= 3 ? '#DC2626' : '#F59E0B' };
    } else {
      trialInfo = { text: 'Trial expired', color: '#DC2626' };
    }
  }

  return (
    <div style={{
      padding: '16px', background: '#FFFFFF',
      border: `1px solid ${company.isSuspended ? '#F59E0B60' : company.isExpiredNow ? '#DC262660' : '#E5E7EB'}`,
      borderRadius: '12px',
      boxShadow: '0px 2px 8px rgba(8,27,67,0.04)',
      transition: 'all 0.15s ease',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0px 8px 24px rgba(8,27,67,0.08)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0px 2px 8px rgba(8,27,67,0.04)'; }}
    >
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
          background: 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Building2 style={{ width: 20, height: 20, color: '#FFFFFF' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: '15px', fontWeight: 700, color: '#081B43', margin: 0,
            fontFamily: "'Montserrat', sans-serif",
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={company.companyName}>
            {company.companyName}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <code style={{ fontSize: '10px', color: '#5F6B7A', fontFamily: 'monospace' }}>
              /{company.slug}
            </code>
            {company.country && <span style={{ fontSize: '10px', color: '#94A3B8' }}>· {company.country}</span>}
          </div>
        </div>
      </div>

      {/* ─── Status + Plan Badges ─── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        <span style={{
          padding: '3px 8px', borderRadius: '999px',
          background: statusBg, color: statusColor,
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.03em',
          display: 'inline-flex', alignItems: 'center', gap: '4px',
        }}>
          <StatusIcon style={{ width: 10, height: 10 }} />
          {statusText}
        </span>
        <span style={{
          padding: '3px 8px', borderRadius: '999px',
          background: plan.bg, color: plan.color,
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.03em',
        }}>
          {plan.label}
        </span>
        {trialInfo && (
          <span style={{
            padding: '3px 8px', borderRadius: '999px',
            background: `${trialInfo.color}15`, color: trialInfo.color,
            fontSize: '10px', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}>
            <Clock style={{ width: 10, height: 10 }} />
            {trialInfo.text}
          </span>
        )}
      </div>

      {/* ─── Contact ─── */}
      <div style={{ marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid #F1F5F9' }}>
        <p style={{ fontSize: '11px', color: '#334155', margin: 0 }}>
          <span style={{ color: '#94A3B8' }}>Contact:</span> {company.contactName || '—'}
        </p>
        <p style={{ fontSize: '10px', color: '#5F6B7A', margin: '2px 0 0', fontFamily: 'monospace' }}>
          {company.contactEmail}
        </p>
      </div>

      {/* ─── Usage Bars ─── */}
      <div style={{ marginBottom: '12px' }}>
        <UsageBar label="Users"   current={stats.userCount   || 0} max={limits.maxUsers   || 0} icon={Users} />
        <UsageBar label="PLCs"    current={stats.plcCount    || 0} max={limits.maxPLCs    || 0} icon={Cpu} />
        <UsageBar label="Tags"    current={stats.tagCount    || 0} max={limits.maxTags    || 0} icon={Tag} />
        <UsageBar label="Screens" current={stats.screenCount || 0} max={limits.maxScreens || 0} icon={Monitor} />
      </div>

      {/* ─── Actions ─── */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <IconButton onClick={() => onEdit(company)} label="Edit" color="#2563EB" icon={Edit2} />
        <IconButton onClick={() => onResetPassword(company)} label="Reset Password" color="#F59E0B" icon={Key} />
        {company.isSuspended || !company.isActive ? (
          <IconButton onClick={() => onActivate(company)} label="Activate" color="#16A34A" icon={Play} />
        ) : (
          <IconButton onClick={() => onSuspend(company)} label="Suspend" color="#F59E0B" icon={Pause} />
        )}
        <IconButton onClick={() => onDelete(company)} label="Delete" color="#DC2626" icon={Trash2} />
      </div>

      {/* Created date */}
      <p style={{
        fontSize: '9px', color: '#CBD5E1', textAlign: 'center',
        marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #F8FAFC',
      }}>
        Created {new Date(company.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
};

// ─── Compact icon button ─────────────────────────────────
const IconButton = ({ onClick, label, color, icon: Icon }) => (
  <button
    onClick={onClick}
    title={label}
    style={{
      flex: 1, minWidth: '48px',
      padding: '6px', borderRadius: '6px', border: `1px solid ${color}30`,
      background: 'transparent', color: color,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s ease',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = color; e.currentTarget.style.color = '#FFFFFF'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = color; }}
  >
    <Icon style={{ width: 14, height: 14 }} />
  </button>
);

export default CompanyCard;