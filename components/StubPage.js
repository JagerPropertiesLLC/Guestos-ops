// components/StubPage.js
'use client';

export default function StubPage({ title, description, comingSoon = [] }) {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px' }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>{title}</h1>
      {description && <p style={{ marginTop: 4, color: '#64748b' }}>{description}</p>}

      <div style={{
        marginTop: 24, padding: 32, background: '#fff', border: '1px dashed #cbd5e1',
        borderRadius: 10, textAlign: 'center'
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🚧</div>
        <h2 style={{ margin: 0, fontSize: 18 }}>This section is being built</h2>
        <p style={{ marginTop: 8, color: '#64748b', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
          The data layer is in place. The UI is next.
        </p>
        {comingSoon.length > 0 && (
          <ul style={{ marginTop: 20, textAlign: 'left', display: 'inline-block', fontSize: 14, color: '#475569' }}>
            {comingSoon.map((item, i) => <li key={i} style={{ marginBottom: 6 }}>{item}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
