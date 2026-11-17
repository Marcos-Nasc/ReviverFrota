/* ReviverFrota · Concessionária Reviver
   Front da aplicação. Fala com o servidor por api.php. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const CSRF=document.querySelector('meta[name="csrf"]').content;
const USER=JSON.parse(document.getElementById('usuario-json').textContent);
const ADMIN=USER.perfil==='admin';
const DANOS=['Risco','Amassado','Trinca','Quebrado','Ausente','Desgaste','Ferrugem'];
const GRAV={leve:'Leve',media:'Média',grave:'Grave'};
const FUEL=['E','1/4','1/2','3/4','F'];
const hoje=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
const agora=()=>new Date().toTimeString().slice(0,5);
const fmtData=iso=>{if(!iso)return '';try{return new Date(String(iso).replace(' ','T')).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return iso}};
const fmtDia=d=>d?String(d).slice(0,10).split('-').reverse().join('/'):'';

/* ---------- catálogo de veículos 3D ---------- */
const V3D=[
  ['hatch','Hatch',0xeef0f2],['carro','Sedã',0xb9c0c7],['suv','SUV',0x2d4f7c],['picape','Picape cabine dupla',0xb9c0c7],
  ['van','Van / furgão',0xeef0f2],['onibus','Micro-ônibus',0xeef0f2],['caminhao','Caminhão baú',0xeef0f2],['caminhao_lona','Caminhão carroceria com lona',0xeef0f2],
  ['moto','Motocicleta',0x9e2a2b],['golfe','Carrinho elétrico 4 lugares',0xeef0f2],['golfe2','Carrinho elétrico 2 lugares',0xeef0f2],['utilitario','Utilitário elétrico com caçamba',0xeef0f2]];
const BASES=Object.fromEntries(V3D.map(b=>[b[0],b[1]]));
const BASECOR=Object.fromEntries(V3D.map(b=>[b[0],b[2]]));
const CORES=[['Branco',0xeef0f2],['Prata',0xb9c0c7],['Grafite',0x4a5058],['Preto',0x1e2226],['Azul',0x2d4f7c],['Vermelho',0x9e2a2b],['Verde',0x3d6b4f],['Amarelo',0xe0b03a]];
const hex=n=>'#'+n.toString(16).padStart(6,'0');

/* ---------- servidor ---------- */
async function api(action,data,get){
  let url='api.php?action='+encodeURIComponent(action);
  const init={method:'GET',headers:{'X-CSRF-Token':CSRF},credentials:'same-origin'};
  if(get){url+='&'+new URLSearchParams(data||{}).toString()}
  else{init.method='POST';if(data instanceof FormData)init.body=data;else{init.headers['Content-Type']='application/json';init.body=JSON.stringify(data||{})}}
  let r;try{r=await fetch(url,init)}catch(e){throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.')}
  if(r.status===401){location.href='login.php';throw new Error('Sua sessão expirou.')}
  let j;try{j=await r.json()}catch(e){throw new Error('O servidor respondeu de forma inesperada.')}
  if(!j.ok)throw new Error(j.erro||'Erro no servidor.');
  if(ALTERA.has(action))aposAlteracao();
  return j;
}
function falha(e){console.error(e);toast(e&&e.message?e.message:'Algo deu errado. Tente de novo.')}
const ALTERA=new Set(['ficha','responder','avaria_criar','avaria_foto','avaria_excluir']);
const timers={};
function debounce(key,fn,ms){clearTimeout(timers[key]);timers[key]=setTimeout(fn,ms||600)}

/* ---------- estado ---------- */
const UI_KEY='reviver-checklist-ui';
const ui={view:'vistoria',frotaId:null,veiculoId:null,ptab:'ficha',modeloSel:null};
try{Object.assign(ui,JSON.parse(localStorage.getItem(UI_KEY)||'{}'))}catch(e){}
function saveUi(){try{localStorage.setItem(UI_KEY,JSON.stringify(ui))}catch(e){}}
const state={modelos:[],frotas:[],veiculos:[]};
const vistCache={};
const modelo=id=>state.modelos.find(m=>m.id===id);
const frota=id=>state.frotas.find(f=>f.id===id);
const curVeh=()=>state.veiculos.find(v=>v.id===ui.veiculoId);
const vBase=v=>{const b=v.base||(modelo(v.modeloId)||{}).base;return BASES[b]?b:'carro'};
const vCor=v=>v.cor!=null?v.cor:BASECOR[vBase(v)];
const vist=vid=>vistCache[vid]||null;
async function carregarVist(vid){const r=await api('vistoria',{veiculo_id:vid},true);vistCache[vid]=r.vistoria;return r.vistoria}
function checklistFor(v){
  const m=modelo(v.modeloId),f=frota(v.frotaId);if(!m)return [];
  const out=m.secoes.map(s=>({nome:s.nome,itens:s.itens.filter(i=>!f||!f.ocultos.includes(i.id)).map(i=>Object.assign({},i,{origem:'modelo'}))}));
  if(f)f.extras.filter(x=>!x.modelos.length||x.modelos.includes(m.id)).forEach(x=>{
    let s=out.find(o=>o.nome===x.secao);if(!s){s={nome:x.secao,itens:[]};out.push(s)}
    s.itens.push(Object.assign({},x,{origem:'frota'}));});
  return out.filter(s=>s.itens.length);
}
const answered=(vs,i)=>vs.resp[i.id]!==undefined&&vs.resp[i.id]!=='';

/* ---------- fotos ---------- */
const photoSrc=av=>av.foto||'';
function readPhoto(file){return new Promise((res,rej)=>{
  const fail=()=>rej(new Error('Não foi possível ler essa imagem. Tente outra foto.'));
  const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{
    const k=Math.min(1,1600/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(b=>b?res({blob:b,url:URL.createObjectURL(b)}):fail(),'image/jpeg',.82)};
    img.onerror=fail;img.src=r.result};r.onerror=fail;r.readAsDataURL(file)})}

/* ---------- construtores 3D ---------- */
const HAS3D=!!window.THREE;
function mats(color){return{
  paint:new THREE.MeshStandardMaterial({color,metalness:.3,roughness:.45}),
  paint2:new THREE.MeshStandardMaterial({color:new THREE.Color(color).multiplyScalar(.8),metalness:.25,roughness:.55}),
  glass:new THREE.MeshStandardMaterial({color:0x22313d,metalness:.5,roughness:.12,transparent:true,opacity:.88}),
  plastic:new THREE.MeshStandardMaterial({color:0x2c3137,metalness:.1,roughness:.8}),
  rubber:new THREE.MeshStandardMaterial({color:0x17191b,roughness:.95}),
  rim:new THREE.MeshStandardMaterial({color:0xaeb6be,metalness:.75,roughness:.3}),
  head:new THREE.MeshStandardMaterial({color:0xfff6dc,emissive:0xfff0c0,emissiveIntensity:.4}),
  tail:new THREE.MeshStandardMaterial({color:0xb3121a,emissive:0x8a0a10,emissiveIntensity:.35}),
  seat:new THREE.MeshStandardMaterial({color:0x2c3a44,roughness:.9}),
  box:new THREE.MeshStandardMaterial({color:0xd3d9de,metalness:.25,roughness:.55}),
  box2:new THREE.MeshStandardMaterial({color:0xb2bbc3,metalness:.25,roughness:.6}),
  tarp:new THREE.MeshStandardMaterial({color:0x4d6640,roughness:.95})};}
const Bx=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
const Cy=(r1,r2,h,s)=>new THREE.CylinderGeometry(r1,r2,h,s||24);
function P(geo,mat,x,y,z,key,nome,o){o=o||{};const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);
  if(o.rx)m.rotation.x=o.rx;if(o.ry)m.rotation.y=o.ry;if(o.rz)m.rotation.z=o.rz;
  m.userData={key,nome,lat:o.lat||null,side:o.side||null};return m;}
function pair(g,geoFn,mat,x,y,zOff,key,nome,lat,o){[1,-1].forEach(s=>g.add(P(geoFn(),mat,x,y,s*zOff,key,nome,Object.assign({},o||{},{lat,side:s>0?'d':'e'}))));}
function wheels(g,k,list,r,w,wz,rimK){list.forEach(([x,key,n])=>{
  pair(g,()=>Cy(r,r,w,28),k.rubber,x,r,wz,key,n,'m',{rx:Math.PI/2});
  pair(g,()=>Cy(r*(rimK||.6),r*(rimK||.6),w+.01,20),k.rim,x,r,wz,key,n,'m',{rx:Math.PI/2});});}

function buildCarLike(g,col,p){
  const k=mats(col),L=p.L,W=p.W,c=p.clear,h=p.bodyH,top=c+h,mid=c+h/2,bump=.22,xF=L/2,xR=-L/2;
  const doorsL=L-2*bump-p.hoodL-p.trunkL,dL=doorsL/2;
  const xHood=xF-bump-p.hoodL/2,xDF=xF-bump-p.hoodL-dL/2,xDR=xDF-dL,xTr=xR+bump+p.trunkL/2;
  g.add(P(Bx(bump,h*.62,W*.98),k.paint2,xF-bump/2,c+h*.31,0,'pchoque_d','Para-choque dianteiro'));
  g.add(P(Bx(bump,h*.62,W*.98),k.paint2,xR+bump/2,c+h*.31,0,'pchoque_t','Para-choque traseiro'));
  pair(g,()=>Bx(p.hoodL,h,W/2),k.paint,xHood,mid,W/4,'paralama_d','Paralama dianteiro','m');
  g.add(P(Bx(p.hoodL*.97,.05,W*.9),k.paint,xHood,top+.025,0,'capo','Capô'));
  pair(g,()=>Bx(dL-.03,h,W/2),k.paint,xDF,mid,W/4,'porta_d','Porta dianteira','f');
  pair(g,()=>Bx(dL-.03,h,W/2),k.paint,xDR,mid,W/4,'porta_t','Porta traseira','f');
  pair(g,()=>Bx(p.trunkL,h,W/2),k.paint,xTr,mid,W/4,'paralama_t','Paralama traseiro','m');
  g.add(P(Bx(p.trunkL*.97,.05,W*.9),k.paint,xTr,top+.025,0,'tampa',p.hatch?'Tampa traseira':'Tampa do porta-malas'));
  const cabL=doorsL*p.cab,cabX=(xDF+xDR)/2+p.cabShift,ch=p.cabinH;
  pair(g,()=>Bx(cabL,ch,W*.43),k.glass,cabX,top+ch/2,W*.215,'vidro','Vidro lateral','m');
  g.add(P(Bx(cabL+.02,.07,W*.86),k.paint,cabX,top+ch+.035,0,'teto','Teto'));
  g.add(P(Bx(.05,Math.hypot(ch,p.wsRun),W*.84),k.glass,cabX+cabL/2+p.wsRun/2,top+ch/2,0,'parabrisa','Para-brisa',{rz:Math.atan2(p.wsRun,ch)}));
  g.add(P(Bx(.05,Math.hypot(ch,p.rwRun),W*.84),k.glass,cabX-cabL/2-p.rwRun/2,top+ch/2,0,'vidro_t','Vidro traseiro',{rz:-Math.atan2(p.rwRun,ch)}));
  wheels(g,k,[[xHood-p.hoodL*.05,'pneu_d','Pneu dianteiro'],[xTr+p.trunkL*.1,'pneu_t','Pneu traseiro']],p.wheelR,.26,W/2-.1);
  pair(g,()=>Bx(.04,h*.22,W*.2),k.head,xF-bump+.02,top-h*.2,W*.32,'farol','Farol','m');
  pair(g,()=>Bx(.04,h*.22,W*.2),k.tail,xR+bump-.02,top-h*.2,W*.32,'lanterna','Lanterna traseira','f');
  pair(g,()=>Bx(.14,.1,.16),k.plastic,cabX+cabL/2-.05,top+.1,W/2+.08,'retrovisor','Retrovisor','m');
  if(p.rack)pair(g,()=>Bx(cabL*.85,.05,.05),k.plastic,cabX,top+ch+.11,W*.36,'rack','Rack de teto','m');
}
const CARP={
  hatch:{L:3.95,W:1.74,clear:.32,bodyH:.6,wheelR:.31,hoodL:1.0,trunkL:.35,cab:1.15,cabShift:-.15,cabinH:.52,wsRun:.55,rwRun:.06,hatch:true},
  carro:{L:4.4,W:1.78,clear:.32,bodyH:.62,wheelR:.32,hoodL:1.1,trunkL:.85,cab:1.05,cabShift:-.05,cabinH:.5,wsRun:.55,rwRun:.4},
  suv:{L:4.5,W:1.9,clear:.45,bodyH:.78,wheelR:.38,hoodL:1.0,trunkL:.55,cab:1.22,cabShift:-.12,cabinH:.62,wsRun:.45,rwRun:.12,rack:true,hatch:true}};

