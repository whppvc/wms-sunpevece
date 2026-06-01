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

    // Reset filter jika user sedang melakukan filter, agar data baru terlihat
    resetFilterWithoutRender();

    const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
    
    codes.forEach(code => {
        // Cek duplikat lokal di layar
        const isDuplicate = dataPic.some(d => d.qrcode === code);
        
        const trans = typeof translateBarcode === 'function' ? translateBarcode(code) : { area: '?', namaItem: 'No Name', panjang: '-', grade: '-', dus: '-', shading: '-', poBawaan: '-' };
        
        dataPic.unshift({ 
            id: ++picRowId, 
            qrcode: code, 
            status: isDuplicate ? 'DUPLIKAT LOKAL' : 'BELUM CEK',
            area: trans.area || '?', 
            ...trans,
            ket_baris: ''
        });
    });

    renderTablePic(dataPic);
    inputEl.value = ''; inputEl.focus();
});

// --- FUNGSI RENDER TABEL & HAPUS BARIS ---
function hapusBaris(qrCode) {
    dataPic = dataPic.filter(d => d.qrcode !== qrCode);
    saringTabel(); // Render ulang sesuai filter aktif
}

function updateKetBaris(input, qrCode) {
    let row = dataPic.find(d => d.qrcode === qrCode);
    if(row) row.ket_baris = input.value;
}

