// components/AppShell.js
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const RAIL_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',    icon: '🏠', href: '/dashboard' },
  { id: 'short-term',    label: 'Short Term',   icon: '🏖' },
  { id: 'long-term',     label: 'Long Term',    icon: '🏘' },
  { id: 'construction',  label: 'Construction', icon: '🏗' },
  { type: 'divider' },
  { id: 'calendar',      label: 'Calendar',     icon: '📅', href: '/calendar' },
  { id: 'inbox',         label: 'Inbox',        icon: '📥', href: '/inbox' },
  { id: 'tasks',         label: 'Tasks',        icon: '✓',  href: '/tasks' },
  { id: 'crm',           label: 'CRM',          icon: '👥', href: '/contacts' },
  { id: 'maintenance',   label: 'Maintenance',  icon: '🔧', href: '/maintenance' },
  { id: 'insurance',     label: 'Insurance',    icon: '🛡', href: '/insurance' },
  { id: 'property-tax',  label: 'Property Tax', icon: '💵', href: '/property-tax' },
  { id: 'reports',       label: 'Reports',      icon: '📊', href: '/reports' },
  { id: 'settings',      label: 'Settings',     icon: '⚙️', href: '/settings' }
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [activeRail, setActiveRail] = useState(null);
  const [sidebarData, setSidebarData] = useState({ properties: [], projects: [] });

  // Determine which rail item is active based on the URL
  useEffect(() => {
    const seg = pathname?.split('/')[1];
    const map = {
      'short-term': 'short-term',
      'long-term': 'long-term',
      'construction': 'construction',
      '': 'dashboard',
      'dashboard': 'dashboard'
    };
    setActiveRail(map[seg] || seg || 'dashboard');
  }, [pathname]);

  // Load nav data once
  useEffect(() => {
    fetch('/api/sidebar-nav').then(r => r.json()).then(setSidebarData).catch(() => {});
  }, []);

  const isModuleRail = ['short-term', 'long-term', 'construction'].includes(activeRail);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* RAIL */}
      <nav style={{
        width: 64, background: '#0f172a', color: '#fff', display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '12px 0', position: 'sticky', top: 0, height: '100vh',
        flexShrink: 0
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.5, marginBottom: 16 }}>D</div>
        {RAIL_ITEMS.map((item, i) => {
          if (item.type === 'divider') {
            return <div key={`d${i}`} style={{ width: 32, height: 1, background: '#334155', margin: '8px 0' }} />;
          }
          const active = activeRail === item.id;
          const inner = (
            <div title={item.label}
              onClick={() => !item.href && setActiveRail(item.id)}
              style={{
                width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', marginBottom: 4,
                background: active ? '#1e293b' : 'transparent',
                border: active ? '1px solid #334155' : '1px solid transparent',
                fontSize: 18
              }}>
              {item.icon}
            </div>
          );
          return item.href ? (
            <Link key={item.id} href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link>
          ) : (
            <div key={item.id}>{inner}</div>
          );
        })}
      </nav>

      {/* PANEL — only when a module rail is active */}
      {isModuleRail && (
        <aside style={{
          width: 240, background: '#fff', borderRight: '1px solid #e2e8f0',
          padding: '16px 12px', flexShrink: 0, position: 'sticky', top: 0, height: '100vh',
          overflowY: 'auto'
        }}>
          {activeRail === 'short-term'   && <ShortTermPanel data={sidebarData} pathname={pathname} />}
          {activeRail === 'long-term'    && <LongTermPanel  data={sidebarData} pathname={pathname} />}
          {activeRail === 'construction' && <ConstructionPanel data={sidebarData} pathname={pathname} />}
        </aside>
      )}

      {/* CONTENT */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}

// ---------- PANELS ----------
function PanelHeader({ title }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 8px 12px' }}>
      {title}
    </div>
  );
}
function NavGroup({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 8 }}>
      <div onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 8px', cursor: 'pointer', fontSize: 12, color: '#475569', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.4
      }}>
        <span>{title}</span><span style={{ fontSize: 10 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}
function NavItem({ href, label, count, active }) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', borderRadius: 6, fontSize: 14, color: active ? '#0f172a' : '#475569',
      textDecoration: 'none', background: active ? '#f1f5f9' : 'transparent',
      fontWeight: active ? 500 : 400, marginBottom: 1
    }}>
      <span>{label}</span>
      {count != null && <span style={{ fontSize: 11, color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: 10 }}>{count}</span>}
    </Link>
  );
}

