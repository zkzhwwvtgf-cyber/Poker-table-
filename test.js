const a=require('assert'),{bestHand,sidePots,Table,cmp,CONFIG}=require('./engine');let n=0;const t=(m,f)=>{f();n++;console.log('✓',m);};
const H=(h,b,v='holdem')=>bestHand(h.split(' '),b.split(' '),v);
t('quinte flush > carré',()=>a(cmp(H('9h Th','Jh Qh Kh 2c 2d').score,H('2h 2s','2c 2d Kh Qh Jh').score)>0));
t('roue A-5',()=>a.equal(H('Ah 2c','3d 4s 5h Kc Qd').name,'Quinte'));
t('full',()=>a.equal(H('Ah Ac','Ad Ks Kh 2c 3d').name,'Full'));
t('kicker',()=>a(cmp(H('Ah Kc','As 7d 5s 3h 2c').score,H('Ad Qc','As 7d 5s 3h 2c').score)>0));
t('Omaha: 4 piques en main sans couleur',()=>a.notEqual(H('As Ks Qs Js','2s 7s 9h 3d 4c','omaha').name,'Couleur'));
t('Omaha: exactement 2 cartes (pas de quinte avec 1)',()=>a.notEqual(H('9c 2d 2h 3s','Th Jd Qc Ks 4h','omaha').name,'Quinte'));
t('Omaha: couleur avec 2 cartes',()=>a.equal(H('As Ks 2d 3c','2s 7s 9s Jh Qd','omaha').name,'Couleur'));
t('side pots',()=>{const p=sidePots([{id:1,amount:100},{id:2,amount:500},{id:3,amount:500},{id:4,amount:300,folded:true}]);
  a.deepEqual(p,[{amount:400,eligible:[1,2,3]},{amount:1000,eligible:[2,3]}]);});
t('Omaha NL: évaluation Omaha (exactement 2 cartes)',()=>{a.notEqual(H('As Ks Qs Js','2s 7s 9h 3d 4c','omahanl').name,'Couleur');a.equal(H('As Ks 2d 3c','2s 7s 9s Jh Qd','omahanl').name,'Couleur');});
t('Omaha NL: 4 cartes et relance jusqu\'au tapis',()=>{const T=new Table({mode:'omahanl'});T.addPlayer('a','A');T.addPlayer('b','B');T.addPlayer('c','C');T.startHand();a.equal(T.variant,'omahanl');a.equal(T.hand.pl[0].hole.length,4);
 const p=T.seats[T.toAct],L=T.limits(T.toAct);a(L.maxTo>T.potTotal()*2,'maxTo dépasse le pot');a.equal(L.maxTo,T.hand.pl[T.toAct].bet+p.chips);
 const P=new Table({mode:'omaha'});P.addPlayer('a','A');P.addPlayer('b','B');P.addPlayer('c','C');P.startHand();a(P.limits(P.toAct).maxTo<L.maxTo,'PL plafonné');});
t('Omaha NL: setMode / choix du donneur',()=>{const T=new Table({mode:'dealer',choiceTimeout:50});T.addPlayer('a','A');T.addPlayer('b','B');T.startHand();a(T.chooseVariant(T.seats[T.chooser].id,'omahanl'));a.equal(T.variant,'omahanl');a.equal(T.hand.pl[0].hole.length,4);clearTimeout(T.timer);a.equal(new Table({}).setMode('omahanl'),true);});
function sim(mode){const T=new Table({mode,choiceTimeout:50});T.addPlayer('a','A');T.addPlayer('b','B');T.addPlayer('c','C');return T;}
t('main complète, jetons conservés',()=>{const T=sim('holdem');T.startHand();let g=0;while(T.stage!=='showdown'&&g++<50){const id=T.seats[T.toAct].id,L=T.limits(T.toAct);T.act(id,L.toCall?'call':'check');}
  a.equal(T.stage,'showdown');a.equal(T.seats.reduce((s,x)=>s+(x?x.chips:0),0),15000);});
