/* Setpoint social: usernames, friends, friend groups and leaderboards.
   Everything goes through Supabase functions created by social.sql. Only a username, level, rank and XP are shared. */
const SO={me:null,loaded:false,busy:false,dead:false,err:"",msg:"",per:"week",friends:null,groups:null,glob:null,grank:null,gid:null,gb:null,pk:"",pt:0,tm:0};
const soOn=()=>!!(typeof sb!="undefined"&&sb&&S&&S.cloud);
const soMsg=e=>{const m=String(e&&e.message||e||"");if(/Could not find the function|schema cache|PGRST20|relation .* does not exist/i.test(m)){SO.dead=true;return"Leaderboards aren’t switched on yet. The owner needs to run social.sql in Supabase."}if(/fetch|network|Failed to|timeout/i.test(m))return"Couldn’t reach the server. Check your connection and try again.";if(/JWT|not authenticated|Please sign in/i.test(m))return"Please sign in again.";return m.slice(0,160)};
async function soRpc(fn,args){const r=await sb.rpc(fn,args||{});if(r.error)throw r.error;return r.data}
const soNm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,20);
/* ---- keep my XP on the server (runs quietly after changes) ---- */
function soQueue(){if(!soOn()||SO.dead)return;const k=S.xp+":"+lvl()+":"+(isMinor()?1:0);if(k===SO.pk&&SO.loaded)return;clearTimeout(SO.tm);SO.tm=setTimeout(soPush,SO.loaded?6000:2500)}
async function soPush(){if(!soOn()||SO.dead)return;try{if(!SO.loaded){const m=await soRpc("soc_me");SO.me=(m&&m[0])||null;SO.loaded=true}
 if(!SO.me)return;await soAvatarSync();const k=S.xp+":"+lvl()+":"+(isMinor()?1:0);if(k===SO.pk)return;await soRpc("soc_push",{p_xp:S.xp|0,p_lvl:lvl(),p_rk:rankIdx(),p_minor:isMinor()});SO.pk=k}catch(e){soMsg(e)}}
/* ---- my profile picture on the server (sent once per change) ---- */
const soHash=s=>{let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return String(h)+":"+s.length};
async function soAvatarSync(force){if(!soOn()||SO.dead||!SO.me)return;const p=S.user.pic||"",k=p?soHash(p):"none";if(!force&&(S.user.ps||"")===k)return;if(!force&&!p&&!S.user.ps)return;try{await soRpc("soc_set_avatar",{p_avatar:p||null});S.user.ps=k;save(true)}catch(e){soMsg(e)}}
/* ---- load what the current tab needs ---- */
async function soRefresh(){if(!soOn()||SO.busy||SO.dead)return;SO.busy=true;SO.err="";
 try{const m=await soRpc("soc_me");SO.me=(m&&m[0])||null;SO.loaded=true;
  if(SO.me){await soPush();const t=sub.board||"friends";
   if(t=="friends")SO.friends=await soRpc("soc_friends");
   else if(t=="groups"){SO.groups=await soRpc("soc_groups");if(SO.gid&&SO.groups.some(g=>g.id==SO.gid))SO.gb=await soRpc("soc_group_board",{p_id:SO.gid,p_period:SO.per});else{SO.gid=null;SO.gb=null}}
   else if(t=="global"&&!SO.me.minor){SO.glob=await soRpc("soc_global",{p_period:SO.per});SO.grank=SO.glob.some(r=>r.is_me)?null:await soRpc("soc_global_rank",{p_period:SO.per})}}}
 catch(e){SO.err=soMsg(e);SO.loaded=true}
 SO.busy=false;if(tab=="board"&&!modalOpen())go()}
