export function rows(u) {
  return u.map(x => ({
    "N°": x.sequence ?? "",
    "Ticket": x.ticket || "",
    "ID": x.unitId || "",
    "Fabricante": x.manufacturer || "",
    "Fecha recepción": x.receivedDate || x.lotDate || "",
    "Fecha mantenimiento": x.maintenanceDate || "",
    "Fecha entrega": x.deliveryDate || "",
    "Garantía (meses)": Number(x.warrantyMonths || 2),
    "Garantía hasta": x.warrantyUntil || "",
    "Tipo de lectura": x.readType || "",
    "Cantidad": 1,
    "Estado diagnóstico": x.diagnosis || "",
    "Reparable": x.repairable === true ? "Sí" : x.repairable === false ? "No" : "",
    "Motivo no reparable": (x.noRepairReasons || []).join(" + "),
    "Tipo de mantenimiento": x.maintenanceType || "",
    "Solicitud / falla reportada": x.repairRequest || "",
    "Reparación / proceso realizado": x.processPerformed || (x.repairs || []).join(" + "),
    "Observaciones": [
      x.deliveryStatus === "Entregado" ? "ENTREGADO" : "",
      x.observations || ""
    ].filter(Boolean).join(" · "),
    "Empaque": x.packaging || ""
  }));
}

export async function exportExcel(u) {
  if (!window.XLSX) {
    return alert("Excel aún no está disponible.");
  }

  const data = rows(u);
  const wb = XLSX.utils.book_new();

  if (!data.length) {
    const headers = ["N°","Ticket","ID","Fabricante","Fecha recepción","Fecha mantenimiento","Fecha entrega","Garantía (meses)","Garantía hasta","Tipo de lectura","Cantidad","Estado diagnóstico","Reparable","Motivo no reparable","Tipo de mantenimiento","Solicitud / falla reportada","Reparación / proceso realizado","Observaciones","Empaque"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws["!cols"] = headers.map((h, i) => ({ wch: [6,14,12,18,15,18,15,15,15,16,10,18,12,28,24,32,34,36,20][i] }));
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, "conteo-rapido.xlsx");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(data);

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    "Inventario"
  );

  const range =
    XLSX.utils.decode_range(ws["!ref"]);

  /*
    Encabezados
  */
  for (
    let c = range.s.c;
    c <= range.e.c;
    c++
  ) {
    const cell =
      ws[
        XLSX.utils.encode_cell({
          r: 0,
          c
        })
      ];

    if (cell) {
      cell.s = {
        font: {
          bold: true,
          color: {
            rgb: "FFFFFF"
          }
        },
        fill: {
          fgColor: {
            rgb: "0F172A"
          }
        },
        alignment: {
          vertical: "center",
          horizontal: "center",
          wrapText: true
        }
      };
    }
  }

  /*
    Colores según estado
  */
  for (
    let r = 1;
    r <= range.e.r;
    r++
  ) {
    const row =
      data[r - 1];

    const delivered = /(^| · )ENTREGADO( · |$)/i.test(String(row["Observaciones"] || ""));
    const fill =
      row["Estado diagnóstico"] === "No reparable" ? "FECACA" :
      row.Empaque === "Empacado" ? "BBF7D0" :
      row.Empaque === "Listo para empacar" ? "FEF08A" : null;

    for (
      let c = range.s.c;
      c <= range.e.c;
      c++
    ) {
      const cell =
        ws[
          XLSX.utils.encode_cell({
            r,
            c
          })
        ];

      if (cell) {
        const isObservations = c === Object.keys(data[r - 1]).indexOf("Observaciones");
        if (delivered && isObservations) {
          cell.s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "002060" } }, alignment: { vertical: "center", horizontal: "left", wrapText: true } };
        } else if (fill) {
          cell.s = { fill: { fgColor: { rgb: fill } }, alignment: { vertical: "top", wrapText: true } };
        }
      }
    }
  }

  /*
    Alineación general
  */
  for (const k of Object.keys(ws)) {
    if (k[0] !== "!") {
      ws[k].s = {
        ...(ws[k].s || {}),
        alignment: {
          ...(ws[k].s?.alignment || {}),
          vertical: "top",
          wrapText: true
        }
      };
    }
  }

  /*
    Ancho de columnas
  */
  const widths = {"N°":6,"Ticket":14,"ID":12,"Fabricante":18,"Fecha recepción":15,"Fecha mantenimiento":18,"Fecha entrega":15,"Garantía (meses)":15,"Garantía hasta":15,"Tipo de lectura":16,"Cantidad":10,"Estado diagnóstico":18,"Reparable":12,"Motivo no reparable":28,"Tipo de mantenimiento":24,"Solicitud / falla reportada":32,"Reparación / proceso realizado":34,"Observaciones":36,"Empaque":20};
  ws["!cols"] = Object.keys(data[0]).map(k => ({ wch: widths[k] || Math.min(36, Math.max(12, k.length + 2)) }));

  XLSX.writeFile(
    wb,
    "conteo-rapido.xlsx"
  );
}

