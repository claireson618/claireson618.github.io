const $ = (id) => document.getElementById(id);
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parkOrder = ['강서','양화','여의도','망원','난지','이촌','반포','잠원','뚝섬','잠실','광나루'];
const map = L.map('map', {zoomControl:false, preferCanvas:true}).setView([37.54,126.98], 11);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom:19,
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
}).addTo(map);
L.control.zoom({position:'bottomleft'}).addTo(map);

let entrances = [];
let times = {};
let stations = new Map();
let markers = new Map();
let selected = null;
let selectedPark = '전체';
let stationMarker = null;
let current = [];
let allBounds = null;
let routeMode = false;
let routePoints = [];
let routePointMarkers = [];
let routeLine = null;
let routeBusy = false;
const streamAnchors = [
  {name:'안양천',lat:37.5570,lon:126.8740},{name:'안양천',lat:37.5350,lon:126.8740},{name:'안양천',lat:37.5160,lon:126.8770},
  {name:'홍제천',lat:37.5750,lon:126.8840},{name:'홍제천',lat:37.5770,lon:126.8930},
  {name:'불광천',lat:37.5760,lon:126.9060},{name:'불광천',lat:37.5820,lon:126.9140},
  {name:'중랑천',lat:37.5500,lon:127.0440},{name:'중랑천',lat:37.5620,lon:127.0600},{name:'중랑천',lat:37.5730,lon:127.0700},
  {name:'탄천',lat:37.5100,lon:127.0690},{name:'탄천',lat:37.4990,lon:127.0710},
  {name:'양재천',lat:37.4840,lon:127.0500},{name:'양재천',lat:37.4770,lon:127.0350}
];

