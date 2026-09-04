import { useEffect } from 'react';

const HELP: Array<[RegExp, string]> = [
  [/^新建$/, '创建一个新的空白作品；当前作品会自动保存在作品库。'],
  [/导入工程/, '读取之前导出的 JSON 工程文件，恢复图纸、库存和施工进度。'],
  [/导出工程/, '把当前图纸、豆库和施工进度保存成 JSON 文件，方便备份或换设备。'],
  [/^设计$/, '进入图纸编辑工作台，可以上传图片、换色、擦除和调整图纸。'],
  [/^施工$/, '进入实际拼豆流程，按格或按色号记录已经完成的豆子。'],
  [/^豆库$/, '管理手里每个色号的库存，并查看缺豆采购计划。'],
  [/拍照验豆/, '上传正在拼的实物照片，与当前图纸对比，检查错色、疑似色和漏豆。'],
  [/熨烫检测/, '上传背光成品照片，辅助检查熨烫孔洞和熔融是否均匀。'],
  [/作品库/, '查看浏览器里保存的所有拼豆作品，继续、复制或删除作品。'],
  [/上传图片/, '选择一张照片并转换为当前设定宽度的拼豆图纸。'],
  [/^画笔/, '使用当前选中的色号连续绘制或替换豆子；快捷键 B。'],
  [/^橡皮/, '删除图纸上的豆子，让对应格变为空；快捷键 E。'],
  [/^吸管/, '从图纸上点击一颗豆，直接选中它的色号；快捷键 I。'],
  [/拖动画布/, '拖动查看大图纸，不会修改豆子；快捷键 H。'],
  [/^撤销$/, '撤回最近一次图纸编辑操作。'],
  [/^重做$/, '恢复刚刚被撤销的图纸编辑操作。'],
  [/^网格$/, '显示或隐藏豆位网格，方便检查格子与构图。'],
  [/显示全部颜色/, '取消施工页的单色聚焦，恢复显示整张图纸。'],
  [/^0元版$/, '只使用现有库存重新分配颜色，不允许产生新的采购缺口。'],
  [/平衡版/, '允许少量补豆，用更小的色差保护画面还原度。'],
  [/按现有库存自动改图/, '计算一个严格不超过你当前库存数量的替代色方案。'],
  [/计算平衡方案/, '在限定最大色差的前提下，计算库存与还原度之间的折中方案。'],
  [/应用这个方案/, '把当前优化结果正式写回图纸，并重置施工进度。'],
  [/按图纸填满/, '把豆库数量快速设置为当前图纸刚好需要的数量，便于测试或初始化。'],
  [/^清空$/, '清空当前豆库中的所有库存数量。'],
  [/一键入库/, '把采购计划中的购买数量一次性加入豆库。'],
  [/导出 CSV/, '下载缺豆采购清单，可用于手机查看、打印或采购。'],
  [/清空进度/, '清除当前作品所有施工勾选，重新从 0% 开始。'],
  [/撤销扣库/, '把本作品消耗的豆加回库存，同时重新解锁图纸编辑。'],
  [/完成作品并扣减豆库/, '确认实物完成后，按这张图纸的实际用量一次性扣减豆库。'],
  [/本色完成/, '把该色号在整张图纸中的所有豆位标记为已完成。'],
  [/^上传照片$/, '上传实物拼豆板或熨烫成品照片，照片只在浏览器本地处理。'],
  [/重选四角/, '清除当前四角定位点，重新进行透视校准。'],
  [/开始检测/, '根据四角校准后的照片开始执行实物识别或熨烫检测。'],
  [/标记为已拼/, '把照片中确认正常的豆位同步写入施工进度。'],
  [/^复制$/, '复制这个作品为一个新工程，原作品不会被修改。'],
  [/^删除$/, '从本浏览器作品库中删除这个作品。'],
  [/^打开$/, '打开这个作品并继续设计或施工。'],
  [/放大|\+/, '放大工作区视图，只改变显示比例，不影响图纸。'],
  [/缩小|−|-/, '缩小工作区视图，方便查看更大的整体范围。'],
  [/适应|重置视图/, '自动调整缩放与位置，让整张图纸回到合适的可视范围。'],
];

function normalizeLabel(el: Element) {
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

function helpFor(el: Element) {
  const explicit = el.getAttribute('data-help');
  if (explicit) return explicit;
  const label = normalizeLabel(el);
  for (const [re, help] of HELP) {
    if (re.test(label)) return help;
  }
  return label ? `点击执行“${label}”操作。` : '点击执行这个操作。';
}

export default function ButtonHints() {
  useEffect(() => {
    const tooltip = document.createElement('div');
    tooltip.className = 'global-action-tip';
    tooltip.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltip);

    let active: Element | null = null;

    const annotate = () => {
      document.querySelectorAll('button, .filebtn').forEach((el) => {
        const help = helpFor(el);
        el.setAttribute('data-help', help);
        if (!el.getAttribute('title')) el.setAttribute('title', help);
        const label = normalizeLabel(el);
        if (label && !el.getAttribute('aria-label')) el.setAttribute('aria-label', `${label}：${help}`);
      });
    };

    const position = (x: number, y: number) => {
      const pad = 14;
      const width = Math.min(310, Math.max(190, tooltip.offsetWidth || 230));
      const left = Math.min(window.innerWidth - width - pad, Math.max(pad, x + 14));
      const top = Math.min(window.innerHeight - 86, Math.max(pad, y + 16));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };

    const show = (el: Element, x?: number, y?: number) => {
      active = el;
      const help = helpFor(el);
      tooltip.textContent = help;
      tooltip.classList.add('show');
      if (typeof x === 'number' && typeof y === 'number') position(x, y);
      else {
        const r = (el as HTMLElement).getBoundingClientRect();
        position(r.left + Math.min(r.width, 180) / 2, r.bottom);
      }
    };

    const hide = (el?: Element | null) => {
      if (el && active && el !== active) return;
      active = null;
      tooltip.classList.remove('show');
    };

    const buttonFrom = (target: EventTarget | null) => target instanceof Element ? target.closest('button, .filebtn') : null;

    const onOver = (ev: PointerEvent) => {
      const el = buttonFrom(ev.target);
      if (el) show(el, ev.clientX, ev.clientY);
    };
    const onMove = (ev: PointerEvent) => {
      if (active) position(ev.clientX, ev.clientY);
    };
    const onOut = (ev: PointerEvent) => {
      const el = buttonFrom(ev.target);
      if (!el) return;
      const next = ev.relatedTarget instanceof Element ? ev.relatedTarget.closest('button, .filebtn') : null;
      if (next === el) return;
      hide(el);
    };
    const onFocus = (ev: FocusEvent) => {
      const el = buttonFrom(ev.target);
      if (el) show(el);
    };
    const onBlur = (ev: FocusEvent) => hide(buttonFrom(ev.target));

    annotate();
    const observer = new MutationObserver(annotate);
    observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
    document.addEventListener('pointerover', onOver, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerout', onOut, true);
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('focusout', onBlur, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('pointerover', onOver, true);
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerout', onOut, true);
      document.removeEventListener('focusin', onFocus, true);
      document.removeEventListener('focusout', onBlur, true);
      tooltip.remove();
    };
  }, []);

  return null;
}
