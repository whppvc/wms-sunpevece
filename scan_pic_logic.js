let dataPindah = [];
let deletedStack = [];
let masterArea = [];
let globalRowId = 0;

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

// Helper Format Panjang
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

document.addEventListener('DOMContentLoaded', async () => { 
    initModernLayout({ id: 'scan_pic', title: 'PINDAH AREA', url: 'scan_pic.html' }); 
    
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

    await loadMasterArea();
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

async function loadMasterArea() {
    try {
        const { data } = await db.from('master_area').select('*');
        if(data) {
            masterArea = [...new Set(data.map(r => r.nama_area || r.area).filter(x => x))].sort();
            const sel = document.getElementById('select-area-target');
            if(sel) {
                sel.innerHTML = '<option value="">-- PILIH AREA TUJUAN --</option>';
                masterArea.forEach(a => sel.innerHTML += `<option value="${a}">${a}</option>`);
            }
        }
    } catch (err) { console.error("Gagal muat area:", err); }
}

// ==========================================
// LOGIKA SCAN & RENDER CARD
// ==========================================
document.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'form-scan') {
        e.preventDefault();
        const inputEl = document.getElementById('input-qrcode');
        const rawInput = inputEl.value.trim();
        
        if(!rawInput) return;

        const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
        
        codes.forEach(code => {
            const isLocalDuplicate = dataPindah.some(d => d.qrcode === code);
            const trans = window.translateBarcode(code);
            
            dataPindah.unshift({ 
                id: ++globalRowId, 
                qrcode: code, 
                area_sekarang: '?', 
                status: 'BELUM CEK', 
                isLocalDuplicate: isLocalDuplicate,
                db_data: null, // Menyimpan data asli dari stok_global nanti
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
    const tbody = document.getElementById('tbody-pindah');
    if(dataPindah.length === 0) {
        tbody.innerHTML = '<div class="p-10 text-center font-medium text-slate-400 h-full flex flex-col items-center justify-center"><i data-lucide="arrow-left-right" class="w-12 h-12 mx-auto mb-3 opacity-30"></i> Belum ada data di-scan.</div>';
        document.getElementById('lbl-total-qty').innerText = '0';
        lucide.createIcons(); return;
    }
    
    let html = '';
    let count = dataPindah.length;

    dataPindah.forEach((d) => {
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

        let areaColor = d.area_sekarang === '?' ? 'text-slate-400' : 'text-indigo-700';

        html += `
            <div class="row-pindah ${rowClass} border rounded-xl p-4 mb-3 relative transition w-full flex flex-col shadow-sm">
                
                <div class="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-lg shadow-inner">${count--}</div>
                        <div class="flex flex-col">
                            <span class="font-black text-xl ${areaColor} leading-none uppercase">${d.area_sekarang}</span>
                            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Area Saat Ini</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <input type="checkbox" value="${d.id}" onchange="highlightRow(this)" class="row-cb cursor-pointer w-5 h-5 accent-indigo-600 rounded bg-white border-slate-400">
                        <button onclick="hapusBaris(${d.id})" class="bg-slate-100 text-slate-500 p-2 rounded-lg hover:bg-rose-600 hover:text-white transition active:scale-95 shrink-0 border border-slate-200"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
                
                <div class="flex flex-col gap-1 mb-3">
                    <div class="font-mono font-black text-slate-900 text-base break-all leading-tight bg-slate-100 p-2 rounded-lg border border-slate-200 text-center">${d.qrcode}</div>
                </div>
                
                <div class="grid grid-cols-2 gap-x-2 gap-y-3 mb-3">
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-slate-400 uppercase">Produksi</span>
                        <span class="text-sm font-bold text-slate-700">${d.tglProduksi} - ${d.mesin} - ${d.shift}</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-slate-400 uppercase">Customer Bawaan</span>
                        <span class="text-sm font-bold text-orange-600 uppercase">${d.customer}</span>
                    </div>
                    <div class="flex flex-col col-span-2 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                        <span class="text-[10px] font-black text-indigo-500 uppercase mb-0.5">Spesifikasi Item</span>
                        <span class="text-base font-black text-slate-900 leading-snug">
                            ${d.namaItem} - ${d.panjang} - ${d.grade} - ${d.dus}
                        </span>
                        <span class="text-xs font-bold text-indigo-700 mt-0.5">Shading: ${d.shading}</span>
                    </div>
                </div>
                
                <div class="flex flex-row justify-start items-center mt-auto pt-2 border-t border-slate-100">
                    <span class="font-bold px-3 py-1.5 text-xs rounded-md border ${badgeClass} shadow-sm">${displayStatus}</span>
                </div>
            </div>
        `;
    });
    tbody.innerHTML = html; 
    document.getElementById('lbl-total-qty').innerText = dataPindah.length;
    
    lucide.createIcons(); 
}

function highlightRow(cb) {
    const div = cb.closest('.row-pindah');
    if (div) {
        if (cb.checked) div.classList.add('border-indigo-500', 'bg-indigo-50');
        else div.classList.remove('border-indigo-500', 'bg-indigo-50');
    }
}

function toggleAll(checked) { 
    document.querySelectorAll('.row-cb').forEach(cb => {
        const row = cb.closest('.row-pindah');
        if (row && row.style.display !== 'none') {
            cb.checked = checked;
            highlightRow(cb);
        }
    }); 
}

function hapusBaris(id) {
    const removed = dataPindah.find(d => d.id === id);
    if(removed) {
        deletedStack.push([removed]);
        dataPindah = dataPindah.filter(d => d.id !== id);
        renderTable();
    }
}

window.undoHapus = function() {
    if(deletedStack.length === 0) return alert("Tidak ada histori penghapusan yang dapat di-undo.");
    const last = deletedStack.pop();
    dataPindah = [...last, ...dataPindah]; 
    renderTable();
}

// ==========================================
// VERIFIKASI & PINDAH AREA
// ==========================================
window.verifikasiGudang = async function() {
    if(dataPindah.length === 0) return alert("Belum ada data.");
    const btn = document.getElementById('btn-verifikasi'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 sm:w-5 sm:h-5"></i> Cek...'; btn.disabled = true;

    const allQRs = dataPindah.map(d => d.qrcode);
    try {
        const { data: resGlobal, error } = await db.from('stok_global').select('*').in('qrcode', allQRs);
        if(error) throw error;

        const globalMap = {};
        (resGlobal || []).forEach(d => globalMap[d.qrcode] = d);

        let infoNotFound = 0;

        dataPindah.forEach(d => {
            if (d.isLocalDuplicate) {
                d.status = 'DUPLIKAT SCAN';
            } else if (globalMap[d.qrcode]) {
                d.status = 'VALID';
                d.area_sekarang = globalMap[d.qrcode].area;
                d.db_data = globalMap[d.qrcode]; // Simpan data asli untuk proses pindah
            } else {
                d.status = 'TIDAK DITEMUKAN';
                infoNotFound++;
            }
        });

        renderTable();

        let alertMsg = "Verifikasi Selesai!\n";
        if (infoNotFound > 0) alertMsg += `\n⚠️ Ditemukan ${infoNotFound} item yang TIDAK ADA di Gudang.`;
        if (infoNotFound === 0) alertMsg += "\n✅ Semua data VALID dan siap dipindahkan.";
        
        alert(alertMsg);

    } catch (err) { alert("Gagal cek database: " + err.message); }
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

window.bukaModalPindah = function() {
    const validItems = dataPindah.filter(d => d.status === 'VALID');
    if(validItems.length === 0) return alert("Tidak ada item berstatus VALID (Hijau) untuk dipindahkan. Lakukan Verifikasi terlebih dahulu.");
    
    document.getElementById('lbl-jml-pindah').innerText = validItems.length;
    document.getElementById('select-area-target').value = '';
    document.getElementById('modal-pilih-area').classList.remove('hidden');
}

window.eksekusiPindahArea = async function() {
    const targetArea = document.getElementById('select-area-target').value;
    if(!targetArea) return alert("Pilih Area Tujuan terlebih dahulu!");

    const validItems = dataPindah.filter(d => d.status === 'VALID');
    if(!confirm(`Yakin ingin memindahkan ${validItems.length} kardus ke area "${targetArea}"?`)) return;

    const btn = document.getElementById('btn-eksekusi-pindah'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true;

    let deductMap = {};
    let addMap = {};
    let logPindah = [];
    let qrsToUpdate = [];

    try {
        for(let item of validItems) {
            let dbItem = item.db_data;
            if(!dbItem) continue;

            let oldArea = dbItem.area;
            let oldSku = dbItem.id_sku;
            qrsToUpdate.push(dbItem.qrcode);
            
            // Buat SKU baru (Ganti segmen pertama dengan area baru)
            let parts = oldSku.split('_');
            parts[0] = targetArea;
            let newSku = parts.join('_');
            
            // Map untuk Deduct (Kurangi dari area lama)
            let keyOld = `${dbItem.nama_item}_${dbItem.panjang}_${dbItem.grade}_${dbItem.dus}_${dbItem.shading}_${oldArea}_${dbItem.customer_aktual}_${dbItem.customer_estimasi}_${dbItem.keterangan}_${dbItem.kondisi}`;
            if(!deductMap[keyOld]) deductMap[keyOld] = {...dbItem, qty: 0};
            deductMap[keyOld].qty++;
            
            // Map untuk Add (Tambah ke area baru)
            let keyNew = `${dbItem.nama_item}_${dbItem.panjang}_${dbItem.grade}_${dbItem.dus}_${dbItem.shading}_${targetArea}_${dbItem.customer_aktual}_${dbItem.customer_estimasi}_${dbItem.keterangan}_${dbItem.kondisi}`;
            if(!addMap[keyNew]) addMap[keyNew] = {...dbItem, area: targetArea, id_sku: newSku, qty: 0};
            addMap[keyNew].qty++;
            
            // Catat Log
            logPindah.push({
                qrcode: dbItem.qrcode,
                tgl_produksi: dbItem.tgl_produksi, mesin: dbItem.mesin, shift: dbItem.shift,
                nama_item: dbItem.nama_item, panjang: dbItem.panjang, grade: dbItem.grade,
                dus: dbItem.dus, shading: dbItem.shading, customer: dbItem.customer_aktual,
                keterangan: 'Pindah Area', area_awal: oldArea, area_akhir: targetArea, pic: currentUser.username
            });
        }

        // 1. Update stok_global & stok_qr (Fisik)
        for(let key in addMap) {
            let a = addMap[key];
            let qrs = logPindah.filter(l => l.area_akhir === a.area && l.nama_item === a.nama_item && l.panjang === a.panjang && l.grade === a.grade && l.dus === a.dus && l.shading === a.shading).map(l => l.qrcode);
            
            if(qrs.length > 0) {
                await db.from('stok_global').update({area: a.area, id_sku: a.id_sku}).in('qrcode', qrs);
                await db.from('stok_qr').update({area: a.area, id_sku: a.id_sku}).in('qrcode', qrs);
                await db.from('hasil_stbj_langsir').update({posisi: a.area}).in('qrcode', qrs); // Update juga di riwayat langsir agar sinkron
            }
        }

        // 2. Eksekusi Deduct (stok_aktual)
        for(let key in deductMap) {
            let u = deductMap[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', u.nama_item).eq('panjang', u.panjang).eq('grade', u.grade)
                .eq('dus', u.dus).eq('shading', u.shading).eq('area', u.area)
                .eq('customer_aktual', u.customer_aktual).eq('customer_estimasi', u.customer_estimasi)
                .eq('keterangan', u.keterangan).eq('kondisi', u.kondisi).limit(1);
            
            if(existing && existing.length > 0) {
                let newQty = existing[0].qty - u.qty;
                if (newQty <= 0) await db.from('stok_aktual').delete().eq('id', existing[0].id);
                else await db.from('stok_aktual').update({ qty: newQty }).eq('id', existing[0].id);
            }
        }

        // 3. Eksekusi Add (stok_aktual)
        for(let key in addMap) {
            let a = addMap[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', a.nama_item).eq('panjang', a.panjang).eq('grade', a.grade)
                .eq('dus', a.dus).eq('shading', a.shading).eq('area', a.area)
                .eq('customer_aktual', a.customer_aktual).eq('customer_estimasi', a.customer_estimasi)
                .eq('keterangan', a.keterangan).eq('kondisi', a.kondisi).limit(1);
            
            if(existing && existing.length > 0) {
                await db.from('stok_aktual').update({ qty: existing[0].qty + a.qty }).eq('id', existing[0].id);
            } else {
                await db.from('stok_aktual').insert([{
                    id_sku: a.id_sku, jenis_item: a.jenis_item, nama_item: a.nama_item, panjang: a.panjang, 
                    grade: a.grade, dus: a.dus, shading: a.shading, area: a.area, 
                    customer_aktual: a.customer_aktual, customer_estimasi: a.customer_estimasi, 
                    keterangan: a.keterangan, kondisi: a.kondisi, qty: a.qty
                }]);
            }
        }

        // 4. Insert Log Pindah
        if(logPindah.length > 0) {
            await db.from('barang_pindah').insert(logPindah);
        }

        alert(`✅ SUKSES!\n${validItems.length} kardus berhasil dipindahkan ke area "${targetArea}".`);
        
        // Bersihkan layar dari item yang sukses
        dataPindah = dataPindah.filter(d => d.status !== 'VALID');
        renderTable();
        document.getElementById('modal-pilih-area').classList.add('hidden');

    } catch (err) { 
        alert('GAGAL MEMINDAHKAN AREA: ' + err.message); 
    } finally { 
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); 
    }
}

// ==========================================
// RIWAYAT PINDAH
// ==========================================
window.bukaRiwayatPindah = async function() {
    const tbody = document.getElementById('tbody-riwayat-pindah');
    tbody.innerHTML = `<tr><td colspan="11" class="p-10"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto text-indigo-500"></i></td></tr>`;
    lucide.createIcons();
    document.getElementById('modal-riwayat-pindah').classList.remove('hidden');

    try {
        const { data, error } = await db.from('barang_pindah').select('*').order('created_at', {ascending: false}).limit(100);
        if(error) throw error;
        if(!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="11" class="p-10 font-bold text-slate-400 text-center">Tidak ada riwayat pindah area.</td></tr>`; return; }

        let h = '';
        data.forEach((d, i) => {
            const waktu = formatWIB(d.created_at);
            h += `
                <tr class="border-b hover:bg-slate-50 text-xs transition text-center">
                    <td class="p-2 font-medium text-slate-500">${i+1}</td>
                    <td class="p-2 font-medium text-slate-600">${waktu}</td>
                    <td class="p-2 font-bold text-indigo-600 bg-indigo-50 border-r border-slate-200">${d.area_awal} ➔ ${d.area_akhir}</td>
                    <td class="p-2 font-mono font-medium tracking-wider text-slate-800 border-r border-slate-200">${d.qrcode}</td>
                    <td class="p-2 font-semibold text-blue-600 text-left">${d.nama_item}</td>
                    <td class="p-2 font-medium text-slate-700">${d.panjang}</td>
                    <td class="p-2 font-medium text-slate-700">${d.grade}</td>
                    <td class="p-2 font-medium text-slate-700">${d.dus}</td>
                    <td class="p-2 font-medium text-slate-700 border-r border-slate-200">${d.shading}</td>
                    <td class="p-2 font-semibold text-orange-600">${d.customer}</td>
                    <td class="p-2 uppercase opacity-70 font-bold text-slate-500">${d.pic}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } catch(e) { tbody.innerHTML = `<tr><td colspan="11" class="p-5 text-red-500 text-center">${e.message}</td></tr>`; }
    finally { lucide.createIcons(); }
};