function buildPickup(g,col){
  const k=mats(col),W=1.86,c=.48,h=.72,top=c+h;
  g.add(P(Bx(.2,h*.6,W*.98),k.paint2,2.5,c+h*.3,0,'pchoque_d','Para-choque dianteiro'));
  pair(g,()=>Bx(1.2,h,W/2),k.paint,1.8,c+h/2,W/4,'paralama_d','Paralama dianteiro','m');
  g.add(P(Bx(1.17,.05,W*.9),k.paint,1.8,top+.025,0,'capo','Capô'));
  pair(g,()=>Bx(.92,h,W/2),k.paint,.725,c+h/2,W/4,'porta_d','Porta dianteira','f');
  pair(g,()=>Bx(.92,h,W/2),k.paint,-.225,c+h/2,W/4,'porta_t','Porta traseira','f');
  const cabL=1.9,cabX=.25,ch=.6;
  pair(g,()=>Bx(cabL,ch,W*.43),k.glass,cabX,top+ch/2,W*.215,'vidro','Vidro lateral','m');
  g.add(P(Bx(cabL+.02,.07,W*.86),k.paint,cabX,top+ch+.035,0,'teto','Teto'));
  g.add(P(Bx(.05,Math.hypot(ch,.5),W*.84),k.glass,cabX+cabL/2+.25,top+ch/2,0,'parabrisa','Para-brisa',{rz:Math.atan2(.5,ch)}));
  g.add(P(Bx(.05,ch,W*.84),k.glass,cabX-cabL/2-.02,top+ch/2,0,'vidro_t','Vidro traseiro'));
  g.add(P(Bx(1.65,.22,W*.9),k.plastic,-1.525,c+.05,0,'chassi','Chassi'));
  g.add(P(Bx(1.6,.05,W-.12),k.paint2,-1.525,c+.185,0,'assoalho','Assoalho da caçamba'));
  pair(g,()=>Bx(1.65,h,.06),k.paint,-1.525,c+h/2,W/2-.03,'lateral_cacamba','Lateral da caçamba','f');
  g.add(P(Bx(.06,h,W),k.paint,-2.32,c+h/2,0,'tampa','Tampa traseira'));
  g.add(P(Bx(.06,h,W-.12),k.paint,-.73,c+h/2,0,'frente_cacamba','Frente da caçamba'));
  g.add(P(Bx(.18,h*.4,W*.98),k.plastic,-2.44,c+h*.2,0,'pchoque_t','Para-choque traseiro'));
  wheels(g,k,[[1.75,'pneu_d','Pneu dianteiro'],[-1.6,'pneu_t','Pneu traseiro']],.4,.28,W/2-.08);
  pair(g,()=>Bx(.04,.16,W*.2),k.head,2.42,top-.15,W*.32,'farol','Farol','m');
  pair(g,()=>Bx(.04,.3,.1),k.tail,-2.36,top-.2,W/2-.06,'lanterna','Lanterna traseira','f');
  pair(g,()=>Bx(.14,.1,.16),k.plastic,1.15,top+.1,W/2+.08,'retrovisor','Retrovisor','m');
}
function buildVan(g,col){
  const k=mats(col),W=2.0,c=.4;
  g.add(P(Bx(.2,.4,W*.98),k.paint2,2.5,c+.2,0,'pchoque_d','Para-choque dianteiro'));
  pair(g,()=>Bx(.8,.7,W/2),k.paint,2.0,c+.35,W/4,'paralama_d','Paralama dianteiro','m');
  g.add(P(Bx(.78,.05,W*.9),k.paint,2.0,c+.725,0,'capo','Capô'));
  g.add(P(Bx(.05,Math.hypot(1.13,.3),W*.9),k.glass,1.6,c+1.285,0,'parabrisa','Para-brisa',{rz:Math.atan2(.3,1.13)}));
  pair(g,()=>Bx(.85,.95,W/2),k.paint,1.175,c+.475,W/4,'porta_d','Porta da cabine','f');
  pair(g,()=>Bx(.7,.78,.04),k.glass,1.1,c+1.34,W/2-.02,'vidro','Vidro da porta','m');
  pair(g,()=>Bx(3.25,1.9,W/2),k.paint,-.875,c+.95,W/4,'lateral','Lateral do furgão','lado');
  g.add(P(Bx(3.97,.06,W),k.paint,-.525,c+1.93,0,'teto','Teto'));
  g.add(P(Bx(1.0,1.55,.03),k.paint2,.1,c+.85,(W/2+.015),'porta_lat','Porta lateral corrediça'));
  g.add(P(Bx(.04,1.8,W*.94),k.paint2,-2.52,c+.95,0,'portas_t','Portas traseiras'));
  g.add(P(Bx(.2,.4,W*.98),k.paint2,-2.5,c+.2,0,'pchoque_t','Para-choque traseiro'));
  wheels(g,k,[[1.95,'pneu_d','Pneu dianteiro'],[-1.75,'pneu_t','Pneu traseiro']],.36,.26,W/2-.1);
  pair(g,()=>Bx(.04,.15,.3),k.head,2.42,c+.55,W*.3,'farol','Farol','m');
  pair(g,()=>Bx(.04,.4,.14),k.tail,-2.55,c+.75,W/2-.1,'lanterna','Lanterna traseira','f');
  pair(g,()=>Bx(.12,.22,.1),k.plastic,1.5,c+1.15,W/2+.1,'retrovisor','Retrovisor','m');
}
function buildBus(g,col){
  const k=mats(col),W=2.3,c=.42;
  pair(g,()=>Bx(7.4,1.15,W/2),k.paint,0,c+.575,W/4,'carroceria','Carroceria','lado');
  pair(g,()=>Bx(7.0,1.0,W/2-.02),k.glass,-.2,c+1.65,W/4,'janelas','Janelas','lado');
  pair(g,()=>Bx(.3,1.05,.06),k.paint,3.45,c+1.67,W/2-.03,'coluna','Coluna dianteira','f');
  g.add(P(Bx(7.3,.12,W),k.paint,-.05,c+2.21,0,'teto','Teto'));
  g.add(P(Bx(.06,1.08,W*.92),k.glass,3.56,c+1.67,0,'parabrisa','Para-brisa',{rz:Math.atan2(.2,1.05)}));
  g.add(P(Bx(.05,.7,W*.8),k.glass,-3.72,c+1.7,0,'vidro_t','Vidro traseiro'));
  g.add(P(Bx(.85,1.95,.04),k.paint2,2.85,c+1.0,(W/2+.02),'porta','Porta de embarque'));
  g.add(P(Bx(.18,.4,W),k.plastic,3.75,c+.2,0,'pchoque_d','Para-choque dianteiro'));
  g.add(P(Bx(.18,.4,W),k.plastic,-3.75,c+.2,0,'pchoque_t','Para-choque traseiro'));
  wheels(g,k,[[2.55,'pneu_d','Pneu dianteiro'],[-2.3,'pneu_t','Pneu traseiro']],.48,.3,W/2-.12,.55);
  pair(g,()=>Bx(.04,.16,.3),k.head,3.71,c+.62,W*.35,'farol','Farol','m');
  pair(g,()=>Bx(.04,.2,.18),k.tail,-3.71,c+.62,W*.38,'lanterna','Lanterna traseira','f');
  pair(g,()=>Bx(.08,.4,.08),k.plastic,3.75,c+1.9,W/2+.2,'retrovisor','Espelho retrovisor','m');
}
function truckCab(g,k){
  g.add(P(Bx(5.9,.22,1.0),k.plastic,.15,.72,0,'chassi','Chassi'));
  pair(g,()=>Bx(1.6,1.75,1.1),k.paint,2.25,1.825,.55,'cabine','Cabine','lado');
  pair(g,()=>Bx(.9,1.0,.04),k.paint2,2.3,1.45,1.12,'porta','Porta da cabine','f');
  pair(g,()=>Bx(1.0,.6,.04),k.glass,2.3,2.25,1.12,'vidro','Vidro lateral','m');
  g.add(P(Bx(.06,.75,1.95),k.glass,3.06,2.2,0,'parabrisa','Para-brisa'));
  g.add(P(Bx(.22,.45,2.3),k.plastic,3.12,.78,0,'pchoque_d','Para-choque dianteiro'));
  g.add(P(Bx(.06,.5,1.3),k.plastic,3.07,1.35,0,'grade','Grade frontal'));
  g.add(P(Bx(.15,.2,2.3),k.plastic,-2.95,.75,0,'pchoque_t','Para-choque traseiro'));
  g.add(P(Cy(.28,.28,.9,20),k.rim,1.0,.6,-.78,'tanque','Tanque de combustível',{rz:Math.PI/2}));
  wheels(g,k,[[2.35,'pneu_d','Pneu dianteiro'],[-1.35,'pneu_t1','Pneu traseiro (1º eixo)'],[-2.35,'pneu_t2','Pneu traseiro (2º eixo)']],.48,.32,.95,.55);
  pair(g,()=>Bx(.05,.18,.34),k.head,3.08,1.1,.85,'farol','Farol','m');
  pair(g,()=>Bx(.05,.14,.3),k.tail,-3.04,.78,.95,'lanterna','Lanterna traseira','f');
  pair(g,()=>Bx(.08,.5,.1),k.plastic,2.95,2.25,1.28,'retrovisor','Espelho retrovisor','m');
}
function buildTruck(g,col){const k=mats(col);truckCab(g,k);
  pair(g,()=>Bx(4.3,2.35,1.2),k.box,-.85,2.125,.6,'bau','Baú','lado');
  g.add(P(Bx(.06,2.25,2.3),k.box2,-3.03,2.12,0,'portas_bau','Portas do baú'));}
function buildTruckLona(g,col){const k=mats(col);truckCab(g,k);
  g.add(P(Bx(4.4,.12,2.4),k.plastic,-.8,1.0,0,'assoalho','Assoalho da carroceria'));
  pair(g,()=>Bx(4.4,.65,.06),k.box2,-.8,1.39,1.17,'guarda','Guarda lateral','f');
  g.add(P(Bx(.06,.9,2.4),k.box2,1.37,1.5,0,'guarda_d','Guarda dianteira'));
  g.add(P(Bx(.06,.65,2.4),k.box2,-2.98,1.39,0,'tampa','Tampa traseira'));
  pair(g,()=>Bx(4.4,1.1,1.21),k.tarp,-.8,2.27,.605,'lona','Lona','lado');}
function buildGolf(g,col,mode){
  const k=mats(col),r=.24;
  g.add(P(Bx(2.4,.16,1.12),k.plastic,0,.36,0,'assoalho','Assoalho'));
  pair(g,()=>Bx(.6,.55,.56),k.paint,.9,.7,.28,'carenagem','Carenagem dianteira','f');
  g.add(P(Bx(.1,.16,1.2),k.plastic,1.25,.38,0,'pchoque_d','Para-choque'));
  g.add(P(Bx(.95,.4,1.08),k.paint2,-.2,.64,0,'base_banco','Compartimento da bateria'));
  g.add(P(Bx(.62,.12,1.02),k.seat,-.1,.9,0,'banco','Banco dianteiro'));
  g.add(P(Bx(.12,.5,1.02),k.seat,-.47,1.2,0,'encosto','Encosto dianteiro'));
  let rx=-.6,roofX=.01,roofL=1.35;
  if(mode==='4'){
    g.add(P(Bx(.5,.4,1.08),k.paint2,-.92,.64,0,'base_t','Base do banco traseiro'));
    g.add(P(Bx(.5,.12,1.02),k.seat,-.92,.9,0,'banco_t','Banco traseiro'));
    g.add(P(Bx(.12,.45,1.02),k.seat,-.6,1.17,0,'encosto_t','Encosto traseiro'));
    rx=-1.1;roofX=-.22;roofL=2.05;
  }else if(mode==='util'){
    g.add(P(Bx(.66,.32,1.08),k.plastic,-.88,.6,0,'base_cacamba','Base da caçamba'));
    g.add(P(Bx(.66,.05,1.1),k.paint2,-.88,.79,0,'assoalho_cacamba','Assoalho da caçamba'));
    pair(g,()=>Bx(.66,.3,.04),k.paint,-.88,.96,.53,'lateral_cacamba','Lateral da caçamba','f');
    g.add(P(Bx(.04,.3,1.1),k.paint,-1.2,.96,0,'tampa','Tampa da caçamba'));
    g.add(P(Bx(.04,.3,1.1),k.paint,-.56,.96,0,'frente_cacamba','Frente da caçamba'));
  }else{
    g.add(P(Bx(.55,.04,.9),k.plastic,-.85,.7,0,'bagageiro','Bagageiro traseiro'));
    g.add(P(Bx(.5,.26,.06),k.plastic,-.85,.56,0,'suporte','Suporte do bagageiro'));
  }
  [.62,rx].forEach((x,i)=>pair(g,()=>Cy(.03,.03,1.54,10),k.rim,x,1.21,.52,i?'coluna_t':'coluna_d',i?'Coluna traseira da capota':'Coluna dianteira da capota','f'));
  g.add(P(Bx(roofL,.07,1.24),k.paint,roofX,2.0,0,'capota','Capota'));
  g.add(P(Bx(.03,.85,1.0),k.glass,.64,1.52,0,'parabrisa','Para-brisa'));
  g.add(P(Cy(.025,.025,.5,8),k.plastic,.5,1.05,-.25,'volante','Volante',{rz:.6}));
  const w=P(new THREE.TorusGeometry(.16,.025,8,24),k.plastic,.38,1.28,-.25,'volante','Volante',{ry:Math.PI/2});w.rotation.z=.6;g.add(w);
  wheels(g,k,[[.82,'pneu_d','Pneu dianteiro'],[-.82,'pneu_t','Pneu traseiro']],r,.2,.58,.55);
  pair(g,()=>Bx(.04,.1,.18),k.head,1.21,.86,.36,'farol','Farol','m');
}
function buildMoto(g,col){
  const k=mats(col),r=.31;
  [[.72,'pneu_d','Pneu dianteiro'],[-.68,'pneu_t','Pneu traseiro']].forEach(([x,key,n])=>{
    g.add(P(Cy(r,r,.11,28),k.rubber,x,r,0,key,n,{rx:Math.PI/2}));g.add(P(Cy(r*.62,r*.62,.115,20),k.rim,x,r,0,key,n,{rx:Math.PI/2}));});
  [.07,-.07].forEach(z=>g.add(P(Cy(.022,.022,.72,8),k.rim,.61,.645,z,'garfo','Garfo dianteiro',{rz:.32})));
  g.add(P(Bx(.88,.06,.06),k.plastic,.1,.78,0,'quadro','Quadro',{rz:.41}));
  g.add(P(Bx(.42,.34,.26),k.plastic,.05,.52,0,'motor','Motor'));
  g.add(P(Bx(.48,.24,.3),k.paint,.18,.98,0,'tanque','Tanque de combustível'));
  g.add(P(Bx(.62,.09,.26),k.seat,-.33,.98,0,'banco','Banco'));
  pair(g,()=>Bx(.5,.22,.03),k.paint,-.3,.82,.15,'carenagem','Carenagem lateral','f');
  g.add(P(Cy(.045,.05,.75,12),k.rim,-.4,.42,.18,'escapamento','Escapamento',{rz:Math.PI/2+.1}));
  g.add(P(Bx(.6,.05,.08),k.plastic,-.38,.42,.12,'balanca','Balança traseira',{rz:.15}));
  g.add(P(Cy(.018,.018,.66,8),k.plastic,.47,1.12,0,'guidao','Guidão',{rx:Math.PI/2}));
  g.add(P(Bx(.07,.14,.16),k.head,.58,1.02,0,'farol','Farol'));
  g.add(P(Bx(.05,.08,.14),k.tail,-.67,.98,0,'lanterna','Lanterna traseira'));
  g.add(P(Bx(.42,.035,.15),k.paint,-.6,.7,0,'paralama_t','Para-lama traseiro',{rz:-.25}));
  g.add(P(Bx(.36,.035,.14),k.paint,.74,.66,0,'paralama_d','Para-lama dianteiro',{rz:.15}));
  pair(g,()=>Bx(.04,.06,.1),k.plastic,.44,1.32,.27,'retrovisor','Retrovisor','m');
}
const BUILD={
  hatch:(g,c)=>buildCarLike(g,c,CARP.hatch),carro:(g,c)=>buildCarLike(g,c,CARP.carro),suv:(g,c)=>buildCarLike(g,c,CARP.suv),
  picape:buildPickup,van:buildVan,onibus:buildBus,caminhao:buildTruck,caminhao_lona:buildTruckLona,moto:buildMoto,
  golfe:(g,c)=>buildGolf(g,c,'4'),golfe2:(g,c)=>buildGolf(g,c,'2'),utilitario:(g,c)=>buildGolf(g,c,'util')};
