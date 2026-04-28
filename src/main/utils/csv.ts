/**
 * Tiny CSV parser — handles quoted fields with embedded commas/newlines/quotes
 * the standard RFC-4180 way. Returns rows of strings; first row is treated as
 * the header by the caller.
 *
 * Kept dependency-free so we don't pull in csv-parse / papaparse for ~100 lines.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      // swallow CR; the LF below ends the row
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }

  // Last field / row (only if non-empty trailing content)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ''));
}

export interface ParsedRow {
  values: Record<string, string>;
  rowNumber: number; // 1-based, header is row 1
}

/** Convert a CSV string to header-keyed objects. */
export function parseCsvToObjects(text: string): { header: string[]; rows: ParsedRow[] } {
  const grid = parseCsv(text);
  if (grid.length === 0) return { header: [], rows: [] };
  const header = grid[0].map((h) => h.trim());
  const rows: ParsedRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const values: Record<string, string> = {};
    header.forEach((h, j) => {
      values[h] = (r[j] ?? '').trim();
    });
    rows.push({ values, rowNumber: i + 1 });
  }
  return { header, rows };
}
