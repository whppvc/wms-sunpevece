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

3. Timpa File riwayat_keluar_logic.js (Membersihkan stok_qr dari Logika Cancel Hold)

Di bawah ini adalah file penuh riwayat_keluar_logic.js yang juga telah saya
bersihkan dari pemanggilan stok_qr pada fungsi eksekusiCancelHold() sehingga
sistem Anda menjadi 100% konsisten:

const isMobileDevice = window.innerWidth < 640;
let modeSekarang = isMobileDevice ? 'mobile' : 'item';

let rawDataRaw = [];
let holdDataRaw = [];
let kamusData = [];
let sortState = {}; 
let globalCheckedCancel = []; 

let activeFilters = {}; 
let currentFilterCol = '';
let currentPage = 1;
let rowsPerPage = 10; 
let selectAllState = 0; 
let userColOrder = []; 
let hiddenCols = []; 

let mobileLevel = 1; 
let mobileSelectedCust = '';
let mobileSelectedTrip = '';
let mobileSelectedItem = '';
let mobileSelectedShading = '';

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

function getTodayDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatPanjang(pjg) {
    if (!pjg || pjg === '-') return '-';
    let str = String(pjg).trim().toUpperCase();
    if (!str.endsWith('M')) str += 'M';
    return str;
}

function formatWIB(isoString) {
    if (!isoString || isoString === '-') return '-';
    try {
        const dt = new Date(isoString);
        if (isNaN(dt.getTime())) return isoString;
        return new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).format(dt).replace(/\./g, ':');
    } catch(e) { return isoString; }
}

async function fetchAllRows(tableName, orderCol = 'created_at') {
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await db
            .from(tableName)
            .select('*')
            .order(orderCol, { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        page++;
    }
    return allData;
}

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_keluar', title: 'RIWAYAT KELUAR', url: 'riwayat_keluar.html' });
    
    const dateInput = document.getElementById('filter-date-mobile');
    if(dateInput) dateInput.value = getTodayDate();

    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                closeFilterMenu();
            }
        }
        
        const actionMenu = document.getElementById('mobile-action-menu');
        if (actionMenu && !actionMenu.classList.contains('hidden')) {
            if (!actionMenu.contains(e.target) && !actionMenu.closest('button[onclick^="toggleActionMenu"]')) {
                actionMenu.classList.add('hidden');
            }
        }
    });

    setTimeout(async () => {
        await loadKamus();
        await loadAreasForCancel(); 
        loadUserPreferences();
        await muatDataDariSupabase();
    }, 200);
});

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

window.toggleSidebarFilter = function() {
    const sidebar = document.getElementById('sidebar-filter');
    const overlay = document.getElementById('overlay-klik-luar');
    sidebar.classList.toggle('translate-x-full');
    overlay.classList.toggle('hidden');
    if (!sidebar.classList.contains('translate-x-full')) {
        updateFilterDropdowns();
    }
};

window.tutupSemuaPopups = function() {
    const sidebar = document.getElementById('sidebar-filter');
    if(sidebar) sidebar.classList.add('translate-x-full');
    
    const overlay = document.getElementById('overlay-klik-luar');
    if(overlay) overlay.classList.add('hidden');
    
    const modalCancel = document.getElementById('modal-cancel-hold');
    if(modalCancel) modalCancel.classList.add('hidden');
    
    if(document.getElementById('sidebar-kolom')) document.getElementById('sidebar-kolom').classList.add('translate-x-full');
    
    closeFilterMenu();
};

window.loadUserPreferences = function() {
    const savedOrder = localStorage.getItem(`col_order_rkeluar_${currentUser.username}`);
    if (savedOrder) { try { userColOrder = JSON.parse(savedOrder); } catch(e) { userColOrder = []; } } else { userColOrder = []; }
    
    const savedHidden = localStorage.getItem(`col_hidden_rkeluar_${currentUser.username}`);
    if (savedHidden) { try { hiddenCols = JSON.parse(savedHidden); } catch(e) { hiddenCols = []; } } else { hiddenCols = []; }
    
    const savedRows = localStorage.getItem('wms_rows_per_page');
    if(savedRows) {
        rowsPerPage = parseInt(savedRows);
        const sel = document.getElementById('select-rows-per-page');
        if(sel) {
            let found = false;
            Array.from(sel.options).forEach(opt => { if(opt.value == rowsPerPage) { opt.selected = true; found = true; } });
            if(!found) {
                sel.value = 'CUSTOM';
                const inp = document.getElementById('input-custom-rows');
                if(inp) { inp.classList.remove('hidden'); inp.value = rowsPerPage; }
            }
        }
    }
};

async function loadAreasForCancel() {
    try {
        const { data } = await db.from('master_area').select('*');
        if (data) {
            const areas = [...new Set(data.map(d => (d.nama_area || d.area || '').trim()).filter(Boolean))];
            const sel = document.getElementById('cancel-area');
            sel.innerHTML = '<option value="">-- PILIH AREA GUDANG --</option>';
            areas.sort().forEach(a => sel.innerHTML += `<option value="${a}">${a}</option>`);
        }
    } catch (e) { console.error("Gagal load area:", e); }
}

async function loadKamus() {
    const { data: d2 } = await db.from('master_2').select('*'); 
    if(d2) {
        kamusData = d2;
        window.masterData = { kamus: d2 };
    }
}

function extractPOFromSKU(id_sku) {
    if(!id_sku) return '-';
    const parts = id_sku.split('_');
    return parts.length >= 8 ? parts[7] : '-';
}

function extractAreaFromSKU(id_sku) {
    if(!id_sku) return '-';
    const parts = id_sku.split('_');
    return parts.length > 0 ? parts[0] : '-';
}

async function muatDataDariSupabase() {
    const tbody = document.getElementById('tbody-keluar');
    tbody.innerHTML = `<tr><td colspan="22" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-bold text-slate-400 text-sm">Menarik Semua Data Riwayat Keluar...</p></td></tr>`;
    if(typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const [dataKeluar, dataHold] = await Promise.all([
            fetchAllRows('stok_keluar'),
            fetchAllRows('hold_keluar')
        ]);
        
        rawDataRaw = dataKeluar || [];
        holdDataRaw = dataHold || [];
        
        updateFilterDropdowns();
        setMode(modeSekarang);
    } catch(err) { 
        tbody.innerHTML = `<tr><td colspan="22" class="p-10 text-red-500 font-bold">Gagal memuat data: ${err.message}</td></tr>`; 
    }
}

function setMode(m) {
    modeSekarang = m;
    
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';

    ['mobile', 'item', 'hold'].forEach(tab => {
        const el = document.getElementById('tab-mode-' + tab);
        if(el) {
            if(tab === 'mobile') {
                el.className = (m === tab) ? 'sm:hidden ' + activeClass : 'sm:hidden ' + inactiveClass;
            } else {
                el.className = (m === tab) ? activeClass : inactiveClass;
            }
        }
    });

    const btnCancel = document.getElementById('btn-cancel');
    const dateFilter = document.getElementById('mobile-date-filter');
    
    const viewTable = document.getElementById('view-table');
    const viewMobile = document.getElementById('view-mobile');
    const footerPagination = document.getElementById('footer-pagination');
    const lvl5Footer = document.getElementById('mobile-lvl5-footer');

    if(m === 'hold') { 
        btnCancel.classList.remove('hidden'); 
        dateFilter.classList.add('hidden');
        viewTable.classList.remove('hidden'); viewMobile.classList.add('hidden');
        footerPagination.classList.remove('hidden');
        if(lvl5Footer) { lvl5Footer.classList.add('hidden'); lvl5Footer.style.display = 'none'; }
    }
    else if(m === 'mobile') {
        btnCancel.classList.add('hidden'); 
        dateFilter.classList.remove('hidden');
        viewTable.classList.add('hidden'); viewMobile.classList.remove('hidden');
        footerPagination.classList.add('hidden');
        mobileLevel = 1; 
    }
    else { 
        btnCancel.classList.add('hidden'); 
        dateFilter.classList.add('hidden');
        viewTable.classList.remove('hidden'); viewMobile.classList.add('hidden');
        footerPagination.classList.remove('hidden');
        if(lvl5Footer) { lvl5Footer.classList.add('hidden'); lvl5Footer.style.display = 'none'; }
    }

    activeFilters = {};
    if (m === 'mobile') {
        renderMobileView();
    } else {
        renderHeaderDanTabel();
    }
}

