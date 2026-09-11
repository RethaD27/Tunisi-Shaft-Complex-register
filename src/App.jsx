import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench, Search, CheckCircle2, AlertTriangle, Clock3, Radio,
  ChevronDown, X, Loader2
} from 'lucide-react';

const STORAGE_KEY = 'tunisi-11shaft-breakdowns';

const EQUIPMENT = ['Winch', 'Loco', 'Conveyor', 'Pump', 'Fan', 'Crane', 'Mini-sub', 'Phone'];
const PREFIX = { Winch: 'WN', Loco: 'LC', Conveyor: 'CV', Pump: 'PM', Fan: 'FN', Crane: 'CR', 'Mini-sub': 'MS', Phone: 'PH' };
const CATEGORIES = ['Electrical', 'Mechanical', 'Trip/Overload', 'Brake Failure', 'Cable Damage', 'Control/Instrumentation', 'Communication', 'Other'];
const PLACES = ['Chrome North', 'Chrome South', 'Merensky North', 'Merensky South', 'Crosscut', 'Battery Bay', 'Station', 'Workshop', 'Tip', 'Other'];
const LEVELS = [12, 18, 20, 22, 24, 25, 26, 28, 30];
const OPERATORS = ['Operator 01', 'Operator 02', 'Operator 03', 'Operator 04', 'Operator 05', 'Operator 06'];
const ARTISANS = ['Artisan 01', 'Artisan 02', 'Artisan 03', 'Artisan 04', 'Artisan 05', 'Artisan 06'];

const DETAILS = {
  'Electrical': ['Tripped on overload — contactor fault', 'Cable burnt at joint', 'Earth leakage detected'],
  'Mechanical': ['Coupling fault — misalignment', 'Bearing seized', 'Oil leak — loose fastener', 'Gearbox noise — worn gear'],
  'Trip/Overload': ['Motor tripped — overcurrent', 'Breaker tripped on start-up'],
  'Brake Failure': ['Low braking performance — worn brake component', 'Brake pads worn out'],
  'Cable Damage': ['Trailing cable cut — rock fall', 'Cable insulation damaged'],
  'Control/Instrumentation': ['Interlock fault — control wiring fault', 'Sensor giving false reading'],
  'Communication': ['Radio communication failure — power loss', 'Phone line dead — cable fault'],
  'Other': ['Unknown fault — under investigation'],
};

const FIX_ACTIONS = [
  'Replaced faulty component', 'Cable repaired and tested', 'Adjusted and retested',
  'Reset and confirmed operational', 'Component cleaned and refitted', 'Escalated part replaced',
];

// deterministic PRNG so the seed dataset is stable
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n, len) { return String(n).padStart(len, '0'); }

function generateSeed() {
  const rnd = mulberry32(11548);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const counts = { Loco: 10, Winch: 9, Conveyor: 5, Fan: 4, Pump: 4, 'Mini-sub': 3, Phone: 2, Crane: 1 };
  const records = [];
  let bd = 500;
  const assetCounters = {};

  Object.entries(counts).forEach(([equip, count]) => {
    for (let i = 0; i < count; i++) {
      assetCounters[equip] = (assetCounters[equip] || 0) + (rnd() > 0.55 ? 1 : 0);
      const num = 1 + (assetCounters[equip] || 0) + Math.floor(rnd() * 6);
      const assetId = `${PREFIX[equip]}-${pad(num, 3)}`;
      const category = pick(CATEGORIES);
      const detail = pick(DETAILS[category]);
      const day = 1 + Math.floor(rnd() * 39); // Aug 1 - Sep 8 2026
      const month = day <= 31 ? 8 : 9;
      const dom = day <= 31 ? day : day - 31;
      const hour = Math.floor(rnd() * 24);
      const minute = Math.floor(rnd() * 60);
      const shift = hour >= 6 && hour < 18 ? 'Day' : 'Night';
      const reportedAt = new Date(2026, month - 1, dom, hour, minute).getTime();

      const roll = rnd();
      let status, attendedAt = null, attendedBy = null, fixedAt = null, fixedBy = null, action = null;
      if (roll < 0.78) {
        status = 'fixed';
        attendedBy = pick(ARTISANS);
        attendedAt = reportedAt + (10 + rnd() * 40) * 60000;
        fixedBy = attendedBy;
        fixedAt = attendedAt + (15 + rnd() * 300) * 60000;
        action = pick(FIX_ACTIONS);
      } else if (roll < 0.92) {
        status = 'not_fixed';
        attendedBy = pick(ARTISANS);
        attendedAt = reportedAt + (10 + rnd() * 60) * 60000;
      } else {
        status = 'awaiting';
      }

      records.push({
        id: `BD-${pad(bd++, 5)}`,
        equipment: equip,
        assetId,
        level: pick(LEVELS),
        section: String(11000 + Math.floor(rnd() * 900)),
        place: pick(PLACES),
        category,
        detail,
        shift,
        reportedBy: pick(OPERATORS),
        reportedAt,
        status, attendedAt, attendedBy, fixedAt, fixedBy, action,
      });
    }
  });

  return records.sort((a, b) => b.reportedAt - a.reportedAt);
}

