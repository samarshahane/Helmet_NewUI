import React, { useState, useEffect } from 'react';
import { db } from '../supabaseClient';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Users, Map as MapIcon, Bell, FileText, Check,
  MapPin, LogOut, Radio, Clock, Filter, Shield,
  AlertTriangle, Activity, ChevronRight, Crosshair,
  Circle, TrendingUp, Eye
} from 'lucide-react';

/* ── Custom Leaflet marker icons ── */
const makeIcon = (color, size = 16) => L.divIcon({
  className: '',
  html: `<div style="
    background:${color}; border:2.5px solid #fff;
    width:${size}px; height:${size}px; border-radius:50%;
    box-shadow:0 0 0 4px ${color}44, 0 2px 6px rgba(0,0,0,.3);
    transition: all .5s ease;
  "></div>`,
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2],
});
const iconActive  = makeIcon('#10B981', 16);
const iconAlert   = makeIcon('#DC2626', 20);

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center, map]);
  return null;
}

/* ── Sidebar nav items config ── */
const NAV = [
  { id: 'map',      icon: MapIcon,   label: 'Live Command Map' },
  { id: 'officers', icon: Users,     label: 'Patrol Officers'  },
  { id: 'alerts',   icon: Bell,      label: 'Dispatch Panel'   },
  { id: 'logs',     icon: FileText,  label: 'ANPR Logs'        },
];

