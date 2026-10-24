/* Mise core: state, storage, helpers, XP and ranks, nutrition targets. */
const K="mise:",DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],SL=["Breakfast","Lunch","Dinner"],MT=[["b","Breakfast"],["l","Lunch"],["d","Dinner"],["s","Snacks"]];
const MG=["Chest","Back","Shoulders","Arms","Legs","Core","Cardio","Full body"];
const MIN_AGE=13;
const DR=()=>[{id:1,name:"Upper body",ex:[{x:"Bench press",s:3},{x:"Barbell row",s:3},{x:"Overhead press",s:3},{x:"Bicep curl",s:2}]},{id:2,name:"Lower body",ex:[{x:"Squat",s:4},{x:"Romanian deadlift",s:3},{x:"Leg press",s:3},{x:"Plank",s:3}]}];
const QUOTES=["Small reps, big changes.","Prep today, thank yourself Thursday.","Progress is a habit, not a mood.","Strong is built between the sets."];

/* ---------- state ---------- */
let S=null,tab="home",sub={train:"workout",meals:"plan",prog:"body",me:"profile"},ed=null,ww=0,wm=new Date(),cm=new Date(),sd,li=1,draft={n:"",i:[]},mf="all",sv=4,armed=null,rest={t:0,iv:0},tg=[],mq="",lim=10,runMin=false;
const $=i=>document.getElementById(i),v=i=>{const e=$(i);return e?e.value:""},esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ymd=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"),TD=()=>ymd(new Date());sd=TD();
const jq=s=>esc(JSON.stringify(String(s))),R=n=>Math.round(n),cap=x=>x.charAt(0).toUpperCase()+x.slice(1);
const dAdd=(x,n)=>{const d=new Date(x+"T00:00");d.setDate(d.getDate()+n);return ymd(d)},mon=()=>{const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return ymd(d)};
const fd=d=>new Date(d+"T00:00").toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"});
const di=d=>(Math.round((new Date(d+"T00:00")-new Date((S.ps||mon())+"T00:00"))/864e5)%7+7)%7;
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
/* keyword search: every word typed must appear in the text; matches at the start of a word score higher */
function sm(q,text){const ws=norm(q).split(/[^a-z0-9]+/).filter(Boolean);if(!ws.length)return 1;const t=norm(text);let sc=0;for(const w of ws){const i=t.indexOf(w);if(i<0)return 0;sc+=(i==0||t[i-1]==" "||t[i-1]=="-"||t[i-1]=="(")?2:1}return sc}

/* ---------- activity levels (clear descriptions for sign-up and profile) ---------- */
const ACT=[
{v:1.2,k:"desk",n:"Sedentary",d:"You sit most of the day and rarely exercise.",x:"Office or study day, driving, little walking."},
{v:1.375,k:"light",n:"Lightly active",d:"On your feet a bit, or you exercise 1 to 3 days a week.",x:"Short walks, a couple of gym or sport sessions."},
{v:1.55,k:"active",n:"Moderately active",d:"Regular movement, and you train 3 to 5 days a week.",x:"Gym or sport most days, or a job on your feet."},
{v:1.725,k:"very",n:"Very active",d:"Hard training 6 to 7 days a week, or a physical job.",x:"Daily workouts, tradie, nurse on long shifts."},
{v:1.9,k:"extreme",n:"Extremely active",d:"Twice-daily training or heavy manual work plus exercise.",x:"Athlete in heavy training, farm or labouring work."}];
const nearAct=x=>ACT.reduce((a,b)=>Math.abs(b.v-x)<Math.abs(a.v-x)?b:a,ACT[1]);
const GOALS=[{k:"cut",n:"Lose fat",d:"A moderate calorie deficit (about 400 kcal a day).",ic:"arrowDown"},{k:"keep",n:"Maintain",d:"Eat about what you burn to hold your weight.",ic:"scale"},{k:"bulk",n:"Build muscle",d:"A small calorie surplus (about 300 kcal a day) with high protein.",ic:"dumbbell"}];
const GL=GOALS.map(g=>[g.k,g.n]);