window.goToMobileLevel2 = function(cust) { mobileSelectedCust = cust; mobileLevel = 2; renderMobileView(); };
window.goToMobileLevel3 = function(trip) { mobileSelectedTrip = trip; mobileLevel = 3; renderMobileView(); };
window.goToMobileLevel4 = function(itemKey) { mobileSelectedItem = itemKey; mobileLevel = 4; renderMobileView(); };
window.goToMobileLevel5 = function(shading) { mobileSelectedShading = shading; mobileLevel = 5; renderMobileView(); };

window.goBackMobile = function() {
    if (mobileLevel > 1) {
        mobileLevel--;
        renderMobileView();
    }
};

function mapItemForFilter(r) {
    const t = window.translateBarcode(r.qrcode);
    const custAktual = r.customer_aktual || t.customer || '-';
    const custEstimasi = r.customer_estimasi || '-';
    const customerKeluar = r.customer_keluar || extractPOFromSKU(r.id_sku) || '-';
    const pjgFormatted = formatPanjang(r.panjang || t.panjang);
    const asalArea = r.area || extractAreaFromSKU(r.id_sku) || '-';

    return {
        qrcode: r.qrcode,
        id_sku: r.id_sku,
        customerKeluar: customerKeluar,
        trip: r.trip || '-',
        customerAktual: custAktual,
        customerEstimasi: custEstimasi,
        jenisItem: r.jenis_item || t.jenisItem || '-',
        namaItem: r.nama_item || t.namaItem || '-',
        panjang: pjgFormatted,
        grade: r.grade || t.grade || '-',
        dus: r.dus || t.dus || '-',
        shading: r.shading || t.shading || '-',
        pic: r.pic_keluar || r.pic_input || '-',
        keterangan: r.keterangan || '-',
        created_at: r.created_at,
        tglProduksi: t.tglProduksi || '-',
        mesin: t.mesin || '-',
        shift: t.shift || '-',
        area: asalArea
    };
}

function matchesActiveFilters(item) {
    const f = {
        custKeluar: document.getElementById('fs-cust-keluar')?.value || '',
        trip: document.getElementById('fs-trip')?.value || '',
        qr: document.getElementById('fs-qr')?.value.toLowerCase() || '',
        custAktual: document.getElementById('fs-cust-aktual')?.value || '',
        custEst: document.getElementById('fs-cust-est')?.value || '',
        jenis: document.getElementById('fs-jenis')?.value || '',
        nama: document.getElementById('fs-nama')?.value || '',
        pjg: document.getElementById('fs-pjg')?.value || '',
        grade: document.getElementById('fs-grade')?.value || '',
        dus: document.getElementById('fs-dus')?.value || '',
        shading: document.getElementById('fs-shading')?.value || '',
        pic: document.getElementById('fs-pic')?.value || '',
        ket: document.getElementById('fs-ket')?.value.toLowerCase() || ''
    };

    if (f.custKeluar && item.customerKeluar !== f.custKeluar) return false;
    if (f.trip && item.trip !== f.trip) return false;
    if (f.qr && !item.qrcode.toLowerCase().includes(f.qr)) return false;
    if (f.custAktual && item.customerAktual !== f.custAktual) return false;
    if (f.custEst && item.customerEstimasi !== f.custEst) return false;
    if (f.jenis && item.jenisItem !== f.jenis) return false;
    if (f.nama && item.namaItem !== f.nama) return false;
    if (f.pjg && item.panjang !== f.pjg) return false;
    if (f.grade && item.grade !== f.grade) return false;
    if (f.dus && item.dus !== f.dus) return false;
    if (f.shading && item.shading !== f.shading) return false;
    if (f.pic && item.pic !== f.pic) return false;
    if (f.ket && !item.keterangan.toLowerCase().includes(f.ket)) return false;

    return true;
}

window.toggleSelectAllLvl5 = function(checked) {
    document.querySelectorAll('.cb-lvl5').forEach(cb => {
        cb.checked = checked;
        const card = cb.closest('.card-lvl5');
        if (card) {
            if (checked) card.classList.add('border-blue-500', 'bg-blue-50/50');
            else card.classList.remove('border-blue-500', 'bg-blue-50/50');
        }
    });
};

window.highlightLvl5Card = function(cb) {
    const card = cb.closest('.card-lvl5');
    if (card) {
        if (cb.checked) card.classList.add('border-blue-500', 'bg-blue-50/50');
        else card.classList.remove('border-blue-500', 'bg-blue-50/50');
    }
};

window.cancelKeluarMobile = async function() {
    const checkedBoxes = document.querySelectorAll('.cb-lvl5:checked');
    if (checkedBoxes.length === 0) return alert("Pilih / centang minimal 1 kardus yang ingin di-cancel keluar!");

    const qrsToCancel = Array.from(checkedBoxes).map(cb => cb.value);

    if (!confirm(`Yakin ingin membatalkan (Cancel) ${qrsToCancel.length} item ini dari status Keluar?\nItem akan langsung dipindahkan ke Tabel Hold Keluar.`)) return;

    const btn = document.getElementById('btn-cancel-mobile-lvl5');
    const oriText = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true; }

    const itemsToHold = rawDataRaw.filter(r => qrsToCancel.includes(r.qrcode)).map(r => ({
        qrcode: r.qrcode,
        id_sku: r.id_sku,
        customer_keluar: r.customer_keluar,
        trip: r.trip,
        customer_aktual: r.customer_aktual,
        customer_estimasi: r.customer_estimasi,
        keterangan: 'DI-CANCEL dari Mobile Riwayat',
        pic_input: currentUser.username
    }));

    try {
        const { error: errAdd } = await db.from('hold_keluar').insert(itemsToHold);
        if (errAdd) throw errAdd;

        const { error: errDel } = await db.from('stok_keluar').delete().in('qrcode', qrsToCancel);
        if (errDel) throw errDel;

        rawDataRaw = rawDataRaw.filter(r => !qrsToCancel.includes(r.qrcode));
        holdDataRaw.push(...itemsToHold);

        alert(`✅ SUKSES!\n${qrsToCancel.length} kardus berhasil di-cancel dan dipindahkan ke Tabel Hold Keluar.`);
        renderMobileView();

    } catch (e) {
        alert("Gagal memproses cancel keluar: " + e.message);
    } finally {
        if(btn) { btn.innerHTML = oriText; btn.disabled = false; }
        lucide.createIcons();
    }
};

