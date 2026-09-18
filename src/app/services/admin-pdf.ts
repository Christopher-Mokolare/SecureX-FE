import { Injectable } from '@angular/core';

export interface PdfColumn { label: string; width: number; align?: 'left' | 'right' | 'center'; }
export interface PdfTableOptions { landscape?: boolean; subtitle?: string; }
export interface PdfSummaryMetric { label: string; value: string; accent?: 'blue' | 'green' | 'amber' | 'red' | 'slate'; }

@Injectable({ providedIn: 'root' })
export class AdminPdfService {
  private readonly navy = [0.059, 0.090, 0.165];
  private readonly blue = [0.231, 0.510, 0.965];
  private readonly slate = [0.392, 0.455, 0.545];

  downloadTable(title: string, columns: PdfColumn[], rows: string[][], fileName: string, options: PdfTableOptions = {}): void {
    const landscape = options.landscape !== false;
    const pageWidth = landscape ? 842 : 595;
    const pageHeight = landscape ? 595 : 842;
    const margin = 28;
    const normalized = this.normalizeColumns(columns, pageWidth - margin * 2);
    const pages = this.buildTablePages(title, options.subtitle || 'SecureX Admin Portal', normalized, rows, pageWidth, pageHeight, margin);
    this.savePdf(this.renderPages(pages, pageWidth, pageHeight), fileName);
  }

  downloadSummary(title: string, metrics: PdfSummaryMetric[], sections: Array<{ title: string; rows: Array<[string, string]> }>, fileName: string): void {
    const pageWidth = 842; const pageHeight = 595; const margin = 32; const pages: string[][] = [[]];
    const add = (line: string) => pages[pages.length - 1].push(line);
    add(this.headerStream(title, 'SecureX Admin Portal', pageWidth, pageHeight, margin));
    let y = pageHeight - 122;
    add('0.392 0.455 0.545 rg'); add('/F1 9 Tf'); add('1 0 0 1 ' + margin + ' ' + y + ' Tm'); add('(Operational snapshot) Tj');
    const gap = 10; const cards = Math.min(metrics.length, 5); const cardWidth = (pageWidth - margin * 2 - gap * (cards - 1)) / cards; const cardY = y - 82;
    for (let i = 0; i < cards; i++) {
      const x = margin + i * (cardWidth + gap); const metric = metrics[i]; const rgb = this.metricColor(metric.accent);
      add(rgb.join(' ') + ' rg'); add(this.rect(x, cardY, cardWidth, 62) + ' f');
      add('1 1 1 rg'); add('/F2 8 Tf'); add('1 0 0 1 ' + (x + 10) + ' ' + (cardY + 40) + ' Tm'); add('(' + this.escape(metric.label.toUpperCase()) + ') Tj');
      add('/F2 15 Tf'); add('1 0 0 1 ' + (x + 10) + ' ' + (cardY + 18) + ' Tm'); add('(' + this.escape(metric.value) + ') Tj');
    }
    y = cardY - 30;
    for (const section of sections) {
      if (y < 70) { pages.push([]); y = pageHeight - 105; }
      add('0.059 0.090 0.165 rg'); add('/F2 11 Tf'); add('1 0 0 1 ' + margin + ' ' + y + ' Tm'); add('(' + this.escape(section.title) + ') Tj'); y -= 18;
      for (const pair of section.rows) {
        if (y < 48) { pages.push([]); y = pageHeight - 105; }
        add('0.392 0.455 0.545 rg'); add('/F1 9 Tf'); add('1 0 0 1 ' + margin + ' ' + y + ' Tm'); add('(' + this.escape(pair[0]) + ') Tj');
        add('0.059 0.090 0.165 rg'); add('/F2 9 Tf'); add('1 0 0 1 ' + (margin + 170) + ' ' + y + ' Tm'); add('(' + this.escape(pair[1]) + ') Tj'); y -= 16;
      }
      y -= 8;
    }
    this.addFooters(pages, pageWidth, pageHeight, margin);
    this.savePdf(this.renderPages(pages, pageWidth, pageHeight), fileName);
  }