function buildVehicle(base,cor){const inner=new THREE.Group();(BUILD[base]||BUILD.carro)(inner,cor);
  const bb=new THREE.Box3().setFromObject(inner),c=bb.getCenter(new THREE.Vector3()),sz=bb.getSize(new THREE.Vector3());
  inner.position.set(-c.x,-bb.min.y,-c.z);return {inner,sz};}
function disposeTree(o){o.traverse(x=>{if(x.geometry)x.geometry.dispose();if(x.material&&x.material.dispose&&!x.material.__shared)x.material.dispose()})}
function sideName(ud){
  if(!ud.side)return ud.nome;const e=ud.side==='e';
  if(ud.lat==='f')return ud.nome+(e?' esquerda':' direita');
  if(ud.lat==='lado')return ud.nome+(e?' (lado esquerdo)':' (lado direito)');
  return ud.nome+(e?' esquerdo':' direito');
}

/* ---------- miniaturas ---------- */
let thumbR=null,thumbS=null,thumbC=null;const thumbCache={};
function thumb(base,cor){
  const key=base+'|'+cor;if(thumbCache[key]!==undefined)return thumbCache[key];
  if(!HAS3D)return thumbCache[key]='';
  try{
    if(!thumbR){thumbR=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});thumbR.setPixelRatio(1);thumbR.setSize(320,200);thumbR.outputEncoding=THREE.sRGBEncoding;thumbR.setClearColor(0x000000,0);
      thumbS=new THREE.Scene();thumbS.add(new THREE.HemisphereLight(0xf2f6ff,0x5a6470,.95));const d=new THREE.DirectionalLight(0xffffff,.8);d.position.set(5,8,6);thumbS.add(d);thumbC=new THREE.PerspectiveCamera(28,1.6,.1,100)}
    const {inner,sz}=buildVehicle(base,cor);thumbS.add(inner);
    const rad=sz.length()/2,dist=rad/Math.sin(THREE.MathUtils.degToRad(14))*.92;
    const dir=new THREE.Vector3(Math.cos(.62),.42,Math.sin(.62)).normalize();
    thumbC.position.copy(dir.multiplyScalar(dist)).add(new THREE.Vector3(0,sz.y*.42,0));thumbC.lookAt(0,sz.y*.42,0);
    thumbR.render(thumbS,thumbC);const url=thumbR.domElement.toDataURL('image/png');
    thumbS.remove(inner);disposeTree(inner);return thumbCache[key]=url;
  }catch(e){return thumbCache[key]=''}
}

/* ---------- cena principal ---------- */
let renderer,scene,camera,root,markerGroup,shadow,grid,tempMarker;
let parts=[];const modelSize={x:4,y:1.6,z:2};
const VISTAS={perspectiva:[-.72,1.12],frente:[0,1.38],esquerda:[-Math.PI/2,1.32],direita:[Math.PI/2,1.32],traseira:[Math.PI,1.38],topo:[-Math.PI/2,.26]};
const orbit={theta:VISTAS.perspectiva[0],phi:VISTAS.perspectiva[1],r:8,base:8,ty:.7,goal:null};
function setVista(n){const v=VISTAS[n]||VISTAS.perspectiva;if(holo)exitHolo();orbit.goal={theta:v[0],phi:v[1],r:orbit.base};vistaAtual=n;marcarVista()}
let vistaAtual='perspectiva';
function marcarVista(){document.querySelectorAll('#viewBar [data-vista]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.vista===vistaAtual))}
let holo=null,ghostMat,selMat,edgeMat,edgeSel;
const GCOL={leve:0xe0a422,media:0xe8711a,grave:0xd6372e};
const isDark=()=>{const t=document.documentElement.getAttribute('data-theme');if(t)return t==='dark';return !!(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)};
function applyStageTheme(){
  if(!renderer)return;const dark=isDark();
  const bg=new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--stage-bg').trim()||(dark?'#1b232c':'#e7ebf0'));
  scene.background=null;scene.fog.color=bg;
  if(grid){scene.remove(grid);grid.geometry.dispose()}
  grid=new THREE.GridHelper(18,36,dark?0x34414f:0xcdd5df,dark?0x222c37:0xe0e6ed);grid.material.transparent=true;grid.material.opacity=holo?.35:.9;scene.add(grid);
  ghostMat.color.set(dark?0x5c6b7a:0xa9b4bf);ghostMat.opacity=dark?.18:.28;
  edgeMat.color.set(dark?0x9fb0c0:0x6b7785);edgeSel.color.set(dark?0xffffff:0x17212e);
  shadow.material.opacity=dark?.85:.38;
}
function init3D(){
  const cv=$('#cv');
  try{renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});renderer.setClearColor(0x000000,0)}catch(e){renderer=null}
  if(!renderer)return false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputEncoding=THREE.sRGBEncoding;
  scene=new THREE.Scene();scene.fog=new THREE.Fog(0xe7ebf0,18,46);
  camera=new THREE.PerspectiveCamera(34,1,.1,100);
  scene.add(new THREE.HemisphereLight(0xf2f6ff,0x5a6470,.9));
  const d=new THREE.DirectionalLight(0xffffff,.85);d.position.set(5,8,4);scene.add(d);
  const d2=new THREE.DirectionalLight(0xdfe8f2,.35);d2.position.set(-6,3,-5);scene.add(d2);
  const sc=document.createElement('canvas');sc.width=sc.height=128;const sx=sc.getContext('2d');const gr=sx.createRadialGradient(64,64,4,64,64,64);gr.addColorStop(0,'rgba(20,30,40,.7)');gr.addColorStop(1,'rgba(20,30,40,0)');sx.fillStyle=gr;sx.fillRect(0,0,128,128);
  shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.006;scene.add(shadow);
  root=new THREE.Group();scene.add(root);
  ghostMat=new THREE.MeshBasicMaterial({color:0xa9b4bf,transparent:true,opacity:.28,depthWrite:false});
  selMat=new THREE.MeshStandardMaterial({color:0xe8711a,emissive:0xe8711a,emissiveIntensity:.25,metalness:.2,roughness:.5});
  edgeMat=new THREE.LineBasicMaterial({color:0x6b7785,transparent:true,opacity:.45});
  edgeSel=new THREE.LineBasicMaterial({color:0x17212e});
  [ghostMat,selMat,edgeMat,edgeSel].forEach(m=>{m.__shared=true});
  applyStageTheme();
  if(window.matchMedia)try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyStageTheme)}catch(e){}
  try{new MutationObserver(applyStageTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})}catch(e){}
  const stage=$('#stage');
  const fit=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};
  if(window.ResizeObserver)new ResizeObserver(fit).observe(stage);else window.addEventListener('resize',fit);fit();
  bindPointer(cv);requestAnimationFrame(loop);return true;
}
function setVehicle(v){
  if(!renderer)return;
  exitHolo(true);clearTemp();disposeTree(root);root.clear();parts=[];markerGroup=null;
  if(!v)return;
  const {inner,sz}=buildVehicle(vBase(v),vCor(v));root.add(inner);
  modelSize.x=sz.x;modelSize.y=sz.y;modelSize.z=sz.z;
  inner.traverse(o=>{if(o.isMesh&&o.userData.key){parts.push(o);o.userData.orig=o.material;const e=new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry,25),edgeMat);e.visible=false;e.raycast=function(){};o.add(e);o.userData.edge=e}});
  markerGroup=new THREE.Group();root.add(markerGroup);
  shadow.scale.set(sz.x*1.5,sz.z*2.4,1);
  orbit.base=Math.max(sz.x,sz.z)*1.5+1.8;orbit.r=orbit.base;orbit.ty=sz.y*.42;orbit.theta=VISTAS.perspectiva[0];orbit.phi=VISTAS.perspectiva[1];orbit.goal=null;vistaAtual='perspectiva';marcarVista();
  root.updateMatrixWorld(true);refreshMarkers();
}
function partMeshes(key,lado){return parts.filter(m=>m.userData.key===key&&(m.userData.side||null)===(lado||null))}
function surfacePoint(key,lado){
  let ms=partMeshes(key,lado);if(!ms.length)ms=parts.filter(m=>m.userData.key===key);
  if(!ms.length)return new THREE.Vector3(0,modelSize.y*.6,0);
  const bb=new THREE.Box3();ms.forEach(m=>bb.expandByObject(m));const c=bb.getCenter(new THREE.Vector3());
  let dir=new THREE.Vector3(c.x,0,c.z);
  if(dir.length()<.15||(Math.abs(c.z)<.15&&Math.abs(c.x)<modelSize.x*.2))dir.set(0,1,0);
  dir.normalize();const rc=new THREE.Raycaster(c.clone().addScaledVector(dir,30),dir.clone().negate());
  const hit=rc.intersectObjects(ms,false)[0];return root.worldToLocal((hit?hit.point:c).clone());
}
function markerMesh(color,s,id){
  const g=new THREE.Group();g.userData.av=id;
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.075*s,16,12),new THREE.MeshBasicMaterial({color,depthTest:false,transparent:true}));dot.renderOrder=10;
  const ring=new THREE.Mesh(new THREE.RingGeometry(.12*s,.155*s,32),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.95,side:THREE.DoubleSide,depthTest:false}));ring.renderOrder=9;ring.userData.ring=true;
  const hitS=new THREE.Mesh(new THREE.SphereGeometry(.24*s,8,6),new THREE.MeshBasicMaterial({visible:false}));
  [dot,ring,hitS].forEach(o=>{o.userData.av=id});g.add(dot,ring,hitS);return g;
}
const mScale=()=>Math.max(.5,Math.max(modelSize.x,modelSize.z)/4.4);
function refreshMarkers(){
  if(!markerGroup)return;markerGroup.clear();const v=curVeh();if(!v)return;const vs=vist(v.id);if(!vs)return;
  vs.avarias.forEach(av=>{if(!av.pos){const p=surfacePoint(av.key,av.lado);av.pos=[+p.x.toFixed(4),+p.y.toFixed(4),+p.z.toFixed(4)];
      if(vs.status==='aberta')api('avaria_pos',{id:av.id,pos:av.pos}).catch(()=>{})}
    const g=markerMesh(GCOL[av.grav]||0xe8711a,mScale(),av.id);g.position.fromArray(av.pos);markerGroup.add(g)});
}
function clearTemp(){if(tempMarker&&tempMarker.parent)tempMarker.parent.remove(tempMarker);tempMarker=null}
function bindPointer(cv){
  const ptrs=new Map();let down=null,moved=false,pinch=0;
  const dist=()=>{const a=[...ptrs.values()];return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)};
  cv.addEventListener('pointerdown',e=>{try{cv.setPointerCapture(e.pointerId)}catch(_){}ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size===1){down={x:e.clientX,y:e.clientY};moved=false}else if(ptrs.size===2){pinch=dist();moved=true}orbit.goal=null});
  cv.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;const pr=ptrs.get(e.pointerId);const dx=e.clientX-pr.x,dy=e.clientY-pr.y;ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size===1){if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)moved=true;if(moved){if(vistaAtual){vistaAtual='';marcarVista()}orbit.theta+=dx*.009;orbit.phi=Math.min(1.5,Math.max(.25,orbit.phi-dy*.007))}}
    else if(ptrs.size===2){const d=dist();if(pinch)orbit.r=Math.min(orbit.base*1.8,Math.max(orbit.base*.4,orbit.r*pinch/d));pinch=d}});
  const up=e=>{if(!ptrs.has(e.pointerId))return;ptrs.delete(e.pointerId);if(ptrs.size===0&&!moved&&e.type==='pointerup')tap(e);if(ptrs.size<2)pinch=0};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{e.preventDefault();orbit.goal=null;orbit.r=Math.min(orbit.base*1.8,Math.max(orbit.base*.4,orbit.r*(1+e.deltaY*.001)))},{passive:false});
}
const ray=HAS3D?new THREE.Raycaster():null;
function tap(e){
  if(!parts.length)return;const rect=$('#cv').getBoundingClientRect();const vsT=curVeh()&&vist(curVeh().id);
  ray.setFromCamera({x:((e.clientX-rect.left)/rect.width)*2-1,y:-((e.clientY-rect.top)/rect.height)*2+1},camera);
  const mk=markerGroup?ray.intersectObjects(markerGroup.children.filter(g=>g.visible),true)[0]:null;
  if(mk){enterHolo(mk.object.userData.av);return}
  if(holo){exitHolo();return}
  if(!vsT){toast('Aguarde a vistoria carregar.');return}
  const hit=ray.intersectObjects(parts,false)[0];if(!hit)return;
  const ud=hit.object.userData;const p=root.worldToLocal(hit.point.clone());
  clearTemp();tempMarker=markerMesh(0x1c4f8c,mScale(),'tmp');tempMarker.position.copy(p);root.add(tempMarker);
  openDamage({key:ud.key,lado:ud.side||null,parte:sideName(ud),pos:[p.x,p.y,p.z]});
}
const angDiff=(a,b)=>{let d=(a-b)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d};
const RM=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const tmpV=HAS3D?new THREE.Vector3():null;
function loop(ms){
  requestAnimationFrame(loop);if(!renderer)return;const t=ms*.001;
  if(orbit.goal){const k=RM?1:.09;orbit.theta+=angDiff(orbit.goal.theta,orbit.theta)*k;orbit.phi+=(orbit.goal.phi-orbit.phi)*k;orbit.r+=(orbit.goal.r-orbit.r)*k;
    if(Math.abs(angDiff(orbit.goal.theta,orbit.theta))<.002&&Math.abs(orbit.goal.r-orbit.r)<.01)orbit.goal=null}
  const s=Math.sin(orbit.phi);camera.position.set(orbit.r*s*Math.cos(orbit.theta),orbit.ty+orbit.r*Math.cos(orbit.phi),orbit.r*s*Math.sin(orbit.theta));camera.lookAt(0,orbit.ty,0);
  const each=g=>g.children.forEach(o=>{if(o.userData.ring)o.lookAt(camera.position)});
  if(markerGroup)markerGroup.children.forEach(each);if(tempMarker)each(tempMarker);
  if(holo&&!RM)selMat.emissiveIntensity=.18+.12*Math.sin(t*3);
  renderer.render(scene,camera);if(holo)placeLink();
}
function placeLink(){
  const v=curVeh();if(!v)return;const av=vist(v.id).avarias.find(a=>a.id===holo.id);if(!av||!av.pos)return;
  tmpV.fromArray(av.pos);root.localToWorld(tmpV);tmpV.project(camera);
  const st=$('#stage').getBoundingClientRect(),cr=$('#holoCard').getBoundingClientRect();
  const x=(tmpV.x*.5+.5)*st.width,y=(-tmpV.y*.5+.5)*st.height;
  const l=$('#hlLine');l.setAttribute('x1',x);l.setAttribute('y1',y);l.setAttribute('x2',cr.left-st.left);l.setAttribute('y2',cr.top-st.top+40);
  const d=$('#hlDot');d.setAttribute('cx',x);d.setAttribute('cy',y);
}
function enterHolo(id){
  const v=curVeh();if(!v)return;const av=vist(v.id).avarias.find(a=>a.id===id);if(!av)return;
  if(ui.view!=='vistoria')go('vistoria');
  holo={id};clearTemp();
  if(renderer){
    const sel=new Set(partMeshes(av.key,av.lado));const col=GCOL[av.grav]||0xe8711a;selMat.color.set(col);selMat.emissive.set(col);
    parts.forEach(m=>{const s=sel.has(m);m.material=s?selMat:ghostMat;m.userData.edge.visible=true;m.userData.edge.material=s?edgeSel:edgeMat});
    if(markerGroup)markerGroup.children.forEach(g=>{g.visible=g.userData.av===id});
    grid.material.opacity=.35;
    if(av.pos){const p=new THREE.Vector3().fromArray(av.pos);orbit.goal={theta:Math.atan2(p.z,p.x)-.25,phi:p.y>modelSize.y*.8?.75:1.1,r:orbit.base*.82}}
    $('#holoLink').hidden=false;
  }
  fillHolo(av);$('#holoCard').hidden=false;$('#hint').hidden=true;
  if(ui.ptab==='avarias')renderPBody();
  const st=$('#stage').getBoundingClientRect();if(st.top<0||st.bottom>innerHeight)$('#stage').scrollIntoView({block:'center',behavior:RM?'auto':'smooth'});
}
function fillHolo(av){
  const list=vist(curVeh().id).avarias,i=list.indexOf(av);
  $('#hcTag').textContent=`Avaria ${i+1} de ${list.length}`;
  $('#hcParte').textContent=av.parte;$('#hcMeta').innerHTML=`<span class="pill ${av.grav}">${GRAV[av.grav]}</span>${esc(av.tipo)} · ${fmtData(av.data)}`;
  $('#hcObs').textContent=av.obs||'';const src=photoSrc(av);
  $('#hcImg').hidden=!src;$('#hcNo').hidden=!!src;if(src)$('#hcImg').src=src;$('#hcZoom').disabled=!src;
}
function exitHolo(silent){
  if(!holo)return;holo=null;
  if(renderer){parts.forEach(m=>{m.material=m.userData.orig;m.userData.edge.visible=false});
    if(markerGroup)markerGroup.children.forEach(g=>{g.visible=true});grid.material.opacity=.9;
    orbit.goal={theta:orbit.theta,phi:orbit.phi,r:orbit.base}}
  $('#holoCard').hidden=true;$('#holoLink').hidden=true;$('#hint').hidden=false;
  if(!silent&&ui.ptab==='avarias')renderPBody();
}

