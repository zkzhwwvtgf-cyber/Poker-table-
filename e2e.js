const {io}=require('socket.io-client');const URL=process.argv[2];const {execSync}=require('child_process');
const mk=t=>{const s=io(URL,{transports:['websocket']});s.tok=t;s.on('state',x=>s.st=x);return s;};const w=ms=>new Promise(r=>setTimeout(r,ms));
const J=(s,code,name)=>new Promise(r=>s.emit('join',{code,name,token:s.tok},r));
(async()=>{const r=await fetch(URL+'/t/X');console.log('HTTP',r.status,(await r.text()).includes('Poker entre amis'));
const P=[...Array(7)].map((_,i)=>mk('tok'+i+Date.now()));await w(1000);
const code=await new Promise(r=>P[0].emit('create',{name:'Steph',mode:'dealer',token:P[0].tok},x=>r(x.code)));
for(let i=0;i<7;i++){const x=await J(P[i],code,'J'+i);if(i===6)console.log('7e joueur:',JSON.stringify(x));}
await w(500);const A=P[0];console.log('assis',A.st.seats.filter(x=>x).length,'piles',A.st.seats.map(x=>x&&x.chips).join(','),'blindes',A.st.sb+'/'+A.st.bb);
P[1].emit('start');await w(300);console.log('non-hôte lance ? stage=',A.st.stage);A.emit('start');await w(500);
const by=i=>P.find(p=>p.st.me===i);by(A.st.chooser).emit('choose','omaha');await w(500);
console.log('variante',A.st.variant,'mes cartes',A.st.seats[0].hole.join(' '),'autres',A.st.seats[1].hole.join(' '));
let g=0;while(A.st.stage!=='showdown'&&g++<60){const p=by(A.st.toAct),L=p.st.limits;p.emit('act',{action:L.toCall?(L.canRaise&&g<3?'raise':'call'):'check',amount:L.maxTo});await w(250);}
console.log('fin',A.st.stage,JSON.stringify(A.st.results),'total',A.st.seats.reduce((s,x)=>s+(x?x.chips:0),0));
const pre=A.st.seats.map(x=>x&&x.chips).join(',');P.forEach(p=>p.disconnect());await w(800);
execSync('pkill -f "node[ ]server.js"');await w(5000);const B=mk(P[0].tok);await w(1500);await J(B,code,'Steph');await w(500);
console.log('après crash+relance: piles identiques',B.st.seats.map(x=>x&&x.chips).join(',')===pre,'siège',B.st.me);process.exit(0);})();