function ShortTermPanel({ data, pathname }) {
  const props = data.properties?.filter(p => p.module === 'str') || [];
  return (
    <div>
      <PanelHeader title="Short Term" />
      <NavGroup title="Properties">
        <NavItem href="/short-term/properties" label="All properties" active={pathname === '/short-term/properties'} count={props.length} />
        {props.map(p => (
          <NavItem key={p.id} href={`/short-term/properties/${p.id}`} label={p.short_name} active={pathname?.includes(p.id)} />
        ))}
      </NavGroup>
      <NavItem href="/short-term/reservations" label="Reservations" active={pathname === '/short-term/reservations'} />
      <NavItem href="/short-term/inbox" label="Inbox" active={pathname === '/short-term/inbox'} />
      <NavItem href="/short-term/listings" label="Listings" active={pathname === '/short-term/listings'} />
      <NavItem href="/short-term/cleaning" label="Cleaning" active={pathname === '/short-term/cleaning'} />
      <NavItem href="/short-term/maintenance" label="Maintenance" active={pathname === '/short-term/maintenance'} />
      <NavItem href="/short-term/channel-manager" label="Channel Manager" active={pathname === '/short-term/channel-manager'} />
      <NavItem href="/short-term/smart-locks" label="Smart Locks" active={pathname === '/short-term/smart-locks'} />
      <NavItem href="/short-term/pricing" label="Pricing" active={pathname === '/short-term/pricing'} />
      <NavItem href="/short-term/house-manuals" label="House Manuals" active={pathname === '/short-term/house-manuals'} />
      <NavItem href="/short-term/financials" label="Financial Reporting" active={pathname === '/short-term/financials'} />
    </div>
  );
}
function LongTermPanel({ data, pathname }) {
  const props = data.properties?.filter(p => p.module === 'ltr') || [];
  return (
    <div>
      <PanelHeader title="Long Term" />
      <NavGroup title="Properties">
        <NavItem href="/long-term/properties" label="All properties" active={pathname === '/long-term/properties'} count={props.length} />
        {props.map(p => (
          <NavItem key={p.id} href={`/long-term/properties/${p.id}`} label={p.short_name} active={pathname?.includes(p.id)} />
        ))}
      </NavGroup>
      <NavItem href="/long-term/tenants" label="Tenants" active={pathname === '/long-term/tenants'} />
      <NavItem href="/long-term/leases" label="Leases" active={pathname === '/long-term/leases'} />
      <NavItem href="/long-term/rent-roll" label="Rent Roll" active={pathname === '/long-term/rent-roll'} />
      <NavItem href="/long-term/aged-receivables" label="Aged Receivables" active={pathname === '/long-term/aged-receivables'} />
      <NavItem href="/long-term/maintenance" label="Maintenance" active={pathname === '/long-term/maintenance'} />
      <NavItem href="/long-term/vendors" label="Vendors" active={pathname === '/long-term/vendors'} />
      <NavItem href="/long-term/property-tax" label="Property Tax" active={pathname === '/long-term/property-tax'} />
      <NavItem href="/long-term/insurance" label="Insurance" active={pathname === '/long-term/insurance'} />
      <NavItem href="/long-term/utilities" label="Utilities" active={pathname === '/long-term/utilities'} />
      <NavItem href="/long-term/financials" label="Financial Reporting" active={pathname === '/long-term/financials'} />
    </div>
  );
}
function ConstructionPanel({ data, pathname }) {
  const projects = data.projects || [];
  return (
    <div>
      <PanelHeader title="Construction" />
      <NavGroup title="Projects">
        <NavItem href="/construction" label="All projects" active={pathname === '/construction'} count={projects.length} />
        {projects.map(p => (
          <NavItem key={p.id} href={`/construction/${p.id}`} label={p.name} active={pathname?.includes(p.id)} />
        ))}
      </NavGroup>
      <NavItem href="/construction/subcontracts" label="Subcontracts" active={pathname === '/construction/subcontracts'} />
      <NavItem href="/construction/inspections" label="Inspections" active={pathname === '/construction/inspections'} />
      <NavItem href="/construction/swppp" label="SWPPP" active={pathname === '/construction/swppp'} />
      <NavItem href="/construction/permits" label="Permits" active={pathname === '/construction/permits'} />
      <NavItem href="/construction/change-orders" label="Change Orders" active={pathname === '/construction/change-orders'} />
      <NavItem href="/construction/draws" label="Draws & Lien Waivers" active={pathname === '/construction/draws'} />
      <NavItem href="/construction/gantt" label="Gantt Charts" active={pathname === '/construction/gantt'} />
      <NavItem href="/construction/vendors" label="Vendors" active={pathname === '/construction/vendors'} />
      <NavItem href="/construction/insurance" label="Insurance" active={pathname === '/construction/insurance'} />
      <NavItem href="/construction/documents" label="Documents" active={pathname === '/construction/documents'} />
    </div>
  );
}
