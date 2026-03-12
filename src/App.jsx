import { useState, useEffect } from "react";

const DIETS = [
  { id:"none",          label:"No Restrictions",  emoji:"🍽️", desc:"I eat everything" },
  { id:"vegetarian",    label:"Vegetarian",        emoji:"🥦", desc:"No meat or fish" },
  { id:"vegan",         label:"Vegan",             emoji:"🌱", desc:"No animal products" },
  { id:"keto",          label:"Keto",              emoji:"🥩", desc:"Low-carb, high-fat" },
  { id:"paleo",         label:"Paleo",             emoji:"🦴", desc:"Whole foods, no grains" },
  { id:"mediterranean", label:"Mediterranean",     emoji:"🫒", desc:"Olive oil, fish, veggies" },
  { id:"gluten-free",   label:"Gluten-Free",       emoji:"🌾", desc:"No wheat or gluten" },
  { id:"dairy-free",    label:"Dairy-Free",        emoji:"🥛", desc:"No milk products" },
  { id:"low-carb",      label:"Low-Carb",          emoji:"🥗", desc:"Reduced carbs" },
  { id:"whole30",       label:"Whole30",           emoji:"🥕", desc:"30-day clean eating" },
];
const ALLERGIES = [
  { id:"nuts",       label:"Tree Nuts",    emoji:"🥜", desc:"almonds, cashews, walnuts…" },
  { id:"peanuts",    label:"Peanuts",      emoji:"🫘", desc:"peanuts & peanut oil" },
  { id:"gluten",     label:"Gluten/Wheat", emoji:"🌾", desc:"wheat, barley, rye" },
  { id:"dairy",      label:"Dairy",        emoji:"🥛", desc:"milk, cheese, butter" },
  { id:"eggs",       label:"Eggs",         emoji:"🥚", desc:"whole eggs & egg products" },
  { id:"shellfish",  label:"Shellfish",    emoji:"🦞", desc:"shrimp, crab, lobster" },
  { id:"fish",       label:"Fish",         emoji:"🐟", desc:"salmon, tuna, cod…" },
  { id:"soy",        label:"Soy",          emoji:"🫘", desc:"soy sauce, tofu, edamame" },
  { id:"sesame",     label:"Sesame",       emoji:"🫙", desc:"sesame seeds & oil" },
  { id:"nightshade", label:"Nightshades",  emoji:"🍅", desc:"tomatoes, peppers, eggplant" },
];
const MOODS = [
  { id:"quick",       label:"Quick & Easy",         emoji:"⚡" },
  { id:"comfort",     label:"Comfort Food",          emoji:"🤗" },
  { id:"healthy",     label:"Healthy & Light",       emoji:"🥗" },
  { id:"adventurous", label:"Something Adventurous", emoji:"🌍" },
  { id:"variety",     label:"Mix It Up!",            emoji:"🎲" },
];
const SERVINGS_OPTIONS = [1,2,3,4,6,8];
const DAYS      = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const GROCERY_CATS = ["Produce","Meat & Seafood","Dairy & Eggs","Pantry & Dry Goods","Canned & Jarred","Spices & Seasonings","Oils & Condiments","Frozen","Other"];
const CAT_EMOJI = {"Produce":"🥬","Meat & Seafood":"🥩","Dairy & Eggs":"🥚","Pantry & Dry Goods":"🌾","Canned & Jarred":"🥫","Spices & Seasonings":"🌿","Oils & Condiments":"🫙","Frozen":"🧊","Other":"📦"};

function getMealEmoji(name="") {
  const MAP = {chicken:"🍗",pasta:"🍝",soup:"🍲",salad:"🥗",fish:"🐟",salmon:"🐟",beef:"🥩",steak:"🥩",pork:"🥓",shrimp:"🍤",pizza:"🍕",burger:"🍔",taco:"🌮",rice:"🍚",noodle:"🍜",ramen:"🍜",curry:"🍛",bowl:"🥣",wrap:"🌯",sandwich:"🥪",egg:"🍳",mushroom:"🍄",tofu:"🫘",lentil:"🫘",roast:"🍖",veggie:"🥦",lamb:"🥩",cake:"🎂"};
  const l = name.toLowerCase();
  for (const [k,v] of Object.entries(MAP)) if (l.includes(k)) return v;
  return "🍽️";
}

// ── Claude API ────────────────────────────────────────────────────────────────
async function callClaude(prompt, maxTokens=2500) {
  const res = await fetch("/api/claude",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:maxTokens,messages:[{role:"user",content:prompt}]}),
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  if(d.error) throw new Error(d.error.message);
  return (d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
}
function parseArr(text){const m=text.replace(/```json|```/g,"").trim().match(/\[[\s\S]*\]/);if(!m)throw new Error("No JSON array");return JSON.parse(m[0]);}
function parseObj(text){const m=text.replace(/```json|```/g,"").trim().match(/\{[\s\S]*\}/);if(!m)throw new Error("No JSON object");return JSON.parse(m[0]);}

// Compact recipe schema for lean prompts
function recipeSchema(svc){
  return `{"name":"...","source":"Inspired by Serious Eats","rating":"4.8/5","time":"30 min","difficulty":"Easy","servings":${svc},"description":"One sentence.","ingredients":["2 tbsp olive oil","1 lb chicken"],"steps":["Step 1.","Step 2.","Step 3."],"nutrition":{"calories":"400 kcal","protein":"35g","carbs":"15g","fat":"20g"},"tips":"One tip."}`;
}

async function fetchRecipes(count, svc, dietLabel, dietDesc, mood, allergyLine, extras="", existingNames=[]) {
  const avoidLine = existingNames.length ? `Do NOT suggest: ${existingNames.join(", ")}.` : "";
  const prompt = `Expert chef. Suggest exactly ${count} dinner recipe${count>1?"s":""}.
Diet: ${dietLabel||"No restrictions"}${dietDesc?" ("+dietDesc+")":""}
Mood: ${mood||"any"}  Servings: ${svc}
${allergyLine}${extras}${avoidLine}
Return ONLY a raw JSON array of ${count} objects, no markdown:
[${Array(count).fill(recipeSchema(svc)).join(",")}]
Scale ingredients for ${svc} serving${svc!==1?"s":""}. Return ONLY the JSON array.`;
  const text = await callClaude(prompt, count <= 3 ? 2500 : 5500);
  return parseArr(text).map(m=>({...m,emoji:getMealEmoji(m.name),thumb:null,youtube:null,area:""}));
}

