function _pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Parse a date-like value into a JS Date at local midnight when the input is date-only.
 * - "YYYY-MM-DD" -> local midnight
 * - ISO strings / timestamps -> Date(value)
 * @param {string|Date|null|undefined} value
 * @returns {Date|null}
 */
function parseToLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;

  const s = value.trim();
  if (!s) return null;

  // Date-only string
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Convert a date-like value to YYYY-MM-DD using LOCAL calendar values (no UTC shifting).
 * @param {string|Date|null|undefined} value
 * @returns {string|null}
 */
function toDateOnly(value) {
  const d = parseToLocalDate(value);
  if (!d) return null;
  return `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}`;
}

module.exports = {
  parseToLocalDate,
  toDateOnly,
};



