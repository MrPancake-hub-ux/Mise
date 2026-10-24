/* Mise AI: server calls, voice input, coach chat and the actions the coach can perform. */
const API="/api/ai";
let NEWS=false,AI_UP=null,aiBusy=0,busy=0,U=[],navT=null,pend=null,lastModel="",aiStat="";
const chatUsed=()=>{const c=Date.now()-36e5;S.use.chat=S.use.chat.filter(t=>t>c);return S.use.chat.length},chatLeft=()=>Math.max(0,tier().chat-chatUsed()),resetMin=()=>S.use.chat.length?Math.max(1,Math.ceil((S.use.chat[0]+36e5-Date.now())/6e4)):0;
const aiOK=()=>AI_UP!==false;
const aiLine=()=>aiOK()?chatUsed()+"/"+tier().chat+" AI chats used this hour"+(chatUsed()?" (resets in "+resetMin()+" min)":"")+".":"The AI assistant isn’t reachable right now.";
const R2=m=>({kcal:R(m.k),protein:R(m.p),carbs:R(m.c),fat:R(m.f)}),pj=t=>{const m=String(t).match(/\{[\s\S]*\}/);return JSON.parse(m?m[0]:t)};
const bookList=()=>MEALS.map((m,i)=>{const s_=scaled(m);return s_?i+"|"+m[0]+"|"+TY[m[1]]+"|"+R(s_.m.k)+" kcal|P"+R(s_.m.p):null}).filter(Boolean).join("\n");
async function probeAI(){try{const r=await fetch(API);if(!r.ok){AI_UP=false;return}const h=await r.json();AI_UP=!!(h&&h.ok&&h.keyConfigured!==false);NEWS=!!(h&&h.newsletter)}catch(e){AI_UP=location.protocol=="file:"?false:null}}
function aiErrMsg(e){const m=String(e&&e.message||e),k=e&&e.kind;if(/Failed to fetch|NetworkError|Load failed/i.test(m))return"I couldn’t reach the AI service. Check your internet connection.";if(k=="limit"||k=="empty")return m;if(k=="rate"||(e&&e.status==429))return"The AI is busy right now because its provider is limiting requests. Wait about a minute and try again.";if(k=="key"||(e&&(e.status==401||e.status==403)))return"The AI key was rejected or is missing on the server. Check the GEMINI_API_KEY secret in Cloudflare.";if(k=="model")return"No usable AI model was found. Set a MODEL variable on the server (see the guide).";return"The AI had a problem: "+m.slice(0,160)}
async function aiCall(text,img,json){const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,img:img||null,json:!!json,fast:!img,uid:S.id})}),j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||"HTTP "+r.status);e.status=r.status;e.kind=j.kind;throw e}lastModel=j.model||"";return j.text}
async function aiStream(text,onText){const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,stream:true,fast:true,uid:S.id})});
 if(!r.ok){let j={};try{j=await r.json()}catch(e){}const e=new Error(j.error||"HTTP "+r.status);e.status=r.status;e.kind=j.kind;throw e}
 if(!r.body||!r.body.getReader){const t=await r.text();onText(t);return t}
 const rd=r.body.getReader(),dc=new TextDecoder();let acc="";for(;;){const{done,value}=await rd.read();if(done)break;acc+=dc.decode(value,{stream:true});onText(acc)}acc+=dc.decode();onText(acc);return acc}

