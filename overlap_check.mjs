import { TACTICS } from './src/data/tactics.js';

// Coverage pairs (our pos → opp id) are intentionally tight (6-10 units).
// Exclude them from the 8-unit overlap check to avoid false positives.
function isCoveragePair(sceneName, scene, posLabel, oppId) {
  if (sceneName !== 'correctScene') return false;
  const cov = scene.coverage;
  if (!cov) return false;
  return cov[posLabel] === oppId;
}

let violations = [];
TACTICS.forEach(t => {
  ['mistakeScene','correctScene'].forEach(sceneName => {
    const scene = t[sceneName];
    scene.phases.forEach((phase, pi) => {
      const ourPlayers = [];
      const {G,LW,C,RW,LD,RD} = phase.our;
      ourPlayers.push({label:'G',x:G.x,y:G.y,isGoalie:true});
      ourPlayers.push({label:'LW',x:LW.x,y:LW.y});
      ourPlayers.push({label:'C',x:C.x,y:C.y});
      if(RW) ourPlayers.push({label:'RW',x:RW.x,y:RW.y});
      ourPlayers.push({label:'LD',x:LD.x,y:LD.y});
      ourPlayers.push({label:'RD',x:RD.x,y:RD.y});
      const oppPlayers = phase.opp.map(o => ({label:o.label||o.id, id:o.id, x:o.x,y:o.y,isGoalie:o.isGoalie}));
      const allPlayers = [...ourPlayers, ...oppPlayers];

      for(let i=0;i<allPlayers.length;i++){
        for(let j=i+1;j<allPlayers.length;j++){
          const a=allPlayers[i],b=allPlayers[j];
          if(a.isGoalie&&b.isGoalie) continue;
          // Skip assigned coverage pairs in correctScene
          if(isCoveragePair(sceneName, scene, a.label, b.id)) continue;
          if(isCoveragePair(sceneName, scene, b.label, a.id)) continue;
          const dx=a.x-b.x,dy=a.y-b.y;
          const d=Math.sqrt(dx*dx+dy*dy);
          if(d<8){
            violations.push(`${t.id} ${sceneName} ph${pi+1}: ${a.label}(${a.x},${a.y}) <-> ${b.label}(${b.x},${b.y}) = ${d.toFixed(1)}`);
          }
        }
      }
    });
  });
});

console.log(`Violations: ${violations.length}`);
violations.forEach(v=>console.log(' ',v));
