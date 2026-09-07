import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { paletteByCode } from '../core/engine';
import type { Pattern } from '../core/types';

type SceneMode = 'desk' | 'frame' | 'float';
type Props = { pattern: Pattern | null; completed?: number[]; onBack?: () => void };
type CellPoint = { row: number; col: number };

const SCENES: Array<{ key: SceneMode; label: string; hint: string }> = [
  { key: 'desk', label: '工作台', hint: '木桌上的真实成品感' },
  { key: 'frame', label: '相框', hint: '适合预览装裱效果' },
  { key: 'float', label: '纯净', hint: '专注颜色与立体结构' },
];
const MELT_LEVELS = [
  { value: 0, label: '原豆' },
  { value: 0.46, label: '标准熨' },
  { value: 0.82, label: '重熨' },
];

function safeName(name: string) {
  return (name || 'bead-work').replace(/[\\/:*?"<>|]/g, '-');
}

export default function Bead3DPreview({ pattern, completed = [], onBack }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [sceneMode, setSceneMode] = useState<SceneMode>('desk');
  const [melt, setMelt] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [ready, setReady] = useState(false);

  const colorGroups = useMemo(() => {
    const groups = new Map<string, CellPoint[]>();
    if (!pattern) return groups;
    for (let row = 0; row < pattern.height; row += 1) {
      for (let col = 0; col < pattern.width; col += 1) {
        const code = pattern.cells[row * pattern.width + col];
        if (!code) continue;
        const list = groups.get(code) || [];
        list.push({ row, col });
        groups.set(code, list);
      }
    }
    return groups;
  }, [pattern]);

  const stats = useMemo(() => {
    if (!pattern) return { total: 0, colors: 0, progress: 0 };
    const total = [...colorGroups.values()].reduce((sum, list) => sum + list.length, 0);
    const doneSet = new Set(completed);
    let done = 0;
    doneSet.forEach((index) => { if (pattern.cells[index]) done += 1; });
    return { total, colors: colorGroups.size, progress: total ? Math.round((done / total) * 100) : 0 };
  }, [pattern, completed, colorGroups]);

  const usedColors = useMemo(() => {
    return [...colorGroups.entries()]
      .map(([code, cells]) => ({ code, count: cells.length, hex: paletteByCode.get(code)?.hex || '#d8d2c8' }))
      .sort((a, b) => b.count - a.count);
  }, [colorGroups]);

  useEffect(() => {
    if (!pattern || !mountRef.current) return;
    const host = mountRef.current;
    setReady(false);

    const scene = new THREE.Scene();
    const bg = sceneMode === 'float' ? 0xf4f0e9 : sceneMode === 'frame' ? 0xe7dfd4 : 0xd2bea9;
    scene.background = new THREE.Color(bg);
    scene.fog = new THREE.Fog(bg, 48, 170);

    const width = Math.max(1, pattern.width);
    const height = Math.max(1, pattern.height);
    const pitch = 0.66;
    const boardW = width * pitch;
    const boardH = height * pitch;
    const span = Math.max(boardW, boardH, 8);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 360);
    camera.position.set(span * 0.72, span * 0.86, span * 0.92);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
    renderer.domElement.className = 'bead-3d-canvas';
    host.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // Color fidelity comes first here. The previous version used one white material + instanceColor;
    // grouping by actual MARD code makes the material itself carry the real palette color.
    scene.add(new THREE.HemisphereLight(0xfff8ef, 0x5c6470, sceneMode === 'float' ? 1.45 : 1.18));
    const key = new THREE.DirectionalLight(0xfff2df, 2.35);
    key.position.set(-span * 0.45, span * 1.15, span * 0.72);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = span * 4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xb5d5e8, 1.15);
    rim.position.set(span * 0.7, span * 0.72, -span * 0.85);
    scene.add(rim);
    const warm = new THREE.PointLight(0xffb26e, sceneMode === 'desk' ? 8 : 3.5, span * 2.8, 2);
    warm.position.set(-span * 0.72, span * 0.46, span * 0.28);
    scene.add(warm);

    const art = new THREE.Group();
    scene.add(art);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(boardW + 0.62, 0.16, boardH + 0.62),
      new THREE.MeshPhysicalMaterial({
        color: 0xece9e0, roughness: 0.52, metalness: 0,
        transmission: sceneMode === 'float' ? 0.14 : 0.02,
        transparent: true, opacity: sceneMode === 'float' ? 0.72 : 0.96,
        clearcoat: 0.22, clearcoatRoughness: 0.48,
      }),
    );
    board.position.y = 0.08;
    board.receiveShadow = true;
    art.add(board);

    const beadGeometry = new THREE.TorusGeometry(0.205, 0.105, 6, 12);
    beadGeometry.rotateX(Math.PI / 2);
    const fusionGeometry = new THREE.CylinderGeometry(0.275, 0.275, 0.035, 12);
    const dummy = new THREE.Object3D();
    const scaleXZ = 1 + melt * 0.075;
    const scaleY = 1 - melt * 0.43;
    const beadY = 0.31 - melt * 0.035;

    for (const [code, cells] of colorGroups.entries()) {
      const hex = paletteByCode.get(code)?.hex || '#d8d2c8';
      const beadMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex), roughness: 0.5, metalness: 0,
      });
      const beads = new THREE.InstancedMesh(beadGeometry, beadMaterial, cells.length);
      beads.castShadow = stats.total <= 12000;
      beads.receiveShadow = true;
      beads.instanceMatrix.setUsage(THREE.StaticDrawUsage);

      cells.forEach(({ row, col }, i) => {
        dummy.position.set((col - (width - 1) / 2) * pitch, beadY, (row - (height - 1) / 2) * pitch);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(scaleXZ, scaleY, scaleXZ);
        dummy.updateMatrix();
        beads.setMatrixAt(i, dummy.matrix);
      });
      beads.instanceMatrix.needsUpdate = true;
      art.add(beads);

      if (melt > 0.05) {
        const fusionMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(hex), roughness: 0.58, metalness: 0,
          transparent: true, opacity: Math.min(0.6, 0.18 + melt * 0.42),
        });
        const fusion = new THREE.InstancedMesh(fusionGeometry, fusionMaterial, cells.length);
        cells.forEach(({ row, col }, i) => {
          dummy.position.set((col - (width - 1) / 2) * pitch, 0.185, (row - (height - 1) / 2) * pitch);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(0.88 + melt * 0.2, 1, 0.88 + melt * 0.2);
          dummy.updateMatrix();
          fusion.setMatrixAt(i, dummy.matrix);
        });
        fusion.instanceMatrix.needsUpdate = true;
        fusion.castShadow = false;
        fusion.receiveShadow = true;
        art.add(fusion);
      }
    }

    if (sceneMode === 'desk') {
      const table = new THREE.Mesh(new THREE.BoxGeometry(span * 2.4, 0.72, span * 1.9), new THREE.MeshStandardMaterial({ color: 0x76513b, roughness: 0.82 }));
      table.position.y = -0.45;
      table.receiveShadow = true;
      scene.add(table);
      const looseGeo = new THREE.TorusGeometry(0.205, 0.105, 6, 12);
      looseGeo.rotateX(Math.PI / 2);
      const sampleColors = usedColors.slice(0, 9);
      sampleColors.forEach((entry, i) => {
        const loose = new THREE.Mesh(looseGeo, new THREE.MeshStandardMaterial({ color: entry.hex, roughness: 0.5 }));
        const a = (i / Math.max(1, sampleColors.length)) * Math.PI * 1.1 - 0.45;
        loose.position.set(boardW * 0.62 + Math.cos(a) * (0.8 + (i % 3) * 0.28), 0.14, boardH * 0.18 + Math.sin(a) * 1.15);
        loose.rotation.y = i * 0.9;
        loose.castShadow = true;
        scene.add(loose);
      });
    }

    if (sceneMode === 'frame') {
      const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x4d3327, roughness: 0.55 });
      const frame = new THREE.Group();
      const t = 0.72, h = 0.46;
      const top = new THREE.Mesh(new THREE.BoxGeometry(boardW + t * 2, h, t), frameMaterial);
      const bottom = top.clone();
      const left = new THREE.Mesh(new THREE.BoxGeometry(t, h, boardH + t * 2), frameMaterial);
      const right = left.clone();
      top.position.set(0, 0.18, -(boardH + t) / 2);
      bottom.position.set(0, 0.18, (boardH + t) / 2);
      left.position.set(-(boardW + t) / 2, 0.18, 0);
      right.position.set((boardW + t) / 2, 0.18, 0);
      frame.add(top, bottom, left, right);
      frame.traverse((obj) => { if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      scene.add(frame);
    }

    if (sceneMode === 'float') {
      art.rotation.x = -0.08;
      const halo = new THREE.Mesh(new THREE.CircleGeometry(span * 0.72, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.34, depthWrite: false }));
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -0.12;
      scene.add(halo);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.target.set(0, 0.05, 0);
    controls.minDistance = span * 0.52;
    controls.maxDistance = span * 2.6;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minPolarAngle = Math.PI * 0.14;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.55;

    let lastTouch = performance.now();
    const stopAuto = () => { lastTouch = performance.now(); controls.autoRotate = false; };
    controls.addEventListener('start', stopAuto);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const clock = new THREE.Clock();
    let frameId = 0;
    let firstFrame = true;
    const render = () => {
      frameId = requestAnimationFrame(render);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (autoRotate && performance.now() - lastTouch > 3200) controls.autoRotate = true;
      if (sceneMode === 'float') art.position.y = Math.sin(performance.now() * 0.00065) * 0.08;
      controls.update(dt);
      renderer.render(scene, camera);
      if (firstFrame) { firstFrame = false; setReady(true); }
    };
    render();

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.InstancedMesh)) return;
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material?.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [pattern, melt, sceneMode, autoRotate, stats.total, colorGroups, usedColors]);

  function capture() {
    const renderer = rendererRef.current;
    if (!renderer || !pattern) return;
    const link = document.createElement('a');
    link.download = `${safeName(pattern.name)}-3d-preview.png`;
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
  }

  if (!pattern) return (
    <section className="preview-empty card">
      <div className="preview-empty-orb"><span /></div>
      <div><span className="section-kicker">3D PREVIEW</span><h2>先生成一张图纸，再把它“拿起来”看看。</h2><p>3D 预览会按真实色号把每颗豆子立起来，并提供原豆、熨烫和展示场景预览。</p>{onBack && <button className="primary" onClick={onBack}>回到设计页</button>}</div>
    </section>
  );

  return (
    <section className="preview-shell">
      <div className="preview-stage card">
        <div className="preview-stage-head">
          <div><span className="section-kicker">LIVE 3D · THREE.JS</span><h2>{pattern.name}</h2><p>{pattern.width}×{pattern.height} · {stats.total.toLocaleString()} 颗 · {stats.colors} 色</p></div>
          <div className="preview-head-actions">{onBack && <button onClick={onBack}>← 返回设计</button>}<button className="primary" onClick={capture}>保存展示图</button></div>
        </div>
        <div className="preview-canvas-wrap">
          <div ref={mountRef} className={`preview-canvas-host ${ready ? 'ready' : ''}`} />
          {!ready && <div className="preview-loading"><i /><span>正在摆放 {stats.total.toLocaleString()} 颗豆…</span></div>}
          <div className="preview-float-tip">拖动旋转 · 双指/滚轮缩放</div>
        </div>
      </div>

      <aside className="preview-controls card">
        <div className="preview-control-head"><span className="section-kicker">FINISH LAB</span><h3>成品模拟器</h3><p>先看成品，再决定怎么熨、怎么展示。</p></div>
        <div className="preview-metrics"><div><strong>{stats.total.toLocaleString()}</strong><span>颗豆</span></div><div><strong>{stats.colors}</strong><span>颜色</span></div><div><strong>{stats.progress}%</strong><span>施工</span></div></div>

        <div className="preview-control-section">
          <label>当前图纸色板</label>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:6,marginTop:8,maxHeight:170,overflow:'auto'}}>
            {usedColors.map((item) => <div key={item.code} title={`${item.code} · ${item.count}颗 · ${item.hex}`} style={{display:'grid',gridTemplateColumns:'24px 1fr',gap:7,alignItems:'center',padding:'6px 7px',border:'1px solid var(--line)',borderRadius:9,background:'rgba(255,255,255,.55)'}}><i style={{width:24,height:24,borderRadius:7,background:item.hex,border:'1px solid rgba(0,0,0,.12)',boxShadow:'inset 0 1px rgba(255,255,255,.45)'}}/><span style={{display:'grid',fontSize:10,lineHeight:1.15}}><b>{item.code}</b><small style={{color:'var(--muted)'}}>{item.count}颗</small></span></div>)}
          </div>
        </div>

        <div className="preview-control-section"><label>熨烫状态</label><div className="segmented-control three">{MELT_LEVELS.map((item) => <button key={item.label} className={Math.abs(melt-item.value)<0.01?'active':''} onClick={() => setMelt(item.value)}>{item.label}</button>)}</div><p className="preview-note">每个 MARD 色号现在使用独立材质，熨烫层也保持原色，不再用白色材质叠 instanceColor。</p></div>
        <div className="preview-control-section"><label>展示场景</label><div className="preview-scene-list">{SCENES.map((item) => <button key={item.key} className={sceneMode===item.key?'active':''} onClick={() => setSceneMode(item.key)}><span>{item.label}</span><small>{item.hint}</small></button>)}</div></div>
        <label className="preview-switch"><span><b>闲置自动旋转</b><small>适合录屏和展示成品</small></span><input type="checkbox" checked={autoRotate} onChange={(event)=>setAutoRotate(event.target.checked)}/><i/></label>
        <div className="preview-next"><b>下一步可以继续做</b><span>完工时最后一颗豆落下 → 熨烫动画 → 自动生成分享视频。</span></div>
      </aside>
    </section>
  );
}
