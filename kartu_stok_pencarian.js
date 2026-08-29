// ============================================================================
// WMS SUNPEVECE - SUBMENU PENCARIAN ITEM (MOBILE & DESKTOP DEDICATED)
// ============================================================================

window.initPencarianMode = function(isMobile) {
    // Reset state saat membuka tab Pencarian agar TIDAK langsung me-render dan tidak lemot
    hasExecutedGlobalSearch = false;
    globalSearchFilters = { nama: '', pjg: '', grade: '', dus: '', shading: '', area: '', cust: '', est: '' };
    searchedQRResults = [];

    if (isMobile) {
        mobilePencarianSubMode = 'menu';
        renderMobilePencarian();
    } else {
        desktopPencarianSubMode = 'global';
        renderDesktopPencarian();
    }
};

window.pilihPencarian = function(subMode) {
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
        mobilePencarianSubMode = subMode;
        if (subMode === 'qr') {
            document.getElementById('input-search-qrcodes').value = '';
            document.getElementById('modal-scan-cari-qr').classList.remove('hidden');
            setTimeout(() => document.getElementById('input-search-qrcodes').focus(), 100);
        }
        renderMobilePencarian();
    } else {
        desktopPencarianSubMode = subMode;
        if (subMode === 'qr') {
            document.getElementById('input-search-qrcodes').value = '';
            document.getElementById('modal-scan-cari-qr').classList.remove('hidden');
            setTimeout(() => document.getElementById('input-search-qrcodes').focus(), 100);
        }
        renderDesktopPencarian();
    }
};

window.toggleMobileFilterBox = function() {
    isMobileFilterOpen = !isMobileFilterOpen;
    const body = document.getElementById('body-mobile-filter');
    const icon = document.getElementById('icon-toggle-filter');
    const lbl = document.getElementById('lbl-toggle-status');
    if (body) {
        body.classList.toggle('hidden', !isMobileFilterOpen);
    }
    if (icon) {
        icon.style.transform = isMobileFilterOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    }
    if (lbl) {
        lbl.innerText = isMobileFilterOpen ? 'Tutup' : 'Buka';
    }
};