function fmtDate(ts) {
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${pad(d.getDate(),2)}-${months[d.getMonth()]}-${d.getFullYear()}`;
}
function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours(),2)}:${pad(d.getMinutes(),2)}`;
}
function hoursBetween(a, b) {
  return Math.max(0, (b - a) / 3600000);
}
function fmtHours(h) {
  if (h < 10) return h.toFixed(1);
  return String(Math.round(h));
}

const STATUS_META = {
  awaiting: { label: 'AWAITING ATTENDANCE', color: '#E2685F', bg: 'rgba(226,104,95,0.14)' },
  not_fixed: { label: 'NOT FIXED', color: '#E0A640', bg: 'rgba(224,166,64,0.14)' },
  fixed: { label: 'FIXED', color: '#34C98D', bg: 'rgba(52,201,141,0.14)' },
};

export default function App() {
  const [breakdowns, setBreakdowns] = useState(null);
  const [tab, setTab] = useState('overview');
  const [nowTick, setNowTick] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [mode, setMode] = useState('local'); // 'shared' (Supabase, live) or 'local' (this browser only)

  useEffect(() => {
    load();
    // If the storage backend supports realtime push (Supabase mode), subscribe
    // so reports submitted by other people show up here without a reload.
    // The localStorage fallback doesn't implement subscribe(), so this is a
    // no-op there and the app just falls back to per-tab state only.
    let unsubscribe;
    if (window.storage && typeof window.storage.subscribe === 'function') {
      unsubscribe = window.storage.subscribe(STORAGE_KEY, true, (data) => {
        setBreakdowns(data);
      });
    }
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setMode(window.storage && window.storage.mode === 'supabase' ? 'shared' : 'local');
    try {
      const res = await window.storage.get(STORAGE_KEY, true);
      const data = JSON.parse(res.value);
      setBreakdowns(data);
    } catch (e) {
      const seed = generateSeed();
      setBreakdowns(seed);
      try { await window.storage.set(STORAGE_KEY, JSON.stringify(seed), true); } catch (e2) {}
    }
  }

  async function persist(next) {
    setBreakdowns(next);
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(next), true); } catch (e) {}
  }

  function updateRecord(id, patch) {
    const next = breakdowns.map(r => r.id === id ? { ...r, ...patch } : r);
    persist(next);
  }

  function addRecord(record) {
    const next = [record, ...breakdowns];
    persist(next);
  }

  const stats = useMemo(() => {
    if (!breakdowns) return null;
    const total = breakdowns.length;
    const awaiting = breakdowns.filter(r => r.status === 'awaiting').length;
    const followUp = breakdowns.filter(r => r.status === 'not_fixed').length;
    const fixed = breakdowns.filter(r => r.status === 'fixed').length;
    const fixedRate = total ? (fixed / total) * 100 : 0;
    const totalDowntime = breakdowns.reduce((sum, r) => {
      const end = r.status === 'fixed' ? r.fixedAt : nowTick;
      return sum + hoursBetween(r.reportedAt, end);
    }, 0);
    const repairTimes = breakdowns.filter(r => r.status === 'fixed' && r.attendedAt && r.fixedAt)
      .map(r => hoursBetween(r.attendedAt, r.fixedAt) * 60);
    const avgRepairMin = repairTimes.length ? repairTimes.reduce((a,b)=>a+b,0) / repairTimes.length : 0;

    const byEquipCount = {};
    const byEquipDowntime = {};
    EQUIPMENT.forEach(e => { byEquipCount[e] = 0; byEquipDowntime[e] = 0; });
    breakdowns.forEach(r => {
      byEquipCount[r.equipment] = (byEquipCount[r.equipment] || 0) + 1;
      const end = r.status === 'fixed' ? r.fixedAt : nowTick;
      byEquipDowntime[r.equipment] = (byEquipDowntime[r.equipment] || 0) + hoursBetween(r.reportedAt, end);
    });

    return { total, awaiting, followUp, fixed, fixedRate, totalDowntime, avgRepairMin, byEquipCount, byEquipDowntime };
  }, [breakdowns, nowTick]);

  const assets = useMemo(() => {
    if (!breakdowns) return [];
    const map = new Map();
    // sort ascending first so "latest" overwrite gives most recent record per asset
    const sorted = [...breakdowns].sort((a, b) => a.reportedAt - b.reportedAt);
    sorted.forEach(r => {
      const prev = map.get(r.assetId);
      const count = (prev ? prev.count : 0) + 1;
      map.set(r.assetId, { assetId: r.assetId, equipment: r.equipment, level: r.level, place: r.place, latest: r, count });
    });
    return Array.from(map.values()).map(a => {
      let status = 'operational';
      if (a.latest.status === 'awaiting') status = 'awaiting';
      else if (a.latest.status === 'not_fixed') status = 'needs_repair';
      const end = a.latest.status === 'fixed' ? a.latest.fixedAt : nowTick;
      const hoursDown = status === 'operational' ? 0 : hoursBetween(a.latest.reportedAt, end);
      return { ...a, status, hoursDown };
    }).sort((a, b) => b.hoursDown - a.hoursDown);
  }, [breakdowns, nowTick]);

  if (!breakdowns || !stats) {
    return (
      <Shell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: '#8B95A1', gap: 10 }}>
          <Loader2 size={18} className="tr-spin" />
          <span>Loading register…</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header tab={tab} setTab={setTab} mode={mode} />
      <div style={{ padding: '18px 16px 40px' }}>
        {tab === 'overview' && <Overview stats={stats} />}
        {tab === 'assets' && <Assets assets={assets} />}
        {tab === 'log' && <BreakdownLog breakdowns={breakdowns} nowTick={nowTick} onUpdate={updateRecord} onToast={setToast} />}
        {tab === 'report' && <ReportForm onSubmit={addRecord} onToast={setToast} existingCount={breakdowns.length} />}
      </div>
      <Footer />
      {toast && <Toast text={toast} />}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: '#0B0D10', color: '#F2F4F6', minHeight: '100%', maxWidth: 640, margin: '0 auto',
      borderLeft: '1px solid #1B1F24', borderRight: '1px solid #1B1F24', position: 'relative',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        .tr-spin { animation: tr-spin 0.9s linear infinite; }
        @keyframes tr-spin { to { transform: rotate(360deg); } }
        @keyframes tr-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes tr-toast-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .tr-tab-btn:focus-visible, .tr-btn:focus-visible, .tr-chip:focus-visible, .tr-input:focus-visible, .tr-pill-btn:focus-visible {
          outline: 2px solid #4FC3E8; outline-offset: 2px;
        }
        .tr-input:focus { border-color: #4FC3E8 !important; }
        @media (prefers-reduced-motion: reduce) {
          .tr-spin, [style*="tr-pulse"] { animation: none !important; }
        }
        ::placeholder { color: #5A6470; }
      `}</style>
      {children}
    </div>
  );
}

function Header({ tab, setTab, mode }) {
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'assets', label: 'Assets' },
    { key: 'log', label: 'Breakdown Log' },
    { key: 'report', label: 'Report Breakdown' },
  ];
  const isShared = mode === 'shared';
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0B0D10', borderBottom: '1px solid #1B1F24' }}>
      <div style={{ padding: '20px 16px 0' }}>
        <h1 style={{
          fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 30, letterSpacing: 0.2,
          margin: 0, lineHeight: 1.05, textTransform: 'uppercase',
        }}>11 Shaft Complex</h1>
        <p style={{ margin: '6px 0 0', color: '#8B95A1', fontSize: 14 }}>
          Asset &amp; Breakdown Register — Tunisi Digital Twin
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0 14px' }} title={
          isShared ? 'Connected to Supabase — every viewer shares this data live.' : 'Running on local browser storage only — data is not shared with other devices. See README to connect Supabase.'
        }>
          <span style={{
            width: 8, height: 8, borderRadius: 999, background: isShared ? '#34C98D' : '#E0A640', display: 'inline-block',
            animation: isShared ? 'tr-pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: 13, color: '#8B95A1' }}>{isShared ? 'Live — shared' : 'Local only'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} className="tr-tab-btn" onClick={() => setTab(t.key)} style={{
            border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            padding: '9px 16px', borderRadius: 999, fontSize: 14, fontWeight: 600,
            fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s',
            background: tab === t.key ? '#4FC3E8' : 'transparent',
            color: tab === t.key ? '#0B0D10' : '#AEB6BF',
          }}>{t.label}</button>
        ))}
      </div>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: '#14181D', border: '1px solid #262B32', borderRadius: 14,
      padding: 18, ...style,
    }}>{children}</div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <Card style={{ padding: '16px 16px 15px' }}>
      <div style={{ fontSize: 12, color: '#8B95A1', fontWeight: 600, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 34, fontWeight: 700, marginTop: 6, color: color || '#F2F4F6' }}>
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: '#6B7480', marginTop: 4 }}>{sub}</div>
    </Card>
  );
}

function Overview({ stats }) {
  const maxCount = Math.max(...Object.values(stats.byEquipCount), 1);
  const maxDown = Math.max(...Object.values(stats.byEquipDowntime), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatCard label="TOTAL BREAKDOWNS" value={stats.total} sub="logged to date" />
        <StatCard label="AWAITING ATTENDANCE" value={stats.awaiting} sub="nobody responded yet" color="#E2685F" />
        <StatCard label="NEEDS FOLLOW-UP" value={stats.followUp} sub="attended, not fixed" color="#E0A640" />
        <StatCard label="FIXED RATE" value={`${stats.fixedRate.toFixed(1)}%`} sub={`${stats.fixed} of ${stats.total} resolved`} color="#34C98D" />
        <StatCard label="TOTAL DOWNTIME" value={`${stats.totalDowntime.toFixed(1)}h`} sub="across all equipment" />
        <StatCard label="AVG REPAIR TIME" value={`${Math.round(stats.avgRepairMin)} min`} sub="once an artisan responds" />
      </div>

      <Card>
        <SectionTitle title="Breakdowns by equipment" sub="Count of logged breakdowns per equipment type" />
        <BarRows data={stats.byEquipCount} max={maxCount} format={(v) => v} />
      </Card>

      <Card>
        <SectionTitle title="Downtime by equipment" sub="Total downtime hours per equipment type" />
        <BarRows data={stats.byEquipDowntime} max={maxDown} format={(v) => `${v.toFixed(1)}h`} />
      </Card>
    </div>
  );
}

function SectionTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 600 }}>{title}</div>
      {sub && <div style={{ fontSize: 12.5, color: '#6B7480', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function BarRows({ data, max, format }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '82px 1fr 44px', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#AEB6BF', letterSpacing: 0.3 }}>{k.toUpperCase()}</div>
          <div style={{ background: '#1B2027', borderRadius: 999, height: 9, overflow: 'hidden' }}>
            <div style={{ width: `${(v / max) * 100}%`, height: '100%', background: '#4FC3E8', borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 13, textAlign: 'right', color: '#DDE2E7' }}>{format(v)}</div>
        </div>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button className="tr-chip" onClick={onClick} style={{
      padding: '8px 14px', borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
      fontFamily: 'inherit', whiteSpace: 'nowrap',
      background: active ? 'rgba(79,195,232,0.14)' : 'transparent',
      border: `1px solid ${active ? '#4FC3E8' : '#2B3038'}`,
      color: active ? '#4FC3E8' : '#AEB6BF',
    }}>{children}</button>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative' }}>
      <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#5A6470' }} />
      <input
        className="tr-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: '#0F1216', border: '1px solid #262B32', borderRadius: 10,
          padding: '11px 12px 11px 36px', color: '#F2F4F6', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function StatusPill({ status }) {
  const m = STATUS_META[status];
  const icon = status === 'fixed' ? <CheckCircle2 size={13} /> : status === 'awaiting' ? <AlertTriangle size={13} /> : <Clock3 size={13} />;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
      background: m.bg, color: m.color, fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
    }}>{icon}{m.label}</span>
  );
}

function Assets({ assets }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const filtered = assets.filter(a => {
    if (filter === 'operational' && a.status !== 'operational') return false;
    if (filter === 'needs_repair' && a.status !== 'needs_repair') return false;
    if (filter === 'awaiting' && a.status !== 'awaiting') return false;
    if (q && !`${a.assetId} ${a.place}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <Card>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
        <Chip active={filter === 'operational'} onClick={() => setFilter('operational')}>Operational</Chip>
        <Chip active={filter === 'needs_repair'} onClick={() => setFilter('needs_repair')}>Needs repair</Chip>
        <Chip active={filter === 'awaiting'} onClick={() => setFilter('awaiting')}>Awaiting attendance</Chip>
      </div>
      <div style={{ marginBottom: 14 }}>
        <SearchInput value={q} onChange={setQ} placeholder="Search asset ID or location…" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && <EmptyState text="No assets match this filter." />}
        {filtered.map(a => {
          const borderColor = a.status === 'operational' ? '#34C98D' : a.status === 'needs_repair' ? '#E0A640' : '#E2685F';
          return (
            <div key={a.assetId} style={{
              borderLeft: `3px solid ${borderColor}`, background: '#0F1216', border: '1px solid #22262D', borderLeftWidth: 3,
              borderLeftColor: borderColor, borderRadius: 10, padding: '13px 14px',
              display: 'flex', justifyContent: 'space-between', gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 11.5, color: '#5A6470', marginBottom: 4 }}>{a.assetId}</div>
                <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 6 }}>{a.equipment.toUpperCase()}</div>
                {a.status === 'operational' ? (
                  <StatusPill status="fixed" />
                ) : (
                  <StatusPill status={a.status === 'needs_repair' ? 'not_fixed' : 'awaiting'} />
                )}
                <div style={{ fontSize: 13, color: '#8B95A1', marginTop: 8, lineHeight: 1.5 }}>
                  Level {a.level} · {a.place} · last breakdown {fmtDate(a.latest.reportedAt)} · {a.count} logged
                </div>
              </div>
              {a.status !== 'operational' && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, fontWeight: 700 }}>{fmtHours(a.hoursDown)}</div>
                  <div style={{ fontSize: 10.5, color: '#5A6470', letterSpacing: 0.3 }}>HOURS DOWN</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ padding: '30px 10px', textAlign: 'center', color: '#5A6470', fontSize: 14 }}>{text}</div>
  );
}

