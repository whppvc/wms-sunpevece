let dataRiwayat = [];

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_konversi', title: 'RIWAYAT KONVERSI', url: 'riwayat_konversi.html' });
    muatDataRiwayat();
});

// ========================================================
// 1. FETCH DATA DARI SUPABASE
// ========================================================
async function muatDataRiwayat() {
    const tbody = document.getElementById('tbody-riwayat');
    tbody.innerHTML = `<tr><td colspan="10" class="p-10"><i data-lucide="loader-2" class="animate-spin w-8 h-8 mx-auto mb-2 text-slate-500"></i><p class="font-bold text-slate-500 text-xs">Menarik histori dari laporan_konversi...</p></td></tr>`;
    lucide.createIcons();

    try {
        const { data, error } = await db.from('laporan_konversi')
                                        .select('*')
                                        .order('created_at', { ascending: false });
        if (error) throw error;

        dataRiwayat = data || [];
        renderTabel(dataRiwayat);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="10" class="p-10 text-red-500 font-bold text-xs uppercase">Gagal memuat data: ${error.message}</td></tr>`;
    }
}

function formatTanggal(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function parseDetail(detailString) {
    let res = { ket: detailString, po_target: '-', items: [], rangkuman: 'Format Lama (Tanpa Rincian)' };
    try {
        let parsed = JSON.parse(detailString);
        if (parsed && parsed.items) {
            res.ket = parsed.keterangan || '-';
            res.po_target = parsed.po_target || '-';
            res.items = parsed.items;
            
            let mapItem = {};
            parsed.items.forEach(d => {
                let namaLengkap = `${d.namaItem} ${d.panjang} ${d.grade} ${d.dus} ${d.shading}`;
                mapItem[namaLengkap] = (mapItem[namaLengkap] || 0) + 1;
            });
            let txt = [];
            for (let k in mapItem) txt.push(`<b>${k}</b> (${mapItem[k]} Dus)`);
            res.rangkuman = txt.join(', ');
        }
    } catch(e) {} 
    return res;
}

// ========================================================
// 2. RENDER TABEL UTAMA (Sesuai Urutan Header Baru)
// ========================================================
function renderTabel(data) {
    const tbody = document.getElementById('tbody-riwayat');
    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="p-10 text-slate-400 font-black uppercase text-xs">Belum ada data histori.</td></tr>`;
        return;
    }

    let html = '';
    data.forEach((r, i) => {
        const pd = parseDetail(r.detail);
        
        // Urutan: Checkbox | No | Waktu | Kode Konversi | Aktifitas | Keterangan | Detail Item | Total Dus | PIC | Detail (Button)
        html += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition">
                <td class="p-3"><input type="checkbox" class="cb-row cursor-pointer w-4 h-4 text-rose-600 rounded" data-id="${r.id}"></td>
                <td class="p-3 font-bold text-slate-400">${i + 1}</td>
                <td class="p-3 font-semibold text-slate-600 text-xs">${formatTanggal(r.created_at)}</td>
                <td class="p-3 font-black text-blue-700 bg-blue-50/50 text-[11px] border-x border-slate-200">${r.kode_konversi || '-'}</td>
                <td class="p-3 font-black text-rose-600 text-xs uppercase">${r.aktifitas || '-'}</td>
                
                <td class="p-3 font-semibold text-slate-600 text-left text-[11px] whitespace-normal min-w-[150px] leading-relaxed">${pd.ket}</td>
                <td class="p-3 font-semibold text-slate-600 text-left text-[11px] whitespace-normal min-w-[200px] leading-relaxed">${pd.rangkuman}</td>
                
                <td class="p-3 font-black text-emerald-800 bg-emerald-100 border-x border-slate-200 text-base">${r.qty_total || 0}</td>
                <td class="p-3 font-black text-slate-800 text-xs uppercase">${r.pic || '-'}</td>
                
                <td class="p-3 border-l border-slate-200">
                    <button onclick="bukaModalDetail('${r.id}')" class="p-1.5 px-3 bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white font-bold text-[10px] uppercase rounded shadow-sm transition flex mx-auto items-center justify-center gap-1">
                        <i data-lucide="table-2" class="w-3 h-3"></i> Detail
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    lucide.createIcons();
}

// ========================================================
// 3. POP UP DETAIL ITEM
// ========================================================
function bukaModalDetail(id) {
    const row = dataRiwayat.find(r => r.id == id);
    if (!row) return;

    const pd = parseDetail(row.detail);
    if (pd.items.length === 0) return alert("Data ini menggunakan format lama (Plain Text). Detail item spesifik tidak terekam di database.");

    document.getElementById('title-kode-detail').innerText = `[${row.kode_konversi}]`;
    const tbody = document.getElementById('tbody-modal-detail');
    let html = '';

    pd.items.forEach((d, i) => {
        html += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-xs">
                <td class="p-2 font-bold text-slate-400">${i + 1}</td>
                <td class="p-2 font-mono font-bold text-[10px] border-r border-slate-200">${d.qrcode}</td>
                <td class="p-2 font-bold">${d.tglProduksi || '-'}</td>
                <td class="p-2 font-bold">${d.mesin || '-'}</td>
                <td class="p-2 font-bold border-r border-slate-200">${d.shift || '-'}</td>
                <td class="p-2 font-bold text-left text-slate-800">${d.namaItem || '-'}</td>
                <td class="p-2 font-bold">${d.panjang || '-'}</td>
                <td class="p-2 font-bold">${d.grade || '-'}</td>
                <td class="p-2 font-bold">${d.dus || '-'}</td>
                <td class="p-2 font-bold border-r border-slate-200">${d.shading || '-'}</td>
                <td class="p-2 text-center font-bold text-slate-400">${d.poAsliDB || '-'}</td>
                <td class="p-2 text-center font-black text-orange-600 bg-orange-50 border-l border-slate-200">${pd.po_target}</td>
                <td class="p-2 font-semibold text-[10px] text-slate-600">${d.ket_baris || '-'}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    document.getElementById('modal-detail').classList.remove('hidden');
}

function tutupModalDetail() { 
    document.getElementById('modal-detail').classList.add('hidden'); 
}


// ========================================================
// 4. CHECKBOX & CANCEL KONVERSI (KEMBALIKAN KE KARTU STOK)
// ========================================================
function toggleCentangSemua(checked) {
    document.querySelectorAll('.cb-row').forEach(cb => cb.checked = checked);
}

function bukaModalCancel() {
    const cbs = document.querySelectorAll('.cb-row:checked');
    if (cbs.length === 0) return alert("Pilih minimal 1 baris konversi yang ingin dibatalkan (Cancel) dengan mencentang kotaknya.");
    document.getElementById('modal-cancel').classList.remove('hidden');
}

async function eksekusiCancelKonversi() {
    const cbs = document.querySelectorAll('.cb-row:checked');
    let idsToDelete = Array.from(cbs).map(cb => cb.getAttribute('data-id'));

    const btn = document.getElementById('btn-eksekusi-cancel');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Proses...';
    btn.disabled = true;

    try {
        // Kumpulkan semua item dari log yang di-cancel untuk dikembalikan
        let allPayloadFisik = [];
        let mapAktual = {};
        let mapGlobal = {};

        for (let id of idsToDelete) {
            const rowLog = dataRiwayat.find(r => r.id == id);
            if (rowLog) {
                const pd = parseDetail(rowLog.detail);
                
                // Jika data lama tidak punya rincian item, skip proses kartu stoknya (Hanya hapus log)
                if(pd.items.length === 0) continue;

                // Rekonstruksi Payload untuk Inbound (Langsir)
                pd.items.forEach(d => {
                    // ID SKU: [Area]_[Jenis]_[Nama]_[Panjang]_[Grade]_[Dus]_[Shading]_[PO_Asli]
                    // Perhatikan: Barang dikembalikan dengan poAsliDB-nya, bukan po_target konversi.
                    const sku = `${d.area}_${d.jenisItem}_${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${d.poAsliDB}`;
                    
                    allPayloadFisik.push({
                        qrcode: d.qrcode,
                        id_sku: sku,
                        area: d.area
                    });

                    // Agregasi Stok Aktual (Area, PO Target) - Kita kembalikan jatah PO yang terpotong saat konversi
                    let keyAkt = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${pd.po_target}_${d.ket_baris || '-'}`;
                    if(!mapAktual[keyAkt]) mapAktual[keyAkt] = { 
                        nama_item: d.namaItem, pjg: d.panjang, grade: d.grade, dus: d.dus, shading: d.shading, 
                        area: d.area, po_aktual: pd.po_target, ket: d.ket_baris || '-', qty: 0 
                    };
                    mapAktual[keyAkt].qty++;

                    // Agregasi Stok Global (PO Bawaan)
                    let keyGlb = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${pd.po_target}_${d.ket_baris || '-'}`;
                    if(!mapGlobal[keyGlb]) mapGlobal[keyGlb] = { 
                        nama_item: d.namaItem, pjg: d.panjang, grade: d.grade, dus: d.dus, shading: d.shading, 
                        po_bawaan: pd.po_target, ket: d.ket_baris || '-', qty: 0 
                    };
                    mapGlobal[keyGlb].qty++;
                });
            }
        }

        // Tembak RPC Langsir untuk mengembalikan stok (Jika ada item fisik yang valid)
        if (allPayloadFisik.length > 0) {
            const payloadData = { 
                fisiks: allPayloadFisik, 
                aktuals: Object.values(mapAktual), 
                globals: Object.values(mapGlobal) 
            };
            
            // Gunakan RPC eksekusi_langsir_aman (sama seperti proses barang masuk)
            const { error: rpcErr } = await db.rpc('eksekusi_langsir_aman', { payload: payloadData });
            if (rpcErr) throw rpcErr;
        }

        // Jika RPC sukses (Atau data lama tanpa fisik), Hapus log dari tabel laporan_konversi
        const { error: delErr } = await db.from('laporan_konversi').delete().in('id', idsToDelete);
        if (delErr) throw delErr;

        let msg = `✅ ${idsToDelete.length} Konversi dibatalkan.`;
        if(allPayloadFisik.length > 0) msg += `\n${allPayloadFisik.length} Fisik kardus telah dikembalikan ke Kartu Stok!`;
        
        alert(msg);
        document.getElementById('modal-cancel').classList.add('hidden');
        muatDataRiwayat(); // Reload Tabel
        
    } catch (e) {
        alert("Gagal membatalkan konversi. Terjadi rollback sistem.\nError: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false;
    }
}

// ========================================================
// 5. LOGIKA FILTER (Sidebar Slide)
// ========================================================
function toggleFilter() {
    const sidebar = document.getElementById('sidebar-filter');
    const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) {
        sidebar.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('translate-x-full');
        overlay.classList.add('hidden');
    }
}

function saringTabel() {
    const fKode = document.getElementById('f-kode').value.toLowerCase();
    const fAktifitas = document.getElementById('f-aktifitas').value.toLowerCase();
    const fPic = document.getElementById('f-pic').value.toLowerCase();
    const fQr = document.getElementById('f-qr').value.toLowerCase();

    const filtered = dataRiwayat.filter(r => {
        const matchKode = (r.kode_konversi || '').toLowerCase().includes(fKode);
        const matchAktifitas = (r.aktifitas || '').toLowerCase().includes(fAktifitas);
        const matchPic = (r.pic || '').toLowerCase().includes(fPic);
        const matchQr = (r.qrcode || '').toLowerCase().includes(fQr);
        return matchKode && matchAktifitas && matchPic && matchQr;
    });

    renderTabel(filtered);
}

function resetFilter() {
    document.getElementById('f-kode').value = '';
    document.getElementById('f-aktifitas').value = '';
    document.getElementById('f-pic').value = '';
    document.getElementById('f-qr').value = '';
    renderTabel(dataRiwayat);
}

// ========================================================
// 6. EKSPOR KE CLIPBOARD & EXCEL
// ========================================================
function salinData() {
    if(dataRiwayat.length === 0) return alert('Tidak ada data untuk disalin');
    
    let text = "Waktu\tKode Konversi\tAktifitas\tKeterangan\tDetail Item\tTotal Dus\tPIC\tQRCode Fisik\n";
    dataRiwayat.forEach(r => {
        const pd = parseDetail(r.detail);
        text += `${formatTanggal(r.created_at)}\t${r.kode_konversi || '-'}\t${r.aktifitas || '-'}\t${pd.ket}\t${pd.rangkuman}\t${r.qty_total || 0}\t${r.pic || '-'}\t${r.qrcode || '-'}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
        alert("Berhasil! Data telah disalin ke Clipboard. Silakan Paste (CTRL+V) di Notepad / Excel Anda.");
    }).catch(err => alert("Sistem browser gagal menyalin: " + err));
}

function downloadExcel() {
    if(dataRiwayat.length === 0) return alert('Tidak ada data untuk didownload');
    
    let csv = "Waktu,Kode Konversi,Aktifitas,Keterangan,Detail Item,Total Dus,PIC,QRCode Fisik\n";
    dataRiwayat.forEach(r => {
        const pd = parseDetail(r.detail);
        const safeKet = pd.ket.replace(/"/g, '""');
        const safeRangkuman = pd.rangkuman.replace(/<b>|<\/b>/g, '').replace(/"/g, '""'); // Buang tag HTML
        const safeQR = (r.qrcode || '-').replace(/"/g, '""');
        
        csv += `"${formatTanggal(r.created_at)}","${r.kode_konversi || '-'}","${r.aktifitas || '-'}","${safeKet}","${safeRangkuman}","${r.qty_total || 0}","${r.pic || '-'}","${safeQR}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "Audit_Konversi_" + new Date().toISOString().slice(0,10) + ".csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
