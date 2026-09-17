import { Injectable } from '@angular/core';

export interface PdfRow {
  label: string;
  value: string;
}

@Injectable({ providedIn: 'root' })
export class AdminPdfService {
  download(title: string, rows: PdfRow[], fileName = 'securex-admin-report.pdf') {
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 42;
    const lineHeight = 15;
    const maxChars = 92;
    const pages: string[][] = [[]];

    const addLine = (line: string) => {
      if (pages[pages.length - 1].length >= 48) pages.push([]);
      pages[pages.length - 1].push(line);
    };

    addLine('SecureX Admin Report');
    addLine(title);
    addLine(`Generated: ${new Date().toISOString()}`);
    addLine('');

    for (const row of rows) {
      const text = `${row.label}: ${row.value}`;
      if (text.length <= maxChars) addLine(text);
      else for (let i = 0; i < text.length; i += maxChars) addLine(text.slice(i, i + maxChars));
    }

    const objects: string[] = [];
    const addObject = (body: string) => { objects.push(body); return objects.length; };

    const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const contentIds: number[] = [];
    const streams: string[] = [];

    for (const lines of pages) {
      let stream = 'BT\n';
      let y = pageHeight - margin;
      lines.forEach((line, index) => {
        const size = index === 0 ? 16 : index === 1 ? 12 : 10;
        stream += `/F1 ${size} Tf\n${margin} ${y} Td\n(${this.escape(line)}) Tj\n`;
        y -= lineHeight + (index < 2 ? 5 : 0);
      });
      stream += 'ET';
      streams.push(stream);
    }

    streams.forEach(stream => contentIds.push(addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)));

    const pagesId = objects.length + 1;
    const pageIds = streams.map((_, index) => pagesId + 1 + index);
    const catalogId = pagesId + 1 + pageIds.length;

    pageIds.forEach((pageId, index) => {
      addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`);
      void pageId;
    });
    addObject(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`);
    addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    objects.forEach((object, index) => {
      offsets[index + 1] = pdf.length;
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;

    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private escape(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' ');
  }
}