t('tapis + side pot conservation',()=>{const T=sim('holdem');T.seats[0].chips=1000;T.startHand();let g=0;while(T.stage!=='showdown'&&g++<50){const i=T.toAct,L=T.limits(i);T.act(T.seats[i].id,L.canRaise?'raise':'call',L.maxTo);}
  a.equal(T.seats.reduce((s,x)=>s+(x?x.chips:0),0),11000);});
t('PLO: relance plafonnée au pot',()=>{const T=sim('omaha');T.startHand();a.equal(T.hand.pl[T.toAct].hole.length,4);const L=T.limits(T.toAct);a.equal(L.maxTo,700);a.equal(L.maxTo%100,0);a.equal(T.act(T.seats[T.toAct].id,'raise',800),false);a.equal(T.act(T.seats[T.toAct].id,'raise',650),false);});
t('pile de départ 5 000, blindes 100/200',()=>{const T=sim('holdem');a.equal(CONFIG.STACK,5000);a(T.seats.slice(0,3).every(x=>x.chips===5000));a.equal(T.sb,100);a.equal(T.bb,200);});
t('6 places max, 7e refusé',()=>{const T=new Table();for(let i=0;i<6;i++)a(T.addPlayer('p'+i,'P'+i)>=0);a.equal(T.addPlayer('p7','P7'),-1);a.equal(T.view('p7').spectator,true);});
t('recave +1 000 répétable, compteur, persistance',()=>{const T=sim('holdem');T.seats[1].chips=0;a(T.rebuy('b'));a.equal(T.seats[1].chips,1000);a.equal(T.rebuy('b'),false);
  T.seats[1].chips=0;T.rebuy('b');a.equal(T.seats[1].rebuys,2);const T2=Table.fromJSON(JSON.parse(JSON.stringify(T.toJSON())));a.equal(T2.seats[1].rebuys,2);a.equal(T2.seats[1].chips,1000);a.equal(T2.view('c').seats[1].rebuys,2);});
t('bust → recave → servi à la main suivante (compteur, net, bilan)',()=>{const T=new Table();T.addPlayer('a','A');T.addPlayer('b','B');T.addPlayer('c','C');
  T.seats[0].chips=0;T.startHand();a(!T.hand.pl[0],'joueur à 0 servi');a.equal(T.rebuy('a',6000),false);
  while(T.stage!=='showdown'){const i=T.toAct;T.act(T.seats[i].id,T.limits(i).toCall?'call':'check');}
  a(T.rebuy('a',2000));const v=T.view('a').seats[0];a.equal(v.chips,2000);a.equal(v.rebuys,1);a.equal(v.rebuyTotal,2000);a.equal(v.engaged,7000);a.equal(v.bilan,-5000);
  T.startHand();a(T.hand.pl[0],'recavé non servi');a.equal(T.view('a').seats[0].hole.length,2);});
t('choix du donneur suivant : seul lui peut choisir, défaut = jeu précédent',()=>{const T=new Table();T.addPlayer('a','A');T.addPlayer('b','B');T.addPlayer('c','C');
  a.equal(T.chooseNext('a','omaha'),false,'avant 1re main');T.startHand();const nd=T.nextDealer(),ids=['a','b','c'];a.equal(T.view('a').nextDealer,nd);
  for(const id of ids)if(id!==ids[nd])a.equal(T.chooseNext(id,'omaha'),false,'accepté pour '+id);a.equal(T.chooseNext(ids[nd],'omahanl'),false);
  a(T.chooseNext(ids[nd],'omaha'));a(T.log.at(-1).endsWith('choisit : Omaha'));while(T.stage!=='showdown'){const i=T.toAct;T.act(T.seats[i].id,T.limits(i).toCall?'call':'check');}
  T.startHand();a.equal(T.button,nd);a.equal(T.variant,'omaha');a.equal(T.hand.pl[0].hole.length,4);
  while(T.stage!=='showdown'){const i=T.toAct;T.act(T.seats[i].id,T.limits(i).toCall?'call':'check');}T.startHand();a.equal(T.variant,'omaha','défaut = précédent');});
