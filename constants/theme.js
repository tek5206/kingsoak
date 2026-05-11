export const Colors = {
  primary:               '#0D2137',
  primaryDark:           '#081524',
  primaryLight:          '#1A3A5C',
  accent:                '#C9A84C',
  accentLight:           '#F0E2B6',
  background:            '#EDF1F7',
  surface:               '#FFFFFF',
  surfaceAlt:            '#F6F8FB',
  border:                '#D8E2F0',
  divider:               '#EBF0F8',
  textPrimary:           '#0D2137',
  textSecondary:         '#4A6080',
  textMuted:             '#8A9BB5',
  white:                 '#FFFFFF',
  black:                 '#000000',
  error:                 '#E74C3C',
  success:               '#27AE60',
  warning:               '#F39C12',

  // Status colours
  pending:               '#C87722',
  pendingBg:             '#FEF6E6',
  pendingBorder:         '#F5CC88',

  inProgress:            '#1A6FA5',
  inProgressBg:          '#E8F4FC',
  inProgressBorder:      '#9DD0F0',

  pendingApproval:       '#7B2FA5',
  pendingApprovalBg:     '#F3E8FB',
  pendingApprovalBorder: '#C89DE0',

  needsRevision:         '#C0392B',
  needsRevisionBg:       '#FDEDEC',
  needsRevisionBorder:   '#F1948A',

  completed:             '#1A8A44',
  completedBg:           '#E6F9EE',
  completedBorder:       '#82D8A8',
};

export const StatusConfig = {
  pending: {
    label: 'Pending',
    color: Colors.pending,
    bg: Colors.pendingBg,
    border: Colors.pendingBorder,
  },
  in_progress: {
    label: 'In Progress',
    color: Colors.inProgress,
    bg: Colors.inProgressBg,
    border: Colors.inProgressBorder,
  },
  pending_approval: {
    label: 'Pending Approval',
    color: Colors.pendingApproval,
    bg: Colors.pendingApprovalBg,
    border: Colors.pendingApprovalBorder,
  },
  needs_revision: {
    label: 'Needs Revision',
    color: Colors.needsRevision,
    bg: Colors.needsRevisionBg,
    border: Colors.needsRevisionBorder,
  },
  completed: {
    label: 'Completed',
    color: Colors.completed,
    bg: Colors.completedBg,
    border: Colors.completedBorder,
  },
};

export const CategoryConfig = {
  Plumbing:      { color: '#1A6FA5', bg: '#E8F4FC', icon: '🔧' },
  Electrical:    { color: '#C87722', bg: '#FEF6E6', icon: '⚡' },
  HVAC:          { color: '#1A8A44', bg: '#E6F9EE', icon: '❄️'  },
  Carpentry:     { color: '#7B5E2A', bg: '#F5EFE6', icon: '🪚' },
  Painting:      { color: '#7B2FA5', bg: '#F3E8FB', icon: '🎨' },
  Landscaping:   { color: '#2A7B3F', bg: '#E6F5EB', icon: '🌿' },
  Cleaning:      { color: '#1A6FA5', bg: '#E8F4FC', icon: '🧹' },
  General:       { color: '#4A6080', bg: '#EDF1F7', icon: '🔨' },
};

export const PriorityConfig = {
  low:    { label: 'Low',    color: '#1A8A44', bg: '#E6F9EE' },
  medium: { label: 'Medium', color: '#C87722', bg: '#FEF6E6' },
  high:   { label: 'High',   color: '#C0392B', bg: '#FDEDEC' },
};
