// @ts-nocheck
export default function WelcomePanel({gridWidth,setGridWidth,onUpload,records,onOpen}){
  const presets=[29,52,87,116];
  const recent=(records||[]).slice(0,3);
  return <main className="welcome-shell">
    <section className="welcome-hero card">
      <div className="welcome-copy">
        <div className="eyebrow">YOUR PERSONAL BEAD STUDIO</div>
        <h2>把喜欢的图片，变成一件<br/><em>真正能拼完</em>的作品。</h2>
        <p>不是只把图片像素化。这里会陪你从选色、备豆、施工，到拍照验豆和熨烫检查，一直做到成品。</p>
        <div className="welcome-trust">
          <span>◌ 图片本地处理</span><span>◌ 豆库自动保存</span><span>◌ 无需注册登录</span>
        </div>
      </div>
      <div className="welcome-visual" aria-hidden="true">
        <div className="bead-orbit orbit-a"><i/><i/><i/><i/><i/></div>
        <div className="bead-orbit orbit-b"><i/><i/><i/><i/></div>
        <div className="bead-heart"><span>♥</span></div>
      </div>
    </section>

    <section className="welcome-start-grid">
      <div className="start-card card">
        <div className="start-number">01</div>
        <div className="start-copy"><h3>先选一个合适尺寸</h3><p>越大细节越多，但需要的豆和时间也会增加。</p></div>
        <div className="size-presets">{presets.map(n=><button key={n} className={Number(gridWidth)===n?'active':''} onClick={()=>setGridWidth(n)} data-help={`把图纸宽度设为 ${n} 格，适合${n<=29?'小挂件和头像':n<=52?'常规人物和宠物图':n<=87?'更精细的半身或场景':'大幅作品和高细节图'}`}><b>{n}</b><span>格</span></button>)}</div>
        <label className="custom-size">自定义宽度 <input type="number" min="8" max="160" value={gridWidth} onChange={e=>setGridWidth(e.target.value)}/></label>
      </div>

      <label className="upload-drop card" data-help="选择一张照片或插画，系统会按当前宽度生成拼豆图纸">
        <input type="file" accept="image/*" onChange={onUpload}/>
        <div className="upload-glyph"><span>＋</span></div>
        <h3>选择一张图片开始</h3>
        <p>照片、宠物、动漫、像素图都可以</p>
        <strong>上传图片 → 自动生成图纸</strong>
      </label>
    </section>

    <section className="welcome-flow">
      <div className="flow-head"><div><span>完整流程</span><h3>从一张图，到真正做完</h3></div><p>你不需要一次学会所有功能，按顺序走就行。</p></div>
      <div className="flow-cards">
        <div><i>1</i><b>设计图纸</b><span>像素化后继续手工改色、擦除、吸色。</span></div>
        <div><i>2</i><b>匹配豆库</b><span>库存不够时自动寻找损失更小的替代方案。</span></div>
        <div><i>3</i><b>开始施工</b><span>按色集中铺豆，进度自动记录。</span></div>
        <div><i>4</i><b>拍照验豆</b><span>找错色、漏豆，再把正确区域写回进度。</span></div>
      </div>
    </section>

    {recent.length>0&&<section className="recent-projects card">
      <div className="recent-head"><div><span>最近作品</span><h3>继续上次做到一半的作品</h3></div><small>所有进度都保存在当前浏览器</small></div>
      <div className="recent-list">{recent.map(r=>{const total=r.pattern.cells?.filter(Boolean).length||0;const done=(r.completed||[]).filter(i=>r.pattern.cells?.[i]).length;const pct=total?Math.round(done*100/total):0;return <button key={r.pattern.id} onClick={()=>onOpen(r)} data-help={`打开「${r.pattern.name}」并继续上次保存的设计或施工进度`}><div className="recent-art"><span>{r.pattern.name.slice(0,1)}</span></div><div><b>{r.pattern.name}</b><small>{r.pattern.width}×{r.pattern.height} · {pct}% 完成</small><div className="progress-line"><i style={{width:`${pct}%`}}/></div></div><strong>继续 →</strong></button>})}</div>
    </section>}
  </main>
}
