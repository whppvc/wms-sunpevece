// REVISI: Desain Header lebih rapi dengan gap dan icon yang proporsional
const thSort = (label, cls = "") => {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-btn', 'col-btn-edit'].includes(colClass);
    
    const filterBtn = noFilter ? '' : `
        <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-700 rounded ml-1 transition" title="Filter ${label}">
            <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
        </button>`;

    const justifyClass = noFilter ? 'justify-center' : 'justify-start';

    return `<th class="hdr-std ${cls} select-none">
        <div class="flex items-center ${justifyClass} gap-2">
            <span class="cursor-pointer flex items-center gap-1.5 hover:text-blue-300 transition" onclick="sortTable(this.closest('th').cellIndex, this.closest('th'))">${label} <i data-lucide="arrow-up-down" class="w-3.5 h-3.5 sort-icon opacity-40"></i></span>
            ${filterBtn}
        </div>
    </th>`;
};

// REVISI: Padding diubah ke py-3, text-[13px], dan "Troli Gabungan" -> "Troli"
function renderHeaderDanTabel() {
    const thead = document.getElementById('thead-stbj');
    const tbody = document.getElementById('tbody-stbj');
    sortState = {};

    const rowClassBase = "transition text-row text-[13px]";

    if(modeSekarang === 'qrcode') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer rounded text-blue-600 border-slate-300 w-4 h-4 focus:ring-blue-500"></th>
                <th class="hdr-std w-10 col-btn text-center"><i data-lucide="trash-2" class="w-4 h-4 mx-auto text-slate-400"></i></th>
                ${thSort('Status Item', 'col-status-gudang')}
                ${tabelSekarang === 'hold_stbj' ? thSort('Status Hold', 'col-status') : '<th class="hdr-std hidden col-status">Status Hold</th>'}
                ${thSort('Collect', 'col-status-data')}
                ${thSort('Waktu Scan', 'col-waktu')}
                ${thSort('Troli', 'col-troli')}
                ${thSort('QRCode', 'col-qr')}
                ${thSort('Tgl Produksi', 'col-tgl')}
                ${thSort('Mesin', 'col-mesin')}
                ${thSort('Shift', 'col-shift')}
                ${thSort('Jenis Item', 'col-jenis')}
                ${thSort('Nama Item', 'col-nama')}
                ${thSort('Pjg', 'col-pjg')}
                ${thSort('Grade', 'col-grade')}
                ${thSort('Dus', 'col-dus')}
                ${thSort('Shading', 'col-shading')}
                ${thSort('Customer Bawaan', 'col-customer')}
                ${thSort('Keterangan', 'col-ket')}
                ${thSort('PIC Input', 'col-pic')}
            </tr>`;
        
        if(rawDataRaw.length === 0) { tbody.innerHTML = `<tr id="empty-row-stbj"><td colspan="22" class="px-4 py-8 text-center font-bold text-slate-400">Tabel Kosong.</td></tr>`; return; }
        
        let h = '';
        rawDataRaw.forEach((r, i) => {
            let tgl = '-';
            if (r.created_at) {
                const dt = new Date(r.created_at);
                if (!isNaN(dt.getTime())) {
                    const dd = String(dt.getDate()).padStart(2, '0');
                    const mm = String(dt.getMonth() + 1).padStart(2, '0');
                    const yyyy = dt.getFullYear();
                    tgl = `${dd}/${mm}/${yyyy}`;
                }
            }

            const htmlStatusGudang = r.is_in_gudang ? '<span class="text-emerald-600 font-black">IN GUDANG</span>' : '<span class="text-slate-500 font-bold">STBJ</span>';
            
            let statData = '-';
            if (r.status_data && r.status_data !== 'BELUM') {
                statData = `<span class="text-indigo-600 font-medium uppercase">${r.status_data}</span>`;
            }

            h += `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb"><input type="checkbox" onchange="highlightRow(this)" value="${r.qrcode}" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 text-center col-btn">
                        <button onclick="aksiHapusPerBaris('${r.qrcode}')" class="text-slate-400 hover:text-rose-600 transition p-1.5 rounded-md hover:bg-rose-50 mx-auto flex shadow-sm border border-transparent hover:border-rose-200">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>
                    <td class="px-4 py-3 text-left col-status-gudang" data-search="${r.is_in_gudang ? 'IN GUDANG' : 'STBJ'}">${htmlStatusGudang}</td>
                    ${tabelSekarang === 'hold_stbj' ? `<td class="px-4 py-3 text-left font-black text-amber-600 col-status" data-search="${r.status || 'HOLD'}">${r.status || 'HOLD'}</td>` : '<td class="px-4 py-3 hidden col-status">-</td>'}
                    <td class="px-4 py-3 text-left col-status-data" data-search="${r.status_data || '-'}">${statData}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-waktu" data-search="${tgl}">${tgl}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-troli" data-search="${r.troli || '-'}">${r.troli || '-'}</td>
                    <td class="px-4 py-3 text-left font-mono font-bold text-slate-900 col-qr" data-search="${r.qrcode}">${r.qrcode}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-tgl" data-search="${r.tgl_produksi || '-'}">${r.tgl_produksi || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-mesin" data-search="${r.mesin || '-'}">${r.mesin || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-shift" data-search="${r.shift || '-'}">${r.shift || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-jenis" data-search="${r.jenis_item || '-'}">${r.jenis_item || '-'}</td>
                    <td class="px-4 py-3 text-left font-semibold text-slate-900 col-nama" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-pjg" data-search="${r.panjang || '-'}">${r.panjang || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-grade" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-dus" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-shading" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-customer" data-search="${r.customer || '-'}">${r.customer || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-600 col-ket" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-500 col-pic" data-search="${r.pic_input || '-'}">${r.pic_input || '-'}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
        tbody.innerHTML += `<tr id="empty-row-stbj" style="display:none;"><td colspan="22" class="px-4 py-8 text-center font-bold text-slate-400">Tidak ada data cocok dengan filter.</td></tr>`;
    } 
    else if(modeSekarang === 'item' || modeSekarang === 'jasper') {
        const isJasper = modeSekarang === 'jasper';
        
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer rounded text-blue-600 border-slate-300 w-4 h-4 focus:ring-blue-500"></th>
                <th class="hdr-std col-status-gudang hidden">Status Item</th>
                <th class="hdr-std col-status hidden">Status Hold</th>
                ${thSort('Collect', 'col-status-data')}
                <th class="hdr-std col-waktu hidden">Waktu Scan</th>
                ${thSort('Troli', 'col-troli')}
                <th class="hdr-std col-qr hidden">QRCode</th>
                ${thSort('Tgl Produksi', 'col-tgl')}
                ${thSort('Mesin', 'col-mesin')}
                ${thSort('Shift', 'col-shift')}
                ${thSort('Jenis Item', 'col-jenis')}
                ${thSort('Nama Item', 'col-nama')}
                ${isJasper ? thSort('Nama Jasper', 'col-jasper text-purple-300') : ''}
                ${isJasper ? '<th class="hdr-std w-10 text-center col-btn-edit">Edit</th>' : ''}
                ${thSort('Panjang', 'col-pjg')}
                ${thSort('Grade', 'col-grade')}
                ${thSort('Dus', 'col-dus')}
                ${thSort('Shading', 'col-shading')}
                ${thSort('Customer Bawaan', 'col-customer')}
                ${thSort('QTY (DUS)', 'col-qty')}
                ${thSort('QTY (LEMBAR)', 'col-qty-lembar text-emerald-400')}
                ${thSort('Keterangan', 'col-ket')}
                <th class="hdr-std col-pic hidden">PIC Input</th>
            </tr>`;
        
        let groups = {};
        rawDataRaw.forEach(r => {
            let n = r.nama_item || '-';
            let jName = n;
            let jId = '';
            
            if(isJasper) {
                if(jasperData && jasperData.length > 0) {
                    const cJasper = jasperData.find(j => j.nama_item === r.nama_item && j.panjang === r.panjang && j.grade === r.grade);
                    if(cJasper) {
                        jName = cJasper.nama_jasper;
                        jId = cJasper.id;
                    } else {
                        jName = `JAS-${r.nama_item}`;
                    }
                } else { jName = `JAS-${r.nama_item}`; }
            }
            
            let ket = r.keterangan || 'TANPA_KETERANGAN';
            let sData = r.status_data || 'BELUM';
            let cust = r.customer || '-';
            let key = `${r.jenis_item}_${n}_${r.panjang}_${r.grade}_${r.dus}_${r.shading}_${cust}_${r.tgl_produksi}_${r.mesin}_${r.shift}_${ket}_${sData}`;
            
            if(!groups[key]) {
                groups[key] = { 
                    jenisItem: r.jenis_item, namaItemAsli: n, displayNama: jName, jasperId: jId, panjang: r.panjang, grade: r.grade, dus: r.dus, shading: r.shading, customer: cust,
                    tglProduksi: r.tgl_produksi, mesin: r.mesin, shift: r.shift,
                    qty: 0, qrcodes: [], trolis: new Set(), ket: ket, sData: sData 
                };
            }
            groups[key].qty++; 
            groups[key].qrcodes.push(r.qrcode);
            if(r.troli) groups[key].trolis.add(r.troli);
        });

        let arr = Object.values(groups);
        if(arr.length === 0) { tbody.innerHTML = `<tr id="empty-row-stbj"><td colspan="20" class="px-4 py-8 text-center font-bold text-slate-400">Kosong.</td></tr>`; return; }

        let h = '';
        arr.forEach((r) => {
            const gabunganTroli = Array.from(r.trolis).join(', ') || '-';
            const displayKet = (r.ket === 'TANPA_KETERANGAN') ? '-' : r.ket; 
            
            let statData = '-';
            if (r.sData && r.sData !== 'BELUM') {
                statData = `<span class="text-indigo-600 font-medium uppercase">${r.sData}</span>`;
            }

            let btnEditJasper = '';
            if(isJasper) {
                const jData = encodeURIComponent(JSON.stringify({
                    id: r.jasperId,
                    nama_item: r.namaItemAsli,
                    panjang: r.panjang,
                    grade: r.grade,
                    nama_jasper: r.displayNama
                }));
                btnEditJasper = `<td class="px-4 py-3 text-center col-btn-edit"><button onclick="bukaModalKatalogForm(true, '${jData}')" class="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md transition shadow-sm mx-auto flex"><i data-lucide="edit-3" class="w-4 h-4"></i></button></td>`;
            }

            let qtyLembar = hitungQtyLembar(r.jenisItem, r.namaItemAsli, r.qty);

            h += `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb"><input type="checkbox" onchange="highlightRow(this)" value="${r.qrcodes.join(',')}" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 hidden col-status-gudang">-</td>
                    <td class="px-4 py-3 hidden col-status">-</td>
                    <td class="px-4 py-3 text-left col-status-data" data-search="${r.sData || '-'}">${statData}</td>
                    <td class="px-4 py-3 hidden col-waktu">-</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-troli" data-search="${gabunganTroli}">${gabunganTroli}</td>
                    <td class="px-4 py-3 hidden col-qr">-</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-tgl" data-search="${r.tglProduksi}">${r.tglProduksi}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-mesin" data-search="${r.mesin}">${r.mesin}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-shift" data-search="${r.shift}">${r.shift}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-jenis" data-search="${r.jenisItem}">${r.jenisItem}</td>
                    <td class="px-4 py-3 text-left font-semibold text-slate-900 col-nama" data-search="${r.namaItemAsli}">${r.namaItemAsli}</td>
                    ${isJasper ? `<td class="px-4 py-3 text-left font-black text-purple-700 col-jasper" data-search="${r.displayNama}">${r.displayNama}</td>` : ''}
                    ${btnEditJasper}
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-pjg" data-search="${r.panjang}">${r.panjang}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-grade" data-search="${r.grade}">${r.grade}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-dus" data-search="${r.dus}">${r.dus}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-shading" data-search="${r.shading}">${r.shading}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-customer" data-search="${r.customer}">${r.customer}</td>
                    <td class="px-4 py-3 text-center font-black text-emerald-700 col-qty" data-search="${r.qty}">${r.qty}</td>
                    <td class="px-4 py-3 text-center font-black text-emerald-600 col-qty-lembar" data-search="${qtyLembar}">${qtyLembar}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-600 col-ket" data-search="${displayKet}">${displayKet}</td>
                    <td class="px-4 py-3 hidden col-pic">-</td>
                </tr>`;
        });
        tbody.innerHTML = h;
        tbody.innerHTML += `<tr id="empty-row-stbj" style="display:none;"><td colspan="20" class="px-4 py-8 text-center font-bold text-slate-400">Tidak ada data cocok dengan filter.</td></tr>`;
    }
    
    applyColumnOrder();
    lucide.createIcons(); 
    saringTabelExcel();
}
