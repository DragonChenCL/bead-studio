import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { paletteByCode } from '../core/engine';
import type { Pattern } from '../core/types';

type SceneMode = 'desk' | 'frame' | 'float';
type ViewMode = 'finish' | 'build' | 'explode';
type Props = { pattern: Pattern | null; completed?: number[]; onBack?: () => void };
type CellPoint = { row: number; col: number; index: number };
type HoverInfo = { code: string; row: number; col: number; done: boolean } | null;

const SCENES: Array<{ key: SceneMode; label: string; hint: string }> = [
  { key: 'desk', label: '工作台', hint: '像真实底板一样平放在桌面' },
  { key: 'frame', label: '相框', hint: '把成品立起来看装裱效果' },
  { key: 'float', label: '悬浮', hint: '去掉环境，专注结构与厚度' },
];

const VIEWS: Array<{ key: ViewMode; label: string; hint: string }> = [
  { key: 'finish', label: '成品', hint: '看熨烫后的立体成品' },
  { key: 'build', label: '施工', hint: '已完成实体，未完成半透明' },
  { key: 'explode', label: '爆炸图', hint: '底板 / 插针 / 拼豆三层拆开' },
];

const MELT_LEVELS = [
  { value: 0, label: '原豆' },
  { value: 0.48, label: '标准熨' },
  { value: 0.82, label: '重熨' },
];

