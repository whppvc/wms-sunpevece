<script>
  let dataPlafon = {}; let dataLis = {};
  let isPlafonInit = false; let isLisInit = false; let isKhususInit = false; let isGudangInit = false; let currentMenu = 'p';
  let activeSelection = { m: null, elements: [] }; let isDragging = false; let dragStartX = 0, dragStartY = 0; let dragInitialPos = {};
  
  let historyStack = { p: { undo: [], redo: [] }, l: { undo: [], redo: [] }, k: { undo: [], redo: [] }, g: { undo: [], redo: [] } };
  
  let selectedPlafonItem = ""; let selectedPlafonItemKode = ""; 
  let selectedPlafonPO = ""; let selectedPlafonPOKode = ""; 
  let selectedPlafonDus = ""; let selectedPlafonDusKode = "";
  
  let selectedLisItem = ""; let selectedLisItemKode = "";
  let selectedLisDus = ""; let selectedLisDusKode = "";

  function createBasePos() { return {x:0, y:0}; }
  
  let baseVis = { qr: true, barcode: true, nama: true, shading: true, ukuran: true, mesin: false, shift: true, tanggal: true, po: false, dus: true, isi: true };
  let baseVisBack = { nama: true, shading: true, ukuran: true, mesin: false, shift: true, tanggal: true, po: false, dus: true, isi: true };

  // REVISI: Default font barcode dinaikkan menjadi 8 agar tidak hilang
  let stateGlobal = { 
      p: { zoom: 4.0, pos: { qr:{x:0,y:0,s:1}, barcode:createBasePos(), nama:createBasePos(), shading:createBasePos(), ukuran:createBasePos(), mesin:createBasePos(), shift:createBasePos(), tanggal:createBasePos(), po:createBasePos(), dus:createBasePos(), isi:createBasePos() }, font: { barcode: 8, nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, kertas: { tipe: '100x50', w: 100, h: 50 }, wrap: { nama: 33, barcode: 100, nama_cb: true, barcode_cb: true }, barcodeData:"", linkFont: true, vis: JSON.parse(JSON.stringify(baseVis)) },
      p_back: { pos: { nama:createBasePos(), shading:createBasePos(), ukuran:createBasePos(), mesin:createBasePos(), shift:createBasePos(), tanggal:createBasePos(), po:createBasePos(), dus:createBasePos(), isi:createBasePos() }, font: { nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, wrap: { nama: 45, nama_cb: true }, linkFont: true, vis: JSON.parse(JSON.stringify(baseVisBack)) },
      
      l: { zoom: 4.0, pos: { qr:{x:0,y:0,s:1}, barcode:createBasePos(), nama:createBasePos(), shading:createBasePos(), ukuran:createBasePos(), mesin:createBasePos(), shift:createBasePos(), tanggal:createBasePos(), dus:createBasePos(), isi:createBasePos() }, font: { barcode: 8, nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, kertas: { tipe: '100x50', w: 100, h: 50 }, wrap: { nama: 33, barcode: 100, nama_cb: true, barcode_cb: true }, barcodeData:"", linkFont: true, vis: JSON.parse(JSON.stringify(baseVis)) },
      l_back: { pos: { nama:createBasePos(), shading:createBasePos(), ukuran:createBasePos(), mesin:createBasePos(), shift:createBasePos(), tanggal:createBasePos(), dus:createBasePos(), isi:createBasePos() }, font: { nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, wrap: { nama: 45, nama_cb: true }, linkFont: true, vis: JSON.parse(JSON.stringify(baseVisBack)) },
      
      k: { zoom: 4.0, pos: { qr:{x:0,y:0,s:1}, barcode:createBasePos(), nama:createBasePos(), shading:createBasePos(), ukuran:createBasePos(), mesin:createBasePos(), shift:createBasePos(), tanggal:createBasePos(), po:createBasePos(), dus:createBasePos(), isi:createBasePos() }, font: { barcode: 8, nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, kertas: { tipe: '100x50', w: 100, h: 50 }, wrap: { nama: 33, barcode: 100, nama_cb: true, barcode_cb: true }, barcodeData:"", linkFont: true, vis: JSON.parse(JSON.stringify(baseVis)) },
      k_back: { pos: { nama:createBasePos(), shading:createBasePos(), ukuran:createBasePos(), mesin:createBasePos(), shift:createBasePos(), tanggal:createBasePos(), po:createBasePos(), dus:createBasePos(), isi:createBasePos() }, font: { nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, wrap: { nama: 45, nama_cb: true }, linkFont: true, vis: JSON.parse(JSON.stringify(baseVisBack)) },
      
      g: { zoom: 4.0, pos: { qr:{x:0,y:0,s:1}, barcode:createBasePos(), nama:createBasePos(), shading:createBasePos(), ukuran:createBasePos(), mesin:createBasePos(), shift:createBasePos(), tanggal:createBasePos(), po:createBasePos(), dus:createBasePos(), isi:createBasePos() }, font: { barcode: 8, nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, kertas: { tipe: '100x50', w: 100, h: 50 }, wrap: { nama: 33, barcode: 100, nama_cb: true, barcode_cb: true }, barcodeData:"", linkFont: true, vis: JSON.parse(JSON.stringify(baseVis)) },
      g_back: { pos: { nama:createBasePos(), shading:createBasePos(), ukuran:createBasePos(), mesin:createBasePos(), shift:createBasePos(), tanggal:createBasePos(), po:createBasePos(), dus:createBasePos(), isi:createBasePos() }, font: { nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, wrap: { nama: 45, nama_cb: true }, linkFont: true, vis: JSON.parse(JSON.stringify(baseVisBack)) }
  };

  let pendingAction = null;
  function mintaPin(title, callback) {
      document.getElementById('pin-global-title').innerText = title;
      document.getElementById('input-pin-global').placeholder = 'Password Akun Anda...';
      document.getElementById('input-pin-global').value = '';
      pendingAction = callback;
      bukaModal('modal-pin-global');
  }
  
  // REVISI: Otoritas menggunakan Password (Simulasi untuk GAS)
  function eksekusiPinGlobal() {
      let pass = document.getElementById('input-pin-global').value;
      if(pass !== "") {
          tutupModal('modal-pin-global');
          if(pendingAction) pendingAction();
      } else {
          alert("⛔ Password tidak boleh kosong!");
      }
  }

  function mulaiAplikasi() { document.getElementById('start-view').style.display = 'none'; document.getElementById('app-view').style.display = 'block'; pindahMenu('plafon'); }
  function validasiPassword() { let pass = document.getElementById('input-admin-pass').value; if(pass === "12345") { tutupModal('modal-password'); document.getElementById('app-view').style.display = 'none'; document.getElementById('app-settings').style.display = 'flex'; document.getElementById('input-admin-pass').value = ''; } else { alert("Password Salah!"); } }
  function tutupSettings() { document.getElementById('app-settings').style.display = 'none'; document.getElementById('app-view').style.display = 'block'; pindahMenu(currentMenu === 'p' ? 'plafon' : (currentMenu === 'l' ? 'lis' : 'wpc')); }

  function pindahMenu(menu) {
      if (menu === 'khusus' || menu === 'gudang') {
          mintaPin("Akses Print " + (menu==='khusus'?"Khusus":"Gudang"), function() { jalankanPindahMenu(menu); });
      } else {
          jalankanPindahMenu(menu);
      }
  }

  function jalankanPindahMenu(menu) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active')); 
    document.getElementById('nav-' + menu).classList.add('active');
    document.getElementById('template-plafon').style.display = 'none'; 
    document.getElementById('template-lis').style.display = 'none'; 
    document.getElementById('template-wpc').style.display = 'none'; 
    document.getElementById('template-khusus').style.display = 'none'; 
    document.getElementById('template-gudang').style.display = 'none'; 
    document.getElementById('template-' + menu).style.display = 'block';
    
    currentMenu = menu === 'plafon' ? 'p' : (menu === 'lis' ? 'l' : (menu === 'khusus' ? 'k' : (menu === 'gudang' ? 'g' : 'w')));
    
    if(menu === 'plafon' && !isPlafonInit) { initPlafon(); isPlafonInit = true; } 
    else if(menu === 'lis' && !isLisInit) { initLis(); isLisInit = true; }
    else if(menu === 'khusus' && !isKhususInit) { initKhusus(); isKhususInit = true; }
    else if(menu === 'gudang' && !isGudangInit) { initGudang(); isGudangInit = true; }
  }

  window.initGudang = function() {
      let tglEl = document.getElementById('g-tgl');
      if(tglEl) tglEl.valueAsDate = new Date();
      
      if(dataPlafon && dataPlafon.mesin) {
          let selM = document.getElementById('g-mesin');
          if(selM) {
              selM.innerHTML = '<option value="">Pilih...</option>';
              dataPlafon.mesin.forEach(x => selM.add(new Option(x.nama, x.nama)));
          }
          let selS = document.getElementById('g-shift');
          if(selS) {
              selS.innerHTML = '<option value="">Pilih...</option>';
              dataPlafon.shift.forEach(x => selS.add(new Option(x.nama, x.nama)));
          }
      }
      if(window.loadSetDefault) window.loadSetDefault('g');
      if(window.initKeyboardGlobal) window.initKeyboardGlobal();
  };

  window.filterList = function(iId, uId) {
      let el = document.getElementById(iId);
      if(!el) return;
      let f = el.value.toUpperCase(); 
      let li = document.getElementById(uId).getElementsByTagName('li'); 
      for(let i=0; i<li.length; i++){ 
          li[i].style.display = ((li[i].textContent||li[i].innerText).toUpperCase().indexOf(f) > -1) ? "" : "none"; 
      } 
  };

  function saveSetDefault(baseM) { 
      let configFront = { pos: stateGlobal[baseM].pos, font: stateGlobal[baseM].font, gap: stateGlobal[baseM].gap, zoom: stateGlobal[baseM].zoom, vis: stateGlobal[baseM].vis, kertas: stateGlobal[baseM].kertas, wrap: stateGlobal[baseM].wrap, linkFont: stateGlobal[baseM].linkFont }; 
      let configBack = { pos: stateGlobal[baseM+'_back'].pos, font: stateGlobal[baseM+'_back'].font, gap: stateGlobal[baseM+'_back'].gap, vis: stateGlobal[baseM+'_back'].vis, wrap: stateGlobal[baseM+'_back'].wrap, linkFont: stateGlobal[baseM+'_back'].linkFont };
      
      localStorage.setItem('defaultLabel_' + baseM, JSON.stringify({front: configFront, back: configBack})); 
      alert("✅ Pengaturan (Posisi, Lebar Teks, Hide/Unhide, & Ukuran Kertas) berhasil disimpan sebagai Default Baru!"); 
  }
  
  function loadSetDefault(baseM) { 
      let saved = localStorage.getItem('defaultLabel_' + baseM); 
      if(saved) { 
          try { 
              let parsed = JSON.parse(saved); 
              let configFront = parsed.front || parsed;
              let configBack = parsed.back || null;
              
              if(configFront.wrap) stateGlobal[baseM].wrap = configFront.wrap;
              if(configFront.vis) stateGlobal[baseM].vis = configFront.vis;
              if(configFront.linkFont !== undefined) stateGlobal[baseM].linkFont = configFront.linkFont;
              
              if(configFront.kertas) {
                  stateGlobal[baseM].kertas = configFront.kertas;
                  let cv = document.getElementById(baseM+'-label-canvas');
                  let cvBack = document.getElementById(baseM+'-label-canvas-back');
                  let sel = document.getElementById(baseM+'-kertas-select');
                  let cf = document.getElementById(baseM+'-custom-kertas-form');
                  if(cv) { cv.style.width = configFront.kertas.w + 'mm'; cv.style.height = configFront.kertas.h + 'mm'; }
                  if(cvBack) { cvBack.style.width = configFront.kertas.w + 'mm'; cvBack.style.height = configFront.kertas.h + 'mm'; }
                  if(sel) {
                      let optExist = Array.from(sel.options).some(o => o.value === configFront.kertas.tipe);
                      if(!optExist && configFront.kertas.tipe === '100x50') sel.add(new Option("100 x 50 mm", "100x50"), sel.options[0]);
                      sel.value = configFront.kertas.tipe;
                  }
                  if(configFront.kertas.tipe === 'custom' && cf) {
                      cf.style.display = 'flex';
                      let cw = document.getElementById(baseM+'-custom-w'); if(cw) cw.value = configFront.kertas.w;
                      let ch = document.getElementById(baseM+'-custom-h'); if(ch) ch.value = configFront.kertas.h;
                  } else if(cf) {
                      cf.style.display = 'none';
                  }
              }

              stateGlobal[baseM].pos = configFront.pos; 
              stateGlobal[baseM].gap = configFront.gap; 
              
              if(configFront.font) {
                  if(configFront.font.nama_shading !== undefined) {
                      stateGlobal[baseM].font.nama = configFront.font.nama_shading;
                      stateGlobal[baseM].font.shading = configFront.font.nama_shading;
                  } else {
                      stateGlobal[baseM].font.nama = configFront.font.nama || 16;
                      stateGlobal[baseM].font.shading = configFront.font.shading || 16;
                  }
                  stateGlobal[baseM].font.barcode = configFront.font.barcode || 8;
                  stateGlobal[baseM].font.info = configFront.font.info || 6;
              }

              Object.keys(configFront.pos).forEach(key => window.updateTransform(baseM, key)); 
              let fBarcode = document.getElementById(baseM+'-l-barcode-text'); if(fBarcode) fBarcode.style.fontSize = stateGlobal[baseM].font.barcode + "px"; 
              let fNama = document.getElementById(baseM+'-l-nama-item'); if(fNama) fNama.style.fontSize = stateGlobal[baseM].font.nama + "px"; 
              let fShade = document.getElementById(baseM+'-l-shading'); if(fShade) fShade.style.fontSize = stateGlobal[baseM].font.shading + "px"; 
              let fInfo = document.getElementById(baseM+'-l-info-bawah'); if(fInfo) fInfo.style.fontSize = stateGlobal[baseM].font.info + "px"; 
              let gInfo = document.getElementById(baseM+'-l-info-bawah'); if(gInfo) gInfo.style.gap = configFront.gap.info + "px"; 
              
              if(configBack && stateGlobal[baseM+'_back']) {
                  stateGlobal[baseM+'_back'].pos = configBack.pos;
                  stateGlobal[baseM+'_back'].gap = configBack.gap;
                  stateGlobal[baseM+'_back'].font = configBack.font;
                  stateGlobal[baseM+'_back'].wrap = configBack.wrap;
                  if(configBack.vis) stateGlobal[baseM+'_back'].vis = configBack.vis;
                  if(configBack.linkFont !== undefined) stateGlobal[baseM+'_back'].linkFont = configBack.linkFont;
                  
                  Object.keys(configBack.pos).forEach(key => window.updateTransform(baseM+'_back', key)); 
                  let fNamaB = document.getElementById(baseM+'-l-nama-item-back'); if(fNamaB) fNamaB.style.fontSize = stateGlobal[baseM+'_back'].font.nama + "px"; 
                  let fShadeB = document.getElementById(baseM+'-l-shading-back'); if(fShadeB) fShadeB.style.fontSize = stateGlobal[baseM+'_back'].font.shading + "px"; 
                  let fInfoB = document.getElementById(baseM+'-l-info-bawah-back'); if(fInfoB) fInfoB.style.fontSize = stateGlobal[baseM+'_back'].font.info + "px"; 
                  let gInfoB = document.getElementById(baseM+'-l-info-bawah-back'); if(gInfoB) gInfoB.style.gap = configBack.gap.info + "px"; 
              }
              
              if(configFront.vis) { 
                  Object.keys(configFront.vis).forEach(k => { 
                      let cb = document.getElementById(baseM+'-cb-'+k); 
                      if(cb) { 
                          cb.checked = configFront.vis[k]; 
                          if(k === 'wrap-barcode') toggleWrap(baseM, 'barcode-text', configFront.vis[k]); 
                          else if(k === 'wrap-nama') toggleWrap(baseM, 'nama-item', configFront.vis[k]); 
                          else if(k === 'link-font') stateGlobal[baseM].linkFont = configFront.vis[k];
                          else { 
                              if (baseM === 'g') {
                                  window.toggleVisGudang(k, configFront.vis[k]);
                              } else {
                                  let tId = (k === 'qr') ? baseM+'-qr-container' : (k === 'barcode') ? baseM+'-l-barcode-text' : (k === 'nama') ? baseM+'-l-nama-item' : (k === 'grade') ? baseM+'-l-grade-disp' : (k === 'isi') ? baseM+'-l-isi' : baseM+'-l-'+k; 
                                  toggleVis(tId, configFront.vis[k]); 
                                  let tIdBack = tId + '-back';
                                  if(document.getElementById(tIdBack)) toggleVis(tIdBack, configFront.vis[k]);
                              }
                          } 
                      } 
                  }); 
              } 
              if(configFront.zoom) { 
                  stateGlobal[baseM].zoom = configFront.zoom; 
                  let wrapper = document.getElementById(baseM + '-labels-wrapper');
                  if(wrapper) wrapper.style.transform = `scale(${configFront.zoom})`;
                  document.getElementById(baseM+'-zoom-text').innerText = Math.round(configFront.zoom * 100) + "%"; 
              } 
              
              window.switchSideSettings(baseM);
          } catch(e) {} 
      } 
  }

  function simpanSnapshotHistory(baseM) { 
      let snap = {
          front: { pos: JSON.parse(JSON.stringify(stateGlobal[baseM].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[baseM].gap)) }
      };
      if(stateGlobal[baseM+'_back']) {
          snap.back = { pos: JSON.parse(JSON.stringify(stateGlobal[baseM+'_back'].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[baseM+'_back'].gap)) };
      }
      historyStack[baseM].undo.push(snap); 
      historyStack[baseM].redo = []; 
  }
  function eksekusiUndo(baseM) { 
      if (historyStack[baseM].undo.length === 0) return; 
      
      let currentSnap = {
          front: { pos: JSON.parse(JSON.stringify(stateGlobal[baseM].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[baseM].gap)) }
      };
      if(stateGlobal[baseM+'_back']) {
          currentSnap.back = { pos: JSON.parse(JSON.stringify(stateGlobal[baseM+'_back'].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[baseM+'_back'].gap)) };
      }
      historyStack[baseM].redo.push(currentSnap); 
      
      let previous = historyStack[baseM].undo.pop(); 
      stateGlobal[baseM].pos = previous.front.pos; 
      stateGlobal[baseM].gap = previous.front.gap; 
      Object.keys(stateGlobal[baseM].pos).forEach(key => window.updateTransform(baseM, key)); 
      
      if(previous.back && stateGlobal[baseM+'_back']) {
          stateGlobal[baseM+'_back'].pos = previous.back.pos; 
          stateGlobal[baseM+'_back'].gap = previous.back.gap; 
          Object.keys(stateGlobal[baseM+'_back'].pos).forEach(key => window.updateTransform(baseM+'_back', key)); 
      }
  }
  function eksekusiRedo(baseM) { 
      if (historyStack[baseM].redo.length === 0) return; 
      
      let currentSnap = {
          front: { pos: JSON.parse(JSON.stringify(stateGlobal[baseM].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[baseM].gap)) }
      };
      if(stateGlobal[baseM+'_back']) {
          currentSnap.back = { pos: JSON.parse(JSON.stringify(stateGlobal[baseM+'_back'].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[baseM+'_back'].gap)) };
      }
      historyStack[baseM].undo.push(currentSnap); 
      
      let next = historyStack[baseM].redo.pop(); 
      stateGlobal[baseM].pos = next.front.pos; 
      stateGlobal[baseM].gap = next.front.gap; 
      Object.keys(stateGlobal[baseM].pos).forEach(key => window.updateTransform(baseM, key)); 
      
      if(next.back && stateGlobal[baseM+'_back']) {
          stateGlobal[baseM+'_back'].pos = next.back.pos; 
          stateGlobal[baseM+'_back'].gap = next.back.gap; 
          Object.keys(stateGlobal[baseM+'_back'].pos).forEach(key => window.updateTransform(baseM+'_back', key)); 
      }
  }
  
  function ubahTipeKertas(m) { 
      let select = document.getElementById(m + '-kertas-select'); 
      let customForm = document.getElementById(m + '-custom-kertas-form'); 
      let w = 50.8, h = 27.9;
      
      if (select.value === 'custom') { 
          customForm.style.display = 'flex'; 
          w = parseFloat(document.getElementById(m + '-custom-w').value) || 50.8;
          h = parseFloat(document.getElementById(m + '-custom-h').value) || 27.9;
          stateGlobal[m].kertas.tipe = 'custom'; 
      } else if (select.value === '100x50') { 
          customForm.style.display = 'none'; 
          stateGlobal[m].kertas.tipe = '100x50'; w = 100; h = 50; 
      } else { 
          customForm.style.display = 'none'; 
          stateGlobal[m].kertas.tipe = '50.8x27.9'; w = 50.8; h = 27.9; 
      } 
      
      stateGlobal[m].kertas.w = w; stateGlobal[m].kertas.h = h;
      
      if (m === 'g') {
          document.querySelectorAll('.g-el-canvas').forEach(c => { c.style.width = w + 'mm'; c.style.height = h + 'mm'; });
      } else {
          let canvas = document.getElementById(m + '-label-canvas'); 
          let canvasBack = document.getElementById(m + '-label-canvas-back'); 
          if(canvas) { canvas.style.width = w + 'mm'; canvas.style.height = h + 'mm'; }
          if(canvasBack) { canvasBack.style.width = w + 'mm'; canvasBack.style.height = h + 'mm'; }
      }
  }
  
  function updateKertasCustomDimensi(m) { 
      let wVal = parseFloat(document.getElementById(m + '-custom-w').value) || 50.8; 
      let hVal = parseFloat(document.getElementById(m + '-custom-h').value) || 27.9; 
      stateGlobal[m].kertas.tipe = 'custom'; stateGlobal[m].kertas.w = wVal; stateGlobal[m].kertas.h = hVal; 
      
      if (m === 'g') {
          document.querySelectorAll('.g-el-canvas').forEach(c => { c.style.width = wVal + 'mm'; c.style.height = hVal + 'mm'; });
      } else {
          let canvas = document.getElementById(m + '-label-canvas'); 
          let canvasBack = document.getElementById(m + '-label-canvas-back'); 
          if(canvas) { canvas.style.width = wVal + 'mm'; canvas.style.height = hVal + 'mm'; } 
          if(canvasBack) { canvasBack.style.width = wVal + 'mm'; canvasBack.style.height = hVal + 'mm'; } 
      }
  }

  function bukaModal(id) { document.getElementById(id).style.display = 'block'; }
  function tutupModal(id) { document.getElementById(id).style.display = 'none'; }
  function toggleVis(id, vis) { let el = document.getElementById(id); if(el) { if(vis) el.classList.remove('hidden-element'); else el.classList.add('hidden-element'); } }
  function togglePanelBody(bodyId, iconId) { let body = document.getElementById(bodyId); let icon = document.getElementById(iconId); if(body.style.display === 'none') { body.style.display = 'block'; icon.innerText = '▼'; } else { body.style.display = 'none'; icon.innerText = '◀'; } }
  
  window.switchSideSettings = function(baseM) {
      let side = document.getElementById(baseM + '-side-select').value;
      let m = side === 'back' ? baseM + '_back' : baseM;
      
      let qrRow = document.getElementById(baseM + '-row-qr');
      let bcRow = document.getElementById(baseM + '-row-barcode');
      let bcWrapRow = document.getElementById(baseM + '-row-wrap-barcode');
      
      if(side === 'back') {
          if(qrRow) qrRow.style.display = 'none';
          if(bcRow) bcRow.style.display = 'none';
          if(bcWrapRow) bcWrapRow.style.display = 'none';
      } else {
          if(qrRow) qrRow.style.display = 'inline-flex';
          if(bcRow) bcRow.style.display = 'inline-flex';
          if(bcWrapRow) bcWrapRow.style.display = 'inline-flex';
      }

      let keys = ['nama', 'shading', 'ukuran', 'mesin', 'shift', 'tanggal', 'po', 'dus', 'isi'];
      if(side === 'front') keys.push('qr', 'barcode');
      
      keys.forEach(k => {
          let cb = document.getElementById(baseM + '-cb-' + k);
          if(cb && stateGlobal[m].vis) cb.checked = stateGlobal[m].vis[k];
      });

      let cbWrapNama = document.getElementById(baseM + '-cb-wrap-nama');
      if(cbWrapNama) cbWrapNama.checked = stateGlobal[m].wrap.nama_cb !== false; 
      
      if(side === 'front') {
          let cbWrapBc = document.getElementById(baseM + '-cb-wrap-barcode');
          if(cbWrapBc) cbWrapBc.checked = stateGlobal[m].wrap.barcode_cb !== false;
      }

      let cbLink = document.getElementById(baseM + '-cb-link-font');
      if(cbLink) cbLink.checked = stateGlobal[m].linkFont;
  };

  window.handleVisChange = function(baseM, key, isChecked, forceSide) {
      let side = forceSide || document.getElementById(baseM + '-side-select').value;
      let m = side === 'back' ? baseM + '_back' : baseM;
      let sfx = side === 'back' ? '-back' : '';
      
      if(stateGlobal[m] && stateGlobal[m].vis) stateGlobal[m].vis[key] = isChecked;
      
      if (baseM === 'g') {
          let els = document.querySelectorAll('.g-el-' + key + sfx);
          els.forEach(el => {
              if(isChecked) el.classList.remove('hidden-element');
              else el.classList.add('hidden-element');
          });
      } else {
          let tId = (key === 'qr') ? baseM+'-qr-container'+sfx : (key === 'barcode') ? baseM+'-l-barcode-text'+sfx : (key === 'nama') ? baseM+'-l-nama-item'+sfx : (key === 'grade') ? baseM+'-l-grade-disp'+sfx : (key === 'isi') ? baseM+'-l-isi'+sfx : baseM+'-l-'+key+sfx; 
          let el = document.getElementById(tId);
          if(el) {
              if(isChecked) el.classList.remove('hidden-element');
              else el.classList.add('hidden-element');
          }
      }
  };

  window.handleWrapChange = function(baseM, key, isChecked, forceSide) {
      let side = forceSide || document.getElementById(baseM + '-side-select').value;
      let m = side === 'back' ? baseM + '_back' : baseM;
      let sfx = side === 'back' ? '-back' : '';
      
      stateGlobal[m].wrap[key + '_cb'] = isChecked;
      let val = stateGlobal[m].wrap[key];
      let elId = key === 'nama' ? 'nama-item' : 'barcode-text';
      
      if (baseM === 'g') {
          let els = document.querySelectorAll('.g-el-' + key + sfx);
          els.forEach(el => {
              if(isChecked) { el.style.whiteSpace = 'normal'; el.style.wordWrap = 'break-word'; el.style.maxWidth = val + (key==='nama'?'mm':'px'); } 
              else { el.style.whiteSpace = 'nowrap'; el.style.maxWidth = 'none'; } 
          });
      } else {
          let el = document.getElementById(baseM + '-l-' + elId + sfx); 
          if(el) { 
              if(isChecked) { el.style.whiteSpace = 'normal'; el.style.wordWrap = 'break-word'; el.style.maxWidth = val + (key==='nama'?'mm':'px'); } 
              else { el.style.whiteSpace = 'nowrap'; el.style.maxWidth = 'none'; } 
          } 
      }
  };

  window.handleLinkFontChange = function(baseM, isChecked) {
      let side = document.getElementById(baseM + '-side-select').value;
      let m = side === 'back' ? baseM + '_back' : baseM;
      stateGlobal[m].linkFont = isChecked;
  };

  window.resetDefaultVisibility = function(baseM) { 
      let defaultVisFront = { qr: true, barcode: true, nama: true, shading: true, ukuran: true, mesin: false, shift: true, tanggal: true, po: false, dus: true, isi: true };
      let defaultVisBack = { nama: true, shading: true, ukuran: true, mesin: false, shift: true, tanggal: true, po: false, dus: true, isi: true };
      
      stateGlobal[baseM].vis = JSON.parse(JSON.stringify(defaultVisFront));
      if(stateGlobal[baseM+'_back']) stateGlobal[baseM+'_back'].vis = JSON.parse(JSON.stringify(defaultVisBack));
      
      stateGlobal[baseM].wrap = { nama: 33, barcode: 100, nama_cb: true, barcode_cb: true };
      if(stateGlobal[baseM+'_back']) stateGlobal[baseM+'_back'].wrap = { nama: 45, nama_cb: true };
      
      stateGlobal[baseM].linkFont = true;
      if(stateGlobal[baseM+'_back']) stateGlobal[baseM+'_back'].linkFont = true;
      
      Object.keys(defaultVisFront).forEach(k => window.handleVisChange(baseM, k, defaultVisFront[k], 'front'));
      Object.keys(defaultVisBack).forEach(k => window.handleVisChange(baseM, k, defaultVisBack[k], 'back'));
      
      window.handleWrapChange(baseM, 'nama', true, 'front');
      window.handleWrapChange(baseM, 'barcode', true, 'front');
      window.handleWrapChange(baseM, 'nama', true, 'back');
      
      window.switchSideSettings(baseM);
  };
  
  function ubahZoom(m, step) { 
      stateGlobal[m].zoom += step; 
      if(stateGlobal[m].zoom < 0.5) stateGlobal[m].zoom = 0.5; 
      if(stateGlobal[m].zoom > 6.0) stateGlobal[m].zoom = 6.0; 
      
      let wrapper = document.getElementById(m + '-labels-wrapper');
      if(wrapper) wrapper.style.transform = `scale(${stateGlobal[m].zoom})`;
      
      document.getElementById(m+'-zoom-text').innerText = Math.round(stateGlobal[m].zoom * 100) + "%"; 
  }
  
  function toggleAccordion(id) { let c = document.getElementById(id); c.style.display = (c.style.display === "block") ? "none" : "block"; }
  
  window.startDrag = function(m, b, event) { 
      event.preventDefault(); 
      
      let els = [];
      if (m === 'g' || m === 'g_back') {
          let sfx = m === 'g_back' ? '-back' : '';
          els = Array.from(document.querySelectorAll('.g-el-' + b + sfx));
      } else {
          let map = window.getElMap(m); 
          els = [document.getElementById(map[b])];
      }
      
      if(event.ctrlKey) { 
          if(activeSelection.elements.includes(b)) { 
              activeSelection.elements = activeSelection.elements.filter(e => e !== b); 
              els.forEach(el => el.classList.remove('active-edit')); 
          } else { 
              activeSelection.elements.push(b); 
              els.forEach(el => el.classList.add('active-edit')); 
              activeSelection.m = m; 
          } 
      } else { 
          if(!activeSelection.elements.includes(b)) { 
              document.querySelectorAll('.click-edit').forEach(e => e.classList.remove('active-edit')); 
              activeSelection.elements = [b]; 
              activeSelection.m = m; 
              els.forEach(el => el.classList.add('active-edit')); 
          } 
      } 
      
      let baseM = m.split('_')[0];
      let side = m.endsWith('_back') ? 'back' : 'front';
      let selectEl = document.getElementById(baseM + '-side-select');
      if(selectEl && selectEl.value !== side) {
          selectEl.value = side;
          window.switchSideSettings(baseM);
      }

      showContextPanel(baseM); 
      simpanSnapshotHistory(baseM); 
      isDragging = true; dragStartX = event.clientX; dragStartY = event.clientY; dragInitialPos = {}; 
      
      activeSelection.elements.forEach(elKey => { dragInitialPos[elKey] = { x: stateGlobal[m].pos[elKey].x, y: stateGlobal[m].pos[elKey].y }; }); 
      event.stopPropagation(); 
  }
  
  document.addEventListener('mousemove', function(e) { if(!isDragging || activeSelection.elements.length === 0) return; let m = activeSelection.m; let baseM = m.split('_')[0]; let zoom = stateGlobal[baseM].zoom; let dx = (e.clientX - dragStartX) / zoom; let dy = (e.clientY - dragStartY) / zoom; if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; } activeSelection.elements.forEach(elKey => { if(stateGlobal[m].pos[elKey]) { stateGlobal[m].pos[elKey].x = dragInitialPos[elKey].x + dx; stateGlobal[m].pos[elKey].y = dragInitialPos[elKey].y + dy; window.updateTransform(m, elKey); } }); });
  document.addEventListener('mouseup', function() { isDragging = false; });
  document.addEventListener('mousedown', function(e) { if(e.target.closest('.click-edit') || e.target.closest('#p-context-panel') || e.target.closest('#l-context-panel') || e.target.closest('#k-context-panel') || e.target.closest('#g-context-panel') || e.target.closest('.zoom-controls') || e.target.closest('.btn-secondary') || e.target.closest('.checkbox-panel') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return; document.querySelectorAll('.click-edit').forEach(el => el.classList.remove('active-edit')); activeSelection = { m: null, elements: [] }; let pCtx = document.getElementById('p-context-panel'); if(pCtx) pCtx.style.display = 'none'; let lCtx = document.getElementById('l-context-panel'); if(lCtx) lCtx.style.display = 'none'; let kCtx = document.getElementById('k-context-panel'); if(kCtx) kCtx.style.display = 'none'; let gCtx = document.getElementById('g-context-panel'); if(gCtx) gCtx.style.display = 'none'; });

  function showContextPanel(baseM) { 
      let m = activeSelection.m || baseM;
      let ctxPanel = document.getElementById(baseM+'-context-panel'); if(!ctxPanel) return; 
      let b = activeSelection.elements[activeSelection.elements.length - 1]; 
      if(!b) { ctxPanel.style.display = 'none'; return; } 
      ctxPanel.style.display = 'flex'; 
      
      let boxQr = document.getElementById(baseM+'-ctx-qr-box'); 
      let boxFont = document.getElementById(baseM+'-ctx-font-box'); 
      let boxGap = document.getElementById(baseM+'-ctx-gap-box'); 
      let boxWrap = document.getElementById(baseM+'-ctx-wrap-box');
      
      if(boxQr) boxQr.style.display = 'none'; 
      if(boxFont) boxFont.style.display = 'none'; 
      if(boxGap) boxGap.style.display = 'none'; 
      if(boxWrap) boxWrap.style.display = 'none'; 
      
      if (b === 'qr') { 
          if(boxQr) {
              boxQr.style.display = 'flex'; 
              document.getElementById(baseM+'-ctx-skala-qr').value = Math.round(stateGlobal[m].pos.qr.s * 100); 
              document.getElementById(baseM+'-ctx-val-qr').value = Math.round(stateGlobal[m].pos.qr.s * 100); 
          }
      } else if (b === 'barcode') { 
          if(boxFont) {
              boxFont.style.display = 'flex'; 
              let f = document.getElementById(baseM+'-ctx-font'); f.min = 3; f.max = 80; f.value = stateGlobal[m].font.barcode; 
              document.getElementById(baseM+'-ctx-val-font').value = stateGlobal[m].font.barcode; 
          }
          if(boxWrap) {
              boxWrap.style.display = 'flex'; 
              let w = document.getElementById(baseM+'-ctx-wrap'); w.min = 10; w.max = 150; w.value = stateGlobal[m].wrap.barcode; 
              document.getElementById(baseM+'-ctx-val-wrap').value = stateGlobal[m].wrap.barcode;
          }
      } else if (['nama', 'shading'].includes(b)) { 
          if(boxFont) {
              boxFont.style.display = 'flex'; 
              let currentFont = stateGlobal[m].font[b];
              let f = document.getElementById(baseM+'-ctx-font'); f.min = 8; f.max = 80; f.value = currentFont; 
              document.getElementById(baseM+'-ctx-val-font').value = currentFont; 
          }
          if (b === 'nama' && boxWrap) {
              boxWrap.style.display = 'flex'; 
              let w = document.getElementById(baseM+'-ctx-wrap'); w.min = 10; w.max = 150; w.value = stateGlobal[m].wrap.nama; 
              document.getElementById(baseM+'-ctx-val-wrap').value = stateGlobal[m].wrap.nama;
          }
      } else { 
          if(boxFont) {
              boxFont.style.display = 'flex'; 
              let f = document.getElementById(baseM+'-ctx-font'); f.min = 3; f.max = 80; f.value = stateGlobal[m].font.info; 
              document.getElementById(baseM+'-ctx-val-font').value = stateGlobal[m].font.info; 
          }
          if(boxGap) {
              boxGap.style.display = 'flex'; 
              let g = document.getElementById(baseM+'-ctx-gap'); g.min = 0; g.max = 20; g.value = stateGlobal[m].gap.info; 
              document.getElementById(baseM+'-ctx-val-gap').value = stateGlobal[m].gap.info; 
          }
      } 
  }
  
  function inputManualContext(baseM, type, val) { 
      let m = activeSelection.m || baseM;
      simpanSnapshotHistory(baseM); 
      let nVal = parseInt(val); 
      let sliderId = `${baseM}-ctx-${type==='qr'?'skala-qr':type}`;
      let slider = document.getElementById(sliderId); 
      if(slider) { 
          if(isNaN(nVal)) nVal = parseInt(slider.value); 
          if(nVal < parseInt(slider.min)) nVal = parseInt(slider.min); 
          if(nVal > parseInt(slider.max)) nVal = parseInt(slider.max); 
          slider.value = nVal; 
          document.getElementById(`${baseM}-ctx-val-${type}`).value = nVal; 
          syncContext(baseM, type, nVal); 
      } 
  }
  
  function stepContextSlider(baseM, type, step) { 
      let m = activeSelection.m || baseM;
      if(type==='gap' || type==='wrap') simpanSnapshotHistory(baseM); 
      let sliderId = `${baseM}-ctx-${type==='qr'?'skala-qr':type}`;
      let slider = document.getElementById(sliderId); 
      if(slider) { 
          let nVal = parseInt(slider.value) + step; 
          if(nVal >= slider.min && nVal <= slider.max) { 
              slider.value = nVal; 
              syncContext(baseM, type, nVal); 
              document.getElementById(`${baseM}-ctx-val-${type}`).value = nVal; 
          } 
      } 
  }
  
  function syncContext(baseM, type, value) { 
      if(activeSelection.elements.length === 0) return; 
      let m = activeSelection.m || baseM;
      document.getElementById(`${baseM}-ctx-val-${type}`).value = value; 
      
      if (type === 'qr') { 
          stateGlobal[m].pos.qr.s = value / 100; window.updateTransform(m, 'qr'); 
      } else if (type === 'font') { 
          activeSelection.elements.forEach(b => { 
              if (b === 'barcode') { 
                  stateGlobal[m].font.barcode = value; 
                  if (m === 'g' || m === 'g_back') {
                      let sfx = m === 'g_back' ? '-back' : '';
                      document.querySelectorAll('.g-el-barcode' + sfx).forEach(el => el.style.fontSize = value + "px");
                  } else {
                      let sfx = m.endsWith('_back') ? '-back' : '';
                      document.getElementById(baseM+'-l-barcode-text'+sfx).style.fontSize = value + "px"; 
                  }
              } 
              else if (['nama', 'shading'].includes(b)) { 
                  if (stateGlobal[m].linkFont) {
                      stateGlobal[m].font.nama = value;
                      stateGlobal[m].font.shading = value;
                      if (m === 'g' || m === 'g_back') {
                          let sfx = m === 'g_back' ? '-back' : '';
                          document.querySelectorAll('.g-el-nama' + sfx).forEach(el => el.style.fontSize = value + "px");
                          document.querySelectorAll('.g-el-shading' + sfx).forEach(el => el.style.fontSize = value + "px");
                      } else {
                          let sfx = m.endsWith('_back') ? '-back' : '';
                          document.getElementById(baseM+'-l-nama-item'+sfx).style.fontSize = value + "px";
                          document.getElementById(baseM+'-l-shading'+sfx).style.fontSize = value + "px";
                      }
                  } else {
                      stateGlobal[m].font[b] = value;
                      if (m === 'g' || m === 'g_back') {
                          let sfx = m === 'g_back' ? '-back' : '';
                          document.querySelectorAll('.g-el-' + b + sfx).forEach(el => el.style.fontSize = value + "px");
                      } else {
                          let sfx = m.endsWith('_back') ? '-back' : '';
                          let elId = b === 'nama' ? baseM+'-l-nama-item'+sfx : baseM+'-l-shading'+sfx;
                          document.getElementById(elId).style.fontSize = value + "px";
                      }
                  }
              } 
              else { 
                  stateGlobal[m].font.info = value; 
                  if (m === 'g' || m === 'g_back') {
                      let sfx = m === 'g_back' ? '-back' : '';
                      document.querySelectorAll('.g-el-' + b + sfx).forEach(el => el.style.fontSize = value + "px");
                  } else {
                      let sfx = m.endsWith('_back') ? '-back' : '';
                      let map = window.getElMap(m); 
                      let el = document.getElementById(map[b]); 
                      if(el) el.style.fontSize = value + "px"; 
                  }
              } 
          }); 
      } else if (type === 'gap') { 
          activeSelection.elements.forEach(b => { 
              if (['ukuran','mesin','shift','tanggal','po','dus','isi'].includes(b)) { 
                  stateGlobal[m].gap.info = value; 
                  if (m === 'g' || m === 'g_back') {
                      let sfx = m === 'g_back' ? '-back' : '';
                      document.querySelectorAll('.g-el-gap-info' + sfx).forEach(el => el.style.gap = value + "px");
                  } else {
                      let sfx = m.endsWith('_back') ? '-back' : '';
                      document.getElementById(baseM+'-l-info-bawah'+sfx).style.gap = value + "px"; 
                  }
              } 
          }); 
      } else if (type === 'wrap') {
          activeSelection.elements.forEach(b => {
              if (b === 'nama') {
                  stateGlobal[m].wrap.nama = value;
                  if (m === 'g' || m === 'g_back') {
                      let sfx = m === 'g_back' ? '-back' : '';
                      document.querySelectorAll('.g-el-nama' + sfx).forEach(el => { if(el.style.whiteSpace === 'normal') el.style.maxWidth = value + 'mm'; });
                  } else {
                      let sfx = m.endsWith('_back') ? '-back' : '';
                      let el = document.getElementById(baseM+'-l-nama-item'+sfx);
                      if(el && el.style.whiteSpace === 'normal') el.style.maxWidth = value + 'mm';
                  }
              } else if (b === 'barcode') {
                  stateGlobal[m].wrap.barcode = value;
                  if (m === 'g' || m === 'g_back') {
                      let sfx = m === 'g_back' ? '-back' : '';
                      document.querySelectorAll('.g-el-barcode' + sfx).forEach(el => { if(el.style.whiteSpace === 'normal') el.style.maxWidth = value + 'px'; });
                  } else {
                      let sfx = m.endsWith('_back') ? '-back' : '';
                      let el = document.getElementById(baseM+'-l-barcode-text'+sfx);
                      if(el && el.style.whiteSpace === 'normal') el.style.maxWidth = value + 'px';
                  }
              }
          });
      }
  }

  function initKeyboardGlobal() { document.removeEventListener('keydown', penangananKeyboardEvent); document.addEventListener('keydown', penangananKeyboardEvent); }
  function penangananKeyboardEvent(e) { let m = activeSelection.m || currentMenu; let baseM = m.split('_')[0]; if(e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); eksekusiUndo(baseM); return; } if(e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); eksekusiRedo(baseM); return; } if(activeSelection.elements.length === 0) return; if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName.toUpperCase())) return; let x=0, y=0, s=(e.shiftKey)?5:1; switch(e.key){ case 'ArrowUp': y=-s; break; case 'ArrowDown': y=s; break; case 'ArrowLeft': x=-s; break; case 'ArrowRight': x=s; break; default: return; } e.preventDefault(); simpanSnapshotHistory(baseM); activeSelection.elements.forEach(elKey => { if(stateGlobal[m].pos[elKey]) { stateGlobal[m].pos[elKey].x += x; stateGlobal[m].pos[elKey].y += y; window.updateTransform(m, elKey); } }); }

  setTimeout(() => {
      let pBtnCetak = document.getElementById("p-btn-cetak-label"); if(pBtnCetak) pBtnCetak.style.display = "flex";
      let lBtnCetak = document.getElementById("l-btn-cetak-label"); if(lBtnCetak) lBtnCetak.style.display = "flex";
      let pBtnSimpan = document.getElementById("p-btn-simpan-settings"); if(pBtnSimpan) pBtnSimpan.remove();
      let lBtnSimpan = document.getElementById("l-btn-simpan-settings"); if(lBtnSimpan) lBtnSimpan.remove();
      
      let lSearch = document.getElementById('l-input-search-item'); if(lSearch) lSearch.removeAttribute('readonly');
      let pSearch = document.getElementById('p-input-search-item'); if(pSearch) pSearch.removeAttribute('readonly');
      
      ['p', 'l', 'k', 'g'].forEach(m => {
          let selKertas = document.getElementById(m+'-kertas-select');
          if(selKertas) {
              let optExist = Array.from(selKertas.options).some(o => o.value === '100x50');
              if(!optExist) { selKertas.add(new Option("100 x 50 mm", "100x50"), selKertas.options[0]); }
              selKertas.value = '100x50';
          }
      });

      window.updateShading = function(m) {
          let v1 = document.getElementById(m+'-shading-1').value.trim().toUpperCase();
          let v2 = document.getElementById(m+'-shading-2').value.trim().toUpperCase();
          let v3 = document.getElementById(m+'-shading-3').value.trim().toUpperCase();
          
          let arr = [];
          if(v1) arr.push(v1);
          if(v2) arr.push(v2);
          if(v3) arr.push(v3);
          
          let hiddenInput = document.getElementById(m+'-shading');
          if(hiddenInput) hiddenInput.value = arr.join('-');
      };

      window.toggleAturLabel = function(m) { 
          let pf = document.getElementById(m+'-panel-form'); 
          let ps = document.getElementById(m+'-panel-settings'); 
          if(pf.style.display === 'none') { pf.style.display = 'block'; ps.style.display = 'none'; window.switchSideSettings(m); } 
          else { pf.style.display = 'none'; ps.style.display = 'block'; } 
      };

      window.getElMap = function(m) {
          let isBack = m.endsWith('_back');
          let baseM = m.split('_')[0];
          let sfx = isBack ? '-back' : '';
          
          let map = { 
              'qr': baseM+'-qrcode-wrapper'+sfx, 
              'barcode': baseM+'-l-barcode-text'+sfx, 
              'nama': baseM+'-l-nama-item'+sfx, 
              'shading': baseM+'-l-shading'+sfx, 
              'ukuran': baseM+'-l-ukuran'+sfx, 
              'mesin': baseM+'-l-mesin'+sfx, 
              'shift': baseM+'-l-shift'+sfx, 
              'tanggal': baseM+'-l-tanggal'+sfx, 
              'dus': baseM+'-l-dus'+sfx 
          };
          if(baseM === 'p' || baseM === 'k') { map['po'] = baseM+'-l-po'+sfx; map['isi'] = baseM+'-l-isi'+sfx; }
          if(baseM === 'l') { map['isi'] = baseM+'-l-isi'+sfx; }
          return map;
      };

      window.updateTransform = function(m, b) {
          if (m === 'g' || m === 'g_back') {
              let sfx = m === 'g_back' ? '-back' : '';
              let els = document.querySelectorAll('.g-el-' + b + sfx);
              els.forEach(el => {
                  if(b === 'qr') el.style.transform = `translate(${stateGlobal[m].pos.qr.x}px, ${stateGlobal[m].pos.qr.y}px) scale(${stateGlobal[m].pos.qr.s})`; 
                  else el.style.transform = `translate(${stateGlobal[m].pos[b].x}px, ${stateGlobal[m].pos[b].y}px)`;
              });
          } else {
              let map = window.getElMap(m); let el = document.getElementById(map[b]); if(!el) return;
              if(b === 'qr') el.style.transform = `translate(${stateGlobal[m].pos.qr.x}px, ${stateGlobal[m].pos.qr.y}px) scale(${stateGlobal[m].pos.qr.s})`; 
              else el.style.transform = `translate(${stateGlobal[m].pos[b].x}px, ${stateGlobal[m].pos[b].y}px)`;
          }
      };

      window.isiDropdown = function(m, data) {
          if(!data) return;
          let isiSelect = function(id, arr) {
              let sel = document.getElementById(id); 
              if(!sel || sel.tagName.toUpperCase() !== 'SELECT') return;
              sel.innerHTML = '<option value="">Pilih...</option>';
              if(arr) { arr.forEach(x => { let opt = new Option(x.nama, x.nama); opt.setAttribute("data-kode", x.kode || ""); sel.add(opt); }); }
          };
          
          isiSelect(m+'-mesin', data.mesin);
          let sM = document.getElementById(m+'-mesin'); 
          if(sM && sM.tagName.toUpperCase() === 'SELECT') { 
              sM.add(new Option("+ Tambah Mesin Baru", "ADD_NEW")); 
              sM.options[sM.options.length-1].style.fontWeight = "bold"; 
              sM.options[sM.options.length-1].style.color = "blue"; 
          }
          
          isiSelect(m+'-shift', data.shift);
          
          if(m === 'p'){
              isiSelect('p-grade', data.grade);
              if(data.po) window.isiListModal('p-po-list', data.po, 'po', 'p');
          } else {
              isiSelect('l-grade', data.grade);
          }
          
          if(data.items) window.isiListModal(m+'-item-list', data.items, 'item', m); 
          if(data.dus) window.isiListModal(m+'-dus-list', data.dus, 'dus', m); 
      };

      window.isiListModal = function(uId, arr, type, m) {
          let ul = document.getElementById(uId); if(!ul) return;
          ul.innerHTML = '';
          arr.forEach(val => {
              let li = document.createElement('li');
              li.textContent = val.nama;
              li.setAttribute("data-kode", val.kode || "");
              
              li.onclick = function() {
                  document.querySelectorAll(`#${uId} li`).forEach(el => el.classList.remove('selected'));
                  li.classList.add('selected');
                  if(m === 'p'){
                      if(type === 'item') { selectedPlafonItem = val.nama; selectedPlafonItemKode = val.kode; }
                      if(type === 'po') { selectedPlafonPO = val.nama; selectedPlafonPOKode = val.kode; }
                      if(type === 'dus') { selectedPlafonDus = val.nama; selectedPlafonDusKode = val.kode; }
                  } else {
                      if(type === 'item') { selectedLisItem = val.nama; selectedLisItemKode = val.kode; }
                      if(type === 'dus') { selectedLisDus = val.nama; selectedLisDusKode = val.kode; }
                  }
              };
              ul.appendChild(li);
          });
      };

      window.hapusDataTerpilih = function(m, type) {
          let val = "";
          if(m === 'p') {
              if(type === 'item') val = selectedPlafonItem;
              if(type === 'po') val = selectedPlafonPO;
              if(type === 'dus') val = selectedPlafonDus;
          } else {
              if(type === 'item') val = selectedLisItem;
              if(type === 'dus') val = selectedLisDus;
          }

          if(!val) { alert("Pilih data dari daftar terlebih dahulu!"); return; }

          mintaPin(`Hapus '${val}'`, function() {
              let sheetName = m === 'p' ? 'MASTER PLAFON' : 'MASTER LIS';
              let btn = document.getElementById(`${m}-btn-hapus-${type}`);
              let oldText = btn.innerText;
              btn.innerText = '⏳ Menghapus...'; btn.disabled = true;

              google.script.run.withSuccessHandler(function(res) {
                  btn.innerText = oldText; btn.disabled = false;
                  if(res === 'SUCCESS') {
                      let dt = m === 'p' ? dataPlafon : dataLis;
                      let dataKey = type === 'item' ? 'items' : type;
                      dt[dataKey] = dt[dataKey].filter(x => x.nama !== val);
                      window.isiListModal(`${m}-${type}-list`, dt[dataKey], type, m);
                      
                      if(m === 'p') {
                          if(type === 'item') { selectedPlafonItem = ""; selectedPlafonItemKode = ""; }
                          if(type === 'po') { selectedPlafonPO = ""; selectedPlafonPOKode = ""; }
                          if(type === 'dus') { selectedPlafonDus = ""; selectedPlafonDusKode = ""; }
                      } else {
                          if(type === 'item') { selectedLisItem = ""; selectedLisItemKode = ""; }
                          if(type === 'dus') { selectedLisDus = ""; selectedLisDusKode = ""; }
                      }
                      alert("Data berhasil dihapus!");
                  } else {
                      alert(res);
                  }
              }).hapusDataMaster(sheetName, type, val);
          });
      };

      window.pilihItem = function(m) {
          let val = m === 'p' ? selectedPlafonItem : selectedLisItem;
          let kode = m === 'p' ? selectedPlafonItemKode : selectedLisItemKode;
          if(val){
              let inputEl = document.getElementById(m+'-item');
              inputEl.value = val; inputEl.setAttribute('data-kode', kode || "");
              tutupModal(m+'-modal-cari-item');
          } else alert("Pilih item!");
      };

      window.pilihPO = function(m) {
          if(selectedPlafonPO){
              let inputEl = document.getElementById('p-po');
              inputEl.value = selectedPlafonPO; inputEl.setAttribute('data-kode', selectedPlafonPOKode || "");
              tutupModal('p-modal-cari-po');
          } else alert("Pilih PO!");
      };

      window.pilihDus = function(m) {
          let val = m === 'p' ? selectedPlafonDus : selectedLisDus;
          let kode = m === 'p' ? selectedPlafonDusKode : selectedLisDusKode;
          if(val){
              let inputEl = document.getElementById(m+'-dus');
              inputEl.value = val; inputEl.setAttribute('data-kode', kode || "");
              tutupModal(m+'-modal-cari-dus');
          } else alert("Pilih Merk!");
      };

      let dapatkanKodeElemen = function(id) {
          let el = document.getElementById(id); if(!el) return "";
          if(el.tagName.toUpperCase() === 'SELECT') { let opt = el.options[el.selectedIndex]; return opt ? (opt.getAttribute('data-kode') || "") : ""; }
          return el.getAttribute('data-kode') || "";
      };

      let modals = ['mesin', 'shift', 'item', 'grade', 'dus', 'po'];
      ['p', 'l'].forEach(m => {
          modals.forEach(jenis => {
              let container = document.querySelector(`#${m}-modal-tambah-${jenis} .modal-content`);
              let btn = document.getElementById(`${m}-btn-simpan-${jenis}`);
              if(container && btn && !document.getElementById(`${m}-input-${jenis}-kode`)) {
                  let inputNama = document.getElementById(`${m}-input-${jenis}-baru`);
                  if(inputNama) { inputNama.placeholder = `Nama ${jenis.toUpperCase()} Baru`; inputNama.style.marginBottom = "5px"; }
                  
                  let inputKode = document.createElement('input'); 
                  inputKode.type = "text"; inputKode.id = `${m}-input-${jenis}-kode`; inputKode.placeholder = "Kode (Unik)"; 
                  inputKode.style.cssText = "width:100%; box-sizing:border-box; padding:8px; margin-bottom:5px;"; 
                  container.insertBefore(inputKode, btn);
                  
                  if(m === 'l' && jenis === 'item') {
                      let inputIsi = document.createElement('input'); 
                      inputIsi.type = "number"; inputIsi.id = `${m}-input-${jenis}-isi`; inputIsi.placeholder = "Isi / Qty (Angka)"; 
                      inputIsi.style.cssText = "width:100%; box-sizing:border-box; padding:8px; margin-bottom:5px;"; 
                      container.insertBefore(inputIsi, btn);
                  }
                  
                  let inputPin = document.createElement('input'); 
                  inputPin.type = "password"; inputPin.id = `${m}-input-${jenis}-pin`; inputPin.placeholder = "Masukkan PIN Master"; 
                  inputPin.style.cssText = "width:100%; box-sizing:border-box; padding:8px; margin-bottom:10px;"; 
                  container.insertBefore(inputPin, btn);
              }
          });
      });

      window.simpanDataBaru = function(m, jenis) {
          let inNama = document.getElementById(`${m}-input-${jenis}-baru`), nama = inNama ? inNama.value.trim() : "";
          let inKode = document.getElementById(`${m}-input-${jenis}-kode`), kode = inKode ? inKode.value.trim() : "";
          let inPin = document.getElementById(`${m}-input-${jenis}-pin`), pin = inPin ? inPin.value.trim() : "";
          let isi = "";
          
          if(m === 'l' && jenis === 'item') { 
              let inIsi = document.getElementById(`${m}-input-${jenis}-isi`); 
              isi = inIsi ? inIsi.value.trim() : ""; 
              if(!isi) { alert("Peringatan: Jumlah Isi (angka) LIS wajib dimasukkan!"); return; } 
          }
          
          if(!nama || !kode || !pin) { alert(`Peringatan: Form Nama, Kode, dan PIN wajib diisi semuanya!`); return; }
          
          let realPin = m === 'p' ? dataPlafon.pin : dataLis.pin;
          if(pin !== realPin) { alert("⛔ PIN SALAH! Anda tidak memiliki izin untuk menambah data ini."); return; }
          
          let dt = m === 'p' ? dataPlafon : dataLis;
          let dataKey = jenis === 'item' ? 'items' : jenis;
          if(dt && dt[dataKey]) {
              let duplicate = dt[dataKey].some(x => x.kode && x.kode.toString().toUpperCase() === kode.toUpperCase());
              if(duplicate) { alert(`⚠️ Peringatan: Kode '${kode}' sudah pernah dipakai! Harap buat kode yang unik/berbeda.`); return; }
          }
          
          let btnEl = document.getElementById(`${m}-btn-simpan-${jenis}`);
          btnEl.innerText="Menyimpan..."; btnEl.disabled=true; 
          let sheetName = m==='p' ? 'MASTER PLAFON' : 'MASTER LIS';
          
          google.script.run.withSuccessHandler(function(res){
              if(res === "SUCCESS" || res.includes("Peringatan")){ 
                  if(['mesin', 'shift', 'grade'].includes(jenis)){ 
                      let sel=document.getElementById(`${m}-${jenis}`); 
                      if(sel) { let newOpt = new Option(nama, nama); newOpt.setAttribute('data-kode', kode); sel.insertBefore(newOpt, sel.options[sel.options.length-1]); sel.value=nama; }
                  } 
                  if(dt[dataKey]) dt[dataKey].push({nama: nama, kode: kode});
                  if(jenis === 'item') window.isiListModal(`${m}-item-list`, dt.items, 'item', m);
                  if(jenis === 'po' && m==='p') window.isiListModal('p-po-list', dt.po, 'po', 'p');
                  if(jenis === 'dus') window.isiListModal(`${m}-dus-list`, dt.dus, 'dus', m);
                  if(m === 'l' && jenis === 'item') { if(!dt.isi_lis) dt.isi_lis = {}; dt.isi_lis[nama] = isi; }
                  
                  if(inNama) inNama.value=""; if(inKode) inKode.value=""; if(inPin) inPin.value=""; 
                  if(m === 'l' && jenis === 'item' && document.getElementById(`${m}-input-${jenis}-isi`)) document.getElementById(`${m}-input-${jenis}-isi`).value="";
                  
                  tutupModal(`${m}-modal-tambah-${jenis}`); 
                  alert(res === "SUCCESS" ? "Mantap, Data Baru Berhasil Tersimpan!" : res); 
              } else {
                  alert(res); 
              }
              btnEl.innerText="Simpan"; btnEl.disabled=false;
          }).simpanDataBaruLengkap(sheetName, jenis, nama, kode, isi);
      };

      window.generateLabel = function(m) {
          let qtyEl = document.getElementById(m+'-qty');
          if(!qtyEl || !qtyEl.value || parseInt(qtyEl.value) < 1) { alert("⚠️ Silakan isi Jumlah Box minimal 1 terlebih dahulu!"); if(qtyEl) qtyEl.focus(); return false; }

          let tgl = document.getElementById(m+'-tgl').value, item = document.getElementById(m+'-item').value, panjang = document.getElementById(m+'-panjang').value, shift = document.getElementById(m+'-shift').value;
          let gradeEl = document.getElementById(m+'-grade'); let grade = gradeEl ? gradeEl.value : ""; 
          let poEl = document.getElementById(m+'-po'); let po = poEl ? poEl.value : "";
          let shading = document.getElementById(m+'-shading').value, dus = document.getElementById(m+'-dus').value;

          if(!item || !panjang) { alert("Nama Item dan Panjang wajib diisi!"); return false; }
          
          let dt = m === 'p' ? dataPlafon : dataLis;
          
          let getKode = (tipe, namaTarget) => {
              if(!namaTarget) return "";
              if(dt && dt[tipe]) {
                  let arr = dt[tipe];
                  let found = arr.find(x => x.nama.toString().trim().toUpperCase() === namaTarget.toString().trim().toUpperCase());
                  if(found && found.kode !== undefined && found.kode !== "") return found.kode;
              }
              let elId = tipe === 'items' ? 'item' : tipe;
              let el = document.getElementById(m+'-'+elId);
              if(el && el.tagName.toUpperCase() === 'SELECT') {
                  let opt = el.options[el.selectedIndex];
                  return opt ? (opt.getAttribute('data-kode') || "") : "";
              }
              return namaTarget;
          };

          let kodeItem = getKode('items', item);
          let kodeGrade = m === 'l' ? "1" : getKode('grade', grade);
          let kodeDus = getKode('dus', dus);
          let kodeMesin = getKode('mesin', document.getElementById(m+'-mesin').value);
          let kodeShift = getKode('shift', shift);
          let kodePo = m === 'l' ? "P49" : getKode('po', po);
          
          let pAngka = panjang.replace(/\D/g, ''); 
          
          let dObj = new Date(tgl), start = new Date(dObj.getFullYear(), 0, 0);
          let dayStr = String(Math.floor((dObj - start + (start.getTimezoneOffset()-dObj.getTimezoneOffset())*60*1000) / 86400000)).padStart(3, '0');
          let yrRev = String(dObj.getFullYear()).slice(-2).split('').reverse().join('');
          let dateCode = dayStr + yrRev;
          
          let bText = `${kodeItem}/${shading}/${pAngka}${kodeGrade}${kodeDus}/${dateCode}${kodeMesin}${kodeShift}${kodePo}`;
          stateGlobal[m].barcodeData = bText;

          let hasilPanjang = Math.round(parseFloat(panjang.toString().replace(',', '.')) * 100) || 0;
          let shiftAngka = shift.replace(/\D/g, '');
          let dObj2 = new Date(tgl);
          let tglStr = String(dObj2.getDate()).padStart(2, '0') + "/" + String(dObj2.getMonth() + 1).padStart(2, '0') + "/" + dObj2.getFullYear();
          let isiStr = (m === 'p') ? "Qty: 15" : "Qty: " + ((dataLis.isi_lis && dataLis.isi_lis[item]) ? dataLis.isi_lis[item] : "-");
          let poStr = m === 'l' ? "P49" : po;
          let shiftStr = shiftAngka ? "S" + shiftAngka : "";

          // Isi Label Depan
          document.getElementById(m+'-l-nama-item').innerHTML = item;
          document.getElementById(m+'-l-shading').innerText = shading;
          document.getElementById(m+'-l-mesin').innerText = document.getElementById(m+'-mesin').value;
          document.getElementById(m+'-l-po').innerText = poStr;
          document.getElementById(m+'-l-dus').innerText = dus;
          document.getElementById(m+'-l-ukuran').innerText = "Uk 20 x " + hasilPanjang;
          document.getElementById(m+'-l-isi').innerText = isiStr;
          document.getElementById(m+'-l-shift').innerText = shiftStr; 
          document.getElementById(m+'-l-tanggal').innerText = tglStr;

          // Isi Label Belakang
          document.getElementById(m+'-l-nama-item-back').innerHTML = item;
          document.getElementById(m+'-l-shading-back').innerText = shading;
          document.getElementById(m+'-l-mesin-back').innerText = document.getElementById(m+'-mesin').value;
          document.getElementById(m+'-l-po-back').innerText = poStr;
          document.getElementById(m+'-l-dus-back').innerText = dus;
          document.getElementById(m+'-l-ukuran-back').innerText = "Uk 20 x " + hasilPanjang;
          document.getElementById(m+'-l-isi-back').innerText = isiStr;
          document.getElementById(m+'-l-shift-back').innerText = shiftStr; 
          document.getElementById(m+'-l-tanggal-back').innerText = tglStr;

          let isRevisi = document.getElementById(m+'-cb-revisi') && document.getElementById(m+'-cb-revisi').checked;
          let suffixRevisi = isRevisi ? " N" : "";

          let barcodeTextEl = document.getElementById(m+'-l-barcode-text');
          if(barcodeTextEl) {
              barcodeTextEl.innerText = bText + "/0001" + suffixRevisi;
              barcodeTextEl.style.color = "black"; // Fix agar teks selalu hitam
          }
          
          let qrEl = document.getElementById(m+'-qrcode');
          if(qrEl) { 
              qrEl.innerHTML = ""; 
              new QRCode(qrEl, { text: bText + "/0001", width: 400, height: 400, correctLevel : QRCode.CorrectLevel.L }); 
              setTimeout(() => { let qs = qrEl.querySelectorAll('img, canvas'); qs.forEach(q => { q.style.width = '100%'; q.style.height = '100%'; }); }, 50);
          }
          
          return true; 
      };

      window.cetakLabel = async function(m) {
          if (!window.generateLabel(m)) return; 

          let qty = parseInt(document.getElementById(m+'-qty').value) || 1;
          let btnCetak = document.getElementById(m+'-btn-cetak-label'); btnCetak.innerText = "⏳ Memproses..."; btnCetak.disabled = true;

          document.querySelectorAll('.click-edit').forEach(el => el.classList.remove('active-edit'));
          let ctx = document.getElementById(m+'-context-panel'); if (ctx) ctx.style.display = 'none';
          activeSelection = { m: null, elements: [] };

          let item = document.getElementById(m+'-item').value;
          let panjang = document.getElementById(m+'-panjang').value;
          let grade = document.getElementById(m+'-grade') ? document.getElementById(m+'-grade').value : "";
          let shading = document.getElementById(m+'-shading').value;
          let po = document.getElementById(m+'-po') ? document.getElementById(m+'-po').value : "";
          let dus = document.getElementById(m+'-dus').value;
          let shift = document.getElementById(m+'-shift').value;
          let mesin = document.getElementById(m+'-mesin').value;
          let tgl = document.getElementById(m+'-tgl').value;

          let dataKirim = {
            jenis: m === 'p' ? 'PLAFON' : 'LIS', qty: qty, 
            item: item, panjang: panjang,
            grade: m === 'l' ? "1" : grade, shading: shading,
            po: m === 'l' ? "P49" : po, dus: dus, tgl: tgl, mesin: mesin, shift: shift, 
            barcodeText: stateGlobal[m].barcodeData 
          };

          let isRevisi = document.getElementById(m+'-cb-revisi') && document.getElementById(m+'-cb-revisi').checked;
          let suffixRevisi = isRevisi ? " N" : "";

          google.script.run.withSuccessHandler(async function(res) {
            let nodeFront = document.getElementById(m+'-label-canvas'); 
            let nodeBack = document.getElementById(m+'-label-canvas-back'); 
            
            let wrapper = document.getElementById(m+'-labels-wrapper');
            let oldWrapTransform = wrapper ? wrapper.style.transform : 'none';
            if(wrapper) wrapper.style.transform = 'none';
            
            let oldTransformFront = nodeFront.style.transform;
            let oldTransformBack = nodeBack.style.transform;
            
            nodeFront.style.transform = 'none'; nodeFront.style.border = 'none';
            nodeBack.style.transform = 'none'; nodeBack.style.border = 'none';
            
            let container = document.getElementById(m+'-preview-container');
            let oldOverflow = container.style.overflowY;
            container.style.overflowY = 'visible';
            
            let sequenceImages = [];
            
            for(let i = res.startSerial; i <= res.endSerial; i++) {
              let serialStr = "/" + ("0000" + i).slice(-4);
              document.getElementById(m+'-l-barcode-text').innerText = stateGlobal[m].barcodeData + serialStr + suffixRevisi;
              
              let qrEl = document.getElementById(m+'-qrcode');
              qrEl.innerHTML = "";
              new QRCode(qrEl, { text: stateGlobal[m].barcodeData + serialStr, width: 400, height: 400, correctLevel : QRCode.CorrectLevel.L });
              let qs = qrEl.querySelectorAll('img, canvas'); qs.forEach(q => { q.style.width = '100%'; q.style.height = '100%'; });
              
              await new Promise(r => setTimeout(r, 40)); 
              
              let canvasFront = await html2canvas(nodeFront, { scale: 6, backgroundColor: "#ffffff", useCORS: true, logging: false, scrollY: 0 });
              sequenceImages.push(canvasFront.toDataURL("image/png", 1.0));
              
              let canvasBack = await html2canvas(nodeBack, { scale: 6, backgroundColor: "#ffffff", useCORS: true, logging: false, scrollY: 0 });
              sequenceImages.push(canvasBack.toDataURL("image/png", 1.0));
              
              btnCetak.innerText = `⏳ Merender: ${sequenceImages.length / 2}/${qty}`;
            }
            
            nodeFront.style.transform = oldTransformFront; nodeFront.style.border = '1px solid black';
            nodeBack.style.transform = oldTransformBack; nodeBack.style.border = '1px solid black';
            if(wrapper) wrapper.style.transform = oldWrapTransform;
            container.style.overflowY = oldOverflow;
            
            btnCetak.innerText = "🖨 3. CETAK LABEL"; btnCetak.disabled = false;
            
            let w = stateGlobal[m].kertas.w + "mm";
            let h = stateGlobal[m].kertas.h + "mm";
            let pWin = window.open('', '_blank');
            
            pWin.document.write(`<html><head><title>Print Label</title><style>
              @page { size: ${w} ${h}; margin: 0; }
              body { margin: 0; padding: 20px; background: #525659; display: flex; flex-direction: column; align-items: center; gap: 20px; }
              .label-page { page-break-after: always; width: ${w}; height: ${h}; background: #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center; overflow: hidden; flex-shrink: 0; }
              img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; filter: grayscale(100%) contrast(1000%); }
              @media print { body { background: #fff; padding: 0; display: block; } .label-page { box-shadow: none; margin: 0; } }
            </style></head><body>`);
            
            sequenceImages.forEach(img => { pWin.document.write(`<div class="label-page"><img src="${img}"></div>`); });
            
            pWin.document.write(`</body></html>`); 
            pWin.document.close(); 
            setTimeout(() => { pWin.focus(); pWin.print(); }, 500);
          }).prosesCetakBatch(JSON.stringify(dataKirim));
      };
  }, 500);
</script>
