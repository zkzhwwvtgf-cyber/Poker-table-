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
for(const [n,gaps] of [[4,[1,4]],[5,[2]],[6,[]]])t(n+' joueurs (sièges vides '+JSON.stringify(gaps)+') : rotation bouton/blindes',()=>{const T=new Table();let k=0;for(let i=0;i<6;i++){if(gaps.includes(i))continue;if(k<n){T.seats[i]={id:'p'+i,name:'P'+i,chips:5000,connected:true,rebuys:0};k++;}}
  const occ=T.seats.map((s,i)=>s?i:-1).filter(i=>i>=0);a.equal(occ.length,n);const btns=[];
  for(let h=0;h<n;h++){T.startHand();btns.push(T.button);a(occ.includes(T.hand.sbI)&&occ.includes(T.hand.bbI));a.equal(T.hand.sbI,occ[(occ.indexOf(T.button)+1)%n]);a.equal(T.hand.bbI,occ[(occ.indexOf(T.button)+2)%n]);
    let g=0;while(T.stage!=='showdown'&&g++<100){const i=T.toAct;a(occ.includes(i));const L=T.limits(i);T.act(T.seats[i].id,L.toCall?'call':'check');}a.equal(T.seats.reduce((s,x)=>s+(x?x.chips:0),0),5000*n);}
  a.deepEqual([...btns].sort(),[...occ].sort());});
t('recave au choix 1 000 à 5 000 par 1 000',()=>{const T=sim('holdem');for(const v of [1000,2000,3000,4000,5000]){T.seats[1].chips=0;a(T.rebuy('b',v),'refus '+v);a.equal(T.seats[1].chips,v);}
  a.equal(T.seats[1].rebuys,5);a.equal(T.seats[1].rebuyTotal,15000);for(const v of [0,500,1500,6000,-1000,'abc']){T.seats[1].chips=0;a.equal(T.rebuy('b',v),false,'accepté '+v);}
  T.seats[1].chips=100;a.equal(T.rebuy('b',1000),false);a.equal(Table.fromJSON(JSON.parse(JSON.stringify(T.toJSON()))).seats[1].rebuyTotal,15000);});
t('montants multiples de 100',()=>{const T=sim('holdem');T.startHand();const L=T.limits(T.toAct);a.equal(T.act(T.seats[T.toAct].id,'raise',L.minTo+50),false);a(T.act(T.seats[T.toAct].id,'raise',L.minTo+100));});
const T=sim('dealer');T.startHand();a.equal(T.stage,'choosing');a.equal(T.act('a','check'),false);
a.equal(T.chooseVariant(T.seats[(T.chooser+1)%3].id,'omaha'),false);T.chooseVariant(T.seats[T.chooser].id,'omaha');a.equal(T.variant,'omaha');a.equal(T.stage,'preflop');a.equal(T.hand.pl[0].hole.length,4);
while(T.stage!=='showdown'){const i=T.toAct;T.act(T.seats[i].id,'fold');}
const b1=T.button;T.startHand();a.equal(T.stage,'choosing');a.notEqual(T.chooser,b1);
setTimeout(()=>{a.equal(T.stage,'preflop');a.equal(T.variant,'omaha','délai -> variante précédente');console.log('✓ délai du donneur -> variante précédente');console.log('Tous les tests OK');},120);
{const T=sim('holdem');T.setMode('omaha');a.equal(T.mode,'omaha');T.startHand();a.equal(T.variant,'omaha');a.equal(T.hand.pl[0].hole.length,4);
 T.setMode('dealer');a.equal(T.mode,'omaha');a.equal(T.pendingMode,'dealer');a(T.log.at(-1).includes('à partir de la prochaine main'));
 while(T.stage!=='showdown')T.act(T.seats[T.toAct].id,'fold');T.startHand();a.equal(T.mode,'dealer');a.equal(T.stage,'choosing');console.log('✓ changement de variante (immédiat / prochaine main)');}
