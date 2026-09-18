import { Injectable } from '@angular/core';

export interface PdfColumn {
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

export interface PdfTableOptions {
  landscape?: boolean;
  subtitle?: string;
}

export interface PdfSummaryMetric {
  label: string;
  value: string;
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'slate';
}

@Injectable({ providedIn: 'root' })
export class AdminPdfService {
  private readonly navy = [0.059, 0.090, 0.165];
  private readonly blue = [0.231, 0.510, 0.965];
  private readonly slate = [0.392, 0.455, 0.545];
  private readonly border = [0.863, 0.886, 0.922];
  private readonly light = [0.973, 0.980, 0.988];

  download(title: string, rows: Array<{ label: string; value: string }>, fileName: string): void {
    const columns: PdfColumn[] = [
      { label: 'Field', width: 220 },
      { label: 'Value', width: 500 },
    ];
    const tableRows = rows.map(row => [String(row.label ?? ''), String(row.value ?? '')]);
    this.downloadTable(title, columns, tableRows, fileName, {
      landscape: true,
      subtitle: 'SecureX Operations',
    });
  }

  downloadTable(
    title: string,
    columns: PdfColumn[],
    rows: string[][],
    fileName: string,
    options: PdfTableOptions = {},
  ): void {
    const landscape = options.landscape !== false;
    const pageWidth = landscape ? 842 : 595;
    const pageHeight = landscape ? 595 : 842;
    const margin = 30;
    const normalized = this.normalizeColumns(columns, pageWidth - margin * 2);
    const pages = this.buildTablePages(
      title,
      options.subtitle || 'SecureX Operations',
      normalized,
      rows,
      pageWidth,
      pageHeight,
      margin,
    );

    this.savePdf(this.renderPages(pages, pageWidth, pageHeight), fileName);
  }

  downloadSummary(
    title: string,
    metrics: PdfSummaryMetric[],
    sections: Array<{ title: string; rows: Array<[string, string]> }>,
    fileName: string,
  ): void {
    const pageWidth = 842;
    const pageHeight = 595;
    const margin = 32;
    const pages: string[][] = [[]];
    const add = (line: string) => pages[pages.length - 1].push(line);

    add(this.headerStream(title, 'SecureX Operations', pageWidth, pageHeight, margin));
    let y = pageHeight - 120;

    add('0.392 0.455 0.545 rg');
    add('/F1 8 Tf');
    add(`1 0 0 1 ${margin} ${y} Tm`);
    add(`(Operational snapshot  |  Generated ${this.generatedAt()}) Tj`);

    const gap = 10;
    const cards = Math.min(metrics.length, 5);
    const cardWidth = (pageWidth - margin * 2 - gap * (cards - 1)) / Math.max(cards, 1);
    const cardY = y - 76;

    for (let i = 0; i < cards; i++) {
      const x = margin + i * (cardWidth + gap);
      const metric = metrics[i];
      const rgb = this.metricColor(metric.accent);

      add('1 1 1 rg');
      add(this.roundedRect(x, cardY, cardWidth, 62, 7) + ' f');
      add(rgb.join(' ') + ' rg');
      add(this.rect(x, cardY, 4, 62) + ' f');
      add('0.059 0.090 0.165 rg');
      add('/F2 8 Tf');
      add(`1 0 0 1 ${x + 12} ${cardY + 40} Tm`);
      add(`(${this.escape(metric.label.toUpperCase())}) Tj`);
      add('/F2 15 Tf');
      add(`1 0 0 1 ${x + 12} ${cardY + 18} Tm`);
      add(`(${this.escape(metric.value)}) Tj`);
      add('0.863 0.886 0.922 RG');
      add('0.7 w');
      add(this.rect(x, cardY, cardWidth, 62) + ' S');
    }

    y = cardY - 28;

    for (const section of sections) {
      if (y < 78) {
        pages.push([]);
        y = pageHeight - 112;
      }

      add('0.059 0.090 0.165 rg');
      add('/F2 11 Tf');
      add(`1 0 0 1 ${margin} ${y} Tm`);
      add(`(${this.escape(section.title)}) Tj`);
      y -= 20;

      for (const pair of section.rows) {
        if (y < 58) {
          pages.push([]);
          y = pageHeight - 112;
        }

        add('0.973 0.980 0.988 rg');
        add(this.rect(margin, y - 7, pageWidth - margin * 2, 21) + ' f');
        add('0.392 0.455 0.545 rg');
        add('/F1 8 Tf');
        add(`1 0 0 1 ${margin + 8} ${y} Tm`);
        add(`(${this.escape(pair[0])}) Tj`);

        add('0.059 0.090 0.165 rg');
        add('/F2 8 Tf');
        add(`1 0 0 1 ${margin + 185} ${y} Tm`);
        add(`(${this.escape(pair[1])}) Tj`);
        y -= 24;
      }

      y -= 7;
    }

    this.addFooters(pages, pageWidth, pageHeight, margin);
    this.savePdf(this.renderPages(pages, pageWidth, pageHeight), fileName);
  }

