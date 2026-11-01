const express=require('express'),http=require('http'),{Server}=require('socket.io'),crypto=require('crypto'),{Table,CONFIG}=require('./engine'),BIL=require('./bilan');BIL.load();
const app=express();app.use(require('compression')());const fs=require('fs');const IDX=fs.readFileSync(__dirname+'/public/index.html','utf8');
const esc=x=>String(x).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const SITE='https://poker-stephane.onrender.com';
function page(q,r,code){code=code?String(code).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12):'';
 const url=SITE+(code?'/t/'+code:'/'),t="Steph's Table — Tu es invité à la table !",d=(code?'Table '+code+' · ':'')+'Poker entre amis · Hold\'em · Omaha · Draw · Stud · Neuilly-sur-Seine',img=SITE+'/og-invite-v5.jpg';
 const m=`<meta property="og:type" content="website"><meta property="og:site_name" content="Steph's Table"><meta property="og:title" content="${esc(t)}"><meta property="og:description" content="${esc(d)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${img}"><meta property="og:image:secure_url" content="${img}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Steph's Table — Tu es invité à la table !"><meta property="og:locale" content="fr_FR"><meta name="description" content="${esc(d)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(t)}"><meta name="twitter:description" content="${esc(d)}"><meta name="twitter:image" content="${img}">`;
 r.set('Cache-Control','no-cache');r.type('html').send(IDX.replace('<!--OG-->',m));}
