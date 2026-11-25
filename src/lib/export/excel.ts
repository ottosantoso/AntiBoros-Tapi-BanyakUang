import type { LaporanModel } from './model';

const FMT_RP = '"Rp" #,##0';
const WARNA_MASUK = '10B981';
const WARNA_KELUAR = 'F43F5E';
const WARNA_PIE = ['2563EB', '10B981', 'F59E0B', 'F43F5E', '8B5CF6', '06B6D4', 'EC4899', '84CC16', '64748B', 'F97316'];

/** Posisi baris penting di sheet Ringkasan, dipakai juga oleh rujukan grafik. */
interface PosisiRingkasan {
  bulanAwal: number;
  bulanAkhir: number;
  kategoriAwal: number;
  kategoriAkhir: number;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Tanggal "YYYY-MM-DD" jadi Date lokal supaya tidak bergeser zona waktu. */
function tanggalKeDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export async function buatExcel(model: LaporanModel): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hepeng';
  wb.created = new Date();

  // Urutan sheet: Ringkasan, Transaksi, Transfer, Grafik.
  const ws = wb.addWorksheet('Ringkasan');
  const wsTx = wb.addWorksheet('Transaksi');
  const jumlahTx = model.rows.length;
  const akhirTx = jumlahTx + 1;
  wsTx.addTable({
    name: 'TabelTransaksi',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: [
      { name: 'Tanggal' },
      { name: 'Keterangan' },
      { name: 'Kategori' },
      { name: 'Dompet' },
      { name: 'Jenis' },
      { name: 'Pihak Luar' },
      { name: 'Masuk' },
      { name: 'Keluar' },
      { name: 'Saldo Setelah' },
    ],
    rows: model.rows.map((r) => [
      tanggalKeDate(r.tanggal),
      r.deskripsi,
      r.kategori,
      r.dompet,
      r.jenis,
      r.pihakLuar,
      r.masuk ?? undefined,
      r.keluar ?? undefined,
      r.saldoSetelah ?? undefined,
    ]),
  });
  wsTx.views = [{ state: 'frozen', ySplit: 1 }];
  wsTx.columns = [
    { width: 13 }, { width: 38 }, { width: 22 }, { width: 18 }, { width: 14 },
    { width: 18 }, { width: 16 }, { width: 16 }, { width: 18 },
  ];
  wsTx.getColumn(1).numFmt = 'dd/mm/yyyy';
  for (const col of [7, 8, 9]) wsTx.getColumn(col).numFmt = FMT_RP;

  // ---------- Sheet Ringkasan ----------
  ws.getCell('A1').value = model.judul;
  ws.getCell('A1').font = { bold: true, size: 16 };
  ws.getCell('A2').value = `Periode: ${model.periode}`;
  ws.getCell('A3').value = `Dibuat: ${model.dibuat}`;
  ws.getCell('A2').font = { color: { argb: 'FF475569' } };
  ws.getCell('A3').font = { color: { argb: 'FF475569' } };

  const judulSeksi = (baris: number, teks: string[]) => {
    teks.forEach((t, i) => {
      const cell = ws.getCell(baris, i + 1);
      cell.value = t;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    });
  };

  // Ringkasan utama. Pemasukan dan pengeluaran dihitung dari tabel Transaksi dengan SUMIFS,
  // jadi kalau tabel diedit, angkanya ikut berubah.
  judulSeksi(5, ['Ringkasan', 'Nilai']);
  const rumusMasuk = `SUMIFS(Transaksi!$G$2:$G$${akhirTx},Transaksi!$E$2:$E$${akhirTx},"Pemasukan")`;
  const rumusKeluar = `SUMIFS(Transaksi!$H$2:$H$${akhirTx},Transaksi!$E$2:$E$${akhirTx},"Pengeluaran")`;
  const ringkas: [string, unknown, string][] = [
    ['Total Pemasukan', { formula: rumusMasuk, result: model.totalPemasukan }, FMT_RP],
    ['Total Pengeluaran', { formula: rumusKeluar, result: model.totalPengeluaran }, FMT_RP],
    ['Saldo Bersih', { formula: 'B6-B7', result: model.sisaBersih }, FMT_RP],
    ['Total Transfer antar dompet', model.totalTransfer, FMT_RP],
    ['Jumlah transfer antar dompet', model.jumlahTransfer, '0'],
    ['Sisa Saldo Semua Dompet', model.sisaSaldoSemua, FMT_RP],
  ];
  ringkas.forEach(([label, nilai, fmt], i) => {
    const baris = 6 + i;
    ws.getCell(baris, 1).value = label;
    ws.getCell(baris, 2).value = nilai as never;
    ws.getCell(baris, 2).numFmt = fmt;
  });
  ws.getCell('A12').value = 'Pemasukan dan pengeluaran tidak termasuk koreksi saldo dan pindah saldo antar dompet.';
  ws.getCell('A12').font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

