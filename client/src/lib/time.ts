const TZ_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export function parseServerTimestamp(value: string | number | Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);

  const trimmed = value.trim();
  if (!trimmed) return new Date(NaN);

  const normalized = TZ_OFFSET_PATTERN.test(trimmed) ? trimmed : `${trimmed}Z`;
  return new Date(normalized);
}

export function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatLocalTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions) {
  const date = parseServerTimestamp(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: getBrowserTimeZone(),
    ...options,
  }).format(date);
}

export function formatLocalDateTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions) {
  return formatLocalTime(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export function formatLocalTimestamp(value: string | number | Date) {
  return formatLocalDateTime(value, {
    second: "2-digit",
    timeZoneName: "short",
  });
}
