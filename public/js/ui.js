/* Setpoint UI kit: toast, modals, pickers (searchable lists), navigation shell. */
const V={};
function toast(t,kind,icon){const e=$("toast");e.innerHTML=(icon?ic(icon,18):"")+"<span>"+esc(t)+"</span>";e.className="show"+(kind?" "+kind:"");clearTimeout(toast.h);toast.h=setTimeout(()=>e.className="",kind=="pr"?3600:2800)}
function dbl(k,f){if(armed==k){armed=null;f()}else{armed=k;go();setTimeout(()=>{if(armed==k){armed=null;go()}},3000)}}
const cfl=(k,l)=>armed==k?"Tap again to confirm":l;
function rain(ms){if(typeof matchMedia!="undefined"&&matchMedia("(prefers-reduced-motion:reduce)").matches)return;const c=$("cf"),x=c.getContext("2d");c.width=innerWidth;c.height=innerHeight;const cols=["#5b4bff","#14b87a","#ff8a3d","#ffd166","#e0457b","#0a84d6"],P=[...Array(130)].map(()=>({x:Math.random()*innerWidth,y:-20-Math.random()*innerHeight*.8,vy:2+Math.random()*3.5,vx:(Math.random()-.5)*2,w:6+Math.random()*7,h:8+Math.random()*8,r:Math.random()*6,vr:(Math.random()-.5)*.3,c:cols[Math.random()*cols.length|0],ph:Math.random()*6}));let f=0;const N=Math.round((ms||3200)/16.7);(function a(){x.clearRect(0,0,c.width,c.height);P.forEach(p=>{p.y+=p.vy;p.x+=p.vx+Math.sin(f/18+p.ph)*.8;p.r+=p.vr;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.w/2,-p.h/2,p.w,p.h);x.restore()});if(++f<N)requestAnimationFrame(a);else x.clearRect(0,0,c.width,c.height)})()}
/* icon spec for awards: "rank:3", "trophy:<iconName>", or an icon name */
function awIcon(s){s=String(s||"star");if(s.startsWith("rank:"))return badge(+s.slice(5),84,{label:"Rank",u:"aw"});const n=s.startsWith("trophy:")?s.slice(7):s;return `<span style="color:var(--gold)">${ic(n,64)}</span>`}
let awQ=[],awOn=0;
function award(title,text,icon){awQ.push({title,text,icon});if(!awOn)nextAward()}
function nextAward(){const a=awQ.shift(),d=$("award");if(!a){awOn=0;if(d){d.className="";d.innerHTML=""}return}awOn=1;d.innerHTML=`<div class="aw" role="dialog" aria-live="polite"><div class="aw-ico">${awIcon(a.icon)}</div><div class="aw-k">Congratulations!</div><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p><button class="pri lg wide" onclick="nextAward()">${awQ.length?"Next ("+awQ.length+" more)":"Nice!"}</button></div>`;d.className="show";rain()}
function cheer(msg,icon){toast(msg,"",icon||"star");rain(2000)}
function prPop(ex,kinds){toast("New PR on "+ex+": "+kinds.join(", "),"pr","trophy");rain(1500)}
function beep(){try{const a=new AudioContext(),o=a.createOscillator();o.connect(a.destination);o.frequency.value=880;o.start();o.stop(a.currentTime+.4)}catch(e){}}
/* rest timer */
function rStart(s){rest.t=s;$("rt").style.display="block";clearInterval(rest.iv);rest.iv=setInterval(()=>{rest.t--;rShow();if(rest.t<=0){rStop();beep();toast("Rest over. Next set!","","timer")}},1e3);rShow()}
const rShow=()=>{$("rtn").textContent=Math.floor(rest.t/60)+":"+String(rest.t%60).padStart(2,"0")},rAdd=n=>{rest.t+=n;rShow()},rStop=()=>{clearInterval(rest.iv);$("rt").style.display="none"};

