const express=require('express'),http=require('http'),{Server}=require('socket.io'),crypto=require('crypto'),{Table,CONFIG}=require('./engine');
const app=express();const fs=require('fs');const IDX=fs.readFileSync(__dirname+'/public/index.html','utf8');
const esc=x=>String(x).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const SITE='https://poker-stephane.onrender.com';
function page(q,r,code){code=code?String(code).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12):'';
 const url=SITE+(code?'/t/'+code:'/'),t="Stéphane's Table — Tu es invité à la table !",d=(code?'Table '+code+' · ':'')+'Poker entre amis · Hold\'em · Omaha · Neuilly-sur-Seine',img=SITE+'/og-invite.jpg';
 const m=`<meta property="og:type" content="website"><meta property="og:site_name" content="Stéphane's Table"><meta property="og:title" content="${esc(t)}"><meta property="og:description" content="${esc(d)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${img}"><meta property="og:image:secure_url" content="${img}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Stéphane's Table — Tu es invité à la table !"><meta property="og:locale" content="fr_FR"><meta name="description" content="${esc(d)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(t)}"><meta name="twitter:description" content="${esc(d)}"><meta name="twitter:image" content="${img}">`;
 r.type('html').send(IDX.replace('<!--OG-->',m));}
app.get(['/','/index.html'],(q,r)=>page(q,r));app.use(express.static(__dirname+'/public'));app.get('/t/:code',(q,r)=>page(q,r,q.params.code));
const GRACE=+process.env.GRACE_MS||120000,AWAY=+process.env.AWAY_MS||30000;
const srv=http.createServer(app),io=new Server(srv,{cors:{origin:'*'}});const rooms={};
// Sessions propres : aucune restauration de tables au démarrage, rien n'est sauvegardé.
const code=()=>crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();
function push(r){for(const [sid,tok] of Object.entries(r.sockets)){const s=io.sockets.sockets.get(sid);if(s)s.emit('state',{...r.t.view(tok),code:r.code,host:r.host===tok});}}
io.on('connection',sock=>{let room=null,tok=null;
  sock.on('create',({name,mode,sb,bb,token},cb)=>{const c=code();const t=new Table({mode,sb:+sb||CONFIG.SB,bb:+bb||CONFIG.BB,awayDelay:AWAY});
    const r=rooms[c]={code:c,t,host:token,sockets:{},grace:{}};t.onChange=()=>push(r);cb&&cb({code:c});});
  sock.on('join',({code:c,name,token},cb)=>{const r=rooms[(c||'').toUpperCase()];if(!r)return cb&&cb({error:'Table introuvable'});
    room=r;tok=String(token||sock.id);let i=r.t.seatOf(tok);const nm=String(name||'Joueur').slice(0,14);
    // reconnexion par le même pseudo pendant le délai de grâce : on reprend le siège (et sa pile)
    if(i<0){const j=r.t.seats.findIndex(x=>x&&!x.connected&&x.name===nm);if(j>=0){const old=r.t.seats[j].id;clearTimeout(r.grace[old]);delete r.grace[old];if(r.host===old)r.host=tok;r.t.seats[j].id=tok;i=j;}}
    if(i>=0&&r.grace[tok]){clearTimeout(r.grace[tok]);delete r.grace[tok];}
    if(i<0){i=r.t.addPlayer(tok,nm);if(i<0){r.sockets[sock.id]=tok;sock.join('r'+r.code);cb&&cb({ok:true,spectator:true,msg:'Table complète'});return push(r);}r.t.log.push(r.t.seats[i].name+' rejoint la table');}
    if(i>=0)r.t.setConnected(tok,true);r.sockets[sock.id]=tok;sock.join('r'+r.code);cb&&cb({ok:true});push(r);});
  const g=f=>(...a)=>{if(room){f(...a);push(room);}};
  sock.on('start',g(()=>{if(room.host===tok||room.t.stage==='showdown')room.t.startHand();}));
  sock.on('choose',g(v=>room.t.chooseVariant(tok,v)));
  sock.on('act',g(({action,amount})=>room.t.act(tok,action,amount)));
  sock.on('settings',g(({mode,sb,bb})=>{if(room.host!==tok)return;const t=room.t;if(mode)t.setMode(mode);if(!['waiting','showdown'].includes(t.stage))return;if(!sb&&!bb)return;if(+sb&&sb%100===0)t.sb=+sb;if(+bb&&bb%100===0)t.bb=+bb;t.log.push('Réglages : '+({holdem:"Hold'em",omaha:'Omaha PL',omahanl:'Omaha NL',dealer:'Choix du donneur'})[t.mode]+' '+t.sb+'/'+t.bb);}));
  sock.on('reset',g(()=>{if(room.host===tok){room.t.fullReset();io.to('r'+room.code).emit('toast','Table réinitialisée : tout le monde repart à 5 000');}}));
  sock.on('rebuy',g(amount=>room.t.rebuy(tok,amount===undefined?1000:amount)));
  sock.on('disconnect',()=>{if(!room)return;const r=room;delete r.sockets[sock.id];
    if(!Object.values(r.sockets).includes(tok)&&r.t.seatOf(tok)>=0){r.t.setConnected(tok,false);clearTimeout(r.grace[tok]);
      r.grace[tok]=setTimeout(()=>{delete r.grace[tok];if(r.t.seatOf(tok)<0||r.t.seats[r.t.seatOf(tok)].connected)return;r.t.removePlayer(tok);
        if(r.host===tok){const n=r.t.seats.find(x=>x&&x.connected)||r.t.seats.find(x=>x);if(n){r.host=n.id;r.t.log.push(n.name+' devient hôte');}}cleanup(r);},GRACE);}
    cleanup(r);});
});
function cleanup(r){if(!rooms[r.code])return;if(!r.t.seats.some(x=>x)&&!Object.keys(r.sockets).length||!r.t.seats.some(x=>x)&&!Object.keys(r.grace).length&&!Object.keys(r.sockets).length){clearTimeout(r.t.timer);clearTimeout(r.t.awayT);delete rooms[r.code];return;}push(r);}
srv.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Poker sur :'+(process.env.PORT||3000)));
