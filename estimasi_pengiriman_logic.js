let currentMode = 'input';
let stagingData = [];
let dbRecordsRaw = [];
let masterKamus = [];
let stagingRowId = 0;
let sortState = {};
const currentUser = JSON.parse(localStorage.getItem('user_session')) || { username: 'Admin' };

document.addEventListener('DOMContentLoaded', async () => {
    initModernLayout({ id: 'estimasi_pengiriman', title: 'ESTIMASI PENGIRIMAN', url: 'estimasi_pengiriman.html' });
    
    const tglEl = document.getElementById('in-tanggal');
    if(tglEl) tglEl.value = new Date().toISOString().split('T')[0];

    await ambilReferensiMaster2();
});

function formatTglIntl(tglStr) {
    if(!tglStr) return '-';
    const p = tglStr.split('-');
    if(p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`; 
    return tglStr;
}

// REVISI A.1: Fungsi sortir tabel untuk Staging lokal
function sortTableStaging(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-staging');
    const rows = Array.from(tbody.querySelectorAll('tr.row-staging-item'));
    let isAsc = sortState[colIndex] !== 'asc'; sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].innerText.trim(); let valB = b.cells[colIndex].innerText.trim();
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) return isAsc ? numA - numB : numB - numA;
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    rows.forEach(row => tbody.appendChild(row));
    updateSortIcons(headerEl, isAsc);
}

// REVISI A.1: Fungsi sortir tabel untuk Database riwayat
function sortTableDatabase(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-database');
    const rows = Array.from(tbody.querySelectorAll('tr.row-database-item'));
    let isAsc = sortState[colIndex] !== 'asc'; sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].innerText.trim(); let valB = b.cells[colIndex].innerText.trim();
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) return isAsc ? numA - numB : numB - numA;
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    rows.forEach(row => tbody.appendChild(row));
    updateSortIcons(headerEl, isAsc);
}

function updateSortIcons(headerEl, isAsc) {
    document.querySelectorAll('.sort-icon').forEach(icon => { icon.setAttribute('data-lucide', 'arrow-up-down'); icon.classList.add('opacity-50'); });
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) { icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); icon.classList.remove('opacity-50'); lucide.createIcons(); }
}

async function ambilReferensiMaster2() {
    try {
        const { data, error } = await db.from('master_2').select('*');
        if (error) throw error; masterKamus = data || [];
        const namaSet = [...new Set(masterKamus.map(x => (x.nama_item || '').trim()).filter(Boolean))].sort();
        const gradeSet = [...new Set(masterKamus.map(x => (x.grade || '').trim()).filter(Boolean))].sort();
        const poSet = [...new Set(masterKamus.map(x => (x.po || '').trim()).filter(Boolean))].sort();

        isiDropdown('in-nama-item', namaSet, '-- Pilih Item --');
        isiDropdown('in-grade', gradeSet, '-- Pilih Grade --');
        isiDropdown('in-po', poSet, '-- Pilih PO --');
    } catch (e) { console.error("Gagal memuat dropdown acuan:", e.message); }
}

function isiDropdown(elId, dataArray, placeholderText) {
    const el = document.getElementById(elId); if (!el) return;
    let html = `<option value="">${placeholderText}</option>`;
    dataArray.forEach(val => html += `<option value="${val}">${val}</option>`); el.innerHTML = html;
}

function isiDropdownDB(elId, dataArray, placeholderText, isDate = false) {
    const el = document.getElementById(elId); if (!el) return;
    const currentVal = el.value; let html = `<option value="ALL">${placeholderText}</option>`;
    dataArray.forEach(val => { let displayVal = isDate ? formatTglIntl(val) : val; html += `<option value="${val}">${displayVal}</option>`; });
    el.innerHTML = html; if (dataArray.includes(currentVal)) el.value = currentVal; else el.value = 'ALL';
}

function switchTab(mode) {
    currentMode = mode;
    document.getElementById('view-input').classList.toggle('hidden', mode !== 'input');
    document.getElementById('view-tabel').classList.toggle('hidden', mode !== 'tabel');
    document.getElementById('floating-bar').classList.toggle('hidden', mode !== 'input');
    document.getElementById('tab-input').className = mode === 'input' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs';
    document.getElementById('tab-tabel').className = mode === 'tabel' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs';
    if (mode === 'tabel') muatDataEstimasiDB();
}

function addEstimasiLokal() {
    const tgl = document.getElementById('in-tanggal').value; const po = document.getElementById('in-po').value;
    const nama = document.getElementById('in-nama-item').value; let pjg = document.getElementById('in-panjang').value.trim();
    const grade = document.getElementById('in-grade').value; const jumlahPo = document.getElementById('in-jumlah-po').value.trim();
    const note = document.getElementById('in-note').value.trim();

    if (!tgl || !po || !nama || !pjg || !grade || !jumlahPo) return alert("PERHATIAN: Semua kolom variabel wajib diisi kecuali Note!");
    if (pjg && !pjg.toUpperCase().endsWith('M')) pjg = pjg + "M"; else pjg = pjg.toUpperCase();

    stagingData.unshift({ id: ++stagingRowId, tanggal_estimasi: tgl, po_estimasi: po, nama_item: nama, panjang: pjg, grade: grade, jumlah_po: jumlahPo, note: note || '-' });
    renderTabelStaging();
    document.getElementById('in-nama-item').value = ''; document.getElementById('in-panjang').value = ''; document.getElementById('in-grade').value = ''; document.getElementById('in-jumlah-po').value = ''; document.getElementById('in-note').value = '';
}

function hapusBarisStaging(id) { stagingData = stagingData.filter(d => d.id !== id); renderTabelStaging(); }
function toggleAllStaging(checked) { document.querySelectorAll('.cb-staging').forEach(cb => cb.checked = checked); }

function renderTabelStaging() {
    const tbody = document.getElementById('tbody-staging');
    if (stagingData.length === 0) { tbody.innerHTML = '<tr><td colspan="10" class="p-10 text-slate-400 font-bold"><i data-lucide="package-plus" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data ditambahkan.</td></tr>'; lucide.createIcons(); return; }
    tbody.innerHTML = stagingData.map((d, i) => `
        <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-sm row-staging-item">
            <td class="p-3"><input type="checkbox" value="${d.id}" class="cb-staging cursor-pointer w-4 h-4 rounded"></td>
            <td class="p-2"><button onclick="hapusBarisStaging(${d.id})" class="text-rose-500 hover:text-white hover:bg-rose-600 bg-white border p-1.5 rounded transition shadow-sm active:scale-95 mx-auto flex"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>
            <td class="p-3 font-bold text-slate-400"></td>
            <td class="p-3 font-semibold text-slate-600">${formatTglIntl(d.tanggal_estimasi)}</td>
            <td class="p-3 font-black text-slate-800">${d.po_estimasi}</td>
            <td class="p-3 font-black text-blue-700">${d.nama_item}</td>
            <td class="p-3 font-bold text-slate-600">${d.panjang}</td>
            <td class="p-3 font-bold text-slate-800">${d.grade}</td>
            <td class="p-3 font-black text-orange-600 bg-orange-50 border-l border-slate-200">${d.jumlah_po}</td>
            <td class="p-3 text-left font-medium text-slate-600 pl-4 whitespace-normal max-w-[200px] leading-tight border-l border-slate-200">${d.note}</td>
        </tr>`).join('');
    lucide.createIcons(); updateStagingRowNumbers();
}

function updateStagingRowNumbers() { const rows = document.querySelectorAll('.row-staging-item'); rows.forEach((tr, idx) => { tr.children[2].innerText = idx + 1; }); }

function saringTabelStaging() {
    const filterPo = document.getElementById('in-po').value.toLowerCase(); const filterNama = document.getElementById('in-nama-item').value.toLowerCase();
    document.querySelectorAll('.row-staging-item').forEach(row => {
        const txtPo = row.children[4].innerText.toLowerCase(); const txtNama = row.children[5].innerText.toLowerCase();
        row.style.display = ( (!filterPo || txtPo.includes(filterPo)) && (!filterNama || txtNama.includes(filterNama)) ) ? '' : 'none';
    });
}

async function simpanMassalKeDatabase() {
    if (stagingData.length === 0) return alert("Tabel penampungan masih kosong!");
    const btn = document.getElementById('btn-submit-db'); const oriText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MENYIMPAN...'; btn.disabled = true;

    const payload = stagingData.map(d => ({ tanggal_estimasi: d.tanggal_estimasi, po_estimasi: d.po_estimasi, nama_item: d.nama_item, panjang: d.panjang, grade: d.grade, jumlah_po: d.jumlah_po, note: d.note, pic: currentUser.username }));
    try {
        const { error } = await db.from('estimasi_pengiriman').insert(payload);
        if (error) throw error; alert(`🚀 BERHASIL! ${payload.length} data estimasi sukses masuk database server.`);
        stagingData = []; renderTabelStaging();
    } catch (e) { alert("GAGAL INSERT: " + e.message); } finally { btn.innerHTML = oriText; btn.disabled = false; lucide.createIcons(); }
}

async function muatDataEstimasiDB() {
    const tbody = document.getElementById('tbody-database');
    tbody.innerHTML = `<tr><td colspan="10" class="p-10"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-bold text-slate-400 text-sm">Menarik Data Estimasi...</p></td></tr>`;
    lucide.createIcons();
    try {
        const { data, error } = await db.from('estimasi_pengiriman').select('*').order('created_at', { ascending: false });
        if (error) throw error; dbRecordsRaw = data || [];
        if (dbRecordsRaw.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="p-10 text-slate-400 font-bold">Tidak ditemukan data riwayat estimasi pengiriman.</td></tr>';
            isiDropdownDB('filter-db-tanggal', [], '-- SEMUA TANGGAL --', true); isiDropdownDB('filter-db-po', [], '-- SEMUA PO --', false); return;
        }
        const tglUnik = [...new Set(dbRecordsRaw.map(x => x.tanggal_estimasi))].sort().reverse();
        const poUnik = [...new Set(dbRecordsRaw.map(x => (x.po_estimasi || '').trim()))].sort();
        isiDropdownDB('filter-db-tanggal', tglUnik, '-- SEMUA TANGGAL --', true); isiDropdownDB('filter-db-po', poUnik, '-- SEMUA PO --', false);
        renderTableDatabase();
    } catch (e) { tbody.innerHTML = `<tr><td colspan="10" class="p-5 text-red-500 font-bold">Error load: ${e.message}</td></tr>`; }
}

function handleFilterChange(trigger) {
    let selDate = document.getElementById('filter-db-tanggal').value; let selPo = document.getElementById('filter-db-po').value;
    if (trigger === 'tanggal') {
        let filteredRecordsForPO = selDate === 'ALL' ? dbRecordsRaw : dbRecordsRaw.filter(r => r.tanggal_estimasi === selDate);
        let poUnikLanjutan = [...new Set(filteredRecordsForPO.map(x => (x.po_estimasi || '').trim()))].sort();
        isiDropdownDB('filter-db-po', poUnikLanjutan, '-- SEMUA PO --', false);
    } else if (trigger === 'po') {
        let filteredRecordsForTgl = selPo === 'ALL' ? dbRecordsRaw : dbRecordsRaw.filter(r => r.po_estimasi === selPo);
        let tglUnikLanjutan = [...new Set(filteredRecordsForTgl.map(x => x.tanggal_estimasi))].sort().reverse();
        isiDropdownDB('filter-db-tanggal', tglUnikLanjutan, '-- SEMUA TANGGAL --', true);
    }
    renderTableDatabase();
}

// REVISI A.1: Fungsi hapus riwayat estimasi dari database
async function hapusDataEstimasiDB(id) {
    if(!confirm("Hapus permanen data estimasi pengiriman ini dari database?")) return;
    try {
        const { error } = await db.from('estimasi_pengiriman').delete().eq('id', id);
        if(error) throw error; alert("Data berhasil terhapus!"); muatDataEstimasiDB();
    } catch(e) { alert("Gagal hapus: " + e.message); }
}

function renderTableDatabase() {
    const tbody = document.getElementById('tbody-database');
    const filterTgl = document.getElementById('filter-db-tanggal').value; const filterPo = document.getElementById('filter-db-po').value;
    const filteredRecords = dbRecordsRaw.filter(r => {
        const matchTgl = (filterTgl === 'ALL' || !filterTgl) ? true : r.tanggal_estimasi === filterTgl;
        const matchPo = (filterPo === 'ALL' || !filterPo) ? true : r.po_estimasi === filterPo;
        return matchTgl && matchPo;
    });
    if (filteredRecords.length === 0) { tbody.innerHTML = '<tr><td colspan="10" class="p-10 text-slate-400 font-bold">Tidak ditemukan data riwayat.</td></tr>'; lucide.createIcons(); return; }
    
    tbody.innerHTML = filteredRecords.map((r, i) => `
        <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-sm row-database-item">
            <td class="p-3 font-bold text-slate-400">${i + 1}</td>
            <td class="p-2"><button onclick="hapusDataEstimasiDB('${r.id}')" class="text-rose-500 hover:text-white hover:bg-rose-600 bg-white border p-1.5 rounded transition shadow-sm active:scale-95 mx-auto flex"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>
            <td class="p-3 font-semibold text-slate-600">${formatTglIntl(r.tanggal_estimasi)}</td>
            <td class="p-3 font-black text-slate-800 border-r border-slate-200">${r.po_estimasi}</td>
            <td class="p-3 font-black text-blue-700">${r.nama_item}</td>
            <td class="p-3 font-bold text-slate-600">${r.panjang}</td>
            <td class="p-3 font-bold text-slate-800">${r.grade}</td>
            <td class="p-3 font-black text-orange-600 bg-orange-50 border-l border-slate-200">${r.jumlah_po || '-'}</td>
            <td class="p-3 text-left font-medium text-slate-600 pl-4 whitespace-normal max-w-[200px] leading-tight border-l border-slate-200">${r.note || '-'}</td>
            <td class="p-3 uppercase font-bold text-xs text-slate-400 border-l border-slate-200">${r.pic || '-'}</td>
        </tr>`).join('');
    lucide.createIcons();
}
