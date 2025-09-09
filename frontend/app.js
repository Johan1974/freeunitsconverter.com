console.log("App.js loaded!");

/* ============================
   CONFIG: converters
   ============================ */
window.CONVERTERS = window.CONVERTERS || [
  { id: 'length', label: 'Length', baseUnit: 'meter', units: { 'millimeter':0.001,'centimeter':0.01,'meter':1,'kilometer':1000,'inch':0.0254,'foot':0.3048,'yard':0.9144,'mile':1609.344 }},
  { id: 'weight', label: 'Weight', baseUnit: 'kilogram', units: { 'gram':0.001,'kilogram':1,'pound':0.45359237,'ounce':0.028349523125 }},
  { id: 'temperature', label: 'Temperature', baseUnit: 'celsius', type: 'temperature', units: { 'celsius':{toBase:v=>v,fromBase:v=>v,label:'°C'}, 'fahrenheit':{toBase:v=> (v-32)*(5/9),fromBase:v=>v*(9/5)+32,label:'°F'}, 'kelvin':{toBase:v=>v-273.15,fromBase:v=>v+273.15,label:'K'} }},
  { id: 'volume', label: 'Volume', baseUnit: 'liter', units: { 'milliliter':0.001,'liter':1,'cubic_meter':1000,'gallon_us':3.78541,'cup_us':0.236588 } }
];
const CONVERTERS = window.CONVERTERS;

/* ---------- Utilities ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const formatNumber = n => (!isFinite(n)?'—':Math.abs(n)<0.00001?n.toExponential(4):Number.parseFloat(Math.round(n*1000000)/1000000).toString());
const humanLabel = key => key.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());

/* ---------- State ---------- */
// Start with no category active
let activeCategory = null;

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
  // Only set default category if route exists
  const route = location.pathname.slice(1);
  if(route && CONVERTERS.some(c=>c.id===route)) setActiveCategory(route);
  bindUI();
  renderHistory();
  renderFavorites();
  renderConverter();
}

/* ---------- Render category tabs & links ---------- */
function renderTabs() {
  tabsEl.innerHTML = '';
  categoryLinksEl.innerHTML = '';

  CONVERTERS.forEach(cat => {
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
      const id = btn.dataset.route.slice(1);
      setActiveCategory(id);
    });
  });
}

/* ---------- Activate category & update SEO ---------- */
function setActiveCategory(id){
  activeCategory = id;

  $$('.tab').forEach(b=>b.classList.remove('active'));
  $$('.tab[data-route="/'+id+'"]').forEach(b=>b.classList.add('active'));

  const cat = CONVERTERS.find(c=>c.id===id);
  populateUnitSelects(cat);
  resultBox.style.display='none';

  const virtualPath = '/' + id;
  history.replaceState(null, cat.label, virtualPath);
  updateSEO(cat, virtualPath);

  renderConverter();
}

/* ---------- Render converter UI ---------- */
function renderConverter(){
  if(!activeCategory){
    resultBox.style.display='block';
    resultBox.textContent = "Select a category to start converting units!";
    resultBox.style.color='var(--text)';
    resultBox.style.background='#f9f9f9';
  }
}

/* ---------- Populate unit selects ---------- */
function populateUnitSelects(cat){
  fromSelect.innerHTML=''; toSelect.innerHTML='';
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
  fromSelect.selectedIndex = 1<fromSelect.length?1:0;
  toSelect.selectedIndex = 2<toSelect.length?2:(fromSelect.selectedIndex===0?1:0);
}

/* ---------- Conversion logic ---------- */
function convert(){
  if(!activeCategory){ showResult('Select a category first', false); return; }
  const cat = CONVERTERS.find(c=>c.id===activeCategory);
  const raw = valueInput.value.trim();
  if(!raw){ showResult('Enter a value', false); return; }
  const value = Number(raw.replace(',','.'));
  if(Number.isNaN(value)){ showResult('Invalid value', false); return; }

  const from = fromSelect.value;
  const to = toSelect.value;

  let out,text;
  if(cat.type==='temperature'){
    const fromDef = cat.units[from], toDef = cat.units[to];
    const base = fromDef.toBase(value);
    out = toDef.fromBase(base);
    text = `${formatNumber(value)} ${fromDef.label||''} = ${formatNumber(out)} ${toDef.label||''}`;
  } else {
    const fromFactor = cat.units[from], toFactor = cat.units[to];
    const inBase = value*fromFactor;
    out = inBase/toFactor;
    text = `${formatNumber(value)} ${shortUnit(from)} = ${formatNumber(out)} ${shortUnit(to)}`;
  }

  showResult(text,true);
  pushHistory({cat:cat.id,from,to,value,out,ts:Date.now()});
}

/* ---------- The rest of your code remains unchanged ---------- */

document.addEventListener('DOMContentLoaded', ()=>{ init(); if(location.hostname==="freeunitsconverter.com") loadGoogleAnalytics("G-HX0YW2Z8WS"); });
