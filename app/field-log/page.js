// app/field-log/page.js
'use client';

import Link from 'next/link';
import { Camera, Inbox, History } from 'lucide-react';

export default function FieldLogHomePage() {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Field Log</h1>
      <p style={{ marginTop: 4, color: '#64748b' }}>Quick photo capture, tagging, and routing for property + project work.</p>

      <div style={{ display: 'grid', gap: 12, marginTop: 32 }}>
        <Tile href="/field-log/capture" Icon={Camera} title="Capture" subtitle="Take a photo and tag it on the spot" primary />
        <Tile href="/field-log/inbox" Icon={Inbox} title="Inbox" subtitle="Untagged + tagged photos waiting to be routed" />
        <Tile href="/field-log/inbox?view=routed" Icon={History} title="Routed history" subtitle="Photos already sent to tasks or files" />
      </div>
    </div>
  );
}

function Tile({ href, Icon, title, subtitle, primary }) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: 18,
      background: primary ? '#0f172a' : '#fff',
      color: primary ? '#fff' : '#0f172a',
      border: '1px solid ' + (primary ? '#0f172a' : '#e2e8f0'),
      borderRadius: 10, textDecoration: 'none'
    }}>
      <Icon size={26} strokeWidth={1.6} />
      <div>
        <div style={{ fontSize: 17, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>{subtitle}</div>
      </div>
    </Link>
  );
}
