// app/swppp/qr/[swpppId]/page.js
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// We use a public QR generator service (api.qrserver.com) so we don't need to install another package.
// If we ever want to ship offline, install `qrcode` and render via canvas.

export default function SwpppQrPage() {
  const { swpppId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/swppp/projects/${swpppId}`).then(r => r.json());
    setData(r);
    setLoading(false);
  }
  useEffect(() => { load(); }, [swpppId]);

  async function toggle(active) {
    await fetch(`/api/swppp/projects/${swpppId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ public_qr_active: active })
    });
    load();
  }

  if (loading || !data) return <div style={{ padding: 24 }}>Loading…</div>;

  const { swppp } = data;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://guestos-ops.vercel.app';
  const publicUrl = swppp.public_qr_token ? `${baseUrl}/swppp/public/${swppp.public_qr_token}` : null;
  const qrSrc = publicUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(publicUrl)}` : null;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 20px' }}>
      <h1 style={{ fontSize: 22, marginTop: 0 }}>Public QR Code</h1>
      <p style={{ color: '#64748b' }}>
        Print this QR code and post it at the construction site (typically on the SWPPP/job-site information board near the entrance). Anyone who scans it gets read-only access to weekly inspection reports for this project — exactly what an inspector or visitor needs.
      </p>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Public access</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{swppp.public_qr_active ? 'Anyone with the QR code can view reports.' : 'Currently disabled.'}</div>
          </div>
          <button onClick={() => toggle(!swppp.public_qr_active)} style={swppp.public_qr_active ? btnSecondary : btnPrimary}>
            {swppp.public_qr_active ? 'Disable public access' : 'Enable public access'}
          </button>
        </div>

        {!swppp.public_qr_active ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
            Click "Enable public access" to generate a QR code.
          </div>
        ) : qrSrc ? (
          <div style={{ textAlign: 'center' }}>
            <img src={qrSrc} alt="QR Code" style={{ maxWidth: 300, borderRadius: 8 }} />
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 12, wordBreak: 'break-all' }}>
              {publicUrl}
            </div>
            <button onClick={() => window.print()} style={{ ...btnPrimary, marginTop: 16 }}>
              Print
            </button>
          </div>
        ) : (
          <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>Generating…</div>
        )}
      </div>

      <div style={{ marginTop: 16, padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 13, color: '#713f12' }}>
        <strong>Note:</strong> Public access only shows the inspection reports — no project costs, contracts, or sensitive data.
      </div>
    </div>
  );
}

const btnPrimary = { background: '#0f172a', color: '#fff', border: 0, padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 };
const btnSecondary = { background: '#fff', color: '#0f172a', border: '1px solid #d4d4d4', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 };