/* ---------- modal / sheet ---------- */
let MSK=[];
function mh(title,back){return `<div class="sh-h">${back?`<button class="ibtn ghost" onclick="popModal()" aria-label="Back">${ic("chevL")}</button>`:""}<h2>${title}</h2><button class="ibtn ghost" onclick="closeModal()" aria-label="Close">${ic("x")}</button></div>`}
function paintModal(wide){const m=$("modal"),s=$("sheet"),fn=MSK[MSK.length-1],r=fn();s.innerHTML=typeof r=="string"?r:r.html;s.className="sheet"+(wide?" wd":"");m.classList.add("show");document.body.classList.add("nosc");if(r.after)r.after();const af=s.querySelector("[autofocus]");if(af&&!(matchMedia&&matchMedia("(pointer:coarse)").matches))af.focus()}
function openModal(fn,wide){MSK=[fn];paintModal(wide);$("sheet").scrollTop=0}
function pushModal(fn){MSK.push(fn);paintModal();$("sheet").scrollTop=0}
function popModal(){MSK.pop();if(MSK.length)paintModal();else closeModal()}
function closeModal(){MSK=[];const m=$("modal");if(m)m.classList.remove("show");document.body.classList.remove("nosc")}
const repaintModal=()=>{if(MSK.length){const s=$("sheet"),t=s.scrollTop;paintModal();s.scrollTop=t}};
const modalOpen=()=>MSK.length>0;
document.addEventListener("keydown",e=>{if(e.key=="Escape"&&modalOpen())closeModal()});

/* ---------- picker: a searchable list in a sheet. Used for foods, meals, exercises, routines, ingredients. ---------- */
let PK=null;
function openPicker(o){PK=Object.assign({q:"",f:"",sel:{}},o);(o.push&&modalOpen()?pushModal:openModal)(pkView)}
function pkView(){const o=PK;return{html:mh(esc(o.title),MSK.length>1)+`<label class="search"><span class="ic-w">${ic("search")}</span><input id="pkq" type="search" placeholder="${esc(o.ph||"Search")}" value="${esc(o.q)}" oninput="PK.q=this.value;pkList()" autocomplete="off" autofocus></label>${o.filters?`<div class="chips" id="pkf"></div>`:""}${o.multi?`<div class="row"><button class="pri grow" id="pkdone" onclick="pkDone()">Done</button></div>`:""}${o.create?`<div class="row tight"><button class="soft wide" onclick="pkCreate()">${ic("plus")} ${esc(o.create.label)}</button></div>`:""}<div class="pkl" id="pkl"></div>`,after:()=>{pkFilt();pkList()}}}
function pkFilt(){if(!PK.filters)return;$("pkf").innerHTML=PK.filters.map(a=>`<button class="chip ${PK.f==a[0]?"sel":""}" onclick="PK.f='${a[0]}';pkFilt();pkList()">${esc(a[1])}</button>`).join("")}
function pkList(){const o=PK,L=o.items(o.q,o.f).slice(0,100);o.cur=L;const e=$("pkl");if(!e)return;e.innerHTML=L.map((x,i)=>`<div class="item tap" onclick="pkPick(${i})">${x.av?`<span class="av ${x.avc||""}">${x.av}</span>`:""}<div class="tx"><div class="t">${esc(x.t)}</div>${x.s?`<div class="s">${esc(x.s)}</div>`:""}</div>${o.multi?`<span class="chip ${o.sel[x.id]?"sel":""}">${o.sel[x.id]?"Added":"Add"}</span>`:x.r?`<div class="r">${x.r}</div>`:""}</div>`).join("")||`<p class="empty">${ic("search",28)}${esc(o.empty||"No matches. Try a different word.")}</p>`;
 if(o.multi){const b=$("pkdone");if(b)b.textContent="Done ("+Object.keys(o.sel).length+" selected)"}}
