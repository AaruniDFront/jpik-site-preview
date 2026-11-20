(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- HERO · MOUSE TRAIL ---------------- */
  const hero = document.getElementById('hero');
  const layer = document.getElementById('trail');
  const SRC = Array.from({ length: 28 }, (_, i) => `img/trail/t${String(i + 1).padStart(2, '0')}.jpg`);

  // pré-carregar para que nunca apareça um quadro vazio
  SRC.forEach(s => { const im = new Image(); im.decoding = 'async'; im.src = s; });

  const SHAPES = [ [1, 0.74], [0.82, 1.32], [0.95, 1.0], [1.05, 0.8] ]; // [escala largura, rácio altura/largura]
  const MAX_VISIBLE = 7;
  const POOL_SIZE = MAX_VISIBLE + 4;
  const HOLD = 850;       // ms visível antes de sair
  const EASE = 'cubic-bezier(.2,.7,.1,1)';

  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const el = document.createElement('div');
    el.className = 'trail-img';
    const img = document.createElement('img');
    img.alt = '';
    el.appendChild(img);
    layer.appendChild(el);
    pool.push({ el, img, busy: false, timer: 0, anims: [] });
  }

  let order = [...SRC].sort(() => Math.random() - .5);
  let idx = 0, z = 1, poolIdx = 0;
  const live = [];

  let last = null;                 // última posição onde nasceu uma imagem
  let prev = null;                 // última posição do cursor
  const baseW = () => Math.max(110, Math.min(230, hero.clientWidth * 0.135));
  const step = () => Math.max(60, baseW() * 0.62);

  function kill(item, fast) {
    clearTimeout(item.timer);
    const { el, img } = item;
    const d = fast ? 420 : 750;
    item.anims.forEach(a => a.cancel());
    item.anims = [
      el.animate(
        [{ opacity: 1, transform: el.dataset.t + ' scale(1)' },
         { opacity: 0, transform: el.dataset.t + ' scale(.86)' }],
        { duration: d, easing: EASE, fill: 'forwards' }),
      img.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }], { duration: d, easing: EASE, fill: 'forwards' })
    ];
    item.anims[0].onfinish = () => { item.busy = false; };
    const i = live.indexOf(item);
    if (i > -1) live.splice(i, 1);
  }

  function spawn(x, y, dx, dy) {
    let item = pool[poolIdx];
    poolIdx = (poolIdx + 1) % POOL_SIZE;
    if (item.busy) { item.anims.forEach(a => a.cancel()); clearTimeout(item.timer); const i = live.indexOf(item); if (i > -1) live.splice(i, 1); }

    const [sw, ar] = SHAPES[(idx) % SHAPES.length];
    const w = baseW() * sw, h = w * ar;
    const { el, img } = item;
    img.src = order[idx % order.length];
    idx++;
    if (idx % order.length === 0) order.sort(() => Math.random() - .5);

    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.margin = `${-h / 2}px 0 0 ${-w / 2}px`;
    el.style.zIndex = ++z;
    const t = `translate3d(${x}px, ${y}px, 0)`;
    const t0 = `translate3d(${x - dx * 0.35}px, ${y - dy * 0.35}px, 0)`;
    el.dataset.t = t;
    item.busy = true;

    item.anims = [
      el.animate(
        [{ opacity: 0, transform: t0 + ' scale(.7)', clipPath: 'inset(18% 18% 18% 18%)' },
         { opacity: 1, transform: t + ' scale(1)', clipPath: 'inset(0% 0% 0% 0%)' }],
        { duration: 700, easing: EASE, fill: 'forwards' }),
      img.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 900, easing: EASE, fill: 'forwards' })
    ];

    live.push(item);
    while (live.length > MAX_VISIBLE) kill(live[0], true);
    item.timer = setTimeout(() => kill(item, false), HOLD);
  }

  function move(x, y) {
    if (!prev) prev = { x, y };
    if (!last) last = { x, y };
    const dist = Math.hypot(x - last.x, y - last.y);
    if (dist > step()) {
      spawn(x, y, x - prev.x, y - prev.y);
      last = { x, y };
    }
    prev = { x, y };
  }

  function local(e) {
    const r = hero.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  // ---- autoplay suave (sem rato / mobile / inatividade) ----
  let auto = true, autoT = 0, autoRaf = 0, idleTimer = 0, heroVisible = true;
  function autoLoop(ts) {
    if (!auto || !heroVisible) { autoRaf = 0; return; }
    autoT += 0.0042;
    const W = hero.clientWidth, H = hero.clientHeight;
    const x = W * (0.5 + 0.36 * Math.sin(autoT * 2.1));
    const y = H * (0.56 + 0.2 * Math.sin(autoT * 3.3 + 1.2));
    move(x, y);
    autoRaf = requestAnimationFrame(autoLoop);
  }
  function startAuto() { if (reduced) return; auto = true; last = prev = null; if (!autoRaf) autoRaf = requestAnimationFrame(autoLoop); }
  function stopAuto() { auto = false; last = prev = null; }

  if (!reduced) {
    hero.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse') {
        if (auto) { stopAuto(); hero.classList.add('touched'); }
        clearTimeout(idleTimer);
        idleTimer = setTimeout(startAuto, 6000);
      } else {
        stopAuto();
        clearTimeout(idleTimer);
        idleTimer = setTimeout(startAuto, 3000);
      }
      const [x, y] = local(e);
      move(x, y);
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { last = prev = null; });

    new IntersectionObserver(([en]) => {
      heroVisible = en.isIntersecting;
      if (heroVisible && auto && !autoRaf) autoRaf = requestAnimationFrame(autoLoop);
    }).observe(hero);

    setTimeout(startAuto, 1400);
  }

  /* ---------------- NAV ---------------- */
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > document.querySelector('.hero-top').offsetHeight - 60);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- REVEAL ---------------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ---------------- SERVIÇOS · hover com preview ---------------- */
  const sec = document.getElementById('services');
  const items = [...sec.querySelectorAll('li')];
  const prevBox = document.getElementById('sPreview');
  const prevImg = prevBox.querySelector('img');
  const DEFAULT = 2;
  let px = 0, py = 0, tx = 0, ty = 0, raf = 0;

  function setActive(li) {
    items.forEach(i => i.classList.toggle('active', i === li));
    if (prevImg.getAttribute('src') !== li.dataset.img) prevImg.src = li.dataset.img;
    const sr = sec.getBoundingClientRect(), lr = li.getBoundingClientRect();
    ty = lr.top - sr.top + lr.height / 2 - prevBox.offsetHeight / 2;
    prevBox.classList.add('on');
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    px += (tx - px) * 0.12; py += (ty - py) * 0.12;
    prevBox.style.transform = `translate3d(${px}px, ${py}px, 0)`;
    raf = Math.abs(tx - px) + Math.abs(ty - py) > 0.3 ? requestAnimationFrame(tick) : 0;
  }
  function resetPos() {
    tx = sec.clientWidth * 0.62; px = tx;
    setActive(items[DEFAULT]); py = ty;
    prevBox.style.transform = `translate3d(${px}px, ${py}px, 0)`;
  }
  items.forEach(li => li.addEventListener('mouseenter', () => setActive(li)));
  sec.addEventListener('mousemove', e => {
    const r = sec.getBoundingClientRect();
    tx = Math.min(Math.max(e.clientX - r.left - prevBox.offsetWidth / 2, sec.clientWidth * 0.35), sec.clientWidth * 0.72);
    if (!raf) raf = requestAnimationFrame(tick);
  });
  sec.querySelector('ul').addEventListener('mouseleave', () => { tx = sec.clientWidth * 0.62; setActive(items[DEFAULT]); });
  addEventListener('load', resetPos);
  addEventListener('resize', resetPos);
  resetPos();

  /* ---------------- CASOS · arrastar ---------------- */
  const track = document.getElementById('casesTrack');
  let down = false, sx = 0, sl = 0;
  track.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = track.scrollLeft; track.style.cursor = 'grabbing'; });
  addEventListener('pointerup', () => { down = false; track.style.cursor = ''; });
  addEventListener('pointermove', e => { if (down) track.scrollLeft = sl - (e.clientX - sx); });
})();