const boardSub=k=>{sub.board=k;SO.err="";SO.msg="";go();soRefresh()};
const soPer=p=>{SO.per=p;go();soRefresh()};
/* ---- pieces ---- */
const soNote=t=>`<div class="card"><div class="empty">${ic("trophy",30)}<div>${t}</div></div></div>`;
const soRows=(rows,act)=>`<div class="lb">${rows.map((r,i)=>`<div class="lbr ${r.is_me?"me":""}" ${!r.is_me&&act?`role="button" tabindex="0" onclick="${act}(${jq(r.username)})"`:""}><span class="lbn">${i+1}</span>${avRank(r.is_me?S.user.pic:r.avatar,r.username,42,r.rk,"lb"+i)}<div class="grow"><div class="b lbu">${esc(r.username)}${r.is_me?" (you)":""}</div><div class="mut sm-t">Level ${r.lvl} · ${(RANKS[Math.max(0,Math.min(9,r.rk))]||RANKS[0]).n}</div></div><b class="lbx">${(SO.per=="week"?r.wk:r.xp).toLocaleString()} <small>XP</small></b></div>`).join("")}</div>`;
const soPerChips=()=>`<div class="chips"><button class="chip ${SO.per=="week"?"sel":""}" onclick="soPer('week')">This week</button><button class="chip ${SO.per=="all"?"sel":""}" onclick="soPer('all')">All time</button></div>`;
const soErrBox=()=>(SO.err?`<div class="note bad" role="alert">${esc(SO.err)}</div>`:"")+(SO.msg?`<div class="note ok" role="status">${esc(SO.msg)}</div>`:"");
function soSetup(){return `<div class="card tint"><h2>Choose a username</h2><p class="mut">Friends find you by your username. It is the only thing other people see, together with your level, rank and XP. Your name, email and food or workout data stay private.</p>${isMinor()?`<p class="mut sm-t">Under-18 accounts appear only to friends and groups, never on the global leaderboard.</p>`:""}<label class="fld"><span>Username (3 to 20 letters, numbers or _)</span><input id="sou" maxlength="20" autocapitalize="none" autocomplete="off" spellcheck="false" oninput="this.value=soNm(this.value)" onkeydown="if(event.key=='Enter')soSave()"></label>${soErrBox()}<button class="pri lg wide" onclick="soSave()">Save username</button></div>`}
async function soSave(){const n=soNm(v("sou"));if(n.length<3){SO.err="Usernames are 3 to 20 characters: letters, numbers and underscores only.";return go()}
 try{await soRpc("soc_set_username",{p_name:n,p_minor:isMinor()});SO.err="";SO.me={username:n,show_global:true,minor:isMinor()};SO.pk="";closeModal();toast("You are "+n,"","user");await soAvatarSync(true);await soPush();go();soRefresh()}catch(e){SO.err=soMsg(e);if($("sou"))go();else{toast(SO.err);}}}
function soChange(){openModal(()=>mh("Change username")+`<label class="fld"><span>New username</span><input id="sou" maxlength="20" value="${esc(SO.me?SO.me.username:"")}" autocapitalize="none" autocomplete="off" spellcheck="false" oninput="this.value=soNm(this.value)"></label><button class="pri lg wide" onclick="soSave()">Save</button>`)}
/* ---- friends ---- */
function soFriendsV(){const L=SO.friends;if(!L)return `<div class="card"><div class="empty">Loading…</div></div>`;
 const fr=L.filter(r=>r.kind=="friend").sort((a,b)=>(SO.per=="week"?b.wk-a.wk:b.xp-a.xp)||b.xp-a.xp),inc=L.filter(r=>r.kind=="incoming"),out=L.filter(r=>r.kind=="outgoing");
 return `<div class="card"><h2>Add a friend</h2><div class="row nw"><input id="sof" placeholder="Their username" maxlength="20" autocapitalize="none" autocomplete="off" spellcheck="false" oninput="this.value=soNm(this.value)" onkeydown="if(event.key=='Enter')soAdd()"><button class="pri" onclick="soAdd()">Send request</button></div>${soErrBox()}</div>
 ${inc.length?`<div class="card"><h3>Friend requests</h3>${inc.map(r=>`<div class="item"><div class="tx"><div class="t">${esc(r.username)}</div><div class="s">Level ${r.lvl}</div></div><button class="sm pri" onclick="soResp(${r.fid},true)">Accept</button><button class="sm" onclick="soResp(${r.fid},false)">Decline</button></div>`).join("")}</div>`:""}
 <div class="card"><div class="ch"><h2>Friends leaderboard</h2></div>${soPerChips()}${fr.length>1?soRows(fr,"soUser"):soRows(fr,"soUser")+`<p class="mut tc gap">Add a friend by their username and race them up the ranks.</p>`}</div>
 ${out.length?`<div class="card"><h3>Waiting for a reply</h3>${out.map(r=>`<div class="item"><div class="tx"><div class="t">${esc(r.username)}</div></div><button class="sm" onclick="soRem(${jq(r.username)})">Cancel</button></div>`).join("")}</div>`:""}`}
