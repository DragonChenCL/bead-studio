import { useEffect, useMemo, useState } from 'react';
import { paletteByCode, summarizeUsage } from '../core/engine';
import { loadProgressFor, loadProject } from '../core/storage';
import type { Pattern } from '../core/types';
import './ShareLauncher.css';

type ShareMode = 'finish' | 'opinion' | 'report';
type ShareCopy = { label: string; title: string; headline: string; content: string; tags: string };

type MiniTool = {
  writeTempFile?: (options: { data: string }) => Promise<{ filePath?: string }>;
  postNote?: (options: {
    title?: string;
    content?: string;
    tags?: string;
    mediaInfo: { image_resources: Array<{ url: string }> };
  }) => Promise<unknown>;
};

const CANVAS_W = 900;
const CANVAS_H = 1200;
const BG = '#f4eee7';
const PAPER = '#fffaf4';
const INK = '#2d2824';
const MUTED = '#7d7167';
const GREEN = '#4f6e5b';
const PINK = '#bd737c';

function safeText(text: string, max: number) {
  const value = (text || '').trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function getProgress(pattern: Pattern | null, completed: number[]) {
  if (!pattern) return { total: 0, done: 0, percent: 0 };
  let total = 0;
  let done = 0;
  const set = new Set(completed);
  pattern.cells.forEach((code, index) => {
    if (!code) return;
    total += 1;
    if (set.has(index)) done += 1;
  });
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

function getCopy(mode: ShareMode, pattern: Pattern, total: number, colors: number, progress: number): ShareCopy {
  const name = safeText(pattern.name || '我的拼豆', 8);
  if (mode === 'opinion') {
    return {
      label: '开坑求意见',
      title: '这张图值得开坑吗？',
      headline: '这张图，值得开坑吗？',
      content: `刚把「${name}」转成了拼豆图纸。\n\n${pattern.width}×${pattern.height}，大约 ${total} 颗豆、${colors} 个颜色。\n\n有点想开坑，又怕拼到一半后悔😂\n玩拼豆的朋友帮我看看，这个复杂度值得冲吗？`,
      tags: '#拼豆 #拼豆图纸 #手工 #像素画',
    };
  }
  if (mode === 'report') {
    return {
      label: '数据报告',
      title: safeText(`${total}颗拼豆是什么体验`, 20),
      headline: `${total.toLocaleString()} 颗豆，是什么体验？`,
      content: `记录一下「${name}」这张拼豆。\n\n尺寸：${pattern.width}×${pattern.height}\n总豆数：${total}\n颜色：${colors} 种\n当前进度：${progress}%\n\n做大图以后才发现，出图只是第一步，备豆、施工进度和检查才是真正磨人的地方。`,
      tags: '#拼豆 #手工日常 #拼豆记录 #像素画',
    };
  }
  return {
    label: '晒成品',
    title: safeText(`${name}终于拼完了`, 20),
    headline: progress >= 100 ? '最后一颗豆，也有仪式感。' : '一点一点，把它拼出来。',
    content: `「${name}」进度 ${progress}%！\n\n${pattern.width}×${pattern.height}，${total} 颗豆，${colors} 个颜色。\n\n这次把图纸、用豆统计和施工进度都记在一个地方，终于不用每次重新数一遍。${progress >= 100 ? '\n\n拼完的这一刻还是很爽。' : '\n\n继续慢慢填满。'}`,
    tags: '#拼豆 #拼豆作品 #手工 #手作 #像素画',
  };
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function fillRound(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  roundedRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const chars = Array.from(text);
  let line = '';
  let row = 0;
  for (let i = 0; i < chars.length; i += 1) {
    const candidate = line + chars[i];
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y + row * lineHeight);
      row += 1;
      if (row >= maxLines) return;
      line = chars[i];
    } else {
      line = candidate;
    }
  }
  if (line && row < maxLines) ctx.fillText(line, x, y + row * lineHeight);
}

function drawBrand(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = GREEN;
  ctx.font = '700 23px sans-serif';
  ctx.fillText('拼豆工作台', 72, 74);
  ctx.fillStyle = MUTED;
  ctx.font = '500 17px sans-serif';
  ctx.fillText('设计 · 备豆 · 施工 · 验收', 72, 106);
}

function drawPattern(ctx: CanvasRenderingContext2D, pattern: Pattern, x: number, y: number, w: number, h: number) {
  fillRound(ctx, x, y, w, h, 34, '#efe6dd');
  const pad = 34;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const cell = Math.min(innerW / Math.max(1, pattern.width), innerH / Math.max(1, pattern.height));
  const artW = cell * pattern.width;
  const artH = cell * pattern.height;
  const ox = x + (w - artW) / 2;
  const oy = y + (h - artH) / 2;
  ctx.fillStyle = '#ddd4ca';
  ctx.fillRect(ox - 8, oy - 8, artW + 16, artH + 16);
  for (let row = 0; row < pattern.height; row += 1) {
    for (let col = 0; col < pattern.width; col += 1) {
      const code = pattern.cells[row * pattern.width + col];
      if (!code) continue;
      ctx.fillStyle = paletteByCode.get(code)?.hex || '#d8d2c8';
      ctx.fillRect(ox + col * cell, oy + row * cell, Math.max(1, cell + 0.25), Math.max(1, cell + 0.25));
    }
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, text = '由拼豆工作台生成 · 小红书小工具') {
  ctx.fillStyle = MUTED;
  ctx.font = '500 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H - 54);
  ctx.textAlign = 'left';
}

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  return { canvas, ctx };
}

function renderCover(pattern: Pattern, copy: ShareCopy, total: number, colors: number, progress: number) {
  const { canvas, ctx } = makeCanvas();
  drawBrand(ctx);
  ctx.fillStyle = INK;
  ctx.font = '800 54px sans-serif';
  drawText(ctx, copy.headline, 72, 164, 756, 68, 2);
  ctx.fillStyle = MUTED;
  ctx.font = '500 22px sans-serif';
  ctx.fillText(`${pattern.width}×${pattern.height} · ${total.toLocaleString()} 颗 · ${colors} 色 · 进度 ${progress}%`, 72, 306);
  drawPattern(ctx, pattern, 72, 360, 756, 660);
  fillRound(ctx, 72, 1044, 756, 70, 24, GREEN);
  ctx.fillStyle = '#fff';
  ctx.font = '700 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(safeText(pattern.name || '我的拼豆', 24), CANVAS_W / 2, 1089);
  ctx.textAlign = 'left';
  drawFooter(ctx);
  return canvas.toDataURL('image/jpeg', 0.84);
}

function renderStats(pattern: Pattern, total: number, colors: number, progress: number) {
  const { canvas, ctx } = makeCanvas();
  drawBrand(ctx);
  ctx.fillStyle = INK;
  ctx.font = '800 52px sans-serif';
  ctx.fillText('这一张，到底有多大？', 72, 174);
  ctx.fillStyle = MUTED;
  ctx.font = '500 22px sans-serif';
  ctx.fillText(safeText(pattern.name || '我的拼豆', 28), 72, 226);
  const metrics = [
    [String(pattern.width), '宽度 / 格'],
    [String(pattern.height), '高度 / 格'],
    [total.toLocaleString(), '总豆数'],
    [String(colors), '颜色数'],
  ];
  metrics.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 72 + col * 378;
    const y = 310 + row * 230;
    fillRound(ctx, x, y, 342, 190, 30, PAPER);
    ctx.fillStyle = index === 2 ? PINK : GREEN;
    ctx.font = '800 54px sans-serif';
    ctx.fillText(item[0], x + 30, y + 64);
    ctx.fillStyle = MUTED;
    ctx.font = '500 20px sans-serif';
    ctx.fillText(item[1], x + 30, y + 118);
  });
  ctx.fillStyle = INK;
  ctx.font = '700 28px sans-serif';
  ctx.fillText('施工进度', 72, 822);
  fillRound(ctx, 72, 866, 756, 34, 17, '#ded4ca');
  if (progress > 0) fillRound(ctx, 72, 866, 756 * Math.min(100, progress) / 100, 34, 17, GREEN);
  ctx.fillStyle = GREEN;
  ctx.font = '800 56px sans-serif';
  ctx.fillText(`${progress}%`, 72, 996);
  ctx.fillStyle = MUTED;
  ctx.font = '500 21px sans-serif';
  ctx.fillText(progress >= 100 ? '已经收工，可以安心晒了。' : '还在施工中，也值得记录。', 218, 984);
  drawFooter(ctx);
  return canvas.toDataURL('image/jpeg', 0.84);
}

