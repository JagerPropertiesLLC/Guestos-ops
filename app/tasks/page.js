'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function TasksListPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open'); // 'open', 'all', 'mine', 'completed'
  const [team, setTeam] = useState([]);
  const [assigneeFilter, setAssigneeFilter] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('dream_team')
        .select('id, display_name')
        .eq('active', true)
        .order('display_name');
      setTeam(data || []);
    })();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [filter, assigneeFilter]);

  async function loadTasks() {
    setLoading(true);
    let query = supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        priority,
        status,
        created_at,
        completed_at,
        issue_photos,
        assigned_to_id,
        property_id,
        unit_id
      `)
      .eq('task_type', 'maintenance')
      .order('created_at', { ascending: false });

    if (filter === 'open') {
      query = query.in('status', ['open', 'in_progress']);
    } else if (filter === 'completed') {
      query = query.eq('status', 'completed');
    }

    if (assigneeFilter) {
      query = query.eq('assigned_to_id', assigneeFilter);
    }

    const { data } = await query;

    // Hydrate dream team and property names
    if (data && data.length > 0) {
      const teamIds = [...new Set(data.map((t) => t.assigned_to_id).filter(Boolean))];
      const propIds = [...new Set(data.map((t) => t.property_id).filter(Boolean))];

      const [{ data: teamData }, { data: propData }] = await Promise.all([
        teamIds.length > 0
          ? supabase.from('dream_team').select('id, display_name').in('id', teamIds)
          : Promise.resolve({ data: [] }),
        propIds.length > 0
          ? supabase.from('properties').select('id, name').in('id', propIds)
          : Promise.resolve({ data: [] }),
      ]);

      const teamMap = Object.fromEntries((teamData || []).map((t) => [t.id, t.display_name]));
      const propMap = Object.fromEntries((propData || []).map((p) => [p.id, p.name]));

      const enriched = data.map((t) => ({
        ...t,
        assignee_name: teamMap[t.assigned_to_id] || 'Unassigned',
        property_name: propMap[t.property_id] || '',
      }));
      setTasks(enriched);
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  }

  function getPhotoUrl(path) {
    if (!path) return null;
    const { data } = supabase.storage.from('task-photos').getPublicUrl(path);
    return data?.publicUrl;
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.h1}>Maintenance tasks</h1>
        <a href="/tasks/new" style={styles.newBtn}>+ New task</a>
      </div>

      <div style={styles.filterBar}>
        <div style={styles.tabs}>
          {['open', 'completed', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ ...styles.tab, ...(filter === f ? styles.tabActive : {}) }}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          style={styles.assigneeFilter}
        >
          <option value="">All assignees</option>
          {team.map((t) => (
            <option key={t.id} value={t.id}>{t.display_name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading...</div>
      ) : tasks.length === 0 ? (
        <div style={styles.empty}>
          <p>No tasks here.</p>
          <a href="/tasks/new" style={styles.newBtn}>Create the first one</a>
        </div>
      ) : (
        <div style={styles.list}>
          {tasks.map((t) => {
            const firstPhoto = t.issue_photos?.[0];
            const photoUrl = getPhotoUrl(firstPhoto);
            return (
              <a key={t.id} href={`/tasks/${t.id}`} style={styles.taskCard}>
                {photoUrl && <img src={photoUrl} alt="" style={styles.taskThumb} />}
                <div style={styles.taskBody}>
                  <div style={styles.taskTitle}>{t.title}</div>
                  <div style={styles.taskMeta}>
                    <span style={{ ...styles.badge, ...priorityBadge(t.priority) }}>{t.priority}</span>
                    <span style={{ ...styles.badge, ...statusBadge(t.status) }}>
                      {t.status.replace('_', ' ')}
                    </span>
                    <span style={styles.metaText}>
                      {t.assignee_name}
                      {t.property_name ? ` · ${t.property_name}` : ''}
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </main>
  );
}

function priorityBadge(p) {
  const map = {
    urgent: { background: '#dc2626', color: 'white' },
    high: { background: '#ea580c', color: 'white' },
    medium: { background: '#fef3c7', color: '#92400e' },
    low: { background: '#f3f4f6', color: '#6b7280' },
  };
  return map[p] || map.medium;
}

function statusBadge(s) {
  const map = {
    open: { background: '#dbeafe', color: '#1e40af' },
    in_progress: { background: '#fef3c7', color: '#92400e' },
    completed: { background: '#d1fae5', color: '#065f46' },
    cancelled: { background: '#f3f4f6', color: '#6b7280' },
  };
  return map[s] || map.open;
}

const styles = {
  page: { maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  h1: { fontSize: 26, margin: 0, fontWeight: 600 },
  newBtn: { background: '#0f6e56', color: 'white', textDecoration: 'none', padding: '10px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500 },
  filterBar: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  tabs: { display: 'flex', gap: 4, background: '#f3f4f6', padding: 4, borderRadius: 8 },
  tab: { padding: '6px 14px', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', textTransform: 'capitalize', fontSize: 14, color: '#6b7280' },
  tabActive: { background: 'white', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontWeight: 500 },
  assigneeFilter: { padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, background: 'white' },
  loading: { padding: 40, textAlign: 'center', color: '#6b7280' },
  empty: { padding: 40, textAlign: 'center', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  taskCard: { display: 'flex', gap: 12, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, textDecoration: 'none', color: 'inherit' },
  taskThumb: { width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
  taskBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  taskTitle: { fontSize: 15, fontWeight: 500, color: '#111827', lineHeight: 1.3 },
  taskMeta: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 },
  badge: { padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 },
  metaText: { color: '#6b7280', fontSize: 12 },
};
