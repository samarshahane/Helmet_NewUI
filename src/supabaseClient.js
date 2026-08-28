import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isMockMode = !supabaseUrl || !supabaseAnonKey;

if (isMockMode) {
  console.warn(
    'Supabase URL and Anon Key are missing. ESURAKHSHA is running in MOCK mode using LocalStorage and mock subscriptions.'
  );
}

// Actual Supabase client
export const supabase = isMockMode
  ? null
  : createClient(supabaseUrl, supabaseAnonKey);

// ==========================================
// Mock Supabase Store (for local fallback)
// ==========================================
const DEFAULT_OFFICERS = [
  { id: 'off-1', name: 'Inspector Sanjay Patil', badge_id: 'B-108922', role: 'officer', status: 'active', current_lat: 19.0760, current_lng: 72.8777, last_updated: new Date().toISOString() },
  { id: 'off-2', name: 'Sub-Inspector Anjali Desai', badge_id: 'B-443210', role: 'officer', status: 'active', current_lat: 19.0522, current_lng: 72.8315, last_updated: new Date().toISOString() },
  { id: 'off-3', name: 'Officer Rajesh Kumar', badge_id: 'B-876121', role: 'officer', status: 'inactive', current_lat: 19.0880, current_lng: 72.9000, last_updated: new Date().toISOString() },
  { id: 'off-4', name: 'Officer Vikram Singh', badge_id: 'B-290098', role: 'officer', status: 'active', current_lat: 19.0330, current_lng: 72.8550, last_updated: new Date().toISOString() },
  { id: 'off-5', name: 'Officer Sunita Sharma', badge_id: 'B-521190', role: 'officer', status: 'inactive', current_lat: 19.0176, current_lng: 72.8561, last_updated: new Date().toISOString() }
];

const DEFAULT_ALERTS = [
  { id: 'alert-1', type: 'sos', source_id: 'off-1', lat: 19.0760, lng: 72.8777, timestamp: new Date(Date.now() - 50000).toISOString(), resolved: false },
  { id: 'alert-2', type: 'crash', source_id: 'off-2', lat: 19.0522, lng: 72.8315, timestamp: new Date(Date.now() - 3600000).toISOString(), resolved: true }
];

