// -------------------------------
// Global DOM references & state
// -------------------------------
const DOM = {};
let activeCategory = null;

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
  window.gtag("js", new Date());
  window.gtag("config", id, { debug_mode: debug });

  console.log("GA4 initialized", { id, debug_mode: debug });
}

// -------------------------------
// Converters config
// -------------------------------
window.CONVERTERS = [
  {
    id: "length",
    label: "Length",
    baseUnit: "meter",
    units: { millimeter:0.001, centimeter:0.01, meter:1, kilometer:1000, inch:0.0254, foot:0.3048, yard:0.9144, mile:1609.344 }
  },
  {
    id: "weight",
    label: "Weight",
    baseUnit: "kilogram",
    units: { gram:0.001, kilogram:1, pound:0.45359237, ounce:0.028349523125 }
  },
  {
    id: "temperature",
    label: "Temperature",
    baseUnit: "celsius",
    type: "temperature",
    units: {
      celsius: { toBase:v=>v, fromBase:v=>v, label:"°C" },
      fahrenheit: { toBase:v=>(v-32)*(5/9), fromBase:v=>v*(9/5)+32, label:"°F" },
      kelvin: { toBase:v=>v-273.15, fromBase:v=>v+273.15, label:"K" }
    }
  },
  {
    id: "volume",
    label: "Volume",
    baseUnit: "liter",
    units: { milliliter:0.001, liter:1, cubic_meter:1000, gallon_us:3.78541, gallon_imperial:4.54609, cup_us:0.236588 }
  }
];

// -------------------------------
// Utilities
// -------------------------------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const formatNumber = n => {
  if(n==null || !isFinite(n)) return "—";
  return Math.abs(n)<0.00001 ? n.toExponential(4) : (Math.round(n*1e6)/1e6).toString();
};

const humanLabel = key => key.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase());

// -------------------------------
// Result / History / Favorites
// -------------------------------
function showResult(text, success=true) {
  DOM.resultBox.style.display = "block";
  DOM.resultBox.textContent = text;
  DOM.resultBox.style.color = success ? "var(--text)" : "red";
  DOM.resultBox.style.background = success ? "#f9f9f9" : "#fee";
}

const shortUnit = u => u.replace(/_/g," ");

function pushHistory(entry) {
  const history = JSON.parse(localStorage.getItem("history")||"[]");
  history.unshift(entry);
  localStorage.setItem("history", JSON.stringify(history.slice(0,5)));
  renderHistory();
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem("history")||"[]");
  if(!DOM.historyList) return;
  DOM.historyList.innerHTML = history.map((h,i)=>`
    <div class="item-row">
      <span>${formatNumber(h.value)} ${shortUnit(h.from)} → ${formatNumber(h.out)} ${shortUnit(h.to)}</span>
      <button class="remove-btn" data-index="${i}" aria-label="Remove item">&times;</button>
    </div>
  `).join("");
  DOM.historyList.querySelectorAll(".remove-btn").forEach(btn=>{
    btn.addEventListener("click", e=>{
      const idx = Number(e.target.dataset.index);
      history.splice(idx,1);
      localStorage.setItem("history",JSON.stringify(history));
      renderHistory();
      e.stopPropagation();
    });
  });
}

function saveFavorite() {
  if(!activeCategory) return showResult("Select a category first", false);
  const cat = window.CONVERTERS.find(c=>c.id===activeCategory);
  const from = DOM.fromSelect.value;
  const to = DOM.toSelect.value;
  const value = Number(DOM.valueInput.value.trim().replace(",",".")) || NaN;
  if(Number.isNaN(value)) return showResult("Invalid value", false);

  const out = cat.type==="temperature" 
    ? cat.units[to].fromBase(cat.units[from].toBase(value))
    : value*cat.units[from]/cat.units[to];

  const favs = JSON.parse(localStorage.getItem("favorites")||"[]");
  favs.unshift({cat:cat.id, from, to, value, out, ts:Date.now()});
  localStorage.setItem("favorites",JSON.stringify(favs.slice(0,50)));
  renderFavorites();
  showResult("Saved as favorite!");
}

function renderFavorites() {
  const favs = JSON.parse(localStorage.getItem("favorites")||"[]");
  if(!DOM.favList) return;
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
      localStorage.setItem("favorites",JSON.stringify(favs));
      renderFavorites();
      e.stopPropagation();
    });
  });
}

