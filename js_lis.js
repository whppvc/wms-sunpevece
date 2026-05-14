// ==========================================
// FILE: js_lis.js
// ==========================================
let dataLis = {}; 
let selectedLisItem = ""; 

async function initLis() {
    document.getElementById('l-tgl').valueAsDate = new Date();
    
    // Ambil data langsung dari Supabase
    const { data, error } = await _supa.from('master_lis').select('*');
    if (error) {
        alert("Gagal memuat data Lis: " + error.message);
        return;
    }
    
    if (data) {
        const getUniq = (key) => [...new Set(data.map(i => i[key]).filter(Boolean))].sort();
        dataLis = {
            mesin: getUniq('mesin'),
            shift: getUniq('shift'),
            item: getUniq('nama_item'),
            shading: getUniq('shading')
        };
        isiDropdownLis(dataLis);
    }
}

function isiDropdownLis(data) {
    const selMesin = document.getElementById('l-mesin');
    if(selMesin) selMesin.innerHTML = '<option value="">Pilih Mesin</option>' + data.mesin.map(m => `<option value="${m}">${m}</option>`).join('');
    
    const selShift = document.getElementById('l-shift');
    if(selShift) selShift.innerHTML = '<option value="">Pilih Shift</option>' + data.shift.map(s => `<option value="${s}">${s}</option>`).join('');

    const ulItem = document.getElementById('l-item-list');
    if(ulItem) ulItem.innerHTML = data.item.map(i => `<li onclick="pilihItemManual('l', '${i}', this)">${i}</li>`).join('');
}