/* ---------- storage and accounts ---------- */
const idx=()=>{try{return JSON.parse(localStorage.getItem(K+"idx"))||[]}catch(e){return[]}};
const ld=id=>{try{return JSON.parse(localStorage.getItem(K+"u:"+id))}catch(e){return null}};
let lastJ="";
function save(force){if(!S)return;let j;try{j=JSON.stringify(S,(k,x)=>k=="upd"?undefined:x)}catch(e){return}
 if(j===lastJ&&!force)return;lastJ=j;S.upd=Date.now();
 try{localStorage.setItem(K+"u:"+S.id,JSON.stringify(S));if(!S.cloud){(S.rm?localStorage:sessionStorage).setItem(K+"cur",S.id);if(!S.rm)localStorage.removeItem(K+"cur")}}catch(e){}
 if(S.cloud&&typeof cloudQueue=="function")cloudQueue()}
function blank(u){return{user:u,foods:FOODS.slice(),recipes:[],plan:{},ps:"",pantry:[],flog:{},wlog:[],aw:{},shist:[],batches:[],pchat:[],tier:"free",use:{chat:[],photo:{},pt:0},ai:{p:"gemini",key:"",model:"gemini-2.5-flash",base:"",proxy:""},notif:{on:false,ev:true,evMin:10,meals:false,mt:{b:"08:00",l:"12:30",d:"18:30"},water:0,wo:"",fired:{},lw:0},lists:[{id:1,name:"Groceries",budget:100,items:[]}],exs:EXS.slice(),routines:DR(),hist:[],run:null,events:[],water:{},days:{},xp:0,xd:{},theme:{ac:"",ac2:"",mode:"auto"},speak:false,rv:2,chat:[{r:"a",t:"Hi, I’m Mise. Ask me anything about food, training or your plan. I can also do things for you: log what you ate, plan your week, swap meals, build workouts and more. Tap the mic to talk."}]}}
const EXTRA=(n)=>({n,m:"Full body",g:"Full body",eq:"Other",sec:[],ty:"wr",kw:"",cu:1});
function fix(){S=Object.assign(blank(S.user),S);const u=S.user;u.diet=u.diet||[];u.dis=u.dis||"";u.act=nearAct(u.act||1.375).v;if(u.a<18)u.g="keep";
 S.theme=S.theme||{ac:"",ac2:"",mode:"auto"};S.chat=(S.chat||[]).filter(c=>c.t);S.pchat=(S.pchat||[]).filter(c=>c.t);S.xd=S.xd||{};S.days=S.days||{};
 FOODS.forEach(f=>{const i=S.foods.findIndex(x=>x.n==f.n);if(i<0)S.foods.push(f);else if(!S.foods[i].cu){S.foods[i]=Object.assign({},f)}});
 const old=S.exs||[];S.exs=EXDB.slice();old.forEach(e=>{if(!EXDB.some(d=>d.n==e.n))S.exs.push(e.g?e:{n:e.n,m:e.m||"Full body",g:GROUP[e.m]||"Full body",eq:"Other",sec:[],ty:"wr",kw:"",cu:1})});
 if(S.rv!=2){S.ll=null;S.lr=null;S.rv=2}
 Object.keys(S.flog).forEach(d=>(S.flog[d]||[]).forEach(e=>{if(!e.mt)e.mt=mealOfTime(e.t)}));
 const known=n=>S.exs.find(x=>x.n==n);S.routines.forEach(r=>r.ex.forEach(e=>{if(!known(e.x))S.exs.push(EXTRA(e.x))}));
 if(S.run)S.run.ex.forEach(e=>{if(!known(e.x))S.exs.push(EXTRA(e.x))})}
