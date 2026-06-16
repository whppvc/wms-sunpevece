let currentTab = 'kirim';
let masterData = { kamus: [] };
let dataScan = [];
let deleteStack = []; 
let globalRowId = 0;
const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'admin'};

document.addEventListener('DOMContentLoaded', async () => {
    initModernLayout({ id: 'keluar', title: 'BARANG KELUAR', url: 'keluar.html' }); 
    await loadInitialOutboundData();
    
    const formScan = document.getElementById('form-scan');
    if(formScan) {
        formScan.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputEl = document.getElementById('input-qrcode');
            const rawInput = inputEl.value.trim();
            if(!rawInput) return;
            inputEl.value = ''; 
            
            const existingQRs = dataScan.map(d => d.qrcode);
            const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
            
            codes.forEach(code => {
                const isLocalDuplicate = existingQRs.includes(code);
                const td = translateBarcode(code);
                dataScan.unshift({
                    id: ++globalRowId,
                    qrcode: code,
                    status: isLocalDuplicate ? 'DUPLIKAT LOKAL' : 'BELUM CEK',
                    area: '?',
                    poAsliDB: '-',
                    poAktualUI: 'Cek Stok...',
                    ketStbj: '-',
                    ...td
                });
            });
            renderCards();
            
            const scrollContainer = document.getElementById('scroll-container');
            if (scrollContainer) scrollContainer.scrollTop = 0; 
        });
    }
});

async function loadInitialOutboundData() {
    const { data: mData2 } = await db.from('master_2').select('*');
    if(mData2) masterData.kamus = mData2; 
}

function extractPOFromSKU(id_sku) {
    if(!id_sku) return '-';
    const parts = id_sku.split('_');
    return parts.length >= 8 ? parts[7] : '-';
}

function translateBarcode(barcode) {
    const parts = barcode.split('/');
    let data = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', customer: '-' };
    if (parts.length < 4) return data;

    const hurufDepan = barcode.charAt(0).toUpperCase();
    if (hurufDepan === 'P') data.jenisItem = 'Plafon'; else if (hurufDepan === 'L') data.jenisItem = 'List'; else if (hurufDepan === 'W') data.jenisItem = 'WPC'; else data.jenisItem = hurufDepan;

    let rawItem = parts[0];
    let cariItem = masterData.kamus.find(m => m.kode_nama_item === rawItem);
    data.namaItem = cariItem && cariItem.nama_item ? cariItem.nama_item : rawItem;

    data.shading = parts[1];

    const p2 = parts[2];
    if (p2 && p2.length >= 4) {
        let digitPjg = (p2.length === 5) ? 2 : 1; let rawPjg = p2.substring(0, digitPjg);
        data.panjang = (digitPjg === 1) ? rawPjg + "M" : rawPjg[0] + "." + rawPjg[1] + "M"; 
        let rawGrade = p2.substring(digitPjg, digitPjg + 1);
        if (rawGrade === '1') data.grade = 'BAGUS'; else if (rawGrade === '2') data.grade = 'A'; else data.grade = rawGrade;
        let rawDus = p2.substring(p2.length - 2); 
        let cariDus = masterData.kamus.find(m => m.kode_dus === rawDus);
        data.dus = cariDus && cariDus.dus ? cariDus.dus : rawDus;
    }

    const p3 = parts[3];
    if (p3.length >= 5) {
        const dayOfYear = parseInt(p3.substring(0, 3));
        const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
        data.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;

        let sisaString = p3.substring(5); 
        let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        if (match) {
            let rawMesin = match[1]; let rawShift = match[2]; let rawCustomer = match[3];   
            let cariMesin = masterData.kamus.find(m => m.kode_mesin === rawMesin); data.mesin = cariMesin && cariMesin.mesin ? cariMesin.mesin : rawMesin;
            let cariShift = masterData.kamus.find(m => m.kode_shift === rawShift); data.shift = cariShift && cariShift.shift ? cariShift.shift : rawShift;
            let cariCustomer = masterData.kamus.find(m => m.kode_customer === rawCustomer); data.customer = cariCustomer && cariCustomer.customer ? cariCustomer.customer : rawCustomer;
        }
    }
    return data;
}

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('tab-kirim').className = tab === 'kirim' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    document.getElementById('tab-bs').className = tab === 'bs' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    
    const btnProses = document.getElementById('btn-proses-keluar');
    if(tab === 'kirim') {
        btnProses.innerHTML = '<i data-lucide="truck-fast" class="w-5 h-5"></i> PROSES KELUAR BARANG';
        btnProses.className = 'w-full md:w-auto px-8 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-md shadow-sm flex items-center justify-center gap-2 text-sm transition active:scale-95 uppercase border-b-4 border-slate-950';
    } else {
        btnProses.innerHTML = '<i data-lucide="package-x" class="w-5 h-5"></i> PROSES BARANG BS';
        btnProses.className = 'w-full md:w-auto px-8 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-md shadow-sm flex items-center justify-center gap-2 text-sm transition active:scale-95 uppercase border-b-4 border-rose-800';
    }
    lucide.createIcons();
    
    dataScan = [];
    renderCards();
}