for(const [n,gaps] of [[4,[1,4]],[5,[2]],[6,[]]])t(n+' joueurs (sièges vides '+JSON.stringify(gaps)+') : rotation bouton/blindes',()=>{const T=new Table();let k=0;for(let i=0;i<6;i++){if(gaps.includes(i))continue;if(k<n){T.seats[i]={id:'p'+i,name:'P'+i,chips:5000,connected:true,rebuys:0};k++;}}
  const occ=T.seats.map((s,i)=>s?i:-1).filter(i=>i>=0);a.equal(occ.length,n);const btns=[];
  for(let h=0;h<n;h++){T.startHand();btns.push(T.button);a(occ.includes(T.hand.sbI)&&occ.includes(T.hand.bbI));a.equal(T.hand.sbI,occ[(occ.indexOf(T.button)+1)%n]);a.equal(T.hand.bbI,occ[(occ.indexOf(T.button)+2)%n]);
    let g=0;while(T.stage!=='showdown'&&g++<100){const i=T.toAct;a(occ.includes(i));const L=T.limits(i);T.act(T.seats[i].id,L.toCall?'call':'check');}a.equal(T.seats.reduce((s,x)=>s+(x?x.chips:0),0),5000*n);}
  a.deepEqual([...btns].sort(),[...occ].sort());});
t('recave au choix 1 000 à 5 000 par 1 000',()=>{const T=sim('holdem');for(const v of [1000,2000,3000,4000,5000]){T.seats[1].chips=0;a(T.rebuy('b',v),'refus '+v);a.equal(T.seats[1].chips,v);}
  a.equal(T.seats[1].rebuys,5);a.equal(T.seats[1].rebuyTotal,15000);for(const v of [0,500,1500,6000,-1000,'abc']){T.seats[1].chips=0;a.equal(T.rebuy('b',v),false,'accepté '+v);}
  T.seats[1].chips=200;a.equal(T.rebuy('b',1000),false);T.seats[1].chips=100;a(T.rebuy('b',1000));a.equal(T.seats[1].chips,1100);T.seats[1].rebuys--;T.seats[1].rebuyTotal-=1000;a.equal(Table.fromJSON(JSON.parse(JSON.stringify(T.toJSON()))).seats[1].rebuyTotal,15000);});