function renderMobileView() {
    const container = document.getElementById('view-mobile');
    const targetDate = document.getElementById('filter-date-mobile').value;
    const lvl5Footer = document.getElementById('mobile-lvl5-footer');

    if (lvl5Footer) {
        if (modeSekarang === 'mobile' && mobileLevel === 5) {
            lvl5Footer.classList.remove('hidden');
            lvl5Footer.style.display = 'flex';
            const cbAllLvl5 = document.getElementById('cb-all-lvl5');
            if (cbAllLvl5) cbAllLvl5.checked = false;
        } else {
            lvl5Footer.classList.add('hidden');
            lvl5Footer.style.display = 'none';
        }
    }

    let targetData = modeSekarang === 'hold' ? holdDataRaw : rawDataRaw;

    let mobileData = [];
    targetData.forEach(r => {
        const rowDate = (r.created_at || '').split('T')[0];
        if (targetDate && rowDate !== targetDate) return;

        const mapped = mapItemForFilter(r);
        if (matchesActiveFilters(mapped)) {
            mobileData.push(mapped);
        }
    });

    if (mobileData.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-56 bg-white rounded-2xl border border-slate-200 shadow-sm mt-4 p-6 text-center">
                <i data-lucide="package-x" class="w-12 h-12 text-slate-300 mb-2"></i>
                <h4 class="font-bold text-slate-700 text-sm">Tidak ada data keluar</h4>
                <p class="text-xs text-slate-400 mt-1">Coba sesuaikan tanggal atau reset filter.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    let html = '';

    if (mobileLevel === 1) {
        let custMap = {};
        mobileData.forEach(r => {
            let cust = r.customerKeluar || '-';
            if(!custMap[cust]) custMap[cust] = 0;
            custMap[cust]++;
        });

        html += `<div class="flex justify-between items-center mb-1 px-1">
            <h3 class="text-xs font-black text-slate-500 uppercase tracking-wider">Daftar Pengiriman (Customer)</h3>
            <span class="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">${mobileData.length} Total Dus</span>
        </div>`;
        
        Object.keys(custMap).sort().forEach(cust => {
            html += `
                <div onclick="goToMobileLevel2('${cust}')" class="bg-white border border-blue-200 p-4 rounded-xl flex justify-between items-center shadow-sm active:scale-95 transition cursor-pointer hover:bg-blue-50">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-inner">
                            <i data-lucide="truck" class="w-5 h-5"></i>
                        </div>
                        <div class="flex flex-col">
                            <h4 class="font-black text-slate-800 text-base uppercase leading-tight">${cust}</h4>
                            <p class="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-max mt-1 border border-blue-100">${custMap[cust]} Dus</p>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="text-slate-400 w-5 h-5"></i>
                </div>
            `;
        });
    } 
    else if (mobileLevel === 2) {
        let tripMap = {};
        mobileData.forEach(r => {
            if (r.customerKeluar !== mobileSelectedCust) return;
            let trip = r.trip || '-';
            if(!tripMap[trip]) tripMap[trip] = 0;
            tripMap[trip]++;
        });

        html += `
            <div class="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-sm -mx-4 px-4 py-2.5 border-b border-slate-200 shadow-sm flex items-center gap-3 mb-2">
                <button onclick="goBackMobile()" class="p-2.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition flex items-center gap-1.5 text-xs font-black text-slate-700 shrink-0">
                    <i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i> Kembali
                </button>
                <div class="flex flex-col overflow-hidden">
                    <span class="text-[10px] font-black text-slate-400 uppercase leading-none">Customer Tujuan</span>
                    <span class="text-base font-black text-blue-700 uppercase leading-tight truncate">${mobileSelectedCust}</span>
                </div>
            </div>
        `;

        Object.keys(tripMap).sort().forEach(trip => {
            html += `
                <div onclick="goToMobileLevel3('${trip}')" class="bg-white border border-indigo-200 p-4 rounded-xl flex justify-between items-center shadow-sm active:scale-95 transition cursor-pointer hover:bg-indigo-50">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-inner">
                            <i data-lucide="truck-fast" class="w-5 h-5"></i>
                        </div>
                        <div class="flex flex-col">
                            <h4 class="font-black text-slate-800 text-base uppercase leading-tight">${trip}</h4>
                            <p class="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-max mt-1 border border-indigo-100">${tripMap[trip]} Dus</p>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="text-slate-400 w-5 h-5"></i>
                </div>
            `;
        });
    }
    else if (mobileLevel === 3) {
        let itemMap = {};
        mobileData.forEach(r => {
            if (r.customerKeluar !== mobileSelectedCust) return;
            if (r.trip !== mobileSelectedTrip) return;

            let key = `${r.namaItem}_${r.panjang}_${r.grade}_${r.dus}`;
            if(!itemMap[key]) {
                itemMap[key] = { nama: r.namaItem, pjg: r.panjang, grade: r.grade, dus: r.dus, qty: 0 };
            }
            itemMap[key].qty++;
        });

        html += `
            <div class="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-sm -mx-4 px-4 py-2.5 border-b border-slate-200 shadow-sm flex items-center gap-3 mb-2">
                <button onclick="goBackMobile()" class="p-2.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition flex items-center gap-1.5 text-xs font-black text-slate-700 shrink-0">
                    <i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i> Kembali
                </button>
                <div class="flex flex-col overflow-hidden">
                    <span class="text-[10px] font-black text-slate-400 uppercase leading-none">${mobileSelectedCust}</span>
                    <span class="text-base font-black text-blue-700 uppercase leading-tight truncate">${mobileSelectedTrip}</span>
                </div>
            </div>
        `;

        Object.keys(itemMap).sort().forEach(key => {
            let item = itemMap[key];
            html += `
                <div onclick="goToMobileLevel4('${key}')" class="bg-white border border-emerald-200 p-4 rounded-xl flex justify-between items-center shadow-sm active:scale-95 transition cursor-pointer hover:bg-emerald-50">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner">
                            <i data-lucide="box" class="w-5 h-5"></i>
                        </div>
                        <div class="flex flex-col">
                            <h4 class="font-black text-slate-800 text-sm leading-snug">${item.nama} - ${item.pjg} - ${item.grade} - ${item.dus}</h4>
                            <p class="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded w-max mt-1 border border-emerald-100">${item.qty} Dus</p>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="text-slate-400 w-5 h-5"></i>
                </div>
            `;
        });
    }
    else if (mobileLevel === 4) {
        let shadingMap = {};
        mobileData.forEach(r => {
            if (r.customerKeluar !== mobileSelectedCust) return;
            if (r.trip !== mobileSelectedTrip) return;

            let key = `${r.namaItem}_${r.panjang}_${r.grade}_${r.dus}`;
            if (key !== mobileSelectedItem) return;

            let shading = r.shading || '-';
            if(!shadingMap[shading]) shadingMap[shading] = 0;
            shadingMap[shading]++;
        });

        let itemParts = mobileSelectedItem.split('_');
        let displayItem = `${itemParts[0]} - ${itemParts[1]} - ${itemParts[2]} - ${itemParts[3]}`;

        html += `
            <div class="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-sm -mx-4 px-4 py-2.5 border-b border-slate-200 shadow-sm flex items-center gap-3 mb-2">
                <button onclick="goBackMobile()" class="p-2.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition flex items-center gap-1.5 text-xs font-black text-slate-700 shrink-0">
                    <i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i> Kembali
                </button>
                <div class="flex flex-col overflow-hidden">
                    <span class="text-base font-black text-rose-700 uppercase leading-snug truncate">${mobileSelectedCust} (${mobileSelectedTrip})</span>
                    <span class="text-xs sm:text-sm font-black text-slate-800 uppercase leading-snug truncate">${displayItem}</span>
                </div>
            </div>
        `;

        Object.keys(shadingMap).sort().forEach(shading => {
            html += `
                <div onclick="goToMobileLevel5('${shading}')" class="bg-white border border-amber-200 p-4 rounded-xl flex justify-between items-center shadow-sm active:scale-95 transition cursor-pointer hover:bg-amber-50">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-inner">
                            <i data-lucide="palette" class="w-5 h-5"></i>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-400 uppercase">Shading</span>
                            <h4 class="font-black text-slate-800 text-base leading-tight">${shading}</h4>
                            <span class="text-[10px] font-bold text-amber-700 mt-0.5">Klik untuk melihat detail item</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                            <span class="text-sm font-black text-amber-700">${shadingMap[shading]} Dus</span>
                        </div>
                        <i data-lucide="chevron-right" class="text-slate-400 w-5 h-5"></i>
                    </div>
                </div>
            `;
        });
    }
    else if (mobileLevel === 5) {
        let detailItems = mobileData.filter(r => {
            if (r.customerKeluar !== mobileSelectedCust) return false;
            if (r.trip !== mobileSelectedTrip) return false;
            let key = `${r.namaItem}_${r.panjang}_${r.grade}_${r.dus}`;
            if (key !== mobileSelectedItem) return false;
            if (r.shading !== mobileSelectedShading) return false;
            return true;
        });

        let itemParts = mobileSelectedItem.split('_');
        let displayItem = `${itemParts[0]} - ${itemParts[1]} - ${itemParts[2]} - ${itemParts[3]}`;

        html += `
            <div class="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-md -mx-4 px-4 py-2.5 border-b border-slate-300 shadow-sm flex items-center gap-3 mb-3">
                <button onclick="goBackMobile()" class="p-2.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition flex items-center gap-1.5 text-xs font-black text-slate-700 shrink-0">
                    <i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i> Kembali
                </button>
                <div class="flex flex-col overflow-hidden">
                    <span class="text-base font-black text-rose-700 uppercase leading-snug truncate">${mobileSelectedCust} (${mobileSelectedTrip})</span>
                    <span class="text-xs sm:text-sm font-black text-slate-800 uppercase leading-snug truncate">${displayItem} • Shading: <span class="text-amber-600 font-black">${mobileSelectedShading}</span></span>
                </div>
            </div>
        `;

        detailItems.forEach(d => {
            const waktuKeluar = formatWIB(d.created_at);

            html += `
                <div class="card-lvl5 bg-white border border-slate-300 rounded-2xl p-4 mb-2 relative transition w-full flex flex-col shadow-sm">
                    <div class="flex justify-between items-center mb-3 pb-2.5 border-b border-slate-100">
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" value="${d.qrcode}" onchange="highlightLvl5Card(this)" class="cb-lvl5 cursor-pointer w-5 h-5 accent-blue-600 rounded border-slate-400">
                            <span class="font-mono text-xs font-black text-slate-500 uppercase">PILIH DUS</span>
                        </label>
                        <span class="font-bold px-2.5 py-0.5 text-[10px] rounded-md border bg-emerald-600 text-white border-emerald-700 shadow-sm">KELUAR</span>
                    </div>
                    
                    <div class="font-mono font-black text-slate-900 text-sm break-all leading-tight bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-center mb-3">
                        ${d.qrcode}
                    </div>
                    
                    <div class="grid grid-cols-2 gap-x-3 gap-y-3">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-400 uppercase">Waktu Scan Keluar</span>
                            <span class="text-xs font-bold text-slate-700">${waktuKeluar}</span>
                        </div>
                        
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-400 uppercase">Asal Area</span>
                            <span class="text-xs font-black text-emerald-700 uppercase">${d.area || '-'}</span>
                        </div>

                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-400 uppercase">Customer Aktual</span>
                            <span class="text-xs font-bold text-orange-600 uppercase">${d.customerAktual}</span>
                        </div>
                        
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-400 uppercase">Customer Estimasi</span>
                            <span class="text-xs font-bold text-purple-600 uppercase">${d.customerEstimasi}</span>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function updateFilterDropdowns() {
    let targetData = modeSekarang === 'hold' ? holdDataRaw : rawDataRaw;

    const fields = [
        { id: 'fs-cust-keluar', key: 'customerKeluar' },
        { id: 'fs-trip', key: 'trip' },
        { id: 'fs-cust-aktual', key: 'customerAktual' },
        { id: 'fs-cust-est', key: 'customerEstimasi' },
        { id: 'fs-jenis', key: 'jenisItem' },
        { id: 'fs-nama', key: 'namaItem' },
        { id: 'fs-pjg', key: 'panjang' },
        { id: 'fs-grade', key: 'grade' },
        { id: 'fs-dus', key: 'dus' },
        { id: 'fs-shading', key: 'shading' },
        { id: 'fs-pic', key: 'pic' }
    ];

    let mappedData = targetData.map(mapItemForFilter);

    fields.forEach(field => {
        const select = document.getElementById(field.id);
        if (!select) return;
        
        const currentVal = select.value;
        const uniqueVals = [...new Set(mappedData.map(d => d[field.key] || '-'))].filter(x => x && x !== '-').sort();

        let html = '<option value="">-- Semua --</option>';
        uniqueVals.forEach(val => {
            html += `<option value="${val}">${val}</option>`;
        });
        select.innerHTML = html;

        if (uniqueVals.includes(currentVal)) {
            select.value = currentVal;
        }
    });
}

window.resetFilterRiwayat = function() {
    ['fs-cust-keluar', 'fs-trip', 'fs-qr', 'fs-cust-aktual', 'fs-cust-est', 'fs-jenis', 'fs-nama', 'fs-pjg', 'fs-grade', 'fs-dus', 'fs-shading', 'fs-pic', 'fs-ket'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    saringTabelRiwayat();
    toggleSidebarFilter();
};

window.saringTabelRiwayat = function() {
    if (modeSekarang === 'mobile') {
        renderMobileView();
    } else {
        saringTabelDesktop();
    }
};

function saringTabelDesktop() {
    const f = {
        custKeluar: document.getElementById('fs-cust-keluar')?.value || '',
        trip: document.getElementById('fs-trip')?.value || '',
        qr: document.getElementById('fs-qr')?.value.toLowerCase() || '',
        custAktual: document.getElementById('fs-cust-aktual')?.value || '',
        custEst: document.getElementById('fs-cust-est')?.value || '',
        jenis: document.getElementById('fs-jenis')?.value || '',
        nama: document.getElementById('fs-nama')?.value || '',
        pjg: document.getElementById('fs-pjg')?.value || '',
        grade: document.getElementById('fs-grade')?.value || '',
        dus: document.getElementById('fs-dus')?.value || '',
        shading: document.getElementById('fs-shading')?.value || '',
        pic: document.getElementById('fs-pic')?.value || '',
        ket: document.getElementById('fs-ket')?.value.toLowerCase() || ''
    };

    document.querySelectorAll('.text-row').forEach(row => {
        let show = true;

        const checkMatch = (colCls, filterVal) => {
            if(!filterVal) return true;
            const cell = row.querySelector('.' + colCls);
            if(!cell) return true;
            let val = cell.getAttribute('data-search') || cell.innerText.trim();
            return val === filterVal;
        };

        if(!checkMatch('col-tujuan', f.custKeluar)) show = false;
        if(!checkMatch('col-trip', f.trip)) show = false;
        if(!checkMatch('col-customer', f.custAktual)) show = false;
        if(!checkMatch('col-estimasi', f.custEst)) show = false;
        if(!checkMatch('col-jenis', f.jenis)) show = false;
        if(!checkMatch('col-nama', f.nama)) show = false;
        if(!checkMatch('col-pjg', f.pjg)) show = false;
        if(!checkMatch('col-grade', f.grade)) show = false;
        if(!checkMatch('col-dus', f.dus)) show = false;
        if(!checkMatch('col-shading', f.shading)) show = false;
        if(!checkMatch('col-pic', f.pic)) show = false;

        if (show && f.qr) {
            const cell = row.querySelector('.col-qr');
            if (cell && !cell.innerText.toLowerCase().includes(f.qr)) show = false;
        }

        if (show && f.ket) {
            const cell = row.querySelector('.col-ket');
            if (cell && !cell.innerText.toLowerCase().includes(f.ket)) show = false;
        }

        if (show) row.classList.remove('filtered-out');
        else row.classList.add('filtered-out');
    });

    selectAllState = 0;
    updateSelectAllUI();
    currentPage = 1; 
    applyPagination();
}

function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-keluar');
    const rows = Array.from(tbody.querySelectorAll('tr.text-row'));
    let isAsc = sortState[colIndex] !== 'asc'; sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].getAttribute('data-search') || a.cells[colIndex].innerText.trim(); 
        let valB = b.cells[colIndex].getAttribute('data-search') || b.cells[colIndex].innerText.trim();
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) return isAsc ? numA - numB : numB - numA;
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    
    rows.forEach(row => tbody.appendChild(row));
    document.querySelectorAll('.sort-icon').forEach(icon => { icon.setAttribute('data-lucide', 'arrow-up-down'); icon.classList.add('opacity-30'); });
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) { icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); icon.classList.remove('opacity-30'); lucide.createIcons(); }
    applyPagination();
}

const thSort = (label, cls = "") => {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const isHidden = hiddenCols.includes(colClass) ? 'col-hidden' : '';
    const noFilter = ['col-cb', 'col-no'].includes(colClass);
    
    if (noFilter) {
        return `<th class="hdr-std ${cls} ${isHidden} select-none text-center"><div class="flex items-center justify-center w-full">${label}</div></th>`;
    }

    return `<th class="hdr-std ${cls} ${isHidden} select-none group">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="cursor-pointer hover:text-blue-300 transition truncate flex-1 text-left" onclick="sortTable(this.closest('th').cellIndex, this.closest('th'))" title="Sort ${label}">${label}</span>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="sortTable(this.closest('th').cellIndex, this.closest('th'))" class="p-1 hover:bg-slate-700 rounded transition" title="Sort ${label}">
                    <i data-lucide="arrow-up-down" class="w-3.5 h-3.5 sort-icon opacity-40 group-hover:opacity-100 transition-opacity text-white"></i>
                </button>
                <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-700 rounded transition" title="Filter ${label}">
                    <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
                </button>
            </div>
        </div>
    </th>`;
};

function openColumnFilter(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    
    document.querySelectorAll('#tbody-keluar tr.text-row').forEach(row => {
        let showBasedOnOthers = true;
        for (let otherCol in activeFilters) {
            if (otherCol !== colClass) { 
                const allowed = activeFilters[otherCol]; const c = row.querySelector('.' + otherCol);
                let t = c ? (c.getAttribute('data-search') || c.innerText.trim()) : '';
                if (!allowed.includes(t)) { showBasedOnOthers = false; break; }
            }
        }
        if (showBasedOnOthers) {
            let cell = row.querySelector('.' + colClass);
            if (cell) { let val = cell.getAttribute('data-search') || cell.innerText.trim(); if(val !== '') uniqueValues.add(val); }
        }
    });

    let sortedValues = Array.from(uniqueValues).sort();
    let listHtml = `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded"><input type="checkbox" id="filter-select-all" checked onchange="toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-0"> <span class="font-black text-slate-800">(PILIH SEMUA)</span></label>`;
    
    sortedValues.forEach(val => {
        let isChecked = true;
        if (activeFilters[colClass] && !activeFilters[colClass].includes(val)) { isChecked = false; }
        listHtml += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-0" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate font-bold text-slate-600">${val}</span>
        </label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml; updateSelectAllState();
    document.getElementById('filter-search-input').value = '';
    
    const menu = document.getElementById('excel-filter-menu');
    if(menu) {
        menu.classList.remove('hidden');
        
        const btnRect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 256; 
        
        let topPos = btnRect.bottom + 4; 
        let leftPos = btnRect.left; 

        if (leftPos + menuWidth > window.innerWidth) {
            leftPos = btnRect.right - menuWidth;
        }
        
        if (leftPos < 10) {
            leftPos = 10;
        }

        menu.style.position = 'fixed'; 
        menu.style.top = `${topPos}px`;
        menu.style.left = `${leftPos}px`;
    }
    const sInput = document.getElementById('filter-search-input'); if(sInput) sInput.focus();
}

function toggleAllFilterValues(checked) {
    document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; });
    updateSelectAllState();
}
function updateSelectAllState() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); const checkedCbs = document.querySelectorAll('.filter-val-cb:checked');
    const selectAll = document.getElementById('filter-select-all'); if(!selectAll) return;
    if(allCbs.length === checkedCbs.length) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
}

function searchFilterList(val) {
    const query = val.toLowerCase().split(' ').filter(x => x);
    document.querySelectorAll('.filter-val-item').forEach(label => {
        const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
        label.style.display = query.every(term => text.includes(term)) ? '' : 'none';
    });
}
function closeFilterMenu() { const menu = document.getElementById('excel-filter-menu'); if(menu) menu.classList.add('hidden'); }
function clearFilterForCurrentCol() { delete activeFilters[currentFilterCol]; closeFilterMenu(); saringTabelExcel(); updateFilterIcons(); }
function applyFilterForCurrentCol() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete activeFilters[currentFilterCol]; } 
    else { activeFilters[currentFilterCol] = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); }
    closeFilterMenu(); saringTabelExcel(); updateFilterIcons();
}
function saringTabelExcel() {
    document.querySelectorAll('.text-row').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowed = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { if (!allowed.includes(cell.getAttribute('data-search') || cell.innerText.trim())) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.row-cb'); if(cb) { cb.checked = false; highlightRow(cb, true); } }
    });
    selectAllState = 0;
    updateSelectAllUI();
    currentPage = 1; applyPagination();
}
function updateFilterIcons() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('opacity-40', 'text-white'); });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('opacity-40', 'text-white'); icon.classList.add('text-amber-400', 'opacity-100'); } }
    }
}