window.bukaDetailQRGlobal = function(encodedData) {
    const d = JSON.parse(decodeURIComponent(encodedData));
    const pjgFormatted = formatPanjang(d.pjg || d.panjang);

    // Cari fisik QR Code di stok_global yang cocok
    const matchedQRs = stokGlobalRaw.filter(g => 
        g.nama_item === d.nama && 
        formatPanjang(g.panjang) === pjgFormatted && 
        g.grade === d.grade && 
        g.dus === d.dus && 
        g.shading === d.shading && 
        g.area === d.area && 
        g.customer_aktual === d.po_aktual
    );

    activeDetailQRs = matchedQRs.map(g => g.qrcode);

    document.getElementById('qr-global-title-item').innerText = `${d.nama} - ${pjgFormatted} - ${d.grade}`;
    document.getElementById('qr-global-subtitle-item').innerText = `Dus: ${d.dus} • Shading: ${d.shading} • Area: ${d.area} • Customer: ${d.po_aktual}`;
    document.getElementById('qr-global-count-badge').innerText = `Total: ${matchedQRs.length} Dus Fisik`;

    const container = document.getElementById('qr-global-list-container');
    if (matchedQRs.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center font-bold text-slate-400">
                <i data-lucide="package-search" class="w-10 h-10 mx-auto mb-2 text-slate-300"></i>
                Tidak ditemukan fisik QR Code di stok global.
            </div>
        `;
    } else {
        container.innerHTML = matchedQRs.map((g, idx) => `
            <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
                <div class="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1">
                    <span class="text-xs font-black text-slate-800">#${idx+1}</span>
                    <span class="text-[10px] font-bold text-slate-400">Tgl: ${g.tgl_produksi || '-'} • M:${g.mesin || '-'} S:${g.shift || '-'}</span>
                </div>
                <div class="font-mono font-black text-slate-900 text-xs break-all bg-slate-50 p-2 rounded-lg border border-slate-200">
                    ${g.qrcode}
                </div>
                <div class="text-[11px] font-medium text-slate-500 mt-0.5 flex justify-between">
                    <span>Keterangan: <strong class="text-slate-700">${g.keterangan || '-'}</strong></span>
                </div>
            </div>
        `).join('');
    }

    if(typeof lucide !== 'undefined') lucide.createIcons();
    document.getElementById('modal-detail-qr-global').classList.remove('hidden');
};

window.salinSemuaQRDetail = function() {
    if(!activeDetailQRs || activeDetailQRs.length === 0) return alert("Tidak ada QR Code untuk disalin.");
    navigator.clipboard.writeText(activeDetailQRs.join('\n')).then(() => {
        alert(`✅ ${activeDetailQRs.length} QR Code berhasil disalin ke clipboard!`);
    });
};

window.eksekusiCariQR = async function() {
    const rawInput = document.getElementById('input-search-qrcodes').value.trim();
    if(!rawInput) return alert("Masukkan QR Code terlebih dahulu!");

    const qrs = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
    
    try {
        const { data: globalData, error } = await db.from('stok_global').select('*').in('qrcode', qrs);
        if(error) throw error;

        const globalFound = globalData || [];
        const { data: nonaktifData } = await db.from('stok_nonaktif').select('*').in('qrcode', qrs);
        const nonaktifFound = nonaktifData || [];

        searchedQRResults = [];
        qrs.forEach(code => {
            const g = globalFound.find(d => d.qrcode === code);
            const n = nonaktifFound.find(d => d.qrcode === code);
            
            if (g) {
                let estTarget = g.customer_aktual || '-';
                const aktMatch = stokAktualRaw.find(a => 
                    a.nama_item === g.nama_item && a.panjang === formatPanjang(g.panjang) && 
                    a.grade === g.grade && a.dus === g.dus && a.shading === g.shading && 
                    a.area === g.area && a.customer_aktual === g.customer_aktual
                );
                if (aktMatch && aktMatch.customer_estimasi) {
                    estTarget = aktMatch.customer_estimasi;
                }

                searchedQRResults.push({
                    qrcode: g.qrcode,
                    area: g.area || '-',
                    tglProduksi: g.tgl_produksi || '-',
                    mesin: g.mesin || '-',
                    shift: g.shift || '-',
                    namaItem: g.nama_item || '-',
                    panjang: formatPanjang(g.panjang),
                    grade: g.grade || '-',
                    dus: g.dus || '-',
                    shading: g.shading || '-',
                    customerAktual: g.customer_aktual || '-',
                    customerEstimasi: estTarget,
                    keterangan: g.keterangan || '-',
                    status: 'TERSEDIA DI GUDANG',
                    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200'
                });
            } else if (n) {
                searchedQRResults.push({
                    qrcode: n.qrcode,
                    area: n.posisi || '-',
                    tglProduksi: '-',
                    mesin: '-',
                    shift: '-',
                    namaItem: n.nama_item || '-',
                    panjang: formatPanjang(n.panjang),
                    grade: n.grade || '-',
                    dus: n.dus || '-',
                    shading: n.shading || '-',
                    customerAktual: n.customer_aktual || '-',
                    customerEstimasi: n.customer_estimasi || '-',
                    keterangan: n.keterangan || '-',
                    status: 'STOK NONAKTIF',
                    badgeClass: 'bg-red-100 text-red-700 border-red-200'
                });
            } else {
                searchedQRResults.push({
                    qrcode: code,
                    area: '?',
                    tglProduksi: '-',
                    mesin: '-',
                    shift: '-',
                    namaItem: 'Tidak Dikenal',
                    panjang: '-',
                    grade: '-',
                    dus: '-',
                    shading: '-',
                    customerAktual: '-',
                    customerEstimasi: '-',
                    keterangan: '-',
                    status: 'TIDAK DITEMUKAN',
                    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200'
                });
            }
        });

        document.getElementById('modal-scan-cari-qr').classList.add('hidden');
        
        if (window.innerWidth < 640) {
            mobilePencarianSubMode = 'qr';
            renderMobilePencarian();
        } else {
            desktopPencarianSubMode = 'qr';
            renderDesktopPencarian();
        }

    } catch(e) {
        alert("Gagal mencari data: " + e.message);
    }
};

window.eksekusiCariGlobal = function(isDesktop = false) {
    const prefix = isDesktop ? 'pc-f-' : 'm-f-';
    globalSearchFilters = {
        nama: document.getElementById(`${prefix}nama`)?.value.trim().toUpperCase() || '',
        pjg: document.getElementById(`${prefix}pjg`)?.value.trim().toUpperCase() || '',
        grade: document.getElementById(`${prefix}grade`)?.value.trim().toUpperCase() || '',
        dus: document.getElementById(`${prefix}dus`)?.value.trim().toUpperCase() || '',
        shading: document.getElementById(`${prefix}shading`)?.value.trim().toUpperCase() || '',
        area: document.getElementById(`${prefix}area`)?.value.trim().toUpperCase() || '',
        cust: document.getElementById(`${prefix}cust`)?.value.trim().toUpperCase() || '',
        est: document.getElementById(`${prefix}cust-est`)?.value.trim().toUpperCase() || ''
    };

    hasExecutedGlobalSearch = true;
    if (isDesktop) renderDesktopPencarian();
    else renderMobilePencarian();
};

window.resetCariGlobal = function(isDesktop = false) {
    const prefix = isDesktop ? 'pc-f-' : 'm-f-';
    ['nama', 'pjg', 'grade', 'dus', 'shading', 'area', 'cust', 'cust-est'].forEach(k => {
        const el = document.getElementById(`${prefix}${k}`);
        if (el) el.value = '';
    });
    globalSearchFilters = { nama: '', pjg: '', grade: '', dus: '', shading: '', area: '', cust: '', est: '' };
    hasExecutedGlobalSearch = false;
    if (isDesktop) renderDesktopPencarian();
    else renderMobilePencarian();
};

function getFilteredGlobalSearchResults() {
    // KUNCI UTAMA: Jika user belum menekan tombol cari, kembalikan array kosong agar tidak me-render ribuan data di awal
    if (!hasExecutedGlobalSearch) return [];
    
    return dataKSArea.filter(r => {
        if (globalSearchFilters.nama && !r.nama.toUpperCase().includes(globalSearchFilters.nama)) return false;
        if (globalSearchFilters.pjg && !r.pjg.toUpperCase().includes(globalSearchFilters.pjg)) return false;
        if (globalSearchFilters.grade && !r.grade.toUpperCase().includes(globalSearchFilters.grade)) return false;
        if (globalSearchFilters.dus && !r.dus.toUpperCase().includes(globalSearchFilters.dus)) return false;
        if (globalSearchFilters.shading && !r.shading.toUpperCase().includes(globalSearchFilters.shading)) return false;
        if (globalSearchFilters.area && !r.area.toUpperCase().includes(globalSearchFilters.area)) return false;
        if (globalSearchFilters.cust && !r.po_aktual.toUpperCase().includes(globalSearchFilters.cust)) return false;
        if (globalSearchFilters.est && !r.customer_estimasi.toUpperCase().includes(globalSearchFilters.est)) return false;
        return true;
    });
}

// ==========================================
// RENDER PENCARIAN HP (MOBILE)
// ==========================================
function renderMobilePencarian() {
    const container = document.getElementById('view-pencarian-mobile');
    if(!container) return;

    let html = '';

    // LEVEL 1: MENU UTAMA 2 KISI
    if (mobilePencarianSubMode === 'menu') {
        html += `
            <div class="mb-2">
                <h3 class="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Pilih Mode Pencarian</h3>
                <div class="grid grid-cols-2 gap-3">
                    <div onclick="pilihPencarian('qr')" class="bg-white border border-indigo-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm active:scale-95 transition cursor-pointer hover:bg-indigo-50 h-40">
                        <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md"><i data-lucide="scan-line" class="w-5 h-5"></i></div>
                        <div>
                            <h4 class="font-black text-slate-800 text-sm leading-tight">Cari Item QRCode</h4>
                            <p class="text-[10px] font-bold text-slate-400 mt-1">Scan fisik barcode barang</p>
                        </div>
                    </div>
                    
                    <div onclick="pilihPencarian('global')" class="bg-white border border-blue-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm active:scale-95 transition cursor-pointer hover:bg-blue-50 h-40">
                        <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md"><i data-lucide="globe" class="w-5 h-5"></i></div>
                        <div>
                            <h4 class="font-black text-slate-800 text-sm leading-tight">Cari Item Global</h4>
                            <p class="text-[10px] font-bold text-slate-400 mt-1">Ketik variabel & filter</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } 
    // LEVEL 2A: HASIL PENCARIAN QR CODE MOBILE
    else if (mobilePencarianSubMode === 'qr') {
        html += `
            <div class="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-md -mx-4 px-4 py-2.5 border-b border-slate-300 shadow-sm flex items-center justify-between gap-3 mb-3">
                <div class="flex items-center gap-2">
                    <button onclick="pilihPencarian('menu')" class="p-2.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition flex items-center gap-1.5 text-xs font-black text-slate-700 shrink-0">
                        <i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i> Menu
                    </button>
                    <button onclick="muatDataStok()" class="p-2.5 bg-teal-700 hover:bg-teal-800 active:scale-95 text-white rounded-xl shadow-sm transition flex items-center gap-1 text-xs font-black shrink-0">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i> Refresh
                    </button>
                </div>
                <button onclick="pilihPencarian('qr')" class="px-3.5 py-2 bg-indigo-600 text-white font-black text-xs uppercase rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition"><i data-lucide="scan-line" class="w-3.5 h-3.5"></i> Scan Ulang</button>
            </div>
        `;

        if (searchedQRResults.length === 0) {
            html += `
                <div class="flex flex-col items-center justify-center h-56 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
                    <i data-lucide="package-search" class="w-12 h-12 text-slate-300 mb-2"></i>
                    <h4 class="font-bold text-slate-700 text-sm">Belum ada QR Code di-scan</h4>
                    <button onclick="pilihPencarian('qr')" class="mt-3 px-5 py-2.5 bg-indigo-600 text-white font-black text-xs uppercase rounded-xl shadow-md">Mulai Scan</button>
                </div>
            `;
        } else {
            searchedQRResults.forEach((d, idx) => {
                html += `
                    <div class="bg-white border border-slate-300 rounded-2xl p-4 mb-2 shadow-sm flex flex-col">
                        <div class="flex justify-between items-center mb-3 pb-2.5 border-b border-slate-100">
                            <div class="flex items-center gap-2">
                                <span class="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-black flex items-center justify-center">${idx+1}</span>
                                <span class="font-black text-sm text-emerald-700 uppercase">Area: ${d.area}</span>
                            </div>
                            <span class="font-bold px-2.5 py-0.5 text-[10px] rounded-md border ${d.badgeClass} uppercase">${d.status}</span>
                        </div>
                        
                        <div class="font-mono font-black text-slate-900 text-sm break-all bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-center mb-3">
                            ${d.qrcode}
                        </div>

                        <div class="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100 mb-3">
                            <span class="text-[10px] font-black uppercase text-blue-500 block mb-0.5">Detail Item</span>
                            <span class="text-xs font-black text-slate-900 leading-snug">
                                ${d.namaItem} - ${d.panjang} - ${d.grade} - ${d.dus}
                            </span>
                            <span class="text-xs font-bold text-blue-700 block mt-0.5">Shading: ${d.shading}</span>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                            <div class="flex flex-col"><span class="text-[10px] font-black text-slate-400 uppercase">Customer Aktual</span><span class="font-bold text-orange-600">${d.customerAktual}</span></div>
                            <div class="flex flex-col"><span class="text-[10px] font-black text-slate-400 uppercase">Customer Estimasi</span><span class="font-bold text-purple-700">${d.customerEstimasi}</span></div>
                            <div class="flex flex-col col-span-2"><span class="text-[10px] font-black text-slate-400 uppercase">Keterangan</span><span class="font-medium text-slate-700">${d.keterangan}</span></div>
                        </div>
                    </div>
                `;
            });
        }
    }
    // LEVEL 2B: PENCARIAN GLOBAL MOBILE
    else if (mobilePencarianSubMode === 'global') {
        const results = getFilteredGlobalSearchResults();

        html += `
            <div class="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-md -mx-4 px-4 py-2.5 border-b border-slate-300 shadow-sm flex items-center justify-between gap-3 mb-2">
                <div class="flex items-center gap-2">
                    <button onclick="pilihPencarian('menu')" class="p-2.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition flex items-center gap-1.5 text-xs font-black text-slate-700 shrink-0">
                        <i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i> Menu
                    </button>
                    <button onclick="muatDataStok()" class="p-2.5 bg-teal-700 hover:bg-teal-800 active:scale-95 text-white rounded-xl shadow-sm transition flex items-center gap-1 text-xs font-black shrink-0">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i> Refresh
                    </button>
                </div>
                <span class="text-xs font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">${results.length} Dus Ditemukan</span>
            </div>

            <!-- FORM FILTER KETIK COLLAPSIBLE DENGAN AUTO-COMPLETE (DATALIST) -->
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-3">
                <button type="button" onclick="toggleMobileFilterBox()" class="w-full p-3.5 bg-slate-50 flex justify-between items-center border-b border-slate-100 transition active:bg-slate-100">
                    <span class="text-xs font-black text-slate-700 uppercase flex items-center gap-2"><i data-lucide="filter" class="w-4 h-4 text-blue-600"></i> Filter Pencarian</span>
                    <div class="flex items-center gap-1.5">
                        <span class="text-[10px] font-bold text-slate-400" id="lbl-toggle-status">${isMobileFilterOpen ? 'Tutup' : 'Buka'}</span>
                        <i data-lucide="chevron-up" id="icon-toggle-filter" class="w-4 h-4 text-slate-500 transition-transform ${isMobileFilterOpen ? '' : 'rotate-180'}"></i>
                    </div>
                </button>
                
                <div id="body-mobile-filter" class="p-4 space-y-3 ${isMobileFilterOpen ? '' : 'hidden'}">
                    <div class="grid grid-cols-2 gap-2">
                        <div class="col-span-2">
                            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Nama Item</label>
                            <input type="text" id="m-f-nama" list="dl-nama-item" value="${globalSearchFilters.nama}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Ketik nama item..." class="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 outline-none uppercase focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Panjang</label>
                            <input type="text" id="m-f-pjg" list="dl-panjang" value="${globalSearchFilters.pjg}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Cth: 4M" class="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 outline-none uppercase focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Grade</label>
                            <input type="text" id="m-f-grade" list="dl-grade" value="${globalSearchFilters.grade}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Cth: BAGUS" class="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 outline-none uppercase focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Dus</label>
                            <input type="text" id="m-f-dus" list="dl-dus" value="${globalSearchFilters.dus}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Ketik merk..." class="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 outline-none uppercase focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Shading</label>
                            <input type="text" id="m-f-shading" list="dl-shading" value="${globalSearchFilters.shading}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Ketik shading..." class="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 outline-none uppercase focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Area</label>
                            <input type="text" id="m-f-area" list="dl-area" value="${globalSearchFilters.area}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Ketik area..." class="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 outline-none uppercase focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Customer Aktual</label>
                            <input type="text" id="m-f-cust" list="dl-cust-aktual" value="${globalSearchFilters.cust}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Ketik customer..." class="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 outline-none uppercase focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Customer Estimasi</label>
                            <input type="text" id="m-f-cust-est" list="dl-cust-estimasi" value="${globalSearchFilters.est}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Ketik customer..." class="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 outline-none uppercase focus:border-blue-500">
                        </div>
                    </div>
                    
                    <div class="flex gap-2 pt-1">
                        <button onclick="resetCariGlobal(false)" class="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase rounded-xl transition active:scale-95">
                            Reset
                        </button>
                        <button onclick="eksekusiCariGlobal(false)" class="w-2/3 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase rounded-xl shadow-md transition flex items-center justify-center gap-2 border-b-4 border-blue-900 active:scale-95">
                            <i data-lucide="search" class="w-4 h-4"></i> TAMPILKAN HASIL
                        </button>
                    </div>
                </div>
            </div>
        `;

        if (!hasExecutedGlobalSearch) {
            html += `
                <div class="flex flex-col items-center justify-center h-48 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
                    <i data-lucide="filter" class="w-10 h-10 text-slate-300 mb-2"></i>
                    <h4 class="font-bold text-slate-700 text-sm">Gunakan form di atas untuk mencari</h4>
                    <p class="text-[11px] text-slate-400 mt-1">Ketik variabel yang diinginkan lalu tekan Tampilkan Hasil.</p>
                </div>
            `;
        } else if (results.length === 0) {
            html += `
                <div class="flex flex-col items-center justify-center h-48 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
                    <i data-lucide="package-x" class="w-10 h-10 text-slate-300 mb-2"></i>
                    <h4 class="font-bold text-slate-700 text-sm">Tidak ada item yang cocok</h4>
                </div>
            `;
        } else {
            results.forEach(d => {
                const encodedData = encodeURIComponent(JSON.stringify(d));
                html += `
                    <div onclick="bukaDetailQRGlobal('${encodedData}')" class="bg-white border border-slate-300 rounded-2xl p-4 mb-2 shadow-sm flex flex-col active:scale-98 transition cursor-pointer hover:border-indigo-400">
                        <div class="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                            <span class="font-black text-sm text-emerald-700 uppercase">Area: ${d.area}</span>
                            <div class="flex items-center gap-1.5">
                                <span class="font-black text-sm text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">${d.qty} Dus</span>
                                <span class="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center gap-1"><i data-lucide="qr-code" class="w-3 h-3"></i> Lihat QR</span>
                            </div>
                        </div>
                        
                        <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-3">
                            <span class="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Detail Item</span>
                            <span class="text-xs font-black text-slate-900 leading-snug">
                                ${d.nama} - ${d.pjg} - ${d.grade} - ${d.dus}
                            </span>
                            <span class="text-xs font-bold text-indigo-700 block mt-0.5">Shading: ${d.shading}</span>
                        </div>

                        <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            <div class="flex flex-col"><span class="text-[10px] font-black text-slate-400 uppercase">Customer Aktual</span><span class="font-bold text-orange-600">${d.po_aktual}</span></div>
                            <div class="flex flex-col"><span class="text-[10px] font-black text-slate-400 uppercase">Customer Estimasi</span><span class="font-bold text-purple-700">${d.customer_estimasi}</span></div>
                            <div class="flex flex-col col-span-2 mt-1"><span class="text-[10px] font-black text-slate-400 uppercase">Keterangan</span><span class="font-medium text-slate-600">${d.keterangan || '-'}</span></div>
                        </div>
                    </div>
                `;
            });
        }
    }

    container.innerHTML = html;
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// RENDER PENCARIAN PC (DESKTOP)
// ==========================================
function renderDesktopPencarian() {
    const container = document.getElementById('view-pencarian-desktop');
    if(!container) return;

    let html = `
        <!-- SUB-NAVIGASI DESKTOP -->
        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4 shrink-0">
            <div class="flex items-center gap-2">
                <button onclick="pilihPencarian('global')" class="px-5 py-2.5 ${desktopPencarianSubMode === 'global' ? 'bg-blue-600 text-white font-black' : 'bg-slate-100 text-slate-600 font-bold hover:bg-slate-200'} rounded-lg text-xs uppercase transition flex items-center gap-2">
                    <i data-lucide="globe" class="w-4 h-4"></i> Cari Item Global
                </button>
                <button onclick="pilihPencarian('qr')" class="px-5 py-2.5 ${desktopPencarianSubMode === 'qr' ? 'bg-indigo-600 text-white font-black' : 'bg-slate-100 text-slate-600 font-bold hover:bg-slate-200'} rounded-lg text-xs uppercase transition flex items-center gap-2">
                    <i data-lucide="scan-line" class="w-4 h-4"></i> Cari Item QRCode
                </button>
            </div>
            ${desktopPencarianSubMode === 'qr' ? `
                <div class="flex items-center gap-2">
                    <button onclick="muatDataStok()" class="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs uppercase rounded-lg transition flex items-center gap-1.5"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Refresh</button>
                    <button onclick="pilihPencarian('qr')" class="px-4 py-2 bg-indigo-600 text-white font-black text-xs uppercase rounded-lg shadow-sm flex items-center gap-1.5"><i data-lucide="scan-line" class="w-4 h-4"></i> Scan Ulang</button>
                </div>
            ` : `
                <div class="flex items-center gap-2">
                    <button onclick="resetCariGlobal(true)" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase rounded-lg transition">Reset</button>
                    <button onclick="eksekusiCariGlobal(true)" class="px-5 py-2 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase rounded-lg shadow-sm transition flex items-center gap-1.5 border-b-2 border-black"><i data-lucide="search" class="w-4 h-4"></i> Terapkan Pencarian</button>
                    <button onclick="muatDataStok()" class="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs uppercase rounded-lg transition flex items-center gap-1.5 ml-1"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Refresh</button>
                </div>
            `}
        </div>
    `;

    if (desktopPencarianSubMode === 'global') {
        const results = getFilteredGlobalSearchResults();

        html += `
            <!-- BILAH FILTER KETIK AUTO-COMPLETE DESKTOP -->
            <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-4 lg:grid-cols-8 gap-2 shrink-0">
                <div>
                    <label class="block text-[9px] font-black uppercase text-slate-400 mb-1">Nama Item</label>
                    <input type="text" id="pc-f-nama" list="dl-nama-item" value="${globalSearchFilters.nama}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Ketik Item..." class="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg bg-slate-50 outline-none uppercase focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-[9px] font-black uppercase text-slate-400 mb-1">Panjang</label>
                    <input type="text" id="pc-f-pjg" list="dl-panjang" value="${globalSearchFilters.pjg}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Cth: 4M" class="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg bg-slate-50 outline-none uppercase focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-[9px] font-black uppercase text-slate-400 mb-1">Grade</label>
                    <input type="text" id="pc-f-grade" list="dl-grade" value="${globalSearchFilters.grade}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Cth: BAGUS" class="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg bg-slate-50 outline-none uppercase focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-[9px] font-black uppercase text-slate-400 mb-1">Dus</label>
                    <input type="text" id="pc-f-dus" list="dl-dus" value="${globalSearchFilters.dus}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Ketik Merk..." class="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg bg-slate-50 outline-none uppercase focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-[9px] font-black uppercase text-slate-400 mb-1">Shading</label>
                    <input type="text" id="pc-f-shading" list="dl-shading" value="${globalSearchFilters.shading}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Ketik Shading..." class="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg bg-slate-50 outline-none uppercase focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-[9px] font-black uppercase text-slate-400 mb-1">Area</label>
                    <input type="text" id="pc-f-area" list="dl-area" value="${globalSearchFilters.area}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Ketik Area..." class="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg bg-slate-50 outline-none uppercase focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-[9px] font-black uppercase text-slate-400 mb-1">Cust Aktual</label>
                    <input type="text" id="pc-f-cust" list="dl-cust-aktual" value="${globalSearchFilters.cust}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Ketik Cust..." class="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg bg-slate-50 outline-none uppercase focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-[9px] font-black uppercase text-slate-400 mb-1">Cust Estimasi</label>
                    <input type="text" id="pc-f-cust-est" list="dl-cust-estimasi" value="${globalSearchFilters.est}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" placeholder="Ketik Est..." class="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg bg-slate-50 outline-none uppercase focus:border-blue-500">
                </div>
            </div>

            <!-- TABEL HASIL PENCARIAN GLOBAL DESKTOP -->
            <div class="flex-1 min-h-0 overflow-y-auto custom-scroll table-container bg-white rounded-xl shadow-sm border border-slate-300">
                <table class="w-full text-left whitespace-nowrap">
                    <thead class="sticky top-0 z-40 bg-slate-800 text-white shadow-sm">
                        <tr>
                            <th class="hdr-std w-12 text-center">No</th>
                            <th class="hdr-std w-12 text-center">Detail QR</th>
                            <th class="hdr-std">Area</th>
                            <th class="hdr-std">Jenis Item</th>
                            <th class="hdr-std">Nama Item</th>
                            <th class="hdr-std">Panjang</th>
                            <th class="hdr-std">Grade</th>
                            <th class="hdr-std">Dus</th>
                            <th class="hdr-std">Shading</th>
                            <th class="hdr-std">Customer Aktual</th>
                            <th class="hdr-std text-purple-300">Customer Estimasi</th>
                            <th class="hdr-std">Keterangan</th>
                            <th class="hdr-std text-emerald-400 text-center">Total Qty (Dus)</th>
                        </tr>
                    </thead>
                    <tbody class="text-slate-700">
                        ${!hasExecutedGlobalSearch ? `
                            <tr><td colspan="13" class="p-12 text-center font-bold text-slate-400">Ketik variabel pada kolom di atas lalu klik "Terapkan Pencarian".</td></tr>
                        ` : (results.length === 0 ? `
                            <tr><td colspan="13" class="p-12 text-center font-bold text-slate-400">Tidak ada stok yang cocok dengan kriteria pencarian.</td></tr>
                        ` : results.map((d, i) => {
                            const encodedData = encodeURIComponent(JSON.stringify(d));
                            return `
                            <tr class="transition text-[13px] border-b border-slate-200 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50">
                                <td class="px-4 py-3 font-bold text-slate-400 text-center">${i+1}</td>
                                <td class="px-4 py-3 text-center">
                                    <button onclick="bukaDetailQRGlobal('${encodedData}')" class="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition shadow-sm flex items-center justify-center mx-auto" title="Lihat Rincian QR Code">
                                        <i data-lucide="qr-code" class="w-4 h-4"></i>
                                    </button>
                                </td>
                                <td class="px-4 py-3 font-semibold text-slate-800 text-left">${d.area}</td>
                                <td class="px-4 py-3 font-medium text-slate-700 text-left">${d.jenis}</td>
                                <td class="px-4 py-3 font-semibold text-slate-900 text-left">${d.nama}</td>
                                <td class="px-4 py-3 font-medium text-slate-700 text-center">${d.pjg}</td>
                                <td class="px-4 py-3 font-medium text-slate-700 text-center">${d.grade}</td>
                                <td class="px-4 py-3 font-medium text-slate-700 text-center">${d.dus}</td>
                                <td class="px-4 py-3 font-medium text-slate-700 text-center">${d.shading}</td>
                                <td class="px-4 py-3 font-semibold text-slate-900 text-left">${d.po_aktual}</td>
                                <td class="px-4 py-3 font-semibold text-purple-700 text-left">${d.customer_estimasi}</td>
                                <td class="px-4 py-3 font-medium text-slate-500 text-left">${d.keterangan || '-'}</td>
                                <td class="px-4 py-3 font-black text-emerald-700 text-center text-sm">${d.qty}</td>
                            </tr>`;
                        }).join(''))}
                    </tbody>
                </table>
            </div>
        `;
    } else {
        // TABEL HASIL PENCARIAN QR CODE DESKTOP
        html += `
            <div class="flex-1 min-h-0 overflow-y-auto custom-scroll table-container bg-white rounded-xl shadow-sm border border-slate-300">
                <table class="w-full text-left whitespace-nowrap">
                    <thead class="sticky top-0 z-40 bg-slate-800 text-white shadow-sm">
                        <tr>
                            <th class="hdr-std w-12 text-center">No</th>
                            <th class="hdr-std">Area</th>
                            <th class="hdr-std">QRCode</th>
                            <th class="hdr-std">Tgl Produksi</th>
                            <th class="hdr-std">Mesin</th>
                            <th class="hdr-std">Shift</th>
                            <th class="hdr-std">Nama Item</th>
                            <th class="hdr-std">Panjang</th>
                            <th class="hdr-std">Grade</th>
                            <th class="hdr-std">Dus</th>
                            <th class="hdr-std">Shading</th>
                            <th class="hdr-std">Customer Aktual</th>
                            <th class="hdr-std text-purple-300">Customer Estimasi</th>
                            <th class="hdr-std">Keterangan</th>
                            <th class="hdr-std text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody class="text-slate-700">
                        ${searchedQRResults.length === 0 ? `
                            <tr><td colspan="15" class="p-12 text-center font-bold text-slate-400">Belum ada QR Code yang dicari. Klik tombol "Cari Item QRCode" untuk mulai scan.</td></tr>
                        ` : searchedQRResults.map((d, i) => `
                            <tr class="transition text-[13px] border-b border-slate-200 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50">
                                <td class="px-4 py-3 font-bold text-slate-400 text-center">${i+1}</td>
                                <td class="px-4 py-3 font-semibold text-emerald-700 text-left">${d.area}</td>
                                <td class="px-4 py-3 font-mono font-bold text-slate-900 text-left">${d.qrcode}</td>
                                <td class="px-4 py-3 font-medium text-slate-700 text-center">${d.tglProduksi}</td>
                                <td class="px-4 py-3 font-medium text-slate-700 text-center">${d.mesin}</td>
                                <td class="px-4 py-3 font-medium text-slate-700 text-center">${d.shift}</td>
                                <td class="px-4 py-3 font-semibold text-slate-900 text-left">${d.namaItem}</td>
                                <td class="px-4 py-3 font-medium text-slate-700 text-center">${d.panjang}</td>
                                <td class="px-4 py-3 font-medium text-slate-700 text-center">${d.grade}</td>
                                <td class="px-4 py-3 font-medium text-slate-700 text-center">${d.dus}</td>
                                <td class="px-4 py-3 font-medium text-slate-700 text-center">${d.shading}</td>
                                <td class="px-4 py-3 font-semibold text-slate-900 text-left">${d.customerAktual}</td>
                                <td class="px-4 py-3 font-semibold text-purple-700 text-left">${d.customerEstimasi}</td>
                                <td class="px-4 py-3 font-medium text-slate-500 text-left">${d.keterangan || '-'}</td>
                                <td class="px-4 py-3 text-center"><span class="px-2.5 py-0.5 rounded text-[10px] font-bold border ${d.badgeClass}">${d.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    container.innerHTML = html;
    if(typeof lucide !== 'undefined') lucide.createIcons();
}
