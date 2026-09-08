import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function replaceOrFail(code: string, search: string | RegExp, replacement: string, label: string) {
  const next = code.replace(search, replacement);
  if (next === code) throw new Error(`[xhs-mini-tool] transform failed: ${label}`);
  return next;
}

function xhsMiniToolPlugin(): Plugin {
  return {
    name: 'xhs-mini-tool-compat',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replace(/\\/g, '/');

      if (cleanId.endsWith('/src/main.tsx')) {
        let next = code;
        next = replaceOrFail(
          next,
          "import './three-d-v2.css';",
          "import './three-d-v2.css';\nimport './xhs-compat.css';",
          'load xhs compatibility css',
        );
        next = replaceOrFail(
          next,
          /\nif \('serviceWorker' in navigator && import\.meta\.env\.PROD\) \{[\s\S]*?\n\}\s*$/,
          '',
          'remove service worker registration',
        );
        next = replaceOrFail(
          next,
          "createRoot(document.getElementById('root')!).render(",
          `function supportsFlexGap() {\n  const flex = document.createElement('div');\n  flex.style.position = 'absolute';\n  flex.style.visibility = 'hidden';\n  flex.style.display = 'flex';\n  flex.style.flexDirection = 'column';\n  flex.style.rowGap = '1px';\n  flex.appendChild(document.createElement('div'));\n  flex.appendChild(document.createElement('div'));\n  document.body.appendChild(flex);\n  const supported = flex.scrollHeight === 1;\n  if (flex.parentNode) flex.parentNode.removeChild(flex);\n  return supported;\n}\n\nif (!supportsFlexGap()) document.documentElement.classList.add('no-flex-gap');\n\ncreateRoot(document.getElementById('root')!).render(`,
          'add flex gap behavior detection',
        );
        return next;
      }

      if (cleanId.endsWith('/src/App.tsx')) {
        let next = code;
        next = replaceOrFail(next, "import { downloadJson } from './core/download';\n", '', 'remove download helper import');
        next = replaceOrFail(
          next,
          "    media.addEventListener?.('change', sync);\n    return () => media.removeEventListener?.('change', sync);",
          "    if (typeof media.addEventListener === 'function') {\n      media.addEventListener('change', sync);\n      return () => media.removeEventListener('change', sync);\n    }\n    media.addListener(sync);\n    return () => media.removeListener(sync);",
          'add MediaQueryList Chrome 61 fallback',
        );
        next = replaceOrFail(
          next,
          /\n  function exportProject\(\) \{[\s\S]*?\n  \}\n\n  async function importProject/,
          `\n  function exportProject() {\n    notify('小工具会自动保存作品，暂不支持导出工程文件');\n  }\n\n  async function importProject`,
          'replace unsupported json export flow',
        );
        next = replaceOrFail(
          next,
          /  async function importProject\(ev: ChangeEvent<HTMLInputElement>\) \{[\s\S]*?\n  \}\n\n  function newProject/,
          `  async function importProject(ev: ChangeEvent<HTMLInputElement>) {\n    notify('小工具暂不支持导入工程文件');\n    ev.target.value = '';\n  }\n\n  function newProject`,
          'replace unsupported json import flow',
        );
        next = replaceOrFail(
          next,
          /\s*<label className="filebtn">导入<input ref=\{importRef\} type="file" accept="application\/json" onChange=\{importProject\} \/><\/label>\s*<button onClick=\{exportProject\}>导出<\/button>/,
          '\n          <span className="xhs-save-hint">工程自动保存在本机</span>',
          'replace unsupported project file controls',
        );
        next = replaceOrFail(
          next,
          'onImport={() => importRef.current?.click()}',
          "onImport={() => notify('小工具暂不支持导入工程文件')}",
          'replace mobile json import action',
        );
        return next;
      }

      if (cleanId.endsWith('/src/components/InventoryPanel.tsx')) {
        let next = code;
        next = replaceOrFail(next, "import { downloadCsv } from '../core/download';\n", '', 'remove CSV download helper import');
        next = replaceOrFail(
          next,
          /\n  function exportPlan\(\)\{[\s\S]*?\}\n  return /,
          '\n  return ',
          'remove unsupported CSV export flow',
        );
        next = replaceOrFail(
          next,
          /<button onClick=\{exportPlan\}>导出 CSV<\/button>/,
          '<span className="xhs-save-hint">采购计划仅本机使用</span>',
          'replace CSV download control',
        );
        return next;
      }

      if (cleanId.endsWith('/src/styles.css')) {
        return code.replace(/displax:/g, 'display:');
      }

      if (cleanId.endsWith('/src/components/Bead3DPreview.tsx')) {
        let next = code;
        next = replaceOrFail(
          next,
          /function createBeadGeometry\(melt: number\) \{[\s\S]*?return \{ geometry, height \};\n\}/,
          `function createBeadGeometry(melt: number) {\n  const outer = 0.238 + melt * 0.022;\n  const height = 0.42 * (1 - melt * 0.62);\n  const geometry = new THREE.CylinderGeometry(outer, outer, height, 8, 1, false);\n  return { geometry, height };\n}`,
          'use lower-poly bead geometry',
        );
        next = replaceOrFail(
          next,
          '    setHoverInfo(null);\n\n    const scene = new THREE.Scene();',
          `    setHoverInfo(null);\n\n    if (stats.total > 1800) {\n      host.textContent = '当前图纸豆数较多，为保证小工具流畅，3D 已自动降级；设计、施工与验豆功能仍可正常使用。';\n      host.classList.add('preview-canvas-fallback');\n      setReady(true);\n      return;\n    }\n    const probe = document.createElement('canvas');\n    if (!probe.getContext('webgl') && !probe.getContext('experimental-webgl')) {\n      host.textContent = '当前设备不支持 WebGL，3D 预览已关闭；其他功能仍可正常使用。';\n      host.classList.add('preview-canvas-fallback');\n      setReady(true);\n      return;\n    }\n\n    const scene = new THREE.Scene();`,
          'add WebGL fallback and complexity cap',
        );
        next = replaceOrFail(
          next,
          '    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));',
          '    let renderScale = 1.5;\n    renderer.setPixelRatio(1);',
          'cap WebGL dpr',
        );
        next = replaceOrFail(
          next,
          '    host.replaceChildren(renderer.domElement);',
          "    while (host.firstChild) host.removeChild(host.firstChild);\n    host.appendChild(renderer.domElement);",
          'replace replaceChildren for Chrome 61',
        );
        next = replaceOrFail(
          next,
          '    rendererRef.current = renderer;',
          `    rendererRef.current = renderer;\n    let contextLost = false;\n    const onContextLost = (event: Event) => {\n      event.preventDefault();\n      contextLost = true;\n      setReady(false);\n    };\n    const onContextRestored = () => {\n      contextLost = false;\n      setReady(true);\n    };\n    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);\n    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);`,
          'handle WebGL context loss',
        );
        next = replaceOrFail(
          next,
          '      const pegGeo = new THREE.CylinderGeometry(0.068, 0.075, 0.19, 8);',
          '      const pegGeo = new THREE.CylinderGeometry(0.068, 0.075, 0.19, 4);',
          'lower peg geometry cost',
        );
        next = replaceOrFail(
          next,
          '      mesh.castShadow = !ghost && stats.total <= 12000;',
          '      mesh.castShadow = !ghost && stats.total <= 800;',
          'limit dynamic shadow cost',
        );
        next = replaceOrFail(
          next,
          `    const resize = () => {\n      const rect = host.getBoundingClientRect();\n      const w = Math.max(1, Math.floor(rect.width));\n      const h = Math.max(1, Math.floor(rect.height));\n      camera.aspect = w / h;\n      camera.updateProjectionMatrix();\n      renderer.setSize(w, h, false);\n    };`,
          `    const resize = () => {\n      const rect = host.getBoundingClientRect();\n      const w = Math.max(1, Math.floor(rect.width));\n      const h = Math.max(1, Math.floor(rect.height));\n      camera.aspect = w / h;\n      camera.updateProjectionMatrix();\n      const pixelBudgetDpr = Math.sqrt(2000000 / Math.max(1, w * h));\n      renderer.setPixelRatio(Math.max(1, Math.min(window.devicePixelRatio || 1, renderScale, pixelBudgetDpr)));\n      renderer.setSize(w, h, false);\n    };`,
          'cap WebGL drawing buffer pixels',
        );
        next = replaceOrFail(
          next,
          `    const observer = new ResizeObserver(resize);\n    observer.observe(host);`,
          `    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;\n    if (observer) observer.observe(host);\n    else window.addEventListener('resize', resize);`,
          'add ResizeObserver fallback',
        );
        next = replaceOrFail(
          next,
          `    const clock = new THREE.Clock();\n    let frameId = 0;\n    let firstFrame = true;\n    const render = () => {\n      frameId = requestAnimationFrame(render);\n      const dt = Math.min(clock.getDelta(), 0.05);\n      if (autoRotate && performance.now() - lastTouch > 3200) controls.autoRotate = true;\n      if (sceneMode === 'float') presentation.position.y = Math.sin(performance.now() * 0.00065) * 0.08;\n      controls.update(dt);\n      renderer.render(scene, camera);\n      if (firstFrame) { firstFrame = false; setReady(true); }\n    };`,
          `    const clock = new THREE.Clock();\n    let frameId = 0;\n    let firstFrame = true;\n    let slowFrames = 0;\n    const render = () => {\n      frameId = requestAnimationFrame(render);\n      const dt = Math.min(clock.getDelta(), 0.05);\n      if (contextLost || document.hidden) return;\n      if (dt > 0.042) slowFrames += 1;\n      else slowFrames = Math.max(0, slowFrames - 1);\n      if (slowFrames > 12 && renderScale > 1) {\n        renderScale = 1;\n        slowFrames = 0;\n        resize();\n      }\n      if (autoRotate && performance.now() - lastTouch > 3200) controls.autoRotate = true;\n      if (sceneMode === 'float') presentation.position.y = Math.sin(performance.now() * 0.00065) * 0.08;\n      controls.update(dt);\n      renderer.render(scene, camera);\n      if (firstFrame) { firstFrame = false; setReady(true); }\n    };`,
          'add runtime WebGL degradation',
        );
        next = replaceOrFail(
          next,
          `      observer.disconnect();\n      controls.dispose();`,
          `      if (observer) observer.disconnect();\n      else window.removeEventListener('resize', resize);\n      controls.dispose();`,
          'cleanup resize fallback',
        );
        next = replaceOrFail(
          next,
          `      renderer.domElement.removeEventListener('pointermove', onPointerMove);\n      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);`,
          `      renderer.domElement.removeEventListener('pointermove', onPointerMove);\n      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);\n      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);\n      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);`,
          'cleanup WebGL context listeners',
        );
        next = replaceOrFail(
          next,
          /\n  function capture\(\) \{[\s\S]*?\n  \}\n\n  if \(!pattern\)/,
          `\n  async function capture() {\n    const renderer = rendererRef.current;\n    if (!renderer || !pattern) return;\n    const miniTool = (window as any).xhs?.miniTool;\n    if (!miniTool?.saveImageToPhotosAlbum) {\n      alert('当前环境不支持保存到相册，请使用系统截图保存当前视图');\n      return;\n    }\n    try {\n      await miniTool.saveImageToPhotosAlbum({ filePath: renderer.domElement.toDataURL('image/png') });\n    } catch {\n      alert('保存失败，请检查相册权限后重试');\n    }\n  }\n\n  if (!pattern)`,
          'replace forbidden image download with XHS JSBridge',
        );
        return next;
      }

      return null;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replace(/<!doctype html>/i, '<!DOCTYPE html>')
          .replace(/<meta name="theme-color"[^>]*>/g, '')
          .replace(/<meta name="apple-mobile-web-app-capable"[^>]*>/g, '')
          .replace(/<meta name="apple-mobile-web-app-status-bar-style"[^>]*>/g, '')
          .replace(/<meta name="application-name"[^>]*>/g, '')
          .replace(/<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g, '')
          .replace(/\s+type="module"/g, '')
          .replace(/\s+crossorigin/g, '')
          .replace(/<script src=/g, '<script defer src=');
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const isXhs = mode === 'xhs';
  return {
    plugins: [react(), ...(isXhs ? [xhsMiniToolPlugin()] : [])],
    base: isXhs ? './' : '/',
    publicDir: isXhs ? false : 'public',
    build: isXhs
      ? {
          target: ['es2017', 'chrome61'],
          modulePreload: { polyfill: false },
        }
      : {},
    server: {
      port: 5174,
    },
  };
});