window.cycleSelectAll = function() {
    selectAllState = (selectAllState + 1) % 3;
    updateSelectAllUI();
    applySelection();
};

function updateSelectAllUI() {
    const btn = document.getElementById('btn-select-all');
    if(!btn) return;
    
    if (selectAllState === 0) {
        btn.innerHTML = '';
        btn.className = 'w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto';
    } else if (selectAllState === 1) {
        btn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>';
        btn.className = 'w-4 h-4 border border-blue-600 rounded flex items-center justify-center bg-blue-600 text-white transition mx-auto';
    } else if (selectAllState === 2) {
        btn.innerHTML = '<i data-lucide="check-check" class="w-3 h-3"></i>';
        btn.className = 'w-4 h-4 border border-amber-500 rounded flex items-center justify-center bg-amber-500 text-white transition mx-auto';
    }
    lucide.createIcons();
}

function applySelection() {
    const allRows = Array.from(document.querySelectorAll('#tbody-keluar tr.text-row'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    if (selectAllState === 0) {
        allRows.forEach(row => {
            const cb = row.querySelector('.row-cb');
            if(cb) { cb.checked = false; highlightRow(cb, true); }
        });
    } else if (selectAllState === 1) {
        allRows.forEach(row => {
            const cb = row.querySelector('.row-cb');
            if(cb) { cb.checked = false; highlightRow(cb, true); }
        });
        visibleRows.forEach((row, index) => {
            if(index >= startIndex && index < endIndex) {
                const cb = row.querySelector('.row-cb');
                if(cb) { cb.checked = true; highlightRow(cb, true); }
            }
        });
    } else if (selectAllState === 2) {
        visibleRows.forEach(row => {
            const cb = row.querySelector('.row-cb');
            if(cb) { cb.checked = true; highlightRow(cb, true); }
        });
    }
    updateSelectedCount();
}

function highlightRow(cb, skipStateReset = false) {
    const tr = cb.closest('tr');
    if (tr) {
        if (cb.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    }
    
    if(!skipStateReset && !cb.checked && selectAllState !== 0) {
        selectAllState = 0;
        updateSelectAllUI();
    }
    
    if(!skipStateReset) updateSelectedCount();
}

function changeRowsPerPage(val) {
    const customInput = document.getElementById('input-custom-rows');
    if (val === 'ALL') {
        rowsPerPage = 999999; 
        if(customInput) customInput.classList.add('hidden');
    } else if (val === 'CUSTOM') {
        if(customInput) {
            customInput.classList.remove('hidden');
            customInput.focus();
            let customVal = parseInt(customInput.value);
            rowsPerPage = (customVal > 0) ? customVal : rowsPerPage;
        }
    } else {
        rowsPerPage = parseInt(val);
        if(customInput) customInput.classList.add('hidden');
    }
    localStorage.setItem('wms_rows_per_page', rowsPerPage);
    currentPage = 1; 
    applyPagination();
}

function setCustomRowsPerPage(val) {
    let parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) {
        rowsPerPage = parsed;
        localStorage.setItem('wms_rows_per_page', rowsPerPage);
        currentPage = 1;
        applyPagination();
    }
}

function applyPagination() {
    const allRows = Array.from(document.querySelectorAll('#tbody-keluar tr.text-row'));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });
    
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length; const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    if(currentPage > totalPages) currentPage = totalPages; 
    if(currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage; const endIndex = startIndex + rowsPerPage;
    
    let sumQty = 0;

    visibleRows.forEach((row, index) => {
        row.classList.remove('stripe-1', 'stripe-2');
        if (index % 2 === 0) row.classList.add('stripe-1');
        else row.classList.add('stripe-2');

        const qtyCell = row.querySelector('.col-qty');
        if (qtyCell && modeSekarang === 'item') { 
            sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; 
        } else { 
            sumQty += 1; 
        }

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } 
        else { row.style.display = 'none'; }
    });

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-total-qty')) document.getElementById('lbl-total-qty').innerText = sumQty;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    if (selectAllState === 1) {
        selectAllState = 0;
        updateSelectAllUI();
    }
    
    applySelection();
    updateSelectedCount();
}

