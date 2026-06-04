let currentTab = 'pilih';
let dbEstimasiRaw = [];
let dbStokAktualRaw = [];
let alokasiMemoryState = {}; 
let activeEstimasiRow = null; 
let activeStokRow = null; 
let sortState = {};

document.addEventListener('DOMContentLoaded', async () => {
    initModernLayout({ id: 'picking_list', title: 'PICKING LIST', url: 'picking_list.html' });
    await muatAwalDataEstimasi();
});

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('view-pilih').classList.toggle('hidden', tab !== 'pilih');
    document.getElementById('view-picking').classList.toggle('hidden', tab !== 'picking');
    document.getElementById('tab-pilih').className = tab === 'pilih' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    document.getElementById('tab-picking').className = tab === 'picking' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
}

async function muatAwalDataEstimasi() {
    try {
        const { data, error } = await db.from('estimasi_pengiriman').select('*').order('tanggal_estimasi', { ascending: false });
        if(error) throw error; dbEstimasiRaw = data || [];
        
        const tglUnik = [...new Set(dbEstimasiRaw.map(x => x.tanggal_estimasi))].sort().reverse();
        const poUnik = [...new Set(dbEstimasiRaw.map(x => (x.po_estimasi || '').trim()))].sort();
        
        isiDropdownBiasa('filter-est-tanggal', tglUnik, '-- SEMUA TANGGAL --');
        isiDropdownBiasa('filter-est-po', poUnik, '-- SEMUA PO --');
        renderTabelUtamaEstimasi();
    } catch (e) { document.getElementById('tbody-utama-estimasi').innerHTML = `<tr><td colspan="10" class="p-10 text-red-500 font-bold">Gagal: ${e.message}</td></tr>`; }
}

function isiDropdownBiasa(elId, dataArray, textPlaceholder) {
    const el = document.getElementById(elId); if(!el) return;
    let h = `<option value="ALL">${textPlaceholder}</option>`;
    dataArray.forEach(val => { h += `<option value="${val}">${elId.includes('tanggal') ? formatTglIndo(val) : val}</option>`; });
    el.innerHTML = h;
}

function formatTglIndo(tglStr) {
    if(!tglStr) return '-'; const p = tglStr.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : tglStr;
}

function saringTabelUtamaEstimasi() {
    const filterTgl = document.getElementById('filter-est-tanggal').value; const filterPo = document.getElementById('filter-est-po').value;
    if (window.event && window.event.target.id === 'filter-est-tanggal') {
        let filteredRecords = filterTgl === 'ALL' ? dbEstimasiRaw : dbEstimasiRaw.filter(r => r.tanggal_estimasi === filterTgl);
        let poUnik = [...new Set(filteredRecords.map(x => (x.po_estimasi || '').trim()))].sort();
        isiDropdownKhususBypass('filter-est-po', poUnik, '-- SEMUA PO --');
    } else if (window.event && window.event.target.id === 'filter-est-po') {
        let filteredRecords = filterPo === 'ALL' ? dbEstimasiRaw : dbEstimasiRaw.filter(r => r.po_estimasi === filterPo);
        let tglUnik = [...new Set(filteredRecords.map(x => x.tanggal_estimasi))].sort().reverse();
        isiDropdownKhususBypass('filter-est-tanggal', tglUnik, '-- SEMUA TANGGAL --', true);
    }
    renderTabelUtamaEstimasi();
}

function isiDropdownKhususBypass(elId, dataArray, placeholderText, isDate = false) {
    const el = document.getElementById(elId); if (!el) return;
    const oldVal = el.value; let html = `<option value="ALL">${placeholderText}</option>`;
    dataArray.forEach(val => html += `<option value="${val}">${isDate ? formatTglIndo(val) : val}</option>`);
    el.innerHTML = html; if (dataArray.includes(oldVal)) el.value = oldVal; else el.value = 'ALL';
}