function renderCards() {
    const container = document.getElementById('card-container');
    if(dataScan.length === 0) {
        container.innerHTML = '<div class="p-10 text-center font-medium text-slate-400"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data di-scan.</div>';
        document.getElementById('lbl-total-baris').innerText = '0';
        lucide.createIcons(); return;
    }

    let html = '';
    let count = dataScan.length;
    
    dataScan.forEach(d => {
        let badgeStatus = "bg-slate-200 text-slate-500 border-slate-300";
        if(d.status === 'VALID FISIK') badgeStatus = "bg-emerald-100 text-emerald-700 border-emerald-300";
        else if(d.status === 'BLM STBJ / KOSONG' || d.status === 'DUPLIKAT LOKAL') badgeStatus = "bg-red-600 text-white border-red-800 shadow-sm";

        let rowClass = (d.status === 'BLM STBJ / KOSONG' || d.status === 'DUPLIKAT LOKAL') ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-slate-50';

        html += `
            <div class="row-item ${rowClass} border-b border-slate-300 p-2.5 relative transition w-full flex shrink-0" data-qr="${d.qrcode}" data-status="${d.status}" data-nama="${d.namaItem.toLowerCase()}">
                <div class="flex flex-col items-center justify-start pr-2 mr-2 border-r border-slate-300 w-10 shrink-0 pt-1">
                    <div class="font-black text-slate-400 text-sm mb-3 leading-none">${count--}</div>
                </div>
                
                <div class="flex-1 flex flex-col gap-0 w-full min-w-0">
                    <div class="flex justify-between items-start mb-0.5">
                        <div class="font-black text-[22px] ${d.area === '?' || d.area === 'KOSONG' ? 'text-red-600' : 'text-emerald-700'} leading-none">${d.area}</div>
                        <button onclick="deleteRow('${d.qrcode}')" class="bg-white border border-slate-300 text-slate-400 p-1.5 rounded hover:bg-rose-600 hover:text-white hover:border-rose-600 transition active:scale-95 shrink-0"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                    
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all leading-tight">${d.qrcode}</div>
                    
                    <div class="text-[12px] font-bold text-slate-600 tracking-tight">
                        ${d.tglProduksi} - ${d.mesin} - ${d.shift}
                    </div>
                    
                    <div class="text-[13px] font-black text-slate-900 leading-snug my-0.5">
                        <span class="text-blue-600">${d.jenisItem}</span> - ${d.namaItem} - ${d.panjang} - ${d.grade} - ${d.dus}
                    </div>
                    
                    <div class="text-[12px] font-bold text-blue-600">${d.shading}</div>
                    <div class="text-[12px] font-bold text-slate-500">Customer Bawaan: <span class="text-orange-600 uppercase">${d.customer}</span></div>
                    
                    <div class="flex flex-row flex-wrap items-center gap-1.5 mt-1.5">
                        <span class="font-bold px-3 py-1 text-[10px] rounded-sm border ${badgeStatus}">${d.status}</span>
                        <span class="font-bold px-3 py-1 text-[10px] rounded-sm border bg-blue-50 text-blue-700 border-blue-200">Customer Aktual: ${d.poAktualUI}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    document.getElementById('lbl-total-baris').innerText = dataScan.length;
    lucide.createIcons();
}

function deleteRow(qr) {
    const item = dataScan.find(d => d.qrcode === qr);
    if(item) {
        deleteStack.push(item);
        dataScan = dataScan.filter(d => d.qrcode !== qr);
        renderCards();
    }
}

function undoDelete() { 
    if(deleteStack.length === 0) return alert("Belum ada data yang dihapus."); 
    const item = deleteStack.pop(); 
    dataScan.unshift(item);
    renderCards(); 
}

function toggleSidebarFilter() {
    document.getElementById('sidebar-filter').classList.toggle('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.toggle('hidden');
}

function resetFilter() {
    document.getElementById('f-status').value = '';
    document.getElementById('f-qr').value = '';
    document.getElementById('f-nama').value = '';
    saringData();
    toggleSidebarFilter();
}

function saringData() {
    const fStatus = document.getElementById('f-status').value.toLowerCase();
    const fQr = document.getElementById('f-qr').value.toLowerCase();
    const fNama = document.getElementById('f-nama').value.toLowerCase();

    document.querySelectorAll('.row-item').forEach(row => {
        const status = row.getAttribute('data-status').toLowerCase();
        const qr = row.getAttribute('data-qr').toLowerCase();
        const nama = row.getAttribute('data-nama');
        
        if (status.includes(fStatus) && qr.includes(fQr) && nama.includes(fNama)) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
        }
    });
}

async function crossCekOutbound() {
    if(dataScan.length === 0) return alert("Belum ada data untuk dicek.");

    const btnCross = document.getElementById('btn-crosscek'); const originalText = btnCross.innerHTML;
    btnCross.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMVERIFIKASI...'; btnCross.disabled = true;

    const allQRCodes = dataScan.map(d => d.qrcode);
    
    try {
        const [resStok, resStbj] = await Promise.all([
            db.from('stok_qr').select('qrcode, area, id_sku').in('qrcode', allQRCodes),
            db.from('hasil_stbj').select('qrcode, keterangan').in('qrcode', allQRCodes)
        ]);
        
        if(resStok.error) throw resStok.error;

        let dbQRs = resStok.data || [];
        let stbjMap = {};
        if(resStbj.data) resStbj.data.forEach(d => stbjMap[d.qrcode] = d.keterangan || '-');

        let missingCount = 0; let uniqueSpecs = new Set();

        dataScan.forEach(d => {
            if(d.status === 'DUPLIKAT LOKAL') { missingCount++; return; }

            let foundDb = dbQRs.find(x => x.qrcode === d.qrcode);

            if(foundDb) {
                let baseSpec = `${d.jenisItem}_${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}`;
                d.baseSpec = baseSpec; 
                d.area = foundDb.area; 
                d.poAsliDB = extractPOFromSKU(foundDb.id_sku); 
                d.ketStbj = stbjMap[d.qrcode] || '-';
                
                uniqueSpecs.add(baseSpec);
                d.status = 'VALID FISIK';
            } else {
                d.poAsliDB = "-";
                d.status = 'BLM STBJ / KOSONG';
                d.area = "KOSONG";
                d.poAktualUI = "-";
                missingCount++;
            }
        });

        // Ambil distribusi Customer Aktual dari stok_aktual
        let poDistMap = {};
        for (let spec of uniqueSpecs) {
            let parts = spec.split('_'); // jenis_nama_pjg_grade_dus_shading
            const { data: actData } = await db.from('stok_aktual').select('customer_aktual, qty')
                .eq('nama_item', parts[1]).eq('panjang', parts[2]).eq('grade', parts[3])
                .eq('dus', parts[4]).eq('shading', parts[5]);
            
            if(actData) {
                poDistMap[spec] = {};
                actData.forEach(a => {
                    if(!poDistMap[spec][a.customer_aktual]) poDistMap[spec][a.customer_aktual] = 0;
                    poDistMap[spec][a.customer_aktual] += a.qty;
                });
            }
        }

        dataScan.forEach(d => { 
            if (d.status === 'VALID FISIK') {
                let dist = poDistMap[d.baseSpec];
                let arr = [];
                if(dist) {
                    for(let po in dist) arr.push(`${po} (${dist[po]} Dus)`);
                }
                d.poAktualUI = arr.length > 0 ? arr.join(' | ') : 'KOSONG / NON-CUSTOMER';
            } 
        });

        renderCards();
        if(missingCount > 0) alert(`Selesai! Ditemukan fisik kosong / BLM STBJ (Merah).`);
        
    } catch (e) {
        alert("Koneksi gagal: " + e.message);
    } finally {
        btnCross.innerHTML = originalText; btnCross.disabled = false;
    }
}

async function bukaModalKeluar() {
    if(dataScan.length === 0) return alert("Belum ada data.");

    let hasUnverified = false;
    let poSet = new Set();

    dataScan.forEach(d => {
        if (d.status === 'BELUM CEK') hasUnverified = true;
        if (d.status === 'VALID FISIK') {
            let pos = d.poAktualUI.split('|').map(s => s.trim());
            pos.forEach(p => { 
                let poName = p.split('(')[0].trim();
                if(poName && poName !== 'KOSONG / NON-CUSTOMER' && poName !== '?') poSet.add(poName); 
            });
        }
    });

    if(hasUnverified) return alert("Silakan klik Verifikasi Gudang terlebih dahulu.");
    if(poSet.size === 0) return alert("Barang yang Anda scan belum memiliki jatah Customer di Gudang. Ajukan Request Ganti Customer terlebih dahulu.");

    const sel = document.getElementById('out-po-target');
    if(sel) {
        sel.innerHTML = '<option value="">-- PILIH CUSTOMER TUJUAN --</option>';
        Array.from(poSet).sort().forEach(po => {
            sel.innerHTML += `<option value="${po}">${po}</option>`;
        });
    }

    if(document.getElementById('out-keterangan')) document.getElementById('out-keterangan').value = '';
    document.getElementById('modal-keluar').classList.remove('hidden');
}

async function eksekusiKeluar() {
    const poTarget = document.getElementById('out-po-target') ? document.getElementById('out-po-target').value : '-';
    const keterangan = document.getElementById('out-keterangan') ? document.getElementById('out-keterangan').value.trim() : '';
    
    if(!poTarget) return alert("Pilih Customer Tujuan Pengeluaran!");

    const btnEks = document.getElementById('btn-eksekusi'); const oriBuka = btnEks.innerHTML;
    btnEks.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMPROSES...'; btnEks.disabled = true;

    let specsToProcess = new Set();
    dataScan.forEach(d => { if (d.status === 'VALID FISIK') specsToProcess.add(d.baseSpec); });

    let stockCapacity = {}; 
    try {
        for(let spec of specsToProcess) {
            let parts = spec.split('_'); // jenis_nama_pjg_grade_dus_shading
            const { data, error } = await db.from('stok_aktual').select('qty')
                .eq('nama_item', parts[1]).eq('panjang', parts[2]).eq('grade', parts[3])
                .eq('dus', parts[4]).eq('shading', parts[5]).eq('customer_aktual', poTarget); 
            if (error) throw error;
            let count = 0; if(data) data.forEach(d => count += (d.qty || 0));
            stockCapacity[spec] = count; 
        }
    } catch(e) {
        alert("Gagal membaca kapasitas stok_aktual: " + e.message); btnEks.innerHTML = oriBuka; btnEks.disabled = false; return;
    }

    let qrList = []; let mapAktual = {}; 
    let matchedRows = []; let unmatchedCount = 0;
    let payloadRiwayatKeluar = []; 

    dataScan.forEach(d => {
        if (d.status === 'VALID FISIK') {
            let baseSpec = d.baseSpec;
            if(stockCapacity[baseSpec] && stockCapacity[baseSpec] > 0) {
                matchedRows.push(d);
                qrList.push(d.qrcode);
                stockCapacity[baseSpec] -= 1; 

                let keyAkt = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${poTarget}`;
                if(!mapAktual[keyAkt]) mapAktual[keyAkt] = { nama_item: d.namaItem, pjg: d.panjang, grade: d.grade, dus: d.dus, shading: d.shading, area: d.area, customer_aktual: poTarget, qty: 0 };
                mapAktual[keyAkt].qty++;

                let id_sku_lengkap = `${d.area}_${d.jenisItem}_${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${poTarget}`;
                
                // REVISI: Menggunakan customer_bawaan dan customer_keluar sesuai SQL
                payloadRiwayatKeluar.push({
                    qrcode: d.qrcode,
                    id_sku: id_sku_lengkap,
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
                    customer_bawaan: d.customer, 
                    keterangan: keterangan,
                    customer_keluar: poTarget 
                });

            } else { unmatchedCount++; }
        } else { unmatchedCount++; }
    });

    if (qrList.length === 0) {
        alert(`❌ TIDAK ADA JATAH.\nSisa stok aktual untuk Customer "${poTarget}" adalah 0.`);
        btnEks.innerHTML = oriBuka; btnEks.disabled = false; return;
    }

    try {
        // 1. Hapus dari stok_qr
        const { error: errDel } = await db.from('stok_qr').delete().in('qrcode', qrList);
        if(errDel) throw errDel;

        // 2. Kurangi stok_aktual (Incremental Deduct)
        for(let key in mapAktual) {
            let item = mapAktual[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', item.nama_item).eq('panjang', item.pjg).eq('grade', item.grade)
                .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                .eq('customer_aktual', item.customer_aktual).limit(1);
            
            if(existing && existing.length > 0) {
                await db.from('stok_aktual').update({ qty: existing[0].qty - item.qty }).eq('id', existing[0].id);
            }
        }

        // 3. Insert ke tabel target (stok_keluar atau stok_bs)
        const targetTable = currentTab === 'kirim' ? 'stok_keluar' : 'stok_bs';
        const { error: errKeluar } = await db.from(targetTable).insert(payloadRiwayatKeluar);
        if(errKeluar) throw errKeluar;

        // Bersihkan data yang berhasil diproses dari layar
        dataScan = dataScan.filter(d => !qrList.includes(d.qrcode));
        renderCards();

        let msg = `✅ SELESAI\nBerhasil memproses pengeluaran ke tabel ${targetTable} untuk ${qrList.length} item.`;
        if (unmatchedCount > 0) msg += `\n\n⚠️ ${unmatchedCount} dus tersisa di layar karena tidak lolos verifikasi jatah.`;
        alert(msg);
        
        document.getElementById('modal-keluar').classList.add('hidden');
    } catch (errLog) {
        alert("Terjadi kesalahan saat memproses: " + errLog.message);
    } finally {
        btnEks.innerHTML = oriBuka; btnEks.disabled = false;
    }
}