/* ---------- voice (Web Speech API; works in Chrome, Edge and Safari) ---------- */
const SR=typeof window!="undefined"&&(window.SpeechRecognition||window.webkitSpeechRecognition);
let REC=null,RECID="";
const SENDERS={cq:()=>say(),aq:()=>aiFind(),pai:()=>prepAI(),pq:()=>psay()};
function voiceStart(id,send){if(!SR)return toast("Voice input isn’t supported in this browser. Try Chrome, Edge or Safari.");
 if(REC){const same=RECID==id;try{REC.stop()}catch(e){}if(same)return}
 const el=$(id);if(!el)return;const base=el.value?el.value.trim()+" ":"";
 const r=new SR();r.lang=navigator.language||"en-AU";r.interimResults=true;r.continuous=false;REC=r;RECID=id;
 const mic=$("mic_"+id);if(mic)mic.classList.add("rec");
 if(id=="alt"){AL.listening=1;AL.text=el.value;repaintModal()}if(id=="dyt"){DY.listening=1;DY.text=el.value;repaintModal()}
 let fin="";
 r.onresult=e=>{let t="";for(let i=0;i<e.results.length;i++){t+=e.results[i][0].transcript;if(e.results[i].isFinal)fin=t}const el2=$(id);if(el2)el2.value=base+t;if(id=="alt")AL.text=base+t;if(id=="dyt")DY.text=base+t};
 r.onerror=e=>{if(e.error=="not-allowed"||e.error=="service-not-allowed")toast("Microphone permission was blocked. Allow it in your browser settings.");else if(e.error!="no-speech"&&e.error!="aborted")toast("Voice input stopped: "+e.error)};
 r.onend=()=>{const m=$("mic_"+id);if(m)m.classList.remove("rec");const had=(($(id)||{}).value||"").trim();REC=null;RECID="";if(id=="alt"){AL.listening=0;AL.text=($("alt")||{}).value||AL.text;repaintModal();if(AL.text.trim()&&aiOK())alGo();return}if(id=="dyt"){DY.listening=0;DY.text=($("dyt")||{}).value||DY.text;repaintModal();if(DY.text.trim()&&aiOK())dayGo();return}if(send&&had&&SENDERS[id])SENDERS[id]()};
 try{r.start();toast("Listening… speak now","","mic")}catch(e){REC=null}}
function speak(t){if(!S.speak||!("speechSynthesis" in window))return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(t).replace(/\*\*/g,"").replace(/[-•]\s/g,"").slice(0,600));u.lang=navigator.language||"en-AU";speechSynthesis.speak(u)}catch(e){}}

/* ---------- formatting ---------- */
function fmt(t){const inl=x=>esc(x).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>");let h="",mode="";const close=()=>{if(mode){h+="</"+mode+">";mode=""}};
 for(const ln of String(t).split("\n")){let m;if(m=ln.match(/^\s*[-•]\s+(.*)$/)){if(mode!="ul"){close();h+="<ul>";mode="ul"}h+="<li>"+inl(m[1])+"</li>"}else if(m=ln.match(/^\s*(\d+)\.\s+(.*)$/)){if(mode!="ol"){close();h+='<ol start="'+m[1]+'">';mode="ol"}h+="<li>"+inl(m[2])+"</li>"}else if(!ln.trim())close();else{close();h+="<p>"+inl(ln)+"</p>"}}close();return h}
const isHex=x=>/^#[0-9a-f]{6}$/i.test(x||""),dotsH='<span class="dots"><i></i><i></i><i></i></span>';
const bub=(c,last)=>`<div class="m ${c.r}">${c.r=="a"?((c.p&&!c.t)?dotsH:fmt(c.t))+(c.undo&&last?`<div style="margin-top:6px"><button class="sm" onclick="undoLast()">${ic("undo",14)} Undo changes</button></div>`:""):esc(c.t)}</div>`;
const PRE=[["Indigo","#5b4bff","#14b87a"],["Ocean","#0a84d6","#17b8a0"],["Sunset","#e8506a","#ff9f43"],["Forest","#2f9e5b","#c9a227"],["Berry","#b5329b","#6c5ce7"],["Graphite","#3b4256","#14b87a"]];
const foodish=q=>/meal|recipe|eat|food|dinner|lunch|breakfast|snack|plan|prep|cook|ingredient|batch|cal|protein|hungry|swap/i.test(q);