function prevPage() { if(currentPage > 1) { currentPage--; applyPagination(); } }
function nextPage() { 
    const totalVisible = document.querySelectorAll('#tbody-keluar tr.text-row:not(.filtered-out)').length;
    if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } 
}

function updateSelectedCount() {
    const count = document.querySelectorAll('.row-cb:checked').length;
    if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count;
}

function renderHeaderDanTabel() {
    const thead = document.getElementById('thead-keluar');
    const tbody = document.getElementById('tbody-keluar');
    sortState = {};
    selectAllState = 0;

    let targetData = modeSekarang === 'hold' ? holdDataRaw : rawDataRaw;
    const rowClassBase = "transition text-row text-[13px]";

    if(modeSekarang === 'hold') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
                ${thSort('Waktu Keluar', 'col-waktu')}
                ${thSort('QRCode', 'col-qr')}
                ${thSort('Trip', 'col-trip')}
                ${thSort('Tgl Produksi', 'col-tgl')}
                ${thSort('Mesin', 'col-mesin')}
                ${thSort('Shift', 'col-shift')}
                ${thSort('Jenis Item', 'col-jenis')}
                ${thSort('Nama Item', 'col-nama')}
                ${thSort('Pjg', 'col-pjg')}
                ${thSort('Grade', 'col-grade')}
                ${thSort('Dus', 'col-dus')}
                ${thSort('Shading', 'col-shading')}
                ${thSort('Customer Aktual', 'col-customer')}
                ${thSort('Customer Estimasi', 'col-estimasi text-purple-300')}
                ${thSort('Customer Keluar', 'col-tujuan text-amber-300')}
                ${thSort('Keterangan', 'col-ket')}
                ${thSort('PIC Keluar', 'col-pic')}
            </tr>`;
        
        if(targetData.length === 0) { tbody.innerHTML = '<tr><td colspan="18" class="p-10 text-center font-medium text-slate-400">Tidak ada data.</td></tr>'; applyPagination(); return; }
        
        let h = '';
        targetData.forEach((r) => {
            const dt = new Date(r.created_at);
            const tglKeluar = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            const td = window.translateBarcode(r.qrcode);
            
            const custAktual = r.customer_aktual || td.customer || '-';
            const custEstimasi = r.customer_estimasi || '-';
            const customerKeluar = r.customer_keluar || extractPOFromSKU(r.id_sku) || '-'; 
            const pjgFormatted = formatPanjang(r.panjang || td.panjang);

            h += `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.qrcode}" onchange="highlightRow(this)" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 text-slate-600 font-medium text-left col-waktu ${hiddenCols.includes('col-waktu')?'col-hidden':''}" data-search="${tglKeluar}">${tglKeluar}</td>
                    <td class="px-4 py-3 font-mono font-bold text-slate-900 text-left tracking-wider col-qr ${hiddenCols.includes('col-qr')?'col-hidden':''}" data-search="${r.qrcode}">${r.qrcode}</td>
                    <td class="px-4 py-3 font-black text-indigo-700 text-center col-trip ${hiddenCols.includes('col-trip')?'col-hidden':''}" data-search="${r.trip || '-'}">${r.trip || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-tgl ${hiddenCols.includes('col-tgl')?'col-hidden':''}" data-search="${td.tglProduksi}">${td.tglProduksi}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-mesin ${hiddenCols.includes('col-mesin')?'col-hidden':''}" data-search="${td.mesin}">${td.mesin}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-shift ${hiddenCols.includes('col-shift')?'col-hidden':''}" data-search="${td.shift}">${td.shift}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis ${hiddenCols.includes('col-jenis')?'col-hidden':''}" data-search="${td.jenisItem}">${td.jenisItem}</td>
                    <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama ${hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${td.namaItem}">${td.namaItem}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg ${hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${pjgFormatted}">${pjgFormatted}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade ${hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${td.grade}">${td.grade}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus ${hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${td.dus}">${td.dus}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading ${hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${td.shading}">${td.shading}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 text-left col-customer ${hiddenCols.includes('col-customer')?'col-hidden':''}" data-search="${custAktual}">${custAktual}</td>
                    <td class="px-4 py-3 font-medium text-purple-600 text-left col-estimasi ${hiddenCols.includes('col-estimasi')?'col-hidden':''}" data-search="${custEstimasi}">${custEstimasi}</td>
                    <td class="px-4 py-3 font-black text-amber-600 text-left col-tujuan ${hiddenCols.includes('col-tujuan')?'col-hidden':''}" data-search="${customerKeluar}">${customerKeluar}</td>
                    <td class="px-4 py-3 text-slate-500 font-medium text-left col-ket ${hiddenCols.includes('col-ket')?'col-hidden':''}" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
                    <td class="px-4 py-3 font-medium uppercase text-xs text-slate-400 text-left col-pic ${hiddenCols.includes('col-pic')?'col-hidden':''}" data-search="${r.pic_keluar || r.pic_input || '-'}">${r.pic_keluar || r.pic_input || '-'}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } 
    else if(modeSekarang === 'item') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
                ${thSort('Tgl Produksi', 'col-tgl')}
                ${thSort('Mesin', 'col-mesin')}
                ${thSort('Shift', 'col-shift')}
                ${thSort('Jenis Item', 'col-jenis')}
                ${thSort('Nama Item', 'col-nama')}
                ${thSort('Pjg', 'col-pjg')}
                ${thSort('Grade', 'col-grade')}
                ${thSort('Dus', 'col-dus')}
                ${thSort('Shading', 'col-shading')}
                ${thSort('Customer Aktual', 'col-customer')}
                ${thSort('Customer Estimasi', 'col-estimasi text-purple-300')}
                ${thSort('Customer Keluar', 'col-tujuan text-amber-300')}
                ${thSort('Trip', 'col-trip')}
                ${thSort('QTY KELUAR (DUS)', 'col-qty text-emerald-300')}
                ${thSort('Keterangan', 'col-ket')}
            </tr>`;
        
        let groups = {};
        targetData.forEach(r => {
            let t = window.translateBarcode(r.qrcode); 
            let n = t.namaItem;
            
            let ket = r.keterangan || 'TANPA_KETERANGAN';
            let custAktual = r.customer_aktual || t.customer || '-';
            let custEstimasi = r.customer_estimasi || '-';
            let customerKeluar = r.customer_keluar || extractPOFromSKU(r.id_sku) || '-';
            let pjgFormatted = formatPanjang(r.panjang || t.panjang);
            let trip = r.trip || '-';
            
            let key = `${t.jenisItem}_${n}_${pjgFormatted}_${t.grade}_${t.dus}_${t.shading}_${custAktual}_${custEstimasi}_${customerKeluar}_${trip}_${t.tglProduksi}_${t.mesin}_${t.shift}_${ket}`;
            
            if(!groups[key]) {
                groups[key] = { ...t, panjang: pjgFormatted, displayNama: n, qty: 0, qrcodes: [], tj: customerKeluar, trip: trip, ket: ket, custAktual: custAktual, custEstimasi: custEstimasi };
            }
            groups[key].qty++; 
            groups[key].qrcodes.push(r.qrcode);
        });

        let arr = Object.values(groups);
        if(arr.length === 0) { tbody.innerHTML = '<tr><td colspan="16" class="p-10 text-center font-medium text-slate-400">Kosong.</td></tr>'; applyPagination(); return; }

        let h = '';
        arr.forEach((r) => {
            const displayKet = (r.ket === 'TANPA_KETERANGAN') ? '-' : r.ket; 
            h += `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.qrcodes.join(',')}" onchange="highlightRow(this)" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-tgl ${hiddenCols.includes('col-tgl')?'col-hidden':''}" data-search="${r.tglProduksi}">${r.tglProduksi}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-mesin ${hiddenCols.includes('col-mesin')?'col-hidden':''}" data-search="${r.mesin}">${r.mesin}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-shift ${hiddenCols.includes('col-shift')?'col-hidden':''}" data-search="${r.shift}">${r.shift}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis ${hiddenCols.includes('col-jenis')?'col-hidden':''}" data-search="${r.jenisItem}">${r.jenisItem}</td>
                    <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama ${hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${r.displayNama}">${r.displayNama}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg ${hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${r.panjang}">${r.panjang}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade ${hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${r.grade}">${r.grade}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus ${hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${r.dus}">${r.dus}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading ${hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${r.shading}">${r.shading}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 text-left col-customer ${hiddenCols.includes('col-customer')?'col-hidden':''}" data-search="${r.custAktual}">${r.custAktual}</td>
                    <td class="px-4 py-3 font-medium text-purple-600 text-left col-estimasi ${hiddenCols.includes('col-estimasi')?'col-hidden':''}" data-search="${r.custEstimasi}">${r.custEstimasi}</td>
                    <td class="px-4 py-3 font-black text-amber-600 text-left col-tujuan ${hiddenCols.includes('col-tujuan')?'col-hidden':''}" data-search="${r.tj}">${r.tj}</td>
                    <td class="px-4 py-3 font-black text-indigo-700 text-center col-trip ${hiddenCols.includes('col-trip')?'col-hidden':''}" data-search="${r.trip}">${r.trip}</td>
                    <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty ${hiddenCols.includes('col-qty')?'col-hidden':''}" data-search="${r.qty}">${r.qty}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket ${hiddenCols.includes('col-ket')?'col-hidden':''}" data-search="${displayKet}">${displayKet}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    }
    
    applyColumnOrder();
    lucide.createIcons(); 
    updateSelectAllUI();
    saringTabelDesktop();
    initResizableColumns();
}

async function aksiMassal(tipe) {
    let checkedValues = [];
    document.querySelectorAll('.row-cb:checked').forEach(cb => { cb.value.split(',').forEach(v => { if(v) checkedValues.push(v); }); });
    if(checkedValues.length === 0) return alert("Centang baris tabel terlebih dahulu!");

    if(tipe === 'salin') {
        let textSalin = "";
        const headers = Array.from(document.querySelectorAll('#thead-keluar th'))
            .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb'))
            .map(th => th.innerText.trim().replace(/\n/g, ' '));
        textSalin += headers.join('\t') + '\n';

        document.querySelectorAll('.row-cb:checked').forEach(cb => {
            const tr = cb.closest('tr'); const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb')) return;
                if(window.getComputedStyle(td).display !== 'none') { rowData.push(td.innerText.trim().replace(/\n/g, ' ')); }
            });
            textSalin += rowData.join('\t') + '\n';
        });
        navigator.clipboard.writeText(textSalin);
        alert(`Tersalin! Buka Excel dan Paste (Ctrl+V).`);
    } 
    else if(tipe === 'xlsx') {
        if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat, pastikan ada koneksi internet.");
        let ws_data = [];
        const headers = Array.from(document.querySelectorAll('#thead-keluar th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb')).map(th => th.innerText.trim());
        ws_data.push(headers);
        
        document.querySelectorAll('.text-row').forEach(tr => {
            if(tr.style.display !== 'none' && tr.querySelector('.row-cb:checked')) {
                const rowData = [];
                Array.from(tr.children).forEach(td => {
                    if(td.classList.contains('col-cb')) return;
                    if(window.getComputedStyle(td).display !== 'none') { rowData.push(`"${td.innerText.trim()}"`); }
                });
                ws_data.push(rowData);
            }
        });

        let ws = XLSX.utils.aoa_to_sheet(ws_data);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Keluar_Data");
        XLSX.writeFile(wb, `Riwayat_Keluar.xlsx`);
    }
    else if(tipe === 'cancel') {
        if(modeSekarang !== 'hold') return alert("CANCEL hanya bisa dilakukan dari Tabel Hold.");
        
        globalCheckedCancel = checkedValues;
        
        document.getElementById('cancel-ket').value = '';
        document.getElementById('cancel-area').value = '';
        
        document.getElementById('modal-cancel-hold').classList.remove('hidden');
    }
}

async function eksekusiCancelHold() {
    const areaCancel = document.getElementById('cancel-area').value;
    const ketCancel = document.getElementById('cancel-ket').value.trim();

    if(!areaCancel) return alert("Pilih Area Pengembalian terlebih dahulu!");
    if(!ketCancel) return alert("Keterangan wajib diisi!");

    const btn = document.getElementById('btn-submit-cancel'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> RETUR STOK...'; btn.disabled = true;

    const dataReturn = holdDataRaw.filter(r => globalCheckedCancel.includes(r.qrcode));
    let insertsGlobal = [];
    let aktualUpdates = {};

    dataReturn.forEach(item => {
        let parts = item.id_sku.split('_');
        let customerAktual = item.customer_aktual || '-';
        let customerEstimasi = item.customer_estimasi || '-';
        
        if(parts.length >= 8) {
            parts[0] = areaCancel; 
            item.id_sku = parts.join('_');
            
            let [a, jenis, nama, pjg, grade, dus, shading] = parts;
            let pjgFormatted = formatPanjang(pjg);
            let key = `${nama}_${pjgFormatted}_${grade}_${dus}_${shading}_${customerAktual}_${customerEstimasi}`;
            if(!aktualUpdates[key]) aktualUpdates[key] = { nama_item: nama, pjg: pjgFormatted, grade: grade, dus: dus, shading: shading, customer_aktual: customerAktual, customer_estimasi: customerEstimasi, qty: 0 };
            aktualUpdates[key].qty++;
        }

        // Masukkan kembali ke stok_global (bukan stok_qr)
        insertsGlobal.push({
            qrcode: item.qrcode,
            id_sku: item.id_sku,
            area: areaCancel,
            tgl_produksi: item.tgl_produksi || '-',
            mesin: item.mesin || '-',
            shift: item.shift || '-',
            jenis_item: item.jenis_item || '-',
            nama_item: item.nama_item,
            panjang: item.panjang,
            grade: item.grade,
            dus: item.dus,
            shading: item.shading,
            customer_aktual: customerAktual,
            keterangan: ketCancel,
            kondisi: 'Aman',
            pic_input: currentUser.username,
            jalur_masuk: 'cancel-hold'
        });
    });

    try {
        const { error: e1 } = await db.from('stok_global').insert(insertsGlobal);
        if(e1) throw e1;

        for(let key in aktualUpdates) {
            let u = aktualUpdates[key];
            const {data: curData} = await db.from('stok_aktual').select('id, qty').eq('nama_item', u.nama_item).eq('panjang', u.pjg).eq('grade', u.grade).eq('dus', u.dus).eq('shading', u.shading).eq('area', areaCancel).eq('customer_aktual', u.customer_aktual).eq('customer_estimasi', u.customer_estimasi).single();
            if(curData) {
                await db.from('stok_aktual').update({qty: curData.qty + u.qty}).eq('id', curData.id);
            } else {
                await db.from('stok_aktual').insert([{
                    area: areaCancel,
                    nama_item: u.nama_item,
                    panjang: u.pjg,
                    grade: u.grade,
                    dus: u.dus,
                    shading: u.shading,
                    customer_aktual: u.customer_aktual,
                    customer_estimasi: u.customer_estimasi,
                    keterangan: ketCancel,
                    qty: u.qty
                }]); 
            }
        }

        const { error: e3 } = await db.from('hold_keluar').delete().in('qrcode', globalCheckedCancel);
        if(e3) throw e3;

        alert(`✅ SUKSES CANCEL KELUAR!\n${globalCheckedCancel.length} item telah dikembalikan ke Kartu Stok pada Area "${areaCancel}".`);
        muatDataDariSupabase();
        document.getElementById('modal-cancel-hold').classList.add('hidden');
    } catch(e) { alert("GAGAL RETUR: " + e.message); }
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

window.toggleSidebarKolom = function() {
    const sidebar = document.getElementById('sidebar-kolom'); const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) { sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); window.renderDragList(); } 
    else { sidebar.classList.add('translate-x-full'); overlay.classList.add('hidden'); }
};

window.renderDragList = function() {
    const container = document.getElementById('kolom-drag-container'); if(!container) return; container.innerHTML = '';
    const headers = Array.from(document.querySelectorAll('#thead-keluar th'));
    headers.forEach(th => {
        const colClass = Array.from(th.classList).find(c => c.startsWith('col-')) || ''; 
        const label = th.innerText.trim() || 'Kolom';
        if(!colClass || colClass === 'col-cb') return;

        const isHidden = window.hiddenCols.includes(colClass);
        const eyeIcon = isHidden ? 'eye-off' : 'eye';
        const eyeColor = isHidden ? 'text-slate-300' : 'text-blue-600';

        const div = document.createElement('div'); div.className = 'drag-item flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md shadow-sm hover:border-blue-400 transition cursor-grab'; div.draggable = true; div.setAttribute('data-col', colClass);
        div.innerHTML = `
            <span class="font-bold text-slate-700 text-xs">${label}</span>
            <div class="flex items-center gap-3">
                <button onclick="toggleHideCol(event, '${colClass}')" class="p-1 hover:bg-slate-100 rounded"><i data-lucide="${eyeIcon}" class="w-4 h-4 ${eyeColor}"></i></button>
                <i data-lucide="grip-vertical" class="w-4 h-4 text-slate-400"></i>
            </div>
        `;
        div.addEventListener('dragstart', () => { div.classList.add('dragging'); }); div.addEventListener('dragend', () => { div.classList.remove('dragging'); });
        container.appendChild(div);
    });
    lucide.createIcons();
    container.addEventListener('dragover', e => {
        e.preventDefault(); const afterElement = window.getDragAfterElement(container, e.clientY); const draggable = document.querySelector('.dragging');
        if (draggable) { if (afterElement == null) { container.appendChild(draggable); } else { container.insertBefore(draggable, afterElement); } }
    });
};

window.toggleHideCol = function(e, colClass) {
    e.stopPropagation();
    if(window.hiddenCols.includes(colClass)) {
        window.hiddenCols = window.hiddenCols.filter(c => c !== colClass);
    } else {
        window.hiddenCols.push(colClass);
    }
    window.renderDragList();
};

window.getDragAfterElement = function(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
};

window.simpanUrutanKolom = function() {
    const items = document.querySelectorAll('.drag-item'); let newOrder = []; items.forEach(item => newOrder.push(item.getAttribute('data-col')));
    window.userColOrder = newOrder; 
    localStorage.setItem(`col_order_rkeluar_${currentUser.username}`, JSON.stringify(newOrder));
    localStorage.setItem(`col_hidden_rkeluar_${currentUser.username}`, JSON.stringify(window.hiddenCols));
    alert("Pengaturan kolom berhasil disimpan!"); window.toggleSidebarKolom(); window.renderHeaderDanTabel(); 
};

window.resetUrutanKolom = function() {
    if(!confirm("Kembalikan pengaturan kolom ke default?")) return;
    window.userColOrder = []; window.hiddenCols = [];
    localStorage.removeItem(`col_order_rkeluar_${currentUser.username}`);
    localStorage.removeItem(`col_hidden_rkeluar_${currentUser.username}`);
    alert("Pengaturan dikembalikan ke default."); window.toggleSidebarKolom(); window.renderHeaderDanTabel();
};

window.applyColumnOrder = function() {
    if (!window.userColOrder || window.userColOrder.length === 0) return;
    const table = document.getElementById('table-keluar-main');
    if(!table) return;
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = Array.from(row.children); if (cells.length <= 1) return; 
        const cbCell = cells.find(c => c.classList.contains('col-cb'));
        const cellMap = {}; cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass) cellMap[colClass] = c; });
        row.innerHTML = ''; 
        if (cbCell) row.appendChild(cbCell);
        window.userColOrder.forEach(colId => { if (cellMap[colId]) { row.appendChild(cellMap[colId]); } });
        cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass !== 'col-cb' && !window.userColOrder.includes(colClass)) { row.appendChild(c); } });
    });
};

window.initResizableColumns = function() {
    const cols = document.querySelectorAll('#table-keluar-main th');
    cols.forEach(col => {
        const existing = col.querySelector('.resizer'); if(existing) existing.remove();
        const resizer = document.createElement('div'); resizer.classList.add('resizer'); col.appendChild(resizer);
        let x = 0; let w = 0;
        resizer.addEventListener('mousedown', function(e) {
            x = e.clientX; w = parseInt(window.getComputedStyle(col).width, 10);
            document.addEventListener('mousemove', mouseMoveHandler); document.addEventListener('mouseup', mouseUpHandler); resizer.classList.add('resizing');
        });
        const mouseMoveHandler = function(e) { const dx = e.clientX - x; col.style.width = `${w + dx}px`; col.style.minWidth = `${w + dx}px`; };
        const mouseUpHandler = function() { document.removeEventListener('mousemove', mouseMoveHandler); document.removeEventListener('mouseup', mouseUpHandler); resizer.classList.remove('resizing'); };
    });
};
