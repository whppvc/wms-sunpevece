<script>
  let dataPlafon = {}; let selectedPlafonItem = ""; let selectedPlafonPO = ""; 
  let currentActiveDPad = null; let currentMenu = 'p';

  function createBasePos() { return {x:0, y:0}; }
  let stateGlobal = { 
      p: { zoom: 3.0, pos: { qr:{x:0,y:0,s:1}, barcode:createBasePos(), nama:createBasePos(), shading:createBasePos(), ukuran:createBasePos(), mesin:createBasePos(), shift:createBasePos(), tanggal:createBasePos(), po:createBasePos() }, barcodeData:"" },
      l: { zoom: 3.0, pos: { qr:{x:0,y:0,s:1}, barcode:createBasePos(), nama:createBasePos(), shading:createBasePos(), ukuran:createBasePos(), mesin:createBasePos(), shift:createBasePos(), tanggal:createBasePos() }, barcodeData:"" }
  };

  // KODE BARU (VERSI SUPABASE)
async function initPlafon() {
  // Set tanggal hari ini
  document.getElementById('p-tgl').valueAsDate = new Date();

  // Meminta data langsung dari tabel master_plafon di Supabase
  const { data, error } = await _supa.from('master_plafon').select('*');
  
  if (error) {
    alert("Gagal memuat data Plafon: " + error.message);
    return;
  }

  if (data) {
    // Menyaring data agar tidak ada duplikat (menggantikan fungsi getInitialData di Code.gs)
    const getUniq = (key) => [...new Set(data.map(i => i[key]).filter(Boolean))].sort();
    
    dataPlafon = {
      mesin: getUniq('mesin'),
      shift: getUniq('shift'),
      item: getUniq('nama_item'),
      grade: getUniq('grade'),
      po: getUniq('po')
    };

    // Panggil fungsi isiDropdown bawaan Anda
    isiDropdown('p', dataPlafon);
  }
}

  function stepSlider(id, val, m) {
    let el = document.getElementById(id);
    el.value = parseInt(el.value) + val;
    terapkanAturLabel(m);
  }

  function bukaModal(id) { document.getElementById(id).style.display = 'block'; }
  function tutupModal(id) { document.getElementById(id).style.display = 'none'; }
  
  function toggleVis(id, vis) { 
    let el = document.getElementById(id);
    if(el) { if(vis) el.classList.remove('hidden-element'); else el.classList.add('hidden-element'); }
  }

  // REVISI 3: FUNGSI UNTUK MINIMIZE PANEL BAWAH
  function togglePanelBody(bodyId, iconId) {
    let body = document.getElementById(bodyId);
    let icon = document.getElementById(iconId);
    if(body.style.display === 'none') {
        body.style.display = 'block';
        if(icon) icon.innerText = '▼';
    } else {
        body.style.display = 'none';
        if(icon) icon.innerText = '◀';
    }
  }

  // REVISI 2: FUNGSI UNTUK PENGATURAN WRAP TEXT
  function toggleWrap(m, elId, isWrap) {
    let el = document.getElementById(m + '-l-' + elId);
    if(!el) return;
    if(isWrap) {
        el.style.whiteSpace = 'normal';
        el.style.wordWrap = 'break-word';
        if(elId === 'nama-item') el.style.maxWidth = '33mm';
        if(elId === 'barcode-text') el.style.maxWidth = '45px';
    } else {
        el.style.whiteSpace = 'nowrap';
        el.style.maxWidth = 'none';
    }
  }
  
  function resetDefaultVisibility(m) {
    let defaults = { qr: true, barcode: true, nama: true, shading: true, ukuran: true, mesin: false, shift: true, tanggal: true, po: false, grade: false };
    for(let key in defaults) {
      let cb = document.getElementById(m+'-cb-'+key);
      if(cb) {
        cb.checked = defaults[key];
        let tId = (key === 'qr') ? m+'-qr-container' : (key === 'barcode') ? m+'-l-barcode-text' : (key === 'nama') ? m+'-l-nama-item' : (key === 'grade') ? m+'-l-grade-disp' : m+'-l-'+key;
        toggleVis(tId, defaults[key]);
      }
    }
    // Reset juga status Wrap Text ke setelan awal (True/Centang)
    let cbWBar = document.getElementById(m+'-cb-wrap-barcode');
    if(cbWBar) { cbWBar.checked = true; toggleWrap(m, 'barcode-text', true); }
    let cbWNam = document.getElementById(m+'-cb-wrap-nama');
    if(cbWNam) { cbWNam.checked = true; toggleWrap(m, 'nama-item', true); }
  }

  function ubahZoom(m, step) { 
    stateGlobal[m].zoom += step; 
    if(stateGlobal[m].zoom < 0.5) stateGlobal[m].zoom = 0.5; 
    if(stateGlobal[m].zoom > 5.0) stateGlobal[m].zoom = 5.0; 
    document.getElementById(m+'-label-canvas').style.transform = `scale(${stateGlobal[m].zoom})`; 
    document.getElementById(m+'-zoom-text').innerText = Math.round(stateGlobal[m].zoom * 100) + "%"; 
  }
  
  function toggleAccordion(id, forceOpen=false) { let c = document.getElementById(id); if(forceOpen) c.style.display = "block"; else c.style.display = (c.style.display === "block") ? "none" : "block"; }
  
  function toggleAturLabel(m, forceOpen=false) {
    let pf = document.getElementById(m+'-panel-form'); let ps = document.getElementById(m+'-panel-settings');
    let bCetak = document.getElementById(m+'-btn-cetak-label'); let bSave = document.getElementById(m+'-btn-simpan-settings');
    if(pf.style.display === 'none' && !forceOpen) { pf.style.display = 'block'; ps.style.display = 'none'; bSave.style.display = 'none'; bCetak.style.display = 'flex'; } 
    else { pf.style.display = 'none'; ps.style.display = 'block'; bCetak.style.display = 'none'; bSave.style.display = 'flex'; }
  }

  function simpanPengaturanLabel(m) { alert("⚙ Pengaturan disimpan!"); toggleAturLabel(m); }
  
  function isiDropdown(m, data) {
    let sM = document.getElementById(m+'-mesin'); 
    if(sM) { sM.innerHTML = '<option value="">Pilih...</option><option value="ADD_NEW" style="font-weight:bold; color:blue;">+ Tambah Mesin Baru</option>'; data.mesin.forEach(x => sM.add(new Option(x, x), sM.options.length - 1)); }
    let sS = document.getElementById(m+'-shift'); 
    if(sS) { sS.innerHTML = '<option value="">Pilih...</option>'; data.shift.forEach(x => sS.add(new Option(x, x))); }
    if(m==='p'){ 
        let sG = document.getElementById('p-grade'); 
        if(sG) { sG.innerHTML = '<option value="">Pilih...</option>'; data.grade.forEach(x => sG.add(new Option(x, x))); }
        isiListModal('p-po-list', data.po, 'po', 'p');
    }
    isiListModal(m+'-item-list', data.items, 'item', m); 
  }

  function isiListModal(uId, arr, type, m) { let ul = document.getElementById(uId); ul.innerHTML = ''; arr.forEach(val => { let li = document.createElement('li'); li.textContent = val; li.onclick = function() { document.querySelectorAll(`#${uId} li`).forEach(el => el.classList.remove('selected')); li.classList.add('selected'); if(m==='p'){if(type==='item')selectedPlafonItem=val; if(type==='po')selectedPlafonPO=val;} else {if(type==='item')selectedLisItem=val;} }; ul.appendChild(li); }); }
  function filterList(iId, uId) { let f = document.getElementById(iId).value.toUpperCase(); let li = document.getElementById(uId).getElementsByTagName('li'); for(let i=0; i<li.length; i++){ li[i].style.display = ((li[i].textContent||li[i].innerText).toUpperCase().indexOf(f) > -1) ? "" : "none"; } }
  function pilihItem(m) { let val = m==='p'?selectedPlafonItem:selectedLisItem; if(val){ document.getElementById(m+'-item').value = val; tutupModal(m+'-modal-cari-item'); } else alert("Pilih item!"); }
  function pilihPO(m) { if(selectedPlafonPO){ document.getElementById('p-po').value = selectedPlafonPO; tutupModal('p-modal-cari-po'); } else alert("Pilih PO!"); }
  
  function simpanDataBaru(m, jenis) {
    let inEl=document.getElementById(`${m}-input-${jenis}-baru`), btnEl=document.getElementById(`${m}-btn-simpan-${jenis}`), n=inEl.value.trim(); if(!n) return;
    btnEl.innerText="Menyimpan..."; btnEl.disabled=true;
    let sheetName = m==='p' ? 'MASTER PLAFON' : 'MASTER LIS';
    google.script.run.withSuccessHandler(function(b){
      if(b){
        if(jenis==='mesin'){ let sel=document.getElementById(m+'-mesin'); sel.add(new Option(n,n),sel.options.length-1); sel.value=n; }
        else if(jenis==='item'){ if(m==='p') { dataPlafon.items.push(n); isiListModal('p-item-list',dataPlafon.items,'item','p');} else { dataLis.items.push(n); isiListModal('l-item-list',dataLis.items,'item','l'); } }
        else if(jenis==='po'){ dataPlafon.po.push(n); isiListModal('p-po-list',dataPlafon.po,'po','p'); }
        inEl.value=""; tutupModal(`${m}-modal-tambah-${jenis}`); alert("Tersimpan!");
      } else alert("Gagal. Cek Header sheet.");
      btnEl.innerText="Simpan"; btnEl.disabled=false;
    }).withFailureHandler(function(){alert("Error!"); btnEl.disabled=false;})( {sheet: sheetName, nilai: n} );
  }

  function formatBarcode(tgl, mesin, shift, item, panjang, grade, po, shading, dGlobal) {
    let itemAbbr = item.split(' ').map(w => { let wUpper = w.toUpperCase(); if (wUpper === 'GLOSSY') return 'GLSY'; if (wUpper === 'GOLD') return 'GD'; if (/^\d+$/.test(w)) return w; return w.charAt(0).toUpperCase(); }).join('');
    if(grade === 'A') itemAbbr += " A";
    let dObj = new Date(tgl), start = new Date(dObj.getFullYear(), 0, 0);
    let dayStr = String(Math.floor((dObj - start + (start.getTimezoneOffset()-dObj.getTimezoneOffset())*60*1000) / 86400000)).padStart(3, '0');
    let yrRev = String(dObj.getFullYear()).slice(-2).split('').reverse().join('');
    let dateCode = dayStr + yrRev;
    let mIdx = dGlobal.mesin.indexOf(mesin)+1; let mStr = String(mIdx).padStart(2, '0');
    let shAngka = shift.replace(/\D/g, '');
    let poStr = po && dGlobal.po ? String(dGlobal.po.indexOf(po)+1).padStart(2, '0') : "";
    return `${itemAbbr}/${shading}/${panjang}/${dateCode}/${mStr}${shAngka}${poStr}`;
  }

  function generateLabel(m) {
    let qtyEl = document.getElementById(m+'-qty');
    if(!qtyEl || !qtyEl.value || parseInt(qtyEl.value) < 1) {
      alert("⚠️ Silakan isi Jumlah Print Label minimal 1 terlebih dahulu!");
      if(qtyEl) qtyEl.focus();
      return;
    }

    let tgl = document.getElementById(m+'-tgl').value, mesin = document.getElementById(m+'-mesin').value, item = document.getElementById(m+'-item').value, panjang = document.getElementById(m+'-panjang').value, shift = document.getElementById(m+'-shift').value;
    let grade = document.getElementById(m+'-grade') ? document.getElementById(m+'-grade').value : ""; 
    let po = document.getElementById(m+'-po') ? document.getElementById(m+'-po').value : "";
    let shading = document.getElementById(m+'-shading').value;

    if(!item || !panjang) { alert("Nama Item dan Panjang wajib diisi!"); return; }
    
    let dGlobal = m==='p' ? dataPlafon : dataLis;
    let bText = formatBarcode(tgl, mesin, shift, item, panjang, grade, po, shading, dGlobal);
    stateGlobal[m].barcodeData = bText;

    let gradeStr = (m === 'p' && grade === 'A') ? ' A' : '';
    document.getElementById(m+'-l-nama-item').innerHTML = item + `<span id="${m}-l-grade-disp" class="${document.getElementById(m+'-cb-grade') && !document.getElementById(m+'-cb-grade').checked ? 'hidden-element' : ''}">${gradeStr}</span>`;
    
    document.getElementById(m+'-l-shading').innerText = shading;
    document.getElementById(m+'-l-mesin').innerText = mesin ? mesin : "";
    if(m==='p') document.getElementById('p-l-po').innerText = po ? po : "";
    
    document.getElementById(m+'-l-ukuran').innerText = "Uk 20 x " + panjang + "00";
    
    let shiftAngka = shift.replace(/\D/g, '');
    document.getElementById(m+'-l-shift').innerText = shiftAngka ? "S" + shiftAngka : ""; 
    
    let dObj = new Date(tgl);
    let dd = String(dObj.getDate()).padStart(2, '0');
    let mm = String(dObj.getMonth() + 1).padStart(2, '0');
    let yyyy = dObj.getFullYear();
    document.getElementById(m+'-l-tanggal').innerText = dd + "/" + mm + "/" + yyyy;

    document.getElementById(m+'-l-barcode-text').innerText = bText + "/001";
    document.getElementById(m+'-qrcode').innerHTML = ""; 
    new QRCode(document.getElementById(m+"-qrcode"), { text: bText + "/001", width: 300, height: 300, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.L });
    
    document.getElementById(m+'-btn-cetak-label').style.display = 'none';
    if(document.getElementById(m+'-panel-settings').style.display === 'block') document.getElementById(m+'-btn-simpan-settings').style.display = 'flex';
  }

  function terapkanAturLabel(m) {
    let idList = ['skala-qr', 'font-barcode', 'font-teks-atas', 'gap-teks-atas', 'font-info', 'gap-info'];
    idList.forEach(id => { let el = document.getElementById(m+'-atur-'+id); if(el && document.getElementById(m+'-val-'+id)) document.getElementById(m+'-val-'+id).innerText = el.value; });

    let fA = document.getElementById(m+'-atur-font-teks-atas').value+"px", alA = document.getElementById(m+'-atur-rata-teks-atas').value;
    let eN = document.getElementById(m+'-l-nama-item'); if(eN) { eN.style.fontSize=fA; eN.style.textAlign=alA; }
    let eS = document.getElementById(m+'-l-shading'); if(eS) { eS.style.fontSize=fA; eS.style.textAlign=alA; }
    
    let gapTeks = document.getElementById(m+'-atur-gap-teks-atas');
    if(gapTeks && document.getElementById(m+'-l-teks-grup')) document.getElementById(m+'-l-teks-grup').style.gap = gapTeks.value + "px";

    let eI = document.getElementById(m+'-l-info-bawah'); 
    if(eI) { eI.style.fontSize=document.getElementById(m+'-atur-font-info').value+"px"; eI.style.justifyContent=document.getElementById(m+'-atur-rata-info').value; }
    let gapInfo = document.getElementById(m+'-atur-gap-info');
    if(gapInfo && eI) eI.style.gap = gapInfo.value + "px";

    stateGlobal[m].pos.qr.s = document.getElementById(m+'-atur-skala-qr').value / 100; 
    updateTransform(m, 'qr');
    document.getElementById(m+'-l-barcode-text').style.fontSize = document.getElementById(m+'-atur-font-barcode').value + "px";
  }

  function getElMap(m) {
      let map = { 'qr': m+'-qrcode-wrapper', 'barcode': m+'-l-barcode-text', 'nama': m+'-l-nama-item', 'shading': m+'-l-shading', 'ukuran': m+'-l-ukuran', 'mesin': m+'-l-mesin', 'shift': m+'-l-shift', 'tanggal': m+'-l-tanggal' };
      if(m === 'p') map['po'] = 'p-l-po';
      return map;
  }

  function updateTransform(m, b) {
    let map = getElMap(m);
    let el = document.getElementById(map[b]);
    if(!el) return;
    if(b === 'qr') el.style.transform = `translate(${stateGlobal[m].pos.qr.x}px, ${stateGlobal[m].pos.qr.y}px) scale(${stateGlobal[m].pos.qr.s})`;
    else el.style.transform = `translate(${stateGlobal[m].pos[b].x}px, ${stateGlobal[m].pos[b].y}px)`;
  }
  
  function pilihElemen(m, b, event) {
      document.querySelectorAll('.click-edit').forEach(el => el.classList.remove('active-edit'));
      let map = getElMap(m);
      let el = document.getElementById(map[b]);
      if(el) el.classList.add('active-edit');
      currentActiveDPad = { m: m, b: b };
      event.stopPropagation();
  }

  document.addEventListener('click', function(e) {
      if(!e.target.closest('.click-edit') && !e.target.closest('.d-pad') && !e.target.closest('.checkbox-panel')) {
          document.querySelectorAll('.click-edit').forEach(el => el.classList.remove('active-edit'));
          currentActiveDPad = null;
      }
  });

  function geserDariDPad(m, targets, dx, dy) {
      targets.forEach(t => {
          if(stateGlobal[m].pos[t]) {
              stateGlobal[m].pos[t].x += dx;
              stateGlobal[m].pos[t].y += dy;
              updateTransform(m, t);
          }
      });
  }
  function resetDariDPad(m, targets) {
      targets.forEach(t => {
          if(stateGlobal[m].pos[t]) {
              stateGlobal[m].pos[t].x = 0; stateGlobal[m].pos[t].y = 0;
              updateTransform(m, t);
          }
      });
  }

  function initKeyboardGlobal() {
      document.addEventListener('keydown', function(e) {
          if(!currentActiveDPad) return; 
          let tTag = e.target.tagName.toUpperCase();
          if(tTag === 'INPUT' || tTag === 'SELECT' || tTag === 'TEXTAREA') return;

          let m = currentActiveDPad.m; let b = currentActiveDPad.b;
          let x=0, y=0, s=(e.shiftKey)?5:1; 
          
          switch(e.key){ 
             case 'ArrowUp': y=-s; break; 
             case 'ArrowDown': y=s; break; 
             case 'ArrowLeft': x=-s; break; 
             case 'ArrowRight': x=s; break; 
             case 'o': case 'O': 
                let gListReset = Array.from(document.querySelectorAll(`.${m}-grup-cb:checked`)).map(cb => cb.value);
                if(gListReset.includes(b)) resetDariDPad(m, gListReset); else resetDariDPad(m, [b]);
                return;
             default: return; 
          }
          e.preventDefault(); 
          
          let gCbs = document.querySelectorAll(`.${m}-grup-cb:checked`);
          let groupList = Array.from(gCbs).map(cb => cb.value);

          if(groupList.includes(b)) geserDariDPad(m, groupList, x, y);
          else geserDariDPad(m, [b], x, y);
      });
  }

  async function cetakLabel(m) {
    let qty = parseInt(document.getElementById(m+'-qty').value) || 0;
    // Validasi akhir jika ada yang iseng mengubah angka 0 setelah di generate
    if (qty < 1) { alert("⚠️ Jumlah Print tidak valid!"); return; }

    let btnCetak = document.getElementById(m+'-btn-cetak-label');
    btnCetak.innerText = "⏳ Memproses DB..."; btnCetak.disabled = true;

    let dataKirim = {
      qty: qty, item: document.getElementById(m+'-item').value, panjang: document.getElementById(m+'-panjang').value,
      grade: document.getElementById(m+'-grade') ? document.getElementById(m+'-grade').value : "",
      shading: document.getElementById(m+'-shading').value,
      po: document.getElementById(m+'-po') ? document.getElementById(m+'-po').value : "",
      tgl: document.getElementById(m+'-tgl').value, mesin: document.getElementById(m+'-mesin').value,
      shift: document.getElementById(m+'-shift').value, barcodeText: stateGlobal[m].barcodeData
    };

    google.script.run.withSuccessHandler(async function(res) {
      if(!res.success) { alert("Error Database: " + res.error); btnCetak.innerText = "🖨 4. CETAK LABEL"; btnCetak.disabled = false; return; }

      let node = document.getElementById(m+'-label-canvas');
      let oldTransform = node.style.transform;
      node.style.transform = 'none'; node.style.border = 'none';
      
      let images = [];
      for(let i = res.startSerial; i <= res.endSerial; i++) {
        let serialStr = "/" + ("000" + i).slice(-3);
        document.getElementById(m+'-l-barcode-text').innerText = stateGlobal[m].barcodeData + serialStr;
        document.getElementById(m+'-qrcode').innerHTML = "";
        new QRCode(document.getElementById(m+'-qrcode'), { text: stateGlobal[m].barcodeData + serialStr, width: 300, height: 300, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.L });

        await new Promise(r => setTimeout(r, 200)); 
        let canvas = await html2canvas(node, { scale: 3, useCORS: true, logging: false });
        images.push(canvas.toDataURL("image/png"));
        btnCetak.innerText = `⏳ Merender ${images.length}/${qty}`;
      }

      node.style.transform = oldTransform; node.style.border = '1px solid black';
      btnCetak.innerText = "🖨 4. CETAK LABEL"; btnCetak.disabled = false;

      let w = node.style.width || "50.8mm"; let h = node.style.height || "27.9mm";
      let pWin = window.open('', '_blank');
      
      let htmlContent = `<html><head><title>Print Label</title><style>
        @page { size: ${w} ${h}; margin: 0; }
        body { margin: 0; padding: 20px; background: #525659; display: flex; flex-direction: column; align-items: center; gap: 20px; }
        .label-page { page-break-after: always; width: ${w}; height: ${h}; background: #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center; overflow: hidden; flex-shrink: 0; }
        img { width: 100%; height: 100%; object-fit: contain; }
        @media print {
            body { background: #fff; padding: 0; display: block; }
            .label-page { box-shadow: none; margin: 0; }
        }
      </style></head><body>`;
      
      images.forEach(img => { htmlContent += `<div class="label-page"><img src="${img}"></div>`; });
      htmlContent += `</body></html>`;
      
      pWin.document.write(htmlContent);
      pWin.document.close(); pWin.onload = function() { pWin.focus(); pWin.print(); };

    }).prosesCetakBatch(JSON.stringify(dataKirim));
  }
</script>
