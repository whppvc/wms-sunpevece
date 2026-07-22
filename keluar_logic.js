let dataKeluar = []; 
let deletedKeluarStack = []; 
let masterKamus = [];
let globalRowId = 0;

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

// Helper Format Panjang
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

    await loadInitialData();
});

window.bukaModalAdd = function() {
    document.getElementById('input-qrcode').value = '';
    document.getElementById('modal-add-scan').classList.remove('hidden');
};

window.tutupModalAdd = function() {
    document.getElementById('modal-add-scan').classList.add('hidden');
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
        const inputEl = document.getElementById('input-qrcode');
        const rawInput = inputEl.value.trim();
        
        if(!customerKeluar) return alert("Pilih Customer Keluar (Tujuan) terlebih dahulu!");
        if(!rawInput) return;

        const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
        
        codes.forEach(code => {
            const isLocalDuplicate = dataKeluar.some(d => d.qrcode === code);
            const trans = window.translateBarcode(code);
            
            dataKeluar.push({ 
                id: ++globalRowId, 
                qrcode: code, 
                customer_keluar: customerKeluar,
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
        tutupModalAdd(); 
        
        const scrollContainer = document.getElementById('scroll-container');
        if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
});

function renderTable() {
    const tbody = document.getElementById('tbody-keluar');
    if(dataKeluar.length === 0) {
        tbody.innerHTML = '<div class="p-10 text-center font-medium text-slate-400"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data di-scan.</div>';
        document.getElementById('lbl-tampil-baris').innerText = '0';
        updateFilterDropdowns(); 
        lucide.createIcons(); return;
    }
    
    let html = '';
    let count = 1;

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
        const rowClass = isRedHighlight ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-slate-50';

        // Logika Tombol Pinjam
        let pinjamHtml = '';
        if (d.status_verif === 'VERIFIED') {
            if (d.need_pinjam_aktual) {
                if (d.is_pinjam_aktual) {
                    pinjamHtml = `
                        <div class="mt-2 flex items-center justify-between bg-orange-50 border border-orange-200 p-1.5 rounded">
                            <span class="text-[10px] font-bold text-orange-800">Pinjam Aktual (Potong Est: ${d.pinjam_estimasi_selected})</span>
                            <button onclick="togglePinjamAktual(${d.id})" class="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[9px] rounded transition uppercase">Cancel</button>
                        </div>`;
                } else {
                    pinjamHtml = `
                        <div class="mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
                            <p class="text-[10px] text-orange-800 font-bold mb-1">Customer Aktual tidak sesuai! (Fisik: ${d.customer_aktual_db})</p>
                            <button onclick="togglePinjamAktual(${d.id})" class="w-full py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] rounded shadow-sm transition uppercase">Pinjam Customer Aktual</button>
                        </div>`;
                }
            } else if (d.need_pinjam_estimasi) {
                if (d.pinjam_estimasi_selected) {
                    pinjamHtml = `
                        <div class="mt-2 flex items-center justify-between bg-indigo-50 border border-indigo-200 p-1.5 rounded">
                            <span class="text-[10px] font-bold text-indigo-800">Dipinjam dari Est: ${d.pinjam_estimasi_selected}</span>
                            <button onclick="bukaModalPinjamEstimasi(${d.id}, false)" class="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9px] rounded transition uppercase">Ubah</button>
                        </div>`;
                } else {
                    pinjamHtml = `
                        <div class="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded">
                            <p class="text-[10px] text-indigo-800 font-bold mb-1">Customer Estimasi berbeda!</p>
                            <button onclick="bukaModalPinjamEstimasi(${d.id}, false)" class="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded shadow-sm transition uppercase">Pilih Pinjam Customer</button>
                        </div>`;
                }
            }
        }

        html += `
            <div class="row-keluar ${rowClass} border-b border-slate-300 p-2.5 relative transition w-full flex shrink-0">
                <div class="flex flex-col items-center justify-start pr-2 mr-2 border-r border-slate-300 w-10 shrink-0 pt-1">
                    <div class="font-black text-slate-800 text-xl mb-3 leading-none no-cell">${count++}</div>
                    <input type="checkbox" value="${d.id}" onchange="highlightRow(this)" class="row-cb cursor-pointer w-4 h-4 accent-blue-600 rounded bg-white border-slate-400">
                </div>
                
                <div class="flex-1 flex flex-col gap-0 w-full min-w-0">
                    <div class="flex justify-between items-start mb-0.5">
                        <div class="font-black text-[16px] text-rose-700 leading-none col-cust-keluar uppercase">Tujuan: ${d.customer_keluar}</div>
                        <button onclick="hapusBaris(${d.id})" class="bg-slate-700 text-white p-1.5 rounded hover:bg-rose-600 transition active:scale-95 shrink-0"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                    
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all leading-tight col-qr">${d.qrcode}</div>
                    
                    <div class="text-[12px] font-bold text-slate-600 tracking-tight">
                        <span class="col-tgl">${d.tglProduksi}</span> - <span class="col-mesin">${d.mesin}</span> - <span class="col-shift">${d.shift}</span>
                    </div>
                    
                    <div class="text-[13px] font-black text-slate-900 leading-snug my-0.5">
                        <span class="col-nama">${d.namaItem}</span> - <span class="col-pjg">${d.panjang}</span> - <span class="col-grade">${d.grade}</span> - <span class="col-dus">${d.dus}</span>
                        <span class="col-jenis hidden">${d.jenisItem}</span>
                    </div>
                    
                    <div class="text-[12px] font-bold text-blue-600 col-shading">${d.shading}</div>
                    
                    <div class="mt-1 flex flex-col gap-0.5">
                        <div class="text-[11px] font-bold text-slate-500">Cust Aktual: <span class="text-orange-600 col-cust-aktual">${d.customer_aktual_db !== '-' ? d.customer_aktual_db : d.customerBawaan}</span></div>
                        <div class="text-[11px] font-bold text-slate-500">Cust Estimasi: <span class="text-purple-600 col-cust-estimasi">${d.customer_estimasi_db}</span></div>
                    </div>
                    
                    <div class="flex flex-row flex-wrap items-center gap-1.5 mt-1.5">
                        <span class="font-bold px-3 py-1 text-[10px] rounded-sm border col-status ${badgeClass}">${displayStatus}</span>
                        ${d.area !== '-' ? `<span class="font-bold px-2 py-1 text-[10px] rounded-sm bg-slate-100 text-slate-600 border border-slate-300">Area: ${d.area}</span>` : ''}
                    </div>

                    ${pinjamHtml}
                </div>
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
        if (cb.checked) div.classList.add('selected-row');
        else div.classList.remove('selected-row');
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

function getCheckedIds() {
    const ids = []; document.querySelectorAll('.row-cb:checked').forEach(cb => ids.push(parseInt(cb.value))); return ids;
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
    dataKeluar = [...dataKeluar, ...last]; 
    renderTable();
}

window.toggleSidebarFilter = function() {
    document.getElementById('sidebar-filter').classList.toggle('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.toggle('hidden');
}

window.tutupPopups = function() {
    document.getElementById('sidebar-filter').classList.add('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    window.tutupModalAdd();
    window.tutupModalPinjamEstimasi();
}

window.resetFilterKeluar = function() {
    const ids = ['fs-status','fs-cust-keluar','fs-cust-aktual','fs-cust-estimasi','fs-qr','fs-jenis','fs-nama','fs-pjg','fs-grade','fs-dus','fs-shading'];
    ids.forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    window.saringTabelKeluar(); window.toggleSidebarFilter();
}

window.saringTabelKeluar = function() {
    const f = {
        status: document.getElementById('fs-status')?.value || '',
        cust: document.getElementById('fs-cust-keluar')?.value || '',
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
        
        const exactFields = ['status', 'cust', 'custAktual', 'custEstimasi', 'jenis', 'nama', 'pjg', 'grade', 'dus', 'shading'];
        const classMap = { status: 'col-status', cust: 'col-cust-keluar', custAktual: 'col-cust-aktual', custEstimasi: 'col-cust-estimasi', jenis: 'col-jenis', nama: 'col-nama', pjg: 'col-pjg', grade: 'col-grade', dus: 'col-dus', shading: 'col-shading' };
        
        for(let key of exactFields) {
            if(f[key]) {
                const cell = row.querySelector('.' + classMap[key]);
                if(cell) {
                    let text = cell.innerText.trim();
                    if(key === 'cust') text = text.replace('Tujuan: ', '').trim();
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
}

// ==========================================
// VERIFIKASI GUDANG & PINJAM CUSTOMER
// ==========================================
window.verifikasiKeluar = async function() {
    if(dataKeluar.length === 0) return alert("Belum ada data.");
    const btn = document.getElementById('btn-verifikasi'); const ori = btn.innerHTML;
    btn.innerHTML = '<div class="bg-slate-900 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="loader-2" class="animate-spin w-4 h-4"></i></div><div class="bg-slate-800 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-slate-700 transition">Mengecek...</div>'; btn.disabled = true;

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
                
                // Format Panjang
                d.panjang = formatPanjang(d.panjang);

                // Cek Kesesuaian Customer
                if (d.customer_keluar !== d.customer_aktual_db) {
                    d.need_pinjam_aktual = true;
                    d.need_pinjam_estimasi = false;
                    // REVISI: Tambahkan ke specsToCheck agar kita tahu estimasi apa saja yang tersedia untuk aktual ini
                    specsToCheck.add(`${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${d.customer_aktual_db}`);
                } else {
                    d.need_pinjam_aktual = false;
                    d.need_pinjam_estimasi = true; // Flag to check estimasi later
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
                    // Grouping by customer_estimasi to sum qty
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
                    
                    // Format for UI
                    let estArr = availableEst.map(a => `${a.customer_estimasi} (${a.qty})`);
                    d.customer_estimasi_db = estArr.length > 0 ? estArr.join(' | ') : 'KOSONG';

                    if (d.need_pinjam_estimasi) {
                        let isMatch = availableEst.some(a => a.customer_estimasi === d.customer_keluar);
                        if (isMatch) {
                            d.need_pinjam_estimasi = false; // All good
                            d.pinjam_estimasi_selected = d.customer_keluar; // Auto select
                        }
                    }
                }
            });
        }

        renderTable();
        alert(`Verifikasi Selesai!`);

    } catch (err) { alert("Gagal cek database: " + err.message); }
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

window.togglePinjamAktual = function(id) {
    const item = dataKeluar.find(d => d.id === id);
    if(!item) return;

    if (item.is_pinjam_aktual) {
        // Batal Pinjam
        item.is_pinjam_aktual = false;
        item.pinjam_estimasi_selected = '';
        renderTable();
    } else {
        // Mau Pinjam Aktual
        if (item.available_estimasi.length === 0) {
            alert("Stok tidak ditemukan di Kartu Stok!");
            return;
        } else if (item.available_estimasi.length === 1) {
            // Auto select jika hanya 1
            item.is_pinjam_aktual = true;
            item.pinjam_estimasi_selected = item.available_estimasi[0].customer_estimasi;
            renderTable();
        } else {
            // Munculkan popup jika lebih dari 1
            bukaModalPinjamEstimasi(id, true);
        }
    }
}

window.bukaModalPinjamEstimasi = function(id, isPinjamAktual = false) {
    const item = dataKeluar.find(d => d.id === id);
    if(!item) return;

    document.getElementById('pinjam-id-item').value = id;
    document.getElementById('pinjam-is-aktual').value = isPinjamAktual ? 'true' : 'false';
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
}

window.tutupModalPinjamEstimasi = function() {
    document.getElementById('modal-pinjam-estimasi').classList.add('hidden');
}

window.simpanPinjamEstimasi = function() {
    const id = parseInt(document.getElementById('pinjam-id-item').value);
    const isPinjamAktual = document.getElementById('pinjam-is-aktual').value === 'true';
    const selectedEst = document.getElementById('select-pinjam-estimasi').value;
    
    if(!selectedEst) return alert("Pilih Customer Estimasi!");

    const item = dataKeluar.find(d => d.id === id);
    if(item) {
        item.pinjam_estimasi_selected = selectedEst;
        if (isPinjamAktual) {
            item.is_pinjam_aktual = true;
        }
        renderTable();
        tutupModalPinjamEstimasi();
    }
}

// ==========================================
// SIMPAN KELUAR (DEDUCT INCREMENTAL JSON RPC)
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
            targetEstimasiDeduct = d.customer_keluar; // Fallback
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
            customer_keluar: d.customer_keluar
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

        alert(`BERHASIL DISIMPAN!\n${payloadKeluar.length} Barang telah diproses keluar.`);
        dataKeluar = []; renderTable();
        document.getElementById('cb-all').checked = false;
        
    } catch (err) { 
        alert('GAGAL MENYIMPAN: ' + err.message); 
    } finally { 
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); 
    }
}
