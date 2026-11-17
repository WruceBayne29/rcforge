/**
 * PDF calculation sheet: title block, drawings, the working in three columns and the bar
 * schedule — the same sheet as on screen, laid out for A4.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CellDef, RowInput } from 'jspdf-autotable';
import { fix, num, scheduleWeight } from '../is456';
import { describe } from '../model/project';
import type { Design, Project } from '../model/project';
import { MARK, VERDICT, provisions, schedule, scheduleNote } from '../ui/summary';

export interface Figure {
  /** PNG data URL. */
  dataUrl: string;
  width: number;
  height: number;
}

export interface ReportInput {
  project: Project;
  design: Design;
  figures?: Figure[];
  date?: Date;
}

type Rgb = [number, number, number];
const INK: Rgb = [43, 38, 32];
const SOFT: Rgb = [95, 86, 72];
const RULE: Rgb = [154, 141, 120];
const TINT: Rgb = [244, 239, 228];
const STATUS: Record<'ok' | 'warn' | 'fail', Rgb> = {
  ok: [85, 101, 42],
  warn: [169, 115, 15],
  fail: [164, 66, 27],
};

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14;

/**
 * The built-in PDF fonts cover Latin-1 only, so symbols used on screen are written out. The
 * result reads like a typed calculation: "tau_v <= tau_c", "3-20 dia".
 */
export function pdfText(text: string): string {
  const map: Record<string, string> = {
    φ: ' dia',
    τ: 'tau_',
    ε: 'eps_',
    α: 'alpha_',
    β: 'beta',
    γ: 'gamma',
    π: 'pi',
    '√': 'sqrt ',
    '≤': '<=',
    '≥': '>=',
    '−': '-',
    '–': '-',
    '—': '-',
    '′': "'",
    '⁻': '-',
    '⁺': '+',
    '⁶': '^6',
    '⁴': '^4',
    '✓': 'OK',
    '✗': 'X',
    '●': '',
    '○': '',
    '…': '...',
  };
  return text
    .replace(/[^\n\x20-\x7e\xa0-\xff]/g, (ch) => map[ch] ?? '?')
    .replace(/tau_ /g, 'tau ')
    .replace(/ {2,}/g, ' ');
}

