function translateBarcode(barcode) {
    const parts = barcode.split('/'); 
    let data = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', customer: '-' };
    if (parts.length < 4) return data;
    
    const hurufDepan = barcode.charAt(0).toUpperCase();
    if (hurufDepan === 'P') data.jenisItem = 'Plafon'; 
    else if (hurufDepan === 'L') data.jenisItem = 'List'; 
    else if (hurufDepan === 'W') data.jenisItem = 'WPC'; 
    else data.jenisItem = hurufDepan;

    let rawItem = parts[0]; 
    let cariItem = masterData.kamus.find(m => m.kode_nama_item === rawItem); 
    data.namaItem = cariItem && cariItem.nama_item ? cariItem.nama_item : rawItem; 
    data.shading = parts[1];
    
    const p2 = parts[2];
    if (p2 && p2.length >= 4) {
        let digitPjg = (p2.length === 5) ? 2 : 1; 
        let rawPjg = p2.substring(0, digitPjg);
        data.panjang = (digitPjg === 1) ? rawPjg + "M" : rawPjg[0] + "." + rawPjg[1] + "M"; 
        let rawGrade = p2.substring(digitPjg, digitPjg + 1); 
        data.grade = rawGrade === '1' ? 'BAGUS' : (rawGrade === '2' ? 'A' : rawGrade);
        let rawDus = p2.substring(p2.length - 2); 
        let cariDus = masterData.kamus.find(m => m.kode_dus === rawDus); 
        data.dus = cariDus && cariDus.dus ? cariDus.dus : rawDus;
    }
    
    const p3 = parts[3];
    if (p3.length >= 5) {
        const dayOfYear = parseInt(p3.substring(0, 3)); 
        const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        const dateObj = new Date(realYear, 0); 
        dateObj.setDate(dayOfYear);
        data.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;
        
        let sisaString = p3.substring(5); 
        let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        if (match) {
            let cariMesin = masterData.kamus.find(m => m.kode_mesin === match[1]); 
            data.mesin = cariMesin && cariMesin.mesin ? cariMesin.mesin : match[1];
            let cariShift = masterData.kamus.find(m => m.kode_shift === match[2]); 
            data.shift = cariShift && cariShift.shift ? cariShift.shift : match[2];
            let cariCustomer = masterData.kamus.find(m => m.kode_customer === match[3]); 
            data.customer = cariCustomer && cariCustomer.customer ? cariCustomer.customer : match[3];
        } else { 
            data.mesin = "SALAH"; 
            data.shift = "SALAH"; 
            data.customer = "SALAH"; 
        }
    }
    return data;
}
