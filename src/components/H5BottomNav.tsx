import { useState } from 'react';

type Props = {
  tab: string;
  hasPattern: boolean;
  onTab: (tab: string) => void;
  onNew: () => void;
  onImport: () => void;
  onExport: () => void;
};

function Icon({ name }: { name: string }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'design') return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 16l7.6-7.6 2 2L10 18H8v-2z"/></svg>;
  if (name === 'preview') return <svg {...common}><path d="M4.4 8.2L12 4l7.6 4.2v7.6L12 20l-7.6-4.2V8.2z"/><path d="M12 20v-7.7m7.4-4.1L12 12.3 4.6 8.2"/></svg>;
  if (name === 'build') return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="M8.5 12.2l2.2 2.2 4.8-5"/></svg>;
  if (name === 'stock') return <svg {...common}><path d="M7 6h10l1 3v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9l1-3z"/><path d="M9 6V4h6v2M9 12h6"/></svg>;
  return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></svg>;
}

export default function H5BottomNav({ tab, hasPattern, onTab, onNew, onImport, onExport }: Props) {
  const [more, setMore] = useState(false);
  const items = [
    ['work', 'design', '设计'],
    ['preview', 'preview', '3D'],
    ['build', 'build', '施工'],
    ['inventory', 'stock', '豆库'],
  ];
  const moreActive = tab === 'photo' || tab === 'iron' || tab === 'library';

  function go(next: string) {
    setMore(false);
    onTab(next);
  }

  return <>
    <nav className="h5-bottom-nav" aria-label="手机端主导航">
      {items.map(([key, icon, label]) => <button key={key} className={tab === key ? 'active' : ''} disabled={key === 'preview' && !hasPattern} onClick={() => go(key)}>
        <Icon name={icon}/><span>{label}</span>
      </button>)}
      <button className={moreActive || more ? 'active' : ''} onClick={() => setMore(v => !v)}>
        <Icon name="more"/><span>更多</span>
      </button>
    </nav>

    <div className={`h5-more-backdrop ${more ? 'show' : ''}`} onClick={() => setMore(false)} />
    <section className={`h5-more-sheet ${more ? 'show' : ''}`} aria-hidden={!more}>
      <div className="h5-sheet-grabber" />
      <div className="h5-more-title"><div><b>更多工具</b><span>验收、工程与作品管理</span></div><button onClick={() => setMore(false)} aria-label="关闭更多工具">×</button></div>
      <div className="h5-more-grid">
        <button onClick={() => go('photo')}><span className="h5-more-icon">◎</span><b>拍照验豆</b><small>找错色与漏豆</small></button>
        <button onClick={() => go('iron')}><span className="h5-more-icon">♨</span><b>熨烫检测</b><small>背光检查均匀度</small></button>
        <button onClick={() => go('library')}><span className="h5-more-icon">▤</span><b>作品库</b><small>继续之前的作品</small></button>
        <button onClick={() => { setMore(false); onNew(); }}><span className="h5-more-icon">＋</span><b>新建作品</b><small>从一张新图开始</small></button>
        <button onClick={() => { setMore(false); onImport(); }}><span className="h5-more-icon">↥</span><b>导入工程</b><small>恢复 JSON 工程</small></button>
        <button disabled={!hasPattern} onClick={() => { setMore(false); onExport(); }}><span className="h5-more-icon">↧</span><b>导出工程</b><small>备份当前作品</small></button>
      </div>
    </section>
  </>;
}