async function scaleRecipe(meal, oldSvc, newSvc) {
  const prompt = `Rescale from ${oldSvc} to ${newSvc} serving${newSvc!==1?"s":""}.
Ingredients (${oldSvc} svc): ${meal.ingredients.join(" | ")}
Steps: ${meal.steps.map((s,i)=>`${i+1}. ${s}`).join(" | ")}
Return ONLY raw JSON: {"servings":${newSvc},"ingredients":["..."],"steps":["..."]}`;
  const text = await callClaude(prompt, 900);
  return parseObj(text);
}
const UNIT_GROUPS = {
  tsp:1,teaspoon:1,teaspoons:1,tbsp:3,tablespoon:3,tablespoons:3,
  cup:48,cups:48,"fl oz":6,
  oz:1,ounce:1,ounces:1,lb:16,lbs:16,pound:16,pounds:16,
  g:1,gram:1,grams:1,kg:1000,
  clove:1,cloves:1,can:1,cans:1,slice:1,slices:1,sprig:1,sprigs:1,
  stalk:1,stalks:1,bunch:1,head:1,heads:1,piece:1,pieces:1,
};
const UNIT_BASE = {
  tsp:"tsp",teaspoon:"tsp",teaspoons:"tsp",tbsp:"tsp",tablespoon:"tsp",tablespoons:"tsp",cup:"tsp",cups:"tsp","fl oz":"tsp",
  oz:"oz",ounce:"oz",ounces:"oz",lb:"oz",lbs:"oz",pound:"oz",pounds:"oz",
  g:"g",gram:"g",grams:"g",kg:"g",
  clove:"clove",cloves:"clove",can:"can",cans:"can",slice:"slice",slices:"slice",
  sprig:"sprig",sprigs:"sprig",stalk:"stalk",stalks:"stalk",bunch:"bunch",head:"head",heads:"head",piece:"piece",pieces:"piece",
};
function parseFrac(str) {
  str = String(str).trim().replace(/½/g,"1/2").replace(/¼/g,"1/4").replace(/¾/g,"3/4").replace(/⅓/g,"1/3").replace(/⅔/g,"2/3").replace(/⅛/g,"1/8");
  const m = str.match(/^(\d+)\s+(\d+)\/(\d+)$/); if (m) return +m[1]+ +m[2]/+m[3];
  const f = str.match(/^(\d+)\/(\d+)$/); if (f) return +f[1]/+f[2];
  const n = parseFloat(str); return isNaN(n)?null:n;
}
function fmtAmount(total,base) {
  const r=v=>Math.round(v*4)/4;
  if(base==="tsp"){ if(total>=48)return`${r(total/48)} cup${r(total/48)!==1?"s":""}`; if(total>=3)return`${r(total/3)} tbsp`; return`${r(total)} tsp`; }
  if(base==="oz"){ if(total>=16)return`${r(total/16)} lb${r(total/16)!==1?"s":""}`; return`${r(total)} oz`; }
  if(base==="g"){ if(total>=1000)return`${Math.round(total/10)/100} kg`; return`${Math.round(total)} g`; }
  const v=r(total); const plural=!["bunch","head","stalk","sprig"].includes(base)&&v!==1?"s":""; return`${v} ${base}${plural}`;
}
function parseIngredient(raw) {
  const str=raw.replace(/½/g,"1/2").replace(/¼/g,"1/4").replace(/¾/g,"3/4").replace(/⅓/g,"1/3").replace(/⅔/g,"2/3").replace(/⅛/g,"1/8").trim();
  const unitRe=Object.keys(UNIT_GROUPS).sort((a,b)=>b.length-a.length).join("|");
  const m=str.match(new RegExp(`^([\\d\\s\\/]+)?\\s*(${unitRe})\\.?\\s+(.+)$`,"i"));
  if(m){const amt=parseFrac(m[1]||"1");const unit=m[2].toLowerCase();const name=m[3].replace(/,.*$/,"").trim().toLowerCase();return{amt:amt||1,base:UNIT_BASE[unit],fac:UNIT_GROUPS[unit]||1,name};}
  const m2=str.match(/^([\d\s\/]+)\s+(.+)$/);
  if(m2){const amt=parseFrac(m2[1]);if(amt!==null)return{amt,base:"count",fac:1,name:m2[2].replace(/,.*$/,"").trim().toLowerCase()};}
  return{amt:null,base:null,fac:1,name:str.replace(/,.*$/,"").trim().toLowerCase()};
}
function aggregateItems(items) {
  const map={};
  items.forEach(raw=>{const p=parseIngredient(raw);const key=`${p.name}||${p.base||"none"}`;if(!map[key])map[key]={name:p.name,base:p.base,total:0,hasAmt:false,fallback:[]};if(p.amt!==null&&p.base){map[key].total+=p.amt*p.fac;map[key].hasAmt=true;}else map[key].fallback.push(raw);});
  return Object.values(map).map(e=>{const label=e.name.replace(/\b\w/g,c=>c.toUpperCase());if(e.hasAmt&&e.base&&e.base!=="count")return{label,total:fmtAmount(e.total,e.base)};if(e.hasAmt&&e.base==="count")return{label,total:`${Math.round(e.total*4)/4}`};return{label:[...new Set(e.fallback)][0]?.replace(/\b\w/g,c=>c.toUpperCase())||label,total:null};}).sort((a,b)=>a.label.localeCompare(b.label));
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = {
  bg:    {minHeight:"100vh",background:"linear-gradient(135deg,#1a0a2e 0%,#16213e 45%,#0f3460 100%)",fontFamily:"'Georgia',serif",color:"#f0e6d3",margin:0,padding:0},
  card:  {background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,200,100,0.18)",borderRadius:16,padding:20},
  gold:  {background:"linear-gradient(135deg,#ffd27d,#ff8c42)",border:"none",borderRadius:50,fontWeight:"bold",color:"#1a0a2e",cursor:"pointer",fontFamily:"'Georgia',serif"},
  ghost: {background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:50,color:"#a09080",cursor:"pointer",fontFamily:"'Georgia',serif"},
  lbl:   {fontSize:11,color:"#ffd27d",fontWeight:"bold",textTransform:"uppercase",letterSpacing:2,marginBottom:10},
};
function wrap(children){return <div style={s.bg}><div style={{maxWidth:660,margin:"0 auto",padding:"36px 20px"}}>{children}</div></div>;}

// ── Recipe Detail component ───────────────────────────────────────────────────
function RecipeDetail({meal,onBack,backLabel="← Back",extraActions}) {
  const ytSearch = q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  return (
    <div>
      <button onClick={onBack} style={{...s.ghost,padding:"9px 20px",fontSize:13,marginBottom:18}}>{backLabel}</button>

      {/* Header card with photo */}
      <div style={{...s.card,marginBottom:12}}>
        {meal.thumb && <img src={meal.thumb} alt={meal.name} style={{width:"100%",borderRadius:10,marginBottom:14,objectFit:"cover",maxHeight:220}}/>}
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:10}}>
          <span style={{fontSize:44}}>{meal.emoji}</span>
          <div>
            <h3 style={{margin:0,fontSize:22,color:"#ffd27d",lineHeight:1.2}}>{meal.name}</h3>
            {meal.day&&<p style={{margin:"3px 0 2px",color:"#ff8c42",fontSize:13,fontWeight:"bold"}}>📅 {meal.day}</p>}
            <p style={{margin:"2px 0",color:"#9a8070",fontSize:13}}>{meal.rating} · {meal.area||meal.category} · {meal.category}</p>
            <p style={{margin:0,color:"#9a8070",fontSize:13}}>⏱ {meal.time} · {meal.difficulty} · 🍽️ {meal.servings} serving{meal.servings!==1?"s":""}</p>
          </div>
        </div>
        <p style={{color:"#c9b99a",lineHeight:1.65,margin:0}}>{meal.description}</p>
      </div>

      {/* Ingredients */}
      <div style={{...s.card,marginBottom:12}}>
        <p style={s.lbl}>📋 Ingredients — {meal.servings} serving{meal.servings!==1?"s":""}</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"9px 20px"}}>
          {meal.ingredients?.map((ing,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:14,color:"#d0c0a8",lineHeight:1.4}}>
              <span style={{color:"#ffd27d",flexShrink:0,marginTop:1}}>✓</span><span>{ing}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div style={{...s.card,marginBottom:12}}>
        <p style={s.lbl}>👨‍🍳 Instructions</p>
        {meal.steps?.map((step,i)=>(
          <div key={i} style={{display:"flex",gap:14,marginBottom:14,alignItems:"flex-start"}}>
            <span style={{background:"linear-gradient(135deg,#ffd27d,#ff8c42)",color:"#1a0a2e",borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:"bold",flexShrink:0,marginTop:1}}>{i+1}</span>
            <p style={{margin:0,color:"#c9b99a",lineHeight:1.7,fontSize:15}}>{step}</p>
          </div>
        ))}
      </div>

      {/* Video */}
      <div style={{...s.card,background:"rgba(255,50,50,0.06)",border:"1px solid rgba(255,80,80,0.2)",marginBottom:12}}>
        <p style={{...s.lbl,color:"#ff8070",marginBottom:10}}>▶ Watch It Being Made</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {meal.youtube ? (
            <a href={meal.youtube} target="_blank" rel="noopener noreferrer" style={{flex:2,minWidth:140,background:"linear-gradient(135deg,#ff4e42,#cc1a10)",border:"none",borderRadius:50,padding:"10px 16px",fontWeight:"bold",color:"#fff",cursor:"pointer",fontFamily:"'Georgia',serif",fontSize:14,textAlign:"center",textDecoration:"none",display:"inline-block",boxShadow:"0 3px 12px rgba(200,30,20,0.4)"}}>
              ▶ Official Recipe Video
            </a>
          ) : (
            <a href={ytSearch(`how to make ${meal.name} recipe`)} target="_blank" rel="noopener noreferrer" style={{flex:2,minWidth:140,background:"linear-gradient(135deg,#ff4e42,#cc1a10)",border:"none",borderRadius:50,padding:"10px 16px",fontWeight:"bold",color:"#fff",cursor:"pointer",fontFamily:"'Georgia',serif",fontSize:14,textAlign:"center",textDecoration:"none",display:"inline-block",boxShadow:"0 3px 12px rgba(200,30,20,0.4)"}}>
              ▶ Find Recipe Video
            </a>
          )}
          <a href={ytSearch(`${meal.name} recipe short`)} target="_blank" rel="noopener noreferrer" style={{flex:1,minWidth:100,background:"rgba(255,60,50,0.12)",border:"1px solid rgba(255,80,70,0.35)",borderRadius:50,padding:"10px 12px",fontWeight:"bold",color:"#ff9090",fontFamily:"'Georgia',serif",fontSize:14,textAlign:"center",textDecoration:"none",display:"inline-block"}}>
            ⚡ Short / Reel
          </a>
        </div>
      </div>

      {extraActions}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function DinnerApp() {
  const [screen,            setScreen]           = useState("welcome");
  const [planMode,          setPlanMode]          = useState(null);
  const [selectedDiet,      setSelectedDiet]      = useState(null);
  const [selectedAllergies, setSelectedAllergies] = useState([]);
  const [selectedMood,      setSelectedMood]      = useState(null);
  const [servings,          setServings]          = useState(2);
  const [ingredients,       setIngredients]       = useState("");
  const [pantryItems,       setPantryItems]       = useState([]);
  const [pantryInput,       setPantryInput]       = useState("");
  const [loading,           setLoading]           = useState(false);
  const [loadingMsg,        setLoadingMsg]        = useState("");
  const [error,             setError]             = useState(null);

  const [meals,        setMeals]        = useState(null);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [favorites,    setFavorites]    = useState([]);

  useState(() => {
    try {
      const saved = localStorage.getItem("mealmuse-favorites");
      if (saved) setFavorites(JSON.parse(saved));
    } catch(e) {}
  });

  const [weekPlan,     setWeekPlan]     = useState(null);
  const [dayServings,  setDayServings]  = useState({});
  const [excludedDays, setExcludedDays] = useState(new Set());
  const [replacingDay, setReplacingDay] = useState(null);
  const [rescalingDay, setRescalingDay] = useState(null);
  const [calView,      setCalView]      = useState("list");
  const [selectedDay,  setSelectedDay]  = useState(null);
  const [showShopping, setShowShopping] = useState(false);
  const [checkedItems, setCheckedItems] = useState({});
  const [removedKeys,  setRemovedKeys]  = useState(new Set());

  function resetAll() {
    setScreen("welcome"); setPlanMode(null); setSelectedDiet(null); setSelectedAllergies([]);
    setSelectedMood(null); setServings(2); setIngredients(""); setPantryItems([]); setPantryInput("");
    setLoading(false); setLoadingMsg(""); setError(null);
    setMeals(null); setSelectedMeal(null);
    setWeekPlan(null); setDayServings({}); setExcludedDays(new Set()); setReplacingDay(null); setRescalingDay(null);
    setCalView("list"); setSelectedDay(null);
    setShowShopping(false); setCheckedItems({}); setRemovedKeys(new Set());
  }

  // ── Browser back button support ──
  // Push a history entry whenever the screen changes so the back button works
  useEffect(() => {
    window.history.pushState({ screen }, "", window.location.pathname);
  }, [screen, selectedMeal, showShopping]);

  useEffect(() => {
    function handlePop() {
      // When browser back is pressed, go back one step in app logic
      if (showShopping) { setShowShopping(false); return; }
      if (selectedMeal) { setSelectedMeal(null); return; }
      const prev = {
        "week-result": "mood",
        "single-result": "mood",
        "mood": "diet",
        "diet": "welcome",
        "pantry": "welcome",
        "favorites": "welcome",
      };
      if (screen === "welcome") return; // already at home, let browser handle it
      setScreen(prev[screen] || "welcome");
    }
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [screen, selectedMeal, showShopping]);

  const allergyLine = selectedAllergies.length ? `ALLERGIES — never include: ${selectedAllergies.map(a=>a.label).join(", ")}.` : "";

  function isFav(meal) { return favorites.some(f=>f.name===meal.name); }

  async function toggleFavorite(meal) {
    const already = isFav(meal);
    const next = already
      ? favorites.filter(f=>f.name!==meal.name)
      : [...favorites, {...meal, savedAt: new Date().toLocaleDateString()}];
    setFavorites(next);
    try { localStorage.setItem("mealmuse-favorites", JSON.stringify(next)); } catch(e) {}
  }
  const dietLabel = selectedDiet?.label || "No restrictions";
  const dietDesc  = selectedDiet?.desc  || "";
  const moodLabel = selectedMood?.label || "any";

  // ── Fetch: single night ──
  async function fetchSingleMeals() {
    setLoading(true); setError(null); setLoadingMsg("🍳 Finding recipes…");
    try {
      const existing = meals ? meals.map(m => m.name) : [];
      const raw = await fetchRecipes(3, servings, dietLabel, dietDesc, moodLabel, allergyLine, "", existing);
      setMeals(raw);
      setScreen("single-result");
    } catch(e) { setError("Couldn't load recipes. Please try again."); }
    setLoading(false); setLoadingMsg("");
  }

  // ── Fetch: pantry ──
  async function fetchPantryMeals() {
    setLoading(true); setError(null); setLoadingMsg("🧑‍🍳 Finding recipes for your ingredients…");
    try {
      const existing = meals ? meals.map(m => m.name) : [];
      const randomSeed = Math.floor(Math.random() * 10000);
      const extras = `Ingredients on hand: ${pantryItems.join(", ")}. Build recipes primarily around these. Common spices & oil assumed. Be creative and suggest DIFFERENT recipes each time (seed: ${randomSeed}).\n`;
      const raw = await fetchRecipes(3, servings, dietLabel, dietDesc, "any", allergyLine, extras, existing);
      setMeals(raw);
      setScreen("single-result");
    } catch(e) { setError("Couldn't find recipes. Please try again."); }
    setLoading(false); setLoadingMsg("");
  }

  // ── Fetch: week plan ──
  async function fetchWeekPlan() {
    setLoading(true); setError(null); setLoadingMsg("📅 Planning your week…");
    try {
      const extras = "Vary proteins, cuisines, and methods across the week. Weeknights under 45 min. Add a 'day' field for each: Monday through Sunday.\n";
      const raw = await fetchRecipes(7, servings, dietLabel, dietDesc, moodLabel, allergyLine, extras);
      const plan = raw.map((m,i)=>({...m, day:DAYS[i], servings}));
      setWeekPlan(plan); setDayServings({}); setExcludedDays(new Set());
      setScreen("week-result");
    } catch(e) { setError("Couldn't generate meal plan. Please try again."); }
    setLoading(false); setLoadingMsg("");
  }

  // ── Replace one day ──
  async function replaceDay(dayIdx) {
    setReplacingDay(dayIdx);
    const existing = weekPlan.map(m=>m.name);
    const svc = dayServings[dayIdx] ?? servings;
    try {
      const [newMeal] = await fetchRecipes(1, svc, dietLabel, dietDesc, moodLabel, allergyLine, "", existing);
      if (newMeal) {
        setWeekPlan(prev=>prev.map((m,i)=>i===dayIdx?{...newMeal,day:DAYS[dayIdx],servings:svc}:m));
        setSelectedDay(dayIdx);
      }
    } catch(e) { setError("Couldn't replace recipe. Please try again."); }
    setReplacingDay(null);
  }

  // ── Per-day serving rescale ──
  function daySvc(i){ return dayServings[i]??servings; }

  async function rescaleDay(dayIdx, newSvc) {
    const meal = weekPlan[dayIdx];
    const oldSvc = daySvc(dayIdx);
    if (newSvc===oldSvc) return;
    setRescalingDay(dayIdx);
    setDayServings(prev=>({...prev,[dayIdx]:newSvc}));
    try {
      const scaled = await scaleRecipe(meal, oldSvc, newSvc);
      setWeekPlan(prev=>prev.map((m,i)=>i===dayIdx?{...m,servings:newSvc,ingredients:scaled.ingredients,steps:scaled.steps}:m));
    } catch(e) {
      setDayServings(prev=>({...prev,[dayIdx]:oldSvc}));
      setError("Couldn't rescale. Please try again.");
    }
    setRescalingDay(null);
  }

  function toggleExcludeDay(i) {
    setExcludedDays(prev=>{const n=new Set(prev);n.has(i)?n.delete(i):n.add(i);return n;});
    if(selectedDay===i) setSelectedDay(null);
  }

  // ── Shopping list ──
  function buildShoppingList() {
    if(!weekPlan) return {};
    const all = weekPlan.flatMap((m,i)=>excludedDays.has(i)?[]:(m.ingredients||[]));
    const cat={}; GROCERY_CATS.forEach(c=>cat[c]=[]);
    all.forEach(item=>{
      const l=item.toLowerCase();
      if(/chicken|beef|pork|lamb|shrimp|salmon|fish|turkey|sausage|bacon/.test(l)) cat["Meat & Seafood"].push(item);
      else if(/milk|cream|cheese|butter|egg|yogurt|parmesan|mozzarella/.test(l)) cat["Dairy & Eggs"].push(item);
      else if(/garlic|onion|tomato|pepper|spinach|lettuce|carrot|celery|zucchini|broccoli|mushroom|lemon|lime|potato|parsley|basil|cilantro|ginger|avocado|kale/.test(l)) cat["Produce"].push(item);
      else if(/pasta|rice|flour|bread|oat|lentil|bean|quinoa|noodle/.test(l)) cat["Pantry & Dry Goods"].push(item);
      else if(/\bcan\b|jar|sauce|broth|stock|tomato paste|coconut milk|salsa/.test(l)) cat["Canned & Jarred"].push(item);
      else if(/salt|pepper|paprika|cumin|oregano|thyme|cinnamon|chili|turmeric|curry|seasoning|spice|cayenne|bay leaf|red pepper flakes/.test(l)) cat["Spices & Seasonings"].push(item);
      else if(/oil|vinegar|soy sauce|hot sauce|mustard|honey|mayo|ketchup/.test(l)) cat["Oils & Condiments"].push(item);
      else if(/frozen/.test(l)) cat["Frozen"].push(item);
      else cat["Other"].push(item);
    });
    GROCERY_CATS.forEach(k=>{if(!cat[k].length)delete cat[k];});
    Object.keys(cat).forEach(k=>{cat[k]=aggregateItems(cat[k]);});
    return cat;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN: WELCOME
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen==="welcome") return (
    <div style={s.bg}>
      <div style={{maxWidth:480,margin:"0 auto",padding:"60px 24px",textAlign:"center"}}>
        <div style={{fontSize:72,marginBottom:10}}>🌙</div>
        <div style={{fontSize:52,letterSpacing:2,color:"#ff8c42",marginBottom:4,fontWeight:"bold"}}>MealMuse</div>
        <h1 style={{fontSize:22,fontWeight:"normal",color:"#ffd27d",margin:"0 0 18px",letterSpacing:"1px"}}>What's for Dinner?</h1>
        <p style={{fontSize:15,color:"#c9b99a",lineHeight:1.75,marginBottom:10}}>
          Personalized recipes with exact measurements, photos, and videos — tailored to your diet and preferences.
        </p>
        <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:"8px 18px",fontSize:13,color:"#7a6a5a",marginBottom:28}}>
          <span>📏 Exact measurements</span><span>🎥 Video links</span><span>🛒 Shopping list</span>
        </div>
        <p style={{...s.lbl,textAlign:"center",marginBottom:14}}>How would you like to plan?</p>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:28}}>
          {[
            {mode:"single",icon:"🍽️",title:"Tonight's Dinner",    sub:"Browse 3 real recipe options for tonight"},
            {mode:"week",  icon:"📅",title:"Full Week Plan",       sub:"7 real dinners + shopping list"},
            {mode:"pantry",icon:"🧑‍🍳",title:"Use What I Have",     sub:"Find recipes around your ingredients"},
            {mode:"favorites",icon:"♥",title:"My Saved Recipes",   sub:`${favorites.length} recipe${favorites.length!==1?"s":""} saved`},
          ].map(opt=>(
            <div key={opt.mode} onClick={()=>{setPlanMode(opt.mode);setScreen(opt.mode==="pantry"?"pantry":opt.mode==="favorites"?"favorites":"diet");}} style={{
              ...s.card,cursor:"pointer",padding:"18px 22px",textAlign:"left",
              display:"flex",alignItems:"center",gap:16,transition:"all 0.2s",
              border:"1px solid rgba(255,200,100,0.25)",
            }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,210,125,0.1)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
            >
              <span style={{fontSize:36}}>{opt.icon}</span>
              <div>
                <div style={{fontWeight:"bold",fontSize:17,color:"#ffd27d"}}>{opt.title}</div>
                <div style={{fontSize:13,color:"#a09080",marginTop:3}}>{opt.sub}</div>
              </div>
              <span style={{marginLeft:"auto",color:"#ffd27d",fontSize:22}}>›</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:"8px 18px",fontSize:13,color:"#7a6a5a"}}>
          <span>📷 Real photos</span><span>🎥 Video links</span><span>🛒 Shopping list</span>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN: FAVORITES
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen==="favorites") return (
    <div style={s.bg}>
      <div style={{maxWidth:600,margin:"0 auto",padding:"36px 20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
          <button onClick={()=>setScreen("welcome")} style={{...s.ghost,padding:"9px 18px",fontSize:13}}>← Back</button>
          <div>
            <h2 style={{fontSize:26,fontWeight:"bold",margin:0,color:"#ffd27d"}}>♥ Saved Recipes</h2>
            <p style={{color:"#9a8070",fontSize:13,margin:"3px 0 0"}}>{favorites.length} recipe{favorites.length!==1?"s":""} saved</p>
          </div>
        </div>

        {favorites.length===0 ? (
          <div style={{...s.card,textAlign:"center",padding:"40px 24px"}}>
            <div style={{fontSize:52,marginBottom:12}}>♡</div>
            <p style={{color:"#9a8070",fontSize:16,margin:"0 0 8px",fontWeight:"bold"}}>No saved recipes yet</p>
            <p style={{color:"#6a5a4a",fontSize:14,margin:0}}>Tap the ♡ heart on any recipe to save it here</p>
          </div>
        ) : (
          <>
            {favorites.map((meal,i)=>(
              <div key={i} style={{...s.card,marginBottom:12,display:"flex",alignItems:"flex-start",gap:14,transition:"all 0.18s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,210,125,0.09)"}
                onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
              >
                <div style={{flex:1,cursor:"pointer"}} onClick={()=>setSelectedMeal(meal)}>
                  <div style={{fontWeight:"bold",fontSize:17,color:"#ffd27d",marginBottom:3}}>{meal.emoji} {meal.name}</div>
                  <div style={{fontSize:12,color:"#9a8070",marginBottom:4}}>
                    ⏱ {meal.time} · {meal.difficulty} · 🍽️ {meal.servings} serving{meal.servings!==1?"s":""}
                    {meal.savedAt&&<span style={{color:"#6a5a4a"}}> · Saved {meal.savedAt}</span>}
                  </div>
                  <div style={{fontSize:13,color:"#c9b99a",lineHeight:1.5}}>{meal.description}</div>
                  <div style={{fontSize:12,color:"#6a5a4a",marginTop:5}}>Tap for full recipe →</div>
                </div>
                <button
                  onClick={()=>toggleFavorite(meal)}
                  style={{background:"none",border:"none",cursor:"pointer",fontSize:22,lineHeight:1,padding:"4px",flexShrink:0,color:"#ff7099"}}
                  title="Remove from favorites"
                >♥</button>
              </div>
            ))}
            <div style={{textAlign:"center",marginTop:8}}>
              <button
                onClick={async()=>{setFavorites([]);try{localStorage.setItem("mealmuse-favorites","[]");}catch(e){}}}
                style={{background:"none",border:"none",color:"#6a5a4a",cursor:"pointer",fontSize:13,textDecoration:"underline"}}
              >Clear all saved recipes</button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN: DIET + ALLERGIES
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen==="diet") return (
    <div style={s.bg}>
      <div style={{maxWidth:560,margin:"0 auto",padding:"40px 20px"}}>
        <div style={{textAlign:"center",marginBottom:22}}>
          <p style={{color:"#ffd27d",fontSize:11,letterSpacing:2.5,textTransform:"uppercase",marginBottom:6}}>Step 1 of 2</p>
          <h2 style={{fontSize:26,fontWeight:"bold",margin:0}}>Dietary preferences & allergies</h2>
          <p style={{color:"#a09080",marginTop:8}}>Used to filter TheMealDB results</p>
        </div>
        <p style={s.lbl}>🥗 Diet Style</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:22}}>
          {DIETS.map(diet=>{const on=selectedDiet?.id===diet.id;return(
            <div key={diet.id} onClick={()=>setSelectedDiet(diet)} style={{...s.card,cursor:"pointer",padding:"11px 13px",border:on?"2px solid #ffd27d":"1px solid rgba(255,200,100,0.15)",background:on?"rgba(255,210,125,0.12)":"rgba(255,255,255,0.04)",display:"flex",alignItems:"center",gap:11,transition:"all 0.18s"}}>
              <span style={{fontSize:22}}>{diet.emoji}</span>
              <div><div style={{fontWeight:"bold",fontSize:13,color:on?"#ffd27d":"#f0e6d3"}}>{diet.label}</div><div style={{fontSize:11,color:"#9a8870"}}>{diet.desc}</div></div>
            </div>
          );})}
        </div>
        <p style={s.lbl}>⚠️ Food Allergies to Exclude</p>
        <p style={{color:"#9a8070",fontSize:13,marginBottom:10,marginTop:-6}}>We'll filter out any recipes containing these</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          {ALLERGIES.map(al=>{const on=selectedAllergies.some(a=>a.id===al.id);return(
            <div key={al.id} onClick={()=>setSelectedAllergies(prev=>on?prev.filter(a=>a.id!==al.id):[...prev,al])} style={{...s.card,cursor:"pointer",padding:"9px 12px",border:on?"2px solid #ff7070":"1px solid rgba(255,100,100,0.15)",background:on?"rgba(255,80,80,0.12)":"rgba(255,255,255,0.03)",display:"flex",alignItems:"center",gap:9,transition:"all 0.18s"}}>
              <div style={{width:17,height:17,borderRadius:4,flexShrink:0,border:on?"none":"2px solid rgba(255,100,100,0.35)",background:on?"linear-gradient(135deg,#ff7070,#ff4040)":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {on&&<span style={{color:"#fff",fontSize:10,fontWeight:"bold"}}>✓</span>}
              </div>
              <span style={{fontSize:17}}>{al.emoji}</span>
              <div><div style={{fontWeight:"bold",fontSize:12,color:on?"#ff9090":"#f0e6d3"}}>{al.label}</div><div style={{fontSize:11,color:"#7a6a5a"}}>{al.desc}</div></div>
            </div>
          );})}
        </div>
        {selectedAllergies.length>0&&<div style={{marginBottom:14,padding:"8px 14px",borderRadius:10,background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,100,100,0.2)",fontSize:13,color:"#ff9090"}}>⚠️ Excluding: {selectedAllergies.map(a=>a.label).join(", ")}</div>}
        <div style={{display:"flex",gap:12,marginTop:8}}>
          <button onClick={()=>setScreen("welcome")} style={{...s.ghost,flex:1,padding:"12px",fontSize:14}}>← Back</button>
          <button onClick={()=>selectedDiet&&setScreen("mood")} disabled={!selectedDiet} style={{...s.gold,flex:2,padding:"13px",fontSize:15,opacity:selectedDiet?1:0.35,cursor:selectedDiet?"pointer":"not-allowed"}}>Next →</button>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN: MOOD + SERVINGS
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen==="mood") return (
    <div style={s.bg}>
      <div style={{maxWidth:500,margin:"0 auto",padding:"40px 20px"}}>
        <div style={{textAlign:"center",marginBottom:22}}>
          <p style={{color:"#ffd27d",fontSize:11,letterSpacing:2.5,textTransform:"uppercase",marginBottom:6}}>Step 2 of 2</p>
          <h2 style={{fontSize:26,fontWeight:"bold",margin:0}}>Servings{planMode!=="week"?" & mood":""}</h2>
          <p style={{color:"#a09080",marginTop:8}}>How many people are you cooking for?</p>
        </div>
        {planMode!=="week"&&<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
          {MOODS.map(mood=>{const on=selectedMood?.id===mood.id;return(
            <div key={mood.id} onClick={()=>setSelectedMood(on?null:mood)} style={{...s.card,cursor:"pointer",padding:"12px 16px",border:on?"2px solid #ffd27d":"1px solid rgba(255,200,100,0.15)",background:on?"rgba(255,210,125,0.12)":"rgba(255,255,255,0.04)",display:"flex",alignItems:"center",gap:11,fontSize:15,color:on?"#ffd27d":"#f0e6d3",fontWeight:on?"bold":"normal",transition:"all 0.18s"}}>
              <span>{mood.emoji}</span>{mood.label}
            </div>
          );})}
        </div>}
        <div style={{...s.card,marginBottom:14}}>
          <p style={s.lbl}>🍽️ Servings per meal</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {SERVINGS_OPTIONS.map(n=>(
              <button key={n} onClick={()=>setServings(n)} style={{padding:"7px 15px",borderRadius:30,fontSize:14,cursor:"pointer",border:servings===n?"2px solid #ffd27d":"1px solid rgba(255,200,100,0.2)",background:servings===n?"rgba(255,210,125,0.15)":"transparent",color:servings===n?"#ffd27d":"#c9b99a",fontWeight:servings===n?"bold":"normal",transition:"all 0.18s",fontFamily:"'Georgia',serif"}}>
                {n} {n===1?"person":"people"}
              </button>
            ))}
          </div>
        </div>
        {error&&<p style={{color:"#ff9090",textAlign:"center",marginBottom:12,fontSize:14}}>⚠️ {error}</p>}
        {loading&&<p style={{color:"#ffd27d",textAlign:"center",marginBottom:12,fontSize:14}}>{loadingMsg}</p>}
        <div style={{display:"flex",gap:12}}>
          <button onClick={()=>setScreen("diet")} style={{...s.ghost,flex:1,padding:"13px",fontSize:14}}>← Back</button>
          <button onClick={planMode==="week"?fetchWeekPlan:fetchSingleMeals} disabled={loading} style={{...s.gold,flex:2,padding:"13px",fontSize:15,opacity:loading?0.5:1,cursor:loading?"not-allowed":"pointer"}}>
            {loading?loadingMsg:(planMode==="week"?"Plan My Week! 📅":"Find Recipes! 🍽️")}
          </button>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN: PANTRY
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen==="pantry") {
    const SUGGESTIONS=["Chicken","Beef","Eggs","Pasta","Rice","Tomatoes","Onion","Garlic","Potatoes","Carrots","Broccoli","Spinach","Cheese","Salmon","Shrimp","Bacon","Lentils","Mushrooms","Zucchini","Avocado"];
    function addItem(val){const t=val.trim();if(t&&!pantryItems.includes(t))setPantryItems(prev=>[...prev,t]);setPantryInput("");}
    return (
      <div style={s.bg}>
        <div style={{maxWidth:540,margin:"0 auto",padding:"40px 20px"}}>
          <div style={{textAlign:"center",marginBottom:22}}>
            <div style={{fontSize:48,marginBottom:8}}>🧑‍🍳</div>
            <h2 style={{fontSize:26,fontWeight:"bold",margin:0,color:"#ffd27d"}}>What's in your fridge?</h2>
            <p style={{color:"#a09080",marginTop:8,fontSize:14,lineHeight:1.6}}>I'll search TheMealDB for recipes using your ingredients.</p>
          </div>
          <div style={{...s.card,marginBottom:14,padding:"14px 16px"}}>
            <p style={s.lbl}>🥕 Your Ingredients</p>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <input value={pantryInput} onChange={e=>setPantryInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();addItem(pantryInput);}}}
                placeholder="Type an ingredient and press Enter…"
                style={{flex:1,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,200,100,0.25)",borderRadius:10,padding:"10px 14px",fontSize:14,color:"#f0e6d3",outline:"none",fontFamily:"Georgia,serif"}}/>
              <button onClick={()=>addItem(pantryInput)} style={{...s.gold,padding:"10px 16px",fontSize:14}}>Add</button>
            </div>
            {pantryItems.length>0?(
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {pantryItems.map((item,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,210,125,0.14)",border:"1px solid rgba(255,210,125,0.3)",borderRadius:20,padding:"4px 11px",fontSize:13,color:"#ffd27d"}}>
                    {item}<span onClick={()=>setPantryItems(prev=>prev.filter((_,j)=>j!==i))} style={{cursor:"pointer",color:"#ff8070",fontWeight:"bold",fontSize:14,lineHeight:1}}>×</span>
                  </div>
                ))}
                <button onClick={()=>setPantryItems([])} style={{background:"none",border:"1px solid rgba(255,100,100,0.25)",borderRadius:20,padding:"4px 11px",fontSize:12,color:"#9a7070",cursor:"pointer"}}>Clear all</button>
              </div>
            ):<p style={{color:"#6a5a4a",fontSize:13,margin:0,fontStyle:"italic"}}>No ingredients yet — try quick-add below</p>}
          </div>
          <div style={{...s.card,marginBottom:14}}>
            <p style={s.lbl}>⚡ Quick Add</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {SUGGESTIONS.filter(s=>!pantryItems.includes(s)).map(sug=>(
                <button key={sug} onClick={()=>setPantryItems(prev=>[...prev,sug])} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,200,100,0.18)",borderRadius:20,padding:"5px 12px",fontSize:13,color:"#c9b99a",cursor:"pointer",fontFamily:"Georgia,serif"}}>+ {sug}</button>
              ))}
            </div>
          </div>
          <div style={{...s.card,marginBottom:14}}>
            <p style={s.lbl}>🍽️ Servings</p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {SERVINGS_OPTIONS.map(n=>(
                <button key={n} onClick={()=>setServings(n)} style={{padding:"7px 15px",borderRadius:30,fontSize:14,cursor:"pointer",border:servings===n?"2px solid #ffd27d":"1px solid rgba(255,200,100,0.2)",background:servings===n?"rgba(255,210,125,0.15)":"transparent",color:servings===n?"#ffd27d":"#c9b99a",fontWeight:servings===n?"bold":"normal",transition:"all 0.18s",fontFamily:"'Georgia',serif"}}>
                  {n} {n===1?"person":"people"}
                </button>
              ))}
            </div>
          </div>
          {error&&<p style={{color:"#ff9090",textAlign:"center",marginBottom:12,fontSize:14}}>⚠️ {error}</p>}
          {loading&&<p style={{color:"#ffd27d",textAlign:"center",marginBottom:12,fontSize:14}}>{loadingMsg}</p>}
          <div style={{display:"flex",gap:12}}>
            <button onClick={()=>setScreen("welcome")} style={{...s.ghost,flex:1,padding:"12px",fontSize:14}}>← Back</button>
            <button onClick={fetchPantryMeals} disabled={loading||pantryItems.length<1} style={{...s.gold,flex:2,padding:"13px",fontSize:15,opacity:(loading||pantryItems.length<1)?0.45:1,cursor:(loading||pantryItems.length<1)?"not-allowed":"pointer"}}>
              {loading?loadingMsg:"Cook What I Have! 🥕"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN: SINGLE RESULT
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen==="single-result"&&!selectedMeal) return (
    <div style={s.bg}>
      <div style={{maxWidth:600,margin:"0 auto",padding:"36px 20px"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <p style={{...s.lbl,textAlign:"center"}}>Tonight's Options</p>
          <h2 style={{fontSize:27,fontWeight:"bold",margin:"0 0 4px"}}>Real Recipes 🌟</h2>
          <p style={{color:"#9a8070",fontSize:14}}>{selectedDiet?.label} · {servings} serving{servings!==1?"s":""} · from TheMealDB</p>
        </div>
        {meals?.map((meal,i)=>(
          <div key={i} style={{...s.card,marginBottom:12,display:"flex",alignItems:"flex-start",gap:14,transition:"all 0.18s"}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,210,125,0.09)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
          >
            {meal.thumb&&<img src={meal.thumb} alt={meal.name} style={{width:80,height:80,borderRadius:10,objectFit:"cover",flexShrink:0}}/>}
            <div style={{flex:1,cursor:"pointer"}} onClick={()=>setSelectedMeal(meal)}>
              <div style={{fontWeight:"bold",fontSize:17,color:"#ffd27d",marginBottom:3}}>{meal.emoji} {meal.name}</div>
              <div style={{fontSize:12,color:"#9a8070",marginBottom:4}}>{meal.area||""} {meal.category} · {meal.rating}</div>
              <div style={{fontSize:13,color:"#c9b99a",lineHeight:1.5}}>{meal.description}</div>
              <div style={{fontSize:12,color:"#6a5a4a",marginTop:5}}>Tap for full recipe →</div>
            </div>
            <button
              onClick={e=>{e.stopPropagation();toggleFavorite(meal);}}
              style={{background:"none",border:"none",cursor:"pointer",fontSize:22,lineHeight:1,padding:"4px",flexShrink:0,color:isFav(meal)?"#ff7099":"#5a4a5a",transition:"all 0.2s"}}
              title={isFav(meal)?"Remove from favorites":"Save to favorites"}
            >{isFav(meal)?"♥":"♡"}</button>
          </div>
        ))}
        <div style={{display:"flex",gap:12,marginTop:10}}>
          <button onClick={()=>setScreen(planMode==="pantry"?"pantry":"mood")} style={{...s.ghost,flex:1,padding:"12px",fontSize:14}}>← Adjust</button>
          <button onClick={planMode==="pantry"?fetchPantryMeals:fetchSingleMeals} disabled={loading} style={{...s.gold,flex:1,padding:"12px",fontSize:14,opacity:loading?0.5:1}}>
            {loading?loadingMsg:"🔄 New Recipes"}
          </button>
        </div>
        <div style={{textAlign:"center",marginTop:14}}>
          <button onClick={resetAll} style={{background:"none",border:"none",color:"#6a5a4a",cursor:"pointer",fontSize:13,textDecoration:"underline"}}>Start over</button>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RECIPE DETAIL
  // ─────────────────────────────────────────────────────────────────────────────
  if (selectedMeal) return wrap(
    <RecipeDetail meal={selectedMeal} onBack={()=>setSelectedMeal(null)}
      backLabel={screen==="week-result"?"← Back to Plan":"← Back to Options"}
      extraActions={
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={()=>setSelectedMeal(null)} style={{...s.ghost,flex:1,padding:"12px",fontSize:14}}>← Back</button>
          <button
            onClick={()=>toggleFavorite(selectedMeal)}
            style={{
              flex:1, padding:"12px", fontSize:14, borderRadius:50, cursor:"pointer",
              fontFamily:"'Georgia',serif", fontWeight:"bold", transition:"all 0.2s",
              background: isFav(selectedMeal) ? "rgba(255,80,120,0.18)" : "rgba(255,255,255,0.06)",
              border: isFav(selectedMeal) ? "1px solid rgba(255,100,140,0.5)" : "1px solid rgba(255,255,255,0.12)",
              color: isFav(selectedMeal) ? "#ff7099" : "#a09080",
            }}
          >{isFav(selectedMeal) ? "♥ Saved!" : "♡ Save Recipe"}</button>
          {screen==="week-result"&&<button onClick={()=>{setSelectedMeal(null);setShowShopping(true);}} style={{...s.gold,flex:1,padding:"12px",fontSize:14}}>🛒 Shopping List</button>}
        </div>
      }
    />
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN: SHOPPING LIST
  // ─────────────────────────────────────────────────────────────────────────────
  if (showShopping) {
    const list = buildShoppingList();
    const activeDays = weekPlan?weekPlan.filter((_,i)=>!excludedDays.has(i)).length:0;
    const displayList = {};
    Object.entries(list).forEach(([cat,items])=>{
      const visible=items.filter((_,i)=>!removedKeys.has(`${cat}-${i}`));
      if(visible.length) displayList[cat]=visible.map((item,newI)=>({...item,_origKey:`${cat}-${items.indexOf(item)}`,_dispKey:`${cat}-disp-${newI}`}));
    });
    const displayTotal=Object.values(displayList).flat().length;
    const displayChecked=Object.values(displayList).flat().filter(item=>checkedItems[item._origKey]).length;
    const displayNeeded=displayTotal-displayChecked;

    function updateList(){
      const newRemoved=new Set(removedKeys);
      Object.entries(checkedItems).forEach(([k,v])=>{if(v)newRemoved.add(k);});
      setRemovedKeys(newRemoved); setCheckedItems({});
    }
    function buildPlainText(){
      const lines=["🛒 Shopping List — MealMuse",`${activeDays} dinners · ${servings} serving${servings!==1?"s":""} each`,""];
      Object.entries(displayList).forEach(([cat,items])=>{
        const unc=items.filter(item=>!checkedItems[item._origKey]);
        if(!unc.length)return;
        lines.push(`── ${cat} ──`);
        unc.forEach(item=>lines.push(`  • ${item.label}${item.total?` (${item.total} total)`:""}`));
        lines.push("");
      });
      return lines.join("\n");
    }
    function handlePrint(){
      const win=window.open("","_blank");
      win.document.write(`<html><head><title>Shopping List · MealMuse</title><style>body{font-family:Georgia,serif;max-width:480px;margin:40px auto;color:#222;line-height:1.7}h1{font-size:22px}h2{font-size:14px;font-weight:normal;color:#888;margin-top:0}.cat{font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:11px;color:#666;margin:16px 0 5px;border-bottom:1px solid #eee;padding-bottom:3px}.item{padding:3px 0 3px 14px;font-size:15px}.total{color:#888;font-style:italic;font-size:13px;margin-left:6px}.footer{margin-top:28px;font-size:11px;color:#aaa}</style></head><body><h1>🛒 Shopping List</h1><h2>MealMuse · ${activeDays} dinners · ${servings} serving${servings!==1?"s":""} each</h2>${Object.entries(displayList).map(([cat,items])=>{const u=items.filter(item=>!checkedItems[item._origKey]);if(!u.length)return"";return`<div class="cat">${cat}</div>${u.map(item=>`<div class="item">☐ ${item.label}${item.total?`<span class="total">(${item.total} total)</span>`:""}</div>`).join("")}`;}).join("")}<div class="footer">Generated by MealMuse 🌙</div></body></html>`);
      win.document.close(); win.focus(); setTimeout(()=>win.print(),400);
    }
    function handleEmail(){window.open(`mailto:?subject=${encodeURIComponent("🛒 Shopping List · MealMuse")}&body=${encodeURIComponent(buildPlainText())}`);}
    function handleText(){window.open(`sms:?body=${encodeURIComponent(buildPlainText())}`);}

    return wrap(<>
      <button onClick={()=>setShowShopping(false)} style={{...s.ghost,padding:"9px 20px",fontSize:13,marginBottom:18}}>← Back to Plan</button>
      <div style={{textAlign:"center",marginBottom:18}}>
        <p style={{...s.lbl,textAlign:"center"}}>Weekly Meal Plan</p>
        <h2 style={{fontSize:27,fontWeight:"bold",margin:"0 0 5px"}}>🛒 Shopping List</h2>
        <p style={{color:"#9a8070",fontSize:14}}>{activeDays} dinners · {servings} serving{servings!==1?"s":""} each</p>
        {displayTotal>0&&<div style={{marginTop:12}}>
          <div style={{...s.card,padding:"13px 18px",display:"inline-block",minWidth:230}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:7,fontSize:13}}><span style={{color:"#9a8070"}}>Items checked</span><span><span style={{color:"#ffd27d",fontWeight:"bold"}}>{displayChecked}</span><span style={{color:"#6a5a4a"}}> / {displayTotal}</span></span></div>
            <div style={{background:"rgba(255,255,255,0.08)",borderRadius:10,height:8,overflow:"hidden"}}><div style={{height:"100%",borderRadius:10,transition:"width 0.4s ease",background:"linear-gradient(90deg,#ffd27d,#ff8c42)",width:`${displayTotal>0?(displayChecked/displayTotal)*100:0}%`}}/></div>
            {displayNeeded>0?<p style={{margin:"7px 0 0",fontSize:13,color:"#c9b99a"}}>🛍️ <strong style={{color:"#ffd27d"}}>{displayNeeded}</strong> item{displayNeeded!==1?"s":""} still needed</p>:<p style={{margin:"7px 0 0",fontSize:13,color:"#90c090"}}>✅ All items accounted for!</p>}
          </div>
        </div>}
      </div>

      {displayChecked>0&&<div style={{...s.card,marginBottom:14,padding:"13px 16px",background:"rgba(100,200,100,0.08)",border:"1px solid rgba(100,220,100,0.25)",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:150}}><p style={{margin:0,fontWeight:"bold",color:"#90d090",fontSize:14}}>✅ {displayChecked} item{displayChecked!==1?"s":""} already have</p><p style={{margin:"3px 0 0",fontSize:12,color:"#6a8a6a"}}>Click "Update List" to remove them</p></div>
        <button onClick={updateList} style={{background:"linear-gradient(135deg,#5ab85a,#3a943a)",border:"none",borderRadius:50,padding:"9px 20px",fontWeight:"bold",color:"#fff",cursor:"pointer",fontFamily:"'Georgia',serif",fontSize:14,flexShrink:0}}>🔄 Update List</button>
      </div>}

      {Object.entries(displayList).map(([cat,items])=>(
        <div key={cat} style={{...s.card,marginBottom:10}}>
          <p style={{...s.lbl,marginBottom:10}}>{CAT_EMOJI[cat]||"🛒"} {cat}</p>
          {items.map(item=>{const done=checkedItems[item._origKey];return(
            <div key={item._origKey} onClick={()=>setCheckedItems(prev=>({...prev,[item._origKey]:!prev[item._origKey]}))} style={{display:"flex",alignItems:"center",gap:11,padding:"7px 0",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
              <div style={{width:19,height:19,borderRadius:5,flexShrink:0,border:done?"none":"2px solid rgba(255,200,100,0.4)",background:done?"linear-gradient(135deg,#ffd27d,#ff8c42)":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {done&&<span style={{color:"#1a0a2e",fontSize:11,fontWeight:"bold"}}>✓</span>}
              </div>
              <span style={{flex:1,fontSize:14,lineHeight:1.4,color:done?"#6a5a4a":"#d0c0a8",textDecoration:done?"line-through":"none"}}>{item.label}</span>
              {item.total&&<span style={{fontSize:12,color:done?"#5a4a3a":"#ffd27d",fontStyle:"italic",flexShrink:0,opacity:done?0.5:1}}>({item.total} total)</span>}
            </div>
          );})}
        </div>
      ))}

      {Object.keys(displayList).length===0&&<div style={{...s.card,textAlign:"center",padding:"28px 20px",marginBottom:14}}>
        <div style={{fontSize:44,marginBottom:8}}>🎉</div>
        <p style={{color:"#90d090",fontWeight:"bold",fontSize:15,margin:"0 0 5px"}}>You have everything!</p>
        <p style={{color:"#6a8a6a",fontSize:13,margin:0}}>All ingredients accounted for. Time to cook!</p>
      </div>}

      <div style={{...s.card,marginBottom:12,padding:"13px 16px",background:"rgba(255,255,255,0.03)"}}>
        <p style={{...s.lbl,marginBottom:10}}>📤 Share or Print</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={handlePrint} style={{flex:1,minWidth:80,padding:"9px 8px",borderRadius:30,cursor:"pointer",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.18)",color:"#f0e6d3",fontFamily:"'Georgia',serif",fontSize:14,fontWeight:"bold"}}>🖨️ Print</button>
          <button onClick={handleEmail} style={{flex:1,minWidth:80,padding:"9px 8px",borderRadius:30,cursor:"pointer",background:"rgba(100,160,255,0.1)",border:"1px solid rgba(100,160,255,0.3)",color:"#a0c0ff",fontFamily:"'Georgia',serif",fontSize:14,fontWeight:"bold"}}>✉️ Email</button>
          <button onClick={handleText} style={{flex:1,minWidth:80,padding:"9px 8px",borderRadius:30,cursor:"pointer",background:"rgba(100,220,100,0.1)",border:"1px solid rgba(100,220,100,0.3)",color:"#90d090",fontFamily:"'Georgia',serif",fontSize:14,fontWeight:"bold"}}>💬 Text</button>
        </div>
      </div>

      <div style={{display:"flex",gap:12,marginTop:6}}>
        <button onClick={()=>{setCheckedItems({});setRemovedKeys(new Set());}} style={{...s.ghost,flex:1,padding:"12px",fontSize:14}}>↺ Update List</button>
        <button onClick={()=>setShowShopping(false)} style={{...s.gold,flex:1,padding:"12px",fontSize:14}}>📅 Back to Plan</button>
      </div>
      <div style={{textAlign:"center",marginTop:14}}>
        <button onClick={resetAll} style={{background:"none",border:"none",color:"#6a5a4a",cursor:"pointer",fontSize:13,textDecoration:"underline"}}>Start over</button>
      </div>
    </>);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN: WEEK RESULT
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen==="week-result") {
    const activeDays=weekPlan?weekPlan.filter((_,i)=>!excludedDays.has(i)).length:0;
    return (
      <div style={s.bg}>
        <div style={{maxWidth:700,margin:"0 auto",padding:"32px 20px"}}>
          <div style={{textAlign:"center",marginBottom:14}}>
            <p style={{...s.lbl,textAlign:"center"}}>Your Week</p>
            <h2 style={{fontSize:27,fontWeight:"bold",margin:"0 0 4px"}}>Dinner Plan 📅</h2>
            <p style={{color:"#9a8070",fontSize:14}}>
              {selectedDiet?.label} · {servings} serving{servings!==1?"s":""}
              {excludedDays.size>0&&<span style={{color:"#ff9070"}}> · {activeDays} active nights</span>}
            </p>
          </div>

          <div style={{...s.card,background:"rgba(255,210,125,0.06)",border:"1px solid rgba(255,210,125,0.15)",marginBottom:14,padding:"9px 14px",fontSize:13,color:"#a09080",textAlign:"center"}}>
            💡 Click a day to expand · <span style={{color:"#ffd27d"}}>🔄 Swap</span> replaces a recipe · <span style={{color:"#ff9090"}}>✕</span> excludes from plan
          </div>

          <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:14}}>
            {[["calendar","📅 Calendar"],["list","📋 List"]].map(([v,label])=>(
              <button key={v} onClick={()=>setCalView(v)} style={{padding:"7px 20px",borderRadius:30,fontSize:14,cursor:"pointer",border:calView===v?"2px solid #ffd27d":"1px solid rgba(255,200,100,0.2)",background:calView===v?"rgba(255,210,125,0.15)":"transparent",color:calView===v?"#ffd27d":"#9a8070",fontWeight:calView===v?"bold":"normal",fontFamily:"'Georgia',serif",transition:"all 0.18s"}}>{label}</button>
            ))}
          </div>

          {/* CALENDAR VIEW */}
          {calView==="calendar"&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:12}}>
                {weekPlan?.map((meal,i)=>{
                  const active=selectedDay===i,excluded=excludedDays.has(i),swapping=replacingDay===i;
                  return (
                    <div key={i} style={{position:"relative"}}>
                      <div onClick={e=>{e.stopPropagation();toggleExcludeDay(i);}} style={{position:"absolute",top:-6,right:-6,zIndex:10,width:19,height:19,borderRadius:"50%",cursor:"pointer",background:excluded?"rgba(80,80,80,0.75)":"rgba(210,50,50,0.85)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:"bold",color:"#fff"}}>{excluded?"+":"✕"}</div>
                      <div onClick={()=>!excluded&&setSelectedDay(active?null:i)} style={{...s.card,padding:"9px 4px",textAlign:"center",cursor:excluded?"default":"pointer",border:excluded?"1px dashed rgba(255,255,255,0.08)":active?"2px solid #ffd27d":"1px solid rgba(255,200,100,0.15)",background:excluded?"rgba(0,0,0,0.25)":active?"rgba(255,210,125,0.14)":"rgba(255,255,255,0.04)",opacity:excluded?0.4:1,transition:"all 0.18s"}}>
                        <div style={{fontSize:9,color:excluded?"#4a4a4a":active?"#ffd27d":"#9a8070",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{DAY_SHORT[i]}</div>
                        {meal.thumb&&!excluded?<img src={meal.thumb} alt="" style={{width:"100%",height:40,objectFit:"cover",borderRadius:6,marginBottom:4}}/>:<div style={{fontSize:20,marginBottom:3}}>{excluded?"—":swapping?"⏳":meal.emoji}</div>}
                        <div style={{fontSize:9,color:excluded?"#4a4a4a":active?"#ffd27d":"#c9b99a",lineHeight:1.3}}>{excluded?"Skipped":swapping?"Finding…":meal.name}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedDay!==null&&weekPlan&&!excludedDays.has(selectedDay)&&(
                <div style={{...s.card,marginBottom:12,border:"1px solid rgba(255,210,125,0.35)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                    {weekPlan[selectedDay].thumb&&<img src={weekPlan[selectedDay].thumb} alt="" style={{width:60,height:60,borderRadius:8,objectFit:"cover",flexShrink:0}}/>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,color:"#ff8c42",textTransform:"uppercase",letterSpacing:1.5,fontWeight:"bold"}}>{DAYS[selectedDay]}</div>
                      <div style={{fontWeight:"bold",fontSize:17,color:"#ffd27d"}}>{weekPlan[selectedDay].name}</div>
                      <div style={{fontSize:12,color:"#9a8070"}}>{weekPlan[selectedDay].area} · {weekPlan[selectedDay].rating}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <span style={{fontSize:13,color:"#9a8070"}}>Servings:</span>
                    <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.07)",borderRadius:24,padding:"3px 12px",border:"1px solid rgba(255,200,100,0.25)"}}>
                      <button onClick={()=>{const c=daySvc(selectedDay);if(c>1)rescaleDay(selectedDay,c-1);}} disabled={daySvc(selectedDay)<=1||rescalingDay===selectedDay} style={{background:"none",border:"none",color:"#ffd27d",cursor:"pointer",fontSize:18,lineHeight:1,padding:0,opacity:daySvc(selectedDay)<=1?0.3:1}}>−</button>
                      <span style={{fontSize:14,fontWeight:"bold",color:rescalingDay===selectedDay?"#9a8070":"#ffd27d",minWidth:70,textAlign:"center"}}>{rescalingDay===selectedDay?"Scaling…":`${daySvc(selectedDay)} serving${daySvc(selectedDay)!==1?"s":""}`}</span>
                      <button onClick={()=>rescaleDay(selectedDay,daySvc(selectedDay)+1)} disabled={rescalingDay===selectedDay} style={{background:"none",border:"none",color:"#ffd27d",cursor:"pointer",fontSize:18,lineHeight:1,padding:0}}>+</button>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setSelectedMeal(weekPlan[selectedDay])} style={{...s.gold,flex:2,padding:"9px",fontSize:13}}>📖 Full Recipe</button>
                    <button onClick={()=>replaceDay(selectedDay)} disabled={replacingDay!==null} style={{...s.ghost,flex:1,padding:"9px",fontSize:12,opacity:replacingDay!==null?0.4:1}}>{replacingDay===selectedDay?"⏳":"🔄 Swap"}</button>
                    <button onClick={()=>toggleExcludeDay(selectedDay)} style={{flex:1,padding:"9px",fontSize:12,borderRadius:50,cursor:"pointer",background:"rgba(210,50,50,0.1)",border:"1px solid rgba(210,50,50,0.3)",color:"#ff9090",fontFamily:"'Georgia',serif"}}>✕ Exclude</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LIST VIEW */}
          {calView==="list"&&(
            <div>
              {weekPlan?.map((meal,i)=>{
                const excluded=excludedDays.has(i),swapping=replacingDay===i;
                return (
                  <div key={i} style={{...s.card,marginBottom:9,display:"flex",alignItems:"center",gap:11,opacity:excluded?0.4:1,border:excluded?"1px dashed rgba(255,255,255,0.08)":"1px solid rgba(255,200,100,0.18)",background:excluded?"rgba(0,0,0,0.18)":"rgba(255,255,255,0.05)",transition:"all 0.18s"}}>
                    {meal.thumb&&!excluded?<img src={meal.thumb} alt="" style={{width:54,height:54,borderRadius:8,objectFit:"cover",flexShrink:0}}/>:
                    <div style={{textAlign:"center",minWidth:36,flexShrink:0}}>
                      <div style={{fontSize:9,color:excluded?"#4a4a4a":"#ff8c42",textTransform:"uppercase",letterSpacing:1,fontWeight:"bold"}}>{DAY_SHORT[i]}</div>
                      <div style={{fontSize:26,lineHeight:1.2}}>{excluded?"—":swapping?"⏳":meal.emoji}</div>
                    </div>}
                    <div style={{flex:1,minWidth:0,cursor:excluded||swapping?"default":"pointer"}} onClick={()=>!excluded&&!swapping&&setSelectedMeal(meal)}>
                      {excluded?<div style={{fontSize:13,color:"#4a4a4a",fontStyle:"italic"}}>Night excluded from plan</div>
                      :swapping?<div style={{fontSize:13,color:"#9a8070"}}>Finding a new recipe…</div>
                      :<>
                        <div style={{fontWeight:"bold",fontSize:15,color:"#ffd27d"}}>{meal.name}</div>
                        <div style={{fontSize:12,color:"#9a8070",margin:"2px 0 0"}}>🍽️ {daySvc(i)} serving{daySvc(i)!==1?"s":""} · {meal.rating}</div>
                      </>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0,alignItems:"flex-end"}}>
                      {!excluded&&!swapping&&(
                        <div style={{display:"flex",alignItems:"center",gap:3,background:"rgba(255,255,255,0.06)",borderRadius:20,padding:"2px 8px",border:"1px solid rgba(255,200,100,0.2)"}}>
                          <button onClick={e=>{e.stopPropagation();const c=daySvc(i);if(c>1)rescaleDay(i,c-1);}} disabled={daySvc(i)<=1||rescalingDay===i} style={{background:"none",border:"none",color:"#ffd27d",cursor:daySvc(i)<=1?"not-allowed":"pointer",fontSize:15,lineHeight:1,padding:"0 1px",opacity:daySvc(i)<=1?0.3:1}}>−</button>
                          <span style={{fontSize:11,color:rescalingDay===i?"#9a8070":"#ffd27d",minWidth:26,textAlign:"center",fontWeight:"bold"}}>{rescalingDay===i?"…":`${daySvc(i)} srv`}</span>
                          <button onClick={e=>{e.stopPropagation();rescaleDay(i,daySvc(i)+1);}} disabled={rescalingDay===i} style={{background:"none",border:"none",color:"#ffd27d",cursor:rescalingDay===i?"not-allowed":"pointer",fontSize:15,lineHeight:1,padding:"0 1px"}}>+</button>
                        </div>
                      )}
                      {!excluded&&<button onClick={()=>replaceDay(i)} disabled={replacingDay!==null} style={{...s.ghost,padding:"4px 10px",fontSize:11,borderRadius:20,opacity:replacingDay!==null?0.4:1}}>🔄 Swap</button>}
                      <button onClick={()=>toggleExcludeDay(i)} style={{padding:"4px 10px",fontSize:11,borderRadius:20,cursor:"pointer",background:excluded?"rgba(255,255,255,0.06)":"rgba(210,50,50,0.1)",border:excluded?"1px solid rgba(255,255,255,0.12)":"1px solid rgba(210,50,50,0.3)",color:excluded?"#9a8070":"#ff9090",fontFamily:"'Georgia',serif",transition:"all 0.18s"}}>{excluded?"+ Include":"✕ Exclude"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {excludedDays.size>0&&<div style={{...s.card,background:"rgba(210,50,50,0.06)",border:"1px solid rgba(210,50,50,0.2)",marginTop:4,padding:"9px 14px",fontSize:13,display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:"#ff9090",flex:1}}>✕ Excluded: {[...excludedDays].sort().map(i=>DAYS[i]).join(", ")}</span>
            <button onClick={()=>setExcludedDays(new Set())} style={{background:"none",border:"none",color:"#9a8070",cursor:"pointer",fontSize:12,textDecoration:"underline"}}>clear all</button>
          </div>}

          <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>
            <button onClick={()=>setShowShopping(true)} style={{...s.gold,flex:1,padding:"12px",fontSize:14}}>🛒 Shopping List</button>
            <button onClick={fetchWeekPlan} disabled={!!loading} style={{...s.ghost,flex:1,padding:"12px",fontSize:14,opacity:loading?0.5:1}}>{loading?loadingMsg:"🔄 Regenerate"}</button>
          </div>
          <div style={{display:"flex",gap:10,marginTop:9}}>
            <button onClick={()=>setScreen("mood")} style={{...s.ghost,flex:1,padding:"11px",fontSize:13}}>← Adjust</button>
            <button onClick={resetAll} style={{...s.ghost,flex:1,padding:"11px",fontSize:13}}>🏠 Start Over</button>
          </div>
        </div>
      </div>
    );
  }
}
