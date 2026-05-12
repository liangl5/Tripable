export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
  return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
}

export function formatRoundedRelativeTime(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const isPast = diffMs >= 0;
  const diffSeconds = Math.abs(diffMs) / 1000;
  const diffMinutes = diffSeconds / 60;
  const diffHours = diffMinutes / 60;
  const diffDays = diffHours / 24;

  const formatUnit = (value, unit) => {
    const label = `${value} ${unit}${value !== 1 ? "s" : ""}`;
    return isPast ? `${label} ago` : `in ${label}`;
  };

  if (diffSeconds < 45) return "just now";
  if (diffMinutes < 45) return formatUnit(Math.max(1, Math.round(diffMinutes)), "minute");
  if (diffHours < 22) return formatUnit(Math.max(1, Math.round(diffHours)), "hour");
  if (diffDays < 7) return formatUnit(Math.max(1, Math.round(diffDays)), "day");
  if (diffDays < 30) return formatUnit(Math.max(1, Math.round(diffDays / 7)), "week");
  if (diffDays < 365) return formatUnit(Math.max(1, Math.round(diffDays / 30)), "month");
  return formatUnit(Math.max(1, Math.round(diffDays / 365)), "year");
}

export function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) return '';
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  const startFormatted = formatter.format(start);
  const endFormatted = formatter.format(end);
  
  return `${startFormatted} - ${endFormatted}`;
}

