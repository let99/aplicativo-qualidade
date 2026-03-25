import React, { useState } from "react";
import * as XLSX from "xlsx";

export default function App() {
  const [data, setData] = useState([]);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (evt) => {
      const binary = evt.target.result;
      const workbook = XLSX.read(binary, { type: "binary" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      setData(json);
    };

    reader.readAsBinaryString(file);
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
      <h1>FVS Qualidade — Upload</h1>

      <input
        type="file"
        accept=".xlsx,.csv"
        onChange={handleFile}
        style={{ marginTop: 20 }}
      />

      <div style={{ marginTop: 40 }}>
        {data.length > 0 && (
          <table
            style={{
              background: "white",
              color: "black",
              borderRadius: "10px",
              padding: "10px",
            }}
          >
            <thead>
              <tr>
                {Object.keys(data[0]).map((key) => (
                  <th key={key} style={{ padding: 10 }}>
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((val, j) => (
                    <td key={j} style={{ padding: 10 }}>
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
