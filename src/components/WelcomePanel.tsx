// @ts-nocheck

const HERO_BEADS = [
  '#f3c960','#f08975','#79b4b2','#f7e8c6','#ca7093','#809bc7','#f0a85d','#5c806a',
  '#f7e8c6','#ca7093','#f08975','#f3c960','#79b4b2','#f7e8c6','#809bc7','#f0a85d',
  '#79b4b2','#f7e8c6','#ca7093','#f08975','#f3c960','#5c806a','#f7e8c6','#ca7093',
  '#809bc7','#f0a85d','#f7e8c6','#ca7093','#f08975','#f3c960','#79b4b2','#f7e8c6',
  '#f0a85d','#5c806a','#79b4b2','#f7e8c6','#ca7093','#f08975','#f3c960','#809bc7',
  '#ca7093','#f08975','#f3c960','#79b4b2','#f7e8c6','#809bc7','#f0a85d','#5c806a',
];

export default function WelcomePanel({ gridWidth, setGridWidth, onUpload, records, onOpen }) {
  const presets = [29, 52, 87, 116];
  const recent = (records || []).slice(0, 3);

  return <main className="studio-home">
    <section className="studio-hero">
      <div className="studio-hero-copy">
        <div className="studio-badge"><i /> BEAD STUDIO · 本地优先</div>
        <h2>不是把图片像素化。<br/><em>是把它真的拼出来。</em></h2>
        <p>从选色、豆库、采购，到施工、验豆和熨烫。你只管做作品，工作台负责把容易忘、容易错的事情接起来。</p>
        <div className="studio-hero-actions">
          <label className="studio-upload-primary">
            <input type="file" accept="image/*" onChange={onUpload}/>
            <span>＋</span><b>选择图片开始创作</b><small>照片 / 动漫 / 宠物 / 像素图</small>
          </label>
          <div className="studio-local-proof"><b>100%</b><span>图片与工程数据<br/>默认留在浏览器本地</span></div>
        </div>
        <div className="studio-trust-row"><span>无需注册</span><span>自动保存</span><span>221 色 MARD</span><span>支持手机施工</span></div>
      </div>

      <div className="studio-hero-art" aria-hidden="true">
        <div className="studio-art-glow" />
        <div className="studio-board">
          <div className="studio-board-grid">
            {HERO_BEADS.map((color, i) => <i key={i} style={{ '--bead': color, '--delay': `${(i % 9) * 34}ms` }} />)}
          </div>
          <div className="studio-board-label"><b>WORK 01</b><span>52 × 39 · 1,462 beads</span></div>
        </div>
        <div className="studio-loose-bead bead-a"/><div className="studio-loose-bead bead-b"/><div className="studio-loose-bead bead-c"/>
        <div className="studio-art-card"><span>施工进度</span><b>76%</b><i><em style={{width:'76%'}}/></i></div>
      </div>
    </section>

    <section className="studio-start-panel">
      <div className="studio-start-copy">
        <span className="section-kicker">START SMART</span>
        <h3>先选尺寸，再上传图片</h3>
        <p>尺寸决定细节、耗豆量和施工时间。第一次建议从 52 格开始。</p>
      </div>
      <div className="studio-size-options">
        {presets.map(n => <button key={n} className={Number(gridWidth) === n ? 'active' : ''} onClick={() => setGridWidth(n)}>
          <b>{n}</b><span>格</span><small>{n <= 29 ? '小挂件' : n <= 52 ? '常规作品' : n <= 87 ? '精细作品' : '大幅作品'}</small>
        </button>)}
        <label className="studio-custom-size"><span>自定义</span><input type="number" min="8" max="160" value={gridWidth} onChange={e => setGridWidth(e.target.value)}/><small>8–160</small></label>
      </div>
    </section>

    <section className="studio-flow-section">
      <div className="studio-section-head"><div><span className="section-kicker">ONE WORKFLOW</span><h3>一个作品，从灵感走到完工</h3></div><p>不是堆功能，而是让下一步永远清楚。</p></div>
      <div className="studio-flow-grid">
        <article><i>01</i><div><b>设计</b><span>图片转图纸后继续改色、擦除、吸色。</span></div><em>→</em></article>
        <article><i>02</i><div><b>备豆</b><span>对照库存算缺口，必要时用库存约束改图。</span></div><em>→</em></article>
        <article><i>03</i><div><b>施工</b><span>按色聚焦、逐颗完成，手机端持续记进度。</span></div><em>→</em></article>
        <article><i>04</i><div><b>验收</b><span>拍照找错豆漏豆，再检查熨烫均匀度。</span></div><em>✓</em></article>
      </div>
    </section>

    {recent.length > 0 && <section className="studio-recent">
      <div className="studio-section-head"><div><span className="section-kicker">CONTINUE</span><h3>继续最近的作品</h3></div><p>进度保存在当前浏览器。</p></div>
      <div className="studio-recent-grid">{recent.map(r => {
        const total = r.pattern.cells?.filter(Boolean).length || 0;
        const done = (r.completed || []).filter(i => r.pattern.cells?.[i]).length;
        const pct = total ? Math.round(done * 100 / total) : 0;
        return <button key={r.pattern.id} onClick={() => onOpen(r)}>
          <div className="studio-recent-thumb"><span>{r.pattern.name.slice(0, 1)}</span><i style={{ '--progress': `${pct * 3.6}deg` }}/></div>
          <div className="studio-recent-copy"><b>{r.pattern.name}</b><span>{r.pattern.width}×{r.pattern.height} · {total.toLocaleString()} 颗</span><div className="progress-line"><i style={{width:`${pct}%`}}/></div></div>
          <strong>{pct}%<small>继续 →</small></strong>
        </button>;
      })}</div>
    </section>}
  </main>;
}