function mealOfTime(t){const h=+(String(t||"12:00").slice(0,2));return h<10?"b":h<15?"l":h<17?"s":h<21?"d":"s"}
function mk(u,o,h,sl,rm,id){S=Object.assign(blank(u),o||{});S.user=u;S.id=id||Date.now().toString(36);if(!id){const a=idx();a.push({id:S.id,n:u.n,h:h||"",s:sl||""});try{localStorage.setItem(K+"idx",JSON.stringify(a))}catch(e){}}S.rm=!!rm;fix();if(!o){seedStarter();S.seeded=1}lastJ="";save(true)}

/* ---------- XP, levels, ranks ---------- */
const XPV={set:10,setCap:250,pr:25,prCap:100,finish:20,streak:5,streakCap:25,food:3,foodCap:15,kcal:25,protein:15,water:5,waterCap:20,hydra:10,weigh:10,recipe:20,recipeCap:60,plan:30,batch:15,event:5,eventCap:15,photo:5,trophy:25,checkin:10};
function gain(n,key,cap){if(key){const d=TD();if(!S.xd||S.xd.d!=d)S.xd={d};const u=S.xd[key]||0;n=Math.min(n,cap-u);if(n<=0)return 0;S.xd[key]=u+n}S.xp+=n;return n}
function lose(n,key){if(key&&S.xd&&S.xd.d==TD())S.xd[key]=Math.max(0,(S.xd[key]||0)-n);S.xp=Math.max(0,S.xp-n)}
const RANKS=[
{n:"Initiate",lv:1,t:"Every legend starts with day one."},{n:"Challenger",lv:3,t:"You showed up. Now keep showing up."},{n:"Warrior",lv:6,t:"Discipline is taking shape."},{n:"Gladiator",lv:10,t:"Built for the arena of daily habits."},{n:"Spartan",lv:15,t:"Hard to break, harder to stop."},{n:"Titan",lv:21,t:"Strength you can see from a distance."},{n:"Olympian",lv:28,t:"Crowned by consistency."},{n:"Demigod",lv:36,t:"Half human, all habit."},{n:"Immortal",lv:45,t:"Your routine burns on its own."},{n:"Legend",lv:55,t:"The top of the mountain."}];
const lvl=()=>(S.xp/100|0)+1,rankIdx=()=>{let r=0;RANKS.forEach((k,i)=>{if(lvl()>=k.lv)r=i});return r},rank=()=>Object.assign({i:rankIdx()},RANKS[rankIdx()]);
const TIERS={free:{n:"Starter",lv:1,chat:50,photo:5,batch:1,perks:["50 AI chats per hour","5 photo logs per day","1 saved prep batch","Event reminders"]},plus:{n:"Boosted",lv:6,chat:100,photo:25,batch:99,perks:["100 AI chats per hour","25 photo logs per day","Unlimited prep batches","Meal, water and workout reminders"]},pro:{n:"Elite",lv:10,chat:200,photo:75,batch:99,perks:["200 AI chats per hour","75 photo logs per day","Weekly AI nutrition review"]}},TO=["free","plus","pro"];
const curTier=()=>lvl()>=TIERS.pro.lv?"pro":lvl()>=TIERS.plus.lv?"plus":"free",tier=()=>TIERS[curTier()];
const AWD=[["wk1","dumbbell","First workout","You logged your first workout. The journey starts here."],["wk5","dumbbell","5 workouts","Five workouts done. A habit is forming."],["wk10","dumbbell","10 workouts","Ten workouts completed. Strong work."],["wk25","dumbbell","25 workouts","Twenty-five workouts. You are consistent."],["wk50","trophy","50 workouts","Fifty workouts. Serious dedication."],["wk100","trophy","100 workouts","One hundred workouts. Legendary."],["pr1","trophy","First personal record","You set your first personal record."],["pr10","trophy","10 personal records","Ten personal records. You keep getting stronger."],["st3","flame","3-day streak","Three training days in a row."],["st7","flame","7-day streak","A full week of training in a row."],["st14","flame","14-day streak","Two weeks without a gap."],["st30","flame","30-day streak","A whole month in a row."],["st60","flame","60-day streak","Sixty days in a row. Unstoppable."],["st100","flame","100-day streak","One hundred days in a row."],["fl1","food","First food logged","Tracking what you eat is how progress is measured."],["fl7","food","7 days of food logs","A week of logging."],["fl30","food","30 days of food logs","A month of logging."],["ph1","camera","First photo log","Your first meal logged from a photo."],["ph10","camera","10 photo logs","Ten meals logged from photos."],["rc1","book","First recipe saved","Your cookbook has begun."],["rc10","book","10 recipes saved","A proper cookbook."],["pl","meals","Week planned","A full week of meals planned."],["bt","layers","First prep batch","Cook once, eat all week."],["w1","scale","Tracking started","Your first weigh-in is logged."],["w10","chart","10 weigh-ins","Ten data points. Now you can see a trend."],["goalW","target","Goal weight reached","You hit your goal weight."]];
const prCount=()=>S.hist.reduce((a,h)=>a+h.sets.filter(s=>s.pr).length,0);
function mset(){const n=S.hist.length,st=streak(),fdn=Object.keys(S.flog).filter(d=>(S.flog[d]||[]).length).length,m={},pc=prCount();[1,5,10,25,50,100].forEach(k=>m["wk"+k]=n>=k);[3,7,14,30,60,100].forEach(k=>m["st"+k]=st>=k);[1,7,30].forEach(k=>m["fl"+k]=fdn>=k);m.pr1=pc>=1;m.pr10=pc>=10;m.ph1=S.use.pt>=1;m.ph10=S.use.pt>=10;m.rc1=S.recipes.filter(r=>!r.auto).length>=1;m.rc10=S.recipes.filter(r=>!r.auto).length>=10;m.pl=Object.keys(S.plan).length>=14;m.bt=S.batches.length>=1;m.w1=S.wlog.length>=1;m.w10=S.wlog.length>=10;return m}
function chkTier(){S.aw=S.aw||{};const sil=!S.awInit,td=TD();
 const M=mset();AWD.forEach(a=>{if(M[a[0]]&&!S.aw[a[0]]){S.aw[a[0]]=1;if(!sil){S.xp+=XPV.trophy;award(a[2],a[3]+" +"+XPV.trophy+" XP","trophy:"+a[1])}}});
 const L=lvl(),ri=rankIdx();if(S.ll==null){S.ll=L;S.lr=ri}
 if(L>S.ll){const up=ri>S.lr;S.ll=L;S.lr=ri;if(!sil){if(up){const K_=RANKS[ri];award("Rank up: "+K_.n,"You reached level "+L+" and joined the "+K_.n+" rank."+(TO.some(k=>TIERS[k].lv==K_.lv&&K_.lv>1)?" New perks unlocked!":""),"rank:"+ri)}else{const nx=RANKS[ri+1];award("Level "+L+"!",nx?(nx.lv-L)+" more levels to "+nx.n+".":"You are at the top rank.","star")}}}
 const e=eaten(td),t=tgt();
 if(e.k>0&&e.p>=t.p*.95&&!S.aw["pr"+td]){S.aw["pr"+td]=1;if(!sil){gain(XPV.protein);cheer("Protein target hit today! +"+XPV.protein+" XP","bolt")}}
 if(e.k>=t.k*.9&&e.k<=t.k*1.1&&!S.aw["kc"+td]){S.aw["kc"+td]=1;if(!sil){gain(XPV.kcal);cheer("Calorie target reached today! +"+XPV.kcal+" XP","target")}}
 S.awInit=1}