t('montants multiples de 100',()=>{const T=sim('holdem');T.startHand();const L=T.limits(T.toAct);a.equal(T.act(T.seats[T.toAct].id,'raise',L.minTo+50),false);a(T.act(T.seats[T.toAct].id,'raise',L.minTo+100));});
// choix du donneur sous le siège : 4 jeux, serveur autoritaire
{const {upScore}=require('./engine');const mk=()=>{const T=new Table({mode:'holdem',dealerChoice:true,choiceTimeout:40});['a','b','c','d'].forEach(x=>T.addPlayer(x,x.toUpperCase()));return T;};
 const play=T=>{let g=0;while(T.stage!=='showdown'&&g++<200){const i=T.toAct;if(T.stage==='draw')T.act(T.seats[i].id,'draw',[]);else T.act(T.seats[i].id,T.limits(i).toCall?'call':'check');}a.equal(T.stage,'showdown');};
 t('donneur : 4 jeux, seul le donneur choisit, nombre de cartes',()=>{const T=mk();for(const [v,n] of [['holdem',2],['omaha',4],['draw',5],['stud',3]]){T.startHand();a.equal(T.stage,'choosing');
   a.equal(T.chooseVariant(T.seats[(T.chooser+1)%4].id,v),false);a.equal(T.chooseVariant(T.seats[T.chooser].id,'omahanl'),false);a(T.chooseVariant(T.seats[T.chooser].id,v));clearTimeout(T.timer);
   a.equal(T.variant,v);a.equal(T.mode,v);for(const p of Object.values(T.hand.pl))a.equal(p.hole.length,n,v);if(v!=='stud')a.equal(T.hand.board.length,0);play(T);}});
 t('draw : échange et remplacement, pas de board',()=>{const T=mk();T.startHand();T.chooseVariant(T.seats[T.chooser].id,'draw');clearTimeout(T.timer);
   let g=0;while(T.stage==='preflop'&&g++<50){const i=T.toAct;T.act(T.seats[i].id,T.limits(i).toCall?'call':'check');}a.equal(T.stage,'draw');
   const i=T.toAct,old=T.hand.pl[i].hole.slice();a.equal(T.act(T.seats[i].id,'check'),false);a(T.act(T.seats[i].id,'draw',[0,2,4]));const nw=T.hand.pl[i].hole;a.equal(nw.length,5);
   a.equal(nw[1],old[1]);a.equal(nw[3],old[3]);for(const k of [0,2,4])a(!old.includes(nw[k]),'nouvelle carte');a.equal(T.view('a').seats[i].drawn,3);
   const all=Object.values(T.hand.pl).flatMap(p=>p.hole);a.equal(new Set(all).size,all.length,'pas de doublon');
   while(T.stage==='draw')T.act(T.seats[T.toAct].id,'draw',[0,1,2,3,4]);a.equal(T.stage,'river');play(T);a.equal(T.hand.board.length,0);});
 t('draw : paquet épuisé -> défausses remélangées',()=>{const T=mk();T.startHand();T.chooseVariant(T.seats[T.chooser].id,'draw');clearTimeout(T.timer);
   while(T.stage==='preflop'){const i=T.toAct;T.act(T.seats[i].id,T.limits(i).toCall?'call':'check');}T.hand.deck.splice(0,T.hand.deck.length-2);
   T.act(T.seats[T.toAct].id,'draw',[0,1,2,3,4]);const all=Object.values(T.hand.pl).flatMap(p=>p.hole);a.equal(new Set(all).size,all.length);});
 t('stud : rues, cartes visibles, bring-in, 7 cartes',()=>{const T=mk();T.startHand();T.chooseVariant(T.seats[T.chooser].id,'stud');clearTimeout(T.timer);
   const h=T.hand;a.equal(T.potTotal(),100,'bring-in seul (pas de blindes)');const lo=h.bringIn,upc=j=>h.pl[j].hole[2];for(const j in h.pl)a(T.view('x')&&true);
   const RK='23456789TJQKA';for(const j in h.pl)a(RK.indexOf(upc(lo)[0])<=RK.indexOf(upc(j)[0]));
   const other=T.seats.findIndex((s,j)=>j!==+Object.keys(h.pl)[0]);const v=T.view('a'),me=0;for(const j in h.pl){const hv=v.seats[j].hole;if(+j===me){a.equal(hv.length,3);continue;}a.equal(hv[0],'??');a.equal(hv[1],'??');a.equal(hv[2],h.pl[j].hole[2]);}
   const L=T.limits(T.toAct);a.equal(L.toCall,100);a.equal(L.minTo,200,'complément à 200');
   for(const [st,n,lastUp] of [['flop',4,true],['turn',5,true],['river',6,true],['seventh',7,false]]){let g=0;const s0=T.stage;while(T.stage===s0&&g++<50){const i=T.toAct;T.act(T.seats[i].id,T.limits(i).toCall?'call':'check');}
     a.equal(T.stage,st);for(const p of Object.values(h.pl)){a.equal(p.hole.length,n);a.equal(p.up[n-1],lastUp);}
     const vis=j=>h.pl[j].hole.filter((c,k)=>h.pl[j].up[k]);for(const j in h.pl)a(cmp(upScore(vis(T.toAct)),upScore(vis(j)))>=0,'1er à parler = meilleure main visible');}
   const vw=T.view('b');a.equal(vw.seats[0].hole.filter(c=>c!=='??').length,4);play(T);a.equal(h.board.length,0);a(T.hand.results.length>=1);});
 t('évaluateur 5 et 7 cartes sans board',()=>{a.equal(bestHand('Ah Ad As Kc Kd'.split(' '),[],'draw').name,'Full');a.equal(bestHand('2h 3h 9h Jh Kh'.split(' '),[],'draw').name,'Couleur');
   a.equal(bestHand('2c 3d 4h 5s 6c Kd Kh'.split(' '),[],'stud').name,'Quinte');a.equal(bestHand('9s 9h 2c 2d 7s Ks 3h'.split(' '),[],'stud').name,'Double paire');});
 t('donneur déconnecté -> jeu précédent',()=>{const T=mk();T.startHand();T.chooseVariant(T.seats[T.chooser].id,'stud');clearTimeout(T.timer);play(T);T.startHand();a.equal(T.stage,'choosing');
   T.setConnected(T.seats[T.chooser].id,false);a.equal(T.variant,'stud');a.equal(T.stage,'preflop');clearTimeout(T.awayT);});
 {const T=mk();T.startHand();T.chooseVariant(T.seats[T.chooser].id,'draw');clearTimeout(T.timer);play(T);T.startHand();a.equal(T.stage,'choosing');
  setTimeout(()=>{a.equal(T.stage,'preflop');a.equal(T.variant,'draw');a.equal(T.hand.pl[0].hole.length,5);clearTimeout(T.awayT);console.log('✓ donneur : délai 15 s -> jeu de la main précédente (draw)');},90);}}