export default function AdminDashboard({ user, profile, onLogout }) {
  const [activeTab, setActiveTab] = useState('map');
  const [officers, setOfficers]   = useState([]);
  const [alerts, setAlerts]       = useState([]);
  const [plateLogs, setPlateLogs] = useState([]);
  const [officersFilter, setOfficersFilter] = useState('all');
  const [mapCenter, setMapCenter] = useState([19.0760, 72.8777]);
  const [resolving, setResolving] = useState(null);

  // Initial fetch
  useEffect(() => {
    (async () => {
      const [{ data: off }, { data: al }, { data: pl }] = await Promise.all([
        db.from('officers').select('*').order('name'),
        db.from('alerts').select('*').order('timestamp', { ascending: false }),
        db.from('plate_logs').select('*, officers(name)').order('timestamp', { ascending: false }),
      ]);
      if (off) setOfficers(off);
      if (al)  setAlerts(al);
      if (pl)  setPlateLogs(pl);
    })();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    const offCh = db.channel('rt:officers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'officers' }, ({ new: n }) => {
        setOfficers(prev => {
          const i = prev.findIndex(o => o.id === n.id);
          return i !== -1 ? prev.map((o, idx) => idx === i ? n : o) : [...prev, n];
        });
      }).subscribe();

    const alertCh = db.channel('rt:alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, ({ new: n }) => {
        setAlerts(prev => {
          const i = prev.findIndex(a => a.id === n.id);
          return i !== -1 ? prev.map((a, idx) => idx === i ? n : a) : [n, ...prev];
        });
      }).subscribe();

    const logCh = db.channel('rt:plate_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'plate_logs' }, ({ new: n }) => {
        db.from('officers').select('name').eq('id', n.officer_id).single()
          .then(({ data }) => setPlateLogs(prev => [{ ...n, officers: { name: data?.name || 'Unknown' } }, ...prev]));
      }).subscribe();

    return () => { offCh.unsubscribe(); alertCh.unsubscribe(); logCh.unsubscribe(); };
  }, []);

  const handleResolveAlert = async (id) => {
    setResolving(id);
    try {
      const { error } = await db.from('alerts').update({ resolved: true }).eq('id', id);
      if (error) throw error;
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setResolving(null); }
  };

  const activeOfficers   = officers.filter(o => o.status === 'active');
  const unresolvedCount  = alerts.filter(a => !a.resolved).length;
  const filteredOfficers = officers.filter(o => {
    if (officersFilter === 'active')   return o.status === 'active';
    if (officersFilter === 'inactive') return o.status === 'inactive';
    return true;
  });

  return (
    <div style={s.root}>

      {/* ══════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════ */}
      <aside style={s.sidebar} className="slide-left">
        {/* Logo */}
        <div style={s.sidebarTop}>
          <div style={s.sidebarLogo}>
            <div style={s.logoIcon}>
              <Shield size={17} strokeWidth={2.5} />
            </div>
            <div>
              <div style={s.logoName}>ESURAKHSHA</div>
              <div style={s.logoBadge}>Command Center</div>
            </div>
          </div>

          {/* Live indicator */}
          <div style={s.liveRow}>
            <span className="live-dot" />
            <span style={s.liveText}>Supabase Realtime Active</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={s.nav}>
          <div style={s.navSection}>NAVIGATION</div>
          {NAV.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              id={`nav-${id}`}
              style={{ ...s.navItem, ...(activeTab === id ? s.navActive : {}) }}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
              {id === 'alerts' && unresolvedCount > 0 && (
                <span style={s.navBadge}>{unresolvedCount}</span>
              )}
              {id === 'officers' && (
                <span style={s.navCount}>{activeOfficers.length} active</span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={s.sidebarFooter}>
          <div style={s.adminCard}>
            <div style={s.adminAvatar}>{(profile?.name || 'A').charAt(0).toUpperCase()}</div>
            <div>
              <div style={s.adminName}>{profile?.name || 'Admin'}</div>
              <div style={s.adminRole}>Control Room Administrator</div>
            </div>
          </div>
          <button
            id="logout-btn"
            className="btn btn-outline"
            onClick={onLogout}
            style={s.logoutBtn}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════ */}
      <div style={s.main}>

        {/* ── Top Header Bar ── */}
        <header style={s.header}>
          <div style={s.headerLeft}>
            <div style={s.breadcrumb}>
              <span style={s.breadcrumbRoot}>Admin</span>
              <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={s.breadcrumbCurrent}>
                {activeTab === 'map'      && 'Live Command Map'}
                {activeTab === 'officers' && 'Patrol Officers'}
                {activeTab === 'alerts'   && 'Dispatch Panel'}
                {activeTab === 'logs'     && 'ANPR Logs'}
              </span>
            </div>
          </div>

          {/* Quick Stats */}
          <div style={s.headerStats}>
            <div style={s.hStat}>
              <Users size={14} style={{ color: 'var(--success)' }} />
              <b style={{ color: 'var(--success)' }}>{activeOfficers.length}</b>
              <span>on patrol</span>
            </div>
            <div style={s.hStatDivider} />
            {unresolvedCount > 0 ? (
              <div style={s.hStat}>
                <AlertTriangle size={14} style={{ color: 'var(--alert)' }} />
                <b style={{ color: 'var(--alert)' }}>{unresolvedCount}</b>
                <span>unresolved</span>
              </div>
            ) : (
              <div style={s.hStat}>
                <Circle size={10} fill="#10B981" color="#10B981" />
                <span style={{ color: 'var(--success)' }}>All clear</span>
              </div>
            )}
            <div style={s.hStatDivider} />
            <div style={s.hStat}>
              <Activity size={14} style={{ color: 'var(--primary)' }} />
              <b>{plateLogs.length}</b>
              <span>plates logged</span>
            </div>
          </div>
        </header>

        {/* ── View Body ── */}
        <div style={s.viewBody}>

          {/* ══════ TAB: MAP ══════ */}
          {activeTab === 'map' && (
            <div style={s.mapView} className="fade-in">
              {/* Stats above map */}
              <div style={s.mapStatsRow}>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-success"><Users size={20} /></div>
                  <div>
                    <div className="stat-label">Active Officers</div>
                    <div className="stat-value">{activeOfficers.length}</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-alert"><AlertTriangle size={20} /></div>
                  <div>
                    <div className="stat-label">Unresolved Alerts</div>
                    <div className="stat-value" style={{ color: unresolvedCount > 0 ? 'var(--alert)' : 'var(--success)' }}>
                      {unresolvedCount}
                    </div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-primary"><TrendingUp size={20} /></div>
                  <div>
                    <div className="stat-label">Total Officers</div>
                    <div className="stat-value">{officers.length}</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#FEF3C7', color: '#D97706' }}><Eye size={20} /></div>
                  <div>
                    <div className="stat-label">ANPR Entries</div>
                    <div className="stat-value">{plateLogs.length}</div>
                  </div>
                </div>
              </div>

              {/* Map */}
              <div style={s.mapWrap}>
                <MapContainer center={mapCenter} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {activeOfficers.map(off => (
                    off.current_lat && off.current_lng && (
                      <Marker key={off.id} position={[off.current_lat, off.current_lng]} icon={iconActive}>
                        <Popup>
                          <div style={s.popup}>
                            <div style={s.popupHeader}>
                              <div style={s.popupAvatar}>{(off.name || 'O').charAt(0)}</div>
                              <div>
                                <div style={s.popupName}>{off.name}</div>
                                <div style={s.popupBadge}>{off.badge_id}</div>
                              </div>
                            </div>
                            <div style={s.popupRow}><MapPin size={11} />{off.current_lat.toFixed(5)}, {off.current_lng.toFixed(5)}</div>
                            <div style={s.popupRow}><Clock size={11} />Last sync: {new Date(off.last_updated).toLocaleTimeString()}</div>
                            <button
                              style={s.popupBtn}
                              onClick={() => setMapCenter([off.current_lat, off.current_lng])}
                            >
                              <Crosshair size={12} /> Center Camera
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    )
                  ))}
                  {alerts.filter(a => !a.resolved).map(alert => (
                    <Marker key={alert.id} position={[alert.lat, alert.lng]} icon={iconAlert}>
                      <Popup>
                        <div style={s.popup}>
                          <div style={{ ...s.popupHeader, gap: '0.5rem' }}>
                            <AlertTriangle size={16} style={{ color: '#DC2626', flexShrink: 0 }} />
                            <div>
                              <div style={{ ...s.popupName, color: '#DC2626' }}>SOS ALERT</div>
                              <div style={s.popupBadge}>{new Date(alert.timestamp).toLocaleString()}</div>
                            </div>
                          </div>
                          <div style={s.popupRow}><MapPin size={11} />{alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}</div>
                          <button style={{ ...s.popupBtn, background: '#DC2626' }} onClick={() => handleResolveAlert(alert.id)}>
                            <Check size={12} /> Resolve Alert
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  <MapUpdater center={mapCenter} />
                </MapContainer>
              </div>
            </div>
          )}

          {/* ══════ TAB: OFFICERS ══════ */}
          {activeTab === 'officers' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Filter bar */}
              <div style={s.filterBar}>
                <div style={s.filterLeft}>
                  <Filter size={15} style={{ color: 'var(--text-secondary)' }} />
                  <span style={s.filterLabel}>Filter by status</span>
                </div>
                <div style={s.filterTabs}>
                  {[
                    { id: 'all',      label: `All (${officers.length})` },
                    { id: 'active',   label: `Active (${activeOfficers.length})` },
                    { id: 'inactive', label: `Inactive (${officers.length - activeOfficers.length})` },
                  ].map(f => (
                    <button
                      key={f.id}
                      style={{ ...s.filterTab, ...(officersFilter === f.id ? s.filterTabActive : {}) }}
                      onClick={() => setOfficersFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Officer</th>
                      <th>Badge ID</th>
                      <th>Status</th>
                      <th>Coordinates</th>
                      <th>Last Updated</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOfficers.length === 0 ? (
                      <tr><td colSpan={6} style={s.emptyCell}>No officers match the filter.</td></tr>
                    ) : filteredOfficers.map(off => (
                      <tr key={off.id}>
                        <td>
                          <div style={s.officerCell}>
                            <div style={s.officerAvatar}>{(off.name || 'O').charAt(0)}</div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{off.name}</div>
                            </div>
                          </div>
                        </td>
                        <td><code style={s.badgeCode}>{off.badge_id}</code></td>
                        <td>
                          <span className={`badge ${off.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                            {off.status}
                          </span>
                        </td>
                        <td>
                          {off.current_lat && off.current_lng ? (
                            <span style={s.coordLink}>
                              <MapPin size={11} />{off.current_lat.toFixed(4)}, {off.current_lng.toFixed(4)}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          {new Date(off.last_updated).toLocaleTimeString()}
                        </td>
                        <td>
                          {off.status === 'active' && (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => { setMapCenter([off.current_lat, off.current_lng]); setActiveTab('map'); }}
                            >
                              <MapPin size={11} /> Track
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════ TAB: ALERTS ══════ */}
          {activeTab === 'alerts' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {unresolvedCount > 0 && (
                <div className="alert-banner alert-banner-error">
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <b>{unresolvedCount} unresolved alert{unresolvedCount > 1 ? 's' : ''}</b> — immediate dispatch required.
                </div>
              )}
              {alerts.length === 0 ? (
                <div className="card card-pad" style={{ textAlign: 'center', padding: '3rem' }}>
                  <Check size={32} style={{ color: 'var(--success)', margin: '0 auto 0.75rem' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>All clear — no alerts.</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
                    No SOS or crash alerts have been reported.
                  </p>
                </div>
              ) : (
                <div style={s.alertGrid}>
                  {alerts.map(alert => (
                    <div key={alert.id} style={{ ...s.alertCard, ...(alert.resolved ? s.alertCardResolved : s.alertCardActive) }}>
                      <div style={s.alertTop}>
                        <div style={s.alertTopLeft}>
                          <span style={{
                            ...s.alertTypeBadge,
                            background: alert.resolved ? '#D1FAE5' : '#FEE2E2',
                            color: alert.resolved ? '#065F46' : '#991B1B',
                          }}>
                            {alert.type.toUpperCase()}
                          </span>
                          {!alert.resolved && (
                            <span style={s.alertLivePulse}>
                              <span className="live-dot live-dot-red" style={{ width: 6, height: 6 }} />
                              LIVE
                            </span>
                          )}
                        </div>
                        <span style={s.alertTime}>
                          <Clock size={11} />
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div style={s.alertBody}>
                        <div style={s.alertCoords}>
                          <MapPin size={14} style={{ color: alert.resolved ? 'var(--success)' : 'var(--alert)', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>COORDINATES</div>
                            <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                              {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={s.alertFooter}>
                        {alert.resolved ? (
                          <div style={s.resolvedTag}>
                            <Check size={14} /> Incident Resolved
                          </div>
                        ) : (
                          <button
                            id={`resolve-${alert.id}`}
                            className="btn btn-success"
                            style={{ width: '100%' }}
                            disabled={resolving === alert.id}
                            onClick={() => handleResolveAlert(alert.id)}
                          >
                            <Check size={14} />
                            {resolving === alert.id ? 'Resolving...' : 'Acknowledge & Resolve'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════ TAB: PLATE LOGS ══════ */}
          {activeTab === 'logs' && (
            <div className="fade-in">
              <div className="card" style={{ overflow: 'hidden' }}>
                <div className="card-header">
                  <span className="card-title"><FileText size={16} /> ANPR Recognition Log</span>
                  <span style={s.logCount}>{plateLogs.length} entries</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Plate Number</th>
                      <th>Officer</th>
                      <th>Location</th>
                      <th>Timestamp</th>
                      <th>Feed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plateLogs.length === 0 ? (
                      <tr><td colSpan={5} style={s.emptyCell}>No plate logs recorded.</td></tr>
                    ) : plateLogs.map(log => (
                      <tr key={log.id}>
                        <td>
                          <span style={s.plateChip}>{log.plate_number}</span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{log.officers?.name || 'Patrol Unit'}</td>
                        <td>
                          <span style={s.coordLink}>
                            <MapPin size={11} />{log.lat.toFixed(4)}, {log.lng.toFixed(4)}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td>
                          {log.image_url
                            ? <a href={log.image_url} target="_blank" rel="noreferrer" style={s.viewLink}>View Feed</a>
                            : '—'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const s = {
  root: { display: 'flex', minHeight: '100vh', background: 'var(--bg)' },

  /* Sidebar */
  sidebar: {
    width: 268,
    minWidth: 268,
    background: 'var(--sidebar-bg)',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(255,255,255,0.06)',
  },
  sidebarTop: { padding: '1.5rem 1.25rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  sidebarLogo: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' },
  logoIcon: {
    width: 36, height: 36, borderRadius: 9,
    background: 'linear-gradient(135deg, #CADCFC 0%, #a8c4f8 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#1E2761', flexShrink: 0,
    boxShadow: '0 2px 8px rgba(202,220,252,0.25)',
  },
  logoName: { color: '#CADCFC', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.1em' },
  logoBadge: { color: 'var(--sidebar-text-muted)', fontSize: '0.7rem', fontWeight: 500, marginTop: '0.05rem' },

  liveRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  liveText: { fontSize: '0.72rem', color: 'var(--sidebar-text-muted)', fontWeight: 500 },

  nav: { flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  navSection: { fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sidebar-text-muted)', textTransform: 'uppercase', padding: '0 0.5rem', marginBottom: '0.35rem', marginTop: '0.25rem' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '0.65rem',
    width: '100%', padding: '0.7rem 0.85rem',
    borderRadius: 'var(--r)', border: 'none',
    background: 'transparent', color: 'var(--sidebar-text)',
    fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
    transition: 'all 0.18s ease',
  },
  navActive: {
    background: 'var(--sidebar-active)',
    color: '#CADCFC',
    fontWeight: 700,
  },
  navBadge: {
    background: 'var(--alert)', color: '#fff',
    fontSize: '0.65rem', fontWeight: 800,
    padding: '0.1rem 0.45rem', borderRadius: 99,
    minWidth: 18, textAlign: 'center',
  },
  navCount: { fontSize: '0.68rem', color: 'var(--success)', fontWeight: 600 },

  sidebarFooter: { padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  adminCard: { display: 'flex', alignItems: 'center', gap: '0.7rem' },
  adminAvatar: {
    width: 36, height: 36, borderRadius: 9,
    background: 'linear-gradient(135deg, #CADCFC 0%, #a8c4f8 100%)',
    color: '#1E2761', fontWeight: 800, fontSize: '1rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  adminName: { color: '#fff', fontWeight: 700, fontSize: '0.875rem' },
  adminRole: { color: 'var(--sidebar-text-muted)', fontSize: '0.7rem', marginTop: '0.05rem' },
  logoutBtn: { borderColor: 'rgba(255,255,255,0.12)', color: '#CADCFC', fontSize: '0.82rem' },

  /* Main */
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  header: {
    background: '#fff', padding: '0.85rem 1.75rem',
    borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 'var(--z-header)',
    boxShadow: 'var(--sh-sm)',
  },
  headerLeft: {},
  breadcrumb: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' },
  breadcrumbRoot: { color: 'var(--text-muted)', fontWeight: 500 },
  breadcrumbCurrent: { color: 'var(--primary)', fontWeight: 700 },

  headerStats: { display: 'flex', alignItems: 'center', gap: '0.85rem' },
  hStat: { display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' },
  hStatDivider: { width: 1, height: 16, background: 'var(--border)' },

  viewBody: { flex: 1, padding: '1.5rem 1.75rem', overflowY: 'auto' },

  /* Map tab */
  mapView: { display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' },
  mapStatsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' },
  mapWrap: { flex: 1, minHeight: 420, borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--sh-md)' },

  /* Officers tab */
  filterBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fff', borderRadius: 'var(--r-lg)',
    padding: '0.85rem 1.25rem',
    boxShadow: 'var(--sh-sm)', border: '1px solid var(--border)',
  },
  filterLeft: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  filterLabel: { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' },
  filterTabs: { display: 'flex', gap: '0.4rem' },
  filterTab: {
    padding: '0.4rem 0.85rem', fontSize: '0.78rem', fontWeight: 600,
    border: '1.5px solid var(--border)', borderRadius: 'var(--r)',
    background: 'transparent', color: 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.15s ease',
  },
  filterTabActive: { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' },

  officerCell: { display: 'flex', alignItems: 'center', gap: '0.65rem' },
  officerAvatar: {
    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
    background: 'linear-gradient(135deg, #EEF2FF, #CADCFC)',
    color: 'var(--primary)', fontWeight: 800, fontSize: '0.875rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  badgeCode: {
    fontFamily: 'var(--mono)', fontSize: '0.8rem', fontWeight: 600,
    background: '#EEF2FF', color: 'var(--primary)',
    padding: '0.15rem 0.5rem', borderRadius: 4, border: '1px solid rgba(30,39,97,0.12)',
  },
  coordLink: { display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', fontFamily: 'var(--mono)', fontSize: '0.78rem', fontWeight: 600 },
  emptyCell: { padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' },

  /* Alerts tab */
  alertGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' },
  alertCard: {
    borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-md)',
    border: '1px solid var(--border)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    transition: 'box-shadow 0.2s ease',
  },
  alertCardActive:   { background: '#fff', borderLeft: '4px solid var(--alert)' },
  alertCardResolved: { background: '#FAFFFE', borderLeft: '4px solid var(--success)' },
  alertTop: { padding: '1rem 1.1rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  alertTopLeft: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  alertTypeBadge: { fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: 99, letterSpacing: '0.06em' },
  alertLivePulse: { display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', fontWeight: 700, color: 'var(--alert)', letterSpacing: '0.06em' },
  alertTime: { display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)' },
  alertBody: { padding: '0.6rem 1.1rem 0.75rem' },
  alertCoords: { display: 'flex', alignItems: 'flex-start', gap: '0.5rem' },
  alertFooter: { padding: '0 1.1rem 1.1rem' },
  resolvedTag: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: 'var(--success)', fontWeight: 700, fontSize: '0.82rem', background: '#D1FAE5', padding: '0.5rem', borderRadius: 'var(--r)' },

  /* Logs tab */
  logCount: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg)', padding: '0.2rem 0.65rem', borderRadius: 99, border: '1px solid var(--border)' },
  plateChip: { fontFamily: 'var(--mono)', fontWeight: 800, fontSize: '0.875rem', background: '#EEF2FF', color: 'var(--primary)', padding: '0.2rem 0.65rem', borderRadius: 6, border: '1.5px solid rgba(30,39,97,0.15)', letterSpacing: '0.04em' },
  viewLink: { color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600, fontSize: '0.82rem' },

  /* Popup */
  popup: { padding: '1rem', minWidth: 190, display: 'flex', flexDirection: 'column', gap: '0.45rem' },
  popupHeader: { display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' },
  popupAvatar: { width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #EEF2FF, #CADCFC)', color: 'var(--primary)', fontWeight: 800, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  popupName: { fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)' },
  popupBadge: { fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--mono)' },
  popupRow: { display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)' },
  popupBtn: { marginTop: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', width: '100%', padding: '0.45rem', fontSize: '0.78rem', fontWeight: 700, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer' },
};