// -------------------------------
// Conversion logic
// -------------------------------
function convert() {
  if(!activeCategory){ showResult("Select a category first", false); return; }
  const cat = window.CONVERTERS.find(c=>c.id===activeCategory);
  const raw = DOM.valueInput.value.trim();
  if(!raw){ showResult("Enter a value", false); return; }
  const value = Number(raw.replace(",",".")); 
  if(Number.isNaN(value)){ showResult("Invalid value", false); return; }
  const from = DOM.fromSelect.value, to = DOM.toSelect.value;

  let out, text;
  if(cat.type==="temperature"){
    const base = cat.units[from].toBase(value);
    out = cat.units[to].fromBase(base);
    text = `${formatNumber(value)} ${cat.units[from].label||""} = ${formatNumber(out)} ${cat.units[to].label||""}`;
  } else {
    out = value*cat.units[from]/cat.units[to];
    text = `${formatNumber(value)} ${shortUnit(from)} = ${formatNumber(out)} ${shortUnit(to)}`;
  }

  showResult(text,true);
  pushHistory({cat:cat.id, from, to, value, out, ts:Date.now()});
  loadConversionGuide(cat.id, from, to);

  if(typeof gtag==="function"){
    gtag("event","unit_combo",{unit_combo:`${from}→${to}`, debug_mode: location.search.includes("debug_mode=true") });
  }
}

// -------------------------------
// Swap units
// -------------------------------
function swapUnits() {
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
  if(cat.type==="temperature"){
    for(const [k,v] of Object.entries(cat.units)){
      const optA = new Option(k + (v.label?" "+v.label:""), k);
      const optB = new Option(k + (v.label?" "+v.label:""), k);
      DOM.fromSelect.add(optA); DOM.toSelect.add(optB);
    }
  } else {
    const metricUnits=["millimeter","centimeter","meter","kilometer","gram","kilogram","liter","cubic_meter"];
    const imperialUnits=["inch","foot","yard","mile","pound","ounce","gallon_us","gallon_imperial","cup_us"];

    const groups = {
      from: { metric: new OptGroup("Metric"), imperial: new OptGroup("US / Imperial") },
      to: { metric: new OptGroup("Metric"), imperial: new OptGroup("US / Imperial") }
    };

    Object.keys(cat.units).forEach(key=>{
      const optFrom = new Option(humanLabel(key), key);
      const optTo = new Option(humanLabel(key), key);
      if(metricUnits.includes(key)){
        groups.from.metric.add(optFrom); groups.to.metric.add(optTo);
      } else {
        groups.from.imperial.add(optFrom); groups.to.imperial.add(optTo);
      }
    });

    DOM.fromSelect.append(groups.from.metric.el, groups.from.imperial.el);
    DOM.toSelect.append(groups.to.metric.el, groups.to.imperial.el);
  }

  if(fromUnit) DOM.fromSelect.value=fromUnit;
  if(toUnit) DOM.toSelect.value=toUnit;
  if(!fromUnit) DOM.fromSelect.selectedIndex = 1<DOM.fromSelect.length?1:0;
  if(!toUnit) DOM.toSelect.selectedIndex = 2<DOM.toSelect.length?2:(DOM.fromSelect.selectedIndex===0?1:0);
}

class OptGroup {
  constructor(label){ this.el = document.createElement("optgroup"); this.el.label = label; }
  add(option){ this.el.appendChild(option); }
}

// -------------------------------
// Conversion guide loader
// -------------------------------
async function loadConversionGuide(catId, fromUnit, toUnit){
  if(!DOM.guideContentEl) return;
  const paths = [
    `/static-pages/${catId}/${fromUnit}-to-${toUnit}/conversionguide.html`,
    `/static-pages/${catId}/${toUnit}-to-${fromUnit}/conversionguide.html`,
    `/conversionguide-default.html`
  ];

  for(const path of paths){
    try {
      const resp = await fetch(path,{cache:"no-store"});
      if(!resp.ok) continue;
      const html = await resp.text();
      if(html.includes("<html")) continue;
      DOM.guideContentEl.innerHTML = html;
      if(window.MathJax?.typesetPromise) await window.MathJax.typesetPromise([DOM.guideContentEl]);
      return;
    } catch{}
  }
  DOM.guideContentEl.innerHTML = "<p>Conversion guide is not available at the moment.</p>";
}

// -------------------------------
// Tabs & categories
// -------------------------------
function renderTabs(){
  DOM.tabsEl.innerHTML = DOM.categoryLinksEl.innerHTML = "";
  window.CONVERTERS.forEach(cat=>{
    [DOM.tabsEl, DOM.categoryLinksEl].forEach(container=>{
      const btn = document.createElement("button");
      btn.className = "tab" + (cat.id===activeCategory?" active":"");
      btn.textContent = cat.label;
      btn.dataset.route = `/${cat.id}`;
      container.appendChild(btn);
      container.addEventListener("click", e=>{
        const b = e.target.closest("button[data-route]");
        if(!b) return;
        setActiveCategory(b.dataset.route.slice(1));
      });
    });
  });
}

