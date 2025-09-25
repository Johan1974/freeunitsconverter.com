// -------------------------------
// Global DOM references & state
// -------------------------------
const DOM = {};
let activeCategory = null;

// URLs injected by index.html
const SITE_URL_INT = "http://frontend:80";
const SITE_URL_EXT = "http://freeunitsconverter.com:8080/";

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
  window.gtag = (...args) => window.dataLayer.push(args);

  const debug = location.search.includes("debug_mode=true");
  gtag("js", new Date());
  gtag("config", id, { debug_mode: debug });

  console.log("GA4 initialized", { id, debug_mode: debug });
}

// -------------------------------
// Utilities
// -------------------------------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const formatNumber = n => {
  if (n == null || !isFinite(n)) return "—";
  return Math.abs(n) < 0.00001 ? n.toExponential(4) : (Math.round(n * 1e6) / 1e6).toString();
};

const humanLabel = key => key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
const shortUnit = u => u.replace(/_/g, " ");

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
// Conversion Guide Loader
// -------------------------------
async function loadConversionGuide(catId, fromUnit, toUnit) {
  if (!DOM.guideContentEl) return;
  const basePath = `${SITE_URL_EXT}static-pages/${catId}`;
  const forwardFolder = `${fromUnit}-to-${toUnit}`;
  const reverseFolder = `${toUnit}-to-${fromUnit}`;

  let snippetPath = `${basePath}/${forwardFolder}/conversionguide.html`;
  try {
    let resp = await fetch(snippetPath, { cache:"no-store" });
    if (!resp.ok) throw new Error();
    let html = await resp.text();
    if (html.includes("<html")) throw new Error();
    DOM.guideContentEl.innerHTML = html;
    return;
  } catch {
    snippetPath = `${basePath}/${reverseFolder}/conversionguide.html`;
    try {
      let respRev = await fetch(snippetPath, { cache:"no-store" });
      if (!respRev.ok) throw new Error();
      let html = await respRev.text();
      if (html.includes("<html")) throw new Error();
      DOM.guideContentEl.innerHTML = html;
      return;
    } catch {
      try {
        const defaultResp = await fetch(`${SITE_URL_EXT}conversionguide-default.html`, { cache:"no-store" });
        DOM.guideContentEl.innerHTML = await defaultResp.text();
      } catch {
        DOM.guideContentEl.innerHTML = "<p>Conversion guide is not available at the moment.</p>";
      }
    }
  }

  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise([DOM.guideContentEl]).catch(err=>console.error(err.message));
  }
}

// -------------------------------
// Result / History / Favorites
// -------------------------------
function showResult(text, success=true) {
  if (!DOM.resultBox) return;
  DOM.resultBox.style.display = "block";
  DOM.resultBox.textContent = text;
  DOM.resultBox.style.color = success ? "var(--text)" : "red";
  DOM.resultBox.style.background = success ? "#f9f9f9" : "#fee";
}

function pushHistory(entry) {
  const history = JSON.parse(localStorage.getItem("history") || "[]");
  history.unshift(entry);
  localStorage.setItem("history", JSON.stringify(history.slice(0, 5)));
  renderHistory();
}

function renderHistory() {
  if (!DOM.historyList) return;
  const history = JSON.parse(localStorage.getItem("history") || "[]");
  DOM.historyList.innerHTML = history.map((h, i) => `
    <div class="item-row">
      <span>${formatNumber(h.value)} ${shortUnit(h.from)} → ${formatNumber(h.out)} ${shortUnit(h.to)}</span>
      <button class="remove-btn" data-index="${i}" aria-label="Remove item">&times;</button>
    </div>
  `).join("");

  DOM.historyList.querySelectorAll(".remove-btn").forEach(btn=>{
    btn.addEventListener("click", e=>{
      const idx = Number(e.target.dataset.index);
      history.splice(idx,1);
      localStorage.setItem("history", JSON.stringify(history));
      renderHistory();
      e.stopPropagation();
    });
  });
}

