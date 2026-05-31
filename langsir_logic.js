async function saveToSupabase() {
    const btn = document.getElementById('btn-save'); const original = btn.innerHTML;
    
    const adaYgBelumDicek = document.querySelectorAll('span[data-status="unverified"]').length > 0;
    const adaDuplikat = document.querySelectorAll('span[data-status="invalid"]').length > 0;
    const adaBelumStbj = document.querySelectorAll('span[data-status="invalid-stbj"]').length > 0;

    if(adaYgBelumDicek || adaDuplikat || adaBelumStbj) {
        return alert("GAGAL MENYIMPAN!\nTerdapat baris bermasalah. Tahan/Hapus baris tersebut.");
    }
    
    const rows = document.querySelectorAll('.row-item'); if(rows.length === 0) return;

    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-6 h-6"></i> MENYIMPAN...'; btn.disabled = true;
    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    
    let arrFisik = []; let mapAktual = {}; let mapGlobal = {}; 

    rows.forEach(r => {
        let area = r.querySelector('.area-cell').innerText; let qr = r.querySelector('.qr-val').innerText;
        let jenis = r.querySelector('.col-jenis').innerText; let nama = r.querySelector('.col-nama').innerText;
        let pjg = r.querySelector('.col-pjg').innerText; let grade = r.querySelector('.col-grade').innerText;
        let dus = r.querySelector('.col-dus').innerText; let shading = r.querySelector('.col-shading').innerText; 
        let po = r.querySelector('.col-po').innerText; // PO dari input/awal (po_aktual saat masuk)
        let ket = r.querySelector('.col-ket').innerText;
        
        let td = translateBarcode(qr);
        let poBawaan = td.po; // PO Hakiki dari mesin (po_bawaan)
        
        let id_sku = `${area}_${jenis}_${nama}_${pjg}_${grade}_${dus}_${shading}_${po}`;
        arrFisik.push({ qrcode: qr, area: area, id_sku: id_sku, pic_input: user.username });
        
        let keyAkt = `${nama}_${pjg}_${grade}_${dus}_${shading}_${area}_${po}_${ket}`;
        if(!mapAktual[keyAkt]) mapAktual[keyAkt] = { nama_item: nama, pjg: pjg, grade: grade, dus: dus, shading: shading, area: area, po_aktual: po, ket: ket, qty: 0 };
        mapAktual[keyAkt].qty += 1;

        let keyGlb = `${nama}_${pjg}_${grade}_${dus}_${shading}_${poBawaan}_${ket}`;
        if(!mapGlobal[keyGlb]) mapGlobal[keyGlb] = { nama_item: nama, pjg: pjg, grade: grade, dus: dus, shading: shading, po_bawaan: poBawaan, ket: ket, qty: 0 };
        mapGlobal[keyGlb].qty += 1;
    });

    const payloadData = { qrs: arrFisik, aktuals: Object.values(mapAktual), globals: Object.values(mapGlobal) };
    const { data, error } = await db.rpc('eksekusi_langsir_aman', { payload: payloadData });

    if (error) { alert("GAGAL SERVER: " + error.message); btn.innerHTML = original; btn.disabled = false; return; }
    
    alert(`BERHASIL!\n${arrFisik.length} kardus masuk. Tabel Aktual & Global sukses terupdate secara sinkron.`);
    document.getElementById('tbody-langsir').innerHTML = ''; btn.innerHTML = original; btn.disabled = false;
}