/* ---------- prompt and actions ---------- */
const ACTSPEC=`ACTIONS. Only if the user asked you to DO something in the app, end your reply with a line containing exactly @@ACTIONS and then a valid single-line JSON array. Allowed actions:
{"do":"log_food","name":"","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0,"meal":"b|l|d|s","date":"YYYY-MM-DD or empty for today"}  (log one food or dish the user ate; estimate realistically; one action per distinct food; "meal" is breakfast, lunch, dinner or snack)
{"do":"remove_food","name":""}  (removes the most recent logged food whose name contains this, today only)
{"do":"log_activity","name":"","minutes":0,"kcal":0}  (an activity or exercise the user did today that burned calories, e.g. a walk or sport; kcal = extra calories burned)
{"do":"log_water","ml":250}  (negative removes)
{"do":"log_weight","kg":0}
{"do":"set_goal_weight","kg":0}
{"do":"plan_week","days":[{"b":0,"l":1,"d":2}]}  (exactly 7 entries, ids from the RECIPE BOOK)
{"do":"swap_meal","day":0,"slot":"b|l|d","id":0}  (day 0=Monday of the plan week .. 6; change a single planned meal; id from the RECIPE BOOK)
{"do":"plan_from_ingredients","ingredients":["Chicken breast","Rice"]}  (rewrites the plan around ingredients the user has; use exact food names from the known foods list; also saves them as the user's kitchen)
{"do":"set_kitchen","ingredients":[""]}  (saves what the user has at home)
{"do":"show_recipes","ids":[0,1,2]}  (ids from the RECIPE BOOK; the app prints the full recipes with exact macros)
{"do":"save_recipe","id":0}
{"do":"add_ingredients","id":0}  (adds a recipe's ingredients to the shopping list)
{"do":"add_shopping","items":[{"name":"","qty":"","price":0}]}
{"do":"remove_shopping","name":""}
{"do":"create_batch","ids":[0],"servings":5}
{"do":"start_workout","routine":"routine name or empty"}
{"do":"build_routine","name":"","exercises":[{"name":"","muscle":"Chest|Back|Legs|Shoulders|Arms|Core|Cardio","sets":3}]}
{"do":"add_event","title":"","date":"YYYY-MM-DD","time":"HH:MM"}
{"do":"remove_event","title":"","date":"YYYY-MM-DD"}
{"do":"set_theme","preset":"Indigo|Ocean|Sunset|Forest|Berry|Graphite","accent":"#rrggbb","accent2":"#rrggbb","mode":"auto|light|dark","reset":false}
{"do":"update_profile","name":"","age":0,"height_cm":0,"weight_kg":0,"sex":"m|f","activity":"desk|light|active|very|extreme","goal":"cut|keep|bulk"}
{"do":"set_calories","kcal":0}  (kcal null resets to recommended; under-18s may only raise it at their own risk, never lower it)
{"do":"set_diet","diet":["vegetarian","vegan","pescatarian","gluten","dairy","nuts","egg"],"dislikes":""}
{"do":"go_to","tab":"home|food|meals|prep|shop|train|prog|xp|coach|me"}
Never remove anything except the single item the user named. Never say something was done unless you include the action. When the user says they ate something, ALWAYS include a log_food action for each food.`;
const PLANSTYLE=`Structure guide. Meal plans: a **Day 1** heading then bullets for Breakfast, Lunch and Dinner with kcal, repeated for each day, then a **Totals** line. Recipe ideas: name each idea and why it fits, and also call show_recipes with ids from the RECIPE BOOK. Weight gain or loss questions: **Your numbers** (TDEE, daily target, protein), **What to do** bullets, **Food ideas**, **Watch out for**.`,PREPSTYLE=`You are the meal-prep coach. Structure prep answers as: **What to cook** (recipes and servings), **Shopping list** (bullets with grams), **Cook-day steps** (numbered), **Storage and reheating** (bullets). When asked, apply it with create_batch, add_ingredients or plan_week using ids from the RECIPE BOOK.`;
function buildPrompt(q,mode){const u=S.user,pr=mode=="prep",td=TD(),bd=body(),t=tgt(),e=eaten(td),plan=SL.map(k=>{const r=S.recipes.find(x=>x.id==S.plan[di(td)+k]);return r?k+": "+r.n:null}).filter(Boolean),H=(pr?S.pchat:S.chat).filter(c=>c.t),hist=(H.length&&H[H.length-1].r=="u"?H.slice(0,-1):H).slice(-6).map(c=>(c.r=="u"?"User: ":"Assistant: ")+String(c.t).replace(/\n+/g," ").slice(0,350)).join("\n"),wt=S.wlog.slice(-5).map(x=>x.d+" "+x.w+"kg").join("; ")||"none",fl=(S.flog[td]||[]).map(x=>x.n+" "+x.k+"kcal").slice(-8).join("; ")||"nothing yet";
 const need=foodish(q)||pr;
 return `You are Mise, a friendly, knowledgeable AI coach inside a nutrition and training app. Answer ANY question the way a good general AI assistant would. When a question is about the user's body, food, training or progress, personalise the answer using their numbers below and quote them.
TODAY: ${new Date().toDateString()} (${td}).
USER: ${u.n}, age ${u.a}, ${u.h} cm, ${u.w} kg, ${u.s=="m"?"male":"female"}, activity x${u.act}, goal ${u.g}, diet ${u.diet.join(", ")||"none"}, avoids ${u.dis||"nothing"}. Goal weight ${u.gw||"not set"}. Recent weigh-ins: ${wt}.
BODY: BMI ${bd.bmi}, BMR ${bd.bmr} kcal, TDEE ${bd.tdee} kcal, protein at 2 g/kg = ${bd.p} g, under_18=${bd.minor}.
TARGETS: ${t.k} kcal, protein ${t.p} g, carbs ${t.c} g, fat ${t.f} g. EATEN TODAY: ${R(e.k)} kcal, P${R(e.p)} C${R(e.c)} F${R(e.f)} (${fl}); water ${S.water[td]||0} ml. CHECK-IN TODAY: ${S.days[td]?S.days[td].summary+" (productivity "+S.days[td].score+"/100, "+S.days[td].burn+" kcal burned)":"none"}. PLANNED TODAY: ${plan.join("; ")||"none"}.
KITCHEN: ${S.pantry.join(", ")||"not set"}. EVENTS: ${S.events.filter(x=>x.d>=td).slice(0,6).map(x=>x.d+" "+(x.t||"")+" "+x.n).join("; ")||"none"}. WORKOUTS: ${S.hist.slice(-3).map(h=>h.d+" "+h.n).join("; ")||"none"}. ROUTINES: ${S.routines.map(r=>r.name).join(", ")||"none"}. Rank ${rank().n}, level ${lvl()}.
${need?(/ingredient|have|using|only|fridge|kitchen|pantry/i.test(q)?"KNOWN FOODS (use these exact names): "+S.foods.filter(f=>!f.o).map(f=>f.n).join("; ")+"\n":"")+"RECIPE BOOK (id|name|type|kcal|protein):\n"+bookList()+"\n":""}${pr?"BATCHES: "+(S.batches.map(bTxt).join("; ")||"none")+"\n":""}RECENT CHAT:
${hist||"(none)"}
STYLE: Be accurate, practical and concise (under 180 words unless asked for more). Format neatly: a short opening sentence, then **bold** section headings with "- " bullets; numbered lines only for steps; no tables and no # headings. For casual chat reply naturally. Health: give safe, evidence-based advice and suggest a doctor or dietitian for medical issues, very low calories or eating disorders. If under_18 is true: never suggest weight loss, deficits, fasting or restrictive diets, say BMI categories do not apply to teens, focus on balanced meals and enough food for growth, sleep and gradual safe training, and suggest talking to a parent/guardian, doctor or dietitian. Respect the diet and allergies strictly.
${pr?PREPSTYLE:PLANSTYLE}
${ACTSPEC}
USER MESSAGE: ${q}`}
const cutAct=t=>{const i=t.indexOf("@@");return(i<0?t:t.slice(0,i)).trim()};
async function askAI(q,mode,onText){const full=await aiStream(buildPrompt(q,mode),t=>onText&&onText(cutAct(t))),i=full.lastIndexOf("@@ACTIONS"),say_=(i<0?full:full.slice(0,i)).replace(/@@\w*$/,"").trim();let acts=[];
 if(i>=0){const raw=full.slice(i+9).replace(/```(?:json)?/g,"").trim();try{acts=JSON.parse(raw)}catch(e){const m=raw.match(/\[[\s\S]*\]/);try{acts=JSON.parse(m[0])}catch(_){}}}
 if(!say_&&!(Array.isArray(acts)&&acts.length)){const e=new Error("The AI sent an empty reply. Please try again.");e.kind="empty";throw e}
 const res=[],more=[];(Array.isArray(acts)?acts:[]).slice(0,10).forEach(a=>{try{const r=runAct(a);if(r)(r.includes("\n")?more:res).push(r)}catch(e){}});
 let out=say_||"Done.";if(res.length)out+="\n\n**Done**\n"+res.map(x=>"- ✓ "+x).join("\n");if(more.length)out+="\n\n"+more.join("\n\n");return{text:out,acted:res.length+more.length>0}}
function addW(kg,ex){kg=+kg;if(!(kg>=20&&kg<=300))return"Enter a weight between 20 and 300 kg.";ex=ex||{};const u=S.user,d=ex.d||TD(),first=!S.wlog.length;
 if(first&&Math.abs(u.w-kg)>.05){let s0=ymd(new Date(parseInt(S.id,36)||Date.now()));if(s0>=d)s0=dAdd(d,-1);S.wlog.push({id:Date.now()-1,d:s0,w:u.w})}
 S.wlog=S.wlog.filter(x=>x.d!=d);const en={id:Date.now(),d,w:R(kg*10)/10};["waist","chest","hips","arm"].forEach(k=>{if(ex[k]>0)en[k]=ex[k]});if(ex.note)en.note=String(ex.note).slice(0,80);S.wlog.push(en);S.wlog.sort((a,b)=>a.d.localeCompare(b.d));const last=S.wlog[S.wlog.length-1];u.w=last.w;gain(XPV.weigh,"weigh",XPV.weigh);
 if(u.gw){const dist=Math.abs(last.w-u.gw);if(S.bd==null)S.bd=Math.abs(S.wlog[0].w-u.gw);if(dist<=S.bd-1){const k=Math.floor(S.bd-dist);S.bd-=k;award(k+" kg closer to your goal!","You’re "+R(dist*10)/10+" kg from "+u.gw+" kg. Keep going!","target")}if(dist<=.3&&!S.aw.goalW){S.aw.goalW=1;award("Goal weight reached!","You hit "+u.gw+" kg. Set a new goal to keep progressing.","trophy:target")}}
 const ch=R((last.w-S.wlog[0].w)*10)/10,t=tgt();return`**Logged ${last.w} kg**\n- Change since start: ${ch>0?"+":""}${ch} kg\n`+(u.gw?`- Goal: ${u.gw} kg (${R(Math.abs(last.w-u.gw)*10)/10} kg to go)\n`:"")+`- Targets updated: ${t.k} kcal, protein ${t.p} g`}
function runAct(A){if(!A||typeof A!="object")return"";const mealOK=x=>Number.isInteger(+x)&&MEALS[+x]&&scaled(MEALS[+x]);switch(A.do){
 case"set_theme":{const p=PRE.find(x=>x[0].toLowerCase()==String(A.preset||"").toLowerCase());if(A.reset){S.theme.ac="";S.theme.ac2=""}if(p){S.theme.ac=p[1];S.theme.ac2=p[2]}if(isHex(A.accent))S.theme.ac=A.accent;if(isHex(A.accent2))S.theme.ac2=A.accent2;if(["auto","light","dark"].includes(A.mode))S.theme.mode=A.mode;return"Updated the colours"+(A.mode?" ("+A.mode+" mode)":"")}
 case"add_event":{if(!A.title||!/^\d{4}-\d{2}-\d{2}$/.test(A.date||""))return"Couldn’t add the event (it needs a title and a date)";S.events.push({d:A.date,n:String(A.title).slice(0,80),t:/^\d{1,2}:\d{2}$/.test(A.time||"")?String(A.time).padStart(5,"0"):""});gain(XPV.event,"event",XPV.eventCap);return"Added “"+A.title+"” on "+fd(A.date)+(A.time?" at "+A.time:"")}
 case"remove_event":{const k=String(A.title||"").toLowerCase();if(!k)return"";const ms=S.events.filter(e=>e.n.toLowerCase().includes(k)&&(!A.date||e.d==A.date));if(ms.length!=1)return ms.length?"Several events match “"+A.title+"”, so I removed none. Use Progress → Calendar.":"No event matches “"+A.title+"”";S.events=S.events.filter(e=>e!==ms[0]);return"Removed “"+ms[0].n+"”"}
 case"add_shopping":{const it=(A.items||[]).filter(x=>x&&x.name).slice(0,20);it.forEach(x=>CL().items.push({n:cap(String(x.name).slice(0,60)),q:String(x.qty||"").slice(0,20),pr:Math.max(0,+x.price||0),l:"",d:0}));return it.length?"Added "+it.map(x=>x.name).join(", ")+" to "+CL().name:""}
 case"remove_shopping":{const k=String(A.name||"").toLowerCase();if(!k)return"";const L=CL(),n=L.items.length;L.items=L.items.filter(x=>!x.n.toLowerCase().includes(k));return n>L.items.length?"Removed “"+A.name+"” from "+L.name:"“"+A.name+"” isn’t on the list"}
 case"log_activity":{const k=Math.max(0,Math.min(3000,+A.kcal||0));if(!A.name)return"";const d=S.days[TD()]||(S.days[TD()]={text:"",acts:[],burn:0,score:0,summary:"",tip:"",t:Date.now()});d.acts.push({n:String(A.name).slice(0,60),min:Math.max(0,+A.minutes||0),kcal:k,cat:"exercise"});d.burn=R(d.acts.reduce((a,x)=>a+x.kcal,0));return"Logged "+A.name+" ("+k+" kcal burned)"}
 case"log_water":{const k=TD(),ml=Math.max(-2000,Math.min(2000,+A.ml||250)),g=R(S.user.w*35);S.water[k]=Math.max(0,(S.water[k]||0)+ml);if(S.water[k]<g)delete S.water[k+"g"];else if(ml>0&&!S.water[k+"g"]){S.water[k+"g"]=1;gain(XPV.hydra);cheer("Hydration goal hit!","drop")}if(ml>0)gain(XPV.water,"water",XPV.waterCap);return(ml>0?"Logged ":"Removed ")+Math.abs(ml)+" ml. Water today: "+S.water[k]+" / "+g+" ml"}
 case"log_food":{const f=F(A.name);let e;if(f&&+A.grams>0){const g=Math.min(1500,+A.grams);e={n:R(g)+"g "+f.n,k:f.k*g/100,p:f.p*g/100,c:f.c*g/100,f:f.f*g/100}}else{const k=+A.kcal;if(!(k>=0&&k<=4000)||A.kcal==null)return"Couldn’t log that food (calories missing)";e={n:String(A.name||"Food").slice(0,60),k,p:Math.max(0,+A.protein||0),c:Math.max(0,+A.carbs||0),f:Math.max(0,+A.fat||0)}}
  const d=/^\d{4}-\d{2}-\d{2}$/.test(A.date||"")&&A.date<=TD()?A.date:TD(),mt=["b","l","d","s"].includes(A.meal)?A.meal:undefined;logFood({...e,s:"assistant",mt},d);const t=tgt(),x=eaten(d);return"Logged "+e.n+" ("+R(e.k)+" kcal) to "+(MT.find(a=>a[0]==(mt||mealOfTime(new Date().toTimeString().slice(0,5))))||["","today"])[1].toLowerCase()+". "+(d==TD()?"Today":fd(d))+": "+R(x.k)+" / "+t.k+" kcal"}
 case"remove_food":{const k=String(A.name||"").toLowerCase();if(!k)return"";const L=S.flog[TD()]||[];for(let i=L.length-1;i>=0;i--)if(L[i].n.toLowerCase().includes(k)){const n=L[i].n;L.splice(i,1);return"Removed “"+n+"” from today"}return"“"+A.name+"” isn’t in today’s log"}
 case"log_weight":return String(addW(A.kg)).split("\n")[0].replace(/\*\*/g,"");
 case"set_goal_weight":{const g=+A.kg;if(!(g>=20&&g<=300))return"Pick a goal weight between 20 and 300 kg";S.user.gw=g;S.bd=null;return"Goal weight set to "+g+" kg"}
 case"update_profile":{const u=S.user,ch=[],am={desk:1.2,light:1.375,active:1.55,very:1.725,extreme:1.9};if(A.name){u.n=String(A.name).slice(0,30);nm();ch.push("name")}if(+A.age>=MIN_AGE&&+A.age<=100){u.a=+A.age;ch.push("age")}if(+A.height_cm>=100&&+A.height_cm<=250){u.h=+A.height_cm;ch.push("height")}if(["m","f"].includes(A.sex)){u.s=A.sex;ch.push("sex")}if(am[A.activity]){u.act=am[A.activity];ch.push("activity")}if(["cut","keep","bulk"].includes(A.goal)){u.g=A.goal;if(u.g=="cut"&&u.a<18){u.g="keep";ch.push("goal (kept at maintain for under-18s)")}else ch.push("goal")}if(+A.weight_kg>=20){addW(+A.weight_kg);ch.push("weight")}return ch.length?"Updated "+ch.join(", ")+". Target now "+tgt().k+" kcal":""}
 case"set_calories":{const t=tgt();if(A.kcal==null||A.kcal===0){delete S.user.ko;return"Calories reset to the recommended "+t.rk+" kcal"}const k=R(+A.kcal);if(!(k>=1200&&k<=6000))return"Calories must be between 1,200 and 6,000";if(S.user.a<18){if(k<t.rk)return"Under-18 targets can’t go below the maintenance level ("+t.rk+" kcal).";if(k>t.mx)return"The most I can set for under-18s is "+t.mx+" kcal.";if(!S.u18ack)return"Please read the under-18 notice in Profile first."}S.user.ko=k;return"Calorie target set to "+k+" kcal"+(S.user.a<18&&k>t.rk?" (above the recommended amount, at your own risk)":"")}
 case"set_diet":{if(Array.isArray(A.diet))S.user.diet=A.diet.filter(d=>DIETS.some(x=>x[0]==d));if(typeof A.dislikes=="string")S.user.dis=A.dislikes.slice(0,120);return"Diet saved: "+(S.user.diet.join(", ")||"none")+(S.user.dis?" · avoiding "+S.user.dis:"")}
 case"start_workout":{const k=String(A.routine||"").toLowerCase(),r=k&&k!="empty"?S.routines.find(x=>x.name.toLowerCase().includes(k)):null;if(k&&k!="empty"&&!r)return"No routine called “"+A.routine+"”";mkRun(r?r.id:0);runMin=false;navT="train";return"Started "+(r?r.name:"an empty workout")}
 case"build_routine":{const ex=(A.exercises||[]).filter(e=>e&&e.name).slice(0,10);if(!ex.length)return"";addRoutine(String(A.name||"AI routine").slice(0,40),ex);sub.train="workout";navT="train";return"Built the routine “"+(A.name||"AI routine")+"” ("+ex.length+" exercises)"}
 case"show_recipes":{const ids=(A.ids||[]).map(Number).filter(mealOK).slice(0,4);if(!ids.length)return"";return ids.map(x=>{const s_=scaled(MEALS[x]),m=MEALS[x];return"**"+m[0]+"**\n- "+m[5]+" min · "+R(s_.m.k)+" kcal · P"+R(s_.m.p)+" C"+R(s_.m.c)+" F"+R(s_.m.f)+"\n- Ingredients: "+s_.i.map(a=>a.g+"g "+SHORT(a.f)).join(", ")+"\n- "+m[2]}).join("\n\n")+"\n\nOpen **Meals → Recipes** for the full method."}
 case"save_recipe":{if(!mealOK(A.id))return"";rcp(+A.id);gain(XPV.recipe,"recipe",XPV.recipeCap);return"Saved “"+MEALS[+A.id][0]+"” to My recipes"}
 case"add_ingredients":{if(!mealOK(A.id))return"";const L=CL();scaled(MEALS[+A.id]).i.forEach(i=>L.items.push({n:i.f,q:i.g+"g",pr:0,l:"",d:0}));return"Added the ingredients for “"+MEALS[+A.id][0]+"” to "+L.name}
 case"plan_week":{const n=applyPlan(A.days);return n?"Planned "+n+" meals across the week (see Meals → Week plan)":"I couldn’t build a valid plan from that"}
 case"swap_meal":{const d=+A.day,sl={b:"Breakfast",l:"Lunch",d:"Dinner"}[A.slot];if(!(d>=0&&d<7)||!sl||!mealOK(A.id))return"Couldn’t swap that meal";if((MEALS[+A.id][1]=="b")!=(sl=="Breakfast"))return"That recipe doesn’t suit "+sl.toLowerCase();S.plan[d+sl]=rcp(+A.id,true);if(!S.ps)S.ps=mon();return"Swapped "+DAYS[d]+" "+sl.toLowerCase()+" to “"+MEALS[+A.id][0]+"”"}
 case"set_kitchen":{const L=(A.ingredients||[]).map(String).filter(n=>F(n));if(!L.length)return"";S.pantry=[...new Set(S.pantry.concat(L))];return"Saved "+L.length+" ingredients to your kitchen"}
 case"plan_from_ingredients":{const L=(A.ingredients||[]).map(String).filter(n=>F(n));if(L.length)S.pantry=[...new Set(S.pantry.concat(L))];if(!S.pantry.length)return"Tell me which ingredients you have first";const n=pantryRework();return n?"Updated "+n+" meals to use your ingredients":"No better matches found for those ingredients"}
 case"create_batch":{const ids=(A.ids||[]).map(Number).filter(mealOK).slice(0,2);if(!ids.length)return"";const b=mkBatch(ids,+A.servings||5);return b?"Created the batch “"+bTxt(b)+"” (see Meals → Meal prep)":"Your "+rank().n+" rank holds "+tier().batch+" saved batch. Delete one or rank up."}
 case"go_to":{const m={home:["home"],food:["food"],meals:["meals"],prep:["meals","prep"],shop:["shop"],train:["train"],prog:["prog"],xp:["xp"],coach:["coach"],me:["me"]}[A.tab];if(m)navT=m;return""}
 }return""}
const SNAP=["events","lists","water","recipes","plan","ps","user","theme","routines","flog","batches","pantry","xp","wlog","shist","exs"];
function snap(){const o={};SNAP.forEach(k=>o[k]=S[k]);U.push(JSON.stringify(o));if(U.length>10)U.shift()}
function undoLast(){if(!U.length)return toast("Nothing to undo");Object.assign(S,JSON.parse(U.pop()));S.chat.forEach(c=>{delete c.undo});S.pchat.forEach(c=>{delete c.undo});toast("Changes undone","","undo");go()}
async function converse(q,mode){const pr=mode=="prep",key=pr?"pchat":"chat",box=pr?"pc":"ch";if(!q||busy)return;
 const note=t=>{S[key].push({r:"u",t:q},{r:"a",t});S[key]=S[key].slice(-40);go();const c=$(box);if(c)c.scrollTop=c.scrollHeight};
 if(!aiOK())return note("The AI assistant isn’t reachable right now. Please try again in a moment.");
 if(!chatLeft())return note("You’ve used all "+tier().chat+" AI chats for this hour. They reset in "+resetMin()+" min. Ranking up raises the limit.");
 snap();S[key].push({r:"u",t:q});const m={r:"a",t:"",p:1};S[key].push(m);S.use.chat.push(Date.now());busy=1;navT=null;go();
 try{const r=await askAI(q,mode,t=>{m.t=t;const e=document.querySelector("#"+box+" .m:last-child");if(e){e.innerHTML=t?fmt(t):dotsH;const c=$(box);if(c)c.scrollTop=c.scrollHeight}});m.t=r.text;m.p=0;if(r.acted)m.undo=1;else U.pop();speak(cutAct(r.text).split("\n\n")[0])}
 catch(e){S.use.chat.pop();U.pop();m.t=aiErrMsg(e);m.p=0}
 busy=0;S[key]=S[key].slice(-40);if(navT){const n=navT;navT=null;go(n[0],n[1])}else go();const c=$(box);if(c)c.scrollTop=c.scrollHeight}
const say=()=>{const q=v("cq").trim();if($("cq"))$("cq").value="";return converse(q,"main")},psay=()=>{const q=v("pq").trim();if($("pq"))$("pq").value="";return converse(q,"prep")};
const ask=t=>converse(t,"main");

/* ---------- coach screen ---------- */
const SUGG=["I just ate two eggs on toast and a banana","What should I eat tonight?","Plan my week using chicken, rice and broccoli","Build me a push workout","What’s the best way to gain weight?","Log 500 ml of water"];
V.coach=()=>{const msgs=S.chat.filter(c=>c.t||c.p);
 return `<div class="coachw"><div class="coach-h"><div class="av g">${ic("sparkles",20)}</div><div class="grow"><b>Mise Coach</b><div class="mut sm-t">${aiLine()}</div></div><button class="ibtn ghost" onclick="S.speak=!S.speak;if(!S.speak&&window.speechSynthesis)speechSynthesis.cancel();toast('Spoken replies '+(S.speak?'on':'off'));go()" aria-label="Spoken replies ${S.speak?"on":"off"}" aria-pressed="${!!S.speak}">${ic(S.speak?"volume":"volumeOff",22)}</button><button class="ibtn ghost" onclick="dbl('cc',()=>{S.chat=[S.chat[0]];go()})" aria-label="Clear chat">${ic("trash",20)}</button></div>
 <div class="chips scrollx">${SUGG.map(t=>`<button class="chip" onclick="ask(this.textContent)">${esc(t)}</button>`).join("")}</div>
 <div class="chat" id="ch">${msgs.map((c,i)=>bub(c,i==msgs.length-1)).join("")}</div>
 ${REC&&RECID=="cq"?`<div class="listen"><div class="wv"><i></i><i></i><i></i><i></i><i></i></div><b class="grow">Listening…</b></div>`:""}
 <div class="composer"><button class="ibtn lg mic" id="mic_cq" onclick="voiceStart('cq',true)" aria-label="Talk to Mise">${ic("mic",22)}</button><input id="cq" placeholder="Type or tap the mic and talk" onkeydown="if(event.key=='Enter')say()" ${busy?"disabled":""} autocomplete="off"><button class="pri ibtn lg" onclick="say()" ${busy?"disabled":""} aria-label="Send">${busy?'<span class="spin"></span>':ic("send",22)}</button></div>
 <p class="mut sm-t tc" style="margin:6px 0 0">Mise can log food, plan meals, edit your plan and build workouts. It can make mistakes, so check anything important.</p></div>`};