const T=sim('dealer');T.startHand();a.equal(T.stage,'choosing');a.equal(T.act('a','check'),false);
a.equal(T.chooseVariant(T.seats[(T.chooser+1)%3].id,'omaha'),false);T.chooseVariant(T.seats[T.chooser].id,'omaha');a.equal(T.variant,'omaha');a.equal(T.stage,'preflop');a.equal(T.hand.pl[0].hole.length,4);
while(T.stage!=='showdown'){const i=T.toAct;T.act(T.seats[i].id,'fold');}
const b1=T.button;T.startHand();a.equal(T.stage,'choosing');a.notEqual(T.chooser,b1);
setTimeout(()=>{a.equal(T.stage,'preflop');a.equal(T.variant,'omaha','délai -> variante précédente');console.log('✓ délai du donneur -> variante précédente');console.log('Tous les tests OK');},120);
{const T=sim('holdem');T.setMode('omaha');a.equal(T.mode,'omaha');T.startHand();a.equal(T.variant,'omaha');a.equal(T.hand.pl[0].hole.length,4);
 T.setMode('dealer');a.equal(T.mode,'omaha');a.equal(T.pendingMode,'dealer');a(T.log.at(-1).startsWith('Prochaine main : '));
 while(T.stage!=='showdown')T.act(T.seats[T.toAct].id,'fold');T.startHand();a.equal(T.mode,'dealer');a.equal(T.stage,'choosing');console.log('✓ changement de variante (immédiat / prochaine main)');}
{const T=sim('holdem');T.seats[1].chips=0;T.rebuy('b',3000);a.equal(T.view('a').seats[1].engaged,8000);a.equal(T.view('a').seats[1].bilan,-5000);
 const sum=()=>T.view('a').seats.filter(x=>x).reduce((s,x)=>s+x.bilan,0);a.equal(sum(),-5000+0);// pile 3000 sur 8000 engagés, autres 0
 T.seats[0].chips+=5000;a.equal(sum(),0);console.log('✓ engagement / net / somme nulle');
 T.startHand();T.fullReset();a.equal(T.stage,'waiting');a(T.seats.filter(x=>x).every(x=>x.chips===5000&&x.rebuys===0&&x.engaged===5000));console.log('✓ réinitialisation complète');
 T.seats[0].chips=1234;const i=T.addPlayer('d','D');a.equal(T.seats[i].chips,5000);a.equal(T.seats[0].chips,1234);a.notEqual(T.pendingReset,true);console.log('✓ nouveau joueur : lui seul reçoit 5 000, les autres piles intactes');
 T.startHand();
 const id=T.seats[T.toAct].id,before=T.toAct;T.removePlayer(id);a.equal(T.seats[before],null);a.notEqual(T.toAct,before);
 let g=0;while(T.stage!=='showdown'&&g++<50){const L=T.limits(T.toAct);T.act(T.seats[T.toAct].id,L.toCall?'call':'check');}a.equal(T.stage,'showdown');console.log('✓ départ immédiat pendant la main');}