function renderPalette(pattern: Pattern) {
  const { canvas, ctx } = makeCanvas();
  const usage = summarizeUsage(pattern.cells).slice().sort((a, b) => b.count - a.count);
  const top = usage.slice(0, 12);
  drawBrand(ctx);
  ctx.fillStyle = INK;
  ctx.font = '800 52px sans-serif';
  ctx.fillText('这一张，主要用了这些颜色', 72, 174);
  ctx.fillStyle = MUTED;
  ctx.font = '500 21px sans-serif';
  ctx.fillText(`共 ${usage.length} 个实际色号 · 按用量从高到低`, 72, 226);
  top.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 72 + col * 378;
    const y = 300 + row * 128;
    fillRound(ctx, x, y, 342, 102, 24, PAPER);
    ctx.beginPath();
    ctx.arc(x + 48, y + 51, 27, 0, Math.PI * 2);
    ctx.fillStyle = paletteByCode.get(item.code)?.hex || '#d8d2c8';
    ctx.fill();
    ctx.strokeStyle = 'rgba(45,40,36,.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '800 25px sans-serif';
    ctx.fillText(item.code, x + 92, y + 43);
    ctx.fillStyle = MUTED;
    ctx.font = '500 18px sans-serif';
    ctx.fillText(`${item.count.toLocaleString()} 颗`, x + 92, y + 72);
  });
  if (usage.length > 12) {
    ctx.fillStyle = MUTED;
    ctx.font = '500 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`还有 ${usage.length - 12} 个颜色没有展开`, CANVAS_W / 2, 1080);
    ctx.textAlign = 'left';
  }
  drawFooter(ctx);
  return canvas.toDataURL('image/jpeg', 0.84);
}

