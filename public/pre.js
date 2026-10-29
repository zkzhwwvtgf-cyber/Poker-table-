// Pré-actions (client) : décision à prendre quand mon tour arrive. Partagé avec test.js.
(function(g){
 // pre : {mode:'cf'} Parole/Couché · {mode:'any'} Suivre tout · {mode:'call',amt} Suivre ce montant précis
 function decide(pre,L){if(!pre||!L)return null;const c=L.toCall>0;
  if(pre.mode==='cf')return {action:c?'fold':'check'};
  if(pre.mode==='any')return {action:c?'call':'check'};
  if(pre.mode==='call')return L.toCall===pre.amt?{action:c?'call':'check'}:null;return null;}
 // à chaque changement de mise : « Suivre X » est annulé si le montant à suivre change
 function update(pre,toCall){if(pre&&pre.mode==='call'&&toCall!==pre.amt)return null;return pre;}
 const api={decide,update};if(typeof module!=='undefined')module.exports=api;else g.PRE=api;})(this);