function bukaModalReqPO() {
    if(dataScan.length === 0) return alert("Tidak ada data.");
    
    let hasVerified = false;
    dataScan.forEach(d => { if(d.status !== 'BELUM CEK') hasVerified = true; });

    if(!hasVerified) return alert("Semua baris tampak belum diverifikasi. Verifikasi dulu sebelum request.");
    
    const sel = document.getElementById('req-po-target');
    sel.innerHTML = '<option value="">-- PILIH CUSTOMER TUJUAN --</option>';
    
    let poAcuan = new Set();
    masterData.kamus.forEach(m => { if(m.customer) poAcuan.add(m.customer); });
    Array.from(poAcuan).sort().forEach(po => {
        sel.innerHTML += `<option value="${po}">${po}</option>`;
    });

    document.getElementById('req-keterangan').value = '';
    document.getElementById('modal-req-po').classList.remove('hidden');
}

async function submitReqPO() {
    const poRequest = document.getElementById('req-po-target').value;
    const ketReq = document.getElementById('req-keterangan').value.trim();
    if(!poRequest) return alert("Pilih Customer Tujuan untuk pengajuan!");

    const btn = document.getElementById('btn-submit-req'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENGAJUKAN...'; btn.disabled = true;

    let payloadUpload = [];

    dataScan.forEach(d => {
        if(d.status !== 'BELUM CEK' && d.status !== 'DUPLIKAT LOKAL') {
            let poAsli = (d.poAsliDB && d.poAsliDB !== '-') ? d.poAsliDB : d.customer; 
            payloadUpload.push({
                qrcode: d.qrcode, po_awal: poAsli, po_request: poRequest, keterangan: ketReq, status: 'PENDING', pic_request: currentUser.username
            });
        }
    });

    if(payloadUpload.length === 0) {
        alert("Tidak ada baris yang bisa diajukan.");
        btn.innerHTML = ori; btn.disabled = false; return;
    }

    try {
        const { error } = await db.from('request_ganti_po').insert(payloadUpload);
        if(error) throw error;
        
        dataScan = dataScan.filter(d => d.status === 'BELUM CEK' || d.status === 'DUPLIKAT LOKAL');
        renderCards();

        alert(`BERHASIL!\n${payloadUpload.length} QRCode bermasalah diajukan ke CS untuk ganti Customer.`);
        document.getElementById('modal-req-po').classList.add('hidden');
    } catch(e) { alert("Gagal mengajukan: " + e.message); }
    finally { btn.innerHTML = ori; btn.disabled = false; }
}
