let dataRiwayat = [];

document.addEventListener('DOMContentLoaded', () => {
    // Memanggil UI Header Standar dari global.js
    initModernLayout({ id: 'riwayat_konversi', title: 'RIWAYAT KONVERSI', url: 'riwayat_konversi.html' });
    muatDataRiwayat();
});

// ========================================================
// 1. FETCH DATA DARI SUPABASE
// ========================================================
async function muatDataRiwayat() {
    const tbody = document.getElementById('tbody-riwayat');
    tbody.innerHTML = `<tr><td colspan="8" class="p-10"><i data-lucide="loader-2" class="animate-spin w-8 h-8 mx-auto mb-2 text-slate-500"></i><p class="font-bold text-slate-500 text-xs">Menarik histori dari laporan_konversi...</p></td></tr>`;
    lucide.createIcons();

    try {
        const { data, error } = await db.from('laporan_konversi')
                                        .select('*')
                                        .order('created_at', { ascending: false });
        if (error) throw error;

        dataRiwayat = data || [];
        renderTabel(dataRiwayat);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-10 text-red-500 font-bold text-xs uppercase">Gagal memuat data: ${error.message}</td></tr>`;
    }
}

// Format Tanggal jadi nyaman dibaca (DD/MM/YYYY HH:mm)
function formatTanggal(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// ========================================================
// 2. RENDER TABEL UTAMA
// ========================================================
function renderTabel(data) {
    const tbody = document.getElementById('tbody-riwayat');
    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-10 text-slate-400 font-black uppercase text-xs">Belum ada data histori.</td></tr>`;
        return;
    }

    let html = '';
    data.forEach((r, i) => {
        html += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition">
                <td class="p-3 font-bold text-slate-400">${i + 1}</td>
                <td class="p-3 font-semibold text-slate-600 text-xs">${formatTanggal(r.created_at)}</td>
                <td class="p-3 font-black text-blue-700 bg-blue-50/50 text-[11px]">${r.kode_konversi || '-'}</td>
                <td class="p-3 font-black text-rose-600 text-xs uppercase">${r.aktifitas || '-'}</td>
                <td class="p-3 font-black text-emerald-800 bg-emerald-100 border-x border-slate-200 text-base">${r.qty_total || 0}</td>
                <td class="p-3 font-black text-slate-800 text-xs uppercase">${r.pic || '-'}</td>
                
                <td class="p-3 font-semibold text-slate-600 text-left text-[11px] whitespace-normal min-w-[200px] max-w-sm leading-relaxed">${r.detail || '-'}</td>
                <td class="p-3 font-mono font-bold text-[10px] text-slate-500 text-left whitespace-normal min-w-[250px] max-w-lg border-r border-slate-200 break-all">${r.qrcode || '-'}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    lucide.createIcons();
}

// ========================================================
// 3. LOGIKA FILTER (Sidebar Slide)
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
// 4. EKSPOR KE CLIPBOARD & EXCEL (Tanpa Library Eksternal)
// ========================================================
function salinData() {
    if(dataRiwayat.length === 0) return alert('Tidak ada data untuk disalin');
    
    let text = "Waktu\tID Konversi\tAktifitas\tTotal Dus\tPIC\tDetail Keterangan\tQRCode\n";
    dataRiwayat.forEach(r => {
        text += `${formatTanggal(r.created_at)}\t${r.kode_konversi || '-'}\t${r.aktifitas || '-'}\t${r.qty_total || 0}\t${r.pic || '-'}\t${r.detail || '-'}\t${r.qrcode || '-'}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
        alert("Berhasil! Data telah disalin ke Clipboard. Silakan Paste (CTRL+V) di Notepad / Excel Anda.");
    }).catch(err => alert("Sistem browser gagal menyalin: " + err));
}

function downloadExcel() {
    if(dataRiwayat.length === 0) return alert('Tidak ada data untuk didownload');
    
    let csv = "Waktu,ID Konversi,Aktifitas,Total Dus,PIC,Detail Keterangan,QRCode\n";
    dataRiwayat.forEach(r => {
        // Mencegah error CSV karena tanda koma atau kutip (") yang ada di text detail / qrcode
        const safeDetail = (r.detail || '-').replace(/"/g, '""');
        const safeQR = (r.qrcode || '-').replace(/"/g, '""');
        
        csv += `"${formatTanggal(r.created_at)}","${r.kode_konversi || '-'}","${r.aktifitas || '-'}","${r.qty_total || 0}","${r.pic || '-'}","${safeDetail}","${safeQR}"\n`;
    });

    // Generate dan Auto-Download file Blob
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
