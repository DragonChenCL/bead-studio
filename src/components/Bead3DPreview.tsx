import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { paletteByCode } from '../core/engine';
import type { Pattern } from '../core/types';

type SceneMode = 'desk' | 'frame' | 'float';

type Props = {
  pattern: Pattern | null;
  completed?: number[];
  onBack?: () => void;
};

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

  const stats = useMemo(() => {
    if (!pattern) return { total: 0, colors: 0, progress: 0 };
    const codes = new Set<string>();
    let total = 0;
    pattern.cells.forEach((code) => {
      if (!code) return;
      total += 1;
      codes.add(code);
    });
    const doneSet = new Set(completed);
    let done = 0;
    doneSet.forEach((index) => {
      if (pattern.cells[index]) done += 1;
    });
    return { total, colors: codes.size, progress: total ? Math.round((done / total) * 100) : 0 };
  }, [pattern, completed]);

  useEffect(() => {
    if (!pattern || !mountRef.current) return;
    const host = mountRef.current;
    setReady(false);

    const scene = new THREE.Scene();
    const bg = sceneMode === 'float' ? 0xf4f0e9 : sceneMode === 'frame' ? 0xe7dfd4 : 0xd8c6b2;
    scene.background = new THREE.Color(bg);
    scene.fog = new THREE.Fog(bg, 45, 150);

    const width = Math.max(1, pattern.width);
    const height = Math.max(1, pattern.height);
    const pitch = 0.66;
    const boardW = width * pitch;
    const boardH = height * pitch;
    const span = Math.max(boardW, boardH, 8);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 360);
    camera.position.set(span * 0.72, span * 0.86, span * 0.92);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
    renderer.domElement.className = 'bead-3d-canvas';
    host.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    const ambient = new THREE.HemisphereLight(0xfff7ea, 0x695b68, sceneMode === 'float' ? 2.25 : 1.72);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffead2, 4.1);
    key.position.set(-span * 0.45, span * 1.15, span * 0.72);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = span * 4;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xa9c6d9, 2.15);
    rim.position.set(span * 0.7, span * 0.72, -span * 0.85);
    scene.add(rim);

    const warm = new THREE.PointLight(0xffa75b, sceneMode === 'desk' ? 18 : 7, span * 2.8, 2);
    warm.position.set(-span * 0.72, span * 0.46, span * 0.28);
    scene.add(warm);

    const art = new THREE.Group();
    scene.add(art);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(boardW + 0.62, 0.16, boardH + 0.62),
      new THREE.MeshPhysicalMaterial({
        color: 0xece9e0,
        roughness: 0.5,
        metalness: 0,
        transmission: sceneMode === 'float' ? 0.18 : 0.04,
        transparent: true,
        opacity: sceneMode === 'float' ? 0.72 : 0.94,
        clearcoat: 0.35,
        clearcoatRoughness: 0.42,
      }),
    );
    board.position.y = 0.08;
    board.receiveShadow = true;
    art.add(board);

    const count = stats.total;
    const beadGeometry = new THREE.TorusGeometry(0.205, 0.105, 5, 10);
    beadGeometry.rotateX(Math.PI / 2);
    const beadMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.46,
      metalness: 0,
      clearcoat: 0.2,
      clearcoatRoughness: 0.44,
      vertexColors: true,
    });
    const beads = new THREE.InstancedMesh(beadGeometry, beadMaterial, Math.max(1, count));
    beads.castShadow = count <= 12000;
    beads.receiveShadow = true;
    beads.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    art.add(beads);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let instance = 0;
    const scaleXZ = 1 + melt * 0.075;
    const scaleY = 1 - melt * 0.43;
    const beadY = 0.31 - melt * 0.035;

    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const index = row * width + col;
        const code = pattern.cells[index];
        if (!code) continue;
        dummy.position.set((col - (width - 1) / 2) * pitch, beadY, (row - (height - 1) / 2) * pitch);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(scaleXZ, scaleY, scaleXZ);
        dummy.updateMatrix();
        beads.setMatrixAt(instance, dummy.matrix);
        color.set(paletteByCode.get(code)?.hex || '#d8d2c8');
        beads.setColorAt(instance, color);
        instance += 1;
      }
    }
    beads.count = instance;
    beads.instanceMatrix.needsUpdate = true;
    if (beads.instanceColor) beads.instanceColor.needsUpdate = true;

    if (melt > 0.05 && count > 0) {
      const fusionGeometry = new THREE.CylinderGeometry(0.275, 0.275, 0.035, 10);
      const fusionMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.55,
        transparent: true,
        opacity: Math.min(0.78, melt * 0.76),
        vertexColors: true,
      });
      const fusion = new THREE.InstancedMesh(fusionGeometry, fusionMaterial, count);
      let fi = 0;
      for (let row = 0; row < height; row += 1) {
        for (let col = 0; col < width; col += 1) {
          const index = row * width + col;
          const code = pattern.cells[index];
          if (!code) continue;
          dummy.position.set((col - (width - 1) / 2) * pitch, 0.185, (row - (height - 1) / 2) * pitch);
          dummy.scale.set(0.88 + melt * 0.2, 1, 0.88 + melt * 0.2);
          dummy.updateMatrix();
          fusion.setMatrixAt(fi, dummy.matrix);
          color.set(paletteByCode.get(code)?.hex || '#d8d2c8');
          fusion.setColorAt(fi, color);
          fi += 1;
        }
      }
      fusion.count = fi;
      fusion.castShadow = false;
      fusion.receiveShadow = true;
      art.add(fusion);
    }

    if (sceneMode === 'desk') {
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(span * 2.4, 0.72, span * 1.9),
        new THREE.MeshStandardMaterial({ color: 0x76513b, roughness: 0.82, metalness: 0 }),
      );
      table.position.y = -0.45;
      table.receiveShadow = true;
      scene.add(table);

      const mat = new THREE.MeshStandardMaterial({ color: 0xc7a06d, roughness: 0.48 });
      const looseGeo = new THREE.TorusGeometry(0.205, 0.105, 5, 10);
      looseGeo.rotateX(Math.PI / 2);
      for (let i = 0; i < 9; i += 1) {
        const loose = new THREE.Mesh(looseGeo, mat.clone());
        const a = (i / 9) * Math.PI * 1.1 - 0.45;
        loose.position.set(boardW * 0.62 + Math.cos(a) * (0.8 + (i % 3) * 0.28), 0.14, boardH * 0.18 + Math.sin(a) * 1.15);
        loose.rotation.y = i * 0.9;
        (loose.material as THREE.MeshStandardMaterial).color.setHSL((i * 0.11) % 1, 0.52, 0.58);
        loose.castShadow = true;
        scene.add(loose);
      }
    }

    if (sceneMode === 'frame') {
      const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x4d3327, roughness: 0.55 });
      const frame = new THREE.Group();
      const t = 0.72;
      const h = 0.46;
      const top = new THREE.Mesh(new THREE.BoxGeometry(boardW + t * 2, h, t), frameMaterial);
      const bottom = top.clone();
      const left = new THREE.Mesh(new THREE.BoxGeometry(t, h, boardH + t * 2), frameMaterial);
      const right = left.clone();
      top.position.set(0, 0.18, -(boardH + t) / 2);
      bottom.position.set(0, 0.18, (boardH + t) / 2);
      left.position.set(-(boardW + t) / 2, 0.18, 0);
      right.position.set((boardW + t) / 2, 0.18, 0);
      frame.add(top, bottom, left, right);
      frame.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      scene.add(frame);
    }

    if (sceneMode === 'float') {
      art.rotation.x = -0.08;
      const halo = new THREE.Mesh(
        new THREE.CircleGeometry(span * 0.72, 64),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false }),
      );
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
    const stopAuto = () => {
      lastTouch = performance.now();
      controls.autoRotate = false;
    };
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
      if (firstFrame) {
        firstFrame = false;
        setReady(true);
      }
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
  }, [pattern, melt, sceneMode, autoRotate, stats.total]);

  function capture() {
    const renderer = rendererRef.current;
    if (!renderer || !pattern) return;
    const link = document.createElement('a');
    link.download = `${safeName(pattern.name)}-3d-preview.png`;
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
  }

  if (!pattern) {
    return (
      <section className="preview-empty card">
        <div className="preview-empty-orb"><span /></div>
        <div>
          <span className="section-kicker">3D PREVIEW</span>
          <h2>先生成一张图纸，再把它“拿起来”看看。</h2>
          <p>3D 预览会按真实色号把每颗豆子立起来，并提供原豆、熨烫和展示场景预览。</p>
          {onBack && <button className="primary" onClick={onBack}>回到设计页</button>}
        </div>
      </section>
    );
  }

  return (
    <section className="preview-shell">
      <div className="preview-stage card">
        <div className="preview-stage-head">
          <div>
            <span className="section-kicker">LIVE 3D · THREE.JS</span>
            <h2>{pattern.name}</h2>
            <p>{pattern.width}×{pattern.height} · {stats.total.toLocaleString()} 颗 · {stats.colors} 色</p>
          </div>
          <div className="preview-head-actions">
            {onBack && <button onClick={onBack}>← 返回设计</button>}
            <button className="primary" onClick={capture}>保存展示图</button>
          </div>
        </div>
        <div className="preview-canvas-wrap">
          <div ref={mountRef} className={`preview-canvas-host ${ready ? 'ready' : ''}`} />
          {!ready && <div className="preview-loading"><i /><span>正在摆放 {stats.total.toLocaleString()} 颗豆…</span></div>}
          <div className="preview-float-tip">拖动旋转 · 双指/滚轮缩放</div>
        </div>
      </div>

      <aside className="preview-controls card">
        <div className="preview-control-head">
          <span className="section-kicker">FINISH LAB</span>
          <h3>成品模拟器</h3>
          <p>先看成品，再决定怎么熨、怎么展示。</p>
        </div>

        <div className="preview-metrics">
          <div><strong>{stats.total.toLocaleString()}</strong><span>颗豆</span></div>
          <div><strong>{stats.colors}</strong><span>颜色</span></div>
          <div><strong>{stats.progress}%</strong><span>施工</span></div>
        </div>

        <div className="preview-control-section">
          <label>熨烫状态</label>
          <div className="segmented-control three">
            {MELT_LEVELS.map((item) => (
              <button key={item.label} className={Math.abs(melt - item.value) < 0.01 ? 'active' : ''} onClick={() => setMelt(item.value)}>
                {item.label}
              </button>
            ))}
          </div>
          <p className="preview-note">当前为视觉模拟：熨烫越重，豆体越扁、相邻区域融合感越明显。</p>
        </div>

        <div className="preview-control-section">
          <label>展示场景</label>
          <div className="preview-scene-list">
            {SCENES.map((item) => (
              <button key={item.key} className={sceneMode === item.key ? 'active' : ''} onClick={() => setSceneMode(item.key)}>
                <span>{item.label}</span><small>{item.hint}</small>
              </button>
            ))}
          </div>
        </div>

        <label className="preview-switch">
          <span><b>闲置自动旋转</b><small>适合录屏和展示成品</small></span>
          <input type="checkbox" checked={autoRotate} onChange={(event) => setAutoRotate(event.target.checked)} />
          <i />
        </label>

        <div className="preview-next">
          <b>下一步可以继续做</b>
          <span>完工时最后一颗豆落下 → 熨烫动画 → 自动生成分享视频。</span>
        </div>
      </aside>
    </section>
  );
}