function saveFavorite() {
  if (!activeCategory) return showResult("Select a category first", false);
  const cat = window.CONVERTERS.find(c=>c.id===activeCategory);
  const from = DOM.fromSelect.value;
  const to = DOM.toSelect.value;
  const value = Number(DOM.valueInput.value.trim().replace(",", ".")) || NaN;
  if (Number.isNaN(value)) return showResult("Invalid value", false);

  const out = cat.type==="temperature"
    ? cat.units[to].fromBase(cat.units[from].toBase(value))
    : value * cat.units[from] / cat.units[to];

  const favs = JSON.parse(localStorage.getItem("favorites")||"[]");
  favs.unshift({cat:cat.id, from, to, value, out, ts:Date.now()});
  localStorage.setItem("favorites", JSON.stringify(favs.slice(0,50)));
  renderFavorites();
  showResult("Saved as favorite!");
}

function renderFavorites() {
  if (!DOM.favList) return;
  const favs = JSON.parse(localStorage.getItem("favorites")||"[]");
  DOM.favList.innerHTML = favs.map((f,i)=>`
    <div class="item-row">
      <span>${formatNumber(f.value)} ${shortUnit(f.from)} → ${formatNumber(f.out)} ${shortUnit(f.to)}</span>
      <button class="remove-btn" data-index="${i}" aria-label="Remove favorite">&times;</button>
    </div>
  `).join("");

  DOM.favList.querySelectorAll(".remove-btn").forEach(btn=>{
    btn.addEventListener("click", e=>{
      const idx = Number(e.target.dataset.index);
      favs.splice(idx,1);
      localStorage.setItem("favorites", JSON.stringify(favs));
      renderFavorites();
      e.stopPropagation();
    });
  });
}

// -------------------------------
// Conversion logic
// -------------------------------
function convert() {
  if (!activeCategory){ showResult("Select a category first", false); return; }
  const cat = window.CONVERTERS.find(c=>c.id===activeCategory);
  const raw = DOM.valueInput.value.trim();
  if (!raw){ showResult("Enter a value", false); return; }
  const value = Number(raw.replace(",","."));
  if (Number.isNaN(value)){ showResult("Invalid value", false); return; }

  const from = DOM.fromSelect.value, to = DOM.toSelect.value;
  let out, text;

  if (cat.type==="temperature"){
    const base = cat.units[from].toBase(value);
    out = cat.units[to].fromBase(base);
    text = `${formatNumber(value)} ${cat.units[from].label||""} = ${formatNumber(out)} ${cat.units[to].label||""}`;
  } else {
    out = value * cat.units[from] / cat.units[to];
    text = `${formatNumber(value)} ${shortUnit(from)} = ${formatNumber(out)} ${shortUnit(to)}`;
  }

  showResult(text, true);
  pushHistory({cat:cat.id, from, to, value, out, ts:Date.now()});
  loadConversionGuide(cat.id, from, to);

  if(typeof gtag==="function"){
    gtag("event","unit_combo",{unit_combo:`${from}→${to}`, debug_mode: location.search.includes("debug_mode=true")});
  }
}

// -------------------------------
// Swap units
// -------------------------------
function swapUnits(){
  const tmp = DOM.fromSelect.selectedIndex;
  DOM.fromSelect.selectedIndex = DOM.toSelect.selectedIndex;
  DOM.toSelect.selectedIndex = tmp;
  convert();
}

// -------------------------------
// Populate dropdowns
// -------------------------------
function populateUnitSelects(cat, fromUnit=null, toUnit=null){
  DOM.fromSelect.innerHTML = DOM.toSelect.innerHTML = "";

  Object.entries(cat.units).forEach(([k,v])=>{
    const label = v.label ? `${k} ${v.label}` : k;
    DOM.fromSelect.add(new Option(label,k));
    DOM.toSelect.add(new Option(label,k));
  });

  if(fromUnit) DOM.fromSelect.value = fromUnit;
  if(toUnit) DOM.toSelect.value = toUnit;
  if(!fromUnit) DOM.fromSelect.selectedIndex=0;
  if(!toUnit) DOM.toSelect.selectedIndex=1;
}

// -------------------------------
// Tabs & categories
// -------------------------------
function renderTabs(){
  DOM.tabsEl.innerHTML = DOM.categoryLinksEl.innerHTML = "";
  window.CONVERTERS.forEach(cat=>{
    [DOM.tabsEl, DOM.categoryLinksEl].forEach(container=>{
      const btn=document.createElement("button");
      btn.className="tab"+(cat.id===activeCategory?" active":"");
      btn.textContent = cat.label;
      btn.dataset.route=`/${cat.id}`;
      container.appendChild(btn);

      container.addEventListener("click", e=>{
        const b = e.target.closest("button[data-route]");
        if(!b) return;
        setActiveCategory(b.dataset.route.slice(1));
      });
    });
  });
}

