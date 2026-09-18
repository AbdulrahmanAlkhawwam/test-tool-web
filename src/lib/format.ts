import { format, formatDistanceToNow } from 'date-fns';

export function formatDateTime(iso: string | null): string {
  return iso ? format(new Date(iso), 'd MMM yyyy, HH:mm') : '—';
}

export function formatRelative(iso: string | null): string {
  return iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : '—';
}
