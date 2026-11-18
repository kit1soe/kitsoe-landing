const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')!;
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const themeButtons = document.querySelectorAll<HTMLButtonElement>('.theme-toggle');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let themeChanging = false;
const resolvedTheme = () => themeMeta.content === 'light dark' ? (systemTheme.matches ? 'dark' : 'light') : themeMeta.content;
function syncTheme() {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  themeButtons.forEach(button => {
    button.setAttribute('aria-label',theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
    button.title = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
  });
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {meta.content=theme==='dark'?'#181818':'#f5f3ef';});
}
themeButtons.forEach(button => button.addEventListener('click',() => {
  if(themeChanging) return;
  const target = resolvedTheme()==='dark'?'light':'dark';
  const system = systemTheme.matches?'dark':'light';
  const preference = target === system ? null : target;
  const applyTheme = () => {
    themeMeta.content = preference ?? 'light dark';
    try { if(preference) localStorage.setItem('kitsoe-theme',preference); else localStorage.removeItem('kitsoe-theme'); } catch { /* Persistence is optional. */ }
    syncTheme();
  };
  // Only the palette changes. Keep focus on the same toggle throughout.
  if(!document.startViewTransition || reducedMotion.matches) { applyTheme(); return; }
  themeChanging = true;
  const transition = document.startViewTransition(applyTheme);
  void transition.finished.catch(() => { /* A skipped visual transition still applies the theme. */ }).finally(() => { themeChanging = false; });
}));
systemTheme.addEventListener('change',syncTheme);
addEventListener('storage',event => {
  if(event.key!=='kitsoe-theme' && event.key!==null) return;
  themeMeta.content=event.newValue==='dark'||event.newValue==='light'?event.newValue:'light dark';
  syncTheme();
});
syncTheme();

const lightField=document.querySelector<HTMLElement>('[data-light-field]');
const atmosphere=lightField?.querySelector<HTMLElement>('.hero-atmosphere');
const cursorLight=lightField?.querySelector<HTMLElement>('.cursor-light');
const atmosphereToggle=lightField?.querySelector<HTMLButtonElement>('.atmosphere-toggle');
atmosphereToggle?.addEventListener('click',()=>{
  const paused=lightField?.dataset.motionPaused !== 'true';
  if(lightField) lightField.dataset.motionPaused=String(paused);
  if(paused) { atmosphere?.classList.remove('is-active'); lightField?.style.removeProperty('--hero-depth-x'); lightField?.style.removeProperty('--hero-depth-y'); }
  atmosphereToggle.textContent=paused?'Включить движение ▶':'Остановить движение Ⅱ';
});
if(lightField && atmosphere && cursorLight && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  let frame=0, clientX=0, clientY=0;
  lightField.addEventListener('pointermove',event=>{
    if(reducedMotion.matches || lightField.dataset.motionPaused==='true') return;
    clientX=event.clientX; clientY=event.clientY;
    if(!frame) frame=requestAnimationFrame(()=>{
      if(!reducedMotion.matches && lightField.dataset.motionPaused!=='true') {
        const bounds=atmosphere.getBoundingClientRect();
        const x=clientX-bounds.left, y=clientY-bounds.top;
        cursorLight.style.transform=`translate(${x}px, ${y}px) translate(-50%, -50%)`;
        lightField.style.setProperty('--hero-depth-x',`${(x/bounds.width-.5)*12}px`);
        lightField.style.setProperty('--hero-depth-y',`${(y/bounds.height-.5)*12}px`);
      }
      frame=0;
    });
    atmosphere.classList.add('is-active');
  });
  const clearHeroEffect=()=>{cancelAnimationFrame(frame); frame=0; atmosphere.classList.remove('is-active'); lightField.style.removeProperty('--hero-depth-x'); lightField.style.removeProperty('--hero-depth-y');};
  lightField.addEventListener('pointerleave',clearHeroEffect);
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches) clearHeroEffect();});
}

// Decorative reflections do not cover controls or carry information.
if(matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll<HTMLElement>('.demo-window, .service-row, .lab-preview').forEach(card=>{
    let frame=0, clientX=0, clientY=0;
    card.addEventListener('pointermove',event=>{
      if(reducedMotion.matches || lightField?.dataset.motionPaused==='true') return;
      clientX=event.clientX; clientY=event.clientY;
      if(!frame) frame=requestAnimationFrame(()=>{
        const bounds=card.getBoundingClientRect();
        const x=clientX-bounds.left, y=clientY-bounds.top;
        card.style.setProperty('--light-x',`${x}px`); card.style.setProperty('--light-y',`${y}px`);
        card.style.setProperty('--depth-x',`${(x/bounds.width-.5)*16}px`); card.style.setProperty('--depth-y',`${(y/bounds.height-.5)*16}px`);
        frame=0;
      });
      card.classList.add('is-lit');
    });
    const clearEffect=()=>{
      cancelAnimationFrame(frame); frame=0; card.classList.remove('is-lit');
      card.style.removeProperty('--depth-x'); card.style.removeProperty('--depth-y');
    };
    card.addEventListener('pointerleave',clearEffect);
    reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches) clearEffect();});
    atmosphereToggle?.addEventListener('click',()=>{if(lightField?.dataset.motionPaused==='true') clearEffect();});
  });
}

