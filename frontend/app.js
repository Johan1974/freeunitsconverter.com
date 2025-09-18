// -------------------------------
// Global DOM references
// -------------------------------
let yearEl, tabsEl, categoryLinksEl, fromSelect, toSelect, valueInput, convertBtn, swapBtn, saveFavBtn, resultBox, historyList, favList, guideContentEl;

// -------------------------------
// Google Analytics helper
// -------------------------------
function loadGoogleAnalytics(id) {
  if (!id) return console.log("GA skipped: missing ID");

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = gtag;

  const debug = location.search.includes("debug_mode=true");
  gtag("js", new Date());
  gtag("config", id, { debug_mode: debug });

  console.log("GA4 initialized", { id, debug_mode: debug });
}

// -------------------------------
// Converters config
// -------------------------------
window.CONVERTERS = [
  { id: 'length', label: 'Length', baseUnit: 'meter', units: { 'millimeter':0.001,'centimeter':0.01,'meter':1,'kilometer':1000,'inch':0.0254,'foot':0.3048,'yard':0.9144,'mile':1609.344 }},
  { id: 'weight', label: 'Weight', baseUnit: 'kilogram', units: { 'gram':0.001,'kilogram':1,'pound':0.45359237,'ounce':0.028349523125 }},
  { id: 'temperature', label: 'Temperature', baseUnit: 'celsius', type: 'temperature', units: { 
      'celsius': {toBase:v=>v, fromBase:v=>v, label:'°C'},
      'fahrenheit': {toBase:v=> (v-32)*(5/9), fromBase:v=>v*(9/5)+32, label:'°F'},
      'kelvin': {toBase:v=>v-273.15, fromBase:v=>v+273.15, label:'K'}
    }},
  { id: 'volume', label: 'Volume', baseUnit: 'liter', units: { 'milliliter':0.001,'liter':1,'cubic_meter':1000,'gallon_us':3.78541,'gallon_imperial':4.54609,'cup_us':0.236588 }}
];

// -------------------------------
// Utilities
// -------------------------------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const formatNumber = n => {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return Math.abs(n) < 0.00001 ? n.toExponential(4) : (Math.round(n*1000000)/1000000).toString();
};

const humanLabel = key => key.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());

// -------------------------------
// State
// -------------------------------
let activeCategory = null;

// -------------------------------
// Conversion Guide Loader
// -------------------------------
async function loadConversionGuide(catId, fromUnit, toUnit) {
  if (!guideContentEl) return;
  const basePath = `/static-pages/${catId}`;
  const forwardFolder = `${fromUnit}-to-${toUnit}`;
  const reverseFolder = `${toUnit}-to-${fromUnit}`;

  let snippetPath = `${basePath}/${forwardFolder}/conversionguide.html`;
  try {
    let resp = await fetch(snippetPath, { cache:"no-store" });
    if (!resp.ok) throw new Error();
    let html = await resp.text();
    if (html.includes("<html")) throw new Error();
    guideContentEl.innerHTML = html;
    return;
  } catch {
    snippetPath = `${basePath}/${reverseFolder}/conversionguide.html`;
    try {
      let respRev = await fetch(snippetPath, { cache:"no-store" });
      if (!respRev.ok) throw new Error();
      let html = await respRev.text();
      if (html.includes("<html")) throw new Error();
      guideContentEl.innerHTML = html;
      return;
    } catch {
      try {
        const defaultResp = await fetch(`/conversionguide-default.html`, { cache:"no-store" });
        guideContentEl.innerHTML = await defaultResp.text();
      } catch {
        guideContentEl.innerHTML = "<p>Conversion guide is not available at the moment.</p>";
      }
    }
  }

  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise([guideContentEl]).catch(err=>console.error(err.message));
  }
}

// -------------------------------
// Result / History / Favorites
// -------------------------------
function showResult(text, success=true) {
  resultBox.style.display = 'block';
  resultBox.textContent = text;
  resultBox.style.color = success ? 'var(--text)' : 'red';
  resultBox.style.background = success ? '#f9f9f9' : '#fee';
}

const shortUnit = u => u.replace(/_/g,' ');

