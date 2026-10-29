const express=require('express'),http=require('http'),{Server}=require('socket.io'),crypto=require('crypto'),{Table,CONFIG}=require('./engine');
const app=express();app.use(express.static(__dirname+'/public'));app.get('/t/:code',(q,r)=>r.sendFile(__dirname+'/public/index.html'));
const srv=http.createServer(app),io=new Server(srv,{cors:{origin:'*'}});const rooms={};
// Sessions propres : aucune restauration de tables au démarrage, rien n'est sauvegardé.
const code=()=>crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();
function push(r){for(const [sid,tok] of Object.entries(r.sockets)){const s=io.sockets.sockets.get(sid);if(s)s.emit('state',{...r.t.view(tok),code:r.code,host:r.host===tok});}}
io.on('connection',sock=>{let room=null,tok=null;
  sock.on('create',({name,mode,sb,bb,token},cb)=>{const c=code();const t=new Table({mode,sb:+sb||CONFIG.SB,bb:+bb||CONFIG.BB});
    const r=rooms[c]={code:c,t,host:token,sockets:{}};t.onChange=()=>push(r);cb&&cb({code:c});});
  sock.on('join',({code:c,name,token},cb)=>{const r=rooms[(c||'').toUpperCase()];if(!r)return cb&&cb({error:'Table introuvable'});
    room=r;tok=token;let i=r.t.seatOf(token);if(i<0){i=r.t.addPlayer(token,String(name||'Joueur').slice(0,14));if(i>=0)r.t.resetStacks();if(i<0){r.sockets[sock.id]=token;sock.join('r'+r.code);cb&&cb({ok:true,spectator:true,msg:'Table complète'});return push(r);}r.t.log.push(r.t.seats[i].name+' rejoint la table');}
    if(i>=0)r.t.seats[i].connected=true;r.sockets[sock.id]=token;sock.join('r'+r.code);cb&&cb({ok:true});push(r);});
  const g=f=>(...a)=>{if(room){f(...a);push(room);}};
  sock.on('start',g(()=>{if(room.host===tok||room.t.stage==='showdown')room.t.startHand();}));
  sock.on('choose',g(v=>room.t.chooseVariant(tok,v)));
  sock.on('act',g(({action,amount})=>room.t.act(tok,action,amount)));
  sock.on('settings',g(({mode,sb,bb})=>{if(room.host!==tok)return;const t=room.t;if(mode)t.setMode(mode);if(!['waiting','showdown'].includes(t.stage))return;if(!sb&&!bb)return;if(+sb&&sb%100===0)t.sb=+sb;if(+bb&&bb%100===0)t.bb=+bb;t.log.push('Réglages : '+({holdem:"Hold'em",omaha:'Omaha PL',omahanl:'Omaha NL',dealer:'Choix du donneur'})[t.mode]+' '+t.sb+'/'+t.bb);}));
  sock.on('reset',g(()=>{if(room.host===tok){room.t.fullReset();io.to('r'+room.code).emit('toast','Table réinitialisée : tout le monde repart à 5 000');}}));
  sock.on('rebuy',g(amount=>room.t.rebuy(tok,amount===undefined?1000:amount)));
  sock.on('disconnect',()=>{if(!room)return;delete room.sockets[sock.id];if(!Object.values(room.sockets).includes(tok)){room.t.removePlayer(tok);if(room.host===tok){const n=room.t.seats.find(x=>x);if(n){room.host=n.id;room.t.log.push(n.name+' devient hôte');}}}
    if(!Object.keys(room.sockets).length||!room.t.seats.some(x=>x)){clearTimeout(room.t.timer);delete rooms[room.code];return;}push(room);});
});
srv.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Poker sur :'+(process.env.PORT||3000)));