function pkPick(i){const x=PK.cur[i];if(!x)return;if(PK.multi){PK.sel[x.id]?delete PK.sel[x.id]:PK.sel[x.id]=x;pkList();return}const f=PK.onPick,keep=PK.keep;if(!keep){MSK.length>1?popModal():closeModal()}f(x.id,x)}
function pkDone(){const f=PK.onDone,ids=Object.keys(PK.sel);closeModal();f&&f(ids)}
function pkCreate(){const f=PK.create.fn,q=PK.q;f(q)}
const searchBox=(id,ph,val,fn,mic)=>`<label class="search ${mic?"hasmic":""}"><span class="ic-w">${ic("search")}</span><input id="${id}" type="search" placeholder="${esc(ph)}" value="${esc(val||"")}" oninput="${fn}" autocomplete="off">${mic?`<button class="ibtn sm ghost mic" id="mic_${id}" onclick="event.preventDefault();voiceStart('${id}',${mic==="send"})" aria-label="Speak">${ic("mic")}</button>`:""}</label>`;

/* ---------- small shared bits ---------- */
const sel=(id,o,c,ex)=>`<select id="${id}" ${ex||""}>${o.map(a=>`<option value="${a[0]}" ${String(c)==String(a[0])?"selected":""}>${esc(a[1])}</option>`).join("")}</select>`;
const ring=(v_,mx,lab,u,col)=>{const C=2*Math.PI*34,p_=Math.min(1,mx?v_/mx:0);return `<div class="rg"><svg viewBox="0 0 90 90"><circle cx="45" cy="45" r="34" fill="none" stroke="var(--in)" stroke-width="9"/><circle cx="45" cy="45" r="34" fill="none" stroke="${v_>mx*1.1?"#e5484d":col}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(C*p_).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 45 45)" style="transition:stroke-dasharray .9s"/><text x="45" y="50" text-anchor="middle" font-size="16" font-weight="800" fill="currentColor">${R(v_)}</text></svg>${lab}<br>of ${R(mx)}${u}</div>`};
const macBar=(n,v_,mx,col)=>`<div class="mb"><span class="nm">${n}</span><div class="bar2 thin ${v_>mx*1.1?"over":""}"><div style="width:${Math.min(100,mx?v_/mx*100:0)}%;${col?"background:"+col:""}"></div></div><span class="nu">${R(v_)} / ${R(mx)} g</span></div>`;
const empty=(icn,t,btn)=>`<div class="empty">${ic(icn,30)}<div>${t}</div>${btn||""}</div>`;
const rkPct=()=>{const r=rank(),nx=RANKS[r.i+1];return nx?Math.round(Math.max(0,Math.min(100,(S.xp-(r.lv-1)*100)/((nx.lv-r.lv)*100)*100))):100};
const rkBtn=()=>{const r=rank();return `<button class="lvlbtn" onclick="openLevel()" aria-label="Your level and rank: ${r.n}, level ${lvl()}"><span class="rgw" style="--p:${rkPct()}">${badge(r.i,26,{label:r.n,u:"tb"})}</span><span class="lt">${r.n}<b>Level ${lvl()}</b></span></button>`};
function applyTheme(){const r=document.documentElement,t=(S&&S.theme)||{};r.style.setProperty("--ac",t.ac||"");r.style.setProperty("--ac2",t.ac2||"");if(t.mode&&t.mode!="auto")r.dataset.theme=t.mode;else delete r.dataset.theme}
function th(){const o=["auto","light","dark"];S.theme.mode=o[(o.indexOf(S.theme.mode)+1)%3];toast("Theme: "+S.theme.mode);go()}

