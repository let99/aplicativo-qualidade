import React, { useState } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";

export default function App() {
  const [rows, setRows] = useState([]);
  const [rawText, setRawText] = useState("");
  const [status, setStatus] = useState("Envie arquivos (CSV, XLSX, DOCX, PDF).");
  const [fileNames, setFileNames] = useState([]);

  async function handleFile(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setRows([]);
    setRawText("");
    setFileNames(files.map((f) => f.name));
    setStatus("Lendo arquivos...");

    let allRows = [];
    let allText = "";

    try {
      for (const file of files) {
        const extension = file.name.split(".").pop()?.toLowerCase();

        if (extension === "csv") {
          const text = await file.text();
          const parsed = parseCSV(text);
          allRows = [...allRows, ...parsed];
        }

        else if (extension === "xlsx" || extension === "xls") {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          allRows = [...allRows, ...json];
        }

        else if (extension === "docx") {
          const buffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer: buffer });
          allText += `\n\n===== ${file.name} =====\n\n${result.value}`;
        }

        else if (extension === "pdf") {
          const buffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            const pageText = content.items.map((item) => item.str).join(" ");
            allText += `\n\n===== ${file.name} - Página ${pageNum} =====\n\n${pageText}`;
          }
        }
      }

      if (allRows.length > 0) setRows(allRows);
      if (allText) setRawText(allText);

      setStatus(`Processados ${files.length} arquivo(s).`);
    } catch (error) {
      console.error(error);
      setStatus("Erro ao processar arquivos.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        padding: "40px",
        fontFamily: "Arial",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1>FVS Qualidade — Multi Upload</h1>

        <input
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.docx,.pdf"
          onChange={handleFile}
          style={{ marginTop: 20 }}
        />

        <div style={{ marginTop: 20 }}>
          <strong>Arquivos:</strong>
          <ul>
            {fileNames.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 10 }}>
          <strong>Status:</strong> {status}
        </div>

        {rows.length > 0 && (
          <div
            style={{
              marginTop: 30,
              background: "white",
              color: "black",
              padding: 20,
              borderRadius: 10,
              overflowX: "auto",
            }}
          >
            <h2>Tabela combinada</h2>
            <table>
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((key) => (
                    <th key={key} style={{ padding: 8 }}>
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} style={{ padding: 8 }}>
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
              marginTop: 30,
              background: "white",
              color: "black",
              padding: 20,
              borderRadius: 10,
            }}
          >
            <h2>Texto extraído (DOCX/PDF)</h2>
            <pre style={{ whiteSpace: "pre-wrap" }}>{rawText}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];

  const headers = lines[0].split(",");

  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  });
}