/*
  ============================================================
  IMPORTAR EXCEL
  ============================================================
*/

function clean(value) {
  return String(value ?? "").trim();
}

function cleanDate(value) {
  if (value == null || value === "") return "";

  const validDate = (year, month, day) => {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return "";
    const date = new Date(Date.UTC(y, m - 1, d));
    if (
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== m - 1 ||
      date.getUTCDate() !== d
    ) return "";
    return [String(y).padStart(4, "0"), String(m).padStart(2, "0"), String(d).padStart(2, "0")].join("-");
  };

  if (typeof value === "number" && Number.isFinite(value) && value >= 20000 && value <= 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return validDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  const text = clean(value);
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T)/);
  if (iso) return validDate(iso[1], iso[2], iso[3]);

  const local = text.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (local) return validDate(local[3], local[2], local[1]);

  // No guardar texto arbitrario en un campo de fecha.
  return "";
}

function splitValues(value) {
  return clean(value)
    .split("+")
    .map(x => x.trim())
    .filter(Boolean);
}

function parseRepairable(value, diagnosis) {
  const v = clean(value).toLowerCase();
  if (["sí", "si", "yes", "true"].includes(v)) return true;
  if (["no", "false"].includes(v)) return false;
  if (diagnosis === "No reparable") return false;
  if (diagnosis === "Reparable") return true;
  return null;
}

function normalizeDiagnosis(value, rowNumber) {
  const v = clean(value).toLowerCase();
  if (["no reparable", "no-reparable"].includes(v)) return "No reparable";
  if (["reparable", "reparado"].includes(v)) return "Reparable";
  throw new Error(`La fila ${rowNumber} tiene un diagnóstico vacío o desconocido. Corrígelo antes de importar.`);
}

/**
 * Convierte una fila del Excel exportado por
 * Conteo Rápido a una unidad de inventario.
 */
export function rowToUnit(row, index, lot) {
  const diagnosis = normalizeDiagnosis(row["Estado diagnóstico"], index + 2);

  const unitId =
    clean(row["ID"]);

  if (!unitId) {
    throw new Error(
      `La fila ${index + 2} no tiene ID.`
    );
  }

  const repairs =
    diagnosis === "No reparable"
      ? []
      : splitValues(
          row["Reparación / proceso realizado"] ||
          row["Reparación / mantenimiento"]
        );

  const reasons =
    diagnosis === "No reparable"
      ? splitValues(
          row[
            "Motivo no reparable"
          ]
        )
      : [];

  return {
    id:
      "unit-" +
      crypto.randomUUID(),

    unitId,

    sequence:
      index + 1,

    ticket:
      clean(row["Ticket"]),

    manufacturer:
      clean(row["Fabricante"]) ||
      "Pendiente",

    lotDate: cleanDate(row["Fecha recepción"] || row["Fecha del lote"]) || lot.date,
    receivedDate: cleanDate(row["Fecha recepción"] || row["Fecha del lote"]) || lot.date,
    maintenanceDate: cleanDate(row["Fecha mantenimiento"]),
    deliveryDate: cleanDate(row["Fecha entrega"]),
    deliveryStatus: /(^| · )ENTREGADO( · |$)/i.test(clean(row["Observaciones"])) ? "Entregado" : "Pendiente",
    warrantyMonths: (() => { const months = Number(row["Garantía (meses)"] || 2); return Number.isFinite(months) ? Math.min(6, Math.max(2, Math.round(months))) : 2; })(),
    warrantyUntil: cleanDate(row["Garantía hasta"]),
    maintenanceType: clean(row["Tipo de mantenimiento"]),
    repairRequest: clean(row["Solicitud / falla reportada"]),
    processPerformed: clean(row["Reparación / proceso realizado"] || row["Reparación / mantenimiento"]),

    readType:
      clean(row["Tipo de lectura"]) ||
      "Importado desde Excel",

    diagnosis,

    repairable:
      parseRepairable(
        row["Reparable"],
        diagnosis
      ),

    noRepairReasons:
      reasons,

    repairs,

    observations: clean(row["Observaciones"]).replace(/(^| · )ENTREGADO( · |$)/ig, " ").replace(/\s*·\s*·\s*/g, " · ").trim().replace(/^·\s*|\s*·$/g, ""),

    packaging:
      clean(row["Empaque"]) ||
      "Listo para empacar",

    lotId:
      lot.id,

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString(),

    importedFromExcel: true
  };
}