async function soAdd(){const n=soNm(v("sof"));if(!n)return;try{SO.msg=await soRpc("soc_friend_request",{p_username:n});SO.err="";SO.friends=await soRpc("soc_friends");go()}catch(e){SO.err=soMsg(e);SO.msg="";go()}}
async function soResp(id,ok){try{await soRpc("soc_friend_respond",{p_id:id,p_accept:ok});SO.friends=await soRpc("soc_friends");go()}catch(e){toast(soMsg(e))}}
async function soRem(n){try{await soRpc("soc_friend_remove",{p_username:n});closeModal();SO.friends=await soRpc("soc_friends");toast("Removed");go()}catch(e){toast(soMsg(e))}}
/* ---- groups ---- */
function soGroupsV(){const G=SO.groups;if(!G)return `<div class="card"><div class="empty">Loading…</div></div>`;
 return `<div class="grid g2"><div class="card"><h3>Start a group</h3><p class="mut sm-t">Make a group for family, a gym crew or your team, then share the code.</p><div class="row nw"><input id="sgn" placeholder="Group name" maxlength="30" onkeydown="if(event.key=='Enter')soMake()"><button class="pri" onclick="soMake()">Create</button></div></div>
 <div class="card"><h3>Join with a code</h3><p class="mut sm-t">Ask a friend for their 6-character group code.</p><div class="row nw"><input id="sgc" placeholder="Code" maxlength="6" autocapitalize="characters" autocomplete="off" oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'')" onkeydown="if(event.key=='Enter')soJoin()"><button class="pri" onclick="soJoin()">Join</button></div></div></div>${soErrBox()}
 ${G.length?G.map(g=>`<div class="card"><div class="ch"><h2>${esc(g.name)}</h2><button class="lnk" onclick="soOpenG(${g.id})">${SO.gid==g.id?"Hide":"View"}</button></div><div class="mut sm-t">${g.members} member${g.members==1?"":"s"} · Code <b>${esc(g.code)}</b> <button class="lnk" style="padding:0 4px" onclick="soCopy('${esc(g.code)}')">Copy</button></div>${SO.gid==g.id?`<div class="gap">${soPerChips()}${SO.gb?soRows(SO.gb,"soUser"):'<div class="empty">Loading…</div>'}<div class="row gap"><button class="sm dg" onclick="dbl('lg${g.id}',()=>soLeave(${g.id}))">${cfl("lg"+g.id,"Leave group")}</button></div></div>`:""}</div>`).join(""):soNote("You are not in a group yet. Start one or join with a code.")}`}
