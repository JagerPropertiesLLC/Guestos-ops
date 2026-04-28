'use client';
import StubPage from '@/components/StubPage';

export default function ReportsPage() {
  return <StubPage
    title="Reports"
    description="P&L, cash flow, occupancy, NOI, and other reports across the business."
    comingSoon={['STR revenue & occupancy reports', 'LTR rent roll & aged receivables', 'Construction project budget vs actual', 'Per-LLC quarterly reports for owners']} />;
}
