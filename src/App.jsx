import React, { useState } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";

export default function App() {
  const [rows, setRows] = useState([]);
  const [rawText, setRawText] = useState("");
  const [status, setStatus] = useState("");
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
          const parsed = parseCSV(text);
          allRows = [...allRows, ...parsed];
        }

        else if (ext === "xlsx" || ext === "xls") {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          allRows = [...allRows, ...json];
        }

        else if (ext === "docx") {
          const buffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer: buffer });
          allText += `\n\n===== ${file.name} =====\n\n${result.value}`;
        }

        else if (ext === "pdf") {
          const buffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            const text = content.items.map((i) => i.str).join(" ");
            allText += `\n\n===== ${file.name} - Página ${p} =====\n\n${text}`;
          }
        }

        else {
          errorList.push(`${file.name}: formato não suportado`);
        }

      } catch (err) {
        console.error(err);
        errorList.push(`${file.name}: erro ao ler`);
      }
    }

    if (allRows.length) setRows(allRows);
    if (allText) setRawText(allText);
    if (errorList.length) setErrors(errorList);

    setStatus(`Processados ${files.length} arquivo(s).`);
  }

  return (
    <div style={{ padding: 40, background: "#0f172a", color: "white" }}>
      <h1>FVS Qualidade — Multi Upload</h1>

      <input type="file" multiple onChange={handleFile} />

      <div>
        <h3>Arquivos:</h3>
        {fileNames.map((f, i) => (
          <div key={i}>{f}</div>
        ))}
      </div>

      <p>Status: {status}</p>

      {errors.length > 0 && (
        <div style={{ color: "red" }}>
          <h3>Erros:</h3>
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      {rawText && (
        <div style={{ background: "white", color: "black", padding: 20 }}>
          <h3>Texto extraído</h3>
          <pre>{rawText}</pre>
        </div>
      )}
    </div>
  );
}

function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => (obj[h] = values[i]));
    return obj;
  });
}
