// -------------------------------
// Global DOM references
// -------------------------------
let yearEl, tabsEl, categoryLinksEl, fromSelect, toSelect, valueInput, convertBtn, swapBtn, saveFavBtn, resultBox, historyList, favList, guideContentEl;

// -------------------------------
// Google Analytics helper
// -------------------------------
function loadGoogleAnalytics(id) {
  if (!id) return;
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag; // expose globally
  gtag('js', new Date());
  gtag('config', id);
}

// -------------------------------
// Config: converters
// -------------------------------
window.CONVERTERS = [
  { id: 'length', label: 'Length', baseUnit: 'meter', units: { 'millimeter':0.001,'centimeter':0.01,'meter':1,'kilometer':1000,'inch':0.0254,'foot':0.3048,'yard':0.9144,'mile':1609.344 }},
  { id: 'weight', label: 'Weight', baseUnit: 'kilogram', units: { 'gram':0.001,'kilogram':1,'pound':0.45359237,'ounce':0.028349523125 }},
  { id: 'temperature', label: 'Temperature', baseUnit: 'celsius', type: 'temperature', units: { 'celsius':{toBase:v=>v,fromBase:v=>v,label:'°C'}, 'fahrenheit':{toBase:v=> (v-32)*(5/9),fromBase:v=>v*(9/5)+32,label:'°F'}, 'kelvin':{toBase:v=>v-273.15,fromBase:v=>v+273.15,label:'K'} }},
  { id: 'volume', label: 'Volume', baseUnit: 'liter', units: { 'milliliter':0.001,'liter':1,'cubic_meter':1000,'gallon_us':3.78541,'cup_us':0.236588 }}
];

// -------------------------------
// Utilities
// -------------------------------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const formatNumber = n => {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return Math.abs(n) < 0.00001 ? n.toExponential(4) : (Math.round(n * 1000000) / 1000000).toString();
};

const humanLabel = key => key.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());

// -------------------------------
// State
// -------------------------------
let activeCategory = null;

// -------------------------------
// Conversion Guide
// -------------------------------
async function loadConversionGuide(catId, fromUnit, toUnit) {
  const guideContainer = document.getElementById('guideContent');
  if (!guideContainer) return;

  const snippetPath = `/static-pages/${catId}/${fromUnit}-to-${toUnit}/conversionguide.html`;
  const defaultPath = `/conversionguide-default.html`;

  try {
    const resp = await fetch(snippetPath, {cache: "no-store"});
    let html = await resp.text();

    if (html.includes("<html")) throw new Error("Full page returned instead of snippet");

    guideContainer.innerHTML = html;

    // Trigger MathJax to render formulas
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([guideContainer]).catch(err => console.error(err.message));
    }

  } catch (err) {
    const defaultResp = await fetch(defaultPath, {cache: "no-store"});
    const defaultHtml = await defaultResp.text();
    guideContainer.innerHTML = defaultHtml;

    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([guideContainer]).catch(err => console.error(err.message));
    }
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

const shortUnit = unit => unit.replace(/_/g,' ');

function pushHistory(entry) {
  const history = JSON.parse(localStorage.getItem('history') || '[]');
  history.unshift(entry);
  localStorage.setItem('history', JSON.stringify(history.slice(0,50)));
  renderHistory();
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('history') || '[]');
  historyList.innerHTML = history.map(h => 
    `<div>${formatNumber(h.value)} ${shortUnit(h.from)} → ${formatNumber(h.out)} ${shortUnit(h.to)}</div>`
  ).join('');
}

function saveFavorite() {
  if(!activeCategory) return showResult('Select a category first', false);
  const cat = window.CONVERTERS.find(c => c.id === activeCategory);
  const from = fromSelect.value;
  const to = toSelect.value;
  const value = Number(valueInput.value.trim().replace(',', '.'));
  if(Number.isNaN(value)) return showResult('Invalid value', false);

  const out = (cat.type === 'temperature') 
    ? cat.units[to].fromBase(cat.units[from].toBase(value))
    : (value * cat.units[from]) / cat.units[to];

  const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
  favs.unshift({ cat: cat.id, from, to, value, out, ts: Date.now() });
  localStorage.setItem('favorites', JSON.stringify(favs.slice(0,50)));
  renderFavorites();
  showResult('Saved as favorite!');
}

function removeFavorite(index) {
  const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
  if (index >= 0 && index < favs.length) {
    favs.splice(index, 1); // remove the item
    localStorage.setItem('favorites', JSON.stringify(favs));
    renderFavorites();
    showResult('Favorite removed');
  }
}


