import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import type { Pattern } from '../core/types';
import { paletteByCode } from '../core/engine';

export type WorkspaceTool = 'brush' | 'eraser' | 'picker' | 'pan';

type Props = {
  pattern: Pattern | null;
  selectedCode: string;
  tool: WorkspaceTool;
  onToolChange?: (tool: WorkspaceTool) => void;
  onEditStart?: () => void;
  onPaint?: (index: number, code: string | null) => void;
  onPick?: (code: string) => void;
  mode?: 'paint' | 'build';
  completed?: number[];
  onToggleCompleted?: (index: number) => void;
  focusCode?: string;
  showGrid?: boolean;
  locked?: boolean;
};

type Point = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function WorkspaceCanvas({
  pattern,
  selectedCode,
  tool,
  onToolChange,
  onEditStart,
  onPaint,
  onPick,
  mode = 'paint',
  completed = [],
  onToggleCompleted,
  focusCode = '',
  showGrid = true,
  locked = false,
}: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 26, y: 26 });
  const [hover, setHover] = useState<{ x: number; y: number; index: number; code: string | null } | null>(null);
  const pointerRef = useRef<{
    id: number;
    action: 'paint' | 'pan' | null;
    lastClient: Point;
    lastIndex: number;
  } | null>(null);
  const spaceRef = useRef(false);

  const cellSize = useMemo(() => {
    if (!pattern) return 16;
    const maxDimension = Math.max(pattern.width, pattern.height);
    return clamp(Math.floor(2200 / Math.max(1, maxDimension)), 6, 18);
  }, [pattern]);

  const doneSet = useMemo(() => new Set(completed), [completed]);

  const resetView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !pattern) {
      setZoom(1);
      setPan({ x: 26, y: 26 });
      return;
    }
    const width = pattern.width * cellSize;
    const height = pattern.height * cellSize;
    const availableW = Math.max(120, viewport.clientWidth - 52);
    const availableH = Math.max(120, viewport.clientHeight - 52);
    const nextZoom = clamp(Math.min(1, availableW / width, availableH / height), 0.18, 1);
    setZoom(nextZoom);
    setPan({
      x: Math.max(24, (viewport.clientWidth - width * nextZoom) / 2),
      y: Math.max(24, (viewport.clientHeight - height * nextZoom) / 2),
    });
  }, [pattern, cellSize]);

  useEffect(() => {
    resetView();
  }, [pattern?.id, pattern?.width, pattern?.height, resetView]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!pattern) {
      canvas.width = 760;
      canvas.height = 460;
      ctx.fillStyle = '#f4f1ea';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#8a857b';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('上传图片或导入工程开始', canvas.width / 2, canvas.height / 2);
      return;
    }

    canvas.width = Math.max(1, pattern.width * cellSize);
    canvas.height = Math.max(1, pattern.height * cellSize);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fffdfa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        const index = y * pattern.width + x;
        const code = pattern.cells[index];
        if (!code) continue;
        const color = paletteByCode.get(code);
        const dimmed = Boolean(focusCode && code !== focusCode);
        const cx = x * cellSize + cellSize / 2;
        const cy = y * cellSize + cellSize / 2;
        const r = cellSize * 0.44;

        ctx.save();
        if (dimmed) ctx.globalAlpha = 0.13;
        ctx.fillStyle = color?.hex || '#ccc';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        if (cellSize >= 8) {
          ctx.fillStyle = 'rgba(255,255,255,.9)';
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(1, cellSize * 0.105), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        if (mode === 'build' && doneSet.has(index)) {
          ctx.fillStyle = 'rgba(33,31,27,.58)';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          if (cellSize >= 10) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = Math.max(1.4, cellSize * 0.11);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x * cellSize + cellSize * 0.24, y * cellSize + cellSize * 0.52);
            ctx.lineTo(x * cellSize + cellSize * 0.43, y * cellSize + cellSize * 0.7);
            ctx.lineTo(x * cellSize + cellSize * 0.78, y * cellSize + cellSize * 0.3);
            ctx.stroke();
          }
        }
      }
    }

    if (showGrid && cellSize >= 8) {
      ctx.strokeStyle = 'rgba(0,0,0,.075)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= pattern.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellSize + 0.5, 0);
        ctx.lineTo(x * cellSize + 0.5, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= pattern.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellSize + 0.5);
        ctx.lineTo(canvas.width, y * cellSize + 0.5);
        ctx.stroke();
      }
    }
  }, [pattern, cellSize, completed, doneSet, focusCode, mode, showGrid]);

  function toCell(clientX: number, clientY: number) {
    if (!pattern || !viewportRef.current) return null;
    const rect = viewportRef.current.getBoundingClientRect();
    const localX = (clientX - rect.left - pan.x) / zoom;
    const localY = (clientY - rect.top - pan.y) / zoom;
    const x = Math.floor(localX / cellSize);
    const y = Math.floor(localY / cellSize);
    if (x < 0 || y < 0 || x >= pattern.width || y >= pattern.height) return null;
    const index = y * pattern.width + x;
    return { x, y, index, code: pattern.cells[index] };
  }

  function paintCell(cell: ReturnType<typeof toCell>) {
    if (!cell || !pattern || locked) return;
    if (pointerRef.current?.lastIndex === cell.index) return;
    if (pointerRef.current) pointerRef.current.lastIndex = cell.index;
    if (mode === 'build') return;
    if (tool === 'picker') {
      if (cell.code) {
        onPick?.(cell.code);
        onToolChange?.('brush');
      }
      return;
    }
    const code = tool === 'eraser' ? null : selectedCode;
    onPaint?.(cell.index, code);
  }

  function onPointerDown(ev: ReactPointerEvent<HTMLDivElement>) {
    if (!pattern) return;
    const panAction = ev.button === 1 || spaceRef.current || (mode === 'paint' && tool === 'pan');
    if (panAction) {
      ev.preventDefault();
      ev.currentTarget.setPointerCapture(ev.pointerId);
      pointerRef.current = {
        id: ev.pointerId,
        action: 'pan',
        lastClient: { x: ev.clientX, y: ev.clientY },
        lastIndex: -1,
      };
      return;
    }

    const cell = toCell(ev.clientX, ev.clientY);
    if (!cell) return;
    if (mode === 'build') {
      if (!locked && cell.code) onToggleCompleted?.(cell.index);
      return;
    }
    if (locked) return;

    ev.currentTarget.setPointerCapture(ev.pointerId);
    pointerRef.current = {
      id: ev.pointerId,
      action: 'paint',
      lastClient: { x: ev.clientX, y: ev.clientY },
      lastIndex: -1,
    };
    if (tool !== 'picker') onEditStart?.();
    paintCell(cell);
  }

  function onPointerMove(ev: ReactPointerEvent<HTMLDivElement>) {
    setHover(toCell(ev.clientX, ev.clientY));
    const current = pointerRef.current;
    if (!current || current.id !== ev.pointerId) return;
    if (current.action === 'pan') {
      const dx = ev.clientX - current.lastClient.x;
      const dy = ev.clientY - current.lastClient.y;
      current.lastClient = { x: ev.clientX, y: ev.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      return;
    }
    if (current.action === 'paint') paintCell(toCell(ev.clientX, ev.clientY));
  }

  function onPointerUp(ev: ReactPointerEvent<HTMLDivElement>) {
    if (pointerRef.current?.id === ev.pointerId) pointerRef.current = null;
  }

  function onWheel(ev: ReactWheelEvent<HTMLDivElement>) {
    if (!pattern || !viewportRef.current) return;
    ev.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const cursorX = ev.clientX - rect.left;
    const cursorY = ev.clientY - rect.top;
    const worldX = (cursorX - pan.x) / zoom;
    const worldY = (cursorY - pan.y) / zoom;
    const factor = ev.deltaY < 0 ? 1.12 : 0.89;
    const nextZoom = clamp(zoom * factor, 0.18, 5);
    setZoom(nextZoom);
    setPan({ x: cursorX - worldX * nextZoom, y: cursorY - worldY * nextZoom });
  }

  useEffect(() => {
    function down(ev: KeyboardEvent) {
      if (ev.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((ev.target as HTMLElement)?.tagName || '')) {
        spaceRef.current = true;
      }
    }
    function up(ev: KeyboardEvent) {
      if (ev.code === 'Space') spaceRef.current = false;
    }
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const cursor = locked
    ? 'not-allowed'
    : mode === 'build'
      ? 'pointer'
      : tool === 'pan'
        ? 'grab'
        : tool === 'picker'
          ? 'copy'
          : 'crosshair';

  return (
    <div className="workspace-shell">
      <div
        ref={viewportRef}
        className="workspace-viewport"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onWheel={onWheel}
      >
        <canvas
          ref={canvasRef}
          className="workspace-canvas"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        />
        {!pattern && <div className="workspace-empty">上传图片或导入工程开始</div>}
      </div>
      <div className="workspace-statusbar">
        <span>{pattern ? `${pattern.width} × ${pattern.height}` : '空工作区'}</span>
        <span>{hover ? `第 ${hover.y + 1} 行 / 第 ${hover.x + 1} 列 · ${hover.code || '空'}` : '移动鼠标查看坐标'}</span>
        <div className="workspace-zoom">
          <button type="button" onClick={() => setZoom((z) => clamp(z / 1.2, 0.18, 5))}>−</button>
          <b>{Math.round(zoom * 100)}%</b>
          <button type="button" onClick={() => setZoom((z) => clamp(z * 1.2, 0.18, 5))}>＋</button>
          <button type="button" onClick={resetView}>适应</button>
        </div>
      </div>
    </div>
  );
}
