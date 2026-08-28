let dataKeluar = []; 
let deletedKeluarStack = []; 
let masterKamus = [];
let globalRowId = 0;

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

function formatPanjang(pjg) {
    if (!pjg || pjg === '-') return '-';
    let str = String(pjg).trim().toUpperCase();
    if (!str.endsWith('M')) str += 'M';
    return str;
}

document.addEventListener('DOMContentLoaded', async () => { 
    initModernLayout({ id: 'keluar', title: 'BARANG KELUAR', url: 'keluar.html' }); 
    
    document.body.style.overflow = 'hidden';
    const wmsMain = document.querySelector('main');
    if(wmsMain) {
        wmsMain.style.overflow = 'hidden';
        wmsMain.style.padding = '0'; 
    }

    document.addEventListener('click', function(e) {
        const dropupMore = document.getElementById('dropup-more');
        if (dropupMore && !dropupMore.classList.contains('hidden') && !e.target.closest('.relative')) {
            dropupMore.classList.add('hidden');
        }
    });

    await loadInitialData();
});

window.toggleMoreMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('dropup-more');
    if(menu) menu.classList.toggle('hidden');
};

window.bukaModalAdd = function() {
    document.getElementById('input-qrcode').value = '';
    document.getElementById('modal-add-scan').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-qrcode').focus(), 100);
};

window.tutupModalAdd = function() {
    document.getElementById('modal-add-scan').classList.add('hidden');
};

// ==========================================
// LOGIKA CANCEL KELUAR (SCAN KE HOLD)
// ==========================================
window.bukaModalCancelKeluar = function() {
    document.getElementById('input-qr-cancel').value = '';
    document.getElementById('modal-cancel-keluar').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-qr-cancel').focus(), 100);
};

window.tutupModalCancelKeluar = function() {
    document.getElementById('modal-cancel-keluar').classList.add('hidden');
};

window.prosesCancelKeluarScan = async function() {
    const rawInput = document.getElementById('input-qr-cancel').value.trim();
    if(!rawInput) return alert("Masukkan QR Code terlebih dahulu!");

    const qrs = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
    
    if(!confirm(`Yakin ingin membatalkan (Cancel) ${qrs.length} item ini?\nItem akan dipindahkan dari Stok Keluar ke tabel Hold Keluar.`)) return;

    const btn = document.getElementById('btn-proses-cancel-scan');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...';
    btn.disabled = true;

    try {
        const { error } = await db.rpc('cancel_keluar_to_hold', {
            p_qrs: qrs,
            p_pic: currentUser.username
        });

        if (error) throw error;

        alert(`✅ SUKSES!\n${qrs.length} item berhasil dipindahkan ke tabel Hold Keluar.`);
        tutupModalCancelKeluar();
    } catch (e) {
        alert("Gagal memproses cancel: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
};

async function loadInitialData() {
    try {
        const { data: mData2 } = await db.from('master_2').select('*');
        if(mData2) {
            masterKamus = mData2;
            if(!window.masterData) window.masterData = {};
            window.masterData.kamus = mData2; 
            
            const customers = [...new Set(mData2.map(r => r.customer).filter(x => x))].sort();
            const sel = document.getElementById('select-customer-keluar');
            sel.innerHTML = '<option value="">-- Pilih Customer Tujuan --</option>';
            customers.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
        }
    } catch (err) { console.error("Gagal muat referensi:", err); }
}

document.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'form-scan') {
        e.preventDefault();
        const customerKeluar = document.getElementById('select-customer-keluar').value;
        const tripInput = document.getElementById('input-trip').value.trim();
        const inputEl = document.getElementById('input-qrcode');
        const rawInput = inputEl.value.trim();
        
        if(!customerKeluar) return alert("Pilih Customer Keluar (Tujuan) terlebih dahulu!");
        if(!tripInput) return alert("Masukkan Trip ke berapa!");
        if(!rawInput) return;

        const tripFormatted = "Trip " + tripInput;
        const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
        
        codes.forEach(code => {
            const isLocalDuplicate = dataKeluar.some(d => d.qrcode === code);
            const trans = window.translateBarcode(code);
            
            dataKeluar.unshift({ 
                id: ++globalRowId, 
                qrcode: code, 
                customer_keluar: customerKeluar,
                trip: tripFormatted,
                keterangan: '-', 
                status_verif: isLocalDuplicate ? 'DUPLIKAT SCAN' : 'BELUM CEK', 
                area: '-',
                customer_aktual_db: '-',
                customer_estimasi_db: '-',
                id_sku: '-',
                need_pinjam_aktual: false,
                is_pinjam_aktual: false,
                need_pinjam_estimasi: false,
                pinjam_estimasi_selected: '',
                available_estimasi: [],
                isLocalDuplicate: isLocalDuplicate,
                ...trans 
            });
        });
        
        renderTable();
        
        inputEl.value = ''; 
        inputEl.focus();
        
        const scrollContainer = document.getElementById('scroll-container');
        if (scrollContainer) scrollContainer.scrollTop = 0;
    }
});