  private buildTablePages(title: string, subtitle: string, columns: PdfColumn[], rows: string[][], pageWidth: number, pageHeight: number, margin: number): string[][] {
    const pages: string[][] = [[]]; const headerHeight = 82; const footer = 30; const tableHeader = 25; const bottom = footer + margin; const line = 10; const pad = 6;
    const start = () => {
      if (pages[pages.length - 1].length) pages.push([]);
      const page = pages[pages.length - 1]; page.push(this.headerStream(title, subtitle, pageWidth, pageHeight, margin));
      page.push('0.945 0.961 0.980 rg'); page.push(this.rect(margin, pageHeight - headerHeight - 4, pageWidth - margin * 2, tableHeader) + ' f');
      let x = margin; for (const col of columns) { page.push('0.059 0.090 0.165 rg'); page.push('/F2 8 Tf'); page.push('1 0 0 1 ' + (x + pad) + ' ' + (pageHeight - headerHeight + 4) + ' Tm'); page.push('(' + this.escape(col.label.toUpperCase()) + ') Tj'); x += col.width; }
    };
    start(); let y = pageHeight - headerHeight - tableHeader - 4;
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]; const wrapped = columns.map((c, i) => this.wrap(row[i] || '', c.width - pad * 2, 8, 2)); const rowLines = Math.max.apply(null, wrapped.map(v => v.length)); const rowHeight = Math.max(24, rowLines * line + 10);
      if (y - rowHeight < bottom) { start(); y = pageHeight - headerHeight - tableHeader - 4; }
      const page = pages[pages.length - 1]; page.push(rowIndex % 2 === 0 ? '0.973 0.980 0.988 rg' : '1 1 1 rg'); page.push(this.rect(margin, y - rowHeight + 2, pageWidth - margin * 2, rowHeight) + ' f');
      let x = margin;
      for (let i = 0; i < columns.length; i++) { const col = columns[i]; const lines = wrapped[i]; page.push('0.059 0.090 0.165 rg'); page.push('/F1 8 Tf');
        lines.forEach((txt, li) => { const w = this.approxWidth(txt, 8); const tx = col.align === 'right' ? x + col.width - pad - w : col.align === 'center' ? x + (col.width - w) / 2 : x + pad; page.push('1 0 0 1 ' + tx + ' ' + (y - 12 - li * line) + ' Tm'); page.push('(' + this.escape(txt) + ') Tj'); }); x += col.width; }
      page.push('0.863 0.886 0.922 RG'); page.push('0.4 w'); page.push('1 0 0 1 ' + margin + ' ' + (y - rowHeight + 2) + ' Tm'); page.push('0 0 ' + (pageWidth - margin * 2) + ' 0 l S'); y -= rowHeight;
    }
    this.addFooters(pages, pageWidth, pageHeight, margin); return pages;
  }

  private headerStream(title: string, subtitle: string, pageWidth: number, pageHeight: number, margin: number): string {
    const y = pageHeight - 76; const titleWidth = this.approxWidth(title, 14);
    return ['q','0.059 0.090 0.165 rg',this.rect(0, pageHeight - 86, pageWidth, 86) + ' f','0.231 0.510 0.965 rg',this.rect(0, pageHeight - 86, 7, 86) + ' f','1 1 1 rg',this.shield(margin, y - 1, 27) + ' f','0.231 0.510 0.965 rg','2.4 w',this.xMark(margin + 6, y - 8, 15) + ' S','1 1 1 rg','/F2 17 Tf','1 0 0 1 ' + (margin + 39) + ' ' + (y + 3) + ' Tm','(SecureX) Tj','0.70 0.76 0.84 rg','/F1 8 Tf','1 0 0 1 ' + (margin + 40) + ' ' + (y - 12) + ' Tm','(SECURE TRANSACTIONS. TRUSTED EXCHANGES.) Tj','1 1 1 rg','/F2 14 Tf','1 0 0 1 ' + (pageWidth - margin - titleWidth) + ' ' + (y + 1) + ' Tm','(' + this.escape(title) + ') Tj','0.70 0.76 0.84 rg','/F1 8 Tf','1 0 0 1 ' + (pageWidth - margin - this.approxWidth(subtitle, 8)) + ' ' + (y - 13) + ' Tm','(' + this.escape(subtitle) + ') Tj','Q'].join('\n');
  }

  private addFooters(pages: string[][], pageWidth: number, pageHeight: number, margin: number): void { pages.forEach((page, i) => { page.push('0.392 0.455 0.545 rg'); page.push('/F1 7 Tf'); page.push('1 0 0 1 ' + margin + ' 16 Tm'); page.push('(SecureX Admin Portal - Confidential operational report) Tj'); const p = 'Page ' + (i + 1) + ' of ' + pages.length; page.push('1 0 0 1 ' + (pageWidth - margin - this.approxWidth(p, 7)) + ' 16 Tm'); page.push('(' + p + ') Tj'); }); }

  private renderPages(pageStreams: string[][], pageWidth: number, pageHeight: number): string {
    const objects: string[] = []; const add = (body: string) => { objects.push(body); return objects.length; };
    const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const content = pageStreams.map(lines => { const stream = lines.join('\n'); return add('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream'); });
    const pagesId = add(''); const pageIds = content.map(id => add('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + pageWidth + ' ' + pageHeight + '] /Resources << /Font << /F1 ' + regular + ' 0 R /F2 ' + bold + ' 0 R >> >> /Contents ' + id + ' 0 R >>'));
    objects[pagesId - 1] = '<< /Type /Pages /Count ' + pageIds.length + ' /Kids [' + pageIds.map(id => id + ' 0 R').join(' ') + '] >>'; const catalog = add('<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>');
    let pdf = '%PDF-1.4\n'; const offsets: number[] = [0]; objects.forEach((obj, i) => { offsets[i + 1] = pdf.length; pdf += (i + 1) + ' 0 obj\n' + obj + '\nendobj\n'; });
    const xref = pdf.length; pdf += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n'; for (let i = 1; i <= objects.length; i++) pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    return pdf + 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + catalog + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  }

  private normalizeColumns(columns: PdfColumn[], width: number): PdfColumn[] { const total = columns.reduce((s, c) => s + c.width, 0); const factor = width / total; return columns.map(c => ({ ...c, width: c.width * factor })); }
  private wrap(value: string, width: number, size: number, maxLines: number): string[] { const clean = this.clean(value); const max = Math.max(6, Math.floor(width / (size * 0.48))); if (clean.length <= max) return [clean]; const words = clean.split(/\s+/); const lines: string[] = []; let current = ''; for (const word of words) { const next = current ? current + ' ' + word : word; if (next.length <= max) current = next; else { if (current) lines.push(current); current = word; if (lines.length === maxLines - 1) break; } } if (current && lines.length < maxLines) lines.push(current); const out = lines.slice(0, maxLines); if (clean.length > out.join(' ').length && out.length) out[out.length - 1] = out[out.length - 1].slice(0, Math.max(1, max - 3)) + '...'; return out; }
  private clean(value: string): string { return String(value || '').replace(/[^\x20-\x7E]/g, '?').replace(/[\r\n]+/g, ' '); }
  private escape(value: string): string { return this.clean(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  private metricColor(accent: PdfSummaryMetric['accent']): number[] { switch (accent) { case 'green': return [0.055, 0.600, 0.400]; case 'amber': return [0.850, 0.550, 0.100]; case 'red': return [0.800, 0.180, 0.180]; case 'slate': return this.slate; default: return this.blue; } }
  private rect(x: number, y: number, w: number, h: number): string { return x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re'; }
  private shield(x: number, y: number, size: number): string { const top = y + size; const mid = y + size * 0.66; return x + ' ' + top + ' m ' + (x + size / 2) + ' ' + (top + 5) + ' l ' + (x + size) + ' ' + top + ' l ' + (x + size) + ' ' + mid + ' c ' + (x + size) + ' ' + (y + size * 0.25) + ' ' + (x + size * 0.7) + ' ' + (y + 2) + ' ' + (x + size / 2) + ' ' + y + ' c ' + (x + size * 0.3) + ' ' + (y + 2) + ' ' + x + ' ' + (y + size * 0.25) + ' ' + x + ' ' + mid + ' l h'; }
  private xMark(x: number, y: number, size: number): string { return x + ' ' + y + ' m ' + (x + size) + ' ' + (y + size) + ' l ' + x + ' ' + (y + size) + ' m ' + (x + size) + ' ' + y + ' l'; }
  private approxWidth(value: string, size: number): number { return value.length * size * 0.48; }
  private savePdf(pdf: string, fileName: string): void { const blob = new Blob([pdf], { type: 'application/pdf' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}