import type { LaporanModel } from './model';
import { rupiah } from './download';

const W = 210;
const H = 297;
const M = 14;
const BIRU: [number, number, number] = [37, 99, 235];
const HIJAU: [number, number, number] = [16, 185, 129];
const MERAH: [number, number, number] = [244, 63, 94];
const ABU: [number, number, number] = [100, 116, 139];
const TEKS: [number, number, number] = [23, 37, 84];
const PALET_KATEGORI: [number, number, number][] = [
  [37, 99, 235], [16, 185, 129], [245, 158, 11], [244, 63, 94],
  [139, 92, 246], [6, 182, 212], [236, 72, 153], [132, 204, 22],
];

/** Posisi Y di bawah tabel terakhir yang digambar autoTable. */
function akhirTabel(doc: unknown, fallback: number): number {
  const tabel = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return tabel?.finalY ?? fallback;
}

function tglIndo(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export async function buatPdf(model: LaporanModel): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M;

  const pastikanRuang = (tinggi: number) => {
    if (y + tinggi > H - 16) {
      doc.addPage();
      y = M;
    }
  };

  /* ---------- Judul ---------- */
  doc.setFillColor(...BIRU);
  doc.rect(0, 0, W, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(model.judul, M, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Periode: ${model.periode}`, M, 21);
  doc.text(`Dibuat: ${model.dibuat}`, M, 26);
  y = 40;

  /* ---------- Kartu ringkasan (2 x 2) ---------- */
  const kartu: { label: string; nilai: number; warna: [number, number, number] }[] = [
    { label: 'Total Pemasukan', nilai: model.totalPemasukan, warna: HIJAU },
    { label: 'Total Pengeluaran', nilai: model.totalPengeluaran, warna: MERAH },
    { label: 'Saldo Bersih', nilai: model.sisaBersih, warna: BIRU },
    { label: 'Sisa Saldo Semua Dompet', nilai: model.sisaSaldoSemua, warna: BIRU },
  ];
  const lebarKartu = (W - 2 * M - 6) / 2;
  kartu.forEach((k, i) => {
    const kx = M + (i % 2) * (lebarKartu + 6);
    const ky = y + Math.floor(i / 2) * 22;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(kx, ky, lebarKartu, 18, 2, 2, 'FD');
    doc.setFillColor(...k.warna);
    doc.rect(kx, ky + 2, 1.6, 14, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...ABU);
    doc.text(k.label, kx + 5, ky + 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...TEKS);
    doc.text(rupiah(k.nilai), kx + 5, ky + 14);
  });
  y += 46;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...ABU);
  doc.text(
    `Transfer antar dompet: ${rupiah(model.totalTransfer)} (${model.jumlahTransfer} transfer). Tidak dihitung sebagai pemasukan atau pengeluaran. Koreksi saldo juga tidak dihitung.`,
    M,
    y,
    { maxWidth: W - 2 * M },
  );
  y += 8;

  /* ---------- Grafik batang: pemasukan vs pengeluaran per bulan ---------- */
  if (model.bulanan.length > 0) {
    pastikanRuang(78);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...TEKS);
    doc.text('Pemasukan vs Pengeluaran per Bulan', M, y);
    y += 5;

    const area = { x: M + 14, y: y + 4, w: W - 2 * M - 16, h: 50 };
    const maks = Math.max(1, ...model.bulanan.flatMap((b) => [b.pemasukan, b.pengeluaran]));
    const skalaMaks = Math.ceil(maks / 500_000) * 500_000 || 500_000;
    doc.setDrawColor(226, 232, 240);
    doc.setFontSize(7);
    doc.setTextColor(...ABU);
    for (let g = 0; g <= 4; g++) {
      const gy = area.y + area.h - (area.h * g) / 4;
      doc.line(area.x, gy, area.x + area.w, gy);
      doc.text(Math.round((skalaMaks * g) / 4 / 1000).toLocaleString('id-ID') + ' rb', M, gy + 1);
    }
    const slot = area.w / model.bulanan.length;
    const lebarBatang = Math.min(9, slot * 0.32);
    model.bulanan.forEach((b, i) => {
      const cx = area.x + slot * i + slot / 2;
      const tinggiM = (b.pemasukan / skalaMaks) * area.h;
      const tinggiK = (b.pengeluaran / skalaMaks) * area.h;
      doc.setFillColor(...HIJAU);
      if (tinggiM > 0) doc.rect(cx - lebarBatang - 0.5, area.y + area.h - tinggiM, lebarBatang, tinggiM, 'F');
      doc.setFillColor(...MERAH);
      if (tinggiK > 0) doc.rect(cx + 0.5, area.y + area.h - tinggiK, lebarBatang, tinggiK, 'F');
      doc.setTextColor(...ABU);
      doc.text(b.label, cx, area.y + area.h + 4, { align: 'center' });
    });
    // Legenda
    doc.setFillColor(...HIJAU);
    doc.rect(M + 14, area.y + area.h + 8, 3, 3, 'F');
    doc.setFillColor(...MERAH);
    doc.rect(M + 40, area.y + area.h + 8, 3, 3, 'F');
    doc.setTextColor(...TEKS);
    doc.setFontSize(8);
    doc.text('Pemasukan', M + 18, area.y + area.h + 10.5);
    doc.text('Pengeluaran', M + 44, area.y + area.h + 10.5);
    y = area.y + area.h + 22;
  }

  /* ---------- Grafik horizontal: pengeluaran per kategori ---------- */
  if (model.kategori.length > 0) {
    const top = model.kategori.slice(0, 8);
    pastikanRuang(12 + top.length * 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...TEKS);
    doc.text('Pengeluaran per Kategori', M, y);
    y += 5;
    const maksKat = Math.max(...top.map((k) => k.total));
    const xNama = M;
    const xBatang = M + 50;
    const lebarMaks = W - 2 * M - 50 - 38;
    top.forEach((k, i) => {
      const ry = y + i * 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...TEKS);
      doc.text(k.nama.length > 28 ? `${k.nama.slice(0, 27)}…` : k.nama, xNama, ry + 3.5);
      const [r, g, b] = PALET_KATEGORI[i % PALET_KATEGORI.length];
      doc.setFillColor(r, g, b);
      doc.rect(xBatang, ry, Math.max(1, (k.total / maksKat) * lebarMaks), 4.5, 'F');
      doc.setTextColor(...ABU);
      doc.text(`${rupiah(k.total)} (${k.persen.toFixed(1)}%)`, xBatang + lebarMaks + 3, ry + 3.5);
    });
    y += top.length * 7 + 8;
  }

  /* ---------- Tabel dompet ---------- */
  pastikanRuang(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TEKS);
  doc.text('Dompet Aktif', M, y);
  autoTable(doc, {
    startY: y + 3,
    margin: { left: M, right: M },
    head: [['Dompet', 'Saldo Sekarang']],
    body: model.dompet.map((d) => [d.nama, rupiah(d.saldo)]),
    foot: [['Total', rupiah(model.sisaSaldoSemua)]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: BIRU, textColor: 255 },
    footStyles: { fillColor: [241, 245, 249], textColor: TEKS, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
  });
  y = akhirTabel(doc, y) + 10;

  /* ---------- Tabel transfer antar dompet ---------- */
  if (model.transfers.length > 0) {
    pastikanRuang(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...TEKS);
    doc.text('Transfer antar Dompet', M, y);
    autoTable(doc, {
      startY: y + 3,
      margin: { left: M, right: M },
      head: [['Tanggal', 'Dari', 'Ke', 'Nominal', 'Biaya Admin', 'Catatan']],
      body: model.transfers.map((t) => [tglIndo(t.tanggal), t.dari, t.ke, rupiah(t.nominal), rupiah(t.biayaAdmin), t.catatan]),
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [124, 58, 237], textColor: 255 },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    y = akhirTabel(doc, y) + 10;
  }

  /* ---------- Tabel transaksi lengkap ---------- */
  pastikanRuang(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TEKS);
  doc.text('Rincian Transaksi', M, y);
  autoTable(doc, {
    startY: y + 3,
    margin: { left: M, right: M },
    head: [['Tanggal', 'Keterangan', 'Kategori', 'Dompet', 'Jenis', 'Masuk', 'Keluar', 'Saldo']],
    body: model.rows.map((r) => [
      tglIndo(r.tanggal),
      r.pihakLuar ? `${r.deskripsi} (${r.pihakLuar})` : r.deskripsi,
      r.kategori,
      r.dompet,
      r.jenis,
      r.masuk !== null ? rupiah(r.masuk) : '',
      r.keluar !== null ? rupiah(r.keluar) : '',
      r.saldoSetelah !== null ? rupiah(r.saldoSetelah) : '',
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.6, overflow: 'linebreak' },
    headStyles: { fillColor: BIRU, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 249, 255] },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 38 },
      2: { cellWidth: 26 },
      3: { cellWidth: 20 },
      4: { cellWidth: 21 },
      5: { cellWidth: 19, halign: 'right' },
      6: { cellWidth: 19, halign: 'right' },
      7: { cellWidth: 21, halign: 'right' },
    },
  });

  /* ---------- Nomor halaman ---------- */
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...ABU);
    doc.text('Laporan Keuangan — Hepeng', M, H - 8);
    doc.text(`Halaman ${i} dari ${total}`, W - M, H - 8, { align: 'right' });
  }

  return doc.output('blob');
}
