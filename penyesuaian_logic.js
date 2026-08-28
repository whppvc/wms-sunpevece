let dataPenyesuaian = []; 
let deletedStack = []; 
let globalRowId = 0;

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

function formatPanjang(pjg) {
    if (!pjg || pjg === '-') return '-';
    let str = String(pjg).trim().toUpperCase();
    if (!str.endsWith('M')) str += 'M';
    return str;
}

window.autoEnterScan = function(el) {
    let val = el.value;
    if (val.match(/\/0001( N)?$/)) {
        el.value = val + '\n';
    }
};

document.addEventListener('DOMContentLoaded', async () => { 
    await initModernLayout({ id: 'penyesuaian', title: 'PENYESUAIAN STOK', url: 'penyesuaian.html' }); 
    
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

    await loadMasterKamus();
    renderTable();
});

window.toggleMoreMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('dropup-more');
    if(menu) menu.classList.toggle('hidden');
};

window.bukaModalAdd = function() {
    const modal = document.getElementById('modal-add-scan');
    if(modal) modal.classList.remove('hidden');
    const inp = document.getElementById('input-qrcode');
    if(inp) {
        inp.value = '';
        setTimeout(() => inp.focus(), 100);
    }
};

window.tutupModalAdd = function() {
    const modal = document.getElementById('modal-add-scan');
    if(modal) modal.classList.add('hidden');
};

