// Comptes à deux niveaux : « Cette partie » (vient de la table) et « Bilan général » (ce fichier).
// bilan.json = { total: {clé: {name, net, parties}}, enCours: {idPartie: {room, key, name, net}} }
// Une partie (= un siège tant que sa pile n'est pas remise à 5 000) est ajoutée au total UNE seule fois :
// commit() la retire de enCours et l'ajoute à total dans la même écriture.
const fs=require('fs'),path=require('path');
const F=process.env.BILAN_FILE||path.join(__dirname,'bilan.json');
let B={total:{},enCours:{}},dirty=false,tm=null;
function save(){clearTimeout(tm);tm=null;dirty=false;const t=F+'.tmp';fs.writeFileSync(t,JSON.stringify(B,null,1));fs.renameSync(t,F);}
function later(){dirty=true;if(!tm)tm=setTimeout(save,500);}
function commit(id){const e=B.enCours[id];if(!e)return;delete B.enCours[id];if(!e.net){save();return;}// partie à 0 (ex. table quittée sans jouer) : pas comptée
  const T=B.total[e.key]||(B.total[e.key]={name:e.name,net:0,parties:0});T.name=e.name;T.net+=e.net;T.parties++;save();}
function live(id,room,key,name,net){const e=B.enCours[id];if(e&&e.net===net&&e.name===name&&e.room===room)return;B.enCours[id]={room,key,name,net};later();}
function ids(room){return Object.keys(B.enCours).filter(id=>B.enCours[id].room===room);}
function load(){try{const j=JSON.parse(fs.readFileSync(F,'utf8'));B.total=j.total||{};B.enCours=j.enCours||{};}catch(e){}
  // redémarrage du serveur : les tables en mémoire sont perdues, on solde les parties restées « en cours »
  const l=Object.keys(B.enCours);for(const id of l)commit(id);if(!l.length&&!fs.existsSync(F))save();}
function list(){return Object.values(B.total).map(x=>({name:x.name,net:x.net,parties:x.parties})).sort((a,b)=>b.net-a.net);}
function reset(){if(dirty)save();const d=new Date(),p=n=>String(n).padStart(2,'0');
  const base=path.join(path.dirname(F),`bilan-sauvegarde-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`);
  let f=base+'.json',k=2;while(fs.existsSync(f))f=base+'-'+(k++)+'.json';
  fs.writeFileSync(f,JSON.stringify(B,null,1));B.total={};save();return path.basename(f);}
module.exports={load,live,commit,ids,list,reset,file:F};