/**
 * Importa un Excel y devuelve los datos preparados.
 *
 * Esta función NO escribe directamente en IndexedDB.
 * app.js se encarga de crear el lote y guardar los registros.
 */
export async function readExcelFile(file) {
  if (!window.XLSX) {
    throw new Error(
      "La biblioteca de Excel todavía no está disponible."
    );
  }

  if (!file) {
    throw new Error(
      "No se seleccionó ningún archivo."
    );
  }

  const valid =
    /\.(xlsx|xls)$/i.test(
      file.name
    );

  if (!valid) {
    throw new Error(
      "Selecciona un archivo Excel (.xlsx o .xls)."
    );
  }

  const buffer =
    await file.arrayBuffer();

  const workbook =
    XLSX.read(buffer, {
      type: "array"
    });

  if (
    !workbook.SheetNames.length
  ) {
    throw new Error(
      "El archivo Excel no contiene hojas."
    );
  }

  /*
    Utilizamos la primera hoja.
    Es la hoja "Inventario" que genera
    Conteo Rápido.
  */
  const sheet =
    workbook.Sheets[
      workbook.SheetNames[0]
    ];

  const rows =
    XLSX.utils.sheet_to_json(
      sheet,
      {
        defval: ""
      }
    );

  if (!rows.length) {
    throw new Error(
      "El Excel está vacío."
    );
  }

  const columns = Object.keys(rows[0]);
  if (!columns.includes("ID")) {
    throw new Error('El Excel no tiene la columna "ID".');
  }

  return {
    fileName: file.name,
    sheetName:
      workbook.SheetNames[0],
    rows
  };
}

export function exportCsv(u) {
  const d = rows(u);

  const k = Object.keys(d[0] || {
    "N°": "",
    "Ticket": "",
    "ID": "",
    "Fabricante": "",
    "Fecha recepción": "",
    "Fecha mantenimiento": "",
    "Fecha entrega": "",
    "Garantía (meses)": "",
    "Garantía hasta": "",
    "Tipo de lectura": "",
    "Cantidad": "",
    "Estado diagnóstico": "",
    "Reparable": "",
    "Motivo no reparable": "",
    "Tipo de mantenimiento": "",
    "Solicitud / falla reportada": "",
    "Reparación / proceso realizado": "",
    "Observaciones": "",
    "Empaque": ""
  });

  const e = value =>
    String(value ?? "")
      .replaceAll('"', '""');

  const c =
    "\ufeff" +
    k
      .map(
        x =>
          '"' +
          e(x) +
          '"'
      )
      .join(",") +
    "\n" +
    d
      .map(r =>
        k
          .map(
            x =>
              '"' +
              e(r[x]) +
              '"'
          )
          .join(",")
      )
      .join("\n");

  download(
    new Blob(
      [c],
      {
        type:
          "text/csv;charset=utf-8"
      }
    ),
    "conteo-rapido.csv"
  );
}

export function exportJson(x) {
  download(
    new Blob(
      [
        JSON.stringify(
          x,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    ),
    "conteo-rapido-backup.json"
  );
}

function download(blob, name) {
  const a =
    document.createElement("a");

  a.href =
    URL.createObjectURL(blob);

  a.download = name;

  a.click();

  setTimeout(
    () =>
      URL.revokeObjectURL(
        a.href
      ),
    1000
  );
}