window.toggleSidebarFilter = function() {
    document.getElementById('sidebar-filter').classList.toggle('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.toggle('hidden');
};

window.tutupPopups = function() {
    const sidebar = document.getElementById('sidebar-filter');
    const overlay = document.getElementById('overlay-klik-luar');
    if(sidebar) sidebar.classList.add('translate-x-full');
    if(overlay) overlay.classList.add('hidden');
    window.tutupModalAdd();
    document.getElementById('modal-sesuaikan').classList.add('hidden');
};

async function loadMasterKamus() {
    try {
        const { data: mData2 } = await db.from('master_2').select('*');
        if(mData2) {
            if(!window.masterData) window.masterData = {};
            window.masterData.kamus = mData2;
        }
    } catch (err) { console.error("Gagal muat kamus:", err); }
}

// ==========================================
// LOGIKA SCAN INPUT
// ==========================================
document.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'form-scan') {
        e.preventDefault();
        const inputEl = document.getElementById('input-qrcode');
        const rawInput = inputEl.value.trim();
        if(!rawInput) return;

        const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
        
        codes.forEach(code => {
            const isLocalDuplicate = dataPenyesuaian.some(d => d.qrcode === code);
            const trans = window.translateBarcode(code);
            
            dataPenyesuaian.unshift({ 
                id: ++globalRowId, 
                qrcode: code, 
                area: '?',
                customer_aktual_db: '-',
                keterangan_db: '-',
                id_sku: '-',
                status: 'BELUM CEK', 
                isLocalDuplicate: isLocalDuplicate,
                db_data: null,
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

function renderTable() {
    const tbody = document.getElementById('tbody-penyesuaian');
    if(!tbody) return;

    if(dataPenyesuaian.length === 0) {
        tbody.innerHTML = '<div class="p-10 text-center font-medium text-slate-400 h-full flex flex-col items-center justify-center"><i data-lucide="sliders-horizontal" class="w-12 h-12 mx-auto mb-3 opacity-30"></i> Belum ada data di-scan.</div>';
        const lbl = document.getElementById('lbl-tampil-baris');
        if(lbl) lbl.innerText = '0';
        updateFilterDropdowns(); 
        if(typeof lucide !== 'undefined') lucide.createIcons(); 
        return;
    }
    
    let html = '';
    let count = dataPenyesuaian.length;

    dataPenyesuaian.forEach((d) => {
        let badgeClass = "bg-slate-200 text-slate-700 border-slate-300";
        let displayStatus = d.status;

        if(d.status === 'VALID') {
            badgeClass = "bg-emerald-600 text-white border-emerald-700"; 
        } 
        else if(['TIDAK DITEMUKAN', 'DUPLIKAT SCAN'].includes(d.status)) {
            badgeClass = "bg-red-600 text-white border-red-800"; 
        }

        if(d.status === 'BELUM CEK' && d.isLocalDuplicate) {
            badgeClass = "bg-red-600 text-white border-red-800";
            displayStatus = "DUPLIKAT SCAN";
        }

        const isRedHighlight = ['TIDAK DITEMUKAN', 'DUPLIKAT SCAN'].includes(d.status) || d.isLocalDuplicate;
        const rowClass = isRedHighlight ? 'bg-red-50 border-red-200' : 'bg-white border-slate-300';
        const areaColor = d.area === '?' ? 'text-slate-400' : 'text-emerald-700';

        html += `
            <div class="row-penyesuaian ${rowClass} border rounded-xl p-4 mb-3 relative transition w-full flex flex-col shadow-sm">
                
                <div class="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-lg shadow-inner">${count--}</div>
                        <div class="flex flex-col">
                            <span class="font-black text-xl ${areaColor} leading-none uppercase col-area">${d.area}</span>
                            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Area Gudang</span>
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
                        <span class="text-sm font-bold text-slate-700"><span class="col-tgl">${d.tglProduksi}</span> - <span class="col-mesin">${d.mesin}</span> - <span class="col-shift">${d.shift}</span></span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-slate-400 uppercase">Customer Aktual</span>
                        <span class="text-sm font-bold text-orange-600 uppercase col-customer">${d.customer_aktual_db !== '-' ? d.customer_aktual_db : d.customer}</span>
                    </div>
                    <div class="flex flex-col col-span-2 bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <span class="text-[10px] font-black text-blue-500 uppercase mb-0.5">Spesifikasi Item</span>
                        <span class="text-base font-black text-slate-900 leading-snug">
                            <span class="col-nama">${d.namaItem}</span> - <span class="col-pjg">${d.panjang}</span> - <span class="col-grade">${d.grade}</span> - <span class="col-dus">${d.dus}</span>
                            <span class="col-jenis hidden">${d.jenisItem}</span>
                        </span>
                        <span class="text-xs font-bold text-blue-700 mt-0.5">Shading: <span class="col-shading">${d.shading}</span></span>
                    </div>
                    <div class="flex flex-col col-span-2">
                        <span class="text-[10px] font-black text-slate-400 uppercase">Keterangan Saat Ini</span>
                        <span class="text-xs font-bold text-slate-700 col-ket">${d.keterangan_db}</span>
                    </div>
                </div>
                
                <div class="flex flex-row justify-start items-center mt-auto pt-2 border-t border-slate-100">
                    <span class="font-bold px-3 py-1.5 text-xs rounded-md border col-status ${badgeClass} shadow-sm">${displayStatus}</span>
                </div>
            </div>
        `;
    });
    
    tbody.innerHTML = html; 
    const lbl = document.getElementById('lbl-tampil-baris');
    if(lbl) lbl.innerText = dataPenyesuaian.length;
    
    updateFilterDropdowns(); 
    if(typeof lucide !== 'undefined') lucide.createIcons(); 
}

function updateFilterDropdowns() {
    const fields = {
        'fs-status': 'status', 
        'fs-area': 'area',
        'fs-tgl': 'tglProduksi',
        'fs-mesin': 'mesin',
        'fs-shift': 'shift',
        'fs-jenis': 'jenisItem',
        'fs-nama': 'namaItem',
        'fs-pjg': 'panjang',
        'fs-grade': 'grade',
        'fs-dus': 'dus',
        'fs-shading': 'shading',
        'fs-customer': 'customer'
    };

    for (let id in fields) {
        const select = document.getElementById(id);
        if (!select) continue;
        
        const currentVal = select.value; 
        const key = fields[id];
        
        let uniqueVals = [...new Set(dataPenyesuaian.map(item => item[key] || '-'))].sort();
        
        let html = '<option value="">-- Semua --</option>';
        uniqueVals.forEach(val => { html += `<option value="${val}">${val}</option>`; });
        
        select.innerHTML = html;
        if (uniqueVals.includes(currentVal)) select.value = currentVal;
    }
}

function highlightRow(cb) {
    const div = cb.closest('.row-penyesuaian');
    if (div) {
        if (cb.checked) div.classList.add('border-blue-500', 'bg-blue-50');
        else div.classList.remove('border-blue-500', 'bg-blue-50');
    }
}

function toggleAll(checked) { 
    document.querySelectorAll('.row-cb').forEach(cb => {
        const row = cb.closest('.row-penyesuaian');
        if (row && row.style.display !== 'none') {
            cb.checked = checked;
            highlightRow(cb);
        }
    }); 
}

function hapusBaris(id) {
    const removed = dataPenyesuaian.find(d => d.id === id);
    if(removed) {
        deletedStack.push([removed]);
        dataPenyesuaian = dataPenyesuaian.filter(d => d.id !== id);
        renderTable();
    }
}

window.undoHapus = function() {
    if(deletedStack.length === 0) return alert("Tidak ada histori penghapusan yang dapat di-undo.");
    const last = deletedStack.pop();
    dataPenyesuaian = [...last, ...dataPenyesuaian]; 
    renderTable();
};

window.resetLayar = function() {
    if(dataPenyesuaian.length === 0) return;
    if(!confirm("Bersihkan seluruh antrean scan di layar?")) return;
    dataPenyesuaian = [];
    renderTable();
};

window.resetFilterPenyesuaian = function() {
    const ids = ['fs-status','fs-area','fs-qr','fs-tgl','fs-mesin','fs-shift','fs-jenis','fs-nama','fs-pjg','fs-grade','fs-dus','fs-shading','fs-customer'];
    ids.forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    window.saringTabelPenyesuaian(); 
    window.toggleSidebarFilter();
};

window.saringTabelPenyesuaian = function() {
    const f = {
        status: document.getElementById('fs-status')?.value || '',
        area: document.getElementById('fs-area')?.value || '',
        qr: document.getElementById('fs-qr')?.value.toLowerCase() || '',
        tgl: document.getElementById('fs-tgl')?.value || '',
        mesin: document.getElementById('fs-mesin')?.value || '',
        shift: document.getElementById('fs-shift')?.value || '',
        jenis: document.getElementById('fs-jenis')?.value || '',
        nama: document.getElementById('fs-nama')?.value || '',
        pjg: document.getElementById('fs-pjg')?.value || '',
        grade: document.getElementById('fs-grade')?.value || '',
        dus: document.getElementById('fs-dus')?.value || '',
        shading: document.getElementById('fs-shading')?.value || '',
        customer: document.getElementById('fs-customer')?.value || ''
    };

    let visibleCount = 0;
    document.querySelectorAll('.row-penyesuaian').forEach(row => {
        let show = true;
        
        const exactFields = ['status', 'area', 'tgl', 'mesin', 'shift', 'jenis', 'nama', 'pjg', 'grade', 'dus', 'shading', 'customer'];
        for(let key of exactFields) {
            if(f[key]) {
                const cell = row.querySelector('.col-' + key);
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
    const lbl = document.getElementById('lbl-tampil-baris');
    if(lbl) lbl.innerText = visibleCount;
};

// ==========================================
// 1. VERIFIKASI KE STOK_GLOBAL
// ==========================================
window.verifikasiPenyesuaian = async function() {
    if(dataPenyesuaian.length === 0) return alert("Belum ada data di-scan.");
    const btn = document.getElementById('btn-verifikasi'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 sm:w-5 sm:h-5"></i> Cek...'; btn.disabled = true;

    const allQRs = dataPenyesuaian.map(d => d.qrcode);
    try {
        const { data: resGlobal, error } = await db.from('stok_global').select('*').in('qrcode', allQRs);
        if(error) throw error;

        const globalMap = {}; 
        (resGlobal || []).forEach(d => globalMap[d.qrcode] = d);

        let notFoundCount = 0;
        let validCount = 0;

        dataPenyesuaian.forEach(d => {
            if (d.isLocalDuplicate) {
                d.status = 'DUPLIKAT SCAN';
                return;
            }

            let found = globalMap[d.qrcode];
            if (found) {
                d.status = 'VALID';
                d.area = found.area || '-';
                d.customer_aktual_db = found.customer_aktual || '-';
                d.keterangan_db = found.keterangan || '-';
                d.id_sku = found.id_sku || '-';
                d.db_data = found; 
                validCount++;
            } else {
                d.status = 'TIDAK DITEMUKAN';
                d.area = '?';
                d.customer_aktual_db = '-';
                d.keterangan_db = '-';
                notFoundCount++;
            }
        });

        renderTable();

        if (notFoundCount > 0) {
            alert(`Verifikasi Selesai!\n⚠️ Terdapat ${notFoundCount} item yang TIDAK DITEMUKAN di stok_global.`);
        } else {
            alert(`✅ Verifikasi Selesai! Semua data VALID (${validCount} dus) dan siap disesuaikan.`);
        }

    } catch (err) { alert("Gagal cek database: " + err.message); }
    finally { btn.innerHTML = ori; btn.disabled = false; if(typeof lucide !== 'undefined') lucide.createIcons(); }
};

// ==========================================
// 2. BUKA MODAL SESUAIKAN
// ==========================================
window.bukaModalSesuaikan = function() {
    const validItems = dataPenyesuaian.filter(d => d.status === 'VALID');
    if(validItems.length === 0) {
        return alert("Tidak ada item berstatus VALID (Hijau) untuk disesuaikan. Klik 'Verifikasi' terlebih dahulu.");
    }

    document.getElementById('lbl-jml-valid').innerText = validItems.length;
    document.getElementById('input-nilai-baru').value = '';
    document.getElementById('modal-sesuaikan').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-nilai-baru').focus(), 100);
};

// ==========================================
// 3. EKSEKUSI PENYESUAIAN (STOK_GLOBAL & STOK_AKTUAL INCREMENTAL)
// ==========================================
window.aturkanPenyesuaian = async function() {
    const variabelTarget = document.getElementById('select-variabel').value;
    const nilaiBaru = document.getElementById('input-nilai-baru').value.trim() || '-';
    
    const validItems = dataPenyesuaian.filter(d => d.status === 'VALID');
    if(validItems.length === 0) return alert("Tidak ada item valid!");

    if(!confirm(`Yakin ingin menyesuaikan ${variabelTarget.toUpperCase()} menjadi "${nilaiBaru}" untuk ${validItems.length} kardus ini?`)) return;

    const btn = document.getElementById('btn-submit-sesuaikan');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...';
    btn.disabled = true;

    try {
        let deductMap = {};
        let addMap = {};
        let qrsToUpdate = [];

        validItems.forEach(item => {
            let d = item.db_data;
            if(!d) return;

            qrsToUpdate.push(d.qrcode);
            let pjgFormatted = formatPanjang(d.panjang);
            let oldKet = d.keterangan || '-';
            let newKet = nilaiBaru;

            // Buat ID SKU baru dengan keterangan baru
            let new_id_sku = `${d.area}_${d.nama_item}_${pjgFormatted}_${d.grade}_${d.dus}_${d.shading}_${newKet}_${d.customer_aktual}_${d.kondisi || 'Aman'}`;

            // Map untuk Pengurangan (Deduct) stok_aktual
            let keyOld = `${d.nama_item}_${pjgFormatted}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${d.customer_aktual}_${oldKet}_${d.kondisi || 'Aman'}`;
            if(!deductMap[keyOld]) {
                deductMap[keyOld] = {
                    nama_item: d.nama_item, panjang: pjgFormatted, grade: d.grade,
                    dus: d.dus, shading: d.shading, area: d.area, customer_aktual: d.customer_aktual,
                    keterangan: oldKet, kondisi: d.kondisi || 'Aman', qty: 0
                };
            }
            deductMap[keyOld].qty++;

            // Map untuk Penambahan (Add) stok_aktual
            let keyNew = `${d.nama_item}_${pjgFormatted}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${d.customer_aktual}_${newKet}_${d.kondisi || 'Aman'}`;
            if(!addMap[keyNew]) {
                addMap[keyNew] = {
                    id_sku: new_id_sku, jenis_item: d.jenis_item, nama_item: d.nama_item, panjang: pjgFormatted,
                    grade: d.grade, dus: d.dus, shading: d.shading, area: d.area,
                    customer_aktual: d.customer_aktual,
                    customer_estimasi: d.customer_aktual,
                    keterangan: newKet, kondisi: d.kondisi || 'Aman', qty: 0
                };
            }
            addMap[keyNew].qty++;
        });

        // 1. UPDATE STOK_GLOBAL (Perbarui kolom keterangan & id_sku fisik)
        for (let key in addMap) {
            let a = addMap[key];
            let qrs = validItems.filter(v => v.db_data.nama_item === a.nama_item && formatPanjang(v.db_data.panjang) === a.panjang && v.db_data.grade === a.grade && v.db_data.dus === a.dus && v.db_data.shading === a.shading && v.db_data.area === a.area).map(v => v.qrcode);
            
            if(qrs.length > 0) {
                const { error: errGlobal } = await db.from('stok_global')
                    .update({ keterangan: nilaiBaru, id_sku: a.id_sku })
                    .in('qrcode', qrs);
                if(errGlobal) throw errGlobal;
            }
        }

        // 2. INCREMENTAL UPDATE STOK_AKTUAL: PENGURANGAN SALDO LAMA
        for (let key in deductMap) {
            let u = deductMap[key];
            const { data: extOld } = await db.from('stok_aktual').select('id, qty, customer_estimasi')
                .eq('nama_item', u.nama_item).eq('panjang', u.panjang).eq('grade', u.grade)
                .eq('dus', u.dus).eq('shading', u.shading).eq('area', u.area)
                .eq('customer_aktual', u.customer_aktual).eq('keterangan', u.keterangan)
                .is('konversi', null)
                .limit(1);

            if (extOld && extOld.length > 0) {
                let newQty = extOld[0].qty - u.qty;
                if (newQty <= 0) {
                    await db.from('stok_aktual').delete().eq('id', extOld[0].id);
                } else {
                    await db.from('stok_aktual').update({ qty: newQty }).eq('id', extOld[0].id);
                }
            }
        }

        // 3. INCREMENTAL UPDATE STOK_AKTUAL: PENAMBAHAN SALDO BARU
        for (let key in addMap) {
            let a = addMap[key];
            const { data: extNew } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', a.nama_item).eq('panjang', a.panjang).eq('grade', a.grade)
                .eq('dus', a.dus).eq('shading', a.shading).eq('area', a.area)
                .eq('customer_aktual', a.customer_aktual).eq('keterangan', a.keterangan)
                .is('konversi', null)
                .limit(1);

            if (extNew && extNew.length > 0) {
                await db.from('stok_aktual').update({ qty: extNew[0].qty + a.qty }).eq('id', extNew[0].id);
            } else {
                await db.from('stok_aktual').insert([a]);
            }
        }

        alert(`✅ BERHASIL!\n${validItems.length} kardus telah disesuaikan keterangannya menjadi "${nilaiBaru}".`);
        
        // Hapus item yang sudah berhasil disesuaikan dari layar
        dataPenyesuaian = dataPenyesuaian.filter(d => d.status !== 'VALID');
        renderTable();
        document.getElementById('modal-sesuaikan').classList.add('hidden');

    } catch (e) {
        alert("Gagal melakukan penyesuaian: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
};