function renderTablePic(dataToRender) {
    const tbody = document.getElementById('tbody-pic');
    if(dataToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" class="p-10 text-slate-400 font-bold"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data di-scan / filter kosong.</td></tr>';
        lucide.createIcons();
        return;
    }
    
    let html = '';
    dataToRender.forEach((d, index) => {
        let badge = "bg-slate-200 text-slate-700";
        if(d.status === 'VALID') badge = "bg-emerald-600 text-white border-emerald-700";
        else if(d.status === 'KOSONG' || d.status === 'DUPLIKAT LOKAL') badge = "bg-red-600 text-white border-red-700";

        html += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-xs">
                <td class="p-2 text-center">
                    <button onclick="hapusBaris('${d.qrcode}')" class="text-rose-500 hover:text-white hover:bg-rose-600 bg-white border border-slate-200 p-1.5 rounded transition shadow-sm active:scale-95 mx-auto flex">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
                <td class="p-2 font-bold">${index + 1}</td>
                <td class="p-2 font-black text-[10px] border-r border-slate-200"><span class="px-2 py-1 rounded shadow-sm border ${badge}">${d.status}</span></td>
                <td class="p-2 font-black text-amber-600">${d.area}</td>
                <td class="p-2 font-mono font-bold border-r border-slate-200">${d.qrcode}</td>
                <td class="p-2 font-black text-blue-700">${d.jenisItem || '-'}</td>
                <td class="p-2 font-bold text-left">${d.namaItem || '-'}</td>
                <td class="p-2 font-bold">${d.panjang || '-'}</td>
                <td class="p-2 font-bold">${d.grade || '-'}</td>
                <td class="p-2 font-bold">${d.dus || '-'}</td>
                <td class="p-2 font-bold border-r border-slate-200">${d.shading || '-'}</td>
                <td class="p-2 font-black text-orange-600">${d.poBawaan || '-'}</td>
                <td class="p-2"><input type="text" onchange="updateKetBaris(this, '${d.qrcode}')" value="${d.ket_baris || ''}" class="w-full p-1.5 text-[11px] font-bold border border-slate-300 rounded focus:border-blue-500 outline-none" placeholder="Ket..."></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    lucide.createIcons();
}

// --- FUNGSI FILTER SIDEBAR ---
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
    const fStatus = document.getElementById('f-status').value.toLowerCase();
    const fNama = document.getElementById('f-nama').value.toLowerCase();
    const fQr = document.getElementById('f-qr').value.toLowerCase();

    const filtered = dataPic.filter(r => {
        const matchStatus = (r.status || '').toLowerCase().includes(fStatus);
        const matchNama = (r.namaItem || '').toLowerCase().includes(fNama);
        const matchQr = (r.qrcode || '').toLowerCase().includes(fQr);
        return matchStatus && matchNama && matchQr;
    });

    renderTablePic(filtered);
}

function resetFilterWithoutRender() {
    document.getElementById('f-status').value = '';
    document.getElementById('f-nama').value = '';
    document.getElementById('f-qr').value = '';
}

function resetFilter() {
    resetFilterWithoutRender();
    renderTablePic(dataPic);
}


// --- FUNGSI VERIFIKASI GUDANG (FIX 4) ---
async function verifikasiKeluar() {
    if(dataPic.length === 0) return alert("Belum ada data untuk diverifikasi!");

    const btn = document.getElementById('btn-verifikasi');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENGECEK...';
    btn.disabled = true;

    // Ambil QR yang belum dicek
    const allQRs = dataPic.map(d => d.qrcode);

    try {
        const { data: dbQRs, error } = await db.from('stok_qr').select('qrcode, area').in('qrcode', allQRs);
        if(error) throw error;

        let foundDb = dbQRs || [];
        
        dataPic.forEach(d => {
            let matched = foundDb.find(dbItem => dbItem.qrcode === d.qrcode);
            if (matched) {
                d.status = 'VALID';
                d.area = matched.area; // Set area aktual dari database
            } else {
                d.status = 'KOSONG';
            }
        });

        alert("Selesai memverifikasi fisik Gudang!");
    } catch(err) {
        alert("Gagal koneksi ke Supabase: " + err.message);
    } finally {
        saringTabel(); // Render dengan filter aktif
        btn.innerHTML = ori; btn.disabled = false;
    }
}

// --- FUNGSI SIMPAN & EKSEKUSI (FIX 5 & 6) ---
async function prosesSimpanKeluar() {
    const aktifitas = document.getElementById('select-aktifitas').value;
    const keterangan = document.getElementById('input-keterangan').value.trim();

    if(!aktifitas) return alert("GAGAL! Anda wajib memilih Jenis Aktifitas terlebih dahulu.");
    if(dataPic.length === 0) return alert("GAGAL! Belum ada item fisik yang di-scan.");

    // Cek apakah ada barang yang belum tervalidasi atau tidak ada di gudang
    let unverified = dataPic.filter(d => d.status !== 'VALID');
    if (unverified.length > 0) {
        return alert("GAGAL! Terdapat barcode yang berstatus 'BELUM CEK' atau 'KOSONG'.\n\nSilakan klik Verifikasi Gudang, dan pastikan Anda menghapus (ikon Trash) baris yang berwarna Merah sebelum eksekusi.");
    }

    const btn = document.getElementById('btn-save');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMPROSES...';
    btn.disabled = true;

    // Generate Prefix Kode
    let prefix = "";
    if(aktifitas === "Ganti nama item") prefix = "NA";
    else if(aktifitas === "Potong panjang") prefix = "PJG";
    else if(aktifitas === "Ganti grade") prefix = "GR";
    else if(aktifitas === "Ganti dus") prefix = "D";
    else if(aktifitas === "Ganti shading") prefix = "SH";
    else if(aktifitas === "Ganti label/qrcode") prefix = "QR";
    else if(aktifitas === "Sampel") prefix = "SM";
    else prefix = "XX";

    try {
        // Ambil jumlah row terakhir di laporan_konversi untuk generate auto-increment number
        const { count, error: errCount } = await db.from('laporan_konversi').select('*', { count: 'exact', head: true });
        if(errCount) throw errCount;

        // Auto format number: misal urutan ke 4 -> 00005
        let nextNum = (count || 0) + 1;
        let kodeKonversi = `${prefix}-${String(nextNum).padStart(5, '0')}`;

        // Menggabungkan semua qrcode menjadi text
        let allQRs = dataPic.map(d => d.qrcode).join(', ');

        // Payload insert ke laporan konversi
        const payload = {
            kode_konversi: kodeKonversi,
            aktifitas: aktifitas,
            qrcode: allQRs,
            detail: keterangan || '-',
            qty_total: dataPic.length,
            pic: currentUser.username
        };

        const { error: errInsert } = await db.from('laporan_konversi').insert([payload]);
        if (errInsert) throw errInsert;

        /* =======================================================
           CATATAN TECH LEAD:
           Bagian ini (Pemotongan RPC tabel stok_aktual & stok_qr)
           masih KOSONG dan menunggu instruksi detail logic dari Pak Bos.
           ======================================================= */

        alert(`✅ EKSEKUSI BERHASIL!\n\nData aktivitas masuk ke audit trail dengan ID: ${kodeKonversi}\nTotal Item: ${dataPic.length} Kardus.\n\n(Catatan: Pemotongan aktual pada kartu stok menunggu instruksi logika selanjutnya dari Tech Lead).`);
        
        // Reset Layar
        dataPic = [];
        resetFilter();
        document.getElementById('input-keterangan').value = '';
        document.getElementById('select-aktifitas').value = '';

    } catch(e) {
        alert("Terjadi kesalahan saat menyimpan konversi: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false;
    }
}