function renderFavorites() {
  const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
  
  const clearBtn = document.getElementById('clearFavoritesBtn');
  clearBtn.style.display = favs.length ? 'inline-block' : 'none';
  
  favList.innerHTML = favs.map((f, index) => 
    `<div style="display:flex; justify-content:space-between; align-items:center;">
      <span>${formatNumber(f.value)} ${shortUnit(f.from)} → ${formatNumber(f.out)} ${shortUnit(f.to)}</span>
      <button data-index="${index}" class="removeFavBtn" style="margin-left:8px;">✖</button>
    </div>`
  ).join('');

  $$('.removeFavBtn').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = Number(e.target.dataset.index);
      removeFavorite(idx);
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
function populateUnitSelects(cat) {
  fromSelect.innerHTML=''; toSelect.innerHTML='';
  if(cat.type==='temperature') {
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
  fromSelect.selectedIndex = 1<fromSelect.length?1:0;
  toSelect.selectedIndex = 2<toSelect.length?2:(fromSelect.selectedIndex===0?1:0);
}

// -------------------------------
// Conversion logic
// -------------------------------
function convert() {
  if(!activeCategory) { showResult('Select a category first', false); return; }
  const cat = window.CONVERTERS.find(c => c.id === activeCategory);
  const raw = valueInput.value.trim();
  if(!raw){ showResult('Enter a value', false); return; }
  const value = Number(raw.replace(',','.'));
  if(Number.isNaN(value)){ showResult('Invalid value', false); return; }

  const from = fromSelect.value;
  const to = toSelect.value;

  let out, text;
  if(cat.type === 'temperature') {
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

  showResult(text,true);
  pushHistory({cat:cat.id, from, to, value, out, ts:Date.now()});
  
  // Update conversion guide
  loadConversionGuide(cat.id, from, to);
}

// -------------------------------
// Category tabs
// -------------------------------
function renderTabs() {
  tabsEl.innerHTML = '';
  categoryLinksEl.innerHTML = '';
  window.CONVERTERS.forEach(cat => {
    const createBtn = container => {
      const btn = document.createElement('button');
      btn.className = 'tab' + (cat.id === activeCategory ? ' active' : '');
      btn.textContent = cat.label;
      btn.dataset.route = `/${cat.id}`;
      container.appendChild(btn);
    };
    createBtn(tabsEl);
    createBtn(categoryLinksEl);
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
function setActiveCategory(id) {
  if (!id) return console.warn('No category id provided');
  id = id.replace(/\/$/,'');
  const cat = window.CONVERTERS.find(c => c.id === id);
  if(!cat){ activeCategory = window.CONVERTERS[0].id; return setActiveCategory(activeCategory); }
  
  activeCategory = cat.id;
  $$('.tab').forEach(b => b.classList.remove('active'));
  $$('.tab[data-route="/'+cat.id+'"]').forEach(b => b.classList.add('active'));

  populateUnitSelects(cat);
  resultBox.style.display='none';
  renderConverter();
}

// -------------------------------
// SEO
// -------------------------------
function updateSEO(cat, virtualPath) {
  if(!cat || !cat.label) return;
  document.title = `Free Units Converter — ${cat.label}`;
  const desc = `Convert ${cat.label.toLowerCase()} quickly and accurately.`;
  const metaDesc = document.querySelector('#meta-description');
  const canonicalLink = document.querySelector('#canonical-link');
  if(metaDesc) metaDesc.setAttribute('content', desc);
  if(canonicalLink) canonicalLink.setAttribute('href', 'https://freeunitsconverter.com' + (virtualPath||''));
}

// -------------------------------
// Init
// -------------------------------
async function renderConverter(){
  const defaultPath = `/conversionguide-default.html`;
  try {
    const resp = await fetch(defaultPath, {cache: "no-store"});
    const html = await resp.text();
    guideContentEl.innerHTML = html;
  } catch(err) {
    // fallback in case the file can't be loaded
    guideContentEl.innerHTML = "<p>Welcome to the Free Units Converter! Start by selecting a category and units.</p>";
  }
}


function bindUI() {
  convertBtn.addEventListener('click', convert);
  swapBtn.addEventListener('click', swapUnits);
  saveFavBtn.addEventListener('click', saveFavorite);

  fromSelect.addEventListener('change', ()=>{ loadConversionGuide(activeCategory, fromSelect.value, toSelect.value); });
  toSelect.addEventListener('change', ()=>{ loadConversionGuide(activeCategory, fromSelect.value, toSelect.value); });
}

function init() {
  yearEl.textContent = new Date().getFullYear();
  bindUI();
  renderTabs();

  let route = location.pathname.replace(/^\/|\/$/g,'');
  if(route && window.CONVERTERS.some(c=>c.id===route)){
    setActiveCategory(route);
  } else {
    setActiveCategory(window.CONVERTERS[0].id);
  }

  renderHistory();
  renderFavorites();
  renderConverter();

  if(location.hostname==="freeunitsconverter.com"){
    loadGoogleAnalytics("G-HX0YW2Z8WS");
  }
}

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
  document.getElementById('clearFavoritesBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all favorites?')) {
      localStorage.removeItem('favorites');
      renderFavorites();
      showResult('All favorites cleared');
    }
  });
  

  init();
});