  // Tren bulanan
  let baris = 14;
  judulSeksi(baris, ['Bulan', 'Pemasukan', 'Pengeluaran']);
  const bulanAwal = baris + 1;
  model.bulanan.forEach((b, i) => {
    const r = bulanAwal + i;
    ws.getCell(r, 1).value = b.label;
    ws.getCell(r, 2).value = b.pemasukan;
    ws.getCell(r, 3).value = b.pengeluaran;
    ws.getCell(r, 2).numFmt = FMT_RP;
    ws.getCell(r, 3).numFmt = FMT_RP;
  });
  const bulanAkhir = bulanAwal + Math.max(model.bulanan.length, 1) - 1;
  baris = bulanAkhir + 2;

  // Pengeluaran per kategori
  judulSeksi(baris, ['Kategori Pengeluaran', 'Total', 'Persen']);
  const kategoriAwal = baris + 1;
  model.kategori.forEach((k, i) => {
    const r = kategoriAwal + i;
    ws.getCell(r, 1).value = k.nama;
    ws.getCell(r, 2).value = k.total;
    ws.getCell(r, 3).value = k.persen / 100;
    ws.getCell(r, 2).numFmt = FMT_RP;
    ws.getCell(r, 3).numFmt = '0.0%';
  });
  const kategoriAkhir = kategoriAwal + Math.max(model.kategori.length, 1) - 1;
  baris = kategoriAkhir + 2;

  // Status dompet
  judulSeksi(baris, ['Dompet Aktif', 'Saldo Sekarang']);
  model.dompet.forEach((d, i) => {
    const r = baris + 1 + i;
    ws.getCell(r, 1).value = d.nama;
    ws.getCell(r, 2).value = d.saldo;
    ws.getCell(r, 2).numFmt = FMT_RP;
  });
  ws.columns = [{ width: 34 }, { width: 20 }, { width: 18 }];

  const posisi: PosisiRingkasan = { bulanAwal, bulanAkhir, kategoriAwal, kategoriAkhir };

