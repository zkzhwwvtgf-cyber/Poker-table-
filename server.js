const fs=require('fs');const DB=process.env.DATA_FILE||__dirname+'/data/tables.json';const express=require('express'),http=require('http'),{Server}=require('socket.io'),crypto=require('crypto'),{Table,CONFIG}=require('./engine');
const app=express();app.use(express.static(__dirname+'/public'));app.get('/t/:code',(q,r)=>r.sendFile(__dirname+'/public/index.html'));
const srv=http.createServer(app),io=new Server(srv,{cors:{origin:'*'}});const rooms={};
try{const d=JSON.parse(fs.readFileSync(DB));for(const [c,r] of Object.entries(d)){const t=Table.fromJSON(r.t);rooms[c]={code:c,t,host:r.host,sockets:{}};t.onChange=()=>push(rooms[c]);}console.log('Tables restaurées:',Object.keys(rooms).length);}catch(e){}
let saveT;function save(){clearTimeout(saveT);saveT=setTimeout(()=>{fs.mkdirSync(require('path').dirname(DB),{recursive:true});const o={};for(const [c,r] of Object.entries(rooms))o[c]={host:r.host,t:r.t.toJSON()};fs.writeFileSync(DB+'.tmp',JSON.stringify(o));fs.renameSync(DB+'.tmp',DB);},300);}
const code=()=>crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();
function push(r){save();for(const [sid,tok] of Object.entries(r.sockets)){const s=io.sockets.sockets.get(sid);if(s)s.emit('state',{...r.t.view(tok),code:r.code,host:r.host===tok});}}
io.on('connection',sock=>{let room=null,tok=null;
  sock.on('create',({name,mode,sb,bb,token},cb)=>{const c=code();const t=new Table({mode,sb:+sb||CONFIG.SB,bb:+bb||CONFIG.BB});
    const r=rooms[c]={code:c,t,host:token,sockets:{}};t.onChange=()=>push(r);cb&&cb({code:c});});
  sock.on('join',({code:c,name,token},cb)=>{const r=rooms[(c||'').toUpperCase()];if(!r)return cb&&cb({error:'Table introuvable'});
    room=r;tok=token;let i=r.t.seatOf(token);if(i<0){i=r.t.addPlayer(token,String(name||'Joueur').slice(0,14));if(i<0){r.sockets[sock.id]=token;cb&&cb({ok:true,spectator:true,msg:'Table complète'});return push(r);}r.t.log.push(r.t.seats[i].name+' rejoint la table');}
    if(i>=0)r.t.seats[i].connected=true;r.sockets[sock.id]=token;cb&&cb({ok:true});push(r);});
  const g=f=>(...a)=>{if(room){f(...a);push(room);}};
  sock.on('start',g(()=>{if(room.host===tok||room.t.stage==='showdown')room.t.startHand();}));
  sock.on('choose',g(v=>room.t.chooseVariant(tok,v)));
  sock.on('act',g(({action,amount})=>room.t.act(tok,action,amount)));
  sock.on('settings',g(({mode,sb,bb})=>{if(room.host!==tok)return;const t=room.t;if(mode)t.setMode(mode);if(!['waiting','showdown'].includes(t.stage))return;if(!sb&&!bb)return;if(+sb&&sb%100===0)t.sb=+sb;if(+bb&&bb%100===0)t.bb=+bb;t.log.push('Réglages : '+({holdem:"Hold'em",omaha:'Omaha PL',dealer:'Choix du donneur'})[t.mode]+' '+t.sb+'/'+t.bb);}));
  sock.on('rebuy',g(amount=>room.t.rebuy(tok,amount===undefined?1000:amount)));
  sock.on('disconnect',()=>{if(!room)return;delete room.sockets[sock.id];if(!Object.values(room.sockets).includes(tok)){const i=room.t.seatOf(tok);if(i>=0)room.t.seats[i].connected=false;}push(room);});
});
srv.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Poker sur :'+(process.env.PORT||3000)));