function pushHistory(entry) {
  const history = JSON.parse(localStorage.getItem('history')||'[]');
  history.unshift(entry);
  localStorage.setItem('history', JSON.stringify(history.slice(0,5)));
  renderHistory();
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('history')||'[]');
  if (!historyList) return;
  historyList.innerHTML = history.map((h,i)=>`
    <div class="item-row">
      <span>${formatNumber(h.value)} ${shortUnit(h.from)} → ${formatNumber(h.out)} ${shortUnit(h.to)}</span>
      <button class="remove-btn" data-index="${i}" aria-label="Remove item">&times;</button>
    </div>
  `).join('');

  historyList.querySelectorAll('.remove-btn').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const idx = Number(e.target.dataset.index);
      history.splice(idx,1);
      localStorage.setItem('history', JSON.stringify(history));
      renderHistory();
      e.stopPropagation();
    });
  });
}

function saveFavorite() {
  if (!activeCategory) return showResult('Select a category first', false);
  const cat = window.CONVERTERS.find(c=>c.id===activeCategory);
  const from = fromSelect.value;
  const to = toSelect.value;
  const value = Number(valueInput.value.trim().replace(',', '.'));
  if (Number.isNaN(value)) return showResult('Invalid value', false);

  const out = (cat.type==='temperature') ? cat.units[to].fromBase(cat.units[from].toBase(value)) : value*cat.units[from]/cat.units[to];

  const favs = JSON.parse(localStorage.getItem('favorites')||'[]');
  favs.unshift({cat:cat.id,from,to,value,out,ts:Date.now()});
  localStorage.setItem('favorites', JSON.stringify(favs.slice(0,50)));
  renderFavorites();
  showResult('Saved as favorite!');
}

function removeFavorite(index) {
  const favs = JSON.parse(localStorage.getItem('favorites')||'[]');
  if(index>=0 && index<favs.length) {
    favs.splice(index,1);
    localStorage.setItem('favorites', JSON.stringify(favs));
    renderFavorites();
    showResult('Favorite removed');
  }
}

function renderFavorites() {
  const favs = JSON.parse(localStorage.getItem('favorites')||'[]');
  if (!favList) return;
  favList.innerHTML = favs.map((f,i)=>`
    <div class="item-row">
      <span>${formatNumber(f.value)} ${shortUnit(f.from)} → ${formatNumber(f.out)} ${shortUnit(f.to)}</span>
      <button class="remove-btn" data-index="${i}" aria-label="Remove favorite">&times;</button>
    </div>
  `).join('');

  favList.querySelectorAll('.remove-btn').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const idx = Number(e.target.dataset.index);
      favs.splice(idx,1);
      localStorage.setItem('favorites', JSON.stringify(favs));
      renderFavorites();
      e.stopPropagation();
    });
  });
}

function swapUnits() {
  const tmp = fromSelect.selectedIndex;
  fromSelect.selectedIndex = toSelect.selectedIndex;
  toSelect.selectedIndex = tmp;
  convert();
}

// -------------------------------
// Populate dropdowns
// -------------------------------
function populateUnitSelects(cat, fromUnit=null, toUnit=null) {
  fromSelect.innerHTML = '';
  toSelect.innerHTML = '';

  if(cat.type==='temperature'){
    for(const [k,v] of Object.entries(cat.units)){
      const optA = document.createElement('option');
      optA.value = k;
      optA.textContent = k + (v.label?' '+v.label:'');
      const optB = document.createElement('option');
      optB.value = k;
      optB.textContent = k + (v.label?' '+v.label:'');
      fromSelect.appendChild(optA);
      toSelect.appendChild(optB);
    }
  } else {
    const metricUnits = ['millimeter','centimeter','meter','kilometer','gram','kilogram','liter','cubic_meter'];
    const imperialUnits = ['inch','foot','yard','mile','pound','ounce','gallon_us','gallon_imperial','cup_us'];

    const metricGroupFrom = document.createElement('optgroup'); metricGroupFrom.label='Metric';
    const imperialGroupFrom = document.createElement('optgroup'); imperialGroupFrom.label='US / Imperial';
    const metricGroupTo = document.createElement('optgroup'); metricGroupTo.label='Metric';
    const imperialGroupTo = document.createElement('optgroup'); imperialGroupTo.label='US / Imperial';

    Object.keys(cat.units).forEach(key=>{
      const optFrom = document.createElement('option'); optFrom.value=key; optFrom.textContent=humanLabel(key);
      const optTo = document.createElement('option'); optTo.value=key; optTo.textContent=humanLabel(key);
      if(metricUnits.includes(key)){ metricGroupFrom.appendChild(optFrom); metricGroupTo.appendChild(optTo); }
      else { imperialGroupFrom.appendChild(optFrom); imperialGroupTo.appendChild(optTo); }
    });

    fromSelect.appendChild(metricGroupFrom);
    fromSelect.appendChild(imperialGroupFrom);
    toSelect.appendChild(metricGroupTo);
    toSelect.appendChild(imperialGroupTo);
  }

  if(fromUnit) fromSelect.value=fromUnit;
  if(toUnit) toSelect.value=toUnit;

  if(!fromUnit) fromSelect.selectedIndex = 1 < fromSelect.length ? 1 : 0;
  if(!toUnit) toSelect.selectedIndex = 2 < toSelect.length ? 2 : (fromSelect.selectedIndex===0?1:0);
}