function setActiveCategory(id){
  if(!id) return;
  const cat = window.CONVERTERS.find(c=>c.id===id)||window.CONVERTERS[0];
  activeCategory = cat.id;

  $$(".tab").forEach(b=>b.classList.remove("active"));
  $$(`.tab[data-route='/${cat.id}']`).forEach(b=>b.classList.add("active"));

  populateUnitSelects(cat);
  if(DOM.resultBox) DOM.resultBox.style.display="none";

  loadConversionGuide(cat.id, DOM.fromSelect.value, DOM.toSelect.value);
}

// -------------------------------
// Handle URL unit combos
// -------------------------------
function handleURLUnitCombo() {
  const path = location.pathname.replace(/^\/|\/$/g, ''); // remove leading/trailing slashes
  const parts = path.split('/'); // e.g., ["length", "centimeter-to-inch"]

  if (parts.length === 2) {
    const [catId, combo] = parts;
    const units = combo.split('-to-'); // e.g., ["centimeter", "inch"]
    if (units.length === 2) {
      const [from, to] = units;
      const cat = window.CONVERTERS.find(c => c.id === catId);
      if (cat && cat.units[from] && cat.units[to]) {
        setActiveCategory(catId);
        DOM.fromSelect.value = from;
        DOM.toSelect.value = to;

        // Load conversion guide immediately
        loadConversionGuide(catId, from, to);

        // Immediately perform conversion
        convert();

        // Reset URL to root after applying combo
        history.replaceState(null, '', '/');
      }
    }
  }
}

// Call it after all your converters and DOM are initialized
window.addEventListener('DOMContentLoaded', handleURLUnitCombo);


// -------------------------------
// Initialize UI
// -------------------------------
function bindUI(){
  DOM.convertBtn.addEventListener("click", convert);
  DOM.swapBtn.addEventListener("click", swapUnits);
  DOM.saveFavBtn.addEventListener("click", saveFavorite);

  DOM.fromSelect.addEventListener("change", ()=>{
    const cat = window.CONVERTERS.find(c=>c.id===activeCategory);
    loadConversionGuide(cat.id, DOM.fromSelect.value, DOM.toSelect.value);
  });
  DOM.toSelect.addEventListener("change", ()=>{
    const cat = window.CONVERTERS.find(c=>c.id===activeCategory);
    loadConversionGuide(cat.id, DOM.fromSelect.value, DOM.toSelect.value);
  });

  $("#clearFavoritesBtn")?.addEventListener("click", ()=>{
    if(confirm("Clear all favorites?")){
      localStorage.removeItem("favorites");
      renderFavorites();
      showResult("All favorites cleared");
    }
  });
  $("#clearHistoryBtn")?.addEventListener("click", ()=>{
    if(confirm("Clear recent history?")){
      localStorage.removeItem("history");
      renderHistory();
      showResult("Recent history cleared");
    }
  });
}

function init(){
  DOM.yearEl.textContent = new Date().getFullYear();
  bindUI();
  renderTabs();
  handleURLUnitCombo();
  
  if(!activeCategory) setActiveCategory(window.CONVERTERS[0].id);
  renderHistory();
  renderFavorites();
  loadGoogleAnalytics("G-HX0YW2Z8WS");
}

// -------------------------------
// DOM references
// -------------------------------
document.addEventListener("DOMContentLoaded", ()=>{
  DOM.tabsEl = $("#categoryTabs");
  DOM.categoryLinksEl = $("#categoryLinks");
  DOM.fromSelect = $("#fromSelect");
  DOM.toSelect = $("#toSelect");
  DOM.valueInput = $("#valueInput");
  DOM.resultBox = $("#resultBox");
  DOM.guideContentEl = $("#guideContent");
  DOM.historyList = $("#historyList");
  DOM.favList = $("#favList");
  DOM.convertBtn = $("#convertBtn");
  DOM.swapBtn = $("#swapBtn");
  DOM.saveFavBtn = $("#saveFavBtn");
  DOM.yearEl = $("#year");

  init();
});
