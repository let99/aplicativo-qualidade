import React, { useState } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs`;

export default function App() {
  const [rows, setRows] = useState([]);
  const [rawText, setRawText] = useState("");
  const [status, setStatus] = useState("Envie um arquivo CSV, XLSX, DOCX ou PDF.");
  const [fileName, setFileName] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setRows([]);
    setRawText("");
    setStatus("Lendo arquivo...");

    const extension = file.name.split(".").pop()?.toLowerCase();

    try {
      if (extension === "csv") {
        const text = await file.text();
        const parsed = parseCSV(text);
        setRows(parsed);
        setStatus(`CSV lido com ${parsed.length} linha(s).`);
        return;
      }

      if (extension === "xlsx" || extension === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
          defval: "",
        });
        setRows(json);
        setStatus(`Planilha lida com ${json.length} linha(s).`);
        return;
      }

      if (extension === "docx") {
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        setRawText(result.value || "");
        setStatus("DOCX lido. Texto extraído exibido abaixo.");
        return;
      }

      if (extension === "pdf") {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

        let text = "";
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          const pageText = content.items.map((item) => item.str).join(" ");
          text += `\n\n--- PÁGINA ${pageNum} ---\n\n${pageText}`;
        }

        setRawText(text);
        setStatus("PDF lido. Texto extraído exibido abaixo.");
        return;
      }

      setStatus("Formato não suportado.");
    } catch (error) {
      console.error(error);
      setStatus(`Erro ao ler o arquivo: ${error.message}`);
    }
  }

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
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
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

        <h1 style={{ fontSize: "44px", marginBottom: "16px" }}>
          Leitura de CSV, XLSX, DOCX e PDF
        </h1>

        <p
          style={{
            fontSize: "18px",
            color: "#cbd5e1",
            lineHeight: 1.6,
            maxWidth: "900px",
          }}
        >
          Esta versão serve para testar a extração dos arquivos. Primeiro vamos
          confirmar que o texto do DOCX e do PDF aparece corretamente. Depois
          partimos para o parser da FVS.
        </p>

        <div
          style={{
            marginTop: "28px",
            background: "white",
            color: "#0f172a",
            borderRadius: "20px",
            padding: "24px",
          }}
        >
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.docx,.pdf"
            onChange={handleFile}
            style={{ marginBottom: "16px" }}
          />

          <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
            Arquivo:
          </div>
          <div style={{ marginBottom: "16px" }}>
            {fileName || "Nenhum arquivo selecionado"}
          </div>

          <div style={{ marginBottom: "8px", fontWeight: "bold" }}>Status:</div>
          <div>{status}</div>
        </div>

        {rows.length > 0 && (
          <div
            style={{
              marginTop: "28px",
              background: "white",
              color: "#0f172a",
              borderRadius: "20px",
              padding: "24px",
              overflowX: "auto",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Pré-visualização da tabela</h2>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((key) => (
                    <th
                      key={key}
                      style={{
                        borderBottom: "1px solid #ccc",
                        padding: "10px",
                        textAlign: "left",
                      }}
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td
                        key={j}
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: "10px",
                          verticalAlign: "top",
                        }}
                      >
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
              marginTop: "28px",
              background: "white",
              color: "#0f172a",
              borderRadius: "20px",
              padding: "24px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Texto extraído</h2>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "monospace",
                fontSize: "14px",
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

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const headers = splitCSVLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
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
      result.push(cleanCSVValue(current));
      current = "";
    } else {
      current += char;
    }
  }

  result.push(cleanCSVValue(current));
  return result;
}

function cleanCSVValue(value) {
  return value.replace(/^"|"$/g, "").trim();
}
