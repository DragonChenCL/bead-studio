const E = require('../.tmp-core-test/engine.js');
const I = require('../.tmp-core-test/inventory.js');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(E.palette.length === 221, `palette expected 221, got ${E.palette.length}`);

const pattern = { id:'t1', name:'test', width: 4, height: 2, cells: ['A1','A1','A1','A1','C4','C4','F5','F5'] };
const inventory = { A1: 2, A2: 2, C4: 1, C5: 1, F5: 1, F4: 1 };
const optimized = E.optimizeToInventory(pattern, inventory);
assert(optimized.ok, 'optimizer should find zero-purchase solution');
for (const row of E.summarizeUsage(optimized.pattern.cells)) {
  assert(row.count <= (inventory[row.code] || 0), `${row.code} exceeds inventory`);
}

const sufficient = { A1:4, C4:2, F5:2, H7:10 };
const settled = I.deductPatternFromInventory(pattern, sufficient);
assert(settled.ok, 'inventory settlement should succeed');
assert(settled.deducted === 8, 'inventory settlement count mismatch');
assert(settled.inventory.A1 === 0 && settled.inventory.C4 === 0 && settled.inventory.F5 === 0, 'inventory not deducted correctly');
const restored = I.restorePatternToInventory(pattern, settled.inventory);
assert(restored.A1 === 4 && restored.C4 === 2 && restored.F5 === 2, 'inventory restore mismatch');
const shortage = I.deductPatternFromInventory(pattern, { A1: 1 });
assert(!shortage.ok && shortage.shortages.length >= 1, 'shortage should block settlement');

const W=40,H=40; const data=new Uint8ClampedArray(W*H*4);
const codes=['A1','C4','F5','H7'];
for(let y=0;y<H;y++) for(let x=0;x<W;x++){
  const cellX=x>=20?1:0, cellY=y>=20?1:0;
  const code=codes[cellY*2+cellX], c=E.paletteByCode.get(code).rgb;
  const cx=cellX*20+10, cy=cellY*20+10;
  const dx=x-cx, dy=y-cy;
  const centerHole=dx*dx+dy*dy<=9;
  const rgb=centerHole?[255,255,255]:c;
  const i=(y*W+x)*4;
  data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];data[i+3]=255;
}
const rect=E.rectifyImageData({data,width:W,height:H},[{x:0,y:0},{x:39,y:0},{x:39,y:39},{x:0,y:39}],40,40);
const inspect=E.inspectPatternPhoto({width:2,height:2,cells:codes},rect,{deltaEThreshold:5});
assert(inspect.correct === 4 && inspect.wrong === 0 && inspect.missing === 0, `photo inspection failed: ${JSON.stringify({correct:inspect.correct,wrong:inspect.wrong,missing:inspect.missing})}`);

console.log('PASS core', {
  palette: E.palette.length,
  optimizerChanged: optimized.changed,
  settled: settled.deducted,
  photoCorrect: inspect.correct,
});
