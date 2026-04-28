// components/AppShell.js
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Bed, Building2, HardHat,
  Calendar, Inbox, CheckSquare, Users, Wrench, Shield, Receipt, BarChart3, Settings,
  ChevronDown, ChevronRight
} from 'lucide-react';

const RAIL_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',    Icon: LayoutDashboard, href: '/dashboard' },
  { id: 'short-term',    label: 'Short Term',   Icon: Bed },
  { id: 'long-term',     label: 'Long Term',    Icon: Building2 },
  { id: 'construction',  label: 'Construction', Icon: HardHat },
  { type: 'divider' },
  { id: 'calendar',      label: 'Calendar',     Icon: Calendar, href: '/calendar' },
  { id: 'inbox',         label: 'Inbox',        Icon: Inbox,    href: '/inbox' },
  { id: 'tasks',         label: 'Tasks',        Icon: CheckSquare, href: '/tasks' },
  { id: 'crm',           label: 'CRM',          Icon: Users,    href: '/contacts' },
  { id: 'maintenance',   label: 'Maintenance',  Icon: Wrench,   href: '/maintenance' },
  { id: 'insurance',     label: 'Insurance',    Icon: Shield,   href: '/insurance' },
  { id: 'property-tax',  label: 'Property Tax', Icon: Receipt,  href: '/property-tax' },
  { id: 'reports',       label: 'Reports',      Icon: BarChart3,href: '/reports' },
  { id: 'settings',      label: 'Settings',     Icon: Settings, href: '/settings' }
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [activeRail, setActiveRail] = useState(null);
  const [sidebarData, setSidebarData] = useState({ properties: [], projects: [] });

  useEffect(() => {
    const seg = pathname?.split('/')[1];
    setActiveRail(['short-term', 'long-term', 'construction', 'dashboard'].includes(seg) ? seg : (seg || 'dashboard'));
  }, [pathname]);

  useEffect(() => {
    fetch('/api/sidebar-nav').then(r => r.json()).then(setSidebarData).catch(() => {});
  }, []);

  if (pathname?.startsWith('/tenant-portal')) return <>{children}</>;

  const isModuleRail = ['short-term', 'long-term', 'construction'].includes(activeRail);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{
        width: 64, background: '#0f172a', color: '#cbd5e1', display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '12px 0', position: 'sticky', top: 0, height: '100vh', flexShrink: 0
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.5, marginBottom: 16, color: '#fff' }}>D</div>
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
                color: active ? '#fff' : '#94a3b8',
                transition: 'all 0.15s'
              }}>
              <item.Icon size={20} strokeWidth={1.75} />
            </div>
          );
          return item.href
            ? <Link key={item.id} href={item.href} style={{ textDecoration: 'none' }}>{inner}</Link>
            : <div key={item.id}>{inner}</div>;
        })}
      </nav>

      {isModuleRail && (
        <aside style={{
          width: 240, background: '#fff', borderRight: '1px solid #e2e8f0',
          padding: '16px 12px', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto'
        }}>
          {activeRail === 'short-term'   && <ShortTermPanel data={sidebarData} pathname={pathname} />}
          {activeRail === 'long-term'    && <LongTermPanel  data={sidebarData} pathname={pathname} />}
          {activeRail === 'construction' && <ConstructionPanel data={sidebarData} pathname={pathname} />}
        </aside>
      )}

      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}