/* ---------- UI ---------- */
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>{t.hidden=true},3600)}
const VIEWS=ADMIN?['vistoria','modelos','frotas','usuarios']:['vistoria'];
const TITULOS={vistoria:'Vistoria',modelos:'Modelos de checklist',frotas:'Frotas e veículos',usuarios:'Usuários'};
function go(view){if(location.hash!=='#'+view)location.hash=view;else showView()}
function setNav(open){$('#app').classList.toggle('nav-open',open);$('#sbScrim').hidden=!open;$('#btnMenu').setAttribute('aria-expanded',open)}
$('#btnMenu').addEventListener('click',()=>setNav(!$('#app').classList.contains('nav-open')));
$('#sbScrim').addEventListener('click',()=>setNav(false));
function renderCrumbs(){
  const f=frota(ui.frotaId),v=curVeh();
  const parts=ui.view==='vistoria'?[f?f.nome:'',v?v.placa+' · '+v.desc:''].filter(Boolean):['Cadastros'];
  $('#crumbs').innerHTML=parts.map(p=>`<span>${esc(p)}</span>`).join('');
}
function showView(){
  const h=(location.hash||'').slice(1);ui.view=VIEWS.includes(h)?h:'vistoria';
  ['vistoria','modelos','frotas','usuarios'].forEach(v=>{$('#v-'+v).hidden=v!==ui.view});
  document.querySelectorAll('[data-go]').forEach(b=>{if(b.dataset.go===ui.view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  $('#pageTitle').textContent=TITULOS[ui.view];document.title=TITULOS[ui.view]+' · ReviverFrota';
  setNav(false);closeSheet();
  if(ui.view!=='vistoria')exitHolo(true);
  if(ui.view==='modelos')renderModelos();if(ui.view==='frotas')renderFrotas();if(ui.view==='vistoria')renderVistoria();if(ui.view==='usuarios')renderUsuarios();
  renderCrumbs();saveUi();
}
window.addEventListener('hashchange',showView);
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));

function renderFrotaSel(){$('#frotaSel').innerHTML=state.frotas.map(f=>`<option value="${f.id}" ${f.id===ui.frotaId?'selected':''}>${esc(f.nome)}</option>`).join('')}
$('#frotaSel').addEventListener('change',e=>{ui.frotaId=e.target.value;pendingDel=null;busca='';$('#vehSearch').value='';const v=state.veiculos.find(x=>x.frotaId===ui.frotaId);selectVeh(v?v.id:null);if(ui.view==='frotas')renderFrotas();renderCrumbs()});

const carregando={};
function selectVeh(id){
  ui.veiculoId=id;pendingDel=null;saveUi();setVehicle(curVeh());renderVistoria();renderCrumbs();
  if(id&&!vistCache[id]&&!carregando[id]){carregando[id]=1;
    carregarVist(id).then(()=>{if(ui.veiculoId===id){refreshMarkers();renderVistoria()}}).catch(falha).finally(()=>{delete carregando[id]})}
}
const thumbImg=(v,cls)=>{const u=thumb(vBase(v),vCor(v));return u?`<img class="${cls||''}" src="${u}" alt="">`:`<span class="vthumb ${cls||''}"></span>`};
let busca='';
const semAcento=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function renderVistoria(){
  const vs=state.veiculos.filter(v=>v.frotaId===ui.frotaId);
  if(!vs.find(v=>v.id===ui.veiculoId)&&vs.length){selectVeh(vs[0].id);return}
  if(!vs.length&&ui.veiculoId){ui.veiculoId=null;setVehicle(null)}
  const q=semAcento(busca.trim());
  const lista=q?vs.filter(v=>semAcento(v.placa+' '+v.desc+' '+(BASES[vBase(v)]||'')).includes(q)):vs;
  $('#vehRow').innerHTML=!vs.length
    ?`<div class="empty" style="flex:1">Esta frota ainda não tem veículos.${ADMIN?' <button class="btn sm" data-go2="frotas">Cadastrar veículo</button>':' Peça ao administrador para cadastrar.'}</div>`
    :!lista.length?`<div class="empty" style="flex:1">Nenhum veículo encontrado para “${esc(busca)}”.</div>`
    :lista.map(v=>{const c=vistCache[v.id];const n=c?c.avarias.length:0;
      return `<button class="vchip" data-veh="${v.id}" aria-pressed="${v.id===ui.veiculoId}">${thumbImg(v)}<span class="vc-t"><span class="plate">${esc(v.placa)}</span><b>${esc(v.desc)}${n?`<span class="dotn" title="${n} avaria(s)">${n}</span>`:''}</b></span></button>`}).join('');
  const v=curVeh(),vst=v&&vist(v.id);
  $('#hudTipo').textContent=v?`Lataria · ${BASES[vBase(v)]}`:'Lataria';
  $('#btnConcluir').disabled=!vst;$('#btnVisual').hidden=!ADMIN||!v;
  const bf=$('#btnFicha');if(vst){bf.href='relatorio.php?id='+encodeURIComponent(vst.id);bf.removeAttribute('aria-disabled')}else{bf.href='#';bf.setAttribute('aria-disabled','true')}
  renderProg();renderTabs();renderPBody();
}
$('#vehRow').addEventListener('click',e=>{const b=e.target.closest('[data-veh]');if(b){selectVeh(b.dataset.veh);return}if(e.target.closest('[data-go2]'))go('frotas')});
$('#vehSearch').addEventListener('input',e=>{busca=e.target.value;renderVistoria()});
$('#vehSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const b=$('#vehRow [data-veh]');if(b)selectVeh(b.dataset.veh)}});
function stats(v){const vs=vist(v.id);const cl=checklistFor(v);let tot=0,done=0,nok=0;cl.forEach(s=>s.itens.forEach(i=>{tot++;if(vs&&answered(vs,i))done++;if(vs&&vs.resp[i.id]==='n')nok++}));return{tot,done,nok,av:vs?vs.avarias.length:0,cl,vs}}
function renderProg(){
  const v=curVeh();if(!v){$('#prog').innerHTML='<div class="empty">Escolha um veículo para começar a vistoria.</div>';return}
  const s=stats(v),f=frota(v.frotaId),m=modelo(v.modeloId);const pct=s.tot?Math.round(s.done/s.tot*100):0;
  const tu=thumb(vBase(v),vCor(v));
  $('#prog').innerHTML=`<div class="sum-head">${tu?`<img class="sum-thumb" src="${tu}" alt="">`:'<span class="sum-thumb"></span>'}
    <div class="sum-id"><span class="plate">${esc(v.placa)}</span><h2>${esc(v.desc)}</h2><small>Checklist ${esc(m?m.nome:'')} · ${esc(f?f.nome:'')}</small></div>
    <span class="status ${s.vs&&pct===100?'done':''}">${!s.vs?'Carregando':pct===100?'Pronta para concluir':s.done?'Em andamento':'Não iniciada'}</span></div>
  <div class="sum-stats"><div class="ring ${pct===100?'full':''}" style="--p:${pct}" role="img" aria-label="${pct}% do checklist conferido"><b>${pct}%</b></div>
    <dl class="kpis"><div><dt>Itens conferidos</dt><dd>${s.done}<span class="muted" style="font-size:14px;font-weight:500">/${s.tot}</span></dd></div><div class="${s.nok?'bad':'zero'}"><dt>Marcados Não</dt><dd>${s.nok}</dd></div><div class="${s.av?'warn':'zero'}"><dt>Avarias</dt><dd>${s.av}</dd></div></dl></div>`;
}
function renderTabs(){const v=curVeh(),vs=v&&vist(v.id),n=vs?vs.avarias.length:0;document.querySelectorAll('#ptabs button').forEach(b=>{b.setAttribute('aria-selected',b.dataset.pt===ui.ptab);if(b.dataset.pt==='avarias')b.textContent=n?`Avarias (${n})`:'Avarias'})}
$('#ptabs').addEventListener('click',e=>{const b=e.target.closest('[data-pt]');if(!b)return;ui.ptab=b.dataset.pt;saveUi();renderTabs();renderPBody()});

function fuelSvg(val){
  const cx=90,cy=84,R=68;const ticks=FUEL.map((l,i)=>{const a=Math.PI-(i/4)*Math.PI;const x1=cx+Math.cos(a)*(R-13),y1=cy-Math.sin(a)*(R-13),x2=cx+Math.cos(a)*R,y2=cy-Math.sin(a)*R;
    return `<g class="tick" data-fuel="${i}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${val===i?'var(--accent)':'var(--muted)'}" stroke-width="${val===i?6:4}" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="14" fill="transparent"/></g>`}).join('');
  let needle='';if(val!=null){const a=Math.PI-(val/4)*Math.PI;needle=`<line x1="${cx}" y1="${cy}" x2="${cx+Math.cos(a)*(R-22)}" y2="${cy-Math.sin(a)*(R-22)}" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5" fill="var(--ink)"/>`}
  return `<svg viewBox="0 0 180 100" role="img" aria-label="Nível de combustível: ${val==null?'não informado':FUEL[val]}"><path d="M${cx-R} ${cy} A${R} ${R} 0 0 1 ${cx+R} ${cy}" fill="none" stroke="var(--line-2)" stroke-width="2"/>${ticks}${needle}<text x="${cx-R}" y="98" fill="var(--muted)" font-size="12" text-anchor="middle">E</text><text x="${cx+R}" y="98" fill="var(--muted)" font-size="12" text-anchor="middle">F</text></svg>`;
}
const secFechadas=new Set();
let filtro='todos';
function itemCtl(i,val,rot){
  if(i.tipo==='num')return `<label class="num-in"><input type="number" inputmode="decimal" data-num="${i.id}" value="${esc(val||'')}" aria-label="${esc(i.texto)}"><span>${esc(i.un||'')}</span></label>`;
  if(i.tipo==='texto')return `<label class="txt-in"><input type="text" data-num="${i.id}" value="${esc(val||'')}" aria-label="${esc(i.texto)}" placeholder="Anotar"></label>`;
  return `<div class="tri" role="group" aria-label="${esc(i.texto)}"><button data-ans="s" aria-pressed="${val==='s'}">${rot[0]}</button><button data-ans="n" aria-pressed="${val==='n'}">${rot[1]}</button><button data-ans="na" aria-pressed="${val==='na'}">N/A</button></div>`;
}
function renderPBody(){
  const el=$('#pBody'),v=curVeh();if(!v){el.innerHTML='';return}
  const vs=vist(v.id),m=modelo(v.modeloId);
  if(!vs){el.innerHTML='<div class="loading">Carregando a vistoria…</div>';return}
  if(ui.ptab==='ficha'){const fi=vs.ficha;
    el.innerHTML=`<div class="form-grid">
      <label class="fld"><span>Data</span><input type="date" id="fiData" data-fi="data" value="${esc(fi.data)}"></label>
      <div class="fld"><span>Placa</span><div class="readonly mono">${esc(v.placa)}</div></div>
      <label class="fld"><span>Setor</span><input type="text" data-fi="setor" value="${esc(fi.setor)}" id="fiSetor"></label>
      <label class="fld"><span>KM</span><input type="number" inputmode="numeric" min="0" step="1" data-fi="km" value="${esc(fi.km)}" id="fiKm"></label>
      <label class="fld"><span>Motorista</span><input type="text" data-fi="motorista" value="${esc(fi.motorista)}" id="fiMot" placeholder="Nome completo"></label>
      <label class="fld"><span>Matrícula</span><input type="text" data-fi="matricula" value="${esc(fi.matricula)}" id="fiMat"></label>
      <div class="fld full"><span>Tipo de veículo</span><div class="readonly">${esc(BASES[vBase(v)])} · ${esc(v.desc)}</div></div>
      <div class="fld full"><span>Combustível</span><div class="fuel">${fuelSvg(fi.comb)}<div class="fuel-btns">${FUEL.map((l,i)=>`<button data-fuel="${i}" aria-pressed="${fi.comb===i}">${l}</button>`).join('')}</div></div></div>
      <label class="fld full"><span>Observações</span><textarea rows="3" data-fi="obs" id="fiObs" placeholder="Anotações gerais da vistoria">${esc(fi.obs)}</textarea></label>
    </div>`;return}
  if(ui.ptab==='itens'){const cl=checklistFor(v),rot=(m&&m.rot)||['Sim','Não'];
    const todos=cl.flatMap(s=>s.itens),pend=todos.filter(i=>!answered(vs,i)).length,prob=todos.filter(i=>vs.resp[i.id]==='n').length;
    const passa=i=>filtro==='pendentes'?!answered(vs,i):filtro==='problemas'?vs.resp[i.id]==='n':true;
    const secs=cl.map(s=>{const d=s.itens.filter(i=>answered(vs,i)).length,itens=s.itens.filter(passa);if(!itens.length)return '';
      const pct=Math.round(d/s.itens.length*100),ok=d===s.itens.length;
      const pendSn=s.itens.filter(i=>i.tipo==='sn'&&!answered(vs,i)).length;
      return `<details class="sec" data-sec="${esc(s.nome)}" ${secFechadas.has(s.nome)&&filtro==='todos'?'':'open'}>
        <summary><span class="sec-title">${esc(s.nome)}</span><span class="sec-count ${ok?'done':''}">${d}/${s.itens.length}</span><span class="sec-bar"><i class="${ok?'done':''}" style="width:${pct}%"></i></span></summary>
        <div class="sec-body">${pendSn&&filtro!=='problemas'?`<div class="sec-tools"><button class="btn ghost sm" data-tudo-ok="${esc(s.nome)}">Marcar ${pendSn} pendente${pendSn>1?'s':''} como ${esc(rot[0])}</button></div>`:''}
        ${itens.map(i=>{const val=vs.resp[i.id];const showObs=val==='n';
          return `<div class="item ${val==='n'?'nok':''}" data-item="${i.id}"><div class="it-t">${esc(i.texto)}${i.origem==='frota'?'<span class="tag">frota</span>':''}${i.obs&&!showObs?'<small>Se marcar Não, descreva na observação</small>':''}</div>${itemCtl(i,val,rot)}${showObs?`<div class="it-obs"><input type="text" data-robs="${i.id}" value="${esc(vs.robs[i.id]||'')}" placeholder="O que está com problema?" aria-label="Observação: ${esc(i.texto)}"></div>`:''}</div>`}).join('')}</div></details>`}).join('');
    el.innerHTML=`<div class="filters" role="group" aria-label="Filtrar itens">
        <button data-filtro="todos" aria-pressed="${filtro==='todos'}">Todos<span>${todos.length}</span></button>
        <button data-filtro="pendentes" aria-pressed="${filtro==='pendentes'}">Pendentes<span>${pend}</span></button>
        <button data-filtro="problemas" aria-pressed="${filtro==='problemas'}">Com problema<span>${prob}</span></button></div>
      <div class="secs">${secs||`<div class="empty">${filtro==='pendentes'?'Todos os itens já foram conferidos.':'Nenhum item marcado como Não.'}</div>`}</div>`;return}
  if(ui.ptab==='avarias'){const list=vs.avarias;
    el.innerHTML=list.length?`<div class="av-head"><span><b>${list.length} avaria${list.length>1?'s':''}</b> <span class="muted">registrada${list.length>1?'s':''} nesta vistoria</span></span></div><div class="av-list">${list.map((a,i)=>{const src=photoSrc(a);
      return `<div class="av" aria-current="${!!(holo&&holo.id===a.id)}"><button class="av-th" data-holo="${a.id}" style="${src?`background-image:url('${src}')`:''}" aria-label="Destacar avaria ${i+1} no modelo">${src?'':'sem foto'}</button>
      <button class="av-txt" data-holo="${a.id}"><b>${esc(a.parte)}</b><span class="pill ${a.grav}">${GRAV[a.grav]} · ${esc(a.tipo)}</span>${a.obs?`<small>${esc(a.obs)}</small>`:''}</button>
      <button class="icon-btn" data-del="${a.id}" aria-label="Excluir avaria">${pendingDel==='a'+a.id?'<span style="font-size:11px;color:var(--bad);font-weight:600">Excluir?</span>':'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'}</button></div>`}).join('')}</div>
      <p class="note">Toque numa avaria para destacar a peça no modelo. Para registrar uma nova, toque na peça no modelo 3D.</p>`
      :`<div class="empty"><b style="display:block;color:var(--ink);margin-bottom:4px">Nenhuma avaria registrada</b>Toque numa peça do modelo 3D para marcar onde está o dano e anexar a foto.</div>`;return}
  if(ui.ptab==='marcha'){const gl=vs.guia||[];
    el.innerHTML=`<div class="gm">${gl.length?`<div class="gm-wrap"><table class="gm-tbl"><thead><tr><th>Data</th><th>Motorista</th><th>Saída</th><th>KM inicial</th><th>Destino</th><th>Chegada</th><th>KM final</th></tr></thead><tbody>
        ${gl.map(g=>`<tr><td>${fmtDia(g.data)}</td><td>${esc(g.motorista)}</td><td>${esc(g.hora)}</td><td>${esc(g.kmIni)}</td><td class="dest">${esc(g.destino)}</td><td>${esc(g.horaF||'—')}</td><td>${esc(g.kmFim||'—')}</td></tr>`).join('')}</tbody></table></div>`
        :'<div class="empty">Nenhuma saída lançada na guia de marcha deste veículo.</div>'}
      <div><button class="btn" data-act="add-guia"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Lançar saída</button></div></div>`;}
}
let pendingDel=null;
function responder(vs,ref,payload){api('responder',Object.assign({vistoria_id:vs.id,ref},payload)).catch(falha)}
$('#pBody').addEventListener('click',e=>{
  const v=curVeh();if(!v)return;const vs=vist(v.id);if(!vs)return;
  const fl=e.target.closest('[data-filtro]');if(fl){filtro=fl.dataset.filtro;renderPBody();return}
  const tk=e.target.closest('[data-tudo-ok]');if(tk){const sec=checklistFor(v).find(s=>s.nome===tk.dataset.tudoOk);if(!sec)return;
    const alvo=sec.itens.filter(i=>i.tipo==='sn'&&!answered(vs,i));alvo.forEach(i=>{vs.resp[i.id]='s'});
    Promise.all(alvo.map(i=>api('responder',{vistoria_id:vs.id,ref:i.id,valor:'s'}))).catch(falha);
    renderPBody();renderProg();toast(`${alvo.length} ${alvo.length>1?'itens marcados':'item marcado'} em ${sec.nome}.`);return}
  const fb=e.target.closest('[data-fuel]');if(fb){const n=+fb.dataset.fuel;vs.ficha.comb=vs.ficha.comb===n?null:n;renderPBody();api('ficha',{vistoria_id:vs.id,campo:'comb',valor:vs.ficha.comb}).catch(falha);return}
  const ab=e.target.closest('[data-ans]');if(ab){const id=ab.closest('[data-item]').dataset.item;
    if(vs.resp[id]===ab.dataset.ans)delete vs.resp[id];else vs.resp[id]=ab.dataset.ans;
    responder(vs,id,{valor:vs.resp[id]===undefined?null:vs.resp[id]});renderPBody();renderProg();
    if(vs.resp[id]==='n'){const inp=document.querySelector(`[data-robs="${id}"]`);if(inp)inp.focus()}return}
  const hb=e.target.closest('[data-holo]');if(hb){enterHolo(hb.dataset.holo);return}
  const db=e.target.closest('[data-del]');if(db){const id=db.dataset.del;
    if(pendingDel==='a'+id){pendingDel=null;api('avaria_excluir',{id}).then(()=>{vs.avarias=vs.avarias.filter(a=>a.id!==id);if(holo&&holo.id===id)exitHolo(true);refreshMarkers();renderVistoria();toast('Avaria excluída.')}).catch(falha)}
    else{pendingDel='a'+id;renderPBody()}return}
  if(e.target.closest('[data-act="add-guia"]'))openGuia();
});
$('#pBody').addEventListener('input',e=>{const v=curVeh();if(!v)return;const vs=vist(v.id);if(!vs)return;const t=e.target;
  if(t.dataset.fi){const c=t.dataset.fi;vs.ficha[c]=t.value;debounce('fi'+c,()=>api('ficha',{vistoria_id:vs.id,campo:c,valor:t.value}).catch(falha))}
  else if(t.dataset.num){const id=t.dataset.num;if(t.value==='')delete vs.resp[id];else vs.resp[id]=t.value;renderProg();debounce('r'+id,()=>responder(vs,id,{valor:t.value===''?null:t.value}))}
  else if(t.dataset.robs){const id=t.dataset.robs;vs.robs[id]=t.value;debounce('o'+id,()=>responder(vs,id,{obs:t.value}))}});

/* sheets */
let sheetClose=null;
function openSheet(html,onClose){$('#sheet').innerHTML=html;$('#sheetBg').hidden=false;sheetClose=onClose||null;const f=$('#sheet').querySelector('input:not([type=file]),button');if(f)setTimeout(()=>f.focus({preventScroll:true}),50)}
function closeSheet(){if($('#sheetBg').hidden)return;$('#sheetBg').hidden=true;$('#sheet').innerHTML='';const c=sheetClose;sheetClose=null;if(c)c()}
$('#sheetBg').addEventListener('click',e=>{if(e.target.id==='sheetBg'||e.target.closest('[data-close]'))closeSheet()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#sheetBg').hidden)closeSheet();else if(holo)exitHolo()}});
const xBtn='<button class="icon-btn" data-close aria-label="Fechar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
function ocupado(btn,txt){btn.disabled=true;btn.dataset.txt=btn.textContent;btn.textContent=txt||'Salvando…'}
function livre(btn){btn.disabled=false;if(btn.dataset.txt)btn.textContent=btn.dataset.txt}

function openDamage(hit){
  const d={tipo:'Risco',grav:'leve',foto:null};
  openSheet(`<div class="sh-head"><div><span class="eyebrow">Registrar avaria</span><h3>${esc(hit.parte)}</h3></div>${xBtn}</div>
    <div class="fld"><span>Tipo de avaria</span><div class="chips" id="dTipo">${DANOS.map(t=>`<button data-v="${t}" aria-pressed="${t===d.tipo}">${t}</button>`).join('')}</div></div>
    <div class="fld"><span>Gravidade</span><div class="chips grav" id="dGrav">${Object.entries(GRAV).map(([k,l])=>`<button data-v="${k}" aria-pressed="${k===d.grav}">${l}</button>`).join('')}</div></div>
    <label class="fld"><span>Observação</span><textarea id="dObs" rows="3" placeholder="Ex.: risco de 10 cm perto da maçaneta"></textarea></label>
    <div class="fld"><span>Foto</span><div class="photo-row"><label class="btn" for="dCam">Tirar foto</label><input type="file" id="dCam" accept="image/*" capture="environment" class="sr"><label class="btn ghost" for="dFile">Anexar da galeria</label><input type="file" id="dFile" accept="image/*" class="sr"></div><div class="photo-prev" id="dPrev"></div></div>
    <div class="sh-actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="dSave">Salvar avaria</button></div>`,clearTemp);
  const pick=(id,key)=>$(id).addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;d[key]=b.dataset.v;$(id).querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b))});
  pick('#dTipo','tipo');pick('#dGrav','grav');
  const onFile=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{d.foto=await readPhoto(f);$('#dPrev').innerHTML=`<img src="${d.foto.url}" alt="Prévia da foto">`}catch(err){falha(err)}};
  $('#dCam').addEventListener('change',onFile);$('#dFile').addEventListener('change',onFile);
  $('#dSave').addEventListener('click',async ev=>{const btn=ev.currentTarget;const v=curVeh();const vs=vist(v.id);
    const fd=new FormData();fd.append('vistoria_id',vs.id);fd.append('key',hit.key);fd.append('lado',hit.lado||'');fd.append('parte',hit.parte);fd.append('tipo',d.tipo);fd.append('grav',d.grav);
    fd.append('obs',$('#dObs').value.trim());fd.append('pos',JSON.stringify(hit.pos.map(n=>+n.toFixed(4))));if(d.foto)fd.append('foto',d.foto.blob,'avaria.jpg');
    ocupado(btn);try{const r=await api('avaria_criar',fd);vs.avarias.push(r.avaria);closeSheet();refreshMarkers();ui.ptab='avarias';saveUi();renderVistoria();toast('Avaria salva. Toque no marcador para ver o detalhe.')}
    catch(err){livre(btn);falha(err)}});
}
$('#hcClose').addEventListener('click',()=>exitHolo());
$('#hcZoom').addEventListener('click',()=>{if(!holo)return;const av=vist(curVeh().id).avarias.find(a=>a.id===holo.id);const src=photoSrc(av);if(!src)return;
  openSheet(`<div class="sh-head"><div><span class="eyebrow">${esc(av.tipo)} · ${GRAV[av.grav]}</span><h3>${esc(av.parte)}</h3></div>${xBtn}</div><div class="zoom"><img src="${src}" alt="Foto da avaria"></div>${av.obs?`<p style="margin:0">${esc(av.obs)}</p>`:''}`)});
