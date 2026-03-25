import React from "react";

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        fontFamily: "Arial, sans-serif",
        padding: "40px",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
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

        <h1
          style={{
            fontSize: "48px",
            margin: "0 0 16px 0",
            lineHeight: 1.1,
          }}
        >
          Dashboard de FVS para controle de qualidade em obra
        </h1>

        <p
          style={{
            fontSize: "18px",
            color: "#cbd5e1",
            maxWidth: "800px",
            lineHeight: 1.6,
            marginBottom: "32px",
          }}
        >
          Este é o seu primeiro deploy. Depois vamos evoluir para upload de FVS,
          leitura de PDF/DOCX e geração automática de relatórios.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <Card title="Aptos inspecionados" value="10" subtitle="Torre A" />
          <Card title="TAPI" value="0%" subtitle="Meta ≥ 85%" />
          <Card title="Reprovados" value="10" subtitle="0 aprovados" />
          <Card title="Total NCs" value="220" subtitle="ocorrências R" />
        </div>

        <div
          style={{
            background: "white",
            color: "#0f172a",
            borderRadius: "20px",
            padding: "24px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Próximos passos</h2>
          <ul style={{ lineHeight: 1.8, paddingLeft: "20px" }}>
            <li>Publicar este site no Vercel</li>
            <li>Confirmar que o deploy funcionou</li>
            <li>Depois integrar parser real de FVS</li>
            <li>Adicionar upload de CSV, XLSX, DOCX e PDF</li>
          </ul>
        </div>
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
        borderRadius: "18px",
        padding: "20px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          textTransform: "uppercase",
          color: "#64748b",
          fontWeight: "bold",
          marginBottom: "10px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "36px",
          fontWeight: "bold",
          marginBottom: "8px",
        }}
      >
        {value}
      </div>
      <div style={{ color: "#475569" }}>{subtitle}</div>
    </div>
  );
}
