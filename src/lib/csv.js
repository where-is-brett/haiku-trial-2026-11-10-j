// src/lib/csv.js

// Reads CSV text into rows of fields. Honours double quotes; field text is not trimmed.
export function parseCsv(text) {
  const source = text.startsWith('﻿') ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    // A line that is blank after trimming adds no row.
    if (!(row.length === 1 && row[0].trim() === '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      // A quote opens a quoted field only as the field's first character.
      inQuotes = true;
    } else if (ch === ',') {
      endField();
    } else if (ch === '\n') {
      endRow();
    } else if (ch === '\r' && source[i + 1] === '\n') {
      endRow();
      i += 1;
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new Error('unterminated quoted field');
  if (field !== '' || row.length > 0) endRow();
  return rows;
}