function getMatchingGroup(item) {
    return dataKeluar.filter(d => 
        d.status_verif === 'VERIFIED' &&
        d.namaItem === item.namaItem &&
        d.panjang === item.panjang &&
        d.grade === item.grade &&
        d.dus === item.dus &&
        d.shading === item.shading &&
        d.area === item.area &&
        d.customer_aktual_db === item.customer_aktual_db &&
        d.customer_keluar === item.customer_keluar &&
        d.trip === item.trip
    );
}

function renderTable() {
    const tbody = document.getElementById('tbody-keluar');
    if(dataKeluar.length === 0) {
        tbody.innerHTML = '<div class="p-10 text-center font-medium text-slate-400 h-full flex flex-col items-center justify-center"><i data-lucide="package-search" class="w-12 h-12 mx-auto mb-3 opacity-30"></i> Belum ada data di-scan.</div>';
        document.getElementById('lbl-tampil-baris').innerText = '0';
        updateFilterDropdowns(); 
        lucide.createIcons(); return;
    }
    
    let html = '';
    let count = dataKeluar.length;

    dataKeluar.forEach((d) => {
        let badgeClass = "bg-slate-200 text-slate-700 border-slate-300";
        let displayStatus = d.status_verif;

        if(d.status_verif === 'VERIFIED') {
            badgeClass = "bg-emerald-600 text-white border-emerald-700"; 
        } 
        else if(d.status_verif === 'TIDAK DITEMUKAN' || d.status_verif === 'DUPLIKAT SCAN' || d.status_verif === 'DUPLIKAT KELUAR') {
            badgeClass = "bg-red-600 text-white border-red-800"; 
        }

        const isRedHighlight = d.status_verif === 'TIDAK DITEMUKAN' || d.status_verif === 'DUPLIKAT SCAN' || d.status_verif === 'DUPLIKAT KELUAR';
        const rowClass = isRedHighlight ? 'bg-red-50 border-red-200' : 'bg-white border-slate-300';

        let matchingItems = getMatchingGroup(d);
        let groupCount = matchingItems.length;

        let pinjamHtml = '';
        if (d.status_verif === 'VERIFIED') {
            if (d.need_pinjam_aktual) {
                if (d.is_pinjam_aktual) {
                    pinjamHtml = `
                        <div class="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-orange-50 border border-orange-200 p-2.5 rounded-xl gap-2">
                            <div class="flex flex-col">
                                <span class="text-xs font-black text-orange-800">Pinjam Aktual (Potong Est: ${d.pinjam_estimasi_selected})</span>
                                ${groupCount > 1 ? `<span class="text-[10px] font-bold text-orange-600">📦 Terhubung ke ${groupCount} kardus serupa</span>` : ''}
                            </div>
                            <button onclick="togglePinjamAktual(${d.id})" class="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] rounded-lg transition uppercase active:scale-95 shrink-0">Batal Pinjam</button>
                        </div>`;
                } else {
                    pinjamHtml = `
                        <div class="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                            <div class="flex justify-between items-center mb-2">
                                <p class="text-xs text-orange-800 font-black">Customer Aktual Berbeda (${d.customer_aktual_db})</p>
                                ${groupCount > 1 ? `<span class="text-[10px] font-black bg-orange-200 text-orange-900 px-2 py-0.5 rounded-full">${groupCount} Dus Serupa</span>` : ''}
                            </div>
                            <button onclick="togglePinjamAktual(${d.id})" class="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-lg shadow-sm transition uppercase active:scale-95 flex items-center justify-center gap-1.5">
                                <i data-lucide="check-circle" class="w-4 h-4"></i> Pinjam Customer Aktual ${groupCount > 1 ? `(${groupCount} Dus)` : ''}
                            </button>
                        </div>`;
                }
            } else if (d.need_pinjam_estimasi) {
                if (d.pinjam_estimasi_selected) {
                    pinjamHtml = `
                        <div class="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl gap-2">
                            <div class="flex flex-col">
                                <span class="text-xs font-black text-indigo-800">Dipinjam dari Est: ${d.pinjam_estimasi_selected}</span>
                                ${groupCount > 1 ? `<span class="text-[10px] font-bold text-indigo-600">📦 Terhubung ke ${groupCount} kardus serupa</span>` : ''}
                            </div>
                            <button onclick="bukaModalPinjamEstimasi(${d.id}, false)" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg transition uppercase active:scale-95 shrink-0">Ubah</button>
                        </div>`;
                } else {
                    pinjamHtml = `
                        <div class="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                            <div class="flex justify-between items-center mb-2">
                                <p class="text-xs text-indigo-800 font-black">Customer Estimasi Berbeda</p>
                                ${groupCount > 1 ? `<span class="text-[10px] font-black bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded-full">${groupCount} Dus Serupa</span>` : ''}
                            </div>
                            <button onclick="bukaModalPinjamEstimasi(${d.id}, false)" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-lg shadow-sm transition uppercase active:scale-95 flex items-center justify-center gap-1.5">
                                <i data-lucide="users" class="w-4 h-4"></i> Pilih Pinjam Customer ${groupCount > 1 ? `(${groupCount} Dus)` : ''}
                            </button>
                        </div>`;
                }
            }
        }

        html += `
            <div class="row-keluar ${rowClass} border rounded-xl p-4 mb-3 relative transition w-full flex flex-col shadow-sm">
                
                <div class="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-lg shadow-inner">${count--}</div>
                        <div class="flex flex-col">
                            <span class="font-black text-xl text-rose-700 leading-none uppercase col-cust-keluar">${d.customer_keluar}</span>
                            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Customer Tujuan</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <input type="checkbox" value="${d.id}" onchange="highlightRow(this)" class="row-cb cursor-pointer w-5 h-5 accent-blue-600 rounded bg-white border-slate-400">
                        <button onclick="hapusBaris(${d.id})" class="bg-slate-100 text-slate-500 p-2 rounded-lg hover:bg-rose-600 hover:text-white transition active:scale-95 shrink-0 border border-slate-200"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
                
                <div class="flex flex-col gap-1 mb-3">
                    <div class="font-mono font-black text-slate-900 text-base break-all leading-tight bg-slate-100 p-2 rounded-lg border border-slate-200 text-center col-qr">${d.qrcode}</div>
                </div>
                
                <div class="grid grid-cols-2 gap-x-2 gap-y-3 mb-3">
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-slate-400 uppercase">Produksi</span>
                        <span class="text-sm font-bold text-slate-700">${d.tglProduksi} - ${d.mesin} - ${d.shift}</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-slate-400 uppercase">Area Gudang</span>
                        <span class="text-sm font-black text-emerald-700 uppercase">${d.area}</span>
                    </div>
                    <div class="flex flex-col col-span-2 bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <span class="text-[10px] font-black text-blue-500 uppercase mb-0.5">Spesifikasi Item</span>
                        <span class="text-base font-black text-slate-900 leading-snug">
                            <span class="col-nama">${d.namaItem}</span> - <span class="col-pjg">${d.panjang}</span> - <span class="col-grade">${d.grade}</span> - <span class="col-dus">${d.dus}</span>
                            <span class="col-jenis hidden">${d.jenisItem}</span>
                        </span>
                        <span class="text-xs font-bold text-blue-700 mt-0.5">Shading: <span class="col-shading">${d.shading}</span></span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-slate-400 uppercase">Cust Aktual</span>
                        <span class="text-sm font-bold text-orange-600 uppercase col-cust-aktual">${d.customer_aktual_db !== '-' ? d.customer_aktual_db : d.customerBawaan}</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-slate-400 uppercase">Cust Estimasi</span>
                        <span class="text-sm font-bold text-purple-600 uppercase col-cust-estimasi">${d.customer_estimasi_db}</span>
                    </div>
                    <div class="flex flex-col col-span-2">
                        <span class="text-[10px] font-black text-slate-400 uppercase">Trip Pengiriman</span>
                        <span class="text-sm font-bold text-slate-700 col-trip">${d.trip}</span>
                    </div>
                </div>
                
                <div class="flex flex-row justify-start items-center mt-auto pt-2 border-t border-slate-100">
                    <span class="font-bold px-3 py-1.5 text-xs rounded-md border col-status ${badgeClass} shadow-sm">${displayStatus}</span>
                </div>

                ${pinjamHtml}
            </div>
        `;
    });
    tbody.innerHTML = html; 
    document.getElementById('lbl-tampil-baris').innerText = dataKeluar.length;
    
    updateFilterDropdowns(); 
    lucide.createIcons(); 
}