function safeName(name: string) {
  return (name || 'bead-work').replace(/[\\/:*?"<>|]/g, '-');
}

function createBeadGeometry(melt: number) {
  const outer = 0.238 + melt * 0.022;
  const inner = Math.max(0.035, 0.105 * (1 - melt * 0.72));
  const height = 0.42 * (1 - melt * 0.62);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.018 + melt * 0.01,
    bevelThickness: 0.018,
    curveSegments: 12,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return { geometry, height };
}

export default function Bead3DPreview({ pattern, completed = [], onBack }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [sceneMode, setSceneMode] = useState<SceneMode>('desk');
  const [viewMode, setViewMode] = useState<ViewMode>('finish');
  const [melt, setMelt] = useState(0.48);
  const [autoRotate, setAutoRotate] = useState(true);
  const [ready, setReady] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo>(null);

  const completedSet = useMemo(() => new Set(completed), [completed]);

  const colorGroups = useMemo(() => {
    const groups = new Map<string, CellPoint[]>();
    if (!pattern) return groups;
    for (let row = 0; row < pattern.height; row += 1) {
      for (let col = 0; col < pattern.width; col += 1) {
        const index = row * pattern.width + col;
        const code = pattern.cells[index];
        if (!code) continue;
        const list = groups.get(code) || [];
        list.push({ row, col, index });
        groups.set(code, list);
      }
    }
    return groups;
  }, [pattern]);

  const stats = useMemo(() => {
    if (!pattern) return { total: 0, colors: 0, progress: 0, done: 0 };
    const total = [...colorGroups.values()].reduce((sum, list) => sum + list.length, 0);
    let done = 0;
    completedSet.forEach((index) => { if (pattern.cells[index]) done += 1; });
    return { total, colors: colorGroups.size, done, progress: total ? Math.round((done / total) * 100) : 0 };
  }, [pattern, completedSet, colorGroups]);

  const usedColors = useMemo(() => {
    return [...colorGroups.entries()]
      .map(([code, cells]) => ({ code, count: cells.length, hex: paletteByCode.get(code)?.hex || '#d8d2c8' }))
      .sort((a, b) => b.count - a.count);
  }, [colorGroups]);

  useEffect(() => {
    if (!pattern || !mountRef.current) return;
    const host = mountRef.current;
    setReady(false);
    setHoverInfo(null);

    const scene = new THREE.Scene();
    const bg = sceneMode === 'float' ? 0xf3eee8 : sceneMode === 'frame' ? 0xe7ddd2 : 0xd0bba5;
    scene.background = new THREE.Color(bg);
    scene.fog = new THREE.Fog(bg, 45, 190);

    const width = Math.max(1, pattern.width);
    const height = Math.max(1, pattern.height);
    const pitch = 0.62;
    const boardW = width * pitch;
    const boardH = height * pitch;
    const span = Math.max(boardW, boardH, 8);
    const boardThickness = 0.16;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 420);
    if (sceneMode === 'frame') camera.position.set(span * 0.08, span * 0.05, span * 1.48);
    else if (sceneMode === 'float') camera.position.set(span * 0.82, span * 0.72, span * 1.02);
    else camera.position.set(span * 0.72, span * 0.84, span * 0.9);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
    renderer.domElement.className = 'bead-3d-canvas';
    host.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.HemisphereLight(0xfff8ef, 0x58616d, sceneMode === 'float' ? 1.35 : 1.05));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.55);
    key.position.set(-span * 0.45, span * 1.18, span * 0.75);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = span * 4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xb7d6e9, 1.35);
    rim.position.set(span * 0.75, span * 0.72, -span * 0.86);
    scene.add(rim);
    const warm = new THREE.PointLight(0xffb16a, sceneMode === 'desk' ? 8 : 3.2, span * 2.8, 2);
    warm.position.set(-span * 0.72, span * 0.5, span * 0.28);
    scene.add(warm);

    const presentation = new THREE.Group();
    scene.add(presentation);
    if (sceneMode === 'frame') presentation.rotation.x = -Math.PI / 2;
    if (sceneMode === 'float') presentation.rotation.x = -0.42;

    const layerBoard = new THREE.Group();
    const layerPegs = new THREE.Group();
    const layerBeads = new THREE.Group();
    presentation.add(layerBoard, layerPegs, layerBeads);

    if (viewMode === 'explode') {
      layerBoard.position.y = -0.92;
      layerPegs.position.y = -0.2;
      layerBeads.position.y = 0.82;
    }

    const showBoard = viewMode !== 'finish' || sceneMode === 'desk';
    if (showBoard) {
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(boardW + 0.62, boardThickness, boardH + 0.62),
        new THREE.MeshPhysicalMaterial({
          color: 0xeae7df,
          roughness: 0.46,
          metalness: 0,
          transmission: viewMode === 'explode' ? 0.22 : 0.08,
          transparent: true,
          opacity: viewMode === 'explode' ? 0.78 : 0.95,
          clearcoat: 0.24,
          clearcoatRoughness: 0.42,
        }),
      );
      board.position.y = -boardThickness / 2;
      board.receiveShadow = true;
      layerBoard.add(board);

      const pegCellCount = width * height;
      const renderAllPegs = pegCellCount <= 18000;
      const pegPoints: CellPoint[] = [];
      if (renderAllPegs) {
        for (let row = 0; row < height; row += 1) {
          for (let col = 0; col < width; col += 1) pegPoints.push({ row, col, index: row * width + col });
        }
      } else {
        colorGroups.forEach((cells) => pegPoints.push(...cells));
      }

      const pegGeo = new THREE.CylinderGeometry(0.068, 0.075, 0.19, 8);
      const pegMat = new THREE.MeshStandardMaterial({ color: 0xd9d7d0, roughness: 0.5, transparent: true, opacity: 0.9 });
      const pegs = new THREE.InstancedMesh(pegGeo, pegMat, Math.max(1, pegPoints.length));
      const dummy = new THREE.Object3D();
      pegPoints.forEach((cell, i) => {
        dummy.position.set((cell.col - (width - 1) / 2) * pitch, 0.095, (cell.row - (height - 1) / 2) * pitch);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        pegs.setMatrixAt(i, dummy.matrix);
      });
      pegs.instanceMatrix.needsUpdate = true;
      pegs.castShadow = false;
      pegs.receiveShadow = true;
      layerPegs.add(pegs);
    }

    const { geometry: beadGeometry, height: beadHeight } = createBeadGeometry(melt);
    const dummy = new THREE.Object3D();
    const beadMeshes: THREE.InstancedMesh[] = [];

    const createGroupMesh = (code: string, cells: CellPoint[], ghost: boolean) => {
      if (!cells.length) return;
      const hex = paletteByCode.get(code)?.hex || '#d8d2c8';
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        roughness: ghost ? 0.58 : 0.42,
        metalness: 0,
        transparent: ghost,
        opacity: ghost ? 0.2 : 1,
        depthWrite: !ghost,
        emissive: ghost ? new THREE.Color(hex).multiplyScalar(0.08) : new THREE.Color(0x000000),
      });
      const mesh = new THREE.InstancedMesh(beadGeometry, material, cells.length);
      mesh.castShadow = !ghost && stats.total <= 12000;
      mesh.receiveShadow = true;
      mesh.userData.code = code;
      mesh.userData.cells = cells;
      mesh.userData.ghost = ghost;
      cells.forEach((cell, i) => {
        const lift = viewMode === 'build' && ghost ? 0.08 : 0;
        dummy.position.set((cell.col - (width - 1) / 2) * pitch, 0.2 + lift, (cell.row - (height - 1) / 2) * pitch);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      layerBeads.add(mesh);
      beadMeshes.push(mesh);
    };

    for (const [code, cells] of colorGroups.entries()) {
      if (viewMode !== 'build') {
        createGroupMesh(code, cells, false);
        continue;
      }
      const doneCells = cells.filter((cell) => completedSet.has(cell.index));
      const pendingCells = cells.filter((cell) => !completedSet.has(cell.index));
      createGroupMesh(code, doneCells, false);
      createGroupMesh(code, pendingCells, true);
    }

    if (viewMode === 'finish' && melt > 0.16) {
      const seamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.055, depthWrite: false });
      const seam = new THREE.Mesh(new THREE.PlaneGeometry(boardW, boardH), seamMat);
      seam.rotation.x = -Math.PI / 2;
      seam.position.y = 0.19 + beadHeight * 0.06;
      layerBeads.add(seam);
    }

    if (sceneMode === 'desk') {
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(span * 2.45, 0.72, span * 1.92),
        new THREE.MeshStandardMaterial({ color: 0x76513b, roughness: 0.82 }),
      );
      table.position.y = -1.15;
      table.receiveShadow = true;
      scene.add(table);

      const looseGeo = createBeadGeometry(0).geometry;
      usedColors.slice(0, 8).forEach((entry, i) => {
        const loose = new THREE.Mesh(looseGeo, new THREE.MeshStandardMaterial({ color: entry.hex, roughness: 0.46 }));
        const a = (i / 8) * Math.PI * 1.1 - 0.45;
        loose.position.set(boardW * 0.62 + Math.cos(a) * (0.8 + (i % 3) * 0.28), -0.76, boardH * 0.18 + Math.sin(a) * 1.15);
        loose.rotation.y = i * 0.9;
        loose.castShadow = true;
        scene.add(loose);
      });
    }

    if (sceneMode === 'frame') {
      const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x4d3327, roughness: 0.55 });
      const frame = new THREE.Group();
      const t = 0.72;
      const h = 0.44;
      const top = new THREE.Mesh(new THREE.BoxGeometry(boardW + t * 2, h, t), frameMaterial);
      const bottom = top.clone();
      const left = new THREE.Mesh(new THREE.BoxGeometry(t, h, boardH + t * 2), frameMaterial);
      const right = left.clone();
      top.position.set(0, -0.02, -(boardH + t) / 2);
      bottom.position.set(0, -0.02, (boardH + t) / 2);
      left.position.set(-(boardW + t) / 2, -0.02, 0);
      right.position.set((boardW + t) / 2, -0.02, 0);
      frame.add(top, bottom, left, right);
      frame.traverse((obj) => { if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      presentation.add(frame);

      const wall = new THREE.Mesh(new THREE.PlaneGeometry(span * 2.4, span * 1.9), new THREE.MeshStandardMaterial({ color: 0xded4c9, roughness: 0.95 }));
      wall.position.z = -0.65;
      scene.add(wall);
    }

    if (sceneMode === 'float') {
      const halo = new THREE.Mesh(
        new THREE.CircleGeometry(span * 0.72, 64),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -1.1;
      scene.add(halo);
    }

    if (viewMode === 'explode') {
      const guides = new THREE.Group();
      const guideMat = new THREE.LineDashedMaterial({ color: 0x8f8174, transparent: true, opacity: 0.34, dashSize: 0.08, gapSize: 0.06 });
      const xs = [-boardW * 0.34, 0, boardW * 0.34];
      xs.forEach((x) => {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, -0.76, 0), new THREE.Vector3(x, 1.18, 0)]);
        const l = new THREE.Line(geo, guideMat);
        l.computeLineDistances();
        guides.add(l);
      });
      presentation.add(guides);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.target.set(0, 0, 0);
    controls.minDistance = span * 0.5;
    controls.maxDistance = span * 2.8;
    controls.maxPolarAngle = sceneMode === 'frame' ? Math.PI * 0.86 : Math.PI * 0.49;
    controls.minPolarAngle = sceneMode === 'frame' ? Math.PI * 0.18 : Math.PI * 0.1;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.46;

    let lastTouch = performance.now();
    const stopAuto = () => { lastTouch = performance.now(); controls.autoRotate = false; };
    controls.addEventListener('start', stopAuto);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let lastHoverKey = '';
    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(beadMeshes, false)[0];
      if (!hit || hit.instanceId == null) {
        if (lastHoverKey) { lastHoverKey = ''; setHoverInfo(null); }
        return;
      }
      const target = hit.object as THREE.InstancedMesh;
      const cell = target.userData.cells?.[hit.instanceId] as CellPoint | undefined;
      const code = target.userData.code as string;
      if (!cell || !code) return;
      const done = viewMode !== 'build' || !target.userData.ghost;
      const keyText = `${code}-${cell.index}-${done}`;
      if (keyText === lastHoverKey) return;
      lastHoverKey = keyText;
      setHoverInfo({ code, row: cell.row + 1, col: cell.col + 1, done });
    };
    const onPointerLeave = () => { lastHoverKey = ''; setHoverInfo(null); };
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

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
      if (sceneMode === 'float') presentation.position.y = Math.sin(performance.now() * 0.00065) * 0.08;
      controls.update(dt);
      renderer.render(scene, camera);
      if (firstFrame) { firstFrame = false; setReady(true); }
    };
    render();

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
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
  }, [pattern, melt, sceneMode, viewMode, autoRotate, stats.total, colorGroups, usedColors, completedSet]);

  function capture() {
    const renderer = rendererRef.current;
    if (!renderer || !pattern) return;
    const link = document.createElement('a');
    link.download = `${safeName(pattern.name)}-3d-${viewMode}.png`;
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
  }

  if (!pattern) return (
    <section className="preview-empty card">
      <div className="preview-empty-orb"><span /></div>
      <div>
        <span className="section-kicker">3D WORKBENCH</span>
        <h2>先生成图纸，再进入真正的 3D 工作台。</h2>
        <p>这里不只是转一个盘子：会展示底板插针、拼豆厚度、施工完成状态和熨烫形变。</p>
        {onBack && <button className="primary" onClick={onBack}>回到设计页</button>}
      </div>
    </section>
  );

  return (
    <section className="preview-shell preview-shell-v2">
      <div className="preview-stage card">
        <div className="preview-stage-head">
          <div>
            <span className="section-kicker">REAL 3D WORKBENCH · THREE.JS</span>
            <h2>{pattern.name}</h2>
            <p>{pattern.width}×{pattern.height} · {stats.total.toLocaleString()} 颗 · {stats.colors} 色</p>
          </div>
          <div className="preview-head-actions">
            {onBack && <button onClick={onBack}>← 返回设计</button>}
            <button className="primary" onClick={capture}>保存当前视图</button>
          </div>
        </div>

        <div className="preview-canvas-wrap">
          <div ref={mountRef} className={`preview-canvas-host ${ready ? 'ready' : ''}`} />
          {!ready && <div className="preview-loading"><i /><span>正在搭建 3D 工作台…</span></div>}
          <div className="preview-float-tip">拖动环视 · 双指/滚轮缩放 · 悬停查看豆位</div>
          {hoverInfo && <div className="preview-hover-chip">
            <i style={{ background: paletteByCode.get(hoverInfo.code)?.hex || '#ddd' }} />
            <b>{hoverInfo.code}</b><span>第 {hoverInfo.row} 行 · 第 {hoverInfo.col} 列</span>
            {viewMode === 'build' && <em>{hoverInfo.done ? '已完成' : '待施工'}</em>}
          </div>}
          {viewMode === 'explode' && <div className="preview-layer-legend"><span>拼豆层</span><span>插针层</span><span>底板层</span></div>}
        </div>
      </div>

      <aside className="preview-controls card">
        <div className="preview-control-head">
          <span className="section-kicker">3D WORKBENCH</span>
          <h3>这次真的看“结构”</h3>
          <p>三个视图各自解决一个问题，不再只是把平面图拿来转。</p>
        </div>

        <div className="preview-metrics">
          <div><strong>{stats.total.toLocaleString()}</strong><span>颗豆</span></div>
          <div><strong>{stats.colors}</strong><span>颜色</span></div>
          <div><strong>{stats.progress}%</strong><span>施工</span></div>
        </div>

        <div className="preview-control-section">
          <label>3D 视图</label>
          <div className="preview-view-list">
            {VIEWS.map((item) => <button key={item.key} className={viewMode === item.key ? 'active' : ''} onClick={() => setViewMode(item.key)}>
              <span>{item.label}</span><small>{item.hint}</small>
            </button>)}
          </div>
          {viewMode === 'build' && <p className="preview-note">实体豆 = 已施工 {stats.done.toLocaleString()} 颗；半透明豆 = 还没放的目标位置。</p>}
          {viewMode === 'explode' && <p className="preview-note">爆炸图把底板、插针和中空拼豆拉开，能直接看清真实装配关系。</p>}
        </div>

        <div className="preview-control-section">
          <label>熨烫状态</label>
          <div className="segmented-control three">
            {MELT_LEVELS.map((item) => <button key={item.label} className={Math.abs(melt - item.value) < 0.01 ? 'active' : ''} onClick={() => setMelt(item.value)}>{item.label}</button>)}
          </div>
          <p className="preview-note">这次不是简单压扁：豆体高度降低、外径轻微扩张、中心孔会随熨烫程度缩小。</p>
        </div>

        <div className="preview-control-section">
          <label>展示环境</label>
          <div className="preview-scene-list">
            {SCENES.map((item) => <button key={item.key} className={sceneMode === item.key ? 'active' : ''} onClick={() => setSceneMode(item.key)}>
              <span>{item.label}</span><small>{item.hint}</small>
            </button>)}
          </div>
        </div>

        <label className="preview-switch">
          <span><b>闲置自动旋转</b><small>适合观察厚度和录屏</small></span>
          <input type="checkbox" checked={autoRotate} onChange={(event) => setAutoRotate(event.target.checked)} />
          <i />
        </label>

        <div className="preview-palette-card">
          <div><b>当前图纸色板</b><span>{usedColors.length} 个实际色号</span></div>
          <div className="preview-palette-grid">{usedColors.slice(0, 18).map((entry) => (
            <span key={entry.code} title={`${entry.code} · ${entry.count} 颗`}><i style={{ background: entry.hex }} /><b>{entry.code}</b><small>{entry.count}</small></span>
          ))}</div>
        </div>

        <div className="preview-next">
          <b>现在 3D 真正多出来的价值</b>
          <span>看厚度、看孔径、看插针、看施工完成状态、看熨烫后的形变，以及看装裱后的成品。</span>
        </div>
      </aside>
    </section>
  );
}
