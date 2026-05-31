let dataPic = [];
let picRowId = 0;
const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

document.addEventListener('DOMContentLoaded', async () => { 
    initModernLayout({ id: 'scan_pic', title: 'SCAN PIC AREA', url: 'scan_pic.html' }); 
});

// --- FUNGSI MINIMIZE/MAXIMIZE BOX AKTIFITAS ---
function toggleAktifitas() {
    const body = document.getElementById('body-aktifitas');
    const icon = document.getElementById('icon-toggle-aktifitas');
    
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        icon.classList.remove('rotate-180');
    } else {
        body.classList.add('hidden');
        icon.classList.add('rotate-180');
    }
}

// --- FUNGSI SCAN BARCODE ---
document.getElementById('form-scan').addEventListener('submit', (e) => {
    e.preventDefault();
    const inputEl = document.getElementById('input-qrcode');
    const rawInput = inputEl.value.trim();
    if(!rawInput) return;

    // Split jika pakai scanner continuous
    const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
    
    codes.forEach(code => {
        // Asumsi fungsi translateBarcode() sudah ada di global.js atau kita pakai fungsi standar
        // Untuk sementara kita pakai mock jika belum dipindah ke global.js
        const trans = typeof translateBarcode === 'function' ? translateBarcode(code) : { area: 'A1', namaItem: 'Plafon Test', panjang: '4M', grade: 'A', dus: 'B', shading: 'S1', po: 'PO001' };
        
        dataPic.unshift({ 
            id: ++picRowId, 
            qrcode: code, 
            status: 'BELUM CEK',
            area: trans.area || '-', 
            ...trans
        });
    });

    renderTablePic();
    inputEl.value = ''; inputEl.focus();
});

function renderTablePic() {
    const tbody = document.getElementById('tbody-pic');
    if(dataPic.length === 0) return tbody.innerHTML = '<tr><td colspan="16" class="p-10 text-slate-400 font-bold">Belum ada data di-scan.</td></tr>';
    
    let html = '';
    dataPic.forEach((d, index) => {
        let badge = "bg-slate-200 text-slate-700";
        if(d.status === 'READY') badge = "bg-emerald-500 text-white";
        if(d.status === 'NOT FOUND') badge = "bg-red-600 text-white";

        html += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-xs">
                <td class="p-2 text-center"><input type="checkbox" class="w-4 h-4 text-rose-600 rounded"></td>
                <td class="p-2 font-bold">${index + 1}</td>
                <td class="p-2 font-black text-[10px] border-r border-slate-200"><span class="px-2 py-1 rounded shadow-sm border border-black/10 ${badge}">${d.status}</span></td>
                <td class="p-2 font-black text-amber-600">${d.area}</td>
                <td class="p-2 font-mono font-bold border-r border-slate-200">${d.qrcode}</td>
                <td class="p-2 font-bold">${d.tglProduksi || '-'}</td>
                <td class="p-2 font-bold">${d.mesin || '-'}</td>
                <td class="p-2 font-bold">${d.shift || '-'}</td>
                <td class="p-2 font-black text-blue-700">${d.jenisItem || '-'}</td>
                <td class="p-2 font-bold text-left">${d.namaItem || '-'}</td>
                <td class="p-2 font-bold">${d.panjang || '-'}</td>
                <td class="p-2 font-bold">${d.grade || '-'}</td>
                <td class="p-2 font-bold">${d.dus || '-'}</td>
                <td class="p-2 font-bold border-r border-slate-200">${d.shading || '-'}</td>
                <td class="p-2 font-black text-orange-600">${d.po || '-'}</td>
                <td class="p-2"><input type="text" class="w-full p-1.5 text-xs border border-slate-300 rounded" placeholder="Ket..."></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// --- FUNGSI VERIFIKASI (MOCK) ---
async function verifikasiKeluar() {
    if(dataPic.length === 0) return alert("Belum ada data!");
    // Nanti disini kita cek ke tabel stok_qr apakah barangnya ada di gudang
    alert("Tombol Verifikasi Ditekan! (Logic SQL menyusul sesuai detail dropdown)");
}

// --- FUNGSI SIMPAN ---
async function prosesSimpanKeluar() {
    const aktifitas = document.getElementById('select-aktifitas').value;
    const keterangan = document.getElementById('input-keterangan').value;

    if(!aktifitas) return alert("GAGAL! Anda wajib memilih Jenis Aktifitas terlebih dahulu.");
    if(dataPic.length === 0) return alert("GAGAL! Belum ada item yang di-scan.");

    alert(`Bersiap menyimpan ${dataPic.length} kardus untuk Aktifitas: [${aktifitas}].\n\nMenunggu instruksi Pak Bos untuk logika database per dropdown-nya!`);
    
    // Logic INSERT ke `laporan_konversi` dan DELETE `stok_qr` dll akan ditaruh disini.
}
