const HEADER_ALIASES = new Map([
  ["name", "name"],
  ["visitorname", "name"],
  ["姓名", "name"],
  ["訪客姓名", "name"],
  ["message", "message"],
  ["body", "message"],
  ["留言", "message"],
  ["內容", "message"],
  ["date", "date"],
  ["messageat", "date"],
  ["日期", "date"],
  ["留言日期", "date"],
]);

function normalizedHeader(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function delimiterFor(text) {
  const firstLine = String(text ?? "").split(/\r?\n/, 1)[0] ?? "";
  return firstLine.includes("\t") ? "\t" : ",";
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    const error = new Error("The import file contains an unclosed quoted field");
    error.code = "INVALID_MESSAGE_IMPORT";
    throw error;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => value.trim()));
}

function normalizedText(value, maximum, field, rowNumber) {
  const text = String(value ?? "").normalize("NFKC").trim();
  const length = Array.from(text).length;
  if (!text || length > maximum) {
    const error = new Error(
      `Row ${rowNumber}: ${field} is required and must be ${maximum} characters or fewer`,
    );
    error.code = "INVALID_MESSAGE_IMPORT";
    throw error;
  }
  return text;
}

function normalizedDate(value, rowNumber) {
  const raw = String(value ?? "").trim();
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    const error = new Error(`Row ${rowNumber}: date is invalid`);
    error.code = "INVALID_MESSAGE_IMPORT";
    throw error;
  }
  return parsed.toISOString();
}

export function parseMessageImport(content, { maximumRows = 500 } = {}) {
  const text = String(content ?? "").replace(/^\uFEFF/, "");
  if (!text.trim()) {
    const error = new Error("The import file is empty");
    error.code = "INVALID_MESSAGE_IMPORT";
    throw error;
  }

  const rows = parseDelimited(text, delimiterFor(text));
  const header = rows.shift() ?? [];
  const columns = header.map((value) => HEADER_ALIASES.get(normalizedHeader(value)));
  const nameIndex = columns.indexOf("name");
  const messageIndex = columns.indexOf("message");
  const dateIndex = columns.indexOf("date");
  if (nameIndex < 0 || messageIndex < 0) {
    const error = new Error(
      "The first row must contain name,message,date or 姓名,留言,日期 headers",
    );
    error.code = "INVALID_MESSAGE_IMPORT";
    throw error;
  }
  if (rows.length === 0 || rows.length > maximumRows) {
    const error = new Error(
      `The import must contain between 1 and ${maximumRows} message rows`,
    );
    error.code = "INVALID_MESSAGE_IMPORT";
    throw error;
  }

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    return {
      visitorName: normalizedText(row[nameIndex], 80, "name", rowNumber),
      body: normalizedText(row[messageIndex], 1000, "message", rowNumber),
      messageAt: normalizedDate(dateIndex >= 0 ? row[dateIndex] : "", rowNumber),
    };
  });
}
