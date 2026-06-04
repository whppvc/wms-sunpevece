let currentMode = 'input';
let stagingData = [];
let dbRecordsRaw = [];
let masterKamus = [];
let stagingRowId = 0;
const currentUser = JSON.parse(localStorage.getItem('user_session')) || { username: 'Admin' };

document.addEventListener('DOMContentLoaded', async () => {
    initModernLayout({ id: 'estimasi_pengiriman', title: 'ESTIMASI PENGIRIMAN', url: 'estimasi_pengiriman.html' });
    
    // Set default tanggal hari ini agar user tidak repot mengisi
    const tglEl = document.getElementById('in-tanggal');
    if(tglEl) tglEl.value = new Date().toISOString().split('T')[0];

    await ambilReferensiMaster2();
});

// 1. AMBIL DATA REFERENSI UNTUK DROPDOWN DARI MASTER_2
async function ambilReferensiMaster2() {
    try {
        const { data, error } = await db.from('master_2').select('*');
        if (error) throw error;
        masterKamus = data || [];

        // Ambil set unik untuk nama item, po, dan grade
        const namaSet = [...new Set(masterKamus.map(x => (x.nama_item || '').trim()).filter(Boolean))].sort();
        const gradeSet = [...new Set(masterKamus.map(x => (x.grade || '').trim()).filter(Boolean))].sort();
        const poSet = [...new Set(masterKamus.map(x => (x.po || '').trim()).filter(Boolean))].sort();

        // Inject ke Dropdown Input
        isiDropdown('in-nama-item', namaSet, '-- Pilih Item --');
        isiDropdown('in-grade', gradeSet, '-- Pilih Grade --');
        isiDropdown('in-po', poSet, '-- Pilih PO --');

    } catch (e) {
        console.error("Gagal memuat dropdown acuan:", e.message);
    }
}

function isiDropdown(elId, dataArray, placeholderText) {
    const el = document.getElementById(elId);
    if (!el) return;
    let html = `<option value="">${placeholderText}</option>`;
    dataArray.forEach(val => html += `<option value="${val}">${val}</option>`);
    el.innerHTML = html;
}

// 2. TABS MANAGEMENT
function switchTab(mode) {
    currentMode = mode;
    document.getElementById('view-input').classList.toggle('hidden', mode !== 'input');
    document.getElementById('view-tabel').classList.toggle('hidden', mode !== 'tabel');
    document.getElementById('floating-bar').classList.toggle('hidden', mode !== 'input');

    document.getElementById('tab-input').className = mode === 'input' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs';
    document.getElementById('tab-tabel').className = mode === 'tabel' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs';

    if (mode === 'tabel') {
        muatDataEstimasiDB();
    }
}

// 3. TAMBAH DATA KE TABEL SEMENTARA (STAGING)
function addEstimasiLokal() {
    const tgl = document.getElementById('in-tanggal').value;
    const po = document.getElementById('in-po').value;
    const nama = document.getElementById('in-nama-item').value;
    let pjg = document.getElementById('in-panjang').value.trim();
    const grade = document.getElementById('in-grade').value;
    const note = document.getElementById('in-note').value.trim();

    if (!tgl || !po || !nama || !pjg || !grade) {
        return alert("PERHATIAN: Semua kolom variabel wajib dipilih/diisi kecuali Note!");
    }

    // REVISI: Otomatis tambahkan "M" jika belum ada
    if (pjg && !pjg.toUpperCase().endsWith('M')) {
        pjg = pjg + "M";
    } else {
        pjg = pjg.toUpperCase();
    }

    stagingData.unshift({
        id: ++stagingRowId,
        tanggal_estimasi: tgl,
        po_estimasi: po,
        nama_item: nama,
        panjang: pjg,
        grade: grade,
        note: note || '-'
    });

    renderTabelStaging();
    // Kosongkan variabel input kecuali tanggal dan PO agar cepat input item berikutnya
    document.getElementById('in-nama-item').value = '';
    document.getElementById('in-panjang').value = '';
    document.getElementById('in-grade').value = '';
    document.getElementById('in-note').value = '';
}

function hapusBarisStaging(id) {
    stagingData = stagingData.filter(d => d.id !== id);
    renderTabelStaging();
}

function toggleAllStaging(checked) {
    document.querySelectorAll('.cb-staging').forEach(cb => cb.checked = checked);
}

function renderTabelStaging() {
    const tbody = document.getElementById('tbody-staging');
    if (stagingData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="p-10 text-slate-400 font-bold"><i data-lucide="package-plus" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data ditambahkan ke tabel sementara.</td></tr>';
        lucide.createIcons(); return;
    }

    tbody.innerHTML = stagingData.map((d, i) => `
        <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-sm row-staging-item">
            <td class="p-3"><input type="checkbox" value="${d.id}" class="cb-staging cursor-pointer w-4 h-4 rounded"></td>
            <td class="p-2">
                <button onclick="hapusBarisStaging(${d.id})" class="text-rose-500 hover:text-white hover:bg-rose-600 bg-white border border-slate-200 p-1.5 rounded transition shadow-sm active:scale-95 mx-auto flex">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
            <td class="p-3 font-bold text-slate-400">${i + 1}</td>
            <td class="p-3 font-semibold text-slate-600 col-stg-tgl">${d.tanggal_estimasi}</td>
            <td class="p-3 font-black text-slate-800 col-stg-po">${d.po_estimasi}</td>
            <td class="p-3 font-black text-blue-700 col-stg-nama">${d.nama_item}</td>
            <td class="p-3 font-bold text-slate-600">${d.panjang}</td>
            <td class="p-3 font-bold text-slate-800">${d.grade}</td>
            <td class="p-3 text-left font-medium text-slate-600 pl-4 whitespace-normal max-w-[200px] leading-tight">${d.note}</td>
        </tr>
    `).join('');
    lucide.createIcons();
}

