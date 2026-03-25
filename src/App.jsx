import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";

const AMBIENTES_PADRAO = [
  "SALA",
  "VARANDA",
  "COZINHA",
  "ÁREA SERV",
  "DEPÓSITO",
  "BWC SERV",
  "LAVABO",
  "SUÍTE 01",
  "BWC SUÍTE 01 E 02",
  "SUÍTE 02",
  "SUÍTE 03",
  "BWC SUÍTE 03",
  "SUÍTE 04",
  "BWC SUÍTE 04",
];

const CRITERIOS = [
  "Planicidade",
  "Peças sem trincas e lascas",
  "Declividade em direção aos ralos",
  "Rejunte",
  "Sem excesso de argamassa",
  "Dupla colagem",
  "Terminalidade",
  "Presença de som cavo",
  "Limpeza",
];

export default function App() {
  const [rows, setRows] = useState([]);
  const [rawText, setRawText] = useState("");
  const [status, setStatus] = useState("Envie arquivos CSV, XLSX, DOCX ou PDF.");
  const [fileNames, setFileNames] = useState([]);
  const [errors, setErrors] = useState([]);

  async function handleFile(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setRows([]);
    setRawText("");
    setErrors([]);
    setFileNames(files.map((f) => f.name));
    setStatus("Processando arquivos...");

    let allRows = [];
    let allText = "";
    let errorList = [];

    for (const file of files) {
      try {
        const ext = file.name.split(".").pop()?.toLowerCase();

        if (ext === "csv") {
          const text = await file.text();
          const parsed = parseCSV(text).map((r) => ({
            ...r,
            fonte: file.name,
          }));
          allRows = [...allRows, ...parsed];
          continue;
        }

        if (ext === "xlsx" || ext === "xls") {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }).map((r) => ({
            ...r,
            fonte: file.name,
          }));
          allRows = [...allRows, ...json];
          continue;
        }

        if (ext === "docx") {
          const buffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer: buffer });
          const text = result.value || "";
          allText += `\n\n===== ${file.name} =====\n\n${text}`;
          const parsedRows = parseFvsText(file.name, text);
          allRows = [...allRows, ...parsedRows];
          continue;
        }

        if (ext === "pdf") {
          const buffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

          let pdfText = "";
          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            const text = content.items.map((i) => i.str).join(" ");
            pdfText += ` ${text}`;
          }

          allText += `\n\n===== ${file.name} =====\n\n${pdfText}`;
          const parsedRows = parseFvsText(file.name, pdfText);
          allRows = [...allRows, ...parsedRows];
          continue;
        }

        errorList.push(`${file.name}: formato não suportado.`);
      } catch (err) {
        console.error(err);
        errorList.push(`${file.name}: erro ao ler (${err.message}).`);
      }
    }

    setRows(allRows);
    setRawText(allText);
    setErrors(errorList);
    setStatus(
      `Processados ${files.length} arquivo(s). Linhas estruturadas: ${allRows.length}.`
    );
  }

  const metrics = useMemo(() => {
    const validRows = rows.filter((r) =>
      ["A", "R", "NV", "NA"].includes(normResult(r.resultado))
    );

    const apartments = [...new Set(validRows.map((r) => r.apto).filter(Boolean))];
    const approved = validRows.filter((r) => normResult(r.resultado) === "A").length;
    const reproved = validRows.filter((r) => normResult(r.resultado) === "R").length;
    const nv = validRows.filter((r) => normResult(r.resultado) === "NV").length;

    const totalAR = approved + reproved;
    const tapi = totalAR ? Math.round((approved / totalAR) * 100) : 0;

    const byApto = {};
    validRows.forEach((r) => {
      const apto = r.apto || "Sem apto";
      if (!byApto[apto]) {
        byApto[apto] = {
          apto,
          pav: inferPavimento(apto),
          data: r.data || "",
          verificacoes: 0,
          ncs: 0,
          criteriosSet: new Set(),
        };
      }

      if (normResult(r.resultado) !== "NA") {
        byApto[apto].verificacoes += 1;
      }

      if (normResult(r.resultado) === "R") {
        byApto[apto].ncs += 1;
        byApto[apto].criteriosSet.add(r.criterio);
      }
    });

    const apartmentTable = Object.values(byApto)
      .map((item) => ({
        apto: item.apto,
        pav: item.pav,
        data: item.data,
        verificacoes: item.verificacoes,
        ncs: item.ncs,
        percentual: item.verificacoes
          ? `${Math.round((item.ncs / item.verificacoes) * 100)}%`
          : "0%",
        criterios: Array.from(item.criteriosSet).slice(0, 4).join(", "),
        status: item.ncs > 0 ? "REPROVADO" : "APROVADO",
      }))
      .sort(
        (a, b) =>
          Number(String(a.apto).match(/\d+/)?.[0] || 0) -
          Number(String(b.apto).match(/\d+/)?.[0] || 0)
      );

    const criteriosMap = {};
    validRows.forEach((r) => {
      const crit = r.criterio || "Não informado";
      if (!criteriosMap[crit]) {
        criteriosMap[crit] = { total: 0, r: 0 };
      }
      criteriosMap[crit].total += 1;
      if (normResult(r.resultado) === "R") {
        criteriosMap[crit].r += 1;
      }
    });

    const pareto = Object.entries(criteriosMap)
      .map(([criterio, vals]) => ({
        criterio,
        reprovações: vals.r,
        taxa: vals.total ? Math.round((vals.r / vals.total) * 100) : 0,
      }))
      .sort((a, b) => b.reprovações - a.reprovações)
      .slice(0, 6);

    return {
      apartments: apartments.length,
      approved,
      reproved,
      nv,
      tapi,
      apartmentTable,
      pareto,
      totalNCs: reproved,
      reprovedApartments: apartmentTable.filter((x) => x.status === "REPROVADO").length,
      approvedApartments: apartmentTable.filter((x) => x.status === "APROVADO").length,
    };
  }, [rows]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        padding: "40px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div
          style={{
            display: "inline-block",
            padding: "8px 14px",
            borderRadius: "999px",
            background: "#082f49",
            color: "#7dd3fc",
            fontSize: "14px",
            fontWeight: "bold",
            marginBottom: "20px",
          }}
        >
          FVS Qualidade
        </div>

        <h1 style={{ fontSize: "44px", marginBottom: "12px" }}>
          Dashboard automático de FVS
        </h1>

        <p style={{ fontSize: "18px", color: "#cbd5e1", lineHeight: 1.6 }}>
          Esta versão já tenta transformar DOCX e PDF da FVS em linhas estruturadas,
          montar tabela por apartamento e calcular indicadores.
        </p>

        <div
          style={{
            marginTop: "24px",
            background: "white",
            color: "#0f172a",
            borderRadius: "20px",
            padding: "24px",
          }}
        >
          <input
            type="file"
            multiple
            accept=".csv,.xlsx,.xls,.docx,.pdf"
            onChange={handleFile}
          />

          <div style={{ marginTop: 16 }}>
            <strong>Arquivos:</strong>
            <ul>
              {fileNames.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          </div>

          <div>
            <strong>Status:</strong> {status}
          </div>

          {errors.length > 0 && (
            <div style={{ marginTop: 16, color: "#b91c1c" }}>
              <strong>Erros:</strong>
              <ul>
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginTop: "28px",
          }}
        >
          <Card
            title="APTOS INSPECIONADOS"
            value={metrics.apartments}
            subtitle="FVS consolidadas"
          />
          <Card title="TAPI" value={`${metrics.tapi}%`} subtitle="Meta ≥ 85%" />
          <Card
            title="REPROVADOS"
            value={metrics.reprovedApartments}
            subtitle={`${metrics.approvedApartments} aprovados`}
          />
          <Card
            title="TOTAL NCS"
            value={metrics.totalNCs}
            subtitle="Ocorrências R"
          />
        </div>

        {metrics.pareto.length > 0 && (
          <div
            style={{
              marginTop: 28,
              background: "white",
              color: "#0f172a",
              borderRadius: 20,
              padding: 24,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Pareto de critérios mais reprovados</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Critério</th>
                  <th style={thStyle}>Reprovações</th>
                  <th style={thStyle}>Taxa</th>
                </tr>
              </thead>
              <tbody>
                {metrics.pareto.map((item, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{item.criterio}</td>
                    <td style={tdStyle}>{item.reprovações}</td>
                    <td style={tdStyle}>{item.taxa}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {metrics.apartmentTable.length > 0 && (
          <div
            style={{
              marginTop: 28,
              background: "white",
              color: "#0f172a",
              borderRadius: 20,
              padding: 24,
              overflowX: "auto",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Resultado por apartamento</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Apto</th>
                  <th style={thStyle}>Pav.</th>
                  <th style={thStyle}>Data</th>
                  <th style={thStyle}>Verificações</th>
                  <th style={thStyle}>NCs (R)</th>
                  <th style={thStyle}>% R</th>
                  <th style={thStyle}>Critérios críticos</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {metrics.apartmentTable.map((item, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{item.apto}</td>
                    <td style={tdStyle}>{item.pav}</td>
                    <td style={tdStyle}>{item.data}</td>
                    <td style={tdStyle}>{item.verificacoes}</td>
                    <td style={tdStyle}>{item.ncs}</td>
                    <td style={tdStyle}>{item.percentual}</td>
                    <td style={tdStyle}>{item.criterios || "—"}</td>
                    <td style={tdStyle}>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div
            style={{
              marginTop: 28,
              background: "white",
              color: "#0f172a",
              borderRadius: 20,
              padding: 24,
              overflowX: "auto",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Linhas estruturadas</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((key) => (
                    <th key={key} style={thStyle}>
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} style={tdStyle}>
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rawText && (
          <div
            style={{
              marginTop: 28,
              background: "white",
              color: "#0f172a",
              borderRadius: 20,
              padding: 24,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Texto extraído</h2>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {rawText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, value, subtitle }) {
  return (
    <div
      style={{
        background: "white",
        color: "#0f172a",
        borderRadius: 18,
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          color: "#64748b",
          fontWeight: "bold",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 36, fontWeight: "bold", marginBottom: 8 }}>
        {value}
      </div>
      <div style={{ color: "#475569" }}>{subtitle}</div>
    </div>
  );
}

const thStyle = {
  borderBottom: "1px solid #cbd5e1",
  padding: "10px",
  textAlign: "left",
  background: "#f8fafc",
};

const tdStyle = {
  borderBottom: "1px solid #e2e8f0",
  padding: "10px",
  verticalAlign: "top",
};

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  });
}

function splitCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(cleanCSV(current));
      current = "";
    } else {
      current += char;
    }
  }

  result.push(cleanCSV(current));
  return result;
}

function cleanCSV(value) {
  return value.replace(/^"|"$/g, "").trim();
}

function parseFvsText(fileName, rawText) {
  const text = normalizeSpaces(rawText);

  const apto =
    extractFirst(fileName, /apto\s*([0-9]{3,4}\s*[A-Za-z]?)/i) ||
    extractFirst(text, /Local da inspeção\s*:?\s*([0-9]{3,4}\s*[A-Za-z]?)/i) ||
    "";

  const data = extractFirst(text, /DATA\s*:?\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i) || "";

  const responsavel =
    extractFirst(text, /Responsável\s*:?\s*([A-Za-zÀ-ÿ ]{3,80})/i) || "";

  const servico =
    extractFirst(
      text,
      /Serviço\s*:?\s*([A-Za-zÀ-ÿ0-9 ,\-]+?)(?=Responsável|Local da inspeção|INSPEÇÕES)/i
    ) || "Revestimento Cerâmico";

  const rows = [];

  for (const criterio of CRITERIOS) {
    const match = findCriterionSegment(text, criterio);
    if (!match) continue;

    const tokens = extractResultTokens(match);
    if (!tokens.length) continue;

    for (let i = 0; i < Math.min(tokens.length, AMBIENTES_PADRAO.length); i += 1) {
      rows.push({
        apto: sanitize(apto),
        pav: inferPavimento(apto),
        data,
        ambiente: AMBIENTES_PADRAO[i],
        criterio,
        resultado: normResult(tokens[i]),
        observacao: "",
        equipe: responsavel,
        servico: sanitize(servico),
        fonte: fileName,
      });
    }
  }

  return rows;
}

function findCriterionSegment(text, criterio) {
  const idx = text.toLowerCase().indexOf(criterio.toLowerCase());
  if (idx === -1) return "";
  return text.slice(idx, idx + 320);
}

function extractResultTokens(segment) {
  const matches = segment.match(/N\/V|N\/A|\bA\b|\bR\b|-/gi) || [];
  return matches.map((m) => m.toUpperCase());
}

function normResult(value) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "A") return "A";
  if (v === "R") return "R";
  if (v === "N/V" || v === "NV") return "NV";
  if (v === "N/A" || v === "NA" || v === "-") return "NA";
  return v;
}

function extractFirst(text, regex) {
  const match = String(text || "").match(regex);
  return match?.[1]?.trim() || "";
}

function normalizeSpaces(value) {
  return String(value || "")
    .replace(/[\t\r]+/g, " ")
    .replace(/\n+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

function inferPavimento(apto) {
  const num = Number(String(apto).match(/\d{3,4}/)?.[0] || "0");
  if (!num) return "";
  return `${Math.floor(num / 100)}º`;
}

function sanitize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