function entranceIcon(active=false){
  return L.divIcon({className:'',html:`<span class="pin${active?' selected':''}"></span>`,iconSize:[23,23],iconAnchor:[11,11]});
}
function stationIcon(){return L.divIcon({className:'',html:'<span class="station-pin"></span>',iconSize:[17,17],iconAnchor:[8,8]});}
function routeInfo(entry){return times[entry.id] || null;}
function matches(entry){
  if(selectedPark !== '전체' && entry.park !== selectedPark) return false;
  const q = $('search').value.trim().toLocaleLowerCase('ko');
  if(!q) return true;
  const station = routeInfo(entry)?.station || '';
  return `${entry.name} ${entry.park} ${entry.address} ${station}`.toLocaleLowerCase('ko').includes(q);
}
function displayName(entry){
  const prefix = `${entry.park} `;
  return entry.name.startsWith(prefix) ? entry.name.slice(prefix.length) : entry.name;
}
function renderFilters(){
  const counts = new Map();
  for(const e of entrances) counts.set(e.park,(counts.get(e.park)||0)+1);
  const parks = ['전체',...parkOrder.filter(p=>counts.has(p))];
  $('filters').innerHTML = parks.map(p=>`<button type="button" class="filter${p===selectedPark?' active':''}" data-park="${esc(p)}" aria-pressed="${p===selectedPark}">${esc(p)}${p==='전체'?'':` · ${counts.get(p)}`}</button>`).join('');
  $('filters').querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
    selectedPark=btn.dataset.park;
    renderFilters(); render();
  }));
}
function render(){
  current = entrances.filter(matches).sort((a,b)=>a.lon-b.lon || a.lat-b.lat);
  $('count').textContent = `${current.length}곳`;
  $('listTitle').textContent = selectedPark==='전체'?'전체 나들목':`${selectedPark} 나들목`;
  $('list').innerHTML = current.length ? current.map(e=>{
    const info=routeInfo(e);
    return `<button type="button" role="listitem" class="entry${selected?.id===e.id?' selected':''}" data-id="${esc(e.id)}" aria-label="${esc(e.name)}, ${info?`${esc(info.station)}역 도보 약 ${info.minutes}분`:'도보 정보 없음'}">
      <span class="entry-icon" aria-hidden="true">↗</span><span class="entry-main"><span class="entry-name">${esc(displayName(e))}</span><span class="entry-sub">${esc(e.park)}한강공원 · ${esc(info?.station||'역 정보 확인 중')}역</span></span><span class="entry-time">${info?`약 ${info.minutes}분`:'—'}<small>${info?.method==='distance_estimate'?'거리 추정':'도보 경로'}</small></span>
    </button>`;
  }).join(''):'<div class="empty">조건에 맞는 나들목이 없어요.</div>';
  $('list').querySelectorAll('.entry').forEach(el=>el.addEventListener('click',()=>{
    const entry=entrances.find(e=>e.id===el.dataset.id);
    if(routeMode) addRoutePoint({lat:entry.lat,lon:entry.lon}); else selectEntry(el.dataset.id);
  }));
  const visible = new Set(current.map(e=>e.id));
  for(const [id,marker] of markers) {
    if(visible.has(id)) marker.addTo(map); else map.removeLayer(marker);
    marker.setIcon(entranceIcon(selected?.id===id));
  }
  if(selected && !visible.has(selected.id)) clearSelection();
}
function clearSelection(){
  const old=selected; selected=null;
  $('detail').classList.add('hidden');
  if(stationMarker){map.removeLayer(stationMarker);stationMarker=null;}
  if(old && markers.has(old.id)) markers.get(old.id).setIcon(entranceIcon());
  if(location.hash) history.replaceState(null,'',location.pathname+location.search);
}
function selectEntry(id){
  const entry=entrances.find(e=>e.id===id);
  if(!entry) return;
  const previous=selected; selected=entry;
  if(previous && markers.has(previous.id)) markers.get(previous.id).setIcon(entranceIcon());
  markers.get(id).setIcon(entranceIcon(true));
  if(stationMarker){map.removeLayer(stationMarker);stationMarker=null;}
  const info=routeInfo(entry);
  const station=info ? stations.get(info.station) : null;
  if(station){
    stationMarker=L.marker([station.lat,station.lon],{icon:stationIcon(),zIndexOffset:900}).addTo(map)
      .bindTooltip(`${esc(station.name)}역`,{direction:'top',offset:[0,-7]});
    map.fitBounds([[entry.lat,entry.lon],[station.lat,station.lon]],{padding:[90,90],maxZoom:15,animate:true});
  } else map.flyTo([entry.lat,entry.lon],14);
  const directions=station ? `https://www.google.com/maps/dir/?api=1&origin=${entry.lat}%2C${entry.lon}&destination=${station.lat}%2C${station.lon}&travelmode=walking` : '';
  $('detail').innerHTML = `<div class="detail-top"><div><div class="detail-kicker">${esc(entry.park)}한강공원 · 나들목</div><h2>${esc(displayName(entry))}</h2></div><button type="button" class="close-detail" aria-label="상세 정보 닫기">×</button></div>
    <div class="route-card"><div class="route-label">가장 가까운 역 · ${info?.method==='distance_estimate'?'거리 기준 추정':'보행 경로 기준'}</div><div class="route-main"><div><div class="station-name">${esc(info?.station||'경로 확인 불가')}역</div><div class="station-lines">${station?esc(station.lines.join(' · ')):''}</div></div><div class="minutes">${info?`약 ${info.minutes}<small>분</small>`:'—'}</div></div><div class="route-distance">${info?`${info.method==='distance_estimate'?'추정 거리':'예상 보행거리'} ${info.meters.toLocaleString('ko-KR')}m`:'보행 경로 정보가 없습니다.'}</div></div>
    <p class="detail-address"><strong>위치</strong> · ${esc(entry.address)}${entry.hint?`<br>${esc(entry.hint)}`:''}</p>
    ${station?`<a class="directions" href="${directions}" target="_blank" rel="noopener">도보 길찾기 열기 <span aria-hidden="true">↗</span></a>`:''}`;
  $('detail').classList.remove('hidden');
  $('detail').querySelector('.close-detail').addEventListener('click',clearSelection);
  history.replaceState(null,'',`#${encodeURIComponent(id)}`);
  render();
  $('detail').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function fitAll(){
  if(allBounds) map.fitBounds(allBounds,{padding:[35,35],maxZoom:12});
}

$('search').addEventListener('input',render);
$('resetMap').addEventListener('click',()=>{selectedPark='전체';$('search').value='';clearSelection();renderFilters();render();fitAll();});

Promise.all(['entrances.json','stations.json','walking-times.json'].map(file=>fetch(`./${file}`).then(r=>{if(!r.ok) throw new Error(`${file}: ${r.status}`);return r.json();})))
  .then(([entryData,stationData,timeData])=>{
    entrances=entryData; stations=new Map(stationData.map(s=>[s.name,s]));times=timeData;
    for(const entry of entrances){
      const marker=L.marker([entry.lat,entry.lon],{icon:entranceIcon()})
        .bindTooltip(esc(entry.name),{direction:'top',offset:[0,-9]})
        .on('click',()=>routeMode?addRoutePoint({lat:entry.lat,lon:entry.lon}):selectEntry(entry.id));
      markers.set(entry.id,marker);
    }
    allBounds=L.latLngBounds(entrances.map(e=>[e.lat,e.lon]));
    renderFilters();render();
    requestAnimationFrame(()=>{map.invalidateSize();fitAll();});
    const hash=decodeURIComponent(location.hash.slice(1));
    if(hash && markers.has(hash)) selectEntry(hash);
  })
  .catch(error=>{
    $('count').textContent='오류';
    $('list').innerHTML='<div class="empty">나들목 정보를 불러오지 못했습니다. 잠시 후 다시 열어주세요.</div>';
    console.error(error);
  });

function updateRouteMode(){
  $('routePanel').classList.toggle('hidden',!routeMode);
  $('routeToggle').classList.toggle('active',routeMode);
  $('routeToggle').setAttribute('aria-expanded',String(routeMode));
  $('routeToggle').querySelector('span').textContent=routeMode?'−':'＋';
  $('mapInstruction').classList.toggle('hidden',!routeMode);
  $('map').classList.toggle('route-mode',routeMode);
  if(routeMode && selected) clearSelection();
}
function renderRoutePoints(){
  $('routePoints').innerHTML=routePoints.length
    ? routePoints.map((_,i)=>`<span class="point-pill"><b>${i+1}</b>지점 ${i+1}</span>`).join('')
    : '최소 3곳을 찍으면 출발점으로 돌아오는 경로를 만들 수 있어요.';
  $('calculateRoute').disabled=routePoints.length<3||routeBusy;
  $('undoPoint').disabled=!routePoints.length||routeBusy;
  $('clearRoute').disabled=!routePoints.length||routeBusy;
}
function invalidateRoute(){
  if(routeLine){map.removeLayer(routeLine);routeLine=null;}
  $('routeResult').classList.add('hidden');
}
function addRoutePoint(point){
  if(routePoints.length>=8){
    $('routeResult').innerHTML='<div class="result-note">경유지는 최대 8곳까지 찍을 수 있어요. 마지막 지점을 되돌린 뒤 다시 찍어주세요.</div>';
    $('routeResult').classList.remove('hidden');
    return;
  }
  routePoints.push(point);
  const number=routePoints.length;
  const marker=L.marker([point.lat,point.lon],{icon:L.divIcon({className:'',html:`<span class="route-point-pin${number===1?' start':''}">${number}</span>`,iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:1000}).addTo(map);
  routePointMarkers.push(marker);
  invalidateRoute();renderRoutePoints();
}
function undoRoutePoint(){
  if(!routePoints.length)return;
  routePoints.pop();map.removeLayer(routePointMarkers.pop());invalidateRoute();renderRoutePoints();
}
function clearRoute(){
  routePoints=[];
  routePointMarkers.forEach(marker=>map.removeLayer(marker));
  routePointMarkers=[];invalidateRoute();renderRoutePoints();
}
function distanceKm(a,b){
  const rad=Math.PI/180,p1=a.lat*rad,p2=b.lat*rad;
  const x=Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin((b.lon-a.lon)*rad/2)**2;
  return 12742*Math.asin(Math.sqrt(x));
}
function distanceToSegmentKm(p,a,b){
  const scale=Math.cos(((a.lat+b.lat)/2)*Math.PI/180)*111.2;
  const ax=a.lon*scale,ay=a.lat*111.2,bx=b.lon*scale,by=b.lat*111.2,px=p.lon*scale,py=p.lat*111.2;
  const len=(bx-ax)**2+(by-ay)**2;
  const t=len?Math.max(0,Math.min(1,((px-ax)*(bx-ax)+(py-ay)*(by-ay))/len)):0;
  return Math.hypot(px-(ax+t*(bx-ax)),py-(ay+t*(by-ay)));
}
function watersideWaypoints(points){
  const anchors=[...entrances.map(e=>({name:'한강',lat:e.lat,lon:e.lon})),...streamAnchors];
  const planned=[];let used=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    planned.push(a);
    const direct=distanceKm(a,b);
    if(direct<0.35)continue;
    const ranked=anchors.map(p=>({p,dist:distanceToSegmentKm(p,a,b),extra:distanceKm(a,p)+distanceKm(p,b)-direct}))
      .filter(x=>x.dist<Math.min(0.55,0.18*direct+0.16)&&x.extra<Math.max(0.3,direct*0.3)&&distanceKm(a,x.p)>0.16&&distanceKm(b,x.p)>0.16)
      .sort((x,y)=>x.dist-y.dist || x.extra-y.extra);
    if(ranked.length){planned.push(ranked[0].p);used++;}
  }
  planned.push(points[0]);
  return {locations:planned,anchorsUsed:used};
}
async function requestWalkingRoute(points){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),25000);
  try{
    const response=await fetch('https://valhalla1.openstreetmap.de/route',{
      method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
      body:JSON.stringify({locations:points.map(p=>({lat:p.lat,lon:p.lon})),costing:'pedestrian',shape_format:'polyline6',directions_options:{units:'kilometers'}})
    });
    const data=await response.json();
    if(!response.ok||!data.trip?.legs?.length)throw new Error(data.error||`경로 응답 ${response.status}`);
    return data.trip;
  }finally{clearTimeout(timeout);}
}
function decodePolyline6(encoded){
  const coords=[];let index=0,lat=0,lon=0;
  while(index<encoded.length){
    for(let which=0;which<2;which++){
      let shift=0,result=0,byte;
      do{byte=encoded.charCodeAt(index++)-63;result|=(byte&31)<<shift;shift+=5;}while(byte>=32);
      const delta=(result&1)?~(result>>1):(result>>1);
      if(which===0)lat+=delta;else lon+=delta;
    }
    coords.push([lat/1e6,lon/1e6]);
  }
  return coords;
}
function showRoute(trip,waterUsed,baseKm,anchorsUsed){
  const geometry=trip.legs.flatMap((leg,i)=>{
    const points=decodePolyline6(leg.shape);
    return i?points.slice(1):points;
  });
  routeLine=L.polyline(geometry,{color:'#087d80',weight:6,opacity:.9,className:'route-line'}).addTo(map);
  map.fitBounds(routeLine.getBounds(),{padding:[50,50]});
  const km=trip.summary.length;
  const minutes=Math.round(trip.summary.time/60);
  const detour=waterUsed?Math.round((km-baseKm)*10)/10:0;
  $('routeResult').innerHTML=`<div class="result-kicker">${waterUsed?'〰 수변 경유 코스':'순환 보행 코스'}</div><div class="result-distance">${km.toFixed(2)}<small>km</small></div><div class="result-meta">도보 약 ${minutes}분 · ${routePoints.length}개 지점 순서대로 경유 · 출발점 복귀${waterUsed?`<br>한강·하천 인근 기준점 ${anchorsUsed}곳 경유 · 최단 경로보다 약 ${detour.toFixed(1)}km 추가`:''}</div><div class="result-note">파란 선은 도로망을 따라 계산한 경로입니다. ${waterUsed?'수변 인근을 우선 거치도록 조정했으며 실제 수변길 연결 상태는 현장에서 확인해 주세요.':'가까운 수변 경유점이 없거나 우회가 커서 일반 보행 경로를 표시했습니다.'}</div>`;
  $('routeResult').classList.remove('hidden');
}
async function calculateRoute(){
  if(routePoints.length<3||routeBusy)return;
  routeBusy=true;renderRoutePoints();invalidateRoute();
  $('routeResult').innerHTML='<div class="result-note">보행 경로를 계산하고 있어요…</div>';
  $('routeResult').classList.remove('hidden');
  try{
    const loop=[...routePoints,routePoints[0]];
    const base=await requestWalkingRoute(loop);
    let chosen=base,waterUsed=false,anchorsUsed=0;
    if($('preferWater').checked){
      const water=watersideWaypoints(routePoints);
      if(water.anchorsUsed){
        try{
          const option=await requestWalkingRoute(water.locations);
          if(option.summary.length<=base.summary.length*1.35+0.2){chosen=option;waterUsed=true;anchorsUsed=water.anchorsUsed;}
        }catch(error){console.warn('수변 경유 경로를 사용할 수 없습니다.',error);}
      }
    }
    showRoute(chosen,waterUsed,base.summary.length,anchorsUsed);
  }catch(error){
    $('routeResult').innerHTML='<div class="result-note">보행 경로를 계산하지 못했습니다. 지점을 도보로 갈 수 있는 곳에 다시 찍거나 잠시 후 재시도해 주세요.</div>';
    $('routeResult').classList.remove('hidden');console.error(error);
  }finally{routeBusy=false;renderRoutePoints();}
}
$('routeToggle').addEventListener('click',()=>{routeMode=!routeMode;updateRouteMode();});
$('undoPoint').addEventListener('click',undoRoutePoint);
$('clearRoute').addEventListener('click',clearRoute);
$('calculateRoute').addEventListener('click',calculateRoute);
map.on('click',event=>{if(routeMode)addRoutePoint({lat:event.latlng.lat,lon:event.latlng.lng});});
window.addEventListener('resize',()=>map.invalidateSize());
