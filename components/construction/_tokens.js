// components/construction/_tokens.js
// Re-export the settings palette + add construction-specific status colors.

export { tokens } from '@/components/settings/_tokens';

// Status string → pill colors. Same string can mean different things across
// projects/phases/subcontracts/etc., but the colors are consistent (e.g.
// "active" and "in_progress" both look green). Unknown status falls back to
// gray in StatusPill.
export const STATUS_COLORS = {
  // Project statuses
  planning:         { bg: '#dbeafe', fg: '#1e3a8a' }, // blue
  pre_construction: { bg: '#fef3c7', fg: '#854d0e' }, // gold
  active:           { bg: '#d1fae5', fg: '#065f46' }, // green
  on_hold:          { bg: '#fee2e2', fg: '#991b1b' }, // red
  complete:         { bg: '#e2e8f0', fg: '#334155' }, // slate (terminal)
  cancelled:        { bg: '#e2e8f0', fg: '#64748b' }, // slate dim
  // Phase
  not_started:      { bg: '#f3f4f6', fg: '#4b5563' }, // gray
  in_progress:      { bg: '#d1fae5', fg: '#065f46' }, // green
  delayed:          { bg: '#fee2e2', fg: '#991b1b' }, // red
  // Subcontract
  draft:            { bg: '#f3f4f6', fg: '#4b5563' }, // gray
  signed:           { bg: '#dbeafe', fg: '#1e3a8a' }, // blue
  terminated:       { bg: '#fee2e2', fg: '#991b1b' }, // red
  // Loan
  pending:          { bg: '#fef3c7', fg: '#854d0e' }, // gold
  paid_off:         { bg: '#e2e8f0', fg: '#334155' }, // slate
  defaulted:        { bg: '#fee2e2', fg: '#991b1b' }, // red
  // Draw
  requested:        { bg: '#fef3c7', fg: '#854d0e' }, // gold
  approved:         { bg: '#d1fae5', fg: '#065f46' }, // green
  paid:             { bg: '#e0e7ff', fg: '#3730a3' }, // indigo
  rejected:         { bg: '#fee2e2', fg: '#991b1b' }, // red
  // Inspection
  scheduled:        { bg: '#dbeafe', fg: '#1e3a8a' }, // blue
  passed:           { bg: '#d1fae5', fg: '#065f46' }, // green
  failed:           { bg: '#fee2e2', fg: '#991b1b' }, // red
  conditional_pass: { bg: '#fef3c7', fg: '#854d0e' }, // gold
  // Expense paid_status (unpaid/approved/paid already reusable above)
  unpaid:           { bg: '#f3f4f6', fg: '#4b5563' }, // gray
  submitted:        { bg: '#dbeafe', fg: '#1e3a8a' }, // blue
};

export const PHASE_STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'complete',    label: 'Complete' },
  { value: 'on_hold',     label: 'On hold' },
  { value: 'delayed',     label: 'Delayed' },
];

export const EXPENSE_PAID_STATUS_OPTIONS = [
  { value: 'unpaid',    label: 'Unpaid' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved',  label: 'Approved' },
  { value: 'paid',      label: 'Paid' },
];

export const PROJECT_TYPE_OPTIONS = [
  { value: 'new_construction',   label: 'New construction' },
  { value: 'renovation',         label: 'Renovation' },
  { value: 'addition',           label: 'Addition' },
  { value: 'tenant_improvement', label: 'Tenant improvement' },
  { value: 'repair',             label: 'Repair' },
  { value: 'demolition',         label: 'Demolition' },
  { value: 'other',              label: 'Other' },
];

export const PROJECT_STATUS_OPTIONS = [
  { value: 'planning',         label: 'Planning' },
  { value: 'pre_construction', label: 'Pre-construction' },
  { value: 'active',           label: 'Active' },
  { value: 'on_hold',          label: 'On hold' },
  { value: 'complete',         label: 'Complete' },
  { value: 'cancelled',        label: 'Cancelled' },
];