async function soMake(){const n=v("sgn").trim();if(n.length<2)return toast("Give the group a name");try{const r=await soRpc("soc_group_create",{p_name:n});const g=r&&r[0];SO.err="";SO.groups=await soRpc("soc_groups");SO.gid=g?g.gid:null;SO.gb=SO.gid?await soRpc("soc_group_board",{p_id:SO.gid,p_period:SO.per}):null;toast("Group created. Share the code "+(g?g.gcode:""),"","user");go()}catch(e){SO.err=soMsg(e);go()}}
async function soJoin(){const c=v("sgc").trim();if(c.length<6)return toast("Enter the 6-character code");try{const id=await soRpc("soc_group_join",{p_code:c});SO.err="";SO.groups=await soRpc("soc_groups");SO.gid=id;SO.gb=await soRpc("soc_group_board",{p_id:id,p_period:SO.per});toast("Joined","","user");go()}catch(e){SO.err=soMsg(e);go()}}
async function soOpenG(id){if(SO.gid==id){SO.gid=null;SO.gb=null;return go()}SO.gid=id;SO.gb=null;go();try{SO.gb=await soRpc("soc_group_board",{p_id:id,p_period:SO.per});go()}catch(e){toast(soMsg(e))}}
async function soLeave(id){try{await soRpc("soc_group_leave",{p_id:id});SO.gid=null;SO.gb=null;SO.groups=await soRpc("soc_groups");go()}catch(e){toast(soMsg(e))}}
function soCopy(t){try{navigator.clipboard.writeText(t).then(()=>toast("Code copied"),()=>toast("Code: "+t))}catch(e){toast("Code: "+t)}}
/* ---- global ---- */
function soGlobalV(){if(SO.me&&SO.me.minor)return soNote("The global leaderboard is for people aged 18 and over. Under-18 accounts use Friends and Groups.");
 const G=SO.glob;if(!G)return `<div class="card"><div class="empty">Loading…</div></div>`;
 return `<div class="card"><div class="ch"><h2>Global top 50</h2></div>${soPerChips()}${G.length?soRows(G,"soUser"):'<div class="empty">No one is on the board yet. Be the first.</div>'}${SO.grank?`<p class="tc gap">Your place: <b>#${SO.grank}</b></p>`:""}</div>
 <div class="card"><div class="row nw"><div class="grow"><div class="b">Show me on the global leaderboard</div><div class="mut sm-t">Friends and groups still see you.</div></div><button class="chip ${SO.me&&SO.me.show_global?"sel":""}" onclick="soGlob()">${SO.me&&SO.me.show_global?"On":"Off"}</button></div></div>`}
async function soGlob(){const on=!(SO.me&&SO.me.show_global);try{await soRpc("soc_set_global",{p_show:on});SO.me.show_global=on;SO.glob=await soRpc("soc_global",{p_period:SO.per});SO.grank=SO.glob.some(r=>r.is_me)?null:await soRpc("soc_global_rank",{p_period:SO.per});go()}catch(e){toast(soMsg(e))}}
/* ---- tapping another player ---- */
function soUser(n){const f=(SO.friends||[]).some(r=>r.kind=="friend"&&r.username==n);
 openModal(()=>mh(esc(n))+`<div class="menu">${f?`<button class="dg" onclick="dbl('rf',()=>soRem(${jq(n)}))">${ic("x",22)}${cfl("rf","Remove friend")}</button>`:`<button onclick="soAddN(${jq(n)})">${ic("plus",22)}Add friend</button>`}<button onclick="soRep(${jq(n)})">${ic("shield",22)}Report this username</button></div>`)}
async function soAddN(n){try{const m=await soRpc("soc_friend_request",{p_username:n});closeModal();toast(m);SO.friends=await soRpc("soc_friends")}catch(e){toast(soMsg(e))}}
function soRep(n){openModal(()=>mh("Report "+esc(n),true)+`<p class="mut">Why are you reporting this username?</p><div class="menu">${["Offensive username","Inappropriate profile picture","Harassment or bullying","Impersonation","Something else"].map(r=>`<button onclick="soSend(${jq(n)},${jq(r)})">${r}</button>`).join("")}</div>`)}
async function soSend(n,r){try{await soRpc("soc_report",{p_username:n,p_reason:r});closeModal();toast("Thanks. We’ll look into it.")}catch(e){toast(soMsg(e))}}
/* ---- page ---- */
V.board=()=>{sub.board=sub.board||"friends";
 if(!soOn())return soNote("Friends and leaderboards need a Setpoint account (email and password) so your friends can find you. You are using a profile stored on this device only.");
 if(SO.dead)return soNote(esc(SO.err||"Leaderboards aren’t switched on yet."));
 if(!SO.loaded){if(!SO.busy)setTimeout(soRefresh,0);return `<div class="card"><div class="empty">Loading…</div></div>`}
 if(!SO.me)return (SO.err&&!$("sou")?"":"")+soSetup();
 const tb=subs(sub.board,[["friends","Friends"],["groups","Groups"],["global","Global"]],"boardSub");
 const hd=`<div class="row nw" style="margin:0 0 10px"><span class="mut sm-t grow">Playing as <b>${esc(SO.me.username)}</b></span><button class="lnk" onclick="soChange()">Change</button></div>`;
 return tb+hd+({friends:soFriendsV,groups:soGroupsV,global:soGlobalV})[sub.board]()};
