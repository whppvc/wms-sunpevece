let dataRiwayat = [];
const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

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
        const { data, error } = await db.from('laporan_konversi').select('*').order('created_at', { ascending: false });
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
// 2. RENDER TABEL UTAMA
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
        
        html += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-[11px]">
                <td class="p-3"><input type="checkbox" class="cb-row cursor-pointer w-4 h-4 text-rose-600 rounded" data-id="${r.id}"></td>
                <td class="p-3 font-bold text-slate-500">${i + 1}</td>
                <td class="p-3 font-semibold text-slate-600">${formatTanggal(r.created_at)}</td>
                <td class="p-3 font-black text-blue-700 bg-blue-50/50 border-x border-slate-200">${r.kode_konversi || '-'}</td>
                <td class="p-3 font-black text-rose-600 uppercase">${r.aktifitas || '-'}</td>
                
                <td class="p-3 font-semibold text-slate-600 text-left whitespace-normal min-w-[150px] leading-relaxed">${pd.ket}</td>
                <td class="p-3 font-semibold text-slate-600 text-left whitespace-normal min-w-[200px] leading-relaxed">${pd.rangkuman}</td>
                
                <td class="p-3 font-black text-emerald-800 bg-emerald-100 border-x border-slate-200 text-sm">${r.qty_total || 0}</td>
                <td class="p-3 font-black text-slate-800 uppercase">${r.pic || '-'}</td>
                
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
                <td class="p-2 font-semibold text-[10px] text-slate-600">-</td>
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
// 4. CHECKBOX & CANCEL KONVERSI OUT (KEMBALIKAN KE KARTU STOK)
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
        // 1. Ambil data log untuk mendapatkan kode_konversi dan tipe aktifitasnya
        const { data: logs, error: errLogs } = await db.from('laporan_konversi').select('kode_konversi, aktifitas').in('id', idsToDelete);
        if (errLogs) throw errLogs;

        const kodeList = logs.map(l => l.kode_konversi);

        // 2. Tarik fisik asli dari stok_konversi
        const { data: dataKonversi, error: errTarik } = await db.from('stok_konversi').select('*').in('kode_konversi', kodeList);
        if (errTarik) throw errTarik;

        let arrRestoreFisik = [];
        let mapRestoreAktual = {};
        let mapRestoreGlobal = {};

        dataKonversi.forEach(d => {
            const logInduk = logs.find(l => l.kode_konversi === d.kode_konversi);
            
            // SAAT INI KITA FOKUS PADA CANCEL KONVERSI OUT (Mengembalikan ke Gudang)
            if (logInduk && logInduk.aktifitas.startsWith('OUT')) {
                // Skema ID SKU di Gudang: Area_Jenis_Nama_Pjg_Grade_Dus_Shading_PO Bawaan
                const sku = `${d.area}_${d.jenis_item}_${d.nama_item}_${d.pjg}_${d.grade}_${d.dus}_${d.shading}_${d.po_bawaan}`;
                
                arrRestoreFisik.push({
                    qrcode: d.qrcode,
                    area: d.area,
                    id_sku: sku,
                    pic_input: currentUser.username
                });

                // Kembalikan Jatah ke Stok Aktual (Sesuai PO Target Konversi Dulu)
                let keyAkt = `${d.nama_item}_${d.pjg}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${d.po_aktual}_-`;
                if(!mapRestoreAktual[keyAkt]) mapRestoreAktual[keyAkt] = { 
                    jenis_item: d.jenis_item, nama_item: d.nama_item, pjg: d.pjg, grade: d.grade, dus: d.dus, shading: d.shading, 
                    area: d.area, po_aktual: d.po_aktual, ket: '-', qty: 0 
                };
                mapRestoreAktual[keyAkt].qty++;

                // Kembalikan Jatah ke Stok Global (Sesuai PO Bawaan aslinya)
                let keyGlb = `${d.nama_item}_${d.pjg}_${d.grade}_${d.dus}_${d.shading}_${d.po_bawaan}_-`;
                if(!mapRestoreGlobal[keyGlb]) mapRestoreGlobal[keyGlb] = { 
                    jenis_item: d.jenis_item, nama_item: d.nama_item, pjg: d.pjg, grade: d.grade, dus: d.dus, shading: d.shading, 
                    po_bawaan: d.po_bawaan, ket: '-', qty: 0 
                };
                mapRestoreGlobal[keyGlb].qty++;
            }
        });

        // 3. Tembak RPC Langsir agar Fisik Kembali dan QTY bertambah!
        if (arrRestoreFisik.length > 0) {
            const payloadData = { qrs: arrRestoreFisik, aktuals: Object.values(mapRestoreAktual), globals: Object.values(mapRestoreGlobal) };
            const { error: rpcErr } = await db.rpc('eksekusi_langsir_aman', { payload: payloadData });
            if (rpcErr) throw rpcErr;
        }

        // 4. Bersihkan Jejak dari Tabel Karantina (stok_konversi) dan Log (laporan_konversi)
        if (kodeList.length > 0) {
            await db.from('stok_konversi').delete().in('kode_konversi', kodeList);
        }
        const { error: delErr } = await db.from('laporan_konversi').delete().in('id', idsToDelete);
        if (delErr) throw delErr;

        alert(`✅ SUKSES DIBATALKAN!\nFisik kardus telah disedot dari stok_konversi dan dikembalikan secara presisi ke Kartu Stok.`);
        document.getElementById('modal-cancel').classList.add('hidden');
        muatDataRiwayat(); // Reload
        
    } catch (e) {
        alert("Gagal membatalkan konversi. Error: " + e.message);
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
        const safeRangkuman = pd.rangkuman.replace(/<b>|<\/b>/g, '').replace(/"/g, '""');
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
