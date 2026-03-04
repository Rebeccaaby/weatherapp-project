import PDFDocument from "pdfkit";

export function toCSV(rows: any[]) {
  const header = ["id","queryText","locationName","latitude","longitude","startDate","endDate","createdAt"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const vals = header.map((k) => JSON.stringify(r[k] ?? "")); //CSV thourgh JSON
    lines.push(vals.join(","));
  }
  return lines.join("\n");
}

export function toMarkdown(rows: any[]) {
  const header = ["id","locationName","startDate","endDate","createdAt"];
  const sep = header.map(() => "---");
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${sep.join(" | ")} |`,
    ...rows.map((r) => `| ${header.map((k) => String(r[k] ?? "")).join(" | ")} |`),
  ];
  return lines.join("\n");
}

export function toPDFBuffer(rows: any[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(18).text("Weather Requests Export", { underline: true });
    doc.moveDown();

    rows.forEach((r, idx) => {
      doc.fontSize(12).text(`${idx + 1}. ${r.locationName}`);
      doc.text(`Range: ${r.startDate} → ${r.endDate}`);
      doc.text(`Query: ${r.queryText}`);
      doc.text(`Coords: ${r.latitude}, ${r.longitude}`);
      doc.text(`Created: ${r.createdAt}`);
      doc.moveDown(0.7);
      doc.moveTo(doc.x, doc.y).lineTo(550, doc.y).strokeOpacity(0.2).stroke();
      doc.moveDown(0.7);
    });

    doc.end();
  });
}