$('#hcFile').addEventListener('change',async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f||!holo)return;const av=vist(curVeh().id).avarias.find(a=>a.id===holo.id);
  try{const p=await readPhoto(f);const fd=new FormData();fd.append('id',av.id);fd.append('foto',p.blob,'avaria.jpg');const r=await api('avaria_foto',fd);av.foto=r.avaria.foto;fillHolo(av);if(ui.ptab==='avarias')renderPBody();toast('Foto atualizada.')}catch(err){falha(err)}});
$('#btnReset').addEventListener('click',()=>setVista('perspectiva'));
$('#viewBar').addEventListener('click',e=>{const b=e.target.closest('[data-vista]');if(b)setVista(b.dataset.vista)});
$('#pBody').addEventListener('toggle',e=>{const d=e.target;if(!d.matches||!d.matches('details.sec')||filtro!=='todos')return;if(d.open)secFechadas.delete(d.dataset.sec);else secFechadas.add(d.dataset.sec)},true);
$('#btnVisual').addEventListener('click',()=>{const v=curVeh();if(v&&ADMIN)openPicker(v)});

/* seletor de visual 3D (admin) */
const vehPayload=(v,extra)=>Object.assign({id:v.id,desc:v.desc,modeloId:v.modeloId,frotaId:v.frotaId,base:v.base||null,cor:v.cor},extra||{});
function openPicker(target,isModelo){
  let base=isModelo?target.base:vBase(target),cor=isModelo?null:vCor(target);
  const grid=()=>V3D.map(([id,nome])=>{const u=thumb(id,isModelo?BASECOR[id]:cor);return `<button class="pick" data-base="${id}" aria-pressed="${id===base}">${u?`<img src="${u}" alt="">`:'<span class="pk-noimg"></span>'}<span>${esc(nome)}</span></button>`}).join('');
  const temAv=!isModelo&&vist(target.id)&&vist(target.id).avarias.length;
  openSheet(`<div class="sh-head"><div><span class="eyebrow">${isModelo?'Veículo 3D padrão do modelo':'Visual 3D · '+esc(target.placa)}</span><h3>${isModelo?esc(target.nome):esc(target.desc)}</h3></div>${xBtn}</div>
    <div class="pick-grid" id="pkGrid">${grid()}</div>
    ${isModelo?'':`<div class="fld"><span>Cor da pintura</span><div class="swatches" id="pkCor">${CORES.map(([n,c])=>`<button class="sw" data-cor="${c}" style="background:${hex(c)}" aria-label="${n}" title="${n}" aria-pressed="${c===cor}"></button>`).join('')}</div></div>`}
    ${temAv?'<p class="note" style="margin:0">As avarias já marcadas são reposicionadas na peça equivalente do novo visual.</p>':''}
    <div class="sh-actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="pkOk">Aplicar</button></div>`);
  $('#pkGrid').addEventListener('click',e=>{const b=e.target.closest('[data-base]');if(!b)return;base=b.dataset.base;$('#pkGrid').querySelectorAll('.pick').forEach(x=>x.setAttribute('aria-pressed',x===b))});
  if(!isModelo)$('#pkCor').addEventListener('click',e=>{const b=e.target.closest('[data-cor]');if(!b)return;cor=+b.dataset.cor;$('#pkCor').querySelectorAll('.sw').forEach(x=>x.setAttribute('aria-pressed',x===b));$('#pkGrid').innerHTML=grid()});
  $('#pkOk').addEventListener('click',async ev=>{
    if(isModelo){target.base=base;closeSheet();renderModelos();saveModelo(target).then(()=>{const v=curVeh();if(v&&!v.base&&v.modeloId===target.id)setVehicle(v)});return}
    const btn=ev.currentTarget;const changed=base!==vBase(target);ocupado(btn);
    try{const r=await api('veiculo_salvar',vehPayload(target,{base,cor}));state.veiculos=r.veiculos;
      const vs=vist(target.id);if(changed&&vs)vs.avarias.forEach(a=>{a.pos=null});
      closeSheet();if(target.id===ui.veiculoId)setVehicle(curVeh());renderVistoria();if(ui.view==='frotas')renderFrotas();toast('Visual do veículo atualizado.')}
    catch(err){livre(btn);falha(err)}});
}