  // ---------- Sheet Transfer (hanya jika ada) ----------
  if (model.transfers.length > 0) {
    const wsTf = wb.addWorksheet('Transfer');
    wsTf.addTable({
      name: 'TabelTransfer',
      ref: 'A1',
      headerRow: true,
      style: { theme: 'TableStyleMedium4', showRowStripes: true },
      columns: [
        { name: 'Tanggal' }, { name: 'Dari Dompet' }, { name: 'Ke Dompet' },
        { name: 'Nominal' }, { name: 'Biaya Admin' }, { name: 'Catatan' },
      ],
      rows: model.transfers.map((t) => [tanggalKeDate(t.tanggal), t.dari, t.ke, t.nominal, t.biayaAdmin, t.catatan]),
    });
    wsTf.getColumn(1).numFmt = 'dd/mm/yyyy';
    wsTf.getColumn(4).numFmt = FMT_RP;
    wsTf.getColumn(5).numFmt = FMT_RP;
    wsTf.columns = [
      { width: 13 }, { width: 20 }, { width: 20 }, { width: 16 }, { width: 14 }, { width: 30 },
    ];
    wsTf.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // ---------- Sheet Grafik (grafik disisipkan setelah file dibuat) ----------
  const wsGrafik = wb.addWorksheet('Grafik');
  wsGrafik.getCell('A1').value = 'Grafik Laporan Keuangan';
  wsGrafik.getCell('A1').font = { bold: true, size: 14 };
  wsGrafik.getCell('A2').value = `Periode: ${model.periode}`;
  wsGrafik.getCell('A2').font = { color: { argb: 'FF475569' } };
  wsGrafik.columns = Array.from({ length: 12 }, () => ({ width: 12 }));
  wsGrafik.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // Grafik disisipkan setelah file dibuat, karena library tabel tidak mendukung chart. Sumber datanya sheet Ringkasan.
  const bufXlsx = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const grafik = await sisipkanGrafik(bufXlsx, model, posisi);
  return grafik;
}

/* ---------- Grafik: ditulis langsung ke paket .xlsx ---------- */

interface Seri {
  nama: string;
  warna: string;
  ref: string;
  nilai: number[];
  namaRef: string;
}

function strCache(nilai: string[]): string {
  return `<c:strCache><c:ptCount val="${nilai.length}"/>${nilai.map((v, i) => `<c:pt idx="${i}"><c:v>${escapeXml(v)}</c:v></c:pt>`).join('')}</c:strCache>`;
}

function numCache(nilai: number[]): string {
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${nilai.length}"/>${nilai.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numCache>`;
}

function judulChart(teks: string): string {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="id-ID" sz="1200" b="1"/><a:t>${escapeXml(teks)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`;
}

function chartBatang(judul: string, kategoriRef: string, kategori: string[], seri: Seri[]): string {
  const series = seri.map((s, i) => `
    <c:ser>
      <c:idx val="${i}"/><c:order val="${i}"/>
      <c:tx><c:strRef><c:f>${s.namaRef}</c:f>${strCache([s.nama])}</c:strRef></c:tx>
      <c:spPr><a:solidFill><a:srgbClr val="${s.warna}"/></a:solidFill></c:spPr>
      <c:invertIfNegative val="0"/>
      <c:cat><c:strRef><c:f>${kategoriRef}</c:f>${strCache(kategori)}</c:strRef></c:cat>
      <c:val><c:numRef><c:f>${s.ref}</c:f>${numCache(s.nilai)}</c:numRef></c:val>
    </c:ser>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<c:roundedCorners val="0"/>
<c:chart>
${judulChart(judul)}
<c:plotArea><c:layout/>
<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}
<c:gapWidth val="80"/><c:axId val="5001"/><c:axId val="5002"/></c:barChart>
<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/><c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>
<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="5001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>
</c:plotArea>
<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>
<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>
</c:chart>
</c:chartSpace>`;
}

function chartPie(judul: string, kategoriRef: string, kategori: string[], nilaiRef: string, nilai: number[]): string {
  const dPt = kategori.map((_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${WARNA_PIE[i % WARNA_PIE.length]}"/></a:solidFill></c:spPr></c:dPt>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<c:roundedCorners val="0"/>
<c:chart>
${judulChart(judul)}
<c:plotArea><c:layout/>
<c:pieChart><c:varyColors val="1"/>
<c:ser>
  <c:idx val="0"/><c:order val="0"/>
  <c:tx><c:v>Pengeluaran</c:v></c:tx>
  ${dPt}
  <c:dLbls><c:numFmt formatCode="0.0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls>
  <c:cat><c:strRef><c:f>${kategoriRef}</c:f>${strCache(kategori)}</c:strRef></c:cat>
  <c:val><c:numRef><c:f>${nilaiRef}</c:f>${numCache(nilai)}</c:numRef></c:val>
</c:ser>
<c:firstSliceAng val="0"/>
</c:pieChart>
</c:plotArea>
<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>
<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>
</c:chart>
</c:chartSpace>`;
}

function jangkar(kolomAwal: number, barisAwal: number, kolomAkhir: number, barisAkhir: number, id: number, rid: string, nama: string): string {
  return `<xdr:twoCellAnchor>
<xdr:from><xdr:col>${kolomAwal}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${barisAwal}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${kolomAkhir}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${barisAkhir}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:graphicFrame macro="">
<xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="${nama}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="${rid}"/></a:graphicData></a:graphic>
</xdr:graphicFrame>
<xdr:clientData/>
</xdr:twoCellAnchor>`;
}

/** Menyisipkan dua grafik (batang bulanan dan pie kategori) ke sheet "Grafik" dalam file .xlsx yang sudah jadi. */
async function sisipkanGrafik(buf: ArrayBuffer, model: LaporanModel, posisi: PosisiRingkasan): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buf);

  const wbXml = await zip.file('xl/workbook.xml')!.async('string');
  const wbRels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  const tagSheet = [...wbXml.matchAll(/<sheet\b[^>]*\/>/g)].map((m) => m[0]).find((t) => /name="Grafik"/.test(t));
  if (!tagSheet) throw new Error('Sheet Grafik tidak ditemukan.');
  const rid = tagSheet.match(/r:id="([^"]+)"/)?.[1];
  const relTag = [...wbRels.matchAll(/<Relationship\b[^>]*\/>/g)].map((m) => m[0]).find((t) => t.includes(`Id="${rid}"`));
  const target = relTag?.match(/Target="([^"]+)"/)?.[1];
  if (!target) throw new Error('Relasi sheet Grafik tidak ditemukan.');
  const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  const sheetName = sheetPath.split('/').pop() as string;
  const relsPath = `xl/worksheets/_rels/${sheetName}.rels`;

  const sheetXml = await zip.file(sheetPath)!.async('string');
  if (/<(legacyDrawing|tableParts|extLst)\b/.test(sheetXml)) throw new Error('Susunan sheet Grafik tidak didukung.');

  const kategori = model.kategori.length > 0 ? model.kategori.map((k) => k.nama) : ['Tanpa data'];
  const nilaiKategori = model.kategori.length > 0 ? model.kategori.map((k) => k.total) : [0];
  const bulanLabel = model.bulanan.length > 0 ? model.bulanan.map((b) => b.label) : ['Tanpa data'];

  const chartFiles: { nama: string; xml: string }[] = [];
  const anchors: string[] = [];
  const chartRels: string[] = [];

  if (model.bulanan.length > 0) {
    const bulanRef = `Ringkasan!$A$${posisi.bulanAwal}:$A$${posisi.bulanAkhir}`;
    const xml = chartBatang('Pemasukan vs Pengeluaran per Bulan', bulanRef, bulanLabel, [
      { nama: 'Pemasukan', warna: WARNA_MASUK, ref: `Ringkasan!$B$${posisi.bulanAwal}:$B$${posisi.bulanAkhir}`, nilai: model.bulanan.map((b) => b.pemasukan), namaRef: 'Ringkasan!$B$14' },
      { nama: 'Pengeluaran', warna: WARNA_KELUAR, ref: `Ringkasan!$C$${posisi.bulanAwal}:$C$${posisi.bulanAkhir}`, nilai: model.bulanan.map((b) => b.pengeluaran), namaRef: 'Ringkasan!$C$14' },
    ]);
    chartFiles.push({ nama: 'chart1.xml', xml });
    chartRels.push(`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>`);
    anchors.push(jangkar(0, 3, 9, 22, 2, 'rId1', 'Grafik Bulanan'));
  }

  if (model.kategori.length > 0) {
    const katRef = `Ringkasan!$A$${posisi.kategoriAwal}:$A$${posisi.kategoriAkhir}`;
    const nilaiRef = `Ringkasan!$B$${posisi.kategoriAwal}:$B$${posisi.kategoriAkhir}`;
    const xml = chartPie('Komposisi Pengeluaran per Kategori', katRef, kategori, nilaiRef, nilaiKategori);
    chartFiles.push({ nama: 'chart2.xml', xml });
    chartRels.push(`<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/>`);
    anchors.push(jangkar(0, 24, 9, 46, 3, 'rId2', 'Grafik Kategori'));
  }

  if (chartFiles.length === 0) return new Blob([buf], { type: XLSX_MIME });

  const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${anchors.join('\n')}