  private buildTablePages(
    title: string,
    subtitle: string,
    columns: PdfColumn[],
    rows: string[][],
    pageWidth: number,
    pageHeight: number,
    margin: number,
  ): string[][] {
    const pages: string[][] = [[]];
    const headerHeight = 104;
    const footer = 30;
    const tableHeader = 30;
    const bottom = footer + margin;
    const line = 10;
    const pad = 7;

    const start = () => {
      if (pages[pages.length - 1].length) {
        pages.push([]);
      }

      const page = pages[pages.length - 1];
      page.push(this.headerStream(title, subtitle, pageWidth, pageHeight, margin));

      const headerY = pageHeight - headerHeight - 4;
      page.push('0.945 0.961 0.980 rg');
      page.push(this.rect(margin, headerY - tableHeader, pageWidth - margin * 2, tableHeader) + ' f');

      let x = margin;
      for (const col of columns) {
        page.push('0.059 0.090 0.165 rg');
        page.push('/F2 7.5 Tf');
        page.push(`1 0 0 1 ${x + pad} ${headerY - 20} Tm`);
        page.push(`(${this.escape(col.label.toUpperCase())}) Tj`);
        x += col.width;
      }

      page.push('0.863 0.886 0.922 RG');
      page.push('0.6 w');
      page.push(
        `${margin} ${headerY - tableHeader} m ${pageWidth - margin} ${headerY - tableHeader} l S`,
      );
    };

    start();

    let y = pageHeight - headerHeight - tableHeader - 8;

    if (!rows.length) {
      rows = [['No records available for this report.']];
    }

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const wrapped = columns.map((column, i) =>
        this.wrap(row[i] || '', column.width - pad * 2, 8, 4),
      );
      const rowLines = Math.max(...wrapped.map(value => value.length));
      const rowHeight = Math.max(25, rowLines * line + 11);

      if (y - rowHeight < bottom) {
        start();
        y = pageHeight - headerHeight - tableHeader - 8;
      }

      const page = pages[pages.length - 1];
      page.push(rowIndex % 2 === 0 ? '0.988 0.991 0.995 rg' : '1 1 1 rg');
      page.push(this.rect(margin, y - rowHeight + 2, pageWidth - margin * 2, rowHeight) + ' f');

      let x = margin;

      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        const lines = wrapped[i];

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const text = lines[lineIndex];
          const fontSize = 8;
          const width = this.approxWidth(text, fontSize);
          const tx =
            column.align === 'right'
              ? x + column.width - pad - width
              : column.align === 'center'
                ? x + (column.width - width) / 2
                : x + pad;

          const status = this.statusColor(text);
          page.push((status || this.navy).join(' ') + ' rg');
          page.push('/F1 8 Tf');
          page.push(`1 0 0 1 ${tx} ${y - 13 - lineIndex * line} Tm`);
          page.push(`(${this.escape(text)}) Tj`);
        }

        x += column.width;
      }

      page.push('0.900 0.918 0.945 RG');
      page.push('0.35 w');
      page.push(
        `${margin} ${y - rowHeight + 2} m ${pageWidth - margin} ${y - rowHeight + 2} l S`,
      );