app.get(['/','/index.html'],(q,r)=>page(q,r));// cache : polices et images longues (1 an, immuables), le reste court ; index.html jamais mis en cache
app.use(express.static(__dirname+'/public',{index:false,setHeaders:(res,p)=>{if(/\.(woff2|webp|png|jpg)$/.test(p))res.setHeader('Cache-Control','public, max-age=31536000, immutable');else res.setHeader('Cache-Control','public, max-age=300');}}));app.get('/t/:code',(q,r)=>page(q,r,q.params.code));
const GRACE=+process.env.GRACE_MS||120000,AWAY=+process.env.AWAY_MS||30000;
const srv=http.createServer(app),io=new Server(srv,{cors:{origin:'*'}});const rooms={};
// Sessions propres : aucune restauration de tables au démarrage, rien n'est sauvegardé.
const code=()=>crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();
function push(r){syncB(r);for(const [sid,tok] of Object.entries(r.sockets)){const s=io.sockets.sockets.get(sid);if(s)s.emit('state',{...r.t.view(tok),code:r.code,host:r.host===tok});}}
io.on('connection',sock=>{let room=null,tok=null;
  sock.on('create',({name,sb,bb,token},cb)=>{const mode='holdem';const c=code();const t=new Table({mode,sb:+sb||CONFIG.SB,bb:+bb||CONFIG.BB,awayDelay:AWAY,dealerChoice:true,choiceTimeout:+process.env.CHOICE_MS||15000});
    const r=rooms[c]={code:c,t,host:token,sockets:{},grace:{}};t.onChange=()=>push(r);wrapB(r);cb&&cb({code:c});});
  sock.on('join',({code:c,name,token,avatar,photo},cb)=>{const r=rooms[(c||'').toUpperCase()];if(!r)return cb&&cb({error:CLOSED,closed:true});
    tok=String(token||sock.id);let i=r.t.seatOf(tok);const av0=cleanAv(avatar),ph=cleanPh(photo),av=ph?'photo':av0;
    // règle unique des pseudos (serveur) : reconnexion du même jeton -> nom du siège conservé
    const nm=i>=0?r.t.seats[i].name:normName(name);if(!nm)return cb&&cb({error:'Choisis un pseudo'});
    const bad=bindErr(nm,av);
    if(i<0){if(bad)return cb&&cb({error:bad});
      const j=r.t.seats.findIndex(x=>x&&nameKey(x.name)===nameKey(nm));
      if(j>=0){const x=r.t.seats[j];// reprise depuis un autre appareil : siège déconnecté, en délai de grâce, même pseudo ET même avatar (non vide)
        if(x.connected||!r.grace[x.id]||!av||x.avatar!==av)return cb&&cb({error:'Ce pseudo est déjà pris'});
        const old=x.id;clearTimeout(r.grace[old]);delete r.grace[old];if(r.host===old)r.host=tok;if(r.photos&&r.photos[old]){r.photos[tok]=r.photos[old];delete r.photos[old];}x.id=tok;i=j;r.t.log.push(x.name+' reprend sa place');}}
    room=r;
    if(i>=0&&r.grace[tok]){clearTimeout(r.grace[tok]);delete r.grace[tok];}
    if(i<0){i=r.t.addPlayer(tok,nm);if(i<0){r.sockets[sock.id]=tok;sock.join('r'+r.code);cb&&cb({ok:true,spectator:true,name:nm,msg:'Table complète'});return push(r);}r.t.log.push(r.t.seats[i].name+' rejoint la table');}
    {r.t.setConnected(tok,true);const st=r.t.seats[i];if(!bad){st.avatar=av;r.photos=r.photos||{};if(ph)r.photos[tok]=ph;else if(av!=='photo')delete r.photos[tok];}}r.sockets[sock.id]=tok;sock.join('r'+r.code);cb&&cb({ok:true,name:nm,avatar:r.t.seats[i].avatar});push(r);sendPhotos(r);if(r.voice)sendVoice(r);});
  const g=f=>(...a)=>{if(room){f(...a);push(room);}};
  sock.on('start',g(()=>{if(room.host===tok||room.t.stage==='showdown')room.t.startHand();}));
  sock.on('choose',g(v=>{if(v&&typeof v==='object')room.t.chooseVariant(tok,v.v,false,v.bb);else room.t.chooseVariant(tok,v);}));
  sock.on('act',g(({action,amount})=>room.t.act(tok,action,amount)));
  sock.on('settings',g(({sb,bb})=>{if(room.host!==tok)return;const t=room.t;if(!['waiting','showdown'].includes(t.stage))return;if(!sb&&!bb)return;if(+sb&&sb%100===0)t.sb=+sb;if(+bb&&bb%100===0)t.bb=+bb;t.log.push('Blindes : '+t.sb+'/'+t.bb);}));
  sock.on('reset',g(()=>{if(room.host===tok){room.t.fullReset();io.to('r'+room.code).emit('toast','Table réinitialisée : tout le monde repart à 5 000');}}));
  // réactions rapides : liste fermée, 1 par seconde et par joueur (côté serveur)
  sock.on('react',e=>{if(!room||!REACT.includes(e))return;const now=Date.now();room.rx=room.rx||{};if(now-(room.rx[tok]||0)<1000)return;room.rx[tok]=now;
    const i=room.t.seatOf(tok);if(i<0)return;io.to('r'+room.code).emit('react',{seat:i,e});});
  // 25 : vocal WebRTC — le serveur ne relaie que la signalisation (offre/réponse/ICE) entre sockets de la même table
  sock.on('vjoin',()=>{if(!room||!room.sockets[sock.id])return;room.voice=room.voice||{};room.voice[sock.id]={muted:false};sendVoice(room);});
  sock.on('vleave',()=>{if(room&&room.voice&&room.voice[sock.id]){delete room.voice[sock.id];sendVoice(room);}});
  sock.on('vmute',m=>{if(room&&room.voice&&room.voice[sock.id]){room.voice[sock.id].muted=!!m;sendVoice(room);}});
  let vq=[];sock.on('vsig',msg=>{if(!room||!msg||typeof msg.to!=='string')return;const now=Date.now();vq=vq.filter(t=>now-t<1000);if(vq.length>=VRATE)return;vq.push(now);
    const v=room.voice||{};if(!v[sock.id]||!v[msg.to]||!room.sockets[msg.to])return;let d;try{d=JSON.stringify(msg.data);}catch(e){return;}if(!d||d.length>VMAX)return;
    io.to(msg.to).emit('vsig',{from:sock.id,data:msg.data});});
  // changement d'avatar en cours de partie (portrait, emoji, photo ou initiale)
  sock.on('avatar',g((o,cb)=>{const i=room.t.seatOf(tok);if(i<0||!o||typeof o!=='object')return;const ph=cleanPh(o.photo),av=ph?'photo':cleanAv(o.avatar);const bad=bindErr(room.t.seats[i].name,av);if(bad){typeof cb==='function'?cb({error:bad}):sock.emit('toast',bad);return;}room.t.seats[i].avatar=av;if(typeof cb==='function')cb({ok:true});room.photos=room.photos||{};if(ph)room.photos[tok]=ph;else delete room.photos[tok];sendPhotos(room);}));
  sock.on('comptes',(x,cb)=>{if(typeof cb==='function')cb({total:BIL.list(),canReset:!!room&&room.host===tok});});
  sock.on('comptesReset',(x,cb)=>{if(typeof cb!=='function')return;if(!room||room.host!==tok)return cb({error:'Seul l\'hôte de la table peut remettre le bilan à zéro'});try{const f=BIL.reset();room.t.log.push('Bilan général remis à zéro (sauvegarde '+f+')');cb({ok:true,file:f,total:BIL.list()});push(room);}catch(e){cb({error:'Erreur : bilan non modifié'});}});
  sock.on('rebuy',g(amount=>room.t.rebuy(tok,amount===undefined?1000:amount)));
  sock.on('disconnect',()=>{if(!room)return;const r=room;delete r.sockets[sock.id];if(r.voice&&r.voice[sock.id]){delete r.voice[sock.id];sendVoice(r);}
    if(!Object.values(r.sockets).includes(tok)&&r.t.seatOf(tok)>=0){r.t.setConnected(tok,false);clearTimeout(r.grace[tok]);
      r.grace[tok]=setTimeout(()=>{delete r.grace[tok];if(r.t.seatOf(tok)<0||r.t.seats[r.t.seatOf(tok)].connected)return;endB(r,r.t.seats[r.t.seatOf(tok)]);r.t.removePlayer(tok);
        if(r.host===tok){const n=r.t.seats.find(x=>x&&x.connected)||r.t.seats.find(x=>x);if(n){r.host=n.id;r.t.log.push(n.name+' devient hôte');}}cleanup(r);},GRACE);}
    cleanup(r);});
});
const REACT=['😂','😱','👏','🍀','🔥','😎','🤮'];
const AVS=['p:stephane','p:david','p:john','p:thomas','p:fred','p:lolo','🦊','🐼','🐯','🦁','🐸','🐵','🐙','🦄','🐺','🐻','🐨','🐷','😎','🤠','🥷','🧙','👑','🎩','💎','🔥','🍀','🎲','🃏','🚀'];
const CLOSED='La table a été fermée (mise à jour du site), crée-en une nouvelle';
const strip=n=>String(n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
// pseudo : espaces nettoyés, 14 caractères max, Stéphane/David -> Steph/Dave
function normName(n){const t=String(n||'').replace(/\s+/g,' ').trim(),k=strip(t);return (k==='stephane'?'Steph':k==='david'?'Dave':t).slice(0,14).trim();}
// clé de comparaison : sans accents, majuscules ni espaces
const nameKey=n=>strip(normName(n)).replace(/\s/g,'');
// portraits liés à leur pseudo
const BIND={steph:'p:stephane',dave:'p:david',john:'p:john',thomas:'p:thomas',fred:'p:fred',lolo:'p:lolo'},PNAME={'p:stephane':'Steph','p:david':'Dave','p:john':'John','p:thomas':'Thomas','p:fred':'Fred','p:lolo':'Lolo'};
function bindErr(nm,av){const want=BIND[nameKey(nm)];if(PNAME[av]&&want!==av)return 'Ce portrait va avec le pseudo '+PNAME[av];if(want&&av!==want)return 'Ce pseudo va avec son portrait';return null;}
function cleanAv(a){return AVS.includes(a)?a:null;}
function cleanPh(p){return typeof p==='string'&&p.length<=21000&&/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(p)?p:null;}
// photos envoyées à part (pas dans chaque état) : indexées par siège
function sendPhotos(r){const m={};(r.t.seats||[]).forEach((s,i)=>{if(s&&s.avatar==='photo'&&r.photos&&r.photos[s.id])m[i]=r.photos[s.id];});io.to('r'+r.code).emit('photos',m);}
const VMAX=+process.env.VMAX||12000,VRATE=+process.env.VRATE||60;
function sendVoice(r){const l=Object.entries(r.voice||{}).filter(([sid])=>r.sockets[sid]).map(([sid,v])=>({sid,seat:r.t.seatOf(r.sockets[sid]),muted:v.muted}));io.to('r'+r.code).emit('voice',l);}
function cleanup(r){if(!rooms[r.code])return;if(!r.t.seats.some(x=>x)&&!Object.keys(r.sockets).length||!r.t.seats.some(x=>x)&&!Object.keys(r.grace).length&&!Object.keys(r.sockets).length){clearTimeout(r.t.timer);clearTimeout(r.t.awayT);delete rooms[r.code];for(const id of BIL.ids(r.code))BIL.commit(id);return;}push(r);}
srv.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Poker sur :'+(process.env.PORT||3000)));
// ---- comptes : chaque siège a un identifiant de partie (pid) ; reprise/reconnexion gardent le même siège donc le même pid
function netOf(t,i){const s=t.seats[i],h=t.hand;return s.chips+(h&&h.pl[i]&&t.stage!=='showdown'?h.pl[i].total:0)-(s.engaged||CONFIG.STACK);}
function syncB(r){const seen=new Set();r.t.seats.forEach((s,i)=>{if(!s)return;if(!s.pid)s.pid=r.code+'-'+crypto.randomBytes(6).toString('hex');seen.add(s.pid);BIL.live(s.pid,r.code,nameKey(s.name),s.name,netOf(r.t,i));});
  for(const id of BIL.ids(r.code))if(!seen.has(id))BIL.commit(id);}
function endB(r,s){if(!s||!s.pid)return;BIL.live(s.pid,r.code,nameKey(s.name),s.name,s.chips-(s.engaged||CONFIG.STACK));BIL.commit(s.pid);s.pid=null;}
// remise des piles à 5 000 = fin de partie pour tous : on solde puis on repart sur une nouvelle partie
function wrapB(r){const t=r.t,fr=t.fullReset.bind(t),rs=t.resetStacks.bind(t);
  const all=()=>{syncB(r);t.seats.forEach(s=>{if(s&&s.pid){BIL.commit(s.pid);s.pid=null;}});};
  t.fullReset=()=>{all();return fr();};
  t.resetStacks=()=>{if(t.stage==='waiting'||t.stage==='showdown')all();return rs();};}