function updateFilterDropdowns() {
    const fields = {
        'fs-status': 'status_verif', 
        'fs-cust-keluar': 'customer_keluar',
        'fs-trip': 'trip',
        'fs-cust-aktual': 'customer_aktual_db',
        'fs-cust-estimasi': 'customer_estimasi_db',
        'fs-jenis': 'jenisItem',
        'fs-nama': 'namaItem',
        'fs-pjg': 'panjang',
        'fs-grade': 'grade',
        'fs-dus': 'dus',
        'fs-shading': 'shading'
    };

    for (let id in fields) {
        const select = document.getElementById(id);
        if (!select) continue;
        
        const currentVal = select.value; 
        const key = fields[id];
        
        let uniqueVals = [...new Set(dataKeluar.map(item => item[key] || '-'))].sort();
        
        let html = '<option value="">-- Semua --</option>';
        uniqueVals.forEach(val => { html += `<option value="${val}">${val}</option>`; });
        
        select.innerHTML = html;
        if (uniqueVals.includes(currentVal)) select.value = currentVal;
    }
}

function highlightRow(cb) {
    const div = cb.closest('.row-keluar');
    if (div) {
        if (cb.checked) div.classList.add('border-blue-500', 'bg-blue-50');
        else div.classList.remove('border-blue-500', 'bg-blue-50');
    }
}