async function createShareImages(pattern: Pattern, copy: ShareCopy, completed: number[]) {
  const usage = summarizeUsage(pattern.cells);
  const progress = getProgress(pattern, completed);
  return [
    renderCover(pattern, copy, progress.total, usage.length, progress.percent),
    renderStats(pattern, progress.total, usage.length, progress.percent),
    renderPalette(pattern),
  ];
}

function getMiniTool(): MiniTool | null {
  const win = window as any;
  return win.xhs && win.xhs.miniTool ? win.xhs.miniTool as MiniTool : null;
}

export default function ShareLauncher() {
  const [pattern, setPattern] = useState<Pattern | null>(() => loadProject());
  const [completed, setCompleted] = useState<number[]>(() => loadProgressFor(loadProject()));
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ShareMode>('finish');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const sync = () => {
      const next = loadProject();
      if (!next) {
        setPattern(null);
        setCompleted([]);
        return;
      }
      setPattern((prev) => prev?.id === next.id && prev.updatedAt === next.updatedAt ? prev : next);
      setCompleted(loadProgressFor(next));
    };
    sync();
    const timer = window.setInterval(sync, 1200);
    return () => window.clearInterval(timer);
  }, []);

  const progress = useMemo(() => getProgress(pattern, completed), [pattern, completed]);
  const colors = useMemo(() => pattern ? summarizeUsage(pattern.cells).length : 0, [pattern]);
  const copy = useMemo(() => pattern ? getCopy(mode, pattern, progress.total, colors, progress.percent) : null, [mode, pattern, progress.total, colors, progress.percent]);

  if (!pattern || !copy) return null;

  async function publish() {
    if (!pattern || !copy || busy) return;
    setBusy(true);
    setMessage('正在生成 3 张分享卡…');
    try {
      const miniTool = getMiniTool();
      if (!miniTool || !miniTool.postNote) {
        setMessage('当前不是小红书小工具环境。分享卡逻辑已就绪，请在小红书小工具内使用“一键发笔记”。');
        return;
      }
      const dataUrls = await createShareImages(pattern, copy, completed);
      const mediaUrls: string[] = [];
      for (let i = 0; i < dataUrls.length; i += 1) {
        const data = dataUrls[i];
        if (miniTool.writeTempFile) {
          try {
            const result = await miniTool.writeTempFile({ data });
            if (result && result.filePath) {
              mediaUrls.push(result.filePath);
              continue;
            }
          } catch {
            // data: URI 本身也是 postNote 支持的媒体输入，写临时文件失败时回退。
          }
        }
        mediaUrls.push(data);
      }
      setMessage('正在打开小红书发布页…');
      await miniTool.postNote({
        title: safeText(copy.title, 20),
        content: safeText(copy.content, 1000),
        tags: copy.tags,
        mediaInfo: { image_resources: mediaUrls.map((url) => ({ url })) },
      });
      setMessage('已经交给小红书发布页，你可以继续编辑后发布。');
    } catch (error: any) {
      const text = error && error.errMsg ? String(error.errMsg) : '发笔记失败，请重试';
      setMessage(text.indexOf('cancel') >= 0 ? '已取消发布。' : `发布失败：${text}`);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button className="share-launcher" onClick={() => { setMessage(''); setOpen(true); }} aria-label="晒作品到小红书">
      <span>✦</span><b>晒作品</b>
    </button>

    <div className={`share-backdrop ${open ? 'show' : ''}`} onClick={() => !busy && setOpen(false)} />
    <section className={`share-sheet ${open ? 'show' : ''}`} aria-hidden={!open}>
      <div className="share-sheet-head">
        <div><span className="share-kicker">XIAOHONGSHU SHARE</span><h2>把这张作品晒出去</h2><p>自动生成 3 张图，并把标题、正文和标签带进发布页。</p></div>
        <button onClick={() => !busy && setOpen(false)} aria-label="关闭">×</button>
      </div>

      <div className="share-summary">
        <div><strong>{progress.total.toLocaleString()}</strong><span>颗豆</span></div>
        <div><strong>{colors}</strong><span>颜色</span></div>
        <div><strong>{progress.percent}%</strong><span>进度</span></div>
      </div>

      <div className="share-template-title"><b>这次想怎么发？</b><span>文案和封面语气会一起变化</span></div>
      <div className="share-template-list">
        {(['finish', 'opinion', 'report'] as ShareMode[]).map((key) => {
          const item = getCopy(key, pattern, progress.total, colors, progress.percent);
          return <button key={key} className={mode === key ? 'active' : ''} onClick={() => setMode(key)} disabled={busy}>
            <span>{key === 'finish' ? '✨' : key === 'opinion' ? '💬' : '📊'}</span>
            <div><b>{item.label}</b><small>{item.title}</small></div>
            <i>{mode === key ? '✓' : ''}</i>
          </button>;
        })}
      </div>

      <div className="share-note-preview">
        <span>发布预览</span>
        <b>{copy.title}</b>
        <p>{copy.content}</p>
        <em>{copy.tags}</em>
      </div>

      {message && <div className={`share-message ${message.indexOf('失败') >= 0 ? 'bad' : ''}`}>{message}</div>}

      <div className="share-actions">
        <button className="share-cancel" onClick={() => setOpen(false)} disabled={busy}>取消</button>
        <button className="share-primary" onClick={publish} disabled={busy}>{busy ? '正在准备素材…' : '生成 3 张图并发笔记'}</button>
      </div>
      <p className="share-footnote">会拉起小红书发布页，最后仍由你确认、编辑或取消发布。</p>
    </section>
  </>;
}
