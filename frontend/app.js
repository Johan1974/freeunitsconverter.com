/* ============================
   CONFIG: converters
   ============================ */
   window.CONVERTERS = window.CONVERTERS || [
    {
      id: 'length',
      label: 'Length',
      baseUnit: 'meter',
      units: {
        'millimeter': 0.001,
        'centimeter': 0.01,
        'meter': 1,
        'kilometer': 1000,
        'inch': 0.0254,
        'foot': 0.3048,
        'yard': 0.9144,
        'mile': 1609.344
      }
    },
    {
      id: 'weight',
      label: 'Weight',
      baseUnit: 'kilogram',
      units: {
        'gram': 0.001,
        'kilogram': 1,
        'pound': 0.45359237,
        'ounce': 0.028349523125
      }
    },
    {
      id: 'temperature',
      label: 'Temperature',
      baseUnit: 'celsius',
      type: 'temperature',
      units: {
        'celsius': { toBase:v=>v, fromBase:v=>v, label:'°C' },
        'fahrenheit': { toBase:v=> (v-32)*(5/9), fromBase:v=>v*(9/5)+32, label:'°F' },
        'kelvin': { toBase:v=>v-273.15, fromBase:v=>v+273.15, label:'K' }
      }
    },
    {
      id: 'volume',
      label: 'Volume',
      baseUnit: 'liter',
      units: {
        'milliliter': 0.001,
        'liter': 1,
        'cubic_meter': 1000,
        'gallon_us': 3.78541,
        'cup_us': 0.236588
      }
    }
  ];
  const CONVERTERS = window.CONVERTERS;
  
  /* ---------- Utilities ---------- */
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const formatNumber = n => {
    if (!isFinite(n)) return '—';
    if (Math.abs(n) < 0.00001) return n.toExponential(4);
    return Number.parseFloat(Math.round(n*1000000)/1000000).toString();
  };
  const humanLabel = key => key.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());
  
  /* ---------- State ---------- */
  let activeCategory = CONVERTERS[0].id;
  
  /* ---------- DOM refs ---------- */
  const tabsEl = $('#categoryTabs');
  const categoryLinksEl = $('#categoryLinks');
  const fromSelect = $('#fromSelect');
  const toSelect = $('#toSelect');
  const valueInput = $('#valueInput');
  const convertBtn = $('#convertBtn');
  const swapBtn = $('#swapBtn');
  const saveFavBtn = $('#saveFavBtn');
  const resultBox = $('#resultBox');
  const historyList = $('#historyList');
  const favList = $('#favList');
  const yearEl = $('#year');
  
  /* ---------- Init ---------- */
  function init(){
    yearEl.textContent = new Date().getFullYear();
    renderTabs();
    setActiveCategory(activeCategory);
    bindUI();
    renderHistory();
    renderFavorites();
  }
  
  /* ---------- Render category tabs & links ---------- */
function renderTabs() {
  tabsEl.innerHTML = '';
  categoryLinksEl.innerHTML = '';

  CONVERTERS.forEach(cat => {
    const createBtn = (container) => {
      const btn = document.createElement('button');
      btn.className = 'tab' + (cat.id === activeCategory ? ' active' : '');
      btn.textContent = cat.label;
      btn.dataset.route = `/${cat.id}`; // <-- attach route
      container.appendChild(btn);
    };

    createBtn(tabsEl);
    createBtn(categoryLinksEl);
  });

  // Event delegation for all tabs
  [tabsEl, categoryLinksEl].forEach(container => {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-route]');
      if (!btn) return;
      const id = btn.dataset.route.slice(1); // remove leading '/'
      setActiveCategory(id);
    });
  });
}