function openGuia(){
  const v=curVeh(),vs=vist(v.id),fi=vs.ficha;
  openSheet(`<div class="sh-head"><div><span class="eyebrow">Guia de marcha · ${esc(v.placa)}</span><h3>Lançar saída</h3></div>${xBtn}</div>
  <div class="form-grid"><label class="fld"><span>Data</span><input type="date" id="gData" value="${hoje()}"></label><label class="fld"><span>Hora de saída</span><input type="time" id="gHora" value="${agora()}"></label>
  <label class="fld full"><span>Motorista</span><input type="text" id="gMot" value="${esc(fi.motorista)}"></label>
  <label class="fld full"><span>Destino</span><input type="text" id="gDest"></label>
  <label class="fld"><span>KM inicial</span><input type="number" inputmode="numeric" id="gKmI" value="${esc(fi.km)}"></label><label class="fld"><span>KM final</span><input type="number" inputmode="numeric" id="gKmF"></label>
  <label class="fld"><span>Hora de chegada</span><input type="time" id="gHoraF"></label></div>
  <div class="sh-actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="gSave">Lançar</button></div>`);
  $('#gSave').addEventListener('click',async ev=>{if(!$('#gMot').value.trim()||!$('#gDest').value.trim()){toast('Preencha motorista e destino.');return}
    const btn=ev.currentTarget;ocupado(btn);
    try{const r=await api('guia_criar',{veiculo_id:v.id,data:$('#gData').value,hora:$('#gHora').value,motorista:$('#gMot').value.trim(),destino:$('#gDest').value.trim(),kmIni:$('#gKmI').value,kmFim:$('#gKmF').value,horaF:$('#gHoraF').value});
      vs.guia=r.guia;closeSheet();renderPBody();toast('Saída lançada na guia de marcha.')}catch(err){livre(btn);falha(err)}});
}
/* ---------- conclusão: assinatura por login (carimbo) ---------- */
const PERFIS={admin:'Administrador',vistoriador:'Vistoriador',motorista:'Motorista'};
function aposAlteracao(){
  const v=curVeh(),vs=v&&vist(v.id);
  if(vs&&vs.assinaturas&&Object.keys(vs.assinaturas).length){vs.assinaturas={};toast('A vistoria foi alterada depois da assinatura. Será preciso assinar de novo.')}
}
const fmtCarimbo=iso=>{try{return new Date(String(iso).replace(' ','T')).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch(e){return iso}};
function carimbo(a,papel){
  return `<div class="carimbo" role="img" aria-label="Assinado por ${esc(a.nome)} como ${papel==='motorista'?'motorista':'vistoriador'}">
    <span class="cb-topo">Assinado eletronicamente</span>
    <b class="cb-nome">${esc(a.nome)}</b>
    <span class="cb-info">${papel==='motorista'?'Motorista':'Vistoriador'}${a.matricula?` · Mat. ${esc(a.matricula)}`:''}</span>
    <span class="cb-data">${fmtCarimbo(a.em)}</span>
    <span class="cb-selo" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l4 4 10-10"/></svg></span>
  </div>`;
}
function slotAssinatura(vs,papel){
  const a=(vs.assinaturas||{})[papel];
  const titulo=papel==='motorista'?'Motorista':'Vistoriador';
  if(a)return `<div class="ass-slot assinado" data-papel="${papel}"><div class="ass-h"><span class="eyebrow">${titulo}</span><button class="btn ghost sm" data-ass-remover="${papel}">Desfazer</button></div>${carimbo(a,papel)}</div>`;
  if(papel==='vistoriador')return `<form class="ass-slot" data-papel="vistoriador"><div class="ass-h"><span class="eyebrow">${titulo}</span></div>
    <p class="ass-quem">Assinar como <b>${esc(USER.nome)}</b></p>
    <label class="fld"><span>Sua senha</span><input type="password" name="senha" autocomplete="current-password" required></label>
    <button class="btn primary">Assinar</button></form>`;
  return `<form class="ass-slot" data-papel="motorista"><div class="ass-h"><span class="eyebrow">${titulo}</span></div>
    <label class="fld"><span>Usuário do motorista</span><input type="text" name="login" autocomplete="off" autocapitalize="none" spellcheck="false" required></label>
    <label class="fld"><span>Senha</span><input type="password" name="senha" autocomplete="off" required></label>
    <button class="btn primary">Assinar</button></form>`;
}
function renderAssinaturas(){
  const v=curVeh(),vs=v&&vist(v.id),box=$('#assBox');if(!vs||!box)return;
  box.innerHTML=slotAssinatura(vs,'motorista')+slotAssinatura(vs,'vistoriador');
  const ok=vs.assinaturas&&vs.assinaturas.motorista&&vs.assinaturas.vistoriador;
  $('#sFim').disabled=!ok;$('#sFimNota').textContent=ok?'As duas assinaturas foram feitas.':'Faltam assinaturas: o motorista e o vistoriador assinam com o próprio usuário e senha.';
}
$('#btnConcluir').addEventListener('click',()=>{
  const v=curVeh();if(!v)return;const s=stats(v),vs=s.vs,m=modelo(v.modeloId);if(!vs)return;
  const noks=[];s.cl.forEach(sec=>sec.itens.forEach(i=>{if(vs.resp[i.id]==='n')noks.push(i.texto+(vs.robs[i.id]?': '+vs.robs[i.id]:''))}));
  const hist=vs.anteriores||[];const falta=s.tot-s.done;
  openSheet(`<div class="sh-head"><div><span class="eyebrow">${esc(m?m.origem.replace(/^(Ficha|Sugestão):\s*/,''):'')}</span><h3>${esc(v.placa)} · ${esc(v.desc)}</h3></div>${xBtn}</div>
    <div class="stats"><div><b>${s.done}/${s.tot}</b><span>itens</span></div><div class="bad"><b>${s.nok}</b><span>marcados Não</span></div><div class="warn"><b>${s.av}</b><span>avarias</span></div></div>
    ${falta?`<div class="callout">Faltam ${falta} itens sem resposta. Você pode concluir assim mesmo; eles ficam como não conferidos.</div>`:''}
    ${noks.length?`<div class="fld"><span>Itens com problema</span><ul class="sum-list">${noks.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div>`:''}
    ${s.av?`<div class="fld"><span>Avarias na lataria</span><ul class="sum-list">${vs.avarias.map(a=>`<li>${esc(a.parte)}: ${esc(a.tipo)} (${GRAV[a.grav]})</li>`).join('')}</ul></div>`:''}
    <div class="fld"><span>Assinaturas</span><div class="ass-box" id="assBox"></div></div>
    ${hist.length?`<div class="fld"><span>Vistorias anteriores</span><ul class="sum-list hist">${hist.map(h=>`<li><a href="relatorio.php?id=${encodeURIComponent(h.id)}" target="_blank" rel="noopener">${fmtData(h.fim)}</a> · ${h.nok} Não · ${h.av} avarias · ${esc(h.motorista||'sem motorista')}</li>`).join('')}</ul></div>`:''}
    <div class="sh-actions"><span class="muted" id="sFimNota" style="flex:1;font-size:13px;align-self:center"></span><button class="btn ghost" data-close>Voltar</button><button class="btn primary" id="sFim">Finalizar vistoria</button></div>`);
  renderAssinaturas();
  const box=$('#assBox');
  box.addEventListener('submit',async e=>{e.preventDefault();const f=e.target,papel=f.dataset.papel,btn=f.querySelector('button');
    const dados={vistoria_id:vs.id,papel,senha:f.senha.value};if(papel==='motorista')dados.login=f.login.value.trim();
    ocupado(btn,'Conferindo…');
    try{const r=await api('assinar',dados);$('#toast').hidden=true;vs.assinaturas=r.assinaturas;if(r.ficha)vs.ficha=r.ficha;renderAssinaturas();
      if(ui.ptab==='ficha')renderPBody();const prox=box.querySelector('form input');if(prox)prox.focus()}
    catch(err){livre(btn);f.senha.value='';f.senha.focus();falha(err)}});
  box.addEventListener('click',async e=>{const b=e.target.closest('[data-ass-remover]');if(!b)return;
    try{const r=await api('assinatura_remover',{vistoria_id:vs.id,papel:b.dataset.assRemover});vs.assinaturas=r.assinaturas;renderAssinaturas()}catch(err){falha(err)}});
  $('#sFim').addEventListener('click',async ev=>{const btn=ev.currentTarget;ocupado(btn,'Finalizando…');
    try{const r=await api('concluir',{vistoria_id:vs.id});
      vistCache[v.id]=r.vistoria;exitHolo(true);setVehicle(curVeh());ui.ptab='ficha';saveUi();renderVistoria();
      openSheet(`<div class="sh-head"><div><span class="eyebrow">Vistoria concluída</span><h3>${esc(v.placa)} · ${esc(v.desc)}</h3></div>${xBtn}</div>
        <p style="margin:0">A vistoria foi assinada e arquivada. Uma ficha nova já está aberta para a próxima saída.</p>
        <div class="sh-actions"><button class="btn ghost" data-close>Fechar</button><a class="btn primary" href="relatorio.php?id=${encodeURIComponent(r.concluida)}" target="_blank" rel="noopener">Abrir relatório para impressão</a></div>`)}
    catch(err){livre(btn);falha(err)}});
  const pf=box.querySelector('form input');if(pf)setTimeout(()=>pf.focus({preventScroll:true}),80);
});

/* ---------- usuários (admin) ---------- */
let usuarios=null,filtroUsr='todos';
async function carregarUsuarios(){try{const r=await api('usuarios',{},true);usuarios=r.usuarios;renderUsuarios()}catch(e){falha(e)}}
function renderUsuarios(){
  const el=$('#v-usuarios');
  if(!usuarios){el.innerHTML='<div class="loading">Carregando usuários…</div>';carregarUsuarios();return}
  const cont=p=>usuarios.filter(u=>p==='todos'||u.perfil===p).length;
  const lista=usuarios.filter(u=>filtroUsr==='todos'||u.perfil===filtroUsr);
  el.innerHTML=`<div class="vhead"><div><span class="eyebrow">Usuários</span><h2>Quem acessa e quem assina</h2><p class="lede">Vistoriadores e administradores entram no sistema. Motoristas não entram: eles só assinam a vistoria com o próprio usuário e senha, no aparelho do vistoriador.</p></div><button class="btn primary" data-act="novo-usr">Novo usuário</button></div>
  <div class="filters" role="group" aria-label="Filtrar por perfil">${['todos','motorista','vistoriador','admin'].map(p=>`<button data-filtro-usr="${p}" aria-pressed="${filtroUsr===p}">${{todos:'Todos',motorista:'Motoristas',vistoriador:'Vistoriadores',admin:'Administradores'}[p]}<span>${cont(p)}</span></button>`).join('')}</div>
  <div class="card" style="padding:0;overflow:hidden"><div class="gm-wrap" style="border:0;border-radius:0"><table class="gm-tbl usr-tbl"><thead><tr><th>Nome</th><th>Usuário</th><th>Matrícula</th><th>Perfil</th><th>Situação</th><th></th></tr></thead><tbody>
  ${lista.length?lista.map(u=>`<tr data-usr="${u.id}" class="${u.ativo?'':'inativo'}"><td class="dest">${esc(u.nome)}${u.id===USER.id?' <span class="tag">você</span>':''}</td><td class="mono">${esc(u.login)}</td><td>${esc(u.matricula||'—')}</td>
    <td><span class="perfil ${u.perfil}">${PERFIS[u.perfil]}</span></td><td>${u.ativo?'<span class="sit ok">Ativo</span>':'<span class="sit">Inativo</span>'}</td>
    <td class="acoes"><button class="btn sm" data-act="editar-usr">Editar</button>${u.id===USER.id?'':`<button class="btn ghost sm" data-act="ativo-usr">${u.ativo?'Desativar':'Reativar'}</button>`}</td></tr>`).join('')
    :'<tr><td colspan="6" class="muted" style="text-align:center;padding:20px">Nenhum usuário com esse perfil.</td></tr>'}
  </tbody></table></div></div>`;
}
function formUsuario(u){
  const novo=!u;u=u||{nome:'',login:'',matricula:'',perfil:'motorista'};
  openSheet(`<div class="sh-head"><div><span class="eyebrow">Usuários</span><h3>${novo?'Novo usuário':esc(u.nome)}</h3></div>${xBtn}</div>
    <form id="fUsr" class="form-grid">
      <label class="fld full"><span>Nome completo</span><input type="text" name="nome" value="${esc(u.nome)}" required></label>
      <label class="fld"><span>Usuário (login)</span><input type="text" name="login" value="${esc(u.login)}" autocapitalize="none" spellcheck="false" required placeholder="ex.: carlos.lima"></label>
      <label class="fld"><span>Matrícula</span><input type="text" name="matricula" value="${esc(u.matricula)}"></label>
      <div class="fld full"><span>Perfil</span><div class="chips" id="uPerfil">${['motorista','vistoriador','admin'].map(p=>`<button type="button" data-v="${p}" aria-pressed="${u.perfil===p}">${PERFIS[p]}</button>`).join('')}</div>
        <small class="muted" id="uPerfilAj"></small></div>
      <label class="fld full"><span>${novo?'Senha':'Nova senha (deixe em branco para manter)'}</span><input type="password" name="senha" autocomplete="new-password" ${novo?'required':''} minlength="6"></label>
    </form>
    <div class="sh-actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="uSave">${novo?'Criar usuário':'Salvar'}</button></div>`);
  let perfil=u.perfil;const aj={motorista:'Só assina vistorias. Não entra no sistema.',vistoriador:'Entra no sistema e faz vistorias.',admin:'Faz vistorias e cuida de modelos, frotas, veículos e usuários.'};
  const sync=()=>{$('#uPerfilAj').textContent=aj[perfil];$('#uPerfil').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===perfil))};sync();
  $('#uPerfil').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(b){perfil=b.dataset.v;sync()}});
  const salvar=async()=>{const f=$('#fUsr');if(!f.reportValidity())return;const btn=$('#uSave');ocupado(btn);
    try{await api('usuario_salvar',{id:novo?'':u.id,nome:f.nome.value.trim(),login:f.login.value.trim(),matricula:f.matricula.value.trim(),perfil,senha:f.senha.value});
      closeSheet();toast(novo?'Usuário criado.':'Usuário atualizado.');carregarUsuarios()}catch(err){livre(btn);falha(err)}};
  $('#uSave').addEventListener('click',salvar);$('#fUsr').addEventListener('submit',e=>{e.preventDefault();salvar()});
}
$('#v-usuarios').addEventListener('click',e=>{
  const f=e.target.closest('[data-filtro-usr]');if(f){filtroUsr=f.dataset.filtroUsr;renderUsuarios();return}
  const b=e.target.closest('[data-act]');if(!b)return;const row=b.closest('[data-usr]');const u=row&&usuarios.find(x=>x.id===row.dataset.usr);
  if(b.dataset.act==='novo-usr')formUsuario(null);
  if(b.dataset.act==='editar-usr'&&u)formUsuario(u);
  if(b.dataset.act==='ativo-usr'&&u)api('usuario_ativo',{id:u.id,ativo:!u.ativo}).then(()=>{toast(u.ativo?'Usuário desativado.':'Usuário reativado.');carregarUsuarios()}).catch(falha);
});

