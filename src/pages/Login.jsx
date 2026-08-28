import React, { useState } from 'react';
import { db } from '../supabaseClient';
import { Shield, Eye, EyeOff, Radio, Lock, Mail, User, Hash, ArrowRight, ChevronRight } from 'lucide-react';

const HERO_STATS = [
  { value: '12,400+', label: 'Active Officers' },
  { value: '98.4%', label: 'Alert Resolution Rate' },
  { value: '24/7', label: 'Live Monitoring' },
];

export default function Login({ onAuthSuccess }) {
  const [activeTab, setActiveTab] = useState('officer');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [badgeId, setBadgeId] = useState('');
  const [signupRole, setSignupRole] = useState('officer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpErr } = await db.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role: signupRole,
              ...(signupRole === 'officer' && { badge_id: badgeId }),
            }
          }
        });
        if (signUpErr) throw signUpErr;
        setSuccess('Account created! You can now sign in.');
        setIsSignUp(false);
        setActiveTab(signupRole);
      } else {
        const { data, error: loginErr } = await db.auth.signInWithPassword({ email, password });
        if (loginErr) throw loginErr;

        const user = data.user;

        // Fetch profile — works with both Supabase and mock chainable builder
        let profile = null;
        try {
          const result = await db
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          profile = result?.data || null;
        } catch (_) {}

        // Fallback for mock mode: use metadata embedded in user object
        if (!profile && user.raw_user_meta_data) {
          profile = {
            id: user.id,
            name: user.raw_user_meta_data.name,
            role: user.raw_user_meta_data.role,
            badge_id: user.raw_user_meta_data.badge_id,
          };
        }

        if (!profile) throw new Error('Failed to retrieve user profile.');

        if (activeTab === 'admin' && profile.role === 'officer') {
          await db.auth.signOut();
          throw new Error('Access denied: Officer accounts cannot access the Admin portal.');
        }

        onAuthSuccess(user, profile);
      }
    } catch (err) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.root}>
      {/* ── Left Panel (hero) ── */}
      <aside style={s.heroPanel}>
        <div style={s.heroInner}>
          {/* Logo */}
          <div style={s.logoRow}>
            <div style={s.logoMark}>
              <Shield size={22} strokeWidth={2.5} />
            </div>
            <span style={s.logoText}>ESURAKHSHA</span>
          </div>

          {/* Headline */}
          <div style={s.headline}>
            <div style={s.eyebrow}>
              <span style={s.liveDotWrap}><span className="live-dot" /></span>
              Maharashtra Traffic Police — Unified Command
            </div>
            <h1 style={s.heroTitle}>
              Road Safety<br />
              <span style={s.heroAccent}>Enforcement</span><br />
              Platform
            </h1>
            <p style={s.heroDesc}>
              Real-time patrol tracking, ANPR plate recognition, emergency dispatch,
              and live incident management — all in one secure portal.
            </p>
          </div>

          {/* Stats */}
          <div style={s.statsRow}>
            {HERO_STATS.map((st) => (
              <div key={st.label} style={s.stat}>
                <div style={s.statVal}>{st.value}</div>
                <div style={s.statLabel}>{st.label}</div>
              </div>
            ))}
          </div>

          {/* Bottom decoration */}
          <div style={s.heroBadge}>
            <Lock size={14} />
            Secured with AES-256 encryption · ISO 27001 compliant
          </div>
        </div>

        {/* Background grid overlay */}
        <div style={s.heroBg} aria-hidden />
      </aside>

      {/* ── Right Panel (form) ── */}
      <main style={s.formPanel}>
        <div style={s.formCard} className="fade-in">
          {/* Card header */}
          <div style={s.formHeader}>
            <div style={s.formHeaderIcon}>
              {activeTab === 'admin'
                ? <Shield size={18} />
                : <Radio size={18} />
              }
            </div>
            <div>
              <h2 style={s.formTitle}>
                {isSignUp ? 'Create Account' : activeTab === 'admin' ? 'Admin Control Room' : 'Officer Terminal'}
              </h2>
              <p style={s.formSubtitle}>
                {isSignUp
                  ? 'Register a new system account'
                  : activeTab === 'admin'
                    ? 'Restricted access — authorised personnel only'
                    : 'Patrol Officer sign-in portal'
                }
              </p>
            </div>
          </div>

          {/* Tab switcher (login only) */}
          {!isSignUp && (
            <div style={s.tabs}>
              <button
                type="button"
                id="tab-officer"
                style={{ ...s.tab, ...(activeTab === 'officer' ? s.tabActive : {}) }}
                onClick={() => { setActiveTab('officer'); setError(''); }}
              >
                <Radio size={14} />
                Officer
              </button>
              <button
                type="button"
                id="tab-admin"
                style={{ ...s.tab, ...(activeTab === 'admin' ? s.tabActiveAdmin : {}) }}
                onClick={() => { setActiveTab('admin'); setError(''); }}
              >
                <Shield size={14} />
                Admin
              </button>
            </div>
          )}

          {/* Alerts */}
          {error && (
            <div className="alert-banner alert-banner-error" style={{ marginBottom: '1rem' }}>
              <Shield size={15} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}
          {success && (
            <div className="alert-banner alert-banner-success" style={{ marginBottom: '1rem' }}>
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuth} style={s.form}>
            {isSignUp && (
              <>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div style={s.inputWrap}>
                    <User size={15} style={s.inputIcon} />
                    <input
                      id="signup-name"
                      type="text"
                      required
                      className="form-input"
                      style={s.inputWithIcon}
                      placeholder="Sub-Inspector R. Patil"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">System Role</label>
                  <select
                    id="signup-role"
                    className="form-input"
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value)}
                  >
                    <option value="officer">Patrol Officer</option>
                    <option value="admin">Control Room Admin</option>
                  </select>
                </div>

                {signupRole === 'officer' && (
                  <div className="form-group">
                    <label className="form-label">Badge ID</label>
                    <div style={s.inputWrap}>
                      <Hash size={15} style={s.inputIcon} />
                      <input
                        id="signup-badge"
                        type="text"
                        required
                        className="form-input"
                        style={s.inputWithIcon}
                        placeholder="e.g. B-998822"
                        value={badgeId}
                        onChange={(e) => setBadgeId(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={s.inputWrap}>
                <Mail size={15} style={s.inputIcon} />
                <input
                  id="login-email"
                  type="email"
                  required
                  className="form-input"
                  style={s.inputWithIcon}
                  placeholder="name@esurakhsha.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={s.inputWrap}>
                <Lock size={15} style={s.inputIcon} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="form-input"
                  style={{ ...s.inputWithIcon, paddingRight: '2.8rem' }}
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  style={s.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="auth-submit"
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{
                width: '100%',
                marginTop: '0.5rem',
                background: activeTab === 'admin' ? 'var(--primary)' : 'linear-gradient(135deg,#1E2761 0%,#2a3580 100%)',
                boxShadow: '0 4px 16px rgba(30,39,97,0.35)',
                fontSize: '0.95rem',
                letterSpacing: '0.02em',
              }}
            >
              {loading ? (
                <>
                  <span style={s.spinner} /> Processing...
                </>
              ) : (
                <>
                  {isSignUp ? 'Create Secure Account' : `Sign in as ${activeTab === 'admin' ? 'Admin' : 'Officer'}`}
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div style={s.toggleRow}>
              <button
                type="button"
                id="toggle-signup"
                style={s.toggleBtn}
                onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}
              >
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : 'Register new account'
                }
                <ChevronRight size={13} />
              </button>
            </div>
          </form>
        </div>

        <p style={s.footerNote}>
          © 2025 ESURAKHSHA · Maharashtra State Road Safety Authority
        </p>
      </main>
    </div>
  );
}

const s = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    background: '#0F1631',
  },

  /* ── Hero Panel ── */
  heroPanel: {
    width: '52%',
    background: 'linear-gradient(155deg, #0F1631 0%, #1E2761 55%, #0F1631 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    position: 'relative',
    overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      radial-gradient(circle at 20% 80%, rgba(202,220,252,0.06) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(202,220,252,0.05) 0%, transparent 50%),
      linear-gradient(rgba(202,220,252,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(202,220,252,0.03) 1px, transparent 1px)
    `,
    backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px',
    pointerEvents: 'none',
  },
  heroInner: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2.5rem',
  },

  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logoMark: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #CADCFC 0%, #a8c4f8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#1E2761',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(202,220,252,0.3)',
  },
  logoText: {
    fontWeight: '900',
    fontSize: '1.1rem',
    letterSpacing: '0.12em',
    color: '#CADCFC',
  },

  headline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  eyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    fontSize: '0.78rem',
    fontWeight: '600',
    letterSpacing: '0.08em',
    color: 'rgba(202,220,252,0.7)',
    textTransform: 'uppercase',
  },
  liveDotWrap: {
    display: 'flex',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 'clamp(2rem, 3.5vw, 3rem)',
    fontWeight: '900',
    lineHeight: '1.1',
    color: '#fff',
    letterSpacing: '-0.02em',
  },
  heroAccent: {
    color: '#CADCFC',
    fontStyle: 'italic',
  },
  heroDesc: {
    fontSize: '0.95rem',
    color: 'rgba(202,220,252,0.65)',
    lineHeight: '1.7',
    maxWidth: '380px',
  },

  statsRow: {
    display: 'flex',
    gap: '2rem',
    paddingTop: '0.5rem',
    borderTop: '1px solid rgba(202,220,252,0.12)',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  statVal: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#CADCFC',
    letterSpacing: '-0.02em',
  },
  statLabel: {
    fontSize: '0.72rem',
    color: 'rgba(202,220,252,0.55)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },

  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.72rem',
    color: 'rgba(202,220,252,0.45)',
    fontWeight: '500',
  },

  /* ── Form Panel ── */
  formPanel: {
    flex: 1,
    background: '#EEF2FB',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2.5rem 2rem',
    gap: '1.5rem',
  },
  formCard: {
    width: '100%',
    maxWidth: '420px',
    background: '#fff',
    borderRadius: '20px',
    boxShadow: '0 24px 64px rgba(30,39,97,0.14), 0 4px 16px rgba(30,39,97,0.08)',
    border: '1px solid rgba(30,39,97,0.08)',
    overflow: 'hidden',
  },

  formHeader: {
    background: 'linear-gradient(135deg, #1E2761 0%, #2a3580 100%)',
    padding: '1.5rem 1.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    color: '#fff',
  },
  formHeaderIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'rgba(202,220,252,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#CADCFC',
    flexShrink: 0,
  },
  formTitle: {
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: '700',
    marginBottom: '0.1rem',
  },
  formSubtitle: {
    color: 'rgba(202,220,252,0.7)',
    fontSize: '0.78rem',
    fontWeight: '400',
  },

  tabs: {
    display: 'flex',
    gap: '0.5rem',
    padding: '1rem 1.75rem 0',
  },
  tab: {
    flex: 1,
    padding: '0.55rem 1rem',
    fontSize: '0.82rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: '1.5px solid #DDE4F0',
    background: '#F4F7FF',
    color: '#5B6178',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: '#CADCFC',
    color: '#1E2761',
    borderColor: '#a8c4f8',
    boxShadow: '0 1px 4px rgba(30,39,97,0.15)',
  },
  tabActiveAdmin: {
    background: '#1E2761',
    color: '#fff',
    borderColor: '#1E2761',
    boxShadow: '0 1px 4px rgba(30,39,97,0.3)',
  },

  form: {
    padding: '1.25rem 1.75rem 1.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },

  inputWrap: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: '0.85rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94A3B8',
    pointerEvents: 'none',
    zIndex: 1,
  },
  inputWithIcon: {
    paddingLeft: '2.4rem',
  },
  eyeBtn: {
    position: 'absolute',
    right: '0.6rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#94A3B8',
    padding: '0.3rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
  },

  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin-once 0.7s linear infinite',
  },

  toggleRow: {
    textAlign: 'center',
    marginTop: '0.25rem',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: '#1E2761',
    fontSize: '0.82rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.2rem',
    textDecoration: 'underline',
    textDecorationColor: 'rgba(30,39,97,0.3)',
  },

  footerNote: {
    fontSize: '0.72rem',
    color: '#94A3B8',
    textAlign: 'center',
  },
};
