import { atlas, objectiveState, objectiveDescription, objectivePoint } from './map-data.js';
const $ = id => document.getElementById(id);
const el = (tag, text, cls) => {const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
const bounds = [[0,0],[668,1022]];
// Simple vector UI symbols; geography uses the original zone map art.
const shapes = {
  capital: '<path d="M4 28V11h5V6h5v5h4V6h5v5h5v17H4zm9 0v-8h6v8M4 15h24"/>',
  banner: '<path d="M8 29V3m1 1h17l-4 6 4 6H9M4 29h9"/>',
  battle: '<path d="m6 4 20 23m-6-3 5-5M3 25l7-7m-5 10 3-3M26 4 6 27m6-3-5-5m22 6-7-7m5 10-3-3"/>',
};
function icon(symbol,state) {
  const node=el('span',null,`map-symbol ${state}`);
  node.innerHTML=`<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${shapes[symbol]}</svg>`;
  return node;
}
export class BattleMap {
  constructor(onFront) {
    this.onFront=onFront;this.scope='world';this.report=null;this.markers=new Map();this.selectedZone=null;
    this.filters={alliance:true,horde:true,contested:true,unknown:true};this.showLabels=true;
    $('map-world').addEventListener('click',()=>this.open('world'));
    $('map-region').addEventListener('change',event=>this.open(event.target.value));
    $('map-reset').addEventListener('click',()=>this.map && this.fit());
    $('map-labels').addEventListener('change',event=>{this.showLabels=event.target.checked;this.draw();});
    for(const input of document.querySelectorAll('[data-map-filter]')) input.addEventListener('change',()=>{this.filters[input.dataset.mapFilter]=input.checked;this.draw();});
  }
  initialize() {
    if(this.map)return true;
    if(!window.L){$('map-message').textContent='Map library unavailable. The objective reports below are still available.';return false;}
    this.map=L.map('battle-map',{crs:L.CRS.Simple,minZoom:-3,maxZoom:2,zoomSnap:0.25,zoomDelta:0.5,scrollWheelZoom:false,maxBounds:[[-180,-250],[848,1272]],maxBoundsViscosity:0.8});
    this.map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    this.map.attributionControl.addAttribution('Map art © Blizzard · <a href="https://www.wowhead.com/classic/maps">Wowhead</a>');
    this.pins=L.layerGroup().addTo(this.map);
    this.map.on('zoomend',()=>{$('map-zoom').textContent=`${Math.round(100*2**this.map.getZoom())}%`;});
    this.map.on('popupclose',()=>{this.selectedZone=null;});
    new ResizeObserver(()=>{this.map.invalidateSize({pan:false});}).observe($('battle-map'));
    this.setImage();return true;
  }
  fit(){this.map.invalidateSize({pan:false});this.map.fitBounds(bounds,{padding:[12,12],animate:false});}
  setImage(){
    if(this.background)this.map.removeLayer(this.background);
    $('map-image-error').hidden=true;
    $('map-image-error').textContent='Map artwork could not load. Objective positions are still available.';
    const supported=this.scope==='world'||Boolean(atlas[this.scope]);
    if(supported){
      this.background=L.imageOverlay(`./maps/${this.scope}.jpg`,bounds,{alt:this.scope==='world'?'Azeroth world map':atlas[this.scope].name+' zone map'}).addTo(this.map);
      this.background.on('error',()=>{$('map-image-error').hidden=false;});
    }else{this.background=null;$('map-image-error').textContent='No map artwork is configured for this front. Use the objective list below.';$('map-image-error').hidden=false;}
    this.fit();
  }
  update(report){
    this.report=report;
    if(this.scope!=='world'&&!report.fronts.some(f=>f.id===this.scope))this.scope='world';
    const previous=$('map-region').value;
    $('map-region').replaceChildren(new Option('Azeroth overview','world'));
    for(const f of report.fronts)$('map-region').add(new Option(f.name,f.id));
    $('map-region').value=this.scope;
    if(!this.initialize())return;
    if(previous!==this.scope)this.setImage();
    this.draw();
  }
  open(scope){
    if(!this.report)return;
    if(scope!=='world'&&!this.report.fronts.some(f=>f.id===scope))return;
    const changed=this.scope!==scope;this.scope=scope;this.selectedZone=null;$('map-region').value=scope;
    if(!this.initialize())return;
    if(changed)this.setImage();
    if(scope!=='world')this.onFront(scope);
    this.draw();
  }
  focusObjective(frontId,zoneId){
    if(this.scope!==frontId)this.open(frontId);
    const zone=this.report?.fronts.find(f=>f.id===frontId)?.zones.find(z=>z.id===zoneId);
    if(zone&&!this.filters[objectiveState(zone)]){
      this.filters[objectiveState(zone)]=true;
      document.querySelector(`[data-map-filter="${objectiveState(zone)}"]`).checked=true;this.draw();
    }
    const marker=this.markers.get(zoneId);if(!marker)return;
    this.map.panTo(marker.getLatLng());marker.openPopup();this.selectedZone=zoneId;
    $('battle-map').scrollIntoView({behavior:'smooth',block:'center'});
  }
  draw(){
    if(!this.map||!this.report)return;
    const focused=document.activeElement?.dataset?.zoneId;
    const focusedFront=document.activeElement?.dataset?.frontId;
    const selected=this.selectedZone;
    this.pins.clearLayers();this.markers.clear();
    const world=this.scope==='world';const front=this.report.fronts.find(f=>f.id===this.scope);
    $('map-title').textContent=world?'Azeroth':(front?.name||'Warfront');
    $('map-world').disabled=world;
    $('map-filters').hidden=world;
    $('map-message').textContent=world?'Select a front to inspect its objectives. World pins mark approximate front locations.':'Drag to pan · Use + / − or pinch to zoom · Select a banner or capital for details.';
    let plotted=0,missing=0;
    if(world){
      for(const f of this.report.fronts){
        const config=atlas[f.id];if(!config){missing++;continue;}
        const contested=f.zones.filter(z=>z.status==='contested').length;
        const node=icon(contested?'battle':'banner',contested?'contested':'world');
        const label=el('span',f.name,`world-pin-label${['hillsbrad','elwynn','ashenvale'].includes(f.id)?' label-left':''}`);if(this.showLabels)node.append(label);
        const marker=L.marker(objectivePoint({x:config.point[0]*100,y:config.point[1]*100}),{icon:L.divIcon({html:node,className:'war-map-pin',iconSize:[38,38],iconAnchor:[19,19]}),title:`${f.name} · ${contested} contested objectives`,alt:f.name,keyboard:true}).addTo(this.pins);
        marker.on('click',()=>this.open(f.id));marker.getElement().dataset.frontId=f.id;
        if(f.id===focusedFront)marker.getElement().focus({preventScroll:true});plotted++;
      }
      $('map-count').textContent=`${plotted} fronts${missing?` · ${missing} without map locations`:''}`;
    }else if(front){
      for(const z of front.zones){
        if(!z.position){missing++;continue;}
        const state=objectiveState(z);if(!this.filters[state])continue;
        const node=icon(z.status==='contested'?'battle':z.capital?'capital':'banner',state);
        const marker=L.marker(objectivePoint(z.position),{icon:L.divIcon({html:node,className:'war-map-pin',iconSize:[38,38],iconAnchor:[19,19]}),title:`${z.name} · ${objectiveDescription(z)}`,alt:z.name,keyboard:true,riseOnHover:true}).addTo(this.pins);
        if(this.showLabels)marker.bindTooltip(el('span',z.name),{permanent:true,direction:'bottom',offset:[0,18],className:'objective-label'});
        const popup=el('div',null,'objective-popup');popup.append(el('span',z.capital?'CAPITAL':'OBJECTIVE','eyebrow'),el('h3',z.name),el('p',objectiveDescription(z)),el('p',`Map coordinates: ${(z.position.x/100).toFixed(2)}, ${(z.position.y/100).toFixed(2)}`,'subtle'));
        const time=z.updatedAt||z.capturedAt;
        if(time)popup.append(el('p',`Objective updated ${new Date(time*1000).toLocaleString()}`,'subtle'));
        popup.append(el('p',`Report observed ${new Date(this.report.generatedAt*1000).toLocaleString()}`,'subtle'));
        marker.bindPopup(popup,{maxWidth:320});marker.on('popupopen',()=>{this.selectedZone=z.id;});
        marker.getElement().dataset.zoneId=z.id;
        this.markers.set(z.id,marker);plotted++;
      }
      $('map-count').textContent=`${plotted} / ${front.zones.length} objectives shown${missing?` · ${missing} missing coordinates`:''}`;
      if(missing)$('map-message').textContent+=' Some objectives need a report from the updated addon before they can be placed.';
      if(selected&&this.markers.has(selected)){this.markers.get(selected).openPopup();this.selectedZone=selected;}
      if(focused&&this.markers.has(focused))this.markers.get(focused).getElement().focus({preventScroll:true});
    }
  }
  setStatus(label,stale){$('map-feed-status').textContent=label;$('battle-map').classList.toggle('feed-stale',stale);}
}
