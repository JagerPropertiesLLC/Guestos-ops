// app/api/dashboard-finance/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const supa = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const yearStart = today.slice(0, 4) + '-01-01';

  // Tenant payments
  const { data: tenantPayments = [] } = await supa
    .from('tenant_payments')
    .select('amount, status, paid_date, due_date, payment_type')
    .gte('due_date', yearStart);

  const collected_mtd = tenantPayments
    .filter(p => p.paid_date && p.paid_date >= monthStart && p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount_paid || p.amount || 0), 0);
  const collected_ytd = tenantPayments
    .filter(p => p.paid_date && p.paid_date >= yearStart && p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount_paid || p.amount || 0), 0);
  const owed_overdue = tenantPayments
    .filter(p => p.status === 'overdue' || (p.status === 'pending' && p.due_date < today))
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  // Maintenance costs (resolved with cost recorded)
  const { data: maint = [] } = await supa
    .from('maintenance_requests')
    .select('cost, resolved_at, module, property_id')
    .not('cost', 'is', null);
  const maint_mtd = maint.filter(m => m.resolved_at && m.resolved_at.slice(0, 10) >= monthStart)
    .reduce((s, m) => s + Number(m.cost || 0), 0);
  const maint_ytd = maint.filter(m => m.resolved_at && m.resolved_at.slice(0, 10) >= yearStart)
    .reduce((s, m) => s + Number(m.cost || 0), 0);

  // Utility bills
  const { data: utilBills = [] } = await supa
    .from('utility_bills')
    .select('amount_due, amount_paid, paid_date, bill_date')
    .gte('bill_date', yearStart);
  const util_mtd = utilBills.filter(u => u.paid_date && u.paid_date >= monthStart)
    .reduce((s, u) => s + Number(u.amount_paid || u.amount_due || 0), 0);
  const util_ytd = utilBills.filter(u => u.paid_date && u.paid_date >= yearStart)
    .reduce((s, u) => s + Number(u.amount_paid || u.amount_due || 0), 0);

  // Property tax YTD paid
  const { data: taxes = [] } = await supa
    .from('property_taxes')
    .select('amount_paid, paid_date')
    .gte('paid_date', yearStart);
  const tax_ytd = taxes.reduce((s, t) => s + Number(t.amount_paid || 0), 0);

  // Months breakdown YTD (rent collected per month)
  const monthBreakdown = {};
  for (const p of tenantPayments) {
    if (!p.paid_date || p.status !== 'paid') continue;
    const m = p.paid_date.slice(0, 7);
    monthBreakdown[m] = (monthBreakdown[m] || 0) + Number(p.amount_paid || p.amount || 0);
  }
  const monthSeries = Object.entries(monthBreakdown).sort().map(([month, amount]) => ({ month, amount }));

  return NextResponse.json({
    income: {
      collected_mtd, collected_ytd, owed_overdue
    },
    costs: {
      maintenance_mtd: maint_mtd,
      maintenance_ytd: maint_ytd,
      utilities_mtd: util_mtd,
      utilities_ytd: util_ytd,
      property_tax_ytd: tax_ytd,
      total_mtd: maint_mtd + util_mtd,
      total_ytd: maint_ytd + util_ytd + tax_ytd
    },
    net: {
      mtd: collected_mtd - (maint_mtd + util_mtd),
      ytd: collected_ytd - (maint_ytd + util_ytd + tax_ytd)
    },
    series: { rent_by_month: monthSeries }
  });
}

export const dynamic = 'force-dynamic';