function setActiveCategory(id, fromUnit=null, toUnit=null){
  if(!id) return console.warn("No category id provided");
  id = id.replace(/\/$/,"");
  const cat = window.CONVERTERS.find(c=>c.id===id) || window.CONVERTERS[0];
  activeCategory = cat.id;

  $$(".tab").forEach(b=>b.classList.remove("active"));
  $$(`.tab[data-route='/${cat.id}']`).forEach(b=>b.classList.add("active"));

  populateUnitSelects(cat, fromUnit, toUnit);
  DOM.resultBox.style.display="none";
  renderConverter();
  updateSEO(cat, `/${cat.id}`);
}

// -------------------------------
// SEO & dynamic URLs
// -------------------------------
function updateSEO(cat, virtualPath){
  if(!cat?.label) return;
  document.title = `Free Units Converter — ${cat.label}`;
  const desc = `Convert ${cat.label.toLowerCase()} quickly and accurately.`;
  $("#meta-description")?.setAttribute("content", desc);
  $("#canonical-link")?.setAttribute("href", (window.SITE_URL_EXT||"") + (virtualPath||""));
  const jsonLd = $("#json-ld");
  if(jsonLd) {
    try{
      const ld = JSON.parse(jsonLd.textContent);
      ld.url = window.SITE_URL_EXT || "";
      jsonLd.textContent = JSON.stringify(ld);
    }catch{}
  }
}

// -------------------------------
// Initialize
// -------------------------------
function bindUI(){
  DOM.convertBtn.addEventListener("click", convert);
  DOM.swapBtn.addEventListener("click", ()=>{ swapUnits(); loadConversionGuide(activeCategory, DOM.fromSelect.value, DOM.toSelect.value); });
  DOM.saveFavBtn.addEventListener("click", saveFavorite);
  DOM.fromSelect.addEventListener("change", ()=>loadConversionGuide(activeCategory, DOM.fromSelect.value, DOM.toSelect.value));
  DOM.toSelect.addEventListener("change", ()=>loadConversionGuide(activeCategory, DOM.fromSelect.value, DOM.toSelect.value));

  $("#clearFavoritesBtn")?.addEventListener("click", ()=>{
    if(confirm("Clear all favorites?")){ localStorage.removeItem("favorites"); renderFavorites(); showResult("All favorites cleared"); }
  });
  $("#clearHistoryBtn")?.addEventListener("click", ()=>{
    if(confirm("Clear recent history?")){ localStorage.removeItem("history"); renderHistory(); showResult("Recent history cleared"); }
  });
}

async function renderConverter() {
  try{
    const resp = await fetch("/conversionguide-default.html",{cache:"no-store"});
    DOM.guideContentEl.innerHTML = await resp.text();
  } catch{
    DOM.guideContentEl.innerHTML = "<p>Welcome to the Free Units Converter! Start by selecting a category and units.</p>";
  }
}

function handleURLUnitCombo(){
  const [catId, combo] = location.pathname.replace(/^\/|\/$/g,"").split("/");
  if(!catId || !combo) return;
  const [from, to] = combo.split("-to-");
  const cat = window.CONVERTERS.find(c=>c.id===catId);
  if(cat && cat.units[from] && cat.units[to]){
    setActiveCategory(catId, from, to);
    loadConversionGuide(catId, from, to);
    convert();
    history.replaceState(null,"","/");
  }
}

function init(){
  DOM.yearEl.textContent = new Date().getFullYear();
  bindUI();
  renderTabs();
  handleURLUnitCombo();
  if(!activeCategory) setActiveCategory(window.CONVERTERS[0].id);
  renderHistory();
  renderFavorites();
  renderConverter();
  loadGoogleAnalytics("G-HX0YW2Z8WS");
}

document.addEventListener("DOMContentLoaded", ()=>{
  [
    "yearEl","tabsEl","categoryLinksEl","fromSelect","toSelect",
    "valueInput","convertBtn","swapBtn","saveFavBtn",
    "resultBox","historyList","favList","guideContentEl"
  ].forEach(id=>DOM[id]=document.getElementById(id));

  // Set main CSS
  $("#main-style")?.setAttribute("href", (window.SITE_URL_EXT||"") + "/style.css");
  
  init();
});
