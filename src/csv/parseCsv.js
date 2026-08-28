function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function parseCsv(raw) {
  const lines = raw
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) throw new Error('CSV file is empty.');

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const titleIdx = headers.findIndex((h) => h.toLowerCase() === 'title');
  const descIdx = headers.findIndex((h) => h.toLowerCase() === 'description');

  if (titleIdx === -1) {
    throw new Error('CSV must have a "Title" column (a "Description" column is optional).');
  }

  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const title = cells[titleIdx] || '';
    const description = descIdx !== -1 ? cells[descIdx] || '' : '';
    const itemSpecifics = {};

    headers.forEach((header, idx) => {
      if (idx === titleIdx || idx === descIdx) return;
      const value = cells[idx];
      if (header && value) itemSpecifics[header] = value;
    });

    return { title, description, itemSpecifics };
  });

  return rows.filter((r) => r.title);
}

module.exports = { parseCsv };