function streak(){let n=0,d=new Date();const s=new Set(S.hist.map(h=>h.d));if(!s.has(ymd(d)))d.setDate(d.getDate()-1);while(s.has(ymd(d))){n++;d.setDate(d.getDate()-1)}return n}
function bestStreak(){const ds=[...new Set(S.hist.map(h=>h.d))].sort();let b=0,c=0,p=null;ds.forEach(d=>{c=p&&dAdd(p,1)==d?c+1:1;p=d;b=Math.max(b,c)});return b}

/* ---------- nutrition ---------- */
const F=n=>S.foods.find(f=>f.n===n);
function mac(ings){const r={k:0,p:0,c:0,f:0};ings.forEach(i=>{const f=F(i.f);if(f)["k","p","c","f"].forEach(m=>r[m]+=f[m]*i.g/100)});return r}
const bmrOf=u=>10*u.w+6.25*u.h-5*u.a+(u.s=="m"?5:-161);
function targetsFor(u){const b=bmrOf(u),adj=u.a<18?0:({cut:-400,keep:0,bulk:300})[u.g]||0,rk=Math.max(1200,Math.round((b*u.act+adj)/10)*10),mx=u.a<18?Math.min(4500,rk+1000):6000,mn=u.a<18?rk:1200,k=Math.min(mx,Math.max(mn,u.ko||rk)),p=Math.min(R(u.w*2),R(k*.4/4)),f=Math.max(R(u.w*.6),R(k*.25/9)),c=Math.max(60,R((k-p*4-f*9)/4));return{rk,k,p,f,c,mx,mn}}
const tgt=()=>targetsFor(S.user);
const isMinor=()=>S&&S.user.a<18;
function dayMac(i){const r={k:0,p:0,c:0,f:0};SL.forEach(s=>{const rc=S.recipes.find(x=>x.id==S.plan[i+s]);if(rc){const m=mac(rc.i);for(const k in r)r[k]+=m[k]}});return r}
const burnOf=d=>((S.days||{})[d]||{}).burn||0;
const eaten=d=>{const r={k:0,p:0,c:0,f:0};(S.flog[d]||[]).forEach(e=>{r.k+=e.k;r.p+=e.p;r.c+=e.c;r.f+=e.f});return r};
function logFood(e,d){d=d||TD();(S.flog[d]=S.flog[d]||[]).push({id:Date.now()+Math.random(),n:e.n,k:R(e.k),p:R(e.p),c:R(e.c),f:R(e.f),t:new Date().toTimeString().slice(0,5),mt:e.mt||mealOfTime(new Date().toTimeString().slice(0,5)),s:e.s||"manual"});gain(XPV.food,"food",XPV.foodCap)}
function body(){const u=S.user,bmi=u.w/((u.h/100)**2),bmr=bmrOf(u);return{bmi:R(bmi*10)/10,bmr:R(bmr),tdee:R(bmr*u.act),minor:u.a<18,p:R(u.w*2)}}
const MS=m=>`<div class="mac"><span><b>${R(m.k)}</b> kcal</span><span>P <b>${R(m.p)}</b>g</span><span>C <b>${R(m.c)}</b>g</span><span>F <b>${R(m.f)}</b>g</span></div>`;

/* ---------- workout data helpers ---------- */
const e1=(w,r)=>r>1?w*(1+r/30):w,isWork=s=>s.ty!="W",vol=ss=>ss.reduce((a,s)=>a+(isWork(s)&&(!s.k||s.k=='wr'||s.k=='br')?(+s.w||0)*(+s.r||0):0),0),allSets=x=>S.hist.flatMap(h=>h.sets).filter(s=>s.x==x&&isWork(s));
const exOf=x=>S.exs.find(e=>e.n==x)||{n:x,m:"Full body",g:"Full body",eq:"Other",sec:[],ty:"wr"};
const mgOf=x=>exOf(x).g||"Full body",tyOf=x=>exOf(x).ty||"wr";
