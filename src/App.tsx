import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import WorkspaceCanvas, { type WorkspaceTool } from './components/WorkspaceCanvas';
import PalettePicker from './components/PalettePicker';
import InventoryPanel from './components/InventoryPanel';
import OptimizationPanel from './components/OptimizationPanel';
import InspectionPanel from './components/InspectionPanel';
import ProjectLibraryPanel from './components/ProjectLibraryPanel';
import BuildPanel from './components/BuildPanel';
import { buildPatternFromImageElement, summarizeUsage } from './core/engine';
import { downloadJson } from './core/download';
import { deductPatternFromInventory, restorePatternToInventory } from './core/inventory';
import type { Inventory, Pattern, ProjectRecord } from './core/types';
import {
  deleteProjectRecord,
  duplicateProjectRecord,
  loadInventory,
  loadProgressFor,
  loadProject,
  loadProjectLibrary,
  normalizePattern,
  saveInventory,
  saveProject,
} from './core/storage';
import './styles.css';

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function snapshotPattern(pattern: Pattern): Pattern {
  return { ...pattern, cells: pattern.cells.slice() };
}

type Toast = { text: string; kind?: string } | null;

export default function App() {
  const initialProject = useMemo(() => loadProject(), []);
  const [tab, setTab] = useState('work');
  const [pattern, setPattern] = useState<Pattern | null>(initialProject);
  const [completed, setCompleted] = useState<number[]>(() => loadProgressFor(initialProject));
  const [records, setRecords] = useState<ProjectRecord[]>(() => loadProjectLibrary());
  const [inventory, setInventory] = useState<Inventory>(() => loadInventory());
  const [selectedCode, setSelectedCode] = useState('H7');
  const [focusCode, setFocusCode] = useState('');
  const [gridWidth, setGridWidth] = useState<number | string>(52);
  const [tool, setTool] = useState<WorkspaceTool>('brush');
  const [showGrid, setShowGrid] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const undoStack = useRef<Pattern[]>([]);
  const redoStack = useRef<Pattern[]>([]);
  const toastTimer = useRef<number | null>(null);

  function refreshLibrary() {
    setRecords(loadProjectLibrary());
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveProject(pattern, completed);
      refreshLibrary();
    }, 260);
    return () => window.clearTimeout(timer);
  }, [pattern, completed]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveInventory(inventory), 220);
    return () => window.clearTimeout(timer);
  }, [inventory]);

  function notify(text: string, kind = '') {
    setToast({ text, kind });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  }

  const usage = useMemo(() => summarizeUsage(pattern?.cells || []), [pattern]);
  const total = usage.reduce((sum, row) => sum + row.count, 0);
  const doneCount = useMemo(() => {
    const unique = new Set(completed);
    let n = 0;
    unique.forEach((index) => {
      if (pattern?.cells?.[index]) n += 1;
    });
    return n;
  }, [completed, pattern]);
  const progress = total ? Math.round((doneCount * 100) / total) : 0;
  const settled = Boolean(pattern?.inventoryDeductedAt);

  function resetHistory() {
    undoStack.current = [];
    redoStack.current = [];
  }

  function beginEdit() {
    if (!pattern || settled) return;
    undoStack.current.push(snapshotPattern(pattern));
    if (undoStack.current.length > 60) undoStack.current.shift();
    redoStack.current = [];
  }

  function undo() {
    if (!pattern || settled) return;
    const previous = undoStack.current.pop();
    if (!previous) return notify('没有可以撤销的操作');
    redoStack.current.push(snapshotPattern(pattern));
    setPattern({ ...previous, updatedAt: Date.now() });
  }

  function redo() {
    if (!pattern || settled) return;
    const next = redoStack.current.pop();
    if (!next) return notify('没有可以重做的操作');
    undoStack.current.push(snapshotPattern(pattern));
    setPattern({ ...next, updatedAt: Date.now() });
  }

  useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = ev.ctrlKey || ev.metaKey;
      if (mod && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && ev.key.toLowerCase() === 'y') {
        ev.preventDefault();
        redo();
        return;
      }
      if (tab !== 'work') return;
      const key = ev.key.toLowerCase();
      if (key === 'b') setTool('brush');
      if (key === 'e') setTool('eraser');
      if (key === 'i') setTool('picker');
      if (key === 'h' || key === 'p') setTool('pan');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  async function imageUpload(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const img = await loadImage(file);
      const width = Math.max(8, Math.min(160, Number(gridWidth) || 52));
      const raw = buildPatternFromImageElement(img, width, { name: file.name.replace(/\.[^.]+$/, '') });
      const next = normalizePattern(raw);
      setPattern(next);
      setCompleted([]);
      setFocusCode('');
      setTool('brush');
      resetHistory();
      setTab('work');
      notify(`已生成 ${next.width}×${next.height} 图纸`, 'ok');
    } catch (error) {
      console.error(error);
      notify('图片读取失败', 'bad');
    } finally {
      ev.target.value = '';
    }
  }

  function paint(index: number, code: string | null) {
    if (!pattern || settled) return;
    if (pattern.cells[index] === code) return;
    const cells = pattern.cells.slice();
    cells[index] = code;
    setPattern({ ...pattern, cells, updatedAt: Date.now() });
    if (completed.includes(index)) setCompleted(completed.filter((i) => i !== index));
  }

  function rename(name: string) {
    if (pattern) setPattern({ ...pattern, name, updatedAt: Date.now() });
  }

  function toggleCompleted(index: number) {
    setCompleted((prev) => {
      const set = new Set(prev);
      if (set.has(index)) set.delete(index);
      else set.add(index);
      return [...set];
    });
  }

  function exportProject() {
    if (!pattern) return notify('没有可导出的作品', 'bad');
    downloadJson(
      { version: 'bead-studio/0.4', pattern, inventory, completed },
      `${pattern.name || 'bead-project'}.json`,
    );
  }

  async function importProject(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.pattern?.cells) throw new Error('invalid project');
      const next = normalizePattern(data.pattern);
      setPattern(next);
      setInventory(data.inventory || inventory);
      setCompleted(Array.isArray(data.completed) ? data.completed : []);
      resetHistory();
      setTab('work');
      notify('工程已导入', 'ok');
    } catch {
      notify('工程文件格式不正确', 'bad');
    } finally {
      ev.target.value = '';
    }
  }

  function newProject() {
    if (pattern && !confirm('新建会切换到空工作区；当前作品已经自动保存在作品库。继续？')) return;
    setPattern(null);
    setCompleted([]);
    setFocusCode('');
    resetHistory();
    setTab('work');
    notify('已进入新作品工作区');
  }

  function openRecord(record: ProjectRecord) {
    setPattern(normalizePattern(record.pattern));
    setCompleted(record.completed || []);
    setFocusCode('');
    resetHistory();
    setTab('work');
    notify(`已打开「${record.pattern.name}」`, 'ok');
  }

  function deleteRecord(id: string) {
    const isCurrent = pattern?.id === id;
    deleteProjectRecord(id);
    if (isCurrent) {
      setPattern(null);
      setCompleted([]);
      resetHistory();
    }
    refreshLibrary();
    notify('作品已删除');
  }

  function duplicateRecord(record: ProjectRecord) {
    const copy = duplicateProjectRecord(record);
    refreshLibrary();
    setPattern(copy.pattern);
    setCompleted([]);
    resetHistory();
    setTab('work');
  }

  function applyOptimized(nextPattern: Pattern) {
    if (!pattern) return;
    if (settled) return notify('该作品已经扣减库存，先撤销扣库后再改图', 'bad');
    beginEdit();
    setPattern({
      ...nextPattern,
      id: pattern.id,
      name: pattern.name,
      createdAt: pattern.createdAt,
      updatedAt: Date.now(),
      inventoryDeductedAt: undefined,
    });
    setCompleted([]);
    notify('优化结果已应用，施工进度已重置', 'ok');
  }

  function settleInventory() {
    if (!pattern) return;
    if (pattern.inventoryDeductedAt) return notify('这个作品已经扣过库存');
    if (doneCount < total) return notify('先把施工进度完成到 100%', 'bad');
    const result = deductPatternFromInventory(pattern, inventory);
    if (!result.ok) {
      const first = result.shortages.slice(0, 3).map((x) => `${x.code} 缺 ${x.shortage}`).join('、');
      return notify(`库存不足：${first}${result.shortages.length > 3 ? '…' : ''}`, 'bad');
    }
    setInventory(result.inventory);
    setPattern({ ...pattern, inventoryDeductedAt: Date.now(), updatedAt: Date.now() });
    notify(`作品完成，已从豆库扣减 ${result.deducted.toLocaleString()} 颗`, 'ok');
  }

  function restoreInventory() {
    if (!pattern?.inventoryDeductedAt) return;
    if (!confirm('把这个作品消耗的豆全部加回豆库，并解锁图纸编辑？')) return;
    setInventory(restorePatternToInventory(pattern, inventory));
    const next = { ...pattern, updatedAt: Date.now() };
    delete next.inventoryDeductedAt;
    setPattern(next);
    notify('库存已恢复，图纸重新解锁', 'ok');
  }

  const nav = [
    ['work', '设计'],
    ['build', '施工'],
    ['inventory', '豆库'],
    ['photo', '拍照验豆'],
    ['iron', '熨烫检测'],
    ['library', '作品库'],
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="logo"><span /></div>
          <div>
            <h1>拼豆工作台 <em>V0.4</em></h1>
            <p>设计 · 库存改图 · 施工进度 · 实物检查 · 熨烫</p>
          </div>
        </div>
        <div className="toolbar">
          <button onClick={newProject}>新建</button>
          <label className="filebtn">导入工程<input ref={importRef} type="file" accept="application/json" onChange={importProject} /></label>
          <button onClick={exportProject}>导出工程</button>
        </div>
      </header>

      <nav className="tabs">
        {nav.map(([key, name]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{name}</button>)}
      </nav>

      {pattern && (
        <div className="project-strip">
          <div>
            <strong>{pattern.name}</strong>
            <span>{pattern.width}×{pattern.height} · {total.toLocaleString()}颗 · {usage.length}色</span>
            {settled && <span className="settled-tag">已扣库存</span>}
          </div>
          <div className="project-strip-progress">
            <span>施工 {progress}%</span>
            <div className="progress-line"><i style={{ width: `${progress}%` }} /></div>
          </div>
        </div>
      )}

      {tab === 'work' && (
        <main className="work-grid">
          <section className="card main-card">
            <div className="card-hd workspace-header">
              <div className="project-heading">
                {pattern ? <input className="project-name" value={pattern.name} onChange={(e) => rename(e.target.value)} /> : <h2>创建一个作品开始</h2>}
                <p>{pattern ? `${pattern.width}×${pattern.height} · ${total.toLocaleString()} 颗 · ${usage.length} 色` : '图片全部在浏览器本地处理'}</p>
              </div>
              <div className="toolbar">
                <label className="filebtn primary">上传图片<input type="file" accept="image/*" onChange={imageUpload} /></label>
                <label className="inline-field">宽度 <input type="number" min="8" max="160" value={gridWidth} onChange={(e) => setGridWidth(e.target.value)} /></label>
              </div>
            </div>
            <div className="workspace-toolbar">
              <div className="tool-group">
                <button className={tool === 'brush' ? 'active' : ''} onClick={() => setTool('brush')}>画笔 <kbd>B</kbd></button>
                <button className={tool === 'eraser' ? 'active' : ''} onClick={() => setTool('eraser')}>橡皮 <kbd>E</kbd></button>
                <button className={tool === 'picker' ? 'active' : ''} onClick={() => setTool('picker')}>吸管 <kbd>I</kbd></button>
                <button className={tool === 'pan' ? 'active' : ''} onClick={() => setTool('pan')}>拖动画布 <kbd>H</kbd></button>
              </div>
              <div className="tool-group">
                <button disabled={!undoStack.current.length || settled} onClick={undo}>撤销</button>
                <button disabled={!redoStack.current.length || settled} onClick={redo}>重做</button>
                <button className={showGrid ? 'active' : ''} onClick={() => setShowGrid((v) => !v)}>网格</button>
              </div>
            </div>
            {settled && <div className="workspace-lock-note">作品已经完工并扣减豆库。为了避免库存和图纸失配，当前图纸已锁定；到“施工”页撤销扣库后可继续编辑。</div>}
            <WorkspaceCanvas
              pattern={pattern}
              selectedCode={selectedCode}
              tool={tool}
              onToolChange={setTool}
              onEditStart={beginEdit}
              onPaint={paint}
              onPick={setSelectedCode}
              showGrid={showGrid}
              locked={settled}
            />
          </section>
          <aside className="side-stack">
            <PalettePicker selected={selectedCode} onSelect={(code: string) => { setSelectedCode(code); setTool('brush'); }} />
            <OptimizationPanel pattern={pattern} inventory={inventory} onApply={applyOptimized} onToast={notify} />
            <div className="card">
              <div className="card-hd"><h2>用量 Top 12</h2></div>
              <div className="card-bd usage-list">
                {usage.slice(0, 12).map((row) => <div key={row.code}><span><i className="swatch" style={{ background: row.color?.hex }} />{row.code}</span><b>{row.count}</b></div>)}
                {!usage.length && <span className="muted">暂无用量</span>}
              </div>
            </div>
          </aside>
        </main>
      )}

      {tab === 'build' && (
        <main className="work-grid build-layout">
          <section className="card main-card">
            <div className="card-hd">
              <div><h2>{pattern?.name || '施工模式'}</h2><p>点击豆子标记已完成；已完成区域会显示深色勾</p></div>
              <div className="toolbar"><button onClick={() => setFocusCode('')}>显示全部颜色</button></div>
            </div>
            <WorkspaceCanvas
              pattern={pattern}
              selectedCode={selectedCode}
              tool="pan"
              mode="build"
              completed={completed}
              onToggleCompleted={toggleCompleted}
              focusCode={focusCode}
              showGrid={showGrid}
              locked={settled}
            />
          </section>
          <aside className="side-stack">
            <BuildPanel
              pattern={pattern}
              completed={completed}
              onChange={setCompleted}
              onFocusCode={setFocusCode}
              onToast={notify}
              inventoryDeductedAt={pattern?.inventoryDeductedAt}
              onSettleInventory={settleInventory}
              onRestoreInventory={restoreInventory}
            />
            <div className="card"><div className="card-bd"><div className="callout"><b>推荐流程：</b>按一个色号集中铺豆 → 点“本色完成” → 换下一个颜色。中途随时可以去“拍照验豆”检查。</div></div></div>
          </aside>
        </main>
      )}

      {tab === 'inventory' && <main className="single"><InventoryPanel pattern={pattern} inventory={inventory} onChange={setInventory} onToast={notify} /></main>}
      {tab === 'photo' && <main className="single"><InspectionPanel pattern={pattern} mode="photo" onToast={notify} onMarkCompleted={(indexes: number[]) => setCompleted((prev) => [...new Set([...prev, ...indexes])])} /></main>}
      {tab === 'iron' && <main className="single"><InspectionPanel pattern={pattern} mode="iron" onToast={notify} onMarkCompleted={undefined} /></main>}
      {tab === 'library' && <main className="single"><ProjectLibraryPanel records={records} currentId={pattern?.id} onOpen={openRecord} onDelete={deleteRecord} onDuplicate={duplicateRecord} onToast={notify} /></main>}

      <footer>所有图片、库存、施工进度都在浏览器本地处理。MARD 色卡及上游声明见 THIRD_PARTY_NOTICES.md。</footer>
      {toast && <div className={`toast show ${toast.kind || ''}`}>{toast.text}</div>}
    </div>
  );
}