{// joueur déconnecté : check/couché automatique après le délai du tour, retour possible
 const T=new Table({awayDelay:30});T.addPlayer('a','A');T.addPlayer('b','B');T.addPlayer('c','C');T.startHand();const who=T.seats[T.toAct].id,i0=T.toAct;
 T.setConnected(who,false);a.equal(T.seats[i0].connected,false);a(T.log.at(-1).includes('déconnecté'));
 setTimeout(()=>{a.notEqual(T.toAct,i0);a.equal(T.hand.pl[i0].folded,true);T.setConnected(who,true);a.equal(T.seats[i0].connected,true);console.log('✓ déconnecté : couché automatiquement à son tour, siège gardé');
  serverTest();},120);}
{const PRE=require('./public/pre.js');const L0={toCall:0},L2={toCall:200};
 a.deepEqual(PRE.decide({mode:'cf'},L0),{action:'check'});a.deepEqual(PRE.decide({mode:'cf'},L2),{action:'fold'});
 a.deepEqual(PRE.decide({mode:'any'},L0),{action:'check'});a.deepEqual(PRE.decide({mode:'any'},L2),{action:'call'});
 a.deepEqual(PRE.decide({mode:'call',amt:200},L2),{action:'call'});a.equal(PRE.decide({mode:'call',amt:200},{toCall:600}),null);a.equal(PRE.decide(null,L2),null);
 a.equal(PRE.update({mode:'call',amt:200},600),null);a.deepEqual(PRE.update({mode:'any'},600),{mode:'any'});a.deepEqual(PRE.update({mode:'cf'},600),{mode:'cf'});
 // avec le moteur : B coche « Suivre tout », A relance, B suit automatiquement
 const T=new Table();T.addPlayer('a','A');T.addPlayer('b','B');T.addPlayer('c','C');T.startHand();let g=0;
 while(T.stage==='preflop'&&g++<20){const i=T.toAct,id=T.seats[i].id;const d=PRE.decide({mode:'any'},T.limits(i));a(T.act(id,d.action),'pré-action refusée');}a.equal(T.stage,'flop');
 console.log('✓ pré-actions : Check/Couché, Suivre tout, Suivre X annulé si la mise change');}
{// records de la soirée
 const T=new Table();T.addPlayer('a','A');T.addPlayer('b','B');T.addPlayer('c','C');
 T.startHand();while(T.stage!=='showdown'){const i=T.toAct;T.act(T.seats[i].id,'fold');}const w1=T.hand.results[0];
 let R=T.records();a.equal(R.bluff.name,w1.name);a.equal(R.bluff.count,1);a.equal(R.wins.count,1);a.equal(R.bigPot.amount,300);a.equal(R.bestHand,null);
 T.startHand();let g=0;while(T.stage!=='showdown'&&g++<60){const i=T.toAct,L=T.limits(i);T.act(T.seats[i].id,L.toCall?'call':'check');}
 R=T.records();a.equal(R.bigPot.amount,600);a(R.bestHand&&R.bestHand.hand&&R.bestHand.cards.length===5);const tw=Object.values(T.rec.wins).reduce((x,y)=>x+y,0);a(tw>=2);
 a.equal(T.view('a').records.bigPot.amount,600);T.fullReset();a.equal(T.records().bigPot,null);console.log('✓ records : plus gros pot, meilleure main, roi du bluff, mains gagnées');}
