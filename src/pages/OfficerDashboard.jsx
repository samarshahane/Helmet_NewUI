import React, { useState, useEffect, useRef } from 'react';
import { db } from '../supabaseClient';
import {
  Power, ShieldAlert, Camera, MapPin, LogOut,
  Radio, CheckCircle, RefreshCw, Activity,
  Clock, Zap, Navigation, User, AlertTriangle
} from 'lucide-react';

const PLATE_POOL = [
  'MH 01 AB 7765', 'MH 02 BG 4031', 'MH 14 CR 8891',
  'MH 12 DX 5542', 'MH 03 FQ 1029', 'MH 04 ER 5005',
  'MH 20 GH 3310', 'MH 09 XY 7001',
];

export default function OfficerDashboard({ user, profile, onLogout }) {
  const [isActive, setIsActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({ lat: 19.0760, lng: 72.8777 });
  const [ocrText, setOcrText] = useState('MH 01 BU 9081');
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [lastPingTime, setLastPingTime] = useState(null);
  const [pingCount, setPingCount] = useState(0);
  const [sessionTime, setSessionTime] = useState(0);
  const [loggedPlates, setLoggedPlates] = useState([]);

  const locationRef = useRef(null);
  const sessionRef = useRef(null);

  // Fetch initial status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const result = await db.from('officers').select('status, current_lat, current_lng').eq('id', user.id).single();
        const data = result?.data;
        if (data) {
          setIsActive(data.status === 'active');
          if (data.current_lat && data.current_lng) {
            setCurrentLocation({ lat: data.current_lat, lng: data.current_lng });
          }
        }
      } catch (err) { /* silent */ }
    };
    fetchStatus();
    return () => {
      if (locationRef.current) clearInterval(locationRef.current);
      if (sessionRef.current) clearInterval(sessionRef.current);
    };
  }, [user.id]);

  // Location + session timer when active
  useEffect(() => {
    if (isActive) {
      setSessionTime(0);
      sessionRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);

      locationRef.current = setInterval(() => {
        setCurrentLocation(prev => {
          const next = {
            lat: prev.lat + (Math.random() - 0.5) * 0.0015,
            lng: prev.lng + (Math.random() - 0.5) * 0.0015,
          };
          db.from('officers')
            .update({ current_lat: next.lat, current_lng: next.lng, last_updated: new Date().toISOString() })
            .eq('id', user.id)
            .then(() => {
              setLastPingTime(new Date().toLocaleTimeString());
              setPingCount(c => c + 1);
            });
          return next;
        });
      }, 8000);
    } else {
      if (locationRef.current) { clearInterval(locationRef.current); locationRef.current = null; }
      if (sessionRef.current)  { clearInterval(sessionRef.current);  sessionRef.current  = null; }
    }
    return () => {
      if (locationRef.current) clearInterval(locationRef.current);
      if (sessionRef.current)  clearInterval(sessionRef.current);
    };
  }, [isActive, user.id]);

  const handleToggleDuty = async () => {
    const next = isActive ? 'inactive' : 'active';
    try {
      const { error } = await db.from('officers').update({ status: next, last_updated: new Date().toISOString() }).eq('id', user.id);
      if (error) throw error;
      setIsActive(!isActive);
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleTriggerSOS = async () => {
    setSosSending(true);
    setSosSent(false);
    try {
      const { error } = await db.from('alerts').insert({
        type: 'sos',
        source_id: user.id,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        resolved: false,
      });
      if (error) throw error;
      setSosSent(true);
      setTimeout(() => setSosSent(false), 6000);
    } catch (err) { alert('SOS failed: ' + err.message); }
    finally { setSosSending(false); }
  };

  const triggerCameraScan = () => {
    setIsProcessingOcr(true);
    const plate = PLATE_POOL[Math.floor(Math.random() * PLATE_POOL.length)];
    setTimeout(() => {
      setOcrText(plate);
      setIsProcessingOcr(false);
      setLoggedPlates(prev => [{ plate, ts: new Date().toLocaleTimeString(), lat: currentLocation.lat, lng: currentLocation.lng }, ...prev.slice(0, 4)]);
      db.from('plate_logs').insert({
        officer_id: user.id,
        plate_number: plate,
        image_url: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=600',
        lat: currentLocation.lat,
        lng: currentLocation.lng,
      });
    }, 1500);
  };

  const fmtTime = (s) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logoMark}>
            <Radio size={18} strokeWidth={2.5} style={{ color: '#CADCFC' }} />
          </div>
          <div>
            <div style={s.headerTitle}>ESURAKHSHA — Officer Terminal</div>
            <div style={s.headerSub}>
              {profile?.name}
              {profile?.badge_id && (
                <span style={s.badgePill}>{profile.badge_id}</span>
              )}
            </div>
          </div>
        </div>

        <div style={s.headerRight}>
          {/* Live status chip */}
          <div style={{ ...s.statusChip, ...(isActive ? s.statusChipActive : s.statusChipInactive) }}>
            <span className={isActive ? 'live-dot' : 'live-dot live-dot-red'} style={{ width: '7px', height: '7px' }} />
            {isActive ? 'ON PATROL' : 'OFF DUTY'}
          </div>

          <button
            id="logout-btn"
            className="btn btn-outline"
            onClick={onLogout}
            style={s.logoutBtn}
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <div style={s.body}>

        {/* ── Top Row: Stats ── */}
        <div style={s.statsRow}>
          <div className="stat-card">
            <div className="stat-icon stat-icon-primary"><Navigation size={20} /></div>
            <div>
              <div className="stat-label">Coordinates</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>
                {currentLocation.lat.toFixed(4)}N, {currentLocation.lng.toFixed(4)}E
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-success"><Clock size={20} /></div>
            <div>
              <div className="stat-label">Session Time</div>
              <div className="stat-value" style={{ fontSize: '1.25rem', fontFamily: 'var(--mono)' }}>
                {isActive ? fmtTime(sessionTime) : '--:--:--'}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-primary"><Activity size={20} /></div>
            <div>
              <div className="stat-label">Location Pings</div>
              <div className="stat-value">{pingCount}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#FEF3C7', color: '#D97706' }}><Zap size={20} /></div>
            <div>
              <div className="stat-label">Plates Logged</div>
              <div className="stat-value">{loggedPlates.length}</div>
            </div>
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div style={s.grid}>

          {/* ── Patrol Control Card ── */}
          <div className="card" style={s.controlCard}>
            <div className="card-header">
              <span className="card-title"><Radio size={16} /> Patrol Controller</span>
              {isActive && lastPingTime && (
                <span style={s.pingLabel}>
                  <span className="live-dot" style={{ width: 6, height: 6 }} />
                  Last ping {lastPingTime}
                </span>
              )}
            </div>

            <div style={s.controlBody}>
              {/* Duty Toggle */}
              <div style={s.dutyRow}>
                <div>
                  <div style={s.dutyLabel}>Patrol Status</div>
                  <div style={{ ...s.dutyValue, color: isActive ? '#059669' : '#94A3B8' }}>
                    {isActive ? 'PATROLLING ACTIVE' : 'OUT OF DUTY'}
                  </div>
                </div>
                <button
                  id="duty-toggle"
                  onClick={handleToggleDuty}
                  style={{
                    ...s.toggleBtn,
                    background: isActive
                      ? 'linear-gradient(135deg, #DC2626, #B91C1C)'
                      : 'linear-gradient(135deg, #059669, #047857)',
                    boxShadow: isActive
                      ? '0 4px 16px rgba(220,38,38,0.4)'
                      : '0 4px 16px rgba(5,150,105,0.4)',
                  }}
                >
                  <Power size={18} />
                  {isActive ? 'Go Off Duty' : 'Go On Duty'}
                </button>
              </div>

              <div style={s.divider} />

              {/* Location Box */}
              <div style={s.locationBox}>
                <div style={s.locationHeader}>
                  <MapPin size={14} style={{ color: 'var(--primary)' }} />
                  <span>Current Patrol Position</span>
                </div>
                <div style={s.coordGrid}>
                  <div style={s.coordItem}>
                    <span style={s.coordLabel}>LATITUDE</span>
                    <span style={s.coordVal}>{currentLocation.lat.toFixed(6)}° N</span>
                  </div>
                  <div style={s.coordItem}>
                    <span style={s.coordLabel}>LONGITUDE</span>
                    <span style={s.coordVal}>{currentLocation.lng.toFixed(6)}° E</span>
                  </div>
                </div>
              </div>

              {/* Officer Info */}
              <div style={s.officerInfo}>
                <User size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <div>
                  <div style={s.officerName}>{profile?.name || 'Officer'}</div>
                  <div style={s.officerMeta}>Badge {profile?.badge_id || '—'} · Mumbai Traffic Police</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── SOS Emergency Card ── */}
          <div className="card" style={s.sosCard}>
            <div className="card-header" style={{ borderColor: 'rgba(220,38,38,0.2)' }}>
              <span className="card-title" style={{ color: 'var(--alert)' }}>
                <AlertTriangle size={16} /> Emergency Protocol
              </span>
              {!isActive && (
                <span style={s.sosDisabledNote}>Go on duty to activate</span>
              )}
            </div>

            <div style={s.sosBody}>
              <p style={s.sosDesc}>
                Immediately dispatches your GPS coordinates to the Mumbai Command Control Room.
                Only use in genuine emergencies or high-severity incidents.
              </p>

              {/* The big SOS button */}
              <div style={s.sosBtnWrap}>
                <button
                  id="sos-btn"
                  disabled={sosSending || !isActive}
                  onClick={handleTriggerSOS}
                  className="pulse-ring"
                  style={{
                    ...s.sosBtn,
                    opacity: !isActive ? 0.4 : 1,
                    animation: isActive && !sosSending ? 'pulse-ring 2s ease-in-out infinite' : 'none',
                  }}
                >
                  <ShieldAlert size={32} />
                  <span style={s.sosBtnText}>
                    {sosSending ? 'TRANSMITTING...' : 'TRIGGER SOS'}
                  </span>
                  <span style={s.sosBtnSub}>Emergency Alert</span>
                </button>
              </div>

              {sosSent && (
                <div className="alert-banner alert-banner-success fade-in" style={{ marginTop: '1rem' }}>
                  <CheckCircle size={16} />
                  SOS received by Command Control Room — help is on the way.
                </div>
              )}
            </div>
          </div>

          {/* ── OCR Camera Feed (full width) ── */}
          <div className="card" style={s.ocrCard}>
            <div className="card-header">
              <span className="card-title"><Camera size={16} /> ANPR Patrol Camera</span>
              <button
                id="scan-btn"
                className="btn btn-primary btn-sm"
                onClick={triggerCameraScan}
                disabled={isProcessingOcr || !isActive}
              >
                <RefreshCw size={13} style={isProcessingOcr ? { animation: 'spin-once 0.6s linear infinite' } : {}} />
                {isProcessingOcr ? 'Reading...' : 'Capture Plate'}
              </button>
            </div>

            <div style={s.ocrBody}>
              {/* Camera feed */}
              <div style={s.cameraWrap}>
                <img
                  src="https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=900"
                  alt="Traffic Camera Feed"
                  style={s.cameraImg}
                />
                {/* HUD overlays */}
                <div style={s.camBadgeLive}>
                  <span style={{ ...s.camDot, animation: 'breathe 1.6s ease-in-out infinite' }} />
                  LIVE FEED
                </div>
                <div style={s.camBadgeLoc}>
                  <MapPin size={11} /> {currentLocation.lat.toFixed(3)}, {currentLocation.lng.toFixed(3)}
                </div>
                {/* Scan line animation when processing */}
                {isProcessingOcr && <div style={s.scanLine} />}
                {/* Corner brackets */}
                <div style={{ ...s.corner, top: 12, left: 12, borderTop: '2px solid #CADCFC', borderLeft: '2px solid #CADCFC' }} />
                <div style={{ ...s.corner, top: 12, right: 12, borderTop: '2px solid #CADCFC', borderRight: '2px solid #CADCFC' }} />
                <div style={{ ...s.corner, bottom: 12, left: 12, borderBottom: '2px solid #CADCFC', borderLeft: '2px solid #CADCFC' }} />
                <div style={{ ...s.corner, bottom: 12, right: 12, borderBottom: '2px solid #CADCFC', borderRight: '2px solid #CADCFC' }} />
              </div>

              {/* OCR result + log */}
              <div style={s.ocrRight}>
                <div style={s.ocrResult}>
                  <div style={s.ocrResultLabel}>EXTRACTED PLATE</div>
                  <div style={s.ocrPlate}>
                    {isProcessingOcr
                      ? <span style={{ color: 'var(--text-muted)', letterSpacing: 0, fontWeight: 400, fontSize: '0.85rem' }}>Scanning…</span>
                      : ocrText
                    }
                  </div>
                  <div style={s.ocrMeta}>
                    <MapPin size={11} /> {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
                  </div>
                </div>

                <div style={s.logHeader}>Recent Captures</div>
                {loggedPlates.length === 0 ? (
                  <div style={s.logEmpty}>No plates captured this session.</div>
                ) : (
                  <div style={s.logList}>
                    {loggedPlates.map((l, i) => (
                      <div key={i} style={s.logItem}>
                        <span style={s.logPlate}>{l.plate}</span>
                        <span style={s.logTime}>{l.ts}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' },

  /* Header */
  header: {
    background: 'linear-gradient(135deg, #0F1631 0%, #1E2761 100%)',
    padding: '0.9rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 16px rgba(15,22,49,0.6)',
    position: 'sticky',
    top: 0,
    zIndex: 'var(--z-header)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.9rem' },
  logoMark: {
    width: 36, height: 36, borderRadius: 9,
    background: 'rgba(202,220,252,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: { color: '#fff', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.02em' },
  headerSub: { color: 'rgba(202,220,252,0.7)', fontSize: '0.78rem', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  badgePill: {
    background: 'rgba(202,220,252,0.15)',
    color: '#CADCFC',
    fontSize: '0.7rem',
    fontFamily: 'var(--mono)',
    fontWeight: 600,
    padding: '0.1rem 0.5rem',
    borderRadius: 99,
    border: '1px solid rgba(202,220,252,0.2)',
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: '0.85rem' },
  statusChip: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.35rem 0.85rem',
    borderRadius: 99,
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
  },
  statusChipActive:   { background: 'rgba(5,150,105,0.2)', color: '#34D399', border: '1px solid rgba(5,150,105,0.3)' },
  statusChipInactive: { background: 'rgba(148,163,184,0.15)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.25)' },
  logoutBtn: { borderColor: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.82rem' },

  /* Body */
  body: { flex: 1, padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 1280, margin: '0 auto', width: '100%' },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' },

  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' },

  /* Control card */
  controlCard: { display: 'flex', flexDirection: 'column', gridColumn: '1' },
  controlBody: { padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' },

  pingLabel: { fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' },

  dutyRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' },
  dutyLabel: { fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' },
  dutyValue: { fontSize: '1.05rem', fontWeight: 800, marginTop: '0.2rem', letterSpacing: '0.04em' },
  toggleBtn: {
    color: '#fff', border: 'none', borderRadius: 'var(--r-lg)',
    padding: '0.7rem 1.35rem', fontWeight: 700, fontSize: '0.875rem',
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0,
    letterSpacing: '0.02em',
  },

  divider: { height: 1, background: 'var(--border)' },

  locationBox: {
    background: '#F4F7FF',
    borderRadius: 'var(--r)',
    border: '1px solid var(--border)',
    padding: '0.9rem 1.1rem',
  },
  locationHeader: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '0.75rem' },
  coordGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  coordItem: { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  coordLabel: { fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' },
  coordVal: { fontFamily: 'var(--mono)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' },

  officerInfo: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)' },
  officerName: { fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' },
  officerMeta: { fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' },

  /* SOS card */
  sosCard: { display: 'flex', flexDirection: 'column', border: '1.5px solid rgba(220,38,38,0.2)' },
  sosBody: { padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0', flex: 1 },
  sosDesc: { fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, textAlign: 'center', marginBottom: '1.75rem' },
  sosDisabledNote: { fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' },
  sosBtnWrap: { display: 'flex', justifyContent: 'center' },
  sosBtn: {
    width: 160, height: 160,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #DC2626, #991B1B)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    boxShadow: '0 8px 32px rgba(220,38,38,0.5), 0 2px 8px rgba(220,38,38,0.4)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  sosBtnText: { fontSize: '0.85rem', fontWeight: 900, letterSpacing: '0.08em' },
  sosBtnSub: { fontSize: '0.65rem', fontWeight: 500, opacity: 0.75, letterSpacing: '0.06em' },

  /* OCR card */
  ocrCard: { gridColumn: '1 / -1', display: 'flex', flexDirection: 'column' },
  ocrBody: { display: 'flex', gap: '1.5rem', padding: '1.5rem' },
  cameraWrap: { position: 'relative', flex: 1, borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)', minHeight: 200 },
  cameraImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  camBadgeLive: {
    position: 'absolute', top: 12, left: 12,
    background: 'rgba(0,0,0,0.75)',
    color: '#fff', padding: '0.25rem 0.65rem',
    borderRadius: 99, fontSize: '0.7rem', fontWeight: 700,
    display: 'flex', alignItems: 'center', gap: '0.45rem',
    backdropFilter: 'blur(6px)',
    letterSpacing: '0.06em',
  },
  camBadgeLoc: {
    position: 'absolute', bottom: 12, left: 12,
    background: 'rgba(30,39,97,0.85)',
    color: '#CADCFC', padding: '0.2rem 0.6rem',
    borderRadius: 6, fontSize: '0.68rem', fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    backdropFilter: 'blur(6px)',
  },
  camDot: { width: 7, height: 7, borderRadius: '50%', background: '#EF4444', display: 'inline-block' },
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    background: 'linear-gradient(90deg, transparent, #CADCFC, transparent)',
    animation: 'scanMove 1.5s linear infinite',
    top: '40%',
  },
  corner: { position: 'absolute', width: 16, height: 16 },

  ocrRight: { width: 260, display: 'flex', flexDirection: 'column', gap: '1.1rem' },
  ocrResult: {
    background: '#0F1631',
    borderRadius: 'var(--r)',
    padding: '1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  ocrResultLabel: { fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7B8EC0' },
  ocrPlate: {
    fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 800,
    color: '#CADCFC', letterSpacing: '0.08em',
  },
  ocrMeta: { display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: '#5B6E9A', fontFamily: 'var(--mono)' },

  logHeader: { fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' },
  logEmpty: { fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' },
  logList: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  logItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#F4F7FF', borderRadius: 'var(--r-sm)',
    padding: '0.45rem 0.7rem', border: '1px solid var(--border)',
  },
  logPlate: { fontFamily: 'var(--mono)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' },
  logTime: { fontSize: '0.7rem', color: 'var(--text-muted)' },
};