function PanelHeader({ title }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, padding: '6px 8px 14px' }}>{title}</div>;
}
function NavItem({ href, label, count, active }) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', borderRadius: 6, fontSize: 14,
      color: active ? '#0f172a' : '#475569', textDecoration: 'none',
      background: active ? '#f1f5f9' : 'transparent',
      fontWeight: active ? 500 : 400, marginBottom: 1
    }}>
      <span>{label}</span>
      {count != null && <Pill>{count}</Pill>}
    </Link>
  );
}
function Pill({ children }) {
  return <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '2px 7px', borderRadius: 10, fontWeight: 500 }}>{children}</span>;
}
function CollapsibleGroup({ href, label, count, active, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 8px 8px 4px',
        borderRadius: 6, background: active ? '#f1f5f9' : 'transparent', marginBottom: 1
      }}>
        <button onClick={() => setOpen(!open)} style={{
          background: 'transparent', border: 0, cursor: 'pointer', padding: 4, marginRight: 2,
          display: 'flex', alignItems: 'center', color: '#64748b'
        }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <Link href={href} style={{
          flex: 1, textDecoration: 'none', color: active ? '#0f172a' : '#475569',
          fontSize: 14, fontWeight: active ? 500 : 400,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span>{label}</span>
          {count != null && <Pill>{count}</Pill>}
        </Link>
      </div>
      {open && <div style={{ paddingLeft: 22 }}>{children}</div>}
    </div>
  );
}
function SubNavItem({ href, label, active }) {
  return (
    <Link href={href} style={{
      display: 'block', padding: '6px 10px', borderRadius: 6, fontSize: 13,
      color: active ? '#0f172a' : '#64748b', textDecoration: 'none',
      background: active ? '#f1f5f9' : 'transparent', marginBottom: 1,
      fontWeight: active ? 500 : 400
    }}>
      {label}
    </Link>
  );
}

function ShortTermPanel({ data, pathname }) {
  const props = (data.properties || []).filter(p => p.module === 'str');
  const propActive = pathname?.startsWith('/short-term/properties');
  return (
    <div>
      <PanelHeader title="Short Term" />
      <CollapsibleGroup href="/short-term/properties" label="Properties" count={props.length} active={propActive} defaultOpen={propActive}>
        {props.map(p => (
          <SubNavItem key={p.id} href={`/short-term/properties/${p.id}`} label={p.short_name} active={pathname?.includes(p.id)} />
        ))}
      </CollapsibleGroup>
      <NavItem href="/short-term/reservations" label="Reservations" active={pathname === '/short-term/reservations'} />
      <NavItem href="/short-term/calendar" label="Reservations Calendar" active={pathname === '/short-term/calendar'} />
      <NavItem href="/short-term/inbox" label="Guest Inbox" active={pathname === '/short-term/inbox'} />
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
  const props = (data.properties || []).filter(p => p.module === 'ltr');
  const propActive = pathname?.startsWith('/long-term/properties');
  return (
    <div>
      <PanelHeader title="Long Term" />
      <CollapsibleGroup href="/long-term/properties" label="Properties" count={props.length} active={propActive} defaultOpen={propActive}>
        {props.map(p => (
          <SubNavItem key={p.id} href={`/long-term/properties/${p.id}`} label={p.short_name} active={pathname?.includes(p.id)} />
        ))}
      </CollapsibleGroup>
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

// SLIMMED DOWN — just the essentials. Project-specific stuff lives inside the project page.
function ConstructionPanel({ data, pathname }) {
  const projects = data.projects || [];
  const projActive = pathname?.startsWith('/construction/') &&
    !['/construction/subcontractors', '/construction/vendors', '/construction/documents'].some(p => pathname === p);
  const allProjActive = pathname === '/construction';
  return (
    <div>
      <PanelHeader title="Construction" />
      <CollapsibleGroup href="/construction" label="Projects" count={projects.length}
        active={allProjActive || projActive} defaultOpen={projActive || allProjActive}>
        {projects.map(p => (
          <SubNavItem key={p.id} href={`/construction/${p.id}`} label={p.name} active={pathname?.includes(p.id)} />
        ))}
      </CollapsibleGroup>
      <NavItem href="/construction/subcontractors" label="Subcontractors" active={pathname === '/construction/subcontractors'} />
      <NavItem href="/construction/vendors" label="Vendors" active={pathname === '/construction/vendors'} />
      <NavItem href="/construction/documents" label="Documents" active={pathname === '/construction/documents'} />
    </div>
  );
}