/* ---------- modelos (admin) ---------- */
const countItens=m=>m.secoes.reduce((n,s)=>n+s.itens.length,0);
const tipoOpts=t=>[['sn','Sim / Não'],['num','Número'],['texto','Texto']].map(([v,l])=>`<option value="${v}" ${t===v?'selected':''}>${l}</option>`).join('');
let filaModelo=Promise.resolve();
// Salva o modelo inteiro. Os IDs devolvidos pelo servidor são gravados nos mesmos objetos (por posição) para que edições seguintes não dupliquem itens.
function saveModelo(m){
  filaModelo=filaModelo.then(async()=>{
    const refs=m.secoes.map(s=>({s,itens:s.itens.slice()}));const antigo=m.id;
    const r=await api('modelo_salvar',{modelo:m});
    m.id=r.modelo.id;if(ui.modeloSel===antigo)ui.modeloSel=m.id;m.origem=r.modelo.origem;
    r.modelo.secoes.forEach((rs,i)=>{const ref=refs[i];if(!ref)return;ref.s.id=rs.id;rs.itens.forEach((ri,j)=>{if(ref.itens[j])ref.itens[j].id=ri.id})});
    saveUi();
  }).catch(falha);
  return filaModelo;
}
function renderModelos(){
  const el=$('#v-modelos');const m=modelo(ui.modeloSel)||state.modelos[0];
  if(!m){el.innerHTML='<div class="vhead"><div><span class="eyebrow">Modelos de checklist</span><h2>Nenhum modelo cadastrado</h2></div><button class="btn primary" data-act="novo-modelo">Novo modelo</button></div>';return}
  ui.modeloSel=m.id;
  const uso=state.veiculos.filter(v=>v.modeloId===m.id).length;const tu=thumb(m.base,BASECOR[m.base]);
  el.innerHTML=`<div class="vhead"><div><span class="eyebrow">Modelos de checklist</span><h2>Itens por tipo de veículo</h2><p class="lede">Cada modelo reúne os itens padrão da ficha e o veículo 3D sugerido. As alterações valem para as próximas vistorias; as já concluídas guardam os itens da época.</p></div><button class="btn primary" data-act="novo-modelo">Novo modelo</button></div>
  <div class="chips-scroll">${state.modelos.map(x=>`<button class="mchip" aria-pressed="${x.id===m.id}" data-act="sel-modelo" data-id="${x.id}"><b>${esc(x.nome)}</b><span>${countItens(x)} itens · ${state.veiculos.filter(v=>v.modeloId===x.id).length} veículos</span></button>`).join('')}</div>
  <div class="card"><div class="mrow">
    <label class="fld grow"><span>Nome do modelo</span><input type="text" id="mNome" value="${esc(m.nome)}"></label>
    <label class="fld"><span>Respostas</span><select id="mRot"><option value="Sim|Não" ${m.rot[0]==='Sim'?'selected':''}>Sim / Não</option><option value="OK|Não" ${m.rot[0]==='OK'?'selected':''}>OK / Não</option></select></label>
    <div class="fld"><span>Veículo 3D padrão</span><button class="base-pick" data-act="pick-base">${tu?`<img src="${tu}" alt="">`:''}<span>${esc(BASES[m.base]||'')}<small>Alterar</small></span></button></div></div>
    <div class="mmeta"><span>${m.origem?esc(m.origem)+' · ':''}${uso} veículo(s) usam este modelo</span><span class="spacer"></span><button class="btn ghost sm" data-act="dup-modelo">Duplicar</button><button class="btn ghost sm danger" data-act="del-modelo" ${uso?'disabled title="Troque o modelo dos veículos antes de excluir"':''}>${pendingDel==='m'+m.id?'Confirmar exclusão':'Excluir'}</button></div></div>
  ${m.secoes.map((s,si)=>`<div class="card" data-si="${si}"><div class="sec-h"><input class="sec-name" data-sec-nome="${si}" value="${esc(s.nome)}" aria-label="Nome da seção"><span class="count">${s.itens.length} itens</span><button class="btn ghost sm danger" data-act="del-sec">${pendingDel==='s'+si+m.id?'Confirmar':'Excluir seção'}</button></div>
    <ul class="ed-list">${s.itens.map((i,ii)=>`<li class="ed-row" data-ii="${ii}"><input type="text" class="ed-t" data-f="texto" value="${esc(i.texto)}" aria-label="Texto do item"><select data-f="tipo" aria-label="Tipo de resposta">${tipoOpts(i.tipo)}</select>${i.tipo==='num'?`<input type="text" class="ed-un" data-f="un" value="${esc(i.un||'')}" placeholder="unid." aria-label="Unidade">`:''}${i.tipo==='sn'?`<label class="ed-chk"><input type="checkbox" data-f="obs" ${i.obs?'checked':''}> pedir obs.</label>`:''}<button class="icon-btn" data-act="del-item" aria-label="Remover item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>`).join('')}</ul>
    <button class="btn ghost sm" data-act="add-item">+ Adicionar item</button></div>`).join('')}
  <div><button class="btn" data-act="add-sec">+ Nova seção</button></div>`;
}
const novoItem=()=>({id:'novo-'+uid(),texto:'Novo item',tipo:'sn',un:'',obs:false});
$('#v-modelos').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const m=modelo(ui.modeloSel);const a=b.dataset.act;
  if(a==='sel-modelo'){ui.modeloSel=b.dataset.id;pendingDel=null;saveUi();renderModelos();return}
  if(a==='novo-modelo'){openNovoModelo();return}
  if(a==='pick-base'){openPicker(m,true);return}
  if(a==='dup-modelo'){const c=JSON.parse(JSON.stringify(m));c.id='novo-'+uid();c.nome=m.nome+' (cópia)';c.origem='';c.secoes.forEach(s=>{s.id='novo-'+uid();s.itens.forEach(i=>{i.id='novo-'+uid()})});
    state.modelos.push(c);ui.modeloSel=c.id;renderModelos();saveModelo(c).then(()=>{renderModelos();toast('Modelo duplicado.')});return}
  if(a==='del-modelo'){if(pendingDel==='m'+m.id){pendingDel=null;api('modelo_excluir',{id:m.id}).then(()=>{state.modelos=state.modelos.filter(x=>x!==m);ui.modeloSel=state.modelos[0]&&state.modelos[0].id;renderModelos();toast('Modelo excluído.')}).catch(falha)}else{pendingDel='m'+m.id;renderModelos()}return}
  if(a==='add-sec'){m.secoes.push({id:'novo-'+uid(),nome:'Nova seção',itens:[novoItem()]});renderModelos();saveModelo(m);const ins=document.querySelectorAll('#v-modelos .sec-name');ins[ins.length-1].select();return}
  const card=b.closest('[data-si]');if(!card)return;const si=+card.dataset.si,s=m.secoes[si];
  if(a==='del-sec'){if(pendingDel==='s'+si+m.id){pendingDel=null;m.secoes.splice(si,1);renderModelos();saveModelo(m)}else{pendingDel='s'+si+m.id;renderModelos()}return}
  if(a==='add-item'){s.itens.push(novoItem());renderModelos();saveModelo(m);const rows=document.querySelectorAll(`#v-modelos [data-si="${si}"] .ed-t`);rows[rows.length-1].select();return}
  if(a==='del-item'){s.itens.splice(+b.closest('[data-ii]').dataset.ii,1);renderModelos();saveModelo(m)}
});
$('#v-modelos').addEventListener('change',e=>{const t=e.target,m=modelo(ui.modeloSel);if(!m)return;
  if(t.id==='mNome'){m.nome=t.value.trim()||m.nome;saveModelo(m).then(renderModelos);return}
  if(t.id==='mRot'){m.rot=t.value.split('|');saveModelo(m);return}
  if(t.dataset.secNome!==undefined){const s=m.secoes[+t.dataset.secNome];if(s){s.nome=t.value.trim()||s.nome;saveModelo(m)}return}
  const li=t.closest('[data-ii]'),card=t.closest('[data-si]');if(!li||!card)return;const i=m.secoes[+card.dataset.si].itens[+li.dataset.ii];if(!i)return;
  if(t.dataset.f==='obs')i.obs=t.checked;else i[t.dataset.f]=t.value;saveModelo(m);if(t.dataset.f==='tipo')renderModelos();
});
function openNovoModelo(){
  openSheet(`<div class="sh-head"><div><span class="eyebrow">Modelos de checklist</span><h3>Novo modelo</h3></div>${xBtn}</div>
  <label class="fld"><span>Nome</span><input type="text" id="nmNome" placeholder="Ex.: Van de manutenção"></label>
  <label class="fld"><span>Veículo 3D padrão</span><select id="nmBase">${V3D.map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label>
  <label class="fld"><span>Começar com os itens de</span><select id="nmCopia"><option value="">Nenhum (em branco)</option>${state.modelos.map(m=>`<option value="${m.id}">${esc(m.nome)}</option>`).join('')}</select></label>
  <div class="sh-actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="nmSave">Criar modelo</button></div>`);
  $('#nmSave').addEventListener('click',()=>{const nome=$('#nmNome').value.trim();if(!nome){toast('Dê um nome ao modelo.');return}
    const src=modelo($('#nmCopia').value);const secoes=src?JSON.parse(JSON.stringify(src.secoes)):[{id:'',nome:'Geral',itens:[novoItem()]}];
    secoes.forEach(s=>{s.id='novo-'+uid();s.itens.forEach(i=>{i.id='novo-'+uid()})});
    const m={id:'novo-'+uid(),nome,base:$('#nmBase').value,rot:src?src.rot.slice():['OK','Não'],origem:'',secoes};state.modelos.push(m);ui.modeloSel=m.id;closeSheet();renderModelos();
    saveModelo(m).then(()=>{renderModelos();toast('Modelo criado.')})});
}