function serverTest(){const {spawn}=require('child_process'),{io}=require('socket.io-client');const PORT=3900+Math.floor(Math.random()*90);
 const S=spawn(process.execPath,[__dirname+'/server.js'],{env:{...process.env,PORT,GRACE_MS:'800',AWAY_MS:'200'},stdio:'ignore'});const U='http://localhost:'+PORT;const w=ms=>new Promise(r=>setTimeout(r,ms));
 const mk=()=>{const s=io(U,{transports:['websocket'],reconnection:false,forceNew:true});s.on('state',x=>s.st=x);return s;};
 const fail=e=>{console.error('✗',e);S.kill();process.exit(1);};
 (async()=>{await w(700);const A=mk(),B=mk(),C=mk();await w(300);
  const code=await new Promise(r=>A.emit('create',{name:'A',token:'ta'},x=>r(x.code)));
  await new Promise(r=>A.emit('join',{code,name:'A',token:'ta'},r));await new Promise(r=>B.emit('join',{code,name:'B',token:'tb'},r));
  A.emit('start');await w(200);const bi=A.st.seats.findIndex(x=>x&&x.name==='B');B.close();await w(150);
  a.equal(A.st.seats[bi].connected,false);a(A.st.seats[bi].name==='B');
  // retour avec le même jeton : même siège, même pile
  const chips=A.st.seats[bi].chips;const B2=mk();await w(200);await new Promise(r=>B2.emit('join',{code,name:'B',token:'tb'},r));await w(100);
  a.equal(A.st.seats[bi].connected,true);a.equal(A.st.seats[bi].chips,chips);a.equal(A.st.seats.filter(x=>x).length,2);
  // nouveau venu : seul lui à 5 000
  await new Promise(r=>C.emit('join',{code,name:'C',token:'tc'},r));await w(100);a.equal(A.st.seats.filter(x=>x).length,3);
  // vol de siège : même pseudo mais autre jeton -> nouveau siège, l'ancien reste réservé
  const ci=A.st.seats.findIndex(x=>x&&x.name==='C');C.close();await w(150);a.equal(A.st.seats[ci].connected,false);
  const X=mk();await w(200);await new Promise(r=>X.emit('join',{code,name:'C',token:'tx'},r));await w(150);
  a.equal(A.st.seats[ci].connected,false,'siège volé');a.equal(A.st.seats.filter(x=>x).length,4);X.close();
  const C2=mk();await w(200);await new Promise(r=>C2.emit('join',{code,name:'C',token:'tc'},r));await w(150);a.equal(A.st.seats[ci].connected,true);C2.close();await w(100);
  console.log('✓ serveur : pas de reprise de siège par simple pseudo (jeton exigé)');
  // réactions : diffusées, 1 par seconde max (serveur)
  {let n=0;A.on('react',()=>n++);B2.emit('react','😂');B2.emit('react','🔥');B2.emit('react','😂');B2.emit('react','💩');await w(300);a.equal(n,1,'limite 1/s');
   await w(900);B2.emit('react','👏');await w(200);a.equal(n,2);console.log('✓ serveur : réactions diffusées, limitées à 1/s, liste fermée');}
  // avatar emoji + photo validés
  {const P=mk();await w(200);await new Promise(r=>P.emit('join',{code,name:'P',token:'tp',avatar:'🦊',photo:'javascript:x'},r));await w(150);const pi=A.st.seats.findIndex(x=>x&&x.name==='P');a.equal(A.st.seats[pi].avatar,'🦊');
   let ph=null;A.on('photos',m=>ph=m);P.emit('join',{code,name:'P',token:'tp',photo:'data:image/jpeg;base64,AAAA'},()=>{});await w(200);a.equal(A.st.seats[pi].avatar,'photo');a.equal(ph[pi],'data:image/jpeg;base64,AAAA');P.close();await w(100);console.log('✓ serveur : avatars (emoji, photo validée)');}
  // vocal : relais de signalisation seulement entre sockets de la même table, tailles et débit limités
  {let got=[];B2.on('vsig',m=>got.push(m));let vl=null;A.on('voice',l=>vl=l);A.emit('vjoin');B2.emit('vjoin');await w(200);a.equal(vl.length,2);
   A.emit('vsig',{to:B2.id,data:{sdp:{type:'offer',sdp:'v=0'}}});await w(150);a.equal(got.length,1);a.equal(got[0].from,A.id);
   const O=mk();await w(200);const c2=await new Promise(r=>O.emit('create',{name:'O',token:'to'},x=>r(x.code)));await new Promise(r=>O.emit('join',{code:c2,name:'O',token:'to'},r));O.emit('vjoin');await w(100);
   O.emit('vsig',{to:B2.id,data:{ice:{candidate:'x'}}});await w(150);a.equal(got.length,1,'relais hors table');
   A.emit('vsig',{to:B2.id,data:{sdp:'x'.repeat(13000)}});await w(150);a.equal(got.length,1,'taille');
   const Cx=mk();await w(200);await new Promise(r=>Cx.emit('join',{code,name:'Q',token:'tq'},r));Cx.emit('vsig',{to:B2.id,data:{ice:1}});await w(150);a.equal(got.length,1,'pas en vocal');Cx.close();
   for(let k=0;k<80;k++)A.emit('vsig',{to:B2.id,data:{ice:{k}}});await w(400);a(got.length>=50&&got.length<=61,'débit '+got.length);
   A.emit('vleave');await w(150);a.equal(vl.length,1);O.close();console.log('✓ serveur : vocal — relais même table, taille et débit limités');}
  {const M=mk();await w(200);const c3=await new Promise(r=>M.emit('create',{name:'M',mode:'omahanl',token:'tm'},x=>r(x.code)));await new Promise(r=>M.emit('join',{code:c3,name:'M',token:'tm'},r));await w(100);a.equal(M.st.mode,'omaha');
   M.emit('settings',{mode:'dealer'});await w(100);a.equal(M.st.mode,'holdem');M.close();console.log("✓ serveur : jeux proposés Hold'em / Omaha (Omaha NL -> Omaha, donneur -> Hold'em)");}
  {const X=mk(),Y=mk();await w(200);const c4=await new Promise(r=>X.emit('create',{name:'X',token:'tx4'},x=>r(x.code)));await new Promise(r=>X.emit('join',{code:c4,name:'X',token:'tx4'},r));await new Promise(r=>Y.emit('join',{code:c4,name:'Y',token:'ty4'},r));
   X.emit('start');await w(150);a.equal(X.st.stage,'choosing');const ch=X.st.chooser,C1=ch===X.st.me?X:Y,C2=C1===X?Y:X;C2.emit('choose','omaha');await w(100);a.equal(X.st.stage,'choosing','autre joueur refusé');
   C1.emit('choose','omaha');await w(150);a.equal(C1.st.variant,'omaha');a.equal(C1.st.seats[C1.st.me].hole.length,4);a.equal(C2.st.seats[C2.st.me].hole.length,4);
   a.deepEqual(C1.st.seats[C2.st.me].hole,['??','??','??','??']);X.close();Y.close();console.log('✓ serveur : choix du donneur autoritaire (Omaha -> 4 cartes)');}
  // plus personne connecté : la table survit pendant la grâce, puis disparaît
  A.close();B2.close();C.close();await w(300);const D=mk();await w(200);const r1=await new Promise(r=>D.emit('join',{code,name:'A',token:'ta'},r));a(r1.ok,'table supprimée pendant la grâce');await w(150);
  a(D.st.seats.filter(x=>x).length>=1);D.close();await w(1500);const E=mk();await w(200);const r2=await new Promise(r=>E.emit('join',{code,name:'Z',token:'tz'},r));a.equal(r2.error,'Table introuvable');E.close();
  console.log('✓ serveur : grâce 120 s, reconnexion jeton, table conservée puis supprimée');S.kill();console.log('Tests serveur OK');process.exit(0);})().catch(fail);}