/** Builds the calculation sheet and returns the jsPDF document. */
export function buildReport({
  project,
  design,
  figures = [],
  date = new Date(),
}: ReportInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const { sections, checks, status } = design.result;
  const width = PAGE_W - 2 * M;
  const paintPage = () => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  };
  paintPage();

  // ---- Title block ----
  const cols = [0, 0.27, 0.66, 0.86, 1].map((f) => M + f * width);
  const rowH = 11;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.35);
  doc.rect(M, M, width, 2 * rowH);
  doc.setLineWidth(0.2);
  doc.line(M, M + rowH, M + width, M + rowH);
  for (const x of cols.slice(1, 4)) doc.line(x, M, x, M + 2 * rowH);
  const cell = (col: number, rowIndex: number, label: string, value: string, heading = false) => {
    const x = cols[col] + 2;
    const y = M + rowIndex * rowH;
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...SOFT);
    doc.text(label.toUpperCase(), x, y + 3.4);
    doc.setTextColor(...INK);
    doc.setFont(heading ? 'times' : 'courier', heading ? 'bold' : 'normal');
    doc.setFontSize(heading ? 11.5 : 8.6);
    const max = cols[col + 1] - cols[col] - 4;
    const lines = doc.splitTextToSize(pdfText(value), max) as string[];
    doc.text(lines[0] ?? '', x, y + 8.2);
  };
  cell(0, 0, 'Calculation sheet', 'RCForge', true);
  cell(1, 0, 'Job', project.title, true);
  cell(2, 0, 'Code', 'IS 456 : 2000');
  cell(3, 0, 'Date', date.toISOString().slice(0, 10));
  cell(0, 1, 'Element', project.element);
  cell(1, 1, 'Description', describe(project));
  cell(2, 1, 'Prepared by', project.author || '-');
  cell(3, 1, 'Result', VERDICT[status]);
  let y = M + 2 * rowH + 5;

  // ---- Drawings on the left, verdict and provisions on the right ----
  const leftW = width * 0.5;
  let figureBottom = y;
  for (const figure of figures) {
    const w = Math.min(leftW - 4, 88);
    const h = (w * figure.height) / figure.width;
    if (figureBottom + h > PAGE_H - M - 30) break;
    doc.addImage(figure.dataUrl, 'PNG', M + 2, figureBottom, w, h);
    figureBottom += h + 3;
  }
  const rx = M + leftW + 4;
  doc.setDrawColor(...STATUS[status]);
  doc.setTextColor(...STATUS[status]);
  doc.setLineWidth(0.6);
  doc.rect(rx, y, 34, 9);
  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.text(VERDICT[status], rx + 17, y + 6.4, { align: 'center', charSpace: 1.2 });
  doc.setTextColor(...INK);
  autoTable(doc, {
    startY: y + 13,
    margin: { left: rx, right: M },
    tableWidth: width - leftW - 4,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.6,
      cellPadding: { top: 1.1, bottom: 1.1, left: 0, right: 0 },
      textColor: INK,
      lineColor: [216, 207, 190],
      lineWidth: { bottom: 0.15 },
    },
    columnStyles: { 1: { halign: 'right', font: 'courier' } },
    body: provisions(design).map(([label, value]) => [pdfText(label), pdfText(value)]),
  });
  const lastY = () =>
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  autoTable(doc, {
    startY: lastY() + 3,
    margin: { left: rx, right: M },
    tableWidth: width - leftW - 4,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      cellPadding: { top: 0.9, bottom: 0.9, left: 0, right: 1 },
      textColor: INK,
    },
    columnStyles: {
      0: { cellWidth: 7, font: 'courier', fontStyle: 'bold' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { font: 'courier', textColor: SOFT },
    },
    body: checks.map((c) => [pdfText(MARK[c.status]), c.name, pdfText(c.detail)]),
    didParseCell: (data) => {
      if (data.column.index === 0)
        data.cell.styles.textColor = STATUS[checks[data.row.index].status];
    },
  });
  y = Math.max(figureBottom, lastY()) + 5;

  // ---- The working ----
  const body: RowInput[] = [];
  const statuses: Array<'ok' | 'warn' | 'fail' | undefined> = [];
  sections.forEach((section, s) => {
    const heading: CellDef = {
      content: `${s + 1}  ${pdfText(section.title)}`,
      colSpan: 3,
      styles: {
        font: 'times',
        fontStyle: 'bold',
        fontSize: 10,
        cellPadding: { top: 3, bottom: 1.4, left: 2, right: 2 },
      },
    };
    body.push([heading]);
    statuses.push(undefined);
    for (const step of section.steps) {
      body.push([
        pdfText(step.ref ?? ''),
        pdfText([step.title, ...step.lines].join('\n')),
        pdfText(step.output ?? ''),
      ]);
      statuses.push(step.status);
    }
  });
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: M + 6 },
    head: [['REFERENCE', 'CALCULATIONS', 'OUTPUT']],
    body,
    willDrawPage: (data) => {
      if (data.pageNumber > 1) paintPage();
    },
    theme: 'grid',
    styles: {
      font: 'courier',
      fontSize: 7.4,
      cellPadding: 1.6,
      textColor: SOFT,
      lineColor: RULE,
      lineWidth: 0.12,
      overflow: 'linebreak',
    },
    headStyles: { fillColor: TINT, textColor: SOFT, fontStyle: 'normal', fontSize: 6.2 },
    columnStyles: { 0: { cellWidth: 27 }, 2: { cellWidth: 50, textColor: INK, fontStyle: 'bold' } },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const state = statuses[data.row.index];
      if (data.column.index === 2 && state) data.cell.styles.textColor = STATUS[state];
      if (data.cell.colSpan === 3) data.cell.styles.textColor = INK;
    },
  });

  // ---- Bar schedule ----
  const bars = schedule(design);
  autoTable(doc, {
    startY: lastY() + 5,
    margin: { left: M, right: M, bottom: M + 6 },
    head: [
      ['MARK', 'BAR SCHEDULE (INDICATIVE)', 'BAR', 'NO.', 'LENGTH, mm', 'TOTAL, m', 'WEIGHT, kg'],
    ],
    willDrawPage: (data) => {
      if (data.pageNumber > 1) paintPage();
    },
    body: [
      ...bars.map((r) => [
        r.mark,
        pdfText(r.description),
        `${r.diameter} dia`,
        String(r.count),
        String(r.length),
        fix(r.total, 1),
        fix(r.weight, 1),
      ]),
      ['', pdfText(scheduleNote(design)), '', '', '', '', num(scheduleWeight(bars))],
    ],
    theme: 'grid',
    styles: {
      font: 'courier',
      fontSize: 7.4,
      cellPadding: 1.5,
      textColor: INK,
      lineColor: RULE,
      lineWidth: 0.12,
    },
    headStyles: { fillColor: TINT, textColor: SOFT, fontStyle: 'normal', fontSize: 6.2 },
    columnStyles: {
      0: { cellWidth: 14 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
  });

  // ---- Footers ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...SOFT);
    doc.text(
      'Limit state design to IS 456 : 2000. A learning tool: have every design checked by a qualified engineer.',
      M,
      PAGE_H - 8,
    );
    doc.text(`Sheet ${p} of ${pages}`, PAGE_W - M, PAGE_H - 8, { align: 'right' });
  }
  return doc;
}

export function reportFileName(project: Project): string {
  const slug = project.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'rcforge'}-${project.element}.pdf`;
}