// -------------------------------
// Conversion logic
// -------------------------------
function convert() {
  if(!activeCategory){ showResult('Select a category first', false); return; }

  const cat = window.CONVERTERS.find(c=>c.id===activeCategory);
  const raw = valueInput.value.trim();
  if(!raw){ showResult('Enter a value', false); return; }

  const value = Number(raw.replace(',','.'));
  if(Number.isNaN(value)){ showResult('Invalid value', false); return; }

  const from = fromSelect.value;
  const to = toSelect.value;

  let out,text;
  if(cat.type==='temperature'){
    const base = cat.units[from].toBase(value);
    out = cat.units[to].fromBase(base);
    text = `${formatNumber(value)} ${cat.units[from].label||''} = ${formatNumber(out)} ${cat.units[to].label||''}`;
  } else {
    out = value*cat.units[from]/cat.units[to];
    text = `${formatNumber(value)} ${shortUnit(from)} = ${formatNumber(out)} ${shortUnit(to)}`;
  }

  showResult(text,true);
  pushHistory({cat:cat.id,from,to,value,out,ts:Date.now()});
  loadConversionGuide(cat.id, from, to);

  if(typeof gtag==='function'){
    const debug = location.search.includes("debug_mode=true");
    gtag("event","unit_combo",{unit_combo:`${from}→${to}`, debug_mode: debug});
  }
}

// -------------------------------
// Category tabs
// -------------------------------
function renderTabs(){
  tabsEl.innerHTML='';
  categoryLinksEl.innerHTML='';

  window.CONVERTERS.forEach(cat=>{
    const createBtn=container=>{
      const btn=document.createElement('button');
      btn.className='tab'+(cat.id===activeCategory?' active':'');
      btn.textContent=cat.label;
      btn.dataset.route=`/${cat.id}`;
      container.appendChild(btn);
    };
    createBtn(tabsEl); createBtn(categoryLinksEl);
  });

  [tabsEl, categoryLinksEl].forEach(container=>{
    container.addEventListener('click', e=>{
      const btn = e.target.closest('button[data-route]');
      if(!btn) return;
      setActiveCategory(btn.dataset.route.slice(1));
    });
  });
}

// -------------------------------
// Set active category
// -------------------------------
function setActiveCategory(id, fromUnit=null, toUnit=null){
  if(!id) return console.warn('No category id provided');
  id = id.replace(/\/$/,'');
  const cat = window.CONVERTERS.find(c=>c.id===id);
  if(!cat){ activeCategory=window.CONVERTERS[0].id; return setActiveCategory(activeCategory); }

  activeCategory = cat.id;
  $$('.tab').forEach(b=>b.classList.remove('active'));
  $$('.tab[data-route="/'+cat.id+'"]').forEach(b=>b.classList.add('active'));

  populateUnitSelects(cat, fromUnit, toUnit);
  resultBox.style.display='none';
  renderConverter();
}