function toggleAll(checked) { 
    document.querySelectorAll('.row-cb').forEach(cb => {
        const row = cb.closest('.row-keluar');
        if (row && row.style.display !== 'none') {
            cb.checked = checked;
            highlightRow(cb);
        }
    }); 
}

function hapusBaris(id) {
    const removed = dataKeluar.find(d => d.id === id);
    if(removed) {
        deletedKeluarStack.push([removed]);
        dataKeluar = dataKeluar.filter(d => d.id !== id);
        renderTable();
    }
}

window.undoHapusKeluar = function() {
    if(deletedKeluarStack.length === 0) return alert("Tidak ada histori penghapusan yang dapat di-undo.");
    const last = deletedKeluarStack.pop();
    dataKeluar = [...last, ...dataKeluar]; 
    renderTable();
};

window.toggleSidebarFilter = function() {
    document.getElementById('sidebar-filter').classList.toggle('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.toggle('hidden');
};

window.tutupPopups = function() {
    document.getElementById('sidebar-filter').classList.add('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    window.tutupModalAdd();
    window.tutupModalCancelKeluar();
    window.tutupModalPinjamEstimasi();
};

window.resetFilterKeluar = function() {
    const ids = ['fs-status','fs-cust-keluar','fs-trip','fs-cust-aktual','fs-cust-estimasi','fs-qr','fs-jenis','fs-nama','fs-pjg','fs-grade','fs-dus','fs-shading'];
    ids.forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    window.saringTabelKeluar(); window.toggleSidebarFilter();
};

window.saringTabelKeluar = function() {
    const f = {
        status: document.getElementById('fs-status')?.value || '',
        cust: document.getElementById('fs-cust-keluar')?.value || '',
        trip: document.getElementById('fs-trip')?.value || '',
        custAktual: document.getElementById('fs-cust-aktual')?.value || '',
        custEstimasi: document.getElementById('fs-cust-estimasi')?.value || '',
        qr: document.getElementById('fs-qr')?.value.toLowerCase() || '',
        jenis: document.getElementById('fs-jenis')?.value || '',
        nama: document.getElementById('fs-nama')?.value || '',
        pjg: document.getElementById('fs-pjg')?.value || '',
        grade: document.getElementById('fs-grade')?.value || '',
        dus: document.getElementById('fs-dus')?.value || '',
        shading: document.getElementById('fs-shading')?.value || ''
    };

    let visibleCount = 0;
    document.querySelectorAll('.row-keluar').forEach(row => {
        let show = true;
        
        const exactFields = ['status', 'cust', 'trip', 'custAktual', 'custEstimasi', 'jenis', 'nama', 'pjg', 'grade', 'dus', 'shading'];
        const classMap = { status: 'col-status', cust: 'col-cust-keluar', trip: 'col-trip', custAktual: 'col-cust-aktual', custEstimasi: 'col-cust-estimasi', jenis: 'col-jenis', nama: 'col-nama', pjg: 'col-pjg', grade: 'col-grade', dus: 'col-dus', shading: 'col-shading' };
        
        for(let key of exactFields) {
            if(f[key]) {
                const cell = row.querySelector('.' + classMap[key]);
                if(cell) {
                    let text = cell.innerText.trim();
                    if(text !== f[key]) { show = false; break; }
                }
            }
        }

        if(show && f.qr) {
            const cell = row.querySelector('.col-qr');
            if(cell && !cell.innerText.toLowerCase().includes(f.qr)) show = false;
        }

        row.style.display = show ? 'flex' : 'none';
        if(show) visibleCount++;
    });
    document.getElementById('lbl-tampil-baris').innerText = visibleCount;
};

// ==========================================
// VERIFIKASI GUDANG & PINJAM CUSTOMER (BATCH OTOMATIS)
// ==========================================
window.verifikasiKeluar = async function() {
    if(dataKeluar.length === 0) return alert("Belum ada data.");
    const btn = document.getElementById('btn-verifikasi'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 sm:w-5 sm:h-5"></i> Cek...'; btn.disabled = true;

    const allQRs = dataKeluar.map(d => d.qrcode);
    try {
        const [resGlobal, resHasil, resKeluar] = await Promise.all([
            db.from('stok_global').select('qrcode, area, customer_aktual, id_sku').in('qrcode', allQRs),
            db.from('hasil_stbj_langsir').select('qrcode, posisi, customer').in('qrcode', allQRs),
            db.from('stok_keluar').select('qrcode').in('qrcode', allQRs)
        ]);

        if(resGlobal.error) throw resGlobal.error;
        if(resHasil.error) throw resHasil.error;
        if(resKeluar.error) throw resKeluar.error;

        const globalMap = {}; resGlobal.data.forEach(d => globalMap[d.qrcode] = d);
        const hasilMap = {}; resHasil.data.forEach(d => hasilMap[d.qrcode] = d);
        const keluarMap = {}; resKeluar.data.forEach(d => keluarMap[d.qrcode] = true);

        let specsToCheck = new Set();

        dataKeluar.forEach(d => {
            if (d.isLocalDuplicate) return;

            if (keluarMap[d.qrcode]) {
                d.status_verif = 'DUPLIKAT KELUAR';
                d.area = '-';
                d.customer_aktual_db = '-';
                d.customer_estimasi_db = '-';
                return;
            }

            let foundInGlobal = globalMap[d.qrcode];
            let foundInHasil = hasilMap[d.qrcode];

            if (foundInGlobal || foundInHasil) {
                d.status_verif = 'VERIFIED';
                d.area = foundInGlobal ? foundInGlobal.area : foundInHasil.posisi;
                d.customer_aktual_db = foundInGlobal ? foundInGlobal.customer_aktual : foundInHasil.customer;
                d.id_sku = foundInGlobal ? foundInGlobal.id_sku : '-';
                
                d.panjang = formatPanjang(d.panjang);

                // Cek Kesesuaian Customer
                if (d.customer_keluar !== d.customer_aktual_db) {
                    d.need_pinjam_aktual = true;
                    d.need_pinjam_estimasi = false;
                    specsToCheck.add(`${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${d.customer_aktual_db}`);
                } else {
                    d.need_pinjam_aktual = false;
                    d.need_pinjam_estimasi = true; 
                    specsToCheck.add(`${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${d.customer_aktual_db}`);
                }
            } else {
                d.status_verif = 'TIDAK DITEMUKAN';
                d.customer_aktual_db = '-';
                d.customer_estimasi_db = '-';
            }
        });

        // Cek Customer Estimasi untuk yang lolos Aktual
        if (specsToCheck.size > 0) {
            let estimasiMap = {};
            for (let spec of specsToCheck) {
                let parts = spec.split('_');
                const { data: actData } = await db.from('stok_aktual').select('customer_estimasi, qty')
                    .eq('nama_item', parts[0]).eq('panjang', parts[1]).eq('grade', parts[2])
                    .eq('dus', parts[3]).eq('shading', parts[4]).eq('area', parts[5])
                    .eq('customer_aktual', parts[6]).gt('qty', 0);
                
                if (actData) {
                    let grouped = {};
                    actData.forEach(a => {
                        grouped[a.customer_estimasi] = (grouped[a.customer_estimasi] || 0) + a.qty;
                    });
                    estimasiMap[spec] = Object.keys(grouped).map(k => ({ customer_estimasi: k, qty: grouped[k] }));
                }
            }

            dataKeluar.forEach(d => {
                if (d.status_verif === 'VERIFIED') {
                    let spec = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${d.customer_aktual_db}`;
                    let availableEst = estimasiMap[spec] || [];
                    d.available_estimasi = availableEst;
                    
                    let estArr = availableEst.map(a => `${a.customer_estimasi} (${a.qty})`);
                    d.customer_estimasi_db = estArr.length > 0 ? estArr.join(' | ') : 'KOSONG';

                    if (d.need_pinjam_estimasi) {
                        let isMatch = availableEst.some(a => a.customer_estimasi === d.customer_keluar);
                        if (isMatch) {
                            d.need_pinjam_estimasi = false; 
                            d.pinjam_estimasi_selected = d.customer_keluar; 
                        }
                    }
                }
            });
        }

        renderTable();
        alert(`✅ Verifikasi Selesai!`);

    } catch (err) { alert("Gagal cek database: " + err.message); }
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
};

window.togglePinjamAktual = function(id) {
    const item = dataKeluar.find(d => d.id === id);
    if(!item) return;

    let matchingGroup = getMatchingGroup(item);

    if (item.is_pinjam_aktual) {
        matchingGroup.forEach(m => {
            m.is_pinjam_aktual = false;
            m.pinjam_estimasi_selected = '';
        });
        renderTable();
    } else {
        if (item.available_estimasi.length === 0) {
            alert("Stok tidak ditemukan di Kartu Stok!");
            return;
        } else if (item.available_estimasi.length === 1) {
            let chosenEst = item.available_estimasi[0].customer_estimasi;
            matchingGroup.forEach(m => {
                m.is_pinjam_aktual = true;
                m.pinjam_estimasi_selected = chosenEst;
            });
            renderTable();
        } else {
            bukaModalPinjamEstimasi(id, true);
        }
    }
};

window.bukaModalPinjamEstimasi = function(id, isPinjamAktual = false) {
    const item = dataKeluar.find(d => d.id === id);
    if(!item) return;

    let matchingGroup = getMatchingGroup(item);

    document.getElementById('pinjam-id-item').value = id;
    document.getElementById('pinjam-is-aktual').value = isPinjamAktual ? 'true' : 'false';
    
    const infoLabel = document.getElementById('lbl-batch-pinjam-info');
    if(infoLabel) {
        infoLabel.innerText = `Pilihan ini akan otomatis diterapkan ke ${matchingGroup.length} kardus serupa di layar.`;
    }

    const sel = document.getElementById('select-pinjam-estimasi');
    if (item.available_estimasi.length === 0) {
        sel.innerHTML = '<option value="">-- Tidak ada stok tersedia --</option>';
    } else {
        sel.innerHTML = '<option value="">-- Pilih Customer Estimasi --</option>';
        item.available_estimasi.forEach(a => {
            sel.innerHTML += `<option value="${a.customer_estimasi}">${a.customer_estimasi} (Tersedia: ${a.qty} Dus)</option>`;
        });
    }

    document.getElementById('modal-pinjam-estimasi').classList.remove('hidden');
};

window.tutupModalPinjamEstimasi = function() {
    document.getElementById('modal-pinjam-estimasi').classList.add('hidden');
};

window.simpanPinjamEstimasi = function() {
    const id = parseInt(document.getElementById('pinjam-id-item').value);
    const isPinjamAktual = document.getElementById('pinjam-is-aktual').value === 'true';
    const selectedEst = document.getElementById('select-pinjam-estimasi').value;
    
    if(!selectedEst) return alert("Pilih Customer Estimasi!");

    const item = dataKeluar.find(d => d.id === id);
    if(item) {
        let matchingGroup = getMatchingGroup(item);
        
        matchingGroup.forEach(m => {
            m.pinjam_estimasi_selected = selectedEst;
            if (isPinjamAktual) {
                m.is_pinjam_aktual = true;
            }
        });

        renderTable();
        tutupModalPinjamEstimasi();
    }
};

// ==========================================
// SIMPAN KELUAR (TRANSAKSI INCREMENTAL AMAN)
// ==========================================
window.simpanKeluar = async function() {
    if(dataKeluar.length === 0) return alert('Data kosong!');
    
    let hasUnverified = false;
    let hasUnresolvedPinjam = false;

    dataKeluar.forEach(d => {
        if (d.status_verif !== 'VERIFIED') hasUnverified = true;
        if (d.need_pinjam_aktual && !d.is_pinjam_aktual) hasUnresolvedPinjam = true;
        if (d.need_pinjam_estimasi && !d.pinjam_estimasi_selected) hasUnresolvedPinjam = true;
    });

    if(hasUnverified) return alert('Terdapat item yang belum diverifikasi, tidak ditemukan, atau duplikat keluar. Hapus baris merah sebelum menyimpan.');
    if(hasUnresolvedPinjam) return alert('Terdapat item yang customernya tidak sesuai dan belum dipinjam. Selesaikan peminjaman customer terlebih dahulu.');

    if(!confirm(`Lanjutkan memproses ${dataKeluar.length} item keluar?`)) return;

    const btn = document.getElementById('btn-save'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMPROSES...'; btn.disabled = true;

    let payloadKeluar = [];
    let payloadPinjam = [];
    let qrsToDelete = [];
    let mapDeductAktual = {};

    dataKeluar.forEach(d => {
        qrsToDelete.push(d.qrcode);

        let targetEstimasiDeduct = d.pinjam_estimasi_selected;
        if (!targetEstimasiDeduct) {
            targetEstimasiDeduct = d.customer_keluar;
        }

        payloadKeluar.push({
            qrcode: d.qrcode,
            id_sku: d.id_sku,
            area: d.area,
            pic_input: currentUser.username,
            tgl_produksi: d.tglProduksi,
            mesin: d.mesin,
            shift: d.shift,
            jenis_item: d.jenisItem,
            nama_item: d.namaItem,
            panjang: d.panjang,
            grade: d.grade,
            dus: d.dus,
            shading: d.shading,
            customer_aktual: d.customer_aktual_db,
            customer_estimasi: targetEstimasiDeduct, 
            keterangan: d.keterangan,
            customer_keluar: d.customer_keluar,
            trip: d.trip
        });

        if (d.is_pinjam_aktual || (d.need_pinjam_estimasi && d.pinjam_estimasi_selected !== d.customer_keluar)) {
            payloadPinjam.push({
                id_sku: d.id_sku,
                qrcode: d.qrcode,
                tgl_produksi: d.tglProduksi,
                mesin: d.mesin,
                shift: d.shift,
                jenis_item: d.jenisItem,
                nama_item: d.namaItem,
                panjang: d.panjang,
                grade: d.grade,
                dus: d.dus,
                shading: d.shading,
                customer_aktual: d.customer_aktual_db,
                customer_estimasi: targetEstimasiDeduct, 
                customer_keluar: d.customer_keluar,
                area: d.area,
                keterangan: d.keterangan,
                pic: currentUser.username
            });
        }

        let keyAkt = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${d.customer_aktual_db}_${targetEstimasiDeduct}`;
        if(!mapDeductAktual[keyAkt]) {
            mapDeductAktual[keyAkt] = {
                nama_item: d.namaItem, panjang: d.panjang, grade: d.grade, dus: d.dus, shading: d.shading,
                area: d.area, customer_aktual: d.customer_aktual_db, customer_estimasi: targetEstimasiDeduct, qty: 0
            };
        }
        mapDeductAktual[keyAkt].qty++;
    });

    const payloadData = {
        qrs_to_delete: qrsToDelete,
        stok_keluar_inserts: payloadKeluar,
        pinjam_inserts: payloadPinjam,
        aktual_deducts: Object.values(mapDeductAktual)
    };

    try {
        const { data, error } = await db.rpc('proses_keluar_transaksi', { payload: payloadData });
        if (error) throw error;

        alert(`✅ BERHASIL DISIMPAN!\n${payloadKeluar.length} Barang telah diproses keluar.`);
        dataKeluar = []; renderTable();
        document.getElementById('cb-all').checked = false;
        
    } catch (err) { 
        alert('GAGAL MENYIMPAN: ' + err.message); 
    } finally { 
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); 
    }
};
