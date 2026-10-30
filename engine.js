// Moteur de poker : évaluation, pots, déroulement d'une main (Hold'em / PLO / Omaha NL)
const CONFIG={STACK:5000,REBUY:1000,REBUY_OPTIONS:[1000,2000,3000,4000,5000],SEATS:6,UNIT:100,SB:100,BB:200};
const RANKS='23456789TJQKA', SUITS='shdc';
function newDeck(){const d=[];for(const r of RANKS)for(const s of SUITS)d.push(r+s);for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}return d;}
const rv=c=>RANKS.indexOf(c[0])+2;
const NAMES=['Carte haute','Paire','Double paire','Brelan','Quinte','Couleur','Full','Carré','Quinte flush'];
function eval5(cs){
  const v=cs.map(rv).sort((a,b)=>b-a), fl=cs.every(c=>c[1]===cs[0][1]);
  const cnt={};v.forEach(x=>cnt[x]=(cnt[x]||0)+1);
  const g=Object.entries(cnt).map(([k,n])=>[n,+k]).sort((a,b)=>b[0]-a[0]||b[1]-a[1]);
  let u=[...new Set(v)],st=0;
  if(u.length===5){if(v[0]-v[4]===4)st=v[0];else if(v[0]===14&&v[1]===5)st=5;}
  let cat,k;
  if(st&&fl){cat=8;k=[st];}else if(g[0][0]===4){cat=7;k=[g[0][1],g[1][1]];}
  else if(g[0][0]===3&&g[1][0]===2){cat=6;k=[g[0][1],g[1][1]];}
  else if(fl){cat=5;k=v;}else if(st){cat=4;k=[st];}
  else if(g[0][0]===3){cat=3;k=g.map(x=>x[1]);}
  else if(g[0][0]===2&&g[1][0]===2){cat=2;k=g.map(x=>x[1]);}
  else if(g[0][0]===2){cat=1;k=g.map(x=>x[1]);}else{cat=0;k=v;}
  return {score:[cat,...k],name:NAMES[cat],cards:cs};
}
const cmp=(a,b)=>{for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}return 0;};
function combos(a,k){const r=[];(function f(s,c){if(c.length===k){r.push(c.slice());return;}for(let i=s;i<a.length;i++){c.push(a[i]);f(i+1,c);c.pop();}})(0,[]);return r;}
function bestOf(list){let b=null;for(const c of list){const e=eval5(c);if(!b||cmp(e.score,b.score)>0)b=e;}return b;}
const isOmaha=v=>v==='omaha'||v==='omahanl';
const VARS=['holdem','omaha','omahanl','draw','stud'],BET=['preflop','flop','turn','river','seventh'];
const HOLEN={draw:5,stud:3};
// main visible (stud) : seules paires / brelans / carrés comptent, puis hauteur
function upScore(cs){const v=cs.map(rv).sort((a,b)=>b-a),cnt={};v.forEach(x=>cnt[x]=(cnt[x]||0)+1);const g=Object.entries(cnt).map(([k,n])=>[n,+k]).sort((a,b)=>b[0]-a[0]||b[1]-a[1]);
  const cat=g[0][0]===4?7:g[0][0]===3?3:g[0][0]===2&&g[1]&&g[1][0]===2?2:g[0][0]===2?1:0;return [cat,...g.map(x=>x[1])];}
const SUITV={c:0,d:1,h:2,s:3};
function shuffle(d){for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}return d;}
function bestHand(hole,board,variant){
  if(isOmaha(variant)){const l=[];for(const h of combos(hole,2))for(const bd of combos(board,3))l.push([...h,...bd]);return bestOf(l);}
  return bestOf(combos([...hole,...board],5));
}
// contribs: [{id,amount,folded}] -> [{amount,eligible:[ids]}]
function sidePots(contribs){
  const lv=[...new Set(contribs.filter(c=>!c.folded&&c.amount>0).map(c=>c.amount))].sort((a,b)=>a-b);
  const pots=[];let prev=0;
  for(const L of lv){let amt=0;for(const c of contribs)amt+=Math.max(0,Math.min(c.amount,L)-prev);
    const el=contribs.filter(c=>!c.folded&&c.amount>=L).map(c=>c.id);
    if(pots.length&&pots[pots.length-1].eligible.length===el.length)pots[pots.length-1].amount+=amt;else pots.push({amount:amt,eligible:el});prev=L;}
  // mises au-delà du dernier niveau (joueurs couchés) -> dernier pot
  const rest=contribs.reduce((s,c)=>s+Math.max(0,c.amount-prev),0);if(rest&&pots.length)pots[pots.length-1].amount+=rest;
  return pots;
}