function renderTabelUtamaEstimasi() {
    const tbody = document.getElementById('tbody-utama-estimasi');
    const filterTgl = document.getElementById('filter-est-tanggal').value; const filterPo = document.getElementById('filter-est-po').value;

    const filteredData = dbEstimasiRaw.filter(r => {
        const matchTgl = (filterTgl === 'ALL' || !filterTgl) ? true : r.tanggal_estimasi === filterTgl;
        const matchPo = (filterPo === 'ALL' || !filterPo) ? true : r.po_estimasi === filterPo;
        return matchTgl && matchPo;
    });

    if(filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="p-10 text-slate-400 font-bold"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Tidak ada kuota pengiriman estimasi.</td></tr>';
        lucide.createIcons(); return;
    }

    // REVISI B.2: Semua text di dalam cell diatur center aligment-nya
    tbody.innerHTML = filteredData.map((r, i) => {
        let totalPicked = 0; for (let key in alokasiMemoryState) { if(key.startsWith(r.id + '_')) { totalPicked += alokasiMemoryState[key]; } }
        const stringRow = JSON.stringify(r).replace(/"/g, '&quot;');
        return `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-sm text-center">
                <td class="p-3 font-bold text-slate-400">${i+1}</td>
                <td class="p-2 border-r border-slate-200 flex justify-center">
                    <button onclick="bukaPopupStokGudang('${stringRow}')" class="p-1.5 bg-blue-100 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg shadow-sm transition active:scale-95 mx-auto flex">
                        <i data-lucide="box" class="w-4 h-4"></i>
                    </button>
                </td>
                <td class="p-3 font-semibold text-slate-600">${formatTglIndo(r.tanggal_estimasi)}</td>
                <td class="p-3 font-black text-slate-800 border-r border-slate-200">${r.po_estimasi}</td>
                <td class="p-3 font-black text-blue-700">${r.nama_item}</td>
                <td class="p-3 font-bold text-slate-600">${r.panjang}</td>
                <td class="p-3 font-bold text-slate-800">${r.grade}</td>
                <td class="p-3 font-black text-slate-700 bg-slate-50 border-l border-slate-200">${r.jumlah_po}</td>
                <td class="p-3 font-black ${totalPicked > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400'} border-l border-slate-200">${totalPicked}</td>
                <td class="p-3 font-medium text-slate-500 pl-4 border-l border-slate-200 whitespace-normal max-w-[150px] leading-tight">${r.note || '-'}</td>
            </tr>`;
    }).join('');
    lucide.createIcons();
}

// ========================================================
// REVISI B.1: POPUP DENGAN SISTEM FILTER KETAT DARI DATABASE
// ========================================================
async function bukaPopupStokGudang(encodedRowStr) {
    activeEstimasiRow = JSON.parse(encodedRowStr);
    
    ['fp-shading', 'fp-poaktual', 'fp-area', 'fp-ket'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('pop-title-spec').innerText = `${activeEstimasiRow.nama_item} | ${activeEstimasiRow.panjang} | ${activeEstimasiRow.grade}`;
    document.getElementById('pop-lbl-qty-po').innerText = activeEstimasiRow.jumlah_po;

    const tbody = document.getElementById('tbody-popup-stok');
    tbody.innerHTML = `<tr><td colspan="8" class="p-10"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto text-blue-500"></i></td></tr>`;
    lucide.createIcons();
    document.getElementById('modal-gudang-stok').classList.remove('hidden');

    try {
        // REVISI B.1: Query database ditarik sudah dalam kondisi terfilter secara cerdas
        const { data, error } = await db.from('stok_aktual')
            .select('shading, po_aktual, qty, area, keterangan, id') // Hanya mengambil field yang dibutuhkan tabel
            .eq('nama_item', activeEstimasiRow.nama_item)
            .eq('pjg', activeEstimasiRow.panjang)
            .eq('grade', activeEstimasiRow.grade)
            .gt('qty', 0);

        if(error) throw error; dbStokAktualRaw = data || [];
        renderTabelPopupStokInternal();
    } catch (e) { tbody.innerHTML = `<tr><td colspan="8" class="p-5 text-red-500 font-bold">Gagal memuat: ${e.message}</td></tr>`; }
}

function tutupModalStok() { document.getElementById('modal-gudang-stok').classList.add('hidden'); renderTabelUtamaEstimasi(); }

function renderTabelPopupStokInternal() {
    const tbody = document.getElementById('tbody-popup-stok'); sortState = {};
    const fShading = document.getElementById('fp-shading').value.toLowerCase();
    const fPoAktual = document.getElementById('fp-poaktual').value.toLowerCase();
    const fArea = document.getElementById('fp-area').value.toLowerCase();
    const fKet = document.getElementById('fp-ket').value.toLowerCase();

    const filteredStok = dbStokAktualRaw.filter(r => {
        return (!fShading || (r.shading || '').toLowerCase().includes(fShading)) &&
               (!fPoAktual || (r.po_aktual || '').toLowerCase().includes(fPoAktual)) &&
               (!fArea || (r.area || '').toLowerCase().includes(fArea)) &&
               (!fKet || (r.keterangan || '').toLowerCase().includes(fKet));
    });

    let grandTotalPicked = 0;
    if(filteredStok.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-slate-400 font-bold">Stok fisik kosong.</td></tr>'; document.getElementById('pop-lbl-qty-picked').innerText = 0; return; }

    tbody.innerHTML = filteredStok.map((r, i) => {
        const keyMemory = `${activeEstimasiRow.id}_${r.id}`; const currentAllocatedQty = alokasiMemoryState[keyMemory] || 0;
        grandTotalPicked += currentAllocatedQty;

        let textInfoAlokasi = '-';
        if(currentAllocatedQty > 0) {
            textInfoAlokasi = `<div class="p-1 px-2 bg-indigo-50 border border-indigo-200 text-indigo-700 font-black rounded text-[10px] whitespace-normal leading-tight max-w-[180px] mx-auto">
                ${formatTglIndo(activeEstimasiRow.tanggal_estimasi)}<br>${activeEstimasiRow.po_estimasi}<br>QTY: ${currentAllocatedQty} DUS
            </div>`;
        }

        const stringStokRow = JSON.stringify(r).replace(/"/g, '&quot;');
        return `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-xs text-row-popup">
                <td class="p-2"><button onclick="bukaModalMintaQty('${stringStokRow}')" class="px-3 py-1.5 ${currentAllocatedQty > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'} text-white font-black rounded-lg shadow-sm transition active:scale-95 text-[10px] uppercase">${currentAllocatedQty > 0 ? 'Ubah' : 'Pilih'}</button></td>
                <td class="p-3 font-bold text-slate-400 no-popup-cell">${i+1}</td>
                <td class="p-2 border-r border-slate-200">${textInfoAlokasi}</td>
                <td class="p-3 font-bold text-slate-700">${r.shading || '-'}</td>
                <td class="p-3 font-black text-slate-800">${r.po_aktual || '-'}</td>
                <td class="p-3 font-black text-emerald-700 bg-emerald-50/50">${r.qty}</td>
                <td class="p-3 font-black text-amber-600 bg-amber-50/30 border-l border-slate-200">${r.area || '-'}</td>
                <td class="p-3 text-center font-medium text-slate-500 border-l border-slate-200 whitespace-normal max-w-[150px] leading-tight">${r.keterangan || '-'}</td>
            </tr>`;
    }).join('');
    document.getElementById('pop-lbl-qty-picked').innerText = grandTotalPicked;
}

function saringTabelPopupInternal() { renderTabelPopupStokInternal(); }
function resetFilterPopupInternal() { ['fp-shading', 'fp-poaktual', 'fp-area', 'fp-ket'].forEach(id => document.getElementById(id).value = ''); renderTabelPopupStokInternal(); }

function bukaModalMintaQty(encodedStokRowStr) {
    activeStokRow = JSON.parse(encodedStokRowStr); document.getElementById('lbl-max-qty').innerText = activeStokRow.qty;
    const keyMemory = `${activeEstimasiRow.id}_${activeStokRow.id}`; document.getElementById('input-qty-ambil').value = alokasiMemoryState[keyMemory] || '';
    document.getElementById('modal-input-qty').classList.remove('hidden'); document.getElementById('input-qty-ambil').focus();
}

function simpanKuotaAmbilLokal() {
    const inputVal = parseInt(document.getElementById('input-qty-ambil').value); const maxQty = parseInt(activeStokRow.qty);
    const keyMemory = `${activeEstimasiRow.id}_${activeStokRow.id}`;
    if(isNaN(inputVal) || inputVal <= 0) { delete alokasiMemoryState[keyMemory]; document.getElementById('modal-input-qty').classList.add('hidden'); renderTabelPopupStokInternal(); return; }
    if(inputVal > maxQty) return alert(`GAGAL! Stok fisik di rak Area ini hanya tersedia ${maxQty} Dus.`);

    alokasiMemoryState[keyMemory] = inputVal; document.getElementById('modal-input-qty').classList.add('hidden'); renderTabelPopupStokInternal();
}

function sortPopupTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-popup-stok'); const rows = Array.from(tbody.querySelectorAll('tr.text-row-popup'));
    let isAsc = sortState[colIndex] !== 'asc'; sortState[colIndex] = isAsc ? 'asc' : 'desc';
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].innerText.trim(); let valB = b.cells[colIndex].innerText.trim();
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) return isAsc ? numA - numB : numB - numA;
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    rows.forEach(row => tbody.appendChild(row));
    document.querySelectorAll('.sort-icon').forEach(icon => { icon.setAttribute('data-lucide', 'arrow-up-down'); icon.classList.add('opacity-50'); });
    const icon = headerEl.querySelector('.sort-icon'); if(icon) { icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); icon.classList.remove('opacity-50'); lucide.createIcons(); }
}
