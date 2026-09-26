import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import fengari from 'fengari';
import {parseSavedVariables,Assembler} from '../scripts/protocol.mjs';
const addon=new URL('../../WebExport.lua',import.meta.url);
const {lua,lauxlib,lualib,to_luastring,to_jsstring}=fengari;
function run(L,code){if(lauxlib.luaL_dostring(L,to_luastring(code))!==lua.LUA_OK)throw new Error(to_jsstring(lua.lua_tostring(L,-1)));}
function global(L,name){lua.lua_getglobal(L,to_luastring(name));const value=to_jsstring(lua.lua_tostring(L,-1));lua.lua_pop(L,1);return value;}
test('actual Lua exporter round trips snapshots and RGB packets through companion decoder',{skip:!existsSync(addon)},()=>{
  const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L);
  run(L,`UIParent={GetEffectiveScale=function()return 1 end}
  function CreateFrame()
    local f={cells={}}
    function f:RegisterEvent()end
    function f:SetScript(event,fn) self[event]=fn end
    function f:SetSize()end
    function f:SetPoint()end
    function f:ClearAllPoints()end
    function f:SetScale()end
    function f:SetFrameStrata()end
    function f:SetAlpha()end
    function f:EnableMouse()end
    function f:Hide()self.shown=false end
    function f:Show()self.shown=true end
    function f:IsShown()return self.shown end
    function f:CreateTexture()
      local t={SetSize=function()end,SetPoint=function()end}
      function t:SetColorTexture(r,g,b) self.rgb={r,g,b} end
      return t
    end
    LAST_FRAME=f;return f
  end
  C_Timer={NewTicker=function(_,fn)TICK=fn;return {Cancel=function()end}end}
  function GetServerTime()return 1790448000 end
  Overlord={L={},IsInitialized=true,PrintNotification=function(_,msg)LAST_MESSAGE=msg end,
    IsLoginZoneDisplayPending=function(_,zone)return zone.pending end}
  OverlordDB={config={},campaignId=42,lastResetTimestamp=1790000000,frontActivity={arathi=1790447970},history={}}
  local front={id='arathi',mapName='Arathi',preferredMapID=1417,zones={
    {id='a',name='Quoted " \\n Unicode Éowyn',center={25.38,58.36},status='in_progress',owner='Horde',previousOwner='Alliance',isCapital=true},
    {id='b',name='Pending',status='captured',owner='Horde',pending=true},
    {id='c',name='Neutral',status='available'}}}
  Overlord.Fronts={Order={'arathi'},GetFront=function()return front end}
  Overlord.Sync={GetCaptureContributorDedupKey=function(_,name)return name:match('^[^-]+')end}
  Overlord.Leaderboard={captureCount={},MergeNameCountRowsForDisplay=function()return {{name='Alice',count=4}}end,
    GetSortedKills=function()return {{name='Alice-Realm',kills=9}}end,
    GetExportPlayerMeta=function()return 'MAGE','Alliance'end,GetExportPlayerGuild=function()return 'Test'end}
  SlashCmdList={}
  `);
  run(L,readFileSync(addon,'utf8'));
  run(L,readFileSync(new URL('../../Commands.lua',import.meta.url),'utf8'));
  run(L,`SlashCmdList.OVERLORD('web on'); assert(OverlordDB.config.webExportEnabled); assert(OverlordWebSnapshot)`);
  const report=parseSavedVariables(`OverlordWebSnapshot = "${global(L,'OverlordWebSnapshot')}"`);
  assert.equal(report.fronts[0].zones[0].owner,'Alliance');assert.equal(report.fronts[0].zones[0].attacker,'Horde');assert.equal(report.fronts[0].zones[1].status,'unconfirmed');assert.equal(report.fronts[0].zones[2].status,'neutral');assert.equal(report.players[0].captures,4);assert.deepEqual(report.history,[]);
  assert.equal(report.fronts[0].mapId,1417);assert.deepEqual(report.fronts[0].zones[0].position,{x:2538,y:5836});assert.equal(report.fronts[0].zones[1].position,undefined);
  run(L,`SlashCmdList.OVERLORD('web live')`);
  const assembler=new Assembler();let decoded=null;
  for(let i=0;i<20&&!decoded;i++){
    run(L,`PACKET_HEX='';local byte,bits=0,0;for _,cell in ipairs(LAST_FRAME.cells)do for _,v in ipairs(cell.rgb)do byte=byte*2+v;bits=bits+1;if bits==8 then PACKET_HEX=PACKET_HEX..string.format('%02x',byte);byte,bits=0,0 end end end`);
    decoded=assembler.accept(Buffer.from(global(L,'PACKET_HEX'),'hex'));
    if(!decoded)run(L,'TICK()');
  }
  assert.ok(decoded,'Lua rendered pixels decode into a complete report');assert.equal(decoded.mode,'live');assert.equal(decoded.players[0].name,'Alice-Realm');
  run(L,`Overlord.InstanceSuspended=true;SlashCmdList.OVERLORD('web stop');assert(not LAST_FRAME:IsShown());SlashCmdList.OVERLORD('web off');assert(OverlordWebSnapshot==nil)`);
});
