const HEADER_ALIASES = new Map([
  ["name", "name"],
  ["visitorname", "name"],
  ["姓名", "name"],
  ["訪客姓名", "name"],
  ["message", "message"],
  ["body", "message"],
  ["留言", "message"],
  ["內容", "message"],
  ["datetime", "dateTime"],
  ["dateandtime", "dateTime"],
  ["timestamp", "dateTime"],
  ["date", "dateTime"],
  ["messageat", "dateTime"],
  ["日期時間", "dateTime"],
  ["留言日期時間", "dateTime"],
  ["留言時間", "dateTime"],
  ["日期", "dateTime"],
  ["留言日期", "dateTime"],
]);

const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;
const MIN_TIME_ZONE_OFFSET_MINUTES = -14 * 60;
const MAX_TIME_ZONE_OFFSET_MINUTES = 14 * 60;

function invalidImport(message) {
  const error = new Error(message);
  error.code = "INVALID_MESSAGE_IMPORT";
  return error;
}

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
    throw invalidImport("The import file contains an unclosed quoted field");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => value.trim()));
}

function normalizedText(
  value,
  maximum,
  field,
  rowNumber,
  { compatibilityNormalize = true } = {},
) {
  const raw = String(value ?? "");
  const text = (compatibilityNormalize ? raw.normalize("NFKC") : raw).trim();
  const length = Array.from(text).length;
  if (!text || length > maximum) {
    throw invalidImport(
      `Row ${rowNumber}: ${field} is required and must be ${maximum} characters or fewer`,
    );
  }
  return text;
}

function normalizedTimeZoneOffsetMinutes(value) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_TIME_ZONE_OFFSET_MINUTES ||
    parsed > MAX_TIME_ZONE_OFFSET_MINUTES
  ) {
    throw invalidImport("The administrator timezone offset is invalid");
  }
  return parsed;
}

function normalizedMaximumRows(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw invalidImport("The maximum import row count must be a positive integer");
  }
  return parsed;
}

function invalidDateTime(rowNumber) {
  return invalidImport(
    `Row ${rowNumber}: datetime is invalid; use YYYY-MM-DD HH:mm, YYYY-MM-DDTHH:mm, or ISO 8601 with an explicit timezone`,
  );
}

function localDateTime(raw, rowNumber, timeZoneOffsetMinutes) {
  const match = raw.match(LOCAL_DATE_TIME);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const second = Number(match[6] ?? 0);
  const millisecond = Number((match[7] ?? "0").padEnd(3, "0"));
  if (
    year < 1000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    throw invalidDateTime(rowNumber);
  }

  const nominalUtc = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond),
  );
  if (
    nominalUtc.getUTCFullYear() !== year ||
    nominalUtc.getUTCMonth() !== month - 1 ||
    nominalUtc.getUTCDate() !== day ||
    nominalUtc.getUTCHours() !== hour ||
    nominalUtc.getUTCMinutes() !== minute ||
    nominalUtc.getUTCSeconds() !== second ||
    nominalUtc.getUTCMilliseconds() !== millisecond
  ) {
    throw invalidDateTime(rowNumber);
  }

  return new Date(
    nominalUtc.getTime() + timeZoneOffsetMinutes * 60 * 1000,
  );
}

function normalizedDateTime(value, rowNumber, timeZoneOffsetMinutes) {
  const raw = String(value ?? "").trim();
  if (!raw) return new Date().toISOString();

  const local = localDateTime(raw, rowNumber, timeZoneOffsetMinutes);
  if (local) return local.toISOString();

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    throw invalidDateTime(rowNumber);
  }
  return parsed.toISOString();
}

function assertUniqueColumns(columns) {
  for (const column of ["name", "message", "dateTime"]) {
    if (columns.filter((value) => value === column).length > 1) {
      throw invalidImport(`The first row contains more than one ${column} column`);
    }
  }
}

export function parseMessageImport(
  content,
  {
    maximumRows: rawMaximumRows = 500,
    timeZoneOffsetMinutes: rawTimeZoneOffsetMinutes = 0,
  } = {},
) {
  const maximumRows = normalizedMaximumRows(rawMaximumRows);
  const timeZoneOffsetMinutes = normalizedTimeZoneOffsetMinutes(
    rawTimeZoneOffsetMinutes,
  );
  const text = String(content ?? "").replace(/^\uFEFF/, "");
  if (!text.trim()) {
    throw invalidImport("The import file is empty");
  }

  const rows = parseDelimited(text, delimiterFor(text));
  const header = rows.shift() ?? [];
  const columns = header.map((value) => HEADER_ALIASES.get(normalizedHeader(value)));
  assertUniqueColumns(columns);
  const nameIndex = columns.indexOf("name");
  const messageIndex = columns.indexOf("message");
  const dateTimeIndex = columns.indexOf("dateTime");
  if (nameIndex < 0 || messageIndex < 0) {
    throw invalidImport(
      "The first row must contain name,message,datetime (or date) or 姓名,留言,日期時間 (or 日期) headers",
    );
  }
  if (rows.length === 0 || rows.length > maximumRows) {
    throw invalidImport(
      `The import must contain between 1 and ${maximumRows} message rows`,
    );
  }

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    return {
      visitorName: normalizedText(row[nameIndex], 80, "name", rowNumber),
      body: normalizedText(row[messageIndex], 1000, "message", rowNumber, {
        compatibilityNormalize: false,
      }),
      messageAt: normalizedDateTime(
        dateTimeIndex >= 0 ? row[dateTimeIndex] : "",
        rowNumber,
        timeZoneOffsetMinutes,
      ),
    };
  });
}