      y -= rowHeight;
    }

    this.addFooters(pages, pageWidth, pageHeight, margin);
    return pages;
  }

  private headerStream(
    title: string,
    subtitle: string,
    pageWidth: number,
    pageHeight: number,
    margin: number,
  ): string {
    const y = pageHeight - 60;
    const titleWidth = this.approxWidth(title, 14);
    const generated = this.generatedAt();

    return [
      'q',
      '0.059 0.090 0.165 rg',
      this.rect(0, pageHeight - 88, pageWidth, 88) + ' f',
      '0.231 0.510 0.965 rg',
      this.rect(0, pageHeight - 88, 6, 88) + ' f',
      '1 1 1 rg',
      this.shield(margin, y - 12, 26) + ' f',
      '0.231 0.510 0.965 rg',
      '2.2 w',
      this.xMark(margin + 6, y - 19, 14) + ' S',
      '1 1 1 rg',
      '/F2 17 Tf',
      `1 0 0 1 ${margin + 38} ${y + 3} Tm`,
      '(SecureX) Tj',
      '0.70 0.76 0.84 rg',
      '/F1 7.5 Tf',
      `1 0 0 1 ${margin + 39} ${y - 12} Tm`,
      '(SECURE TRANSACTIONS. TRUSTED EXCHANGES.) Tj',
      '1 1 1 rg',
      '/F2 14 Tf',
      `1 0 0 1 ${pageWidth - margin - titleWidth} ${y + 1} Tm`,
      `(${this.escape(title)}) Tj`,
      '0.70 0.76 0.84 rg',
      '/F1 8 Tf',
      `1 0 0 1 ${pageWidth - margin - this.approxWidth(subtitle, 8)} ${y - 13} Tm`,
      `(${this.escape(subtitle)}) Tj`,
      '0.70 0.76 0.84 rg',
      '/F1 7 Tf',
      `1 0 0 1 ${pageWidth - margin - this.approxWidth('Generated ' + generated, 7)} ${y - 26} Tm`,
      `(Generated ${this.escape(generated)}) Tj`,
      'Q',
    ].join('\n');
  }

  private addFooters(
    pages: string[][],
    pageWidth: number,
    pageHeight: number,
    margin: number,
  ): void {
    pages.forEach((page, index) => {
      page.push('0.392 0.455 0.545 rg');
      page.push('/F1 7 Tf');
      page.push(`1 0 0 1 ${margin} 16 Tm`);
      page.push('(SecureX Operations  |  Confidential operational report) Tj');

      const pageLabel = `Page ${index + 1} of ${pages.length}`;
      page.push(
        `1 0 0 1 ${pageWidth - margin - this.approxWidth(pageLabel, 7)} 16 Tm`,
      );
      page.push(`(${pageLabel}) Tj`);
    });
  }

  private renderPages(pageStreams: string[][], pageWidth: number, pageHeight: number): string {
    const objects: string[] = [];
    const add = (body: string) => {
      objects.push(body);
      return objects.length;
    };

    const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    const content = pageStreams.map(lines => {
      const stream = lines.join('\n');
      return add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });

    const pagesId = add('');
    const pageIds = content.map(id =>
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${id} 0 R >>`,
      ),
    );

    objects[pagesId - 1] =
      `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => id + ' 0 R').join(' ')}] >>`;

    const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];

    objects.forEach((object, index) => {
      offsets[index + 1] = pdf.length;
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

    for (let i = 1; i <= objects.length; i++) {
      pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }

    return (
      pdf +
      `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`
    );
  }

  private normalizeColumns(columns: PdfColumn[], width: number): PdfColumn[] {
    const total = columns.reduce((sum, column) => sum + column.width, 0);
    const factor = total > 0 ? width / total : 1;
    return columns.map(column => ({ ...column, width: column.width * factor }));
  }

  private wrap(value: string, width: number, size: number, maxLines: number): string[] {
    const clean = this.clean(value);
    const max = Math.max(6, Math.floor(width / (size * 0.48)));

    if (clean.length <= max) return [clean];

    const words = clean.split(/\s+/);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      if (word.length > max) {
        if (current) {
          lines.push(current);
          current = '';
        }

        for (let i = 0; i < word.length && lines.length < maxLines; i += max) {
          lines.push(word.slice(i, i + max));
        }
        continue;
      }

      const next = current ? current + ' ' + word : word;

      if (next.length <= max) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }

      if (lines.length >= maxLines) break;
    }

    if (current && lines.length < maxLines) lines.push(current);

    const out = lines.slice(0, maxLines);
    const renderedLength = out.join(' ').length;

    if (clean.length > renderedLength && out.length) {
      const last = out.length - 1;
      out[last] = out[last].slice(0, Math.max(1, max - 3)) + '...';
    }

    return out.length ? out : [''];
  }

  private statusColor(value: string): number[] | null {
    const normalized = value.trim().toLowerCase();

    if (['resolved', 'ok', 'complete', 'completed', 'approved', 'success', 'available', 'yes', 'active'].includes(normalized)) {
      return [0.035, 0.470, 0.310];
    }

    if (['open', 'pending', 'missing', 'alert', 'failed', 'failure', 'no'].includes(normalized)) {
      return [0.760, 0.150, 0.150];
    }

    if (['processing', 'review', 'in progress'].includes(normalized)) {
      return [0.720, 0.430, 0.040];
    }

    return null;
  }

  private metricColor(accent: PdfSummaryMetric['accent']): number[] {
    switch (accent) {
      case 'green': return [0.055, 0.600, 0.400];
      case 'amber': return [0.850, 0.550, 0.100];
      case 'red': return [0.800, 0.180, 0.180];
      case 'slate': return this.slate;
      default: return this.blue;
    }
  }

  private generatedAt(): string {
    return new Intl.DateTimeFormat('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Johannesburg',
      hour12: false,
    }).format(new Date());
  }

  private rect(x: number, y: number, width: number, height: number): string {
    return `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`;
  }

  private roundedRect(x: number, y: number, width: number, height: number, radius: number): string {
    const k = 0.5522848;
    const r = Math.min(radius, width / 2, height / 2);
    return [
      `${x + r} ${y} m`,
      `${x + width - r} ${y} l`,
      `${x + width - r + k * r} ${y} ${x + width} ${y + r - k * r} ${x + width} ${y + r} c`,
      `${x + width} ${y + height - r} l`,
      `${x + width} ${y + height - r + k * r} ${x + width - r + k * r} ${y + height} ${x + width - r} ${y + height} c`,
      `${x + r} ${y + height} l`,
      `${x + r - k * r} ${y + height} ${x} ${y + height - r + k * r} ${x} ${y + height - r} c`,
      `${x} ${y + r} l`,
      `${x} ${y + r - k * r} ${x + r - k * r} ${y} ${x + r} ${y} c`,
      'h',
    ].join(' ');
  }

  private shield(x: number, y: number, size: number): string {
    const top = y + size;
    const mid = y + size * 0.66;
    return (
      `${x} ${top} m ${x + size / 2} ${top + 5} l ${x + size} ${top} l ${x + size} ${mid} c ` +
      `${x + size} ${y + size * 0.25} ${x + size * 0.7} ${y + 2} ${x + size / 2} ${y} c ` +
      `${x + size * 0.3} ${y + 2} ${x} ${y + size * 0.25} ${x} ${mid} l h`
    );
  }

  private xMark(x: number, y: number, size: number): string {
    return `${x} ${y} m ${x + size} ${y + size} l ${x} ${y + size} m ${x + size} ${y} l`;
  }

  private approxWidth(value: string, size: number): number {
    return value.length * size * 0.48;
  }

  private clean(value: string): string {
    return String(value || '')
      .replace(/[^\\x20-\\x7E]/g, '?')
      .replace(/[\\r\\n]+/g, ' ');
  }

  private escape(value: string): string {
    return this.clean(value)
      .replace(/\\/g, '\\\\')
      .replace(/\\(/g, '\\\\(')
      .replace(/\\)/g, '\\\\)');
  }

  private savePdf(pdf: string, fileName: string): void {
    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
