'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

export default function NewTeamMemberPage() {
  const router = useRouter();
  const [first_name, setFirst] = useState('');
  const [last_name, setLast] = useState('');
  const [display_name, setDisplay] = useState('');
  const [role, setRole] = useState('staff');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    if (!first_name.trim()) {
      setError('First name is required.');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('dream_team')
        .insert({
          first_name: first_name.trim(),
          last_name: last_name.trim() || null,
          display_name: display_name.trim() || null, // trigger fills if blank
          role,
          phone: phone.trim() || null,
          email: email.trim() || null,
          notes: notes.trim() || null,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;
      router.push(`/team/${data.id}`);
    } catch (err) {
      setError('Save failed: ' + err.message);
      setSaving(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <a href="/team" style={styles.backLink}>← Team</a>
        <h1 style={styles.h1}>Add team member</h1>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      <div style={styles.card}>
        <div style={styles.twoCol}>
          <div>
            <label style={styles.label}>First name *</label>
            <input value={first_name} onChange={(e) => setFirst(e.target.value)} style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Last name</label>
            <input value={last_name} onChange={(e) => setLast(e.target.value)} style={styles.input} />
          </div>
        </div>

        <label style={styles.label}>
          Display name
          <span style={styles.hint}>Auto-fills from first/last if blank</span>
        </label>
        <input value={display_name} onChange={(e) => setDisplay(e.target.value)} style={styles.input} />

        <label style={styles.label}>Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={styles.select}>
          <option value="owner">Owner</option>
          <option value="director_of_operations">Director of Operations</option>
          <option value="property_manager">Property Manager</option>
          <option value="handyman">Handyman</option>
          <option value="staff">Staff</option>
          <option value="other">Other</option>
        </select>

        <div style={styles.twoCol}>
          <div>
            <label style={styles.label}>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+13035551234" style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} />
          </div>
        </div>

        <label style={styles.label}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={styles.textarea}
        />

        <button onClick={save} disabled={saving} style={styles.saveBtn}>
          {saving ? 'Saving...' : 'Add to team'}
        </button>
      </div>
    </main>
  );
}

const styles = {
  page: { maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { marginBottom: 20 },
  backLink: { fontSize: 14, color: '#6b7280', textDecoration: 'none' },
  h1: { fontSize: 26, margin: '8px 0 0 0', fontWeight: 600 },
  card: { background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  label: { fontSize: 14, fontWeight: 500, color: '#374151', display: 'flex', flexDirection: 'column', gap: 2 },
  hint: { fontSize: 12, fontWeight: 400, color: '#9ca3af' },
  input: { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 16, marginTop: -4, width: '100%', boxSizing: 'border-box' },
  textarea: { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, fontFamily: 'inherit', marginTop: -4, resize: 'vertical' },
  select: { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 16, background: 'white', marginTop: -4 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  saveBtn: { padding: '14px', background: '#0f6e56', color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  errorBanner: { background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, fontSize: 14 },
};