const DEFAULT_LOGS = [
  { id: 'log-1', officer_id: 'off-1', plate_number: 'MH 01 AB 1234', image_url: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=400', lat: 19.0765, lng: 72.8780, timestamp: new Date(Date.now() - 600000).toISOString(), officers: { name: 'Inspector Sanjay Patil' } },
  { id: 'log-2', officer_id: 'off-2', plate_number: 'MH 02 CD 5678', image_url: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=400', lat: 19.0530, lng: 72.8320, timestamp: new Date(Date.now() - 1200000).toISOString(), officers: { name: 'Sub-Inspector Anjali Desai' } },
  { id: 'log-3', officer_id: 'off-4', plate_number: 'MH 03 EF 9012', image_url: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=400', lat: 19.0335, lng: 72.8555, timestamp: new Date(Date.now() - 1800000).toISOString(), officers: { name: 'Officer Vikram Singh' } }
];

const initializeLocalStorage = () => {
  if (!localStorage.getItem('es_profiles')) {
    const profiles = [
      { id: 'admin-1', name: 'Admin Control Center', role: 'admin' },
      ...DEFAULT_OFFICERS.map(o => ({ id: o.id, name: o.name, role: 'officer' }))
    ];
    localStorage.setItem('es_profiles', JSON.stringify(profiles));
  }
  if (!localStorage.getItem('es_officers')) {
    localStorage.setItem('es_officers', JSON.stringify(DEFAULT_OFFICERS));
  }
  if (!localStorage.getItem('es_alerts')) {
    localStorage.setItem('es_alerts', JSON.stringify(DEFAULT_ALERTS));
  }
  if (!localStorage.getItem('es_plate_logs')) {
    localStorage.setItem('es_plate_logs', JSON.stringify(DEFAULT_LOGS));
  }
  if (!localStorage.getItem('es_current_user')) {
    // Start unauthenticated
    localStorage.setItem('es_current_user', JSON.stringify(null));
  }
};

initializeLocalStorage();

// Subscriptions storage for mock real-time
const subscribers = {
  officers: [],
  alerts: []
};

export const mockSupabase = {
  auth: {
    getUser: async () => {
      const user = JSON.parse(localStorage.getItem('es_current_user'));
      return { data: { user }, error: null };
    },
    signInWithPassword: async ({ email, password }) => {
      const profiles = JSON.parse(localStorage.getItem('es_profiles')) || [];
      const users    = JSON.parse(localStorage.getItem('es_mock_users')) || [];

      // Find a previously registered user with this email
      let mockUser = users.find(u => u.email === email);

      if (!mockUser) {
        // Fall back: try to find an admin profile if no registered users yet
        const adminProfile = profiles.find(p => p.role === 'admin');
        if (adminProfile) {
          mockUser = {
            id: adminProfile.id,
            email,
            raw_user_meta_data: { name: adminProfile.name, role: adminProfile.role }
          };
        } else {
          return { data: null, error: new Error('No account found with this email. Please register first.') };
        }
      }

      const profile = profiles.find(p => p.id === mockUser.id);
      if (!profile) {
        return { data: null, error: new Error('User profile not found.') };
      }

      localStorage.setItem('es_current_user', JSON.stringify(mockUser));

      // If officer, flip status to active
      if (profile.role === 'officer') {
        const officers = JSON.parse(localStorage.getItem('es_officers')) || [];
        const idx = officers.findIndex(o => o.id === mockUser.id);
        if (idx !== -1) {
          officers[idx].status = 'active';
          officers[idx].last_updated = new Date().toISOString();
          localStorage.setItem('es_officers', JSON.stringify(officers));
          triggerMockSubscribers('officers', officers[idx]);
        }
      }

      return { data: { user: mockUser }, error: null };
    },
    signUp: async ({ email, password, options }) => {
      const { name, role, badge_id } = options.data || {};
      const profiles = JSON.parse(localStorage.getItem('es_profiles')) || [];
      const users    = JSON.parse(localStorage.getItem('es_mock_users')) || [];

      // Check for duplicate email
      if (users.find(u => u.email === email)) {
        return { data: null, error: new Error('An account with this email already exists.') };
      }

      const newId = role === 'admin' ? 'admin-' + Date.now() : 'off-' + Date.now();
      const newProfile = { id: newId, name, role };
      profiles.push(newProfile);
      localStorage.setItem('es_profiles', JSON.stringify(profiles));

      if (role === 'officer') {
        const officers = JSON.parse(localStorage.getItem('es_officers')) || [];
        officers.push({
          id: newId, name,
          badge_id: badge_id || 'B-' + Math.floor(Math.random() * 1000000),
          role: 'officer', status: 'inactive',
          current_lat: 19.0760, current_lng: 72.8777,
          last_updated: new Date().toISOString()
        });
        localStorage.setItem('es_officers', JSON.stringify(officers));
      }

      const mockUser = { id: newId, email, raw_user_meta_data: { name, role, badge_id } };

      // Persist user so login can find by email
      users.push(mockUser);
      localStorage.setItem('es_mock_users', JSON.stringify(users));

      return { data: { user: mockUser }, error: null };
    },
    signOut: async () => {
      const user = JSON.parse(localStorage.getItem('es_current_user'));
      if (user && user.raw_user_meta_data.role === 'officer') {
        const officers = JSON.parse(localStorage.getItem('es_officers'));
        const idx = officers.findIndex(o => o.id === user.id);
        if (idx !== -1) {
          officers[idx].status = 'inactive';
          officers[idx].last_updated = new Date().toISOString();
          localStorage.setItem('es_officers', JSON.stringify(officers));
          triggerMockSubscribers('officers', officers[idx]);
        }
      }
      localStorage.setItem('es_current_user', JSON.stringify(null));
      return { error: null };
    }
  },
  from: (table) => {
    return {
      select: (query = '*') => {
        const data = JSON.parse(localStorage.getItem(`es_${table}`)) || [];

        // Chainable query builder
        const makeQB = (rows) => ({
          data: rows,
          error: null,
          eq: (col, val) => makeQB(rows.filter(i => String(i[col]) === String(val))),
          single: () => ({ data: rows[0] || null, error: rows[0] ? null : { message: 'Not found' } }),
          order: (col, opts) => {
            const asc = opts?.ascending !== false;
            const sorted = [...rows].sort((a, b) => {
              if (a[col] < b[col]) return asc ? -1 : 1;
              if (a[col] > b[col]) return asc ? 1 : -1;
              return 0;
            });
            return makeQB(sorted);
          },
        });

        return makeQB(data);
      },
      update: (updates) => {
        const data = JSON.parse(localStorage.getItem(`es_${table}`)) || [];
        return {
          eq: (column, value) => {
            const updatedData = data.map(item => {
              if (item[column] === value) {
                const updated = { ...item, ...updates, last_updated: new Date().toISOString() };
                triggerMockSubscribers(table, updated);
                return updated;
              }
              return item;
            });
            localStorage.setItem(`es_${table}`, JSON.stringify(updatedData));
            return { data: updatedData.filter(i => i[column] === value), error: null };
          }
        };
      },
      insert: (values) => {
        const data = JSON.parse(localStorage.getItem(`es_${table}`)) || [];
        const rows = Array.isArray(values) ? values : [values];
        const newRows = rows.map(r => {
          const newRow = {
            id: table + '-' + Date.now() + '-' + Math.floor(Math.random()*1000),
            timestamp: new Date().toISOString(),
            ...r
          };
          if (table === 'plate_logs') {
            const officers = JSON.parse(localStorage.getItem('es_officers')) || [];
            const officer = officers.find(o => o.id === r.officer_id);
            newRow.officers = { name: officer ? officer.name : 'Unknown Officer' };
          }
          triggerMockSubscribers(table, newRow);
          return newRow;
        });
        localStorage.setItem(`es_${table}`, JSON.stringify([...data, ...newRows]));
        return { data: newRows, error: null };
      }
    };
  },
  channel: (name) => {
    return {
      on: (type, filter, callback) => {
        const table = filter.table;
        subscribers[table] = subscribers[table] || [];
        subscribers[table].push(callback);
        return {
          subscribe: () => {
            // Subscription activated
            return {
              unsubscribe: () => {
                subscribers[table] = subscribers[table].filter(cb => cb !== callback);
              }
            };
          }
        };
      }
    };
  }
};

function triggerMockSubscribers(table, payload) {
  const list = subscribers[table] || [];
  list.forEach(cb => {
    cb({
      eventType: 'UPDATE',
      new: payload
    });
  });
}

export const db = isMockMode ? mockSupabase : supabase;