/* ---------- frotas (admin) ---------- */
function renderFrotas(){
  const el=$('#v-frotas');
  if(!state.frotas.length){el.innerHTML='<div class="vhead"><div><span class="eyebrow">Frotas e veículos</span><h2>Nenhuma frota cadastrada</h2></div><button class="btn primary" data-act="nova-frota">Nova frota</button></div>';return}
  if(!frota(ui.frotaId))ui.frotaId=state.frotas[0].id;
  const fr=frota(ui.frotaId);const vs=state.veiculos.filter(v=>v.frotaId===fr.id);
  const usados=[...new Set(vs.map(v=>v.modeloId))].map(modelo).filter(Boolean);
  const secs=[...new Set(state.modelos.flatMap(m=>m.secoes.map(s=>s.nome)))];
  const del='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
  el.innerHTML=`<div class="vhead"><div><span class="eyebrow">Frotas e veículos</span><h2>Checklist personalizado por frota</h2><p class="lede">Cadastre os veículos com o modelo de checklist e o visual 3D de cada um. Esconda itens que não se aplicam à frota e inclua itens próprios.</p></div><button class="btn primary" data-act="nova-frota">Nova frota</button></div>
  <div class="chips-scroll">${state.frotas.map(x=>`<button class="mchip" aria-pressed="${x.id===fr.id}" data-act="sel-frota" data-id="${x.id}"><b>${esc(x.nome)}</b><span>${state.veiculos.filter(v=>v.frotaId===x.id).length} veículos · ${esc(x.setor||'sem setor')}</span></button>`).join('')}</div>
  <div class="card"><div class="mrow"><label class="fld grow"><span>Nome da frota</span><input type="text" id="frNome" value="${esc(fr.nome)}"></label><label class="fld grow"><span>Setor padrão</span><input type="text" id="frSetor" value="${esc(fr.setor||'')}"></label>
  <button class="btn ghost danger" data-act="del-frota" ${vs.length?'disabled title="Remova os veículos antes de excluir a frota"':''}>${pendingDel==='f'+fr.id?'Confirmar exclusão':'Excluir frota'}</button></div></div>
  <div class="grid-2">
    <div class="card"><h3>Veículos (${vs.length})</h3>
      ${vs.length?vs.map(v=>`<div class="vrow" data-v="${v.id}">${thumbImg(v,'vthumb')}<div class="vr-d"><span class="plate">${esc(v.placa)}</span><b>${esc(v.desc)}</b></div><div class="vr-a"><button class="btn sm" data-act="vistoriar">Vistoriar</button><button class="icon-btn" data-act="del-veh" aria-label="Remover veículo">${pendingDel==='v'+v.id?'<span style="font-size:11px;color:var(--bad);font-weight:600">Remover?</span>':del}</button></div>
        <div class="vr-cfg"><select data-f="modelo" aria-label="Modelo de checklist de ${esc(v.placa)}">${state.modelos.map(m=>`<option value="${m.id}" ${m.id===v.modeloId?'selected':''}>Checklist: ${esc(m.nome)}</option>`).join('')}</select><select data-f="frota" aria-label="Frota de ${esc(v.placa)}">${state.frotas.map(f=>`<option value="${f.id}" ${f.id===v.frotaId?'selected':''}>Frota: ${esc(f.nome)}</option>`).join('')}</select><button class="btn sm" data-act="visual">Visual 3D: ${esc(BASES[vBase(v)])}</button></div></div>`).join(''):'<div class="empty">Nenhum veículo nesta frota.</div>'}
      <form class="addrow" id="fAddVeh"><input type="text" id="avPlaca" placeholder="Placa" maxlength="8" aria-label="Placa" style="text-transform:uppercase"><input type="text" id="avDesc" placeholder="Descrição (ex.: Hilux 2024)" aria-label="Descrição">
        <select id="avModelo" aria-label="Modelo de checklist">${state.modelos.map(m=>`<option value="${m.id}">Checklist: ${esc(m.nome)}</option>`).join('')}</select>
        <select id="avBase" aria-label="Visual 3D"><option value="">Visual 3D do modelo</option>${V3D.map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select>
        <select id="avCor" aria-label="Cor">${CORES.map(([n,c])=>`<option value="${c}">${n}</option>`).join('')}</select>
        <button class="btn primary">Adicionar veículo</button></form>
    </div>
    <div class="card"><h3>Itens próprios da frota</h3>
      ${fr.extras.length?fr.extras.map(x=>`<div class="xrow" data-x="${x.id}"><div><b style="font-weight:600">${esc(x.texto)}</b><br><small>${esc(x.secao)} · ${{sn:'Sim/Não',num:'Número'+(x.un?' ('+esc(x.un)+')':''),texto:'Texto'}[x.tipo]} · ${x.modelos.length?x.modelos.map(id=>esc((modelo(id)||{}).nome||'?')).join(', '):'todos os modelos'}</small></div><button class="icon-btn" data-act="del-extra" aria-label="Remover item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`).join(''):'<div class="empty">Esta frota usa só os itens dos modelos.</div>'}
      <form class="addrow" id="fAddX"><input type="text" id="axTexto" placeholder="Novo item (ex.: Giroflex)" aria-label="Texto do item"><input type="text" id="axSec" list="secList" placeholder="Seção" aria-label="Seção"><datalist id="secList">${secs.map(s=>`<option value="${esc(s)}">`).join('')}</datalist>
        <select id="axTipo" aria-label="Tipo">${tipoOpts('sn')}</select><input type="text" id="axUn" placeholder="unid." aria-label="Unidade" style="flex:0 1 80px">
        <select id="axMod" aria-label="Aplica a"><option value="">Todos os modelos</option>${state.modelos.map(m=>`<option value="${m.id}">Só ${esc(m.nome)}</option>`).join('')}</select><button class="btn primary">Incluir item</button></form>
      <h3 style="margin-top:20px">Itens dos modelos nesta frota</h3>
      ${usados.length?usados.map(m=>{const tot=countItens(m),on=m.secoes.reduce((n,s)=>n+s.itens.filter(i=>!fr.ocultos.includes(i.id)).length,0);
        return `<details class="tg"><summary>${esc(m.nome)} <small>· ${on} de ${tot} itens ativos</small></summary>${m.secoes.map(s=>`<div class="tg-sec">${esc(s.nome)}</div>${s.itens.map(i=>{const off=fr.ocultos.includes(i.id);return `<label class="tog ${off?'off':''}"><input type="checkbox" data-tog="${i.id}" ${off?'':'checked'}><span>${esc(i.texto)}</span></label>`}).join('')}`).join('')}</details>`}).join(''):'<div class="empty">Cadastre veículos para ajustar os itens dos modelos.</div>'}
    </div>
  </div>`;
}
function aposFrotas(r){if(r.frotas)state.frotas=r.frotas;if(r.veiculos)state.veiculos=r.veiculos;renderFrotaSel();renderFrotas();renderVistoria()}
$('#v-frotas').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act,fr=frota(ui.frotaId);
  if(a==='sel-frota'){ui.frotaId=b.dataset.id;pendingDel=null;saveUi();renderFrotaSel();renderFrotas();renderVistoria();return}
  if(a==='nova-frota'){api('frota_salvar',{nome:'Nova frota',setor:''}).then(r=>{ui.frotaId=r.id;saveUi();aposFrotas(r);$('#frNome').select()}).catch(falha);return}
  if(a==='del-frota'){if(pendingDel==='f'+fr.id){pendingDel=null;api('frota_excluir',{id:fr.id}).then(r=>{ui.frotaId=r.frotas[0]&&r.frotas[0].id;aposFrotas(r);toast('Frota excluída.')}).catch(falha)}else{pendingDel='f'+fr.id;renderFrotas()}return}
  const row=b.closest('[data-v]');const veh=row&&state.veiculos.find(v=>v.id===row.dataset.v);
  if(a==='vistoriar'&&veh){selectVeh(veh.id);go('vistoria');return}
  if(a==='visual'&&veh){openPicker(veh);return}
  if(a==='del-veh'&&veh){if(pendingDel==='v'+veh.id){pendingDel=null;api('veiculo_excluir',{id:veh.id}).then(r=>{delete vistCache[veh.id];aposFrotas(r);toast('Veículo removido. O histórico de vistorias foi mantido.')}).catch(falha)}else{pendingDel='v'+veh.id;renderFrotas()}return}
  if(a==='del-extra'){api('extra_excluir',{id:b.closest('[data-x]').dataset.x}).then(aposFrotas).catch(falha)}
});
$('#v-frotas').addEventListener('change',e=>{const t=e.target,fr=frota(ui.frotaId);
  if(t.id==='frNome'||t.id==='frSetor'){const nome=$('#frNome').value.trim();if(!nome){toast('A frota precisa de um nome.');return}api('frota_salvar',{id:fr.id,nome,setor:$('#frSetor').value.trim()}).then(aposFrotas).catch(falha);return}
  if(t.dataset.tog){const off=!t.checked;t.closest('.tog').classList.toggle('off',off);api('oculto',{frota_id:fr.id,item:t.dataset.tog,oculto:off}).then(r=>{state.frotas=r.frotas;renderVistoria()}).catch(falha);return}
  const row=t.closest('[data-v]');const veh=row&&state.veiculos.find(v=>v.id===row.dataset.v);if(!veh)return;
  if(t.dataset.f==='modelo')api('veiculo_salvar',vehPayload(veh,{modeloId:t.value})).then(aposFrotas).catch(falha);
  if(t.dataset.f==='frota')api('veiculo_salvar',vehPayload(veh,{frotaId:t.value})).then(r=>{aposFrotas(r);toast('Veículo transferido de frota.')}).catch(falha);
});
$('#v-frotas').addEventListener('submit',e=>{e.preventDefault();const fr=frota(ui.frotaId);const btn=e.target.querySelector('button');
  if(e.target.id==='fAddVeh'){const placa=$('#avPlaca').value.toUpperCase().replace(/[^A-Z0-9-]/g,'');if(placa.length<5){toast('Informe a placa (ex.: ABC1D23).');return}
    const mid=$('#avModelo').value,base=$('#avBase').value||null;
    ocupado(btn);api('veiculo_salvar',{placa,desc:$('#avDesc').value.trim()||BASES[base||(modelo(mid)||{}).base]||'Veículo',modeloId:mid,frotaId:fr.id,base,cor:+$('#avCor').value})
      .then(r=>{aposFrotas(r);toast('Veículo adicionado.')}).catch(err=>{livre(btn);falha(err)});return}
  if(e.target.id==='fAddX'){const texto=$('#axTexto').value.trim(),sec=$('#axSec').value.trim();if(!texto||!sec){toast('Preencha o item e a seção.');return}
    ocupado(btn);api('extra_criar',{frota_id:fr.id,secao:sec,texto,tipo:$('#axTipo').value,un:$('#axUn').value.trim(),modelo_id:$('#axMod').value})
      .then(r=>{aposFrotas(r);toast('Item incluído no checklist da frota.')}).catch(err=>{livre(btn);falha(err)})}
});

/* ---------- tema claro/escuro ---------- */
const TEMA_KEY='reviver-checklist-tema';
function setTema(t){document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem(TEMA_KEY,t)}catch(e){}
  const dark=t==='dark';$('#btnTema').innerHTML=dark?'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><span>Visual claro</span>':'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg><span>Visual escuro</span>';
  $('#btnTema').setAttribute('aria-label',dark?'Mudar para visual claro':'Mudar para visual escuro')}
setTema(document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light');
$('#btnTema').addEventListener('click',()=>setTema(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'));

/* ---------- início ---------- */
if(!ADMIN)document.querySelectorAll('[data-go="modelos"],[data-go="frotas"],[data-go="usuarios"]').forEach(b=>{b.hidden=true});
(async function iniciar(){
  $('#pBody').innerHTML='<div class="loading">Carregando…</div>';
  try{const r=await api('bootstrap',{},true);state.modelos=r.modelos;state.frotas=r.frotas;state.veiculos=r.veiculos}
  catch(e){falha(e);$('#pBody').innerHTML='<div class="alert">Não foi possível carregar os dados. Recarregue a página.</div>';return}
  if(!frota(ui.frotaId))ui.frotaId=state.frotas[0]?state.frotas[0].id:null;
  if(!curVeh()||curVeh().frotaId!==ui.frotaId){const v=state.veiculos.find(x=>x.frotaId===ui.frotaId);ui.veiculoId=v?v.id:null}
  renderFrotaSel();
  if(!(HAS3D&&init3D()))$('#hint').textContent='Não foi possível abrir o modelo 3D neste aparelho. O checklist continua funcionando normalmente.';
  showView();
  if(ui.veiculoId)selectVeh(ui.veiculoId);
})();
})();
