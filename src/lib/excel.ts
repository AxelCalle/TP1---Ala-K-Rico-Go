// Generador mínimo de archivos .xlsx (Office Open XML) sin dependencias:
// hojas con texto y números, encabezado en negrita y ancho de columnas.
// El .xlsx es un ZIP; se empaqueta sin compresión (método "store") con su CRC-32.

export type Celda = string | number | null | undefined;

export type HojaExcel = {
  nombre: string;
  filas: Celda[][];
  /** Filas (índice desde 0) en negrita, p. ej. títulos y encabezados. */
  negritas?: number[];
  /** Ancho de cada columna en caracteres. */
  anchos?: number[];
};

const xml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Caracteres de control no válidos en XML
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

function columna(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

function hojaXml(h: HojaExcel): string {
  const negritas = new Set(h.negritas ?? []);
  const cols = h.anchos?.length
    ? `<cols>${h.anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const filas = h.filas
    .map((fila, r) => {
      const estilo = negritas.has(r) ? ' s="1"' : "";
      const celdas = fila
        .map((v, c) => {
          const ref = `${columna(c)}${r + 1}`;
          if (v === null || v === undefined || v === "") return "";
          if (typeof v === "number" && Number.isFinite(v))
            return `<c r="${ref}"${estilo}><v>${v}</v></c>`;
          return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${celdas}</row>`;
    })
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `${cols}<sheetData>${filas}</sheetData></worksheet>`
  );
}

function archivos(hojas: HojaExcel[]): [string, string][] {
  const ns = "http://schemas.openxmlformats.org";
  return [
    [
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Types xmlns="${ns}/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        hojas
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join("") +
        "</Types>",
    ],
    [
      "_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Relationships xmlns="${ns}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        "</Relationships>",
    ],
    [
      "xl/workbook.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>` +
        hojas
          .map(
            (h, i) =>
              `<sheet name="${xml(h.nombre.replace(/[\\/?*[\]:]/g, " ").slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
          )
          .join("") +
        "</sheets></workbook>",
    ],
    [
      "xl/_rels/workbook.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Relationships xmlns="${ns}/package/2006/relationships">` +
        hojas
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join("") +
        `<Relationship Id="rId${hojas.length + 1}" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        "</Relationships>",
    ],
    [
      "xl/styles.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<styleSheet xmlns="${ns}/spreadsheetml/2006/main">` +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        "</styleSheet>",
    ],
    ...hojas.map((h, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, hojaXml(h)]),
  ];
}

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of datos) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Empaqueta los archivos en un ZIP sin compresión. */
function zip(entradas: [string, string][]): Uint8Array {
  const enc = new TextEncoder();
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let offset = 0;
  for (const [nombre, contenido] of entradas) {
    const n = enc.encode(nombre);
    const d = enc.encode(contenido);
    const crc = crc32(d);
    const local = new Uint8Array(30 + n.length + d.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(4, 20, true);
    vl.setUint16(6, 0x0800, true); // nombres en UTF-8
    vl.setUint32(14, crc, true);
    vl.setUint32(18, d.length, true);
    vl.setUint32(22, d.length, true);
    vl.setUint16(26, n.length, true);
    local.set(n, 30);
    local.set(d, 30 + n.length);

    const central = new Uint8Array(46 + n.length);
    const vc = new DataView(central.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(4, 20, true);
    vc.setUint16(6, 20, true);
    vc.setUint16(8, 0x0800, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, d.length, true);
    vc.setUint32(24, d.length, true);
    vc.setUint16(28, n.length, true);
    vc.setUint32(42, offset, true);
    central.set(n, 46);

    locales.push(local);
    centrales.push(central);
    offset += local.length;
  }
  const tamCentral = centrales.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, entradas.length, true);
  vf.setUint16(10, entradas.length, true);
  vf.setUint32(12, tamCentral, true);
  vf.setUint32(16, offset, true);

  const total = new Uint8Array(offset + tamCentral + fin.length);
  let pos = 0;
  for (const parte of [...locales, ...centrales, fin]) {
    total.set(parte, pos);
    pos += parte.length;
  }
  return total;
}

/** Bytes del libro .xlsx con las hojas indicadas. */
export function crearXlsx(hojas: HojaExcel[]): Uint8Array {
  return zip(archivos(hojas));
}

/** Genera el libro y lo descarga en el navegador. */
export function descargarXlsx(nombreArchivo: string, hojas: HojaExcel[]) {
  const bytes = crearXlsx(hojas);
  const blob = new Blob([bytes as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