// -------------------------------
// Handle URL unit combos
// -------------------------------
function handleURLUnitCombo() {
  // Remove leading/trailing slashes
  const path = location.pathname.replace(/^\/|\/$/g, '');
  const parts = path.split('/'); // ["length", "centimeter-to-inch"]

  if(parts.length === 2) {
    const [catId, combo] = parts;
    const units = combo.split('-to-'); // ["centimeter", "inch"]
    if(units.length === 2) {
      const [from, to] = units;
      const cat = window.CONVERTERS.find(c => c.id === catId);
      if(cat && cat.units[from] && cat.units[to]) {
        setActiveCategory(catId, from, to);

        // Load conversion guide immediately
        loadConversionGuide(catId, from, to);

        convert(); // immediately perform conversion

        // Reset URL to root after applying combo
        history.replaceState(null, '', '/');

      }
    }
  }
}

// Call it after all your converters and DOM are initialized
window.addEventListener('DOMContentLoaded', handleURLUnitCombo);






// -------------------------------
// SEO
// -------------------------------
function updateSEO(cat, virtualPath){
  if(!cat || !cat.label) return;
  document.title=`Free Units Converter — ${cat.label}`;
  const desc=`Convert ${cat.label.toLowerCase()} quickly and accurately.`;
  const metaDesc=document.querySelector('#meta-description');
  const canonicalLink=document.querySelector('#canonical-link');
  if(metaDesc) metaDesc.setAttribute('content', desc);
  if(canonicalLink) canonicalLink.setAttribute('href','https://freeunitsconverter.com'+(virtualPath||''));
}

// -------------------------------
// Init converter guide
// -------------------------------
async function renderConverter(){
  try{
    const resp = await fetch(`/conversionguide-default.html`, {cache:'no-store'});
    guideContentEl.innerHTML = await resp.text();
  } catch {
    guideContentEl.innerHTML = "<p>Welcome to the Free Units Converter! Start by selecting a category and units.</p>";
  }
}

// -------------------------------
// Bind UI
// -------------------------------
function bindUI(){
  convertBtn.addEventListener('click', convert);
  swapBtn.addEventListener('click', ()=>{
    swapUnits();
    loadConversionGuide(activeCategory, fromSelect.value, toSelect.value);
  });
  saveFavBtn.addEventListener('click', saveFavorite);

  fromSelect.addEventListener('change', ()=>{
    if(activeCategory) loadConversionGuide(activeCategory, fromSelect.value, toSelect.value);
  });
  toSelect.addEventListener('change', ()=>{
    if(activeCategory) loadConversionGuide(activeCategory, fromSelect.value, toSelect.value);
  });
}

// -------------------------------
// Init
// -------------------------------
function init(){
  yearEl.textContent = new Date().getFullYear();
  bindUI();
  renderTabs();
  handleURLUnitCombo();

  if(!activeCategory){
    const route = location.pathname.replace(/^\/|\/$/g,'');
    if(route && window.CONVERTERS.some(c=>c.id===route)){
      setActiveCategory(route);
    } else {
      setActiveCategory(window.CONVERTERS[0].id);
    }
  }

  renderHistory();
  renderFavorites();
  renderConverter();

  if(location.hostname==="freeunitsconverter.com"){
    loadGoogleAnalytics("G-HX0YW2Z8WS");
  }
}

// -------------------------------
// DOMContentLoaded
// -------------------------------
document.addEventListener('DOMContentLoaded', ()=>{
  yearEl = document.getElementById('year');
  tabsEl = document.getElementById('categoryTabs');
  categoryLinksEl = document.getElementById('categoryLinks');
  fromSelect = document.getElementById('fromSelect');
  toSelect = document.getElementById('toSelect');
  valueInput = document.getElementById('valueInput');
  convertBtn = document.getElementById('convertBtn');
  swapBtn = document.getElementById('swapBtn');
  saveFavBtn = document.getElementById('saveFavBtn');
  resultBox = document.getElementById('resultBox');
  historyList = document.getElementById('historyList');
  favList = document.getElementById('favList');
  guideContentEl = document.getElementById('guideContent');

  document.getElementById('clearFavoritesBtn').addEventListener('click', ()=>{
    if(confirm('Are you sure you want to clear all favorites?')){
      localStorage.removeItem('favorites');
      renderFavorites();
      showResult('All favorites cleared');
    }
  });

  document.getElementById('clearHistoryBtn').addEventListener('click', ()=>{
    if(confirm('Are you sure you want to clear recent history?')){
      localStorage.removeItem('history');
      renderHistory();
      showResult('Recent history cleared');
    }
  });

  init();

  loadConversionGuide(catId, from, to);

});