function saringTabelStaging() {
    // Di mode staging, input PO sekarang bentuk select, jadi value-nya pasti match persis
    const filterPo = document.getElementById('in-po').value.toLowerCase();
    const filterNama = document.getElementById('in-nama-item').value.toLowerCase();

    document.querySelectorAll('.row-staging-item').forEach(row => {
        const txtPo = row.querySelector('.col-stg-po').innerText.toLowerCase();
        const txtNama = row.querySelector('.col-stg-nama').innerText.toLowerCase();

        const matchPo = filterPo ? txtPo.includes(filterPo) : true;
        const matchNama = filterNama ? txtNama.includes(filterNama) : true;

        row.style.display = (matchPo && matchNama) ? '' : 'none';
    });
}

// 4. SIMPAN MASSAL DATA DARI STAGING KE DB SUPABASE
async function simpanMassalKeDatabase() {
    if (stagingData.length === 0) return alert("Tabel penampungan masih kosong. Klik 'Add Data' terlebih dahulu!");
    
    const btn = document.getElementById('btn-submit-db');
    const oriText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMPROSES SUBMIT MASSAL...';
    btn.disabled = true;

    const payload = stagingData.map(d => ({
        tanggal_estimasi: d.tanggal_estimasi,
        po_estimasi: d.po_estimasi,
        nama_item: d.nama_item,
        panjang: d.panjang,
        grade: d.grade,
        note: d.note,
        pic: currentUser.username
    }));

    try {
        const { error } = await db.from('estimasi_pengiriman').insert(payload);
        if (error) throw error;

        alert(`🚀 BERHASIL MASSAL!\nSebanyak ${payload.length} data estimasi pengiriman sukses masuk database server.`);
        stagingData = [];
        renderTabelStaging();
    } catch (e) {
        alert("GAGAL INSERT KE SUPABASE: " + e.message);
    } finally {
        btn.innerHTML = oriText;
        btn.disabled = false;
        lucide.createIcons();
    }
}

// ========================================================
// MODE 2: MANAGEMENT TABEL VIEW DATABASE & FILTERS
// ========================================================
async function muatDataEstimasiDB() {
    const tbody = document.getElementById('tbody-database');
    tbody.innerHTML = `<tr><td colspan="8" class="p-10"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-bold text-slate-400 text-sm">Menarik Sejarah Estimasi...</p></td></tr>`;
    lucide.createIcons();

    try {
        const { data, error } = await db.from('estimasi_pengiriman').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        dbRecordsRaw = data || [];
        
        const tglUnik = [...new Set(dbRecordsRaw.map(x => x.tanggal_estimasi))].sort().reverse();
        const poUnik = [...new Set(dbRecordsRaw.map(x => (x.po_estimasi || '').trim()))].sort();

        const curTglSelect = document.getElementById('filter-db-tanggal').value;
        const curPoSelect = document.getElementById('filter-db-po').value;

        isiDropdown('filter-db-tanggal', tglUnik, '-- SEMUA TANGGAL --');
        isiDropdown('filter-db-po', poUnik, '-- SEMUA PO --');

        document.getElementById('filter-db-tanggal').value = curTglSelect || 'ALL';
        document.getElementById('filter-db-po').value = curPoSelect || 'ALL';

        renderTableDatabase();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-5 text-red-500 font-bold">Error load: ${e.message}</td></tr>`;
    }
}

function renderTableDatabase() {
    const tbody = document.getElementById('tbody-database');
    const filterTgl = document.getElementById('filter-db-tanggal').value;
    const filterPo = document.getElementById('filter-db-po').value;

    const filteredRecords = dbRecordsRaw.filter(r => {
        const matchTgl = (filterTgl === 'ALL' || !filterTgl) ? true : r.tanggal_estimasi === filterTgl;
        const matchPo = (filterPo === 'ALL' || !filterPo) ? true : r.po_estimasi === filterPo;
        return matchTgl && matchPo;
    });

    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-10 text-slate-400 font-bold"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Tidak ditemukan data riwayat estimasi pengiriman.</td></tr>';
        lucide.createIcons(); return;
    }

    tbody.innerHTML = filteredRecords.map((r, i) => `
        <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-sm">
            <td class="p-3 font-bold text-slate-400">${i + 1}</td>
            <td class="p-3 font-semibold text-slate-600">${r.tanggal_estimasi}</td>
            <td class="p-3 font-black text-slate-800 border-r border-slate-200">${r.po_estimasi}</td>
            <td class="p-3 font-black text-blue-700">${r.nama_item}</td>
            <td class="p-3 font-bold text-slate-600">${r.panjang}</td>
            <td class="p-3 font-bold text-slate-800">${r.grade}</td>
            <td class="p-3 text-left font-medium text-slate-600 pl-4 whitespace-normal max-w-[200px] leading-tight border-l border-slate-200">${r.note || '-'}</td>
            <td class="p-3 uppercase font-bold text-xs text-slate-400">${r.pic || '-'}</td>
        </tr>
    `).join('');
    lucide.createIcons();
}