</xdr:wsDr>`;
  const drawingRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${chartRels.join('')}</Relationships>`;

  for (const c of chartFiles) zip.file(`xl/charts/${c.nama}`, c.xml, { createFolders: false });
  zip.file('xl/drawings/drawing1.xml', drawingXml, { createFolders: false });
  zip.file('xl/drawings/_rels/drawing1.xml.rels', drawingRels, { createFolders: false });

  // Hubungkan sheet Grafik ke drawing.
  let sheetBaru = sheetXml;
  if (!/xmlns:r="/.test(sheetBaru.slice(0, 1000))) {
    sheetBaru = sheetBaru.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
  }
  sheetBaru = sheetBaru.replace('</worksheet>', '<drawing r:id="rIdDrawing1"/></worksheet>');
  zip.file(sheetPath, sheetBaru, { createFolders: false });

  const existingRels = zip.file(relsPath) ? await zip.file(relsPath)!.async('string') : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const relsBaru = existingRels.replace('</Relationships>', '<Relationship Id="rIdDrawing1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
  zip.file(relsPath, relsBaru, { createFolders: false });

  // Daftarkan tipe konten baru.
  const ct = await zip.file('[Content_Types].xml')!.async('string');
  const overrides = [
    '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>',
    ...chartFiles.map((c) => `<Override PartName="/xl/charts/${c.nama}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`),
  ].join('');
  zip.file('[Content_Types].xml', ct.replace('</Types>', `${overrides}</Types>`), { createFolders: false });

  return zip.generateAsync({ type: 'blob', mimeType: XLSX_MIME, compression: 'DEFLATE' });
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