/* ---------- navigation ---------- */
const NAV=[["home","Today","home"],["food","Food","food"],["train","Train","dumbbell"],["meals","Meals","meals"],["shop","Shop","cart"],["coach","Coach","sparkles"]];
const SIDE=[["prog","Progress","chart"],["xp","Earn XP","bolt"],["me","Profile","user"]];
const TITLES={home:"Today",food:"Food diary",meals:"Meals",shop:"Shopping",train:"Workouts",coach:"Coach",prog:"Progress",xp:"How to earn XP",me:"Profile and settings"};
const ROUTE={prep:["meals","prep"],log:["food"],cal:["home","cal"],plan:["meals","plan"],chat:["coach"]};
let pTab="",pSub="";
function go(t,s){let nav=false;if(t){const m=ROUTE[t];if(m){t=m[0];s=s||m[1]}if(t!=tab||(s&&sub[t]!=s))nav=true;tab=t;if(s)sub[t]=s;if(t=="train"&&S&&S.run)runMin=false}
 const y=window.scrollY;applyTheme();if(S)chkTier();
 if(!S){$("app").innerHTML=authV();window.scrollTo(0,0);return}
 const main=(V[tab]||V.home)();
 $("app").innerHTML=shell(main);
 window.scrollTo(0,nav?0:y);
 pTab=tab;pSub=sub[tab];
 if(tab=="coach"){const c=$("ch");if(c)c.scrollTop=c.scrollHeight}
 if(typeof after=="function")after();save()}
const subs=(cur,list,fn)=>`<div class="seg" role="tablist">${list.map(a=>`<button class="${cur==a[0]?"on":""}" role="tab" aria-selected="${cur==a[0]}" onclick="${fn}('${a[0]}')">${a[1]}</button>`).join("")}</div>`;
function shell(main){const wip=S.run&&(tab!="train"||runMin);
 const nb=(a,cls)=>`<button class="${cls} ${tab==a[0]?"on":""}" onclick="go('${a[0]}')" aria-label="${a[1]}" ${tab==a[0]?'aria-current="page"':""}>${ic(a[2],cls=="nv"?20:23)}<span>${a[1]}</span></button>`;
 return `<div class="shell"><aside class="side"><div class="brand"><img src="icon.svg" alt="">Setpoint</div>${NAV.concat(SIDE).map(a=>nb(a,"nv")).join("")}<div class="sp"></div><div class="sep"></div><button class="nv" onclick="th()">${ic("contrast",20)}<span>Theme: ${S.theme.mode}</span></button><button class="nv" onclick="go('me','legal')">${ic("shield",20)}<span>Legal and help</span></button><button class="nv" onclick="logout()">${ic("logout",20)}<span>Log out</span></button></aside>
 <div class="col"><header class="bar"><div class="brand"><img src="icon.svg" alt="">${tab=="home"?"Setpoint":""}</div><div class="ttl">${tab=="home"?"":TITLES[tab]}</div>${rkBtn()}<button class="ibtn ghost mmore" onclick="openMore()" aria-label="More">${ic("menu",22)}</button></header>
 <main class="main" id="main">${wip?`<div class="wip" onclick="runMin=false;go('train')" role="button" tabindex="0">${ic("dumbbell",20)}<div class="grow">Workout in progress: ${esc(S.run.n)}</div><b id="wipt">${runClock()}</b><span>Resume</span></div>`:""}${main}</main></div>
 <nav class="bnav" aria-label="Main">${NAV.map(a=>nb(a,"bn")).join("")}</nav></div>`}
const runClock=()=>{if(!S||!S.run)return"0:00";const s=Math.max(0,Math.floor((Date.now()-S.run.t)/1e3)),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return (h?h+":"+String(m).padStart(2,"0"):m)+":"+String(s%60).padStart(2,"0")};
setInterval(()=>{if(!S||!S.run)return;const t=runClock();["wipt","wot"].forEach(i=>{const e=$(i);if(e)e.textContent=t})},1000);
function openMore(){openModal(()=>mh("More")+`<div class="menu">${[["prog","Progress","chart"],["xp","How to earn XP","bolt"],["me","Profile and settings","user"]].map(a=>`<button onclick="closeModal();go('${a[0]}')">${ic(a[2],22)}${a[1]}</button>`).join("")}<button onclick="closeModal();go('home','cal')">${ic("cal",22)}Calendar</button><button onclick="closeModal();go('me','legal')">${ic("shield",22)}Privacy, terms and health notice</button><button onclick="th();repaintModal()">${ic("contrast",22)}Theme: ${S.theme.mode} (tap to change)</button><button class="dg" onclick="closeModal();logout()">${ic("logout",22)}Log out</button></div>`)}
