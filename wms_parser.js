window.translateBarcode = function(barcode) {
    let data = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', customer: '-' };
    if (!barcode) return data;

    const parts = barcode.split('/');
    if (parts.length < 4) return data;

    // Pastikan masterData tersedia (fallback jika dipanggil sebelum load selesai)
    const kamus = (window.masterData && window.masterData.kamus) ? window.masterData.kamus : [];

    // 1. JENIS ITEM
    const hurufDepan = barcode.charAt(0).toUpperCase();
    if (hurufDepan === 'P') data.jenisItem = 'Plafon';
    else if (hurufDepan === 'L') data.jenisItem = 'List';
    else if (hurufDepan === 'W') data.jenisItem = 'WPC';
    else data.jenisItem = hurufDepan;

    // 2. NAMA ITEM
    let rawItem = parts[0].trim().toUpperCase();
    let cariItem = kamus.find(m => m.kode_nama_item && m.kode_nama_item.trim().toUpperCase() === rawItem);
    data.namaItem = cariItem && cariItem.nama_item ? cariItem.nama_item : rawItem;

    // 3. SHADING
    data.shading = parts[1] ? parts[1].trim() : '-';

    // 4. PANJANG, GRADE, DUS
    const p2 = parts[2];
    if (p2 && p2.length >= 4) {
        let digitPjg = (p2.length === 5) ? 2 : 1;
        let rawPjg = p2.substring(0, digitPjg);
        data.panjang = (digitPjg === 1) ? rawPjg + "M" : rawPjg[0] + "." + rawPjg[1] + "M";

        let rawGrade = p2.substring(digitPjg, digitPjg + 1).toUpperCase();
        data.grade = rawGrade === '1' ? 'BAGUS' : (rawGrade === '2' ? 'A' : rawGrade);

        let rawDus = p2.substring(p2.length - 2).trim().toUpperCase();
        let cariDus = kamus.find(m => m.kode_dus && m.kode_dus.trim().toUpperCase() === rawDus);
        data.dus = cariDus && cariDus.dus ? cariDus.dus : rawDus;
    }

    // 5. TGL PRODUKSI, MESIN, SHIFT, CUSTOMER
    const p3 = parts[3];
    if (p3 && p3.length >= 5) {
        const dayOfYear = parseInt(p3.substring(0, 3));
        const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));

        if (!isNaN(dayOfYear) && !isNaN(realYear)) {
            const dateObj = new Date(realYear, 0);
            dateObj.setDate(dayOfYear);
            data.tglProduksi = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
        }

        let sisaString = p3.substring(5).trim().toUpperCase();

        // Ekstrak menggunakan Regex pabrik (C... S... P...)
        let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);

        if (match) {
            let rawMesin = match[1].trim();
            let rawShift = match[2].trim();
            let rawCustomer = match[3].trim();

            let cariMesin = kamus.find(m => m.kode_mesin && m.kode_mesin.trim().toUpperCase() === rawMesin);
            data.mesin = cariMesin && cariMesin.mesin ? cariMesin.mesin : rawMesin;

            let cariShift = kamus.find(m => m.kode_shift && m.kode_shift.trim().toUpperCase() === rawShift);
            data.shift = cariShift && cariShift.shift ? cariShift.shift : rawShift;

            let cariCustomer = kamus.find(m => m.kode_customer && m.kode_customer.trim().toUpperCase() === rawCustomer);
            data.customer = cariCustomer && cariCustomer.customer ? cariCustomer.customer : rawCustomer;
        } else {
            // Fallback jika format barcode tidak mengandung C, S, dan P
            data.mesin = sisaString;
            data.shift = "-";
            data.customer = "-";
        }
    }

    return data;
};
