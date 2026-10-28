// Vérifie que le changement de variante par l'hôte s'applique (pendant une main -> prochaine main)
const {io}=require('socket.io-client');const URL=process.argv[2];const w=ms=>new Promise(r=>setTimeout(r,ms));
const mk=t=>{const s=io(URL,{transports:['websocket']});s.tok=t;s.on('state',x=>s.st=x);return s;};
(async()=>{const A=mk('ma'+Date.now()),B=mk('mb'+Date.now());await w(2500);
const code=await new Promise(r=>A.emit('create',{name:'H',mode:'holdem',token:A.tok},x=>r(x.code)));
for(const [p,n] of [[A,'H'],[B,'G']])await new Promise(r=>p.emit('join',{code,name:n,token:p.tok},r));await w(500);
A.emit('settings',{mode:'omaha'});await w(500);console.log('avant main -> mode',A.st.mode);
A.emit('start');await w(600);console.log('main 1 variante',A.st.variant,'cartes',A.st.seats[A.st.me].hole.length);
A.emit('settings',{mode:'holdem'});await w(500);console.log('en cours -> mode',A.st.mode,'pending',A.st.pendingMode,'log',A.st.log.at(-1));
while(A.st.stage!=='showdown'){const p=A.st.toAct===A.st.me?A:B;p.emit('act',{action:'fold'});await w(400);}
A.emit('start');await w(600);console.log('main 2 variante',A.st.variant,'cartes',A.st.seats[A.st.me].hole.length);process.exit(0);})();
