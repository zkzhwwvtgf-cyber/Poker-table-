// Moteur de poker : évaluation, pots, déroulement d'une main (Hold'em / PLO)
const CONFIG={STACK:5000,REBUY:1000,SEATS:6,UNIT:100,SB:100,BB:200};
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
function bestHand(hole,board,variant){
  if(variant==='omaha'){const l=[];for(const h of combos(hole,2))for(const bd of combos(board,3))l.push([...h,...bd]);return bestOf(l);}
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
    this.variant=this.mode==='omaha'?'omaha':'holdem';this.button=-1;this.hand=null;this.stage='waiting';this.log=[];this.choiceTimeout=o.choiceTimeout||20000;this.onChange=()=>{};this.timer=null;}
  addPlayer(id,name,chips=CONFIG.STACK){let i=this.seats.findIndex(s=>!s);if(i<0)return -1;this.seats[i]={id,name,chips,connected:true,sitOut:false,rebuys:0};return i;}
  seatOf(id){return this.seats.findIndex(s=>s&&s.id===id);}
  next(i,pred){const N=this.seats.length;for(let k=1;k<=N;k++){const j=(i+k)%N;if(this.seats[j]&&pred(this.seats[j],j))return j;}return -1;}
  ready(){return this.seats.filter(s=>s&&s.chips>0&&!s.sitOut);}
  setMode(m){if(!['holdem','omaha','dealer'].includes(m))return false;const NM={holdem:"Hold'em",omaha:'Omaha',dealer:'Choix du donneur'};
    if(this.stage==='waiting'||this.stage==='showdown'){this.mode=m;this.pendingMode=null;if(m!=='dealer')this.variant=m;this.log.push('Variante : '+NM[m]+(this.stage==='waiting'?'':' à partir de la prochaine main'));}
    else{this.pendingMode=m;this.log.push('Variante : '+NM[m]+' à partir de la prochaine main');}return true;}
  startHand(){
    if(this.stage!=='waiting'&&this.stage!=='showdown')return false;
    if(this.ready().length<2)return false;
    if(this.pendingMode){this.mode=this.pendingMode;this.pendingMode=null;}
    this.button=this.next(this.button<0?this.seats.length-1:this.button,s=>s.chips>0&&!s.sitOut);
    if(this.mode==='dealer'){this.stage='choosing';this.chooser=this.button;this.hand=null;
      clearTimeout(this.timer);this.choiceDeadline=Date.now()+this.choiceTimeout;
      const prev=this.variant||'holdem';
      const ch=this.seats[this.button];if(!ch.connected){this.chooseVariant(ch.id,prev,true);return true;}
      this.timer=setTimeout(()=>{if(this.stage==='choosing'){this.chooseVariant(this.seats[this.chooser].id,prev,true);this.onChange();}},this.choiceTimeout);return true;}
    this.variant=this.mode==='omaha'?'omaha':'holdem';this.deal();return true;
  }
  chooseVariant(id,v,auto){if(this.stage!=='choosing'||this.seats[this.chooser]?.id!==id)return false;if(!['holdem','omaha'].includes(v))return false;
    clearTimeout(this.timer);this.variant=v;this.log.push((auto?'(délai) ':'')+this.seats[this.chooser].name+' choisit '+(v==='omaha'?'Omaha':"Hold'em"));this.deal();return true;}
  deal(){
    const n=this.variant==='omaha'?4:2,deck=newDeck();
    const pl={};this.seats.forEach((s,i)=>{if(s&&s.chips>0&&!s.sitOut)pl[i]={hole:[],bet:0,total:0,folded:false,allin:false,acted:false};});
    for(let r=0;r<n;r++)for(const i in pl)pl[i].hole.push(deck.pop());
    this.hand={deck,board:[],pl,currentBet:0,minRaise:this.bb,results:null};this.stage='preflop';
    const ids=Object.keys(pl).map(Number);
    let sbI,bbI;if(ids.length===2){sbI=this.button;bbI=this.next(sbI,(s,j)=>pl[j]);}else{sbI=this.next(this.button,(s,j)=>pl[j]);bbI=this.next(sbI,(s,j)=>pl[j]);}
    this.post(sbI,this.sb);this.post(bbI,this.bb);this.hand.currentBet=this.bb;this.hand.sbI=sbI;this.hand.bbI=bbI;
    this.toAct=this.next(bbI,(s,j)=>pl[j]&&!pl[j].allin);this.checkRound();
  }
  post(i,a){const p=this.hand.pl[i],s=this.seats[i];a=Math.min(a,s.chips);s.chips-=a;p.bet+=a;p.total+=a;if(!s.chips)p.allin=true;}
  potTotal(){return Object.values(this.hand.pl).reduce((x,p)=>x+p.total,0);}
  limits(i){const h=this.hand,p=h.pl[i],s=this.seats[i],toCall=Math.min(h.currentBet-p.bet,s.chips);
    const maxAll=p.bet+s.chips;let minTo=Math.min(h.currentBet+h.minRaise,maxAll);let maxTo=maxAll;
    if(this.variant==='omaha')maxTo=Math.min(maxAll,Math.floor((h.currentBet+this.potTotal()+(h.currentBet-p.bet))/CONFIG.UNIT)*CONFIG.UNIT);minTo=Math.min(minTo,maxTo);
    return {toCall,minTo,maxTo,canRaise:maxAll>h.currentBet};}
  act(id,action,amount){
    const i=this.seatOf(id),h=this.hand;if(!h||i!==this.toAct||!['preflop','flop','turn','river'].includes(this.stage))return false;
    const p=h.pl[i],s=this.seats[i],L=this.limits(i),nm=s.name;
    if(action==='fold'){p.folded=true;this.log.push(nm+' se couche');}
    else if(action==='check'){if(L.toCall>0)return false;this.log.push(nm+' parole');}
    else if(action==='call'){if(L.toCall<=0)return false;this.post(i,L.toCall);this.log.push(nm+' suit');}
    else if(action==='raise'){if(!L.canRaise)return false;let to=Math.round(+amount);if(!(to>=L.minTo&&to<=L.maxTo)||(to%CONFIG.UNIT&&to!==L.maxTo))return false;
      const inc=to-h.currentBet;if(inc>=h.minRaise)h.minRaise=inc;
      if(to>h.currentBet){h.currentBet=to;for(const q of Object.values(h.pl))q.acted=false;}
      this.post(i,to-p.bet);this.log.push(nm+(p.allin?' tapis à ':' relance à ')+to);}
    else return false;
    p.acted=true;
    this.toAct=this.next(i,(s2,j)=>h.pl[j]&&!h.pl[j].folded&&!h.pl[j].allin);this.checkRound();return true;}
  checkRound(){const h=this.hand,live=Object.entries(h.pl).filter(([,p])=>!p.folded);
    if(live.length===1)return this.finish();
    const canAct=live.filter(([,p])=>!p.allin);
    const done=canAct.every(([,p])=>p.acted&&p.bet===h.currentBet)||(canAct.length<=1&&canAct.every(([,p])=>p.bet>=h.currentBet));
    if(!done)return;
    for(const p of Object.values(h.pl)){p.bet=0;p.acted=false;}h.currentBet=0;h.minRaise=this.bb;
    const nx={preflop:'flop',flop:'turn',turn:'river',river:'showdown'}[this.stage];
    if(nx==='showdown')return this.finish();
    this.stage=nx;h.board.push(...h.deck.splice(-(nx==='flop'?3:1)));
    this.toAct=this.next(this.button,(s,j)=>h.pl[j]&&!h.pl[j].folded&&!h.pl[j].allin);
    if(canAct.length<=1)return this.checkRound();}
  finish(){const h=this.hand;const live=Object.keys(h.pl).filter(j=>!h.pl[j].folded).map(Number);const res=[];
    if(live.length===1){const w=live[0],a=this.potTotal();this.seats[w].chips+=a;res.push({seat:w,amount:a,name:this.seats[w].name});this.log.push(this.seats[w].name+' remporte '+a);}
    else{while(h.board.length<5)h.board.push(h.deck.pop());
      const ev={};for(const j of live)ev[j]=bestHand(h.pl[j].hole,h.board,this.variant);
      const pots=sidePots(Object.entries(h.pl).map(([j,p])=>({id:+j,amount:p.total,folded:p.folded})));
      for(const pot of pots){let best=null,ws=[];for(const j of pot.eligible){const c=best?cmp(ev[j].score,best):1;if(c>0){best=ev[j].score;ws=[j];}else if(c===0)ws.push(j);}
        const N=this.seats.length,U=CONFIG.UNIT;ws.sort((a,b)=>((a-this.button-1+N)%N)-((b-this.button-1+N)%N));const share=Math.floor(pot.amount/ws.length/U)*U;let odd=pot.amount-share*ws.length;
        for(const w of ws){const x=Math.min(odd,U);odd-=x;const a=share+x;this.seats[w].chips+=a;res.push({seat:w,amount:a,name:this.seats[w].name,hand:ev[w].name});this.log.push(this.seats[w].name+' gagne '+a+' ('+ev[w].name+')');}}
      h.shown=Object.fromEntries(live.map(j=>[j,{hole:h.pl[j].hole,name:ev[j].name}]));}
    h.results=res;this.stage='showdown';this.toAct=-1;}
  rebuy(id){const i=this.seatOf(id);if(i<0||this.seats[i].chips>0)return false;if(this.hand&&this.hand.pl[i]&&!['waiting','showdown','choosing'].includes(this.stage))return false;
    this.seats[i].chips+=CONFIG.REBUY;this.seats[i].rebuys++;this.log.push(this.seats[i].name+' se recave (+1 000)');return true;}
  toJSON(){const seats=this.seats.map((s,i)=>s&&{...s,connected:false,chips:s.chips+(this.hand&&this.hand.pl[i]&&this.stage!=='showdown'?this.hand.pl[i].total:0)});
    return {seats,pendingMode:this.pendingMode,sb:this.sb,bb:this.bb,mode:this.mode,variant:this.variant,button:this.button,log:this.log.slice(-20)};}
  static fromJSON(d){const t=new Table(d);Object.assign(t,{pendingMode:d.pendingMode||null,seats:d.seats,variant:d.variant,button:d.button,log:d.log||[]});return t;}
  view(id){const me=this.seatOf(id),h=this.hand;
    return {stage:this.stage,mode:this.mode,pendingMode:this.pendingMode||null,variant:this.variant,sb:this.sb,bb:this.bb,button:this.button,toAct:this.toAct,me,
      chooser:this.stage==='choosing'?this.chooser:-1,choiceDeadline:this.choiceDeadline,log:this.log.slice(-8),
      board:h?h.board:[],pot:h?this.potTotal():0,currentBet:h?h.currentBet:0,results:h?h.results:null,
      limits:(h&&me===this.toAct&&me>=0)?this.limits(me):null,
      spectator:me<0,seats:this.seats.map((s,i)=>s&&{name:s.name,rebuys:s.rebuys||0,chips:s.chips,connected:s.connected,
        inHand:!!(h&&h.pl[i]),folded:h&&h.pl[i]?h.pl[i].folded:false,allin:h&&h.pl[i]?h.pl[i].allin:false,bet:h&&h.pl[i]?h.pl[i].bet:0,
        hole:h&&h.pl[i]?(i===me?h.pl[i].hole:(h.shown&&h.shown[i]&&this.stage==='showdown'?h.shown[i].hole:h.pl[i].hole.map(()=>'??'))):[],
        handName:h&&h.shown&&h.shown[i]?h.shown[i].name:null})};}
}
module.exports={CONFIG,eval5,bestHand,sidePots,Table,cmp};
