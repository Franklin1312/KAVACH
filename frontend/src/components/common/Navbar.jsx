import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { worker, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const links = [
    { path: '/dashboard', label: 'Home'    },
    { path: '/policy',    label: 'Policy'  },
    { path: '/claims',    label: 'Claims'  },
    { path: '/admin',     label: 'Admin'   },
  ];

  return (
    <nav style={{
      background:   '#161b22',
      borderBottom: '1px solid #30363d',
      padding:      '12px 20px',
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'space-between',
      position:     'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <span style={{ color: '#39d353', fontWeight: 700, fontSize: 18 }}>⛨ KAVACH</span>

      <div style={{ display: 'flex', gap: 4 }}>
        {links.map((l) => (
          <button
            key={l.path}
            onClick={() => navigate(l.path)}
            style={{
              background:  location.pathname === l.path ? '#21262d' : 'transparent',
              color:       location.pathname === l.path ? '#e6edf3' : '#8b949e',
              border:      'none',
              padding:     '6px 14px',
              borderRadius: 6,
              fontWeight:  400,
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: '#8b949e', fontSize: 13 }}>{worker?.name}</span>
        <button
          onClick={() => { logout(); navigate('/'); }}
          style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d', padding: '5px 12px', fontSize: 12 }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