/* ---------- Activate category & update SEO ---------- */
function setActiveCategory(id){
  activeCategory = id;

  // Update tab UI
  $$('.tab').forEach(b => b.classList.remove('active'));
  $$('.tab[data-route="/'+id+'"]').forEach(b => b.classList.add('active'));

  // Populate units
  const cat = CONVERTERS.find(c => c.id === id);
  populateUnitSelects(cat);
  resultBox.style.display = 'none';

  // Update virtual URL without reload
  const virtualPath = '/' + id;
  history.replaceState(null, cat.label, virtualPath);

  // Dynamic SEO update
  updateSEO(cat, virtualPath);
}

  
  /* ---------- Populate unit selects ---------- */
  function populateUnitSelects(cat){
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    if(cat.type==='temperature'){
      for(const [k,v] of Object.entries(cat.units)){
        const optA = document.createElement('option'); optA.value=k; optA.textContent=k+(v.label?' '+v.label:'');
        const optB = optA.cloneNode(true);
        fromSelect.appendChild(optA); toSelect.appendChild(optB);
      }
    } else {
      for(const key of Object.keys(cat.units)){
        const optA = document.createElement('option'); optA.value=key; optA.textContent=humanLabel(key);
        const optB = optA.cloneNode(true);
        fromSelect.appendChild(optA); toSelect.appendChild(optB);
      }
    }
    fromSelect.selectedIndex = 1 < fromSelect.length ? 1 : 0;
    toSelect.selectedIndex = 2 < toSelect.length ? 2 : (fromSelect.selectedIndex===0?1:0);
  }
  
  /* ---------- Conversion logic ---------- */
  function convert(){
    const cat = CONVERTERS.find(c=>c.id===activeCategory);
    const raw = valueInput.value.trim();
    if(!raw){ showResult('Enter a value', false); return; }
    const value = Number(raw.replace(',','.'));
    if(Number.isNaN(value)){ showResult('Invalid value', false); return; }
  
    const from = fromSelect.value;
    const to = toSelect.value;
  
    let out, text;
    if(cat.type==='temperature'){
      const fromDef = cat.units[from], toDef = cat.units[to];
      const base = fromDef.toBase(value);
      out = toDef.fromBase(base);
      text = `${formatNumber(value)} ${fromDef.label||''} = ${formatNumber(out)} ${toDef.label||''}`;
    } else {
      const fromFactor = cat.units[from], toFactor = cat.units[to];
      const inBase = value * fromFactor;
      out = inBase / toFactor;
      text = `${formatNumber(value)} ${shortUnit(from)} = ${formatNumber(out)} ${shortUnit(to)}`;
    }
  
    showResult(text, true);
    pushHistory({cat:cat.id, from, to, value, out, ts:Date.now()});
  }
  
  function shortUnit(key){
    const map = {
      'meter':'m','kilometer':'km','centimeter':'cm','millimeter':'mm',
      'inch':'in','foot':'ft','yard':'yd','mile':'mi',
      'kilogram':'kg','gram':'g','pound':'lb','ounce':'oz',
      'celsius':'°C','fahrenheit':'°F','kelvin':'K',
      'liter':'L','milliliter':'mL'
    };
    return map[key]||humanLabel(key);
  }
  
  /* ---------- UI: show result ---------- */
  function showResult(message, success=true){
    resultBox.style.display='block';
    resultBox.textContent=message;
    resultBox.style.color=success?'var(--success)':'var(--text)';
    resultBox.style.background=success?'linear-gradient(90deg,#f3fff6,#eefbf0)':'#fff6f6';
    resultBox.style.borderColor=success?'#e0f3e6':'#f4d7d7';
  }
  
  /* ---------- History & Favorites ---------- */
  const STORAGE_KEY = 'fuc_data_v1';
  function loadStore(){ try{ const s=localStorage.getItem(STORAGE_KEY); return s?JSON.parse(s):{history:[],favorites:[]}; }catch(e){ return {history:[],favorites:[]}; } }
  function saveStore(obj){ localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); }
  
  function pushHistory(entry){
    const s=loadStore();
    s.history=s.history||[];
    s.history.unshift(entry);
    if(s.history.length>20) s.history.length=20;
    saveStore(s); renderHistory();
  }
  
  function toggleFavorite(entry){
    const s=loadStore();
    s.favorites=s.favorites||[];
    const key=favKey(entry);
    const idx=s.favorites.findIndex(f=>favKey(f)===key);
    if(idx>=0) s.favorites.splice(idx,1); else s.favorites.unshift(entry);
    saveStore(s); renderFavorites();
  }
  
  function favKey(e){ return `${e.cat}::${e.from}::${e.to}::${e.value||''}`; }
  
  function renderHistory(){
    const s=loadStore();
    const list=s.history||[];
    historyList.innerHTML='';
    if(!list.length){ historyList.innerHTML='<div class="meta">No recent conversions.</div>'; return; }
    list.forEach(item=>{
      const btn=document.createElement('button');
      btn.innerHTML=`${formatNumber(item.value)} ${shortUnit(item.from)} → ${formatNumber(item.out)} ${shortUnit(item.to)} <span class="meta" style="display:block;font-size:12px">${new Date(item.ts).toLocaleString()}</span>`;
      btn.onclick=()=>{
        setActiveCategory(item.cat);
        valueInput.value=item.value;
        fromSelect.value=item.from; toSelect.value=item.to;
        convert();
      };
      historyList.appendChild(btn);
    });
  }
  
  function renderFavorites(){
    const s=loadStore();
    const list=s.favorites||[];
    favList.innerHTML='';
    if(!list.length){ favList.innerHTML='<div class="meta">No favorites.</div>'; return; }
    list.forEach(item=>{
      const btn=document.createElement('button');
      btn.innerHTML=`<span>${shortUnit(item.from)} → ${shortUnit(item.to)}</span><span class="fav" title="toggle">★</span>`;
      btn.onclick=()=>{
        setActiveCategory(item.cat);
        valueInput.value=item.value||'';
        fromSelect.value=item.from; toSelect.value=item.to;
        convert();
      };
      favList.appendChild(btn);
    });
  }
  
  /* ---------- UI events ---------- */
  function bindUI(){
    convertBtn.onclick = convert;
    swapBtn.onclick = ()=>{ const a=fromSelect.value; fromSelect.value=toSelect.value; toSelect.value=a; valueInput.focus(); };
    saveFavBtn.onclick = ()=>{
      const cat=activeCategory, from=fromSelect.value, to=toSelect.value, value=valueInput.value.trim();
      toggleFavorite({cat,from,to,value});
    };
    valueInput.addEventListener('keydown', e=>{ if(e.key==='Enter') convert(); });
    document.addEventListener('keydown', e=>{ if(e.key==='1') setActiveCategory(CONVERTERS[0].id); });
  }
  
  /* ---------- Dynamic SEO updater ---------- */
  function updateSEO(cat, virtualPath){
    // Title
    document.title = `Free Units Converter — ${cat.label}`;
  
    // Meta description
    let metaDesc=document.querySelector('#meta-description');
    if(metaDesc) metaDesc.content=`Convert ${cat.label} units quickly and easily online with Free Units Converter.`;
  
    // Canonical
    let canonical=document.querySelector('#canonical-link');
    if(canonical) canonical.href=`https://freeunitsconverter.com${virtualPath}`;
  
    // JSON-LD
    const jsonLD=document.querySelector('#json-ld');
    if(jsonLD) jsonLD.textContent=JSON.stringify({
      "@context":"https://schema.org",
      "@type":"WebPage",
      "name":`Free Units Converter — ${cat.label}`,
      "url":`https://freeunitsconverter.com${virtualPath}`,
      "description": metaDesc.content
    });
  
    // GA virtual pageview
    if(window.gtag) gtag('event','page_view',{page_path:virtualPath,page_title:cat.label});
  }
  
  /* ---------- Google Analytics ---------- */
  function loadGoogleAnalytics(measurementId){
    const gaScript=document.createElement('script');
    gaScript.async=true;
    gaScript.src=`https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(gaScript);
    gaScript.onload=()=>{
      window.dataLayer=window.dataLayer||[];
      function gtag(){dataLayer.push(arguments);}
      window.gtag=gtag;
      gtag('js',new Date());
      gtag('config',measurementId);
      console.log(`Google Analytics ${measurementId} loaded`);
    };
  }
  
  /* ---------- Initialize app ---------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    init();
    if(location.hostname==="freeunitsconverter.com") loadGoogleAnalytics("G-HX0YW2Z8WS");
  });
  