function BreakdownLog({ breakdowns, nowTick, onUpdate, onToast }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(null);

  const filtered = breakdowns.filter(r => {
    if (filter === 'fixed' && r.status !== 'fixed') return false;
    if (filter === 'not_fixed' && r.status !== 'not_fixed') return false;
    if (filter === 'awaiting' && r.status !== 'awaiting') return false;
    if (q) {
      const hay = `${r.assetId} ${r.place} ${r.detail} ${r.category}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <Card>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
        <Chip active={filter === 'fixed'} onClick={() => setFilter('fixed')}>Fixed</Chip>
        <Chip active={filter === 'not_fixed'} onClick={() => setFilter('not_fixed')}>Not fixed</Chip>
        <Chip active={filter === 'awaiting'} onClick={() => setFilter('awaiting')}>Awaiting attendance</Chip>
      </div>
      <div style={{ marginBottom: 14 }}>
        <SearchInput value={q} onChange={setQ} placeholder="Search asset ID, place or description…" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && <EmptyState text="No breakdowns match this filter." />}
        {filtered.map(r => (
          <LogEntry key={r.id} r={r} nowTick={nowTick}
            expanded={expanded === r.id}
            onToggleExpand={() => setExpanded(expanded === r.id ? null : r.id)}
            onUpdate={onUpdate} onToast={onToast} />
        ))}
      </div>
    </Card>
  );
}

function LogEntry({ r, nowTick, expanded, onToggleExpand, onUpdate, onToast }) {
  const m = STATUS_META[r.status];
  const end = r.status === 'fixed' ? r.fixedAt : nowTick;
  const hours = hoursBetween(r.reportedAt, end);
  const [name, setName] = useState('');
  const [actionText, setActionText] = useState('');

  function attend() {
    if (!name.trim()) { onToast('Enter a name first'); return; }
    onUpdate(r.id, { status: 'not_fixed', attendedAt: Date.now(), attendedBy: name.trim() });
    onToast(`Logged as attended by ${name.trim()}`);
    onToggleExpand();
    setName('');
  }
  function markFixed() {
    if (!name.trim() || !actionText.trim()) { onToast('Fill in both fields'); return; }
    onUpdate(r.id, { status: 'fixed', fixedAt: Date.now(), fixedBy: name.trim(), action: actionText.trim() });
    onToast('Marked as fixed');
    onToggleExpand();
    setName(''); setActionText('');
  }
  function stillNotFixed() {
    onToast('Noted — still logged as not fixed');
  }

  return (
    <div style={{
      borderLeft: `3px solid ${m.color}`, background: '#0F1216', border: '1px solid #22262D',
      borderLeftWidth: 3, borderLeftColor: m.color, borderRadius: 10, padding: '13px 14px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 11.5, color: '#5A6470' }}>{r.id}<br />{fmtDate(r.reportedAt)}</div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 700 }}>{fmtHours(hours)}</div>
          <div style={{ fontSize: 10.5, color: '#5A6470', letterSpacing: 0.3 }}>HOURS DOWN</div>
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15.5, margin: '4px 0 6px' }}>{r.equipment.toUpperCase()} {r.assetId}</div>
      <StatusPill status={r.status} />
      <div style={{ fontSize: 13, color: '#8B95A1', margin: '9px 0 3px', lineHeight: 1.5 }}>
        Level {r.level} · {r.place} · {r.category} · reported by <b style={{ color: '#C7CDD3' }}>{r.reportedBy}</b> at {fmtTime(r.reportedAt)} ({r.shift} shift)
      </div>
      <div style={{ fontSize: 13.5, color: '#DDE2E7', fontStyle: 'italic', marginBottom: 4 }}>{r.detail}</div>
      {r.status === 'fixed' && r.action && (
        <div style={{ fontSize: 13, color: '#8B95A1', marginTop: 6 }}>Action: {r.action} by {r.fixedBy}</div>
      )}
      {r.status === 'not_fixed' && r.attendedBy && (
        <div style={{ fontSize: 13, color: '#8B95A1', marginTop: 6 }}>Attended by {r.attendedBy} — awaiting fix</div>
      )}

      {r.status !== 'fixed' && (
        <div style={{ marginTop: 12 }}>
          {!expanded ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="tr-pill-btn" onClick={onToggleExpand} style={primaryBtnStyle}>
                {r.status === 'awaiting' ? 'Log attendance' : 'Mark fixed'}
              </button>
              {r.status === 'not_fixed' && (
                <button className="tr-pill-btn" onClick={stillNotFixed} style={secondaryBtnStyle}>Still not fixed</button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <input className="tr-input" value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name" style={inputStyle} />
              {r.status === 'not_fixed' && (
                <textarea className="tr-input" value={actionText} onChange={e => setActionText(e.target.value)}
                  placeholder="What did you do to fix it?" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="tr-pill-btn" onClick={r.status === 'awaiting' ? attend : markFixed} style={primaryBtnStyle}>
                  Confirm
                </button>
                <button className="tr-pill-btn" onClick={() => { onToggleExpand(); setName(''); setActionText(''); }} style={secondaryBtnStyle}>
                  <X size={13} /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const primaryBtnStyle = {
  background: '#4FC3E8', color: '#0B0D10', border: 'none', borderRadius: 9, padding: '9px 16px',
  fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
};
const secondaryBtnStyle = {
  background: 'transparent', color: '#AEB6BF', border: '1px solid #2B3038', borderRadius: 9, padding: '9px 16px',
  fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5,
};
const inputStyle = {
  width: '100%', background: '#171B21', border: '1px solid #262B32', borderRadius: 9, padding: '10px 12px',
  color: '#F2F4F6', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
};

function FieldLabel({ children }) {
  return <div style={{ fontSize: 13.5, fontWeight: 600, color: '#DDE2E7', marginBottom: 7 }}>{children}</div>;
}

function ButtonGrid({ options, value, onChange, columns = 2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8 }}>
      {options.map(o => (
        <button key={o} type="button" onClick={() => onChange(o)} style={{
          padding: '11px 8px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'center',
          background: value === o ? 'rgba(79,195,232,0.14)' : '#0F1216',
          border: `1px solid ${value === o ? '#4FC3E8' : '#262B32'}`,
          color: value === o ? '#4FC3E8' : '#DDE2E7',
        }}>{o}</button>
      ))}
    </div>
  );
}

function ReportForm({ onSubmit, onToast, existingCount }) {
  const [shift, setShift] = useState('Day');
  const [level, setLevel] = useState('');
  const [section, setSection] = useState('');
  const [place, setPlace] = useState('Chrome North');
  const [placeOpen, setPlaceOpen] = useState(false);
  const [equipment, setEquipment] = useState('');
  const [assetId, setAssetId] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [category, setCategory] = useState('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setLevel(''); setSection(''); setEquipment(''); setAssetId('');
    setReportedBy(''); setCategory(''); setDetail('');
  }

  async function submit() {
    if (!level || !place || !equipment || !assetId.trim() || !reportedBy.trim() || !category || !detail.trim()) {
      onToast('Fill in all fields before submitting'); return;
    }
    setSubmitting(true);
    const record = {
      id: `BD-${pad(60000 + existingCount + 1, 5)}`,
      equipment, assetId: assetId.trim().toUpperCase(), level: Number(level), section: section.trim() || '—',
      place, category, detail: detail.trim(), shift, reportedBy: reportedBy.trim(),
      reportedAt: Date.now(), status: 'awaiting',
      attendedAt: null, attendedBy: null, fixedAt: null, fixedBy: null, action: null,
    };
    onSubmit(record);
    onToast('Report submitted — added to the live log');
    reset();
    setSubmitting(false);
  }

  return (
    <Card>
      <SectionTitle title="Report a breakdown" sub="Quick entry for the shaft floor — a few taps, no typing required except the description." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <FieldLabel>Shift</FieldLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Day', 'Night'].map(s => (
              <button key={s} type="button" onClick={() => setShift(s)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                fontFamily: 'inherit',
                background: shift === s ? '#4FC3E8' : '#0F1216',
                border: `1px solid ${shift === s ? '#4FC3E8' : '#262B32'}`,
                color: shift === s ? '#0B0D10' : '#DDE2E7',
              }}>{s}</button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Level</FieldLabel>
          <input className="tr-input" inputMode="numeric" value={level} onChange={e => setLevel(e.target.value.replace(/\D/g,''))}
            placeholder="e.g. 24" style={inputStyle} />
        </div>

        <div>
          <FieldLabel>Section</FieldLabel>
          <input className="tr-input" inputMode="numeric" value={section} onChange={e => setSection(e.target.value.replace(/\D/g,''))}
            placeholder="e.g. 1124" style={inputStyle} />
        </div>

        <div style={{ position: 'relative' }}>
          <FieldLabel>Working place</FieldLabel>
          <button type="button" onClick={() => setPlaceOpen(o => !o)} style={{
            ...inputStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
          }}>
            <span>{place}</span>
            <ChevronDown size={16} color="#8B95A1" style={{ transform: placeOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
          {placeOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 10,
              background: '#171B21', border: '1px solid #262B32', borderRadius: 10, overflow: 'hidden',
              maxHeight: 260, overflowY: 'auto', boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
            }}>
              {PLACES.map(p => (
                <button key={p} type="button" onClick={() => { setPlace(p); setPlaceOpen(false); }} style={{
                  width: '100%', textAlign: 'left', padding: '11px 14px', background: p === place ? '#1E252C' : 'transparent',
                  border: 'none', borderBottom: '1px solid #1E232A', color: '#F2F4F6', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                }}>{p === place ? '✓ ' : ''}{p}</button>
              ))}
            </div>
          )}
        </div>

        <div>
          <FieldLabel>Equipment type</FieldLabel>
          <ButtonGrid options={EQUIPMENT} value={equipment} onChange={setEquipment} columns={4} />
        </div>

        <div>
          <FieldLabel>Asset ID</FieldLabel>
          <input className="tr-input" value={assetId} onChange={e => setAssetId(e.target.value)}
            placeholder={equipment ? `e.g. ${PREFIX[equipment]}-010` : 'e.g. LC-010'} style={inputStyle} />
        </div>

        <div>
          <FieldLabel>Reported by</FieldLabel>
          <input className="tr-input" value={reportedBy} onChange={e => setReportedBy(e.target.value)}
            placeholder="Your name / clock no." style={inputStyle} />
        </div>

        <div>
          <FieldLabel>Breakdown category</FieldLabel>
          <ButtonGrid options={CATEGORIES} value={category} onChange={setCategory} columns={2} />
        </div>

        <div>
          <FieldLabel>What happened</FieldLabel>
          <textarea className="tr-input" value={detail} onChange={e => setDetail(e.target.value)}
            placeholder="Short description of the fault…" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div>
          <FieldLabel>Photo</FieldLabel>
          <div style={{
            border: '1px dashed #2B3038', borderRadius: 10, padding: '18px 14px', textAlign: 'center',
            color: '#5A6470', fontSize: 13, background: '#0F1216',
          }}>Photo attachments — coming soon. Data-only reporting works now.</div>
        </div>

        <button type="button" onClick={submit} disabled={submitting} style={{
          ...primaryBtnStyle, padding: '14px 0', fontSize: 15, borderRadius: 10, opacity: submitting ? 0.7 : 1,
        }}>{submitting ? 'Submitting…' : 'Submit report'}</button>
        <div style={{ fontSize: 12.5, color: '#5A6470', textAlign: 'center', marginTop: -8 }}>
          Reports go straight into the live breakdown log.
        </div>
      </div>
    </Card>
  );
}

function Footer() {
  return (
    <div style={{ padding: '4px 16px 28px', textAlign: 'center', color: '#4A525C', fontSize: 12, lineHeight: 1.6 }}>
      11 Shaft Complex Register — built for Tunisi field teams · data entered here is shared live with every viewer
    </div>
  );
}

function Toast({ text }) {
  return (
    <div style={{
      position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)',
      background: '#1E252C', border: '1px solid #333A42', color: '#F2F4F6', padding: '11px 18px',
      borderRadius: 999, fontSize: 13.5, fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      animation: 'tr-toast-in 0.2s ease-out', zIndex: 50, maxWidth: '86%', textAlign: 'center',
    }}>{text}</div>
  );
}
