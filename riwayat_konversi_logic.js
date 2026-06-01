let dataRiwayat = [];

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_konversi', title: 'RIWAYAT KONVERSI', url: 'riwayat_konversi.html' });
    muatDataRiwayat();
});

async function muatDataRiwayat() {
    const tbody = document.getElementById('tbody-riwayat');
    tbody.innerHTML = `<tr><td colspan="10" class="p-10"><i data-lucide="loader-2" class="animate-spin w-8 h-8 mx-auto mb-2 text-slate-500"></i><p class="font-bold text-slate-500 text-xs">Menarik histori...</p></td></tr>`;
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

// Ekstrak string JSON dari DB (Jika format lama, kembalikan default)
function parseDetail(detailString) {
    let res = { ket: detailString, po_target: '-', items: [], rangkuman: 'Format Lama (Tanpa Rincian)' };
    try {
        let parsed = JSON.parse(detailString);
        if (parsed && parsed.items) {
            res.ket = parsed.keterangan || '-';
            res.po_target = parsed.po_target || '-';
            res.items = parsed.items;
            
            // Buat rangkuman "Plafon 4M (2 Dus), WPC 3M (1 Dus)"
            let mapItem = {};
            parsed.items.forEach(d => {
                let namaLengkap = `${d.namaItem} ${d.panjang} ${d.grade} ${d.dus} ${d.shading}`;
                mapItem[namaLengkap] = (mapItem[namaLengkap] || 0) + 1;
            });
            let txt = [];
            for (let k in mapItem) txt.push(`<b>${k}</b> (${mapItem[k]} Dus)`);
            res.rangkuman = txt.join(', ');
        }
    } catch(e) {} // Abaikan jika error parse (berarti data lama)
    return res;
}

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
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition">
                <td class="p-3"><input type="checkbox" class="cb-row cursor-pointer w-4 h-4 text-rose-600 rounded" data-id="${r.id}"></td>
                <td class="p-3 font-bold text-slate-400">${i + 1}</td>
                <td class="p-3 font-semibold text-slate-600 text-xs">${formatTanggal(r.created_at)}</td>
                <td class="p-3 font-black text-blue-700 bg-blue-50/50 text-[11px] border-x border-slate-200">${r.kode_konversi || '-'}</td>
                <td class="p-3 font-black text-rose-600 text-xs uppercase">${r.aktifitas || '-'}</td>
                
                <td class="p-3 font-semibold text-slate-600 text-left text-[11px] whitespace-normal min-w-[200px] leading-relaxed">${pd.rangkuman}</td>
                
                <td class="p-3 font-black text-emerald-800 bg-emerald-100 border-x border-slate-200 text-base">${r.qty_total || 0}</td>
                <td class="p-3 font-black text-slate-800 text-xs uppercase">${r.pic || '-'}</td>
                <td class="p-3 font-semibold text-slate-600 text-left text-[11px] whitespace-normal min-w-[150px] leading-relaxed">${pd.ket}</td>
                
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

// --- POP UP DETAIL ITEM ---
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
function tutupModalDetail() { document.getElementById('modal-detail').classList.add('hidden'); }

// --- CHECKBOX LOGIC ---
function toggleCentangSemua(checked) {
    document.querySelectorAll('.cb-row').forEach(cb => cb.checked = checked);
}

// --- FUNGSI CANCEL KONVERSI ---
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
        // PERHATIAN TECH LEAD: 
        // Logika untuk MEMASUKKAN KEMBALI stok fisik (Inbound) ke tabel stok_qr & stok_aktual
        // menunggu konfirmasi dari Anda apakah kita memakai RPC eksekusi_langsir_aman atau membuat RPC baru.
        // Di bawah ini adalah contoh logika hapus log nya saja:
        
        const { error } = await db.from('laporan_konversi').delete().in('id', idsToDelete);
        if (error) throw error;

        alert(`✅ ${idsToDelete.length} Data Konversi berhasil dibatalkan dan log-nya dihapus!\n\n(Catatan: Pengembalian nilai QTY fisik di Kartu Stok menunggu sinkronisasi RPC Inbound dari Tech Lead).`);
        document.getElementById('modal-cancel').classList.add('hidden');
        muatDataRiwayat(); // Reload
        
    } catch (e) {
        alert("Gagal membatalkan konversi: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false;
    }
}

// --- FILTER & EXCEL TETAP SAMA ---
// (Fungsi toggleFilter, saringTabel, salinData, dan downloadExcel yang lama biarkan utuh jika diperlukan. Saya potong agar ringkas di sini, Anda bisa menempelkannya dari versi sebelumnya).
