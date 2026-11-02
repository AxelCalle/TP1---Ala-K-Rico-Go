import { describe, expect, it } from "vitest";
import { crearXlsx } from "@/lib/excel";

describe("crearXlsx", () => {
  it("genera un ZIP con las partes del libro", () => {
    const bytes = crearXlsx([
      {
        nombre: "Resumen",
        filas: [
          ["Indicador", "Valor"],
          ["Promedio", 28.5],
        ],
        negritas: [0],
      },
      { nombre: "Entregas", filas: [["Cliente <&>"], ["Ñaupari"]] },
    ]);
    // Firma ZIP "PK\x03\x04" y registro de fin de directorio
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const texto = new TextDecoder().decode(bytes);
    expect(texto).toContain("xl/worksheets/sheet2.xml");
    expect(texto).toContain("Cliente &lt;&amp;&gt;");
    expect(texto).toContain("<v>28.5</v>");
    if (process.env.XLSX_SALIDA) {
      // Permite abrir el archivo con Excel/openpyxl para validarlo a mano
      return import("node:fs").then((fs) => fs.writeFileSync(process.env.XLSX_SALIDA!, bytes));
    }
  });
});