const menu=document.querySelector<HTMLDialogElement>('#mobile-menu');
const toggle=document.querySelector<HTMLButtonElement>('.menu-toggle');
if(menu && toggle) {
  toggle.addEventListener('click',()=> {menu.showModal();toggle.setAttribute('aria-expanded','true');});
  menu.querySelector('.menu-close')?.addEventListener('click',()=>menu.close());
  menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>menu.close()));
  menu.addEventListener('close',()=> {toggle.setAttribute('aria-expanded','false');menu.returnValue='';});
  const header=toggle.closest<HTMLElement>('.site-header');
  if(header && 'ResizeObserver' in window) new ResizeObserver(()=> {
    if(menu.open && getComputedStyle(toggle).display==='none') menu.close();
  }).observe(header);
  else matchMedia('(min-width: 601px)').addEventListener('change',event=> {if(event.matches && menu.open) menu.close();});
}

const lamp=document.querySelector<HTMLElement>('[data-lamp]');
if(lamp) {
  lamp.querySelectorAll<HTMLInputElement>('input[name="surface"]').forEach(input=>input.addEventListener('change',()=>{lamp.dataset.surface=input.value;}));
  const light=lamp.querySelector<HTMLButtonElement>('.light-switch')!;
  light.addEventListener('click',()=>{
    const enabled=lamp.dataset.lit!=='true';
    lamp.dataset.lit=String(enabled);
    light.setAttribute('aria-pressed',String(enabled));
  });
  const brightness=lamp.querySelector<HTMLInputElement>('#brightness')!;
  brightness.addEventListener('input',()=>{
    lamp.style.setProperty('--lamp-brightness',String(.65+Number(brightness.value)/200));
    lamp.style.setProperty('--lamp-glow',String(Number(brightness.value)/130));
    lamp.querySelector('#brightness-value')!.textContent=`${brightness.value}%`;
  });
}

const booking=document.querySelector<HTMLElement>('[data-booking]');
const styleLab=document.querySelector<HTMLElement>('[data-style-lab]');
styleLab?.querySelectorAll<HTMLInputElement>('input[name="lab-palette"]').forEach(input=>{
  input.disabled=false;
  input.addEventListener('change',()=>{
    styleLab.dataset.palette=input.value;
    const index=styleLab.querySelector<HTMLElement>('[data-lab-index]');
    if(index) index.textContent=`${String(['wine','forest','stone'].indexOf(input.value)+1).padStart(2,'0')} / 03`;
  });
});
styleLab?.querySelectorAll<HTMLInputElement>('input[name="lab-tone"]').forEach(input=>{
  input.disabled=false;
  input.addEventListener('change',()=>{styleLab.dataset.tone=input.value;});
});
if(booking) {
  booking.querySelectorAll<HTMLButtonElement>('button').forEach(button=> {button.disabled=false;});
  booking.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.addEventListener('click',()=>{
    const group=button.hasAttribute('data-day')?'data-day':'data-slot';
    booking.querySelectorAll(`[${group}]`).forEach(peer=>peer.setAttribute('aria-pressed',String(peer===button)));
    const day=booking.querySelector<HTMLElement>('[data-day][aria-pressed="true"]')!.dataset.day;
    const slot=booking.querySelector<HTMLElement>('[data-slot][aria-pressed="true"]')!.dataset.slot;
    booking.querySelector('[data-booking-selection]')!.textContent=`Выбрано: ${day?.toLowerCase()}, ${slot}.`;
  }));
}
const tasks=document.querySelector<HTMLElement>('[data-tasks]');
tasks?.querySelectorAll<HTMLInputElement>('input').forEach(input=> {input.disabled=false;});
tasks?.addEventListener('change',()=>{
  const count=tasks.querySelectorAll('input:checked').length;
  tasks.querySelector<HTMLProgressElement>('progress')!.value=count;
  tasks.querySelector('[data-progress-text]')!.textContent=`${count} из 3`;
});

if('IntersectionObserver' in window) {
  const reveals=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        reveals.unobserve(entry.target);
      } else if(!entry.target.classList.contains('reveal-ready')) {
        // Use observer-provided geometry; never hide content already above the viewport.
        if(entry.boundingClientRect.top > (entry.rootBounds?.bottom ?? innerHeight)) entry.target.classList.add('reveal-ready');
        else reveals.unobserve(entry.target);
      }
    });
  },{threshold:.08});
  if(!reducedMotion.matches) {
    document.querySelectorAll<HTMLElement>('[data-reveal]').forEach(element=>reveals.observe(element));
  }
  const tagline=document.querySelector<HTMLElement>('.word-reveal');
  if(tagline && !reducedMotion.matches) {
    const text=tagline.textContent?.trim() ?? '';
    const readable=document.createElement('span'); readable.className='visually-hidden'; readable.textContent=text;
    tagline.textContent='';tagline.append(readable);tagline.classList.add('is-ready');
    const words=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting) {
          const word=entry.target as HTMLElement;
          word.style.transitionDelay=`${Math.min(Number(word.dataset.index)*45,600)}ms`;
          word.classList.add('is-visible');words.unobserve(word);
        }
      });
    },{rootMargin:'0px 0px -15% 0px',threshold:1});
    text.split(' ').forEach((word,index)=>{
      const span=document.createElement('span');span.textContent=word;span.dataset.index=String(index);span.setAttribute('aria-hidden','true');
      tagline.append(span,document.createTextNode(' '));words.observe(span);
    });
  }
  const navigation=new IntersectionObserver(entries=>{
    for(const entry of entries) if(entry.isIntersecting) {
      document.querySelectorAll<HTMLAnchorElement>('.desktop-nav a').forEach(link=>{
        if(link.hash===`#${entry.target.id}`) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current');
      });
    }
  },{rootMargin:'-15% 0px -65% 0px'});
  document.querySelectorAll('section[id]').forEach(section=>navigation.observe(section));
}