class Table{
  constructor(o={}){this.seats=Array(CONFIG.SEATS).fill(null);this.sb=o.sb||CONFIG.SB;this.bb=o.bb||CONFIG.BB;this.mode=o.mode||'holdem';
    this.variant=isOmaha(this.mode)?this.mode:'holdem';this.button=-1;this.hand=null;this.stage='waiting';this.log=[];this.choiceTimeout=o.choiceTimeout||20000;this.dealerChoice=!!o.dealerChoice;this.onChange=()=>{};this.timer=null;this.awayDelay=o.awayDelay||30000;this.awayT=null;this.awayKey=null;this.rec=Table.newRec();}
  static newRec(){return {bigPot:null,bestHand:null,noSD:{},wins:{}};}
  addPlayer(id,name,chips=CONFIG.STACK){let i=this.seats.findIndex(s=>!s);if(i<0)return -1;this.seats[i]={id,name,chips,connected:true,sitOut:false,rebuys:0,rebuyTotal:0,engaged:chips};return i;}
  setConnected(id,on){const i=this.seatOf(id);if(i<0)return false;const s=this.seats[i];if(s.connected===on)return true;s.connected=on;if(!on&&this.stage==='choosing'&&this.chooser===i){const pv=this.variant==='omahanl'&&this.dealerChoice?'omaha':VARS.includes(this.variant)?this.variant:'holdem';this.chooseVariant(id,pv,true);}
    this.log.push(s.name+(on?' est de retour':' déconnecté'));this.scheduleAway();return true;}
  // joueur déconnecté à qui c'est le tour : check si possible, sinon couché, après le délai du tour
  scheduleAway(){const h=this.hand,i=this.toAct,s=this.seats[i];
    const betting=h&&(BET.includes(this.stage)||this.stage==='draw');
    if(!betting||i<0||!s||s.connected){clearTimeout(this.awayT);this.awayT=null;this.awayKey=null;return;}
    const key=i+':'+h.turnStart;if(this.awayKey===key)return;clearTimeout(this.awayT);this.awayKey=key;
    this.awayT=setTimeout(()=>{this.awayT=null;this.awayKey=null;if(this.toAct!==i||!this.seats[i]||this.seats[i].connected||!this.hand)return;
      if(this.stage==='draw'){this.act(this.seats[i].id,'draw',[]);this.onChange();return;}const L=this.limits(i);this.act(this.seats[i].id,L.toCall>0?'fold':'check');this.onChange();},this.awayDelay);}
  seatOf(id){return this.seats.findIndex(s=>s&&s.id===id);}
  next(i,pred){const N=this.seats.length;for(let k=1;k<=N;k++){const j=(i+k)%N;if(this.seats[j]&&pred(this.seats[j],j))return j;}return -1;}
  ready(){return this.seats.filter(s=>s&&s.chips>0&&!s.sitOut);}
  setMode(m){if(!['holdem','omaha','omahanl','dealer'].includes(m))return false;const NM={holdem:"Hold'em",omaha:'Omaha',omahanl:'Omaha NL',dealer:'Choix du donneur'};
    if(this.stage==='waiting'||this.stage==='showdown'){this.mode=m;this.pendingMode=null;if(m!=='dealer')this.variant=m;this.log.push((this.stage==='waiting'?'Variante : ':'Prochaine main : ')+NM[m]);}
    else{this.pendingMode=m;this.log.push('Prochaine main : '+NM[m]);}return true;}
  startHand(){
    if(this.stage!=='waiting'&&this.stage!=='showdown')return false;
    if(this.ready().length<2){const m='Pas assez de joueurs avec des jetons — recavez-vous (💰 Se recaver)';if(this.log[this.log.length-1]!==m)this.log.push(m);return false;}
    if(this.pendingMode){this.mode=this.pendingMode;this.pendingMode=null;if(this.mode!=='dealer')this.variant=this.mode;}this.nextChosenHold=this.dealerChoice&&this.nextChosen;this.nextChosen=null;if(this.pendingReset)this.resetStacks();
    this.button=this.next(this.button<0?this.seats.length-1:this.button,s=>s.chips>0&&!s.sitOut);
    if(this.mode==='dealer'||this.dealerChoice&&!this.nextChosenHold){this.stage='choosing';this.chooser=this.button;this.hand=null;
      clearTimeout(this.timer);this.choiceDeadline=Date.now()+this.choiceTimeout;
      const prev=this.dealerChoice?(this.variant==='omahanl'?'omaha':VARS.includes(this.variant)?this.variant:'holdem'):(this.variant||'holdem');
      const ch=this.seats[this.button];if(!ch.connected){this.chooseVariant(ch.id,prev,true);return true;}
      this.timer=setTimeout(()=>{if(this.stage==='choosing'){this.chooseVariant(this.seats[this.chooser].id,prev,true);this.onChange();}},this.choiceTimeout);return true;}
    this.nextChosenHold=null;this.variant=VARS.includes(this.mode)?this.mode:'holdem';this.deal();return true;
  }
  nextDealer(){if(this.button<0)return -1;return this.next(this.button,s=>s.chips>0&&!s.sitOut);}
  chooseNext(id,v){if(!['holdem','omaha'].includes(v)||this.stage==='choosing')return false;const i=this.seatOf(id),nd=this.nextDealer();if(i<0||nd<0||i!==nd)return false;
    if(this.mode==='dealer')return false;if(this.dealerChoice){this.nextChosen=v;this.log.push(this.seats[i].name+' choisit : '+(v==='omaha'?'Omaha':"Hold'em"));return true;}this.pendingMode=v===this.mode?null:v;this.nextChosen=v;this.log.push(this.seats[i].name+' choisit : '+(v==='omaha'?'Omaha':"Hold'em"));return true;}
  chooseVariant(id,v,auto){if(this.stage!=='choosing'||this.seats[this.chooser]?.id!==id)return false;if(!(this.dealerChoice?['holdem','omaha','draw','stud']:VARS).includes(v))return false;
    clearTimeout(this.timer);this.variant=v;if(this.dealerChoice&&this.mode!=='dealer')this.mode=v;this.chosenAt=Date.now();this.log.push((auto?'(délai) ':'')+this.seats[this.chooser].name+' choisit '+({omaha:'Omaha PL',omahanl:'Omaha NL',draw:'Five Card Draw',stud:'Stud'}[v]||"Hold'em"));this.deal();return true;}
  deal(){
    const n=HOLEN[this.variant]||(isOmaha(this.variant)?4:2),deck=newDeck();
    const pl={};this.seats.forEach((s,i)=>{if(s&&s.chips>0&&!s.sitOut)pl[i]={hole:[],up:[],bet:0,total:0,folded:false,allin:false,acted:false};});
    for(let r=0;r<n;r++)for(const i in pl){pl[i].hole.push(deck.pop());pl[i].up.push(this.variant==='stud'&&r===2);}
    this.hand={deck,muck:[],board:[],pl,currentBet:0,minRaise:this.bb,results:null};this.stage='preflop';
    const ids=Object.keys(pl).map(Number);
    if(this.variant==='stud'){// pas de blindes : bring-in 100 par la plus petite carte visible (♣<♦<♥<♠), complément à 200
      const lo=ids.slice().sort((a,b)=>{const x=pl[a].hole[2],y=pl[b].hole[2];return rv(x)-rv(y)||SUITV[x[1]]-SUITV[y[1]];})[0];
      this.post(lo,Math.min(CONFIG.UNIT,this.bb));this.hand.currentBet=pl[lo].bet;this.hand.minRaise=this.bb-pl[lo].bet>0?this.bb-pl[lo].bet:this.bb;this.hand.bringIn=lo;this.log.push(this.seats[lo].name+' ouvre (bring-in '+pl[lo].bet+')');
      this.toAct=this.next(lo,(s,j)=>pl[j]&&!pl[j].allin);this.hand.turnStart=Date.now();this.checkRound();this.scheduleAway();return;}
    let sbI,bbI;if(ids.length===2){sbI=this.button;bbI=this.next(sbI,(s,j)=>pl[j]);}else{sbI=this.next(this.button,(s,j)=>pl[j]);bbI=this.next(sbI,(s,j)=>pl[j]);}
    this.post(sbI,this.sb);this.post(bbI,this.bb);this.hand.currentBet=this.bb;this.hand.sbI=sbI;this.hand.bbI=bbI;
    this.toAct=this.next(bbI,(s,j)=>pl[j]&&!pl[j].allin);this.hand.turnStart=Date.now();this.checkRound();this.scheduleAway();
  }
  post(i,a){const p=this.hand.pl[i],s=this.seats[i];a=Math.min(a,s.chips);s.chips-=a;p.bet+=a;p.total+=a;if(!s.chips)p.allin=true;}
  potTotal(){return Object.values(this.hand.pl).reduce((x,p)=>x+p.total,0);}
  limits(i){const h=this.hand,p=h.pl[i],s=this.seats[i],toCall=Math.min(h.currentBet-p.bet,s.chips);
    const maxAll=p.bet+s.chips;let minTo=Math.min(h.currentBet+h.minRaise,maxAll);let maxTo=maxAll;
    if(this.variant==='omaha')maxTo=Math.min(maxAll,Math.floor((h.currentBet+this.potTotal()+(h.currentBet-p.bet))/CONFIG.UNIT)*CONFIG.UNIT);minTo=Math.min(minTo,maxTo);
    return {toCall,minTo,maxTo,canRaise:maxAll>h.currentBet};}
  act(id,action,amount){
    const i=this.seatOf(id),h=this.hand;if(h&&this.stage==='draw'&&i===this.toAct&&action==='draw')return this.draw(i,amount);if(!h||i!==this.toAct||!BET.includes(this.stage))return false;
    const p=h.pl[i],s=this.seats[i],L=this.limits(i),nm=s.name;
    if(action==='fold'){p.folded=true;this.log.push(nm+' se couche');}
    else if(action==='check'){if(L.toCall>0)return false;this.log.push(nm+' check');}
    else if(action==='call'){if(L.toCall<=0)return false;this.post(i,L.toCall);this.log.push(nm+' suit');}
    else if(action==='raise'){if(!L.canRaise)return false;let to=Math.round(+amount);if(!(to>=L.minTo&&to<=L.maxTo)||(to%CONFIG.UNIT&&to!==L.maxTo))return false;
      const inc=to-h.currentBet;if(inc>=h.minRaise)h.minRaise=inc;
      if(to>h.currentBet){h.currentBet=to;for(const q of Object.values(h.pl))q.acted=false;}
      this.post(i,to-p.bet);this.log.push(nm+(p.allin?' tapis à ':' relance à ')+to);}
    else return false;
    this.lastAction=this.log[this.log.length-1];p.acted=true;p.last={type:p.allin?'allin':action,amount:action==='call'||action==='raise'?p.bet:0};
    this.toAct=this.next(i,(s2,j)=>h.pl[j]&&!h.pl[j].folded&&!h.pl[j].allin);h.turnStart=Date.now();this.checkRound();this.scheduleAway();return true;}
  // échange (five card draw) : idx = positions à jeter (0 à 5 cartes)
  draw(i,idx){const h=this.hand,p=h.pl[i];if(!Array.isArray(idx))idx=[];idx=[...new Set(idx.map(Number))].filter(k=>Number.isInteger(k)&&k>=0&&k<p.hole.length);
    for(const k of idx){h.muck.push(p.hole[k]);if(!h.deck.length){h.deck=shuffle(h.muck);h.muck=[];}p.hole[k]=h.deck.pop();}
    p.drawn=idx.length;p.acted=true;this.log.push(this.seats[i].name+(idx.length?' échange '+idx.length:' est servi'));this.lastAction=this.log[this.log.length-1];p.last={type:'draw',amount:idx.length};
    const nx=this.next(i,(s,j)=>h.pl[j]&&!h.pl[j].folded&&!h.pl[j].acted);h.turnStart=Date.now();
    if(nx>=0){this.toAct=nx;this.scheduleAway();return true;}return this.endDraw();}
  endDraw(){const h=this.hand;for(const q of Object.values(h.pl)){q.acted=false;if(q.last&&q.last.type==='draw')q.last=null;}this.stage='river';
    this.toAct=this.next(this.button,(s,j)=>h.pl[j]&&!h.pl[j].folded&&!h.pl[j].allin);this.checkRound();this.scheduleAway();return true;}
  studFirst(){const h=this.hand,c=Object.keys(h.pl).map(Number).filter(j=>!h.pl[j].folded&&!h.pl[j].allin);if(!c.length)return -1;const N=this.seats.length;
    const vis=j=>h.pl[j].hole.filter((x,k)=>h.pl[j].up[k]);return c.sort((a,b)=>cmp(upScore(vis(b)),upScore(vis(a)))||((a-this.button-1+N)%N)-((b-this.button-1+N)%N))[0];}
  checkRound(){const h=this.hand,live=Object.entries(h.pl).filter(([,p])=>!p.folded);
    if(live.length===1)return this.finish();if(this.stage==='draw')return;
    const canAct=live.filter(([,p])=>!p.allin);
    const done=canAct.every(([,p])=>p.acted&&p.bet===h.currentBet)||(canAct.length<=1&&canAct.every(([,p])=>p.bet>=h.currentBet));
    if(!done)return;
    for(const p of Object.values(h.pl)){p.bet=0;p.acted=false;if(p.last&&!['fold','allin'].includes(p.last.type))p.last=null;}h.turnStart=Date.now();h.currentBet=0;h.minRaise=this.bb;
    const nx=(this.variant==='draw'?{preflop:'draw',river:'showdown'}:this.variant==='stud'?{preflop:'flop',flop:'turn',turn:'river',river:'seventh',seventh:'showdown'}:{preflop:'flop',flop:'turn',turn:'river',river:'showdown'})[this.stage];
    if(nx==='showdown')return this.finish();
    this.stage=nx;
    if(nx==='draw'){this.toAct=this.next(this.button,(s,j)=>h.pl[j]&&!h.pl[j].folded);this.scheduleAway();return;}
    if(this.variant==='stud'){for(const [,p] of live){p.hole.push(h.deck.pop());p.up.push(nx!=='seventh');}this.toAct=this.studFirst();}
    else{h.board.push(...h.deck.splice(-(nx==='flop'?3:1)));
    this.toAct=this.next(this.button,(s,j)=>h.pl[j]&&!h.pl[j].folded&&!h.pl[j].allin);}
    if(canAct.length<=1)return this.checkRound();}
  finish(){const h=this.hand;const live=Object.keys(h.pl).filter(j=>!h.pl[j].folded).map(Number);const res=[];
    if(live.length===1){const w=live[0],a=this.potTotal();this.seats[w].chips+=a;res.push({seat:w,amount:a,name:this.seats[w].name});this.log.push(this.seats[w].name+' remporte '+a);}
    else{if(!['draw','stud'].includes(this.variant))while(h.board.length<5)h.board.push(h.deck.pop());
      const ev={};for(const j of live)ev[j]=bestHand(h.pl[j].hole,h.board,this.variant);
      const pots=sidePots(Object.entries(h.pl).map(([j,p])=>({id:+j,amount:p.total,folded:p.folded})));
      for(const pot of pots){let best=null,ws=[];for(const j of pot.eligible){const c=best?cmp(ev[j].score,best):1;if(c>0){best=ev[j].score;ws=[j];}else if(c===0)ws.push(j);}
        const N=this.seats.length,U=CONFIG.UNIT;ws.sort((a,b)=>((a-this.button-1+N)%N)-((b-this.button-1+N)%N));const share=Math.floor(pot.amount/ws.length/U)*U;let odd=pot.amount-share*ws.length;
        for(const w of ws){const x=Math.min(odd,U);odd-=x;const a=share+x;this.seats[w].chips+=a;res.push({seat:w,amount:a,name:this.seats[w].name,hand:ev[w].name,cards:ev[w].cards});this.log.push(this.seats[w].name+' gagne '+a+' ('+ev[w].name+')');}}
      h.shown=Object.fromEntries(live.map(j=>[j,{hole:h.pl[j].hole,name:ev[j].name}]));}
    this.record(res,live.length===1,h);h.results=res;this.stage='showdown';this.toAct=-1;clearTimeout(this.awayT);this.awayKey=null;}
  // records de la soirée : plus gros pot, meilleure main abattue, roi du bluff (pots gagnés sans abattage), mains gagnées
  record(res,noSD,h){const R=this.rec||(this.rec=Table.newRec()),pot=res.reduce((x,r)=>x+r.amount,0),top=res.slice().sort((a,b)=>b.amount-a.amount)[0];
    if(top&&(!R.bigPot||pot>R.bigPot.amount))R.bigPot={name:top.name,amount:pot};
    for(const n of new Set(res.map(r=>r.name))){R.wins[n]=(R.wins[n]||0)+1;if(noSD)R.noSD[n]=(R.noSD[n]||0)+1;}
    if(!noSD){for(const j of Object.keys(h.pl).filter(j=>!h.pl[j].folded)){const e=bestHand(h.pl[j].hole,h.board,this.variant);if(!R.bestHand||cmp(e.score,R.bestHand.score)>0)R.bestHand={name:this.seats[j].name,hand:e.name,score:e.score,cards:e.cards};}}}
  records(){const R=this.rec||Table.newRec(),mx=o=>{const e=Object.entries(o).sort((a,b)=>b[1]-a[1])[0];return e?{name:e[0],count:e[1]}:null;};
    return {bigPot:R.bigPot,bestHand:R.bestHand&&{name:R.bestHand.name,hand:R.bestHand.hand,cards:R.bestHand.cards},bluff:mx(R.noSD),wins:mx(R.wins)};}
  resetStacks(){if(this.stage!=='waiting'&&this.stage!=='showdown'){this.pendingReset=true;this.log.push('Nouveau joueur : piles remises à 5 000 à la prochaine main');return;}
    this.pendingReset=false;for(const s of this.seats)if(s){s.chips=CONFIG.STACK;s.rebuys=0;s.rebuyTotal=0;s.engaged=CONFIG.STACK;}this.log.push('Nouveau joueur : toutes les piles remises à 5 000');}
  fullReset(){this.rec=Table.newRec();clearTimeout(this.timer);this.hand=null;this.stage='waiting';this.toAct=-1;this.pendingReset=false;
    for(const s of this.seats)if(s){s.chips=CONFIG.STACK;s.rebuys=0;s.rebuyTotal=0;s.engaged=CONFIG.STACK;}this.log.push('Table réinitialisée : toutes les piles à 5 000, compteurs remis à zéro');return true;}
  removePlayer(id){const i=this.seatOf(id);if(i<0)return false;const nm=this.seats[i].name,h=this.hand,active=h&&h.pl[i]&&(BET.includes(this.stage)||this.stage==='draw');
    if(this.stage==='choosing'&&this.chooser===i){clearTimeout(this.timer);this.seats[i]=null;this.stage='waiting';this.log.push(nm+' quitte la table');return true;}
    if(active&&!h.pl[i].folded){h.pl[i].folded=true;h.pl[i].last={type:'fold'};}
    this.seats[i]=null;this.log.push(nm+' quitte la table');
    if(active&&this.stage==='draw'){const lv=Object.values(h.pl).filter(p=>!p.folded);if(lv.length===1)this.finish();else if(this.toAct===i){const nx=this.next(i,(s2,j)=>h.pl[j]&&!h.pl[j].folded&&!h.pl[j].acted);if(nx>=0)this.toAct=nx;else this.endDraw();}return true;}
    if(active){if(this.toAct===i)this.toAct=this.next(i,(s2,j)=>h.pl[j]&&!h.pl[j].folded&&!h.pl[j].allin);h.turnStart=Date.now();this.checkRound();this.scheduleAway();}
    return true;}
  rebuy(id,amount=CONFIG.REBUY){amount=+amount;if(!CONFIG.REBUY_OPTIONS.includes(amount))return false;const i=this.seatOf(id);if(i<0||this.seats[i].chips>=this.bb)return false;if(this.hand&&this.hand.pl[i]&&!['waiting','showdown','choosing'].includes(this.stage))return false;
    this.seats[i].chips+=amount;this.seats[i].rebuys++;this.seats[i].rebuyTotal=(this.seats[i].rebuyTotal||0)+amount;this.seats[i].engaged=(this.seats[i].engaged||CONFIG.STACK)+amount;this.log.push(this.seats[i].name+' se recave (+'+amount.toLocaleString('fr-FR').replace(/\s/g,' ')+')');return true;}
  toJSON(){const seats=this.seats.map((s,i)=>s&&{...s,connected:false,chips:s.chips+(this.hand&&this.hand.pl[i]&&this.stage!=='showdown'?this.hand.pl[i].total:0)});
    return {seats,pendingMode:this.pendingMode,sb:this.sb,bb:this.bb,mode:this.mode,variant:this.variant,button:this.button,log:this.log.slice(-20)};}
  static fromJSON(d){const t=new Table(d);Object.assign(t,{pendingMode:d.pendingMode||null,seats:d.seats,variant:d.variant,button:d.button,log:d.log||[]});return t;}
  view(id){const me=this.seatOf(id),h=this.hand;
    return {turnStart:h?h.turnStart:0,stage:this.stage,mode:this.mode,pendingMode:this.pendingMode||null,variant:this.variant,sb:this.sb,bb:this.bb,button:this.button,toAct:this.toAct,me,
      lastAction:this.lastAction||'',nextDealer:this.nextDealer(),nextChosen:this.nextChosen||null,chooser:this.stage==='choosing'?this.chooser:-1,chosenAt:this.chosenAt||0,now:Date.now(),choiceDeadline:this.choiceDeadline,log:this.log.slice(-8),
      board:h?h.board:[],pot:h?this.potTotal():0,currentBet:h?h.currentBet:0,results:h?h.results:null,
      limits:(h&&me===this.toAct&&me>=0&&BET.includes(this.stage))?this.limits(me):null,
      spectator:me<0,records:this.records(),seats:this.seats.map((s,i)=>s&&{name:s.name,avatar:s.avatar||null,rebuys:s.rebuys||0,rebuyTotal:s.rebuyTotal||0,engaged:s.engaged||CONFIG.STACK,bilan:s.chips+(h&&h.pl[i]&&this.stage!=='showdown'?h.pl[i].total:0)-(s.engaged||CONFIG.STACK),last:h&&h.pl[i]?h.pl[i].last||null:null,chips:s.chips,connected:s.connected,
        inHand:!!(h&&h.pl[i]),folded:h&&h.pl[i]?h.pl[i].folded:false,allin:h&&h.pl[i]?h.pl[i].allin:false,bet:h&&h.pl[i]?h.pl[i].bet:0,
        hole:h&&h.pl[i]?(i===me?h.pl[i].hole:(h.shown&&h.shown[i]&&this.stage==='showdown'?h.shown[i].hole:h.pl[i].hole.map((c,k)=>h.pl[i].up&&h.pl[i].up[k]?c:'??'))):[],up:h&&h.pl[i]&&this.variant==='stud'?h.pl[i].up:null,drawn:h&&h.pl[i]&&h.pl[i].drawn!=null?h.pl[i].drawn:null,
        handName:h&&h.shown&&h.shown[i]?h.shown[i].name:null})};}
}
module.exports={upScore,isOmaha,CONFIG,eval5,bestHand,sidePots,Table,cmp};
