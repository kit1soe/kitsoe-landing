import { initPageParticles } from './page-particles';

const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')!;
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const themeButtons = document.querySelectorAll<HTMLButtonElement>('.theme-toggle');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const lightField=document.querySelector<HTMLElement>('[data-light-field]');
let themeChanging = false;
const resolvedTheme = () => themeMeta.content === 'light dark' ? (systemTheme.matches ? 'dark' : 'light') : themeMeta.content;
function syncTheme() {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  themeButtons.forEach(button => {
    button.setAttribute('aria-label',theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
    button.title = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
  });
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {meta.content=theme==='dark'?'#1a171b':'#f7f3ef';});
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
  if (!document.startViewTransition || reducedMotion.matches || lightField?.dataset.motionPaused === 'true') {
    applyTheme();
    return;
  }
  // The icon is also the origin when the button is used from the keyboard.
  const { x, y, width, height } = button.getBoundingClientRect();
  const originX = x + width / 2;
  const originY = y + height / 2;
  const radius = Math.hypot(Math.max(originX, innerWidth - originX), Math.max(originY, innerHeight - originY));
  const root = document.documentElement;
  root.style.setProperty('--theme-wave-origin', `${originX}px ${originY}px`);
  root.style.setProperty('--theme-wave-radius', `${Math.ceil(radius) + 16}px`);
  themeChanging = true;
  const transition = document.startViewTransition(applyTheme);
  void transition.finished.catch(() => { /* A skipped visual transition still applies the theme. */ }).finally(() => {
    root.style.removeProperty('--theme-wave-origin');
    root.style.removeProperty('--theme-wave-radius');
    themeChanging = false;
  });
}));
systemTheme.addEventListener('change',syncTheme);
addEventListener('storage',event => {
  if(event.key!=='kitsoe-theme' && event.key!==null) return;
  themeMeta.content=event.newValue==='dark'||event.newValue==='light'?event.newValue:'light dark';
  syncTheme();
});
syncTheme();

const atmosphere=document.querySelector<HTMLElement>('[data-page-light]');
if (atmosphere) initPageParticles(atmosphere);
const atmosphereToggle=lightField?.querySelector<HTMLButtonElement>('.atmosphere-toggle');
if (lightField && atmosphere && 'IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    if (entry) atmosphere.classList.toggle('is-below-hero', entry.intersectionRatio < .5);
  }, { threshold: .5 }).observe(lightField);
}
atmosphereToggle?.addEventListener('click',()=>{
  const paused=lightField?.dataset.motionPaused !== 'true';
  if(lightField) lightField.dataset.motionPaused=String(paused);
  if(atmosphere) atmosphere.dataset.motionPaused=String(paused);
  atmosphereToggle.textContent=paused?'Включить движение ▶':'Остановить движение Ⅱ';
});

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
  const brightnessOutput=lamp.querySelector<HTMLOutputElement>('#brightness-value')!;
  brightness.addEventListener('input',()=>{
    lamp.style.setProperty('--lamp-power', String(brightness.valueAsNumber / 100));
    brightnessOutput.value = `${brightness.value}%`;
  });
}

const viewport = document.querySelector<HTMLElement>('[data-layout-viewport]');
const viewportWidth = document.querySelector<HTMLInputElement>('#layout-width');
const viewportStage = viewport?.parentElement;
const viewportOutput = document.querySelector<HTMLOutputElement>('output[for="layout-width"]');
if (viewport && viewportWidth && viewportStage && viewportOutput) {
  const maximum = Number(viewportWidth.max);
  let preferred = maximum;
  const setWidth = () => {
    const width = Math.min(preferred, Number(viewportWidth.max));
    viewportWidth.value = String(width);
    viewportWidth.setAttribute('aria-valuetext', `${width} пикселей`);
    viewportOutput.value = `${width} px`;
    viewport.style.setProperty('--preview-width', `${width}px`);
  };
  viewportWidth.addEventListener('input', () => { preferred = Number(viewportWidth.value); setWidth(); });
  if ('ResizeObserver' in window) {
    new ResizeObserver(([entry]) => {
      if (!entry) return;
      viewportWidth.max = String(Math.max(Number(viewportWidth.min), Math.min(maximum, Math.floor(entry.contentRect.width))));
      setWidth();
    }).observe(viewportStage);
  }
}
const booking=document.querySelector<HTMLElement>('[data-booking]');
if(booking) {
  const days = Array.from(booking.querySelectorAll<HTMLInputElement>('[name="booking-day"]'));
  const times = booking.querySelectorAll<HTMLInputElement>('[name="booking-time"]');
  const status = booking.querySelector<HTMLElement>('[data-booking-selection]');

  if (status) {
    days.forEach(day => {
      day.disabled = false;
      day.addEventListener('change', () => {
        const available = day.dataset.times?.split(',') ?? [];
        times.forEach((time, i) => {
          const value = available[i] ?? '';
          time.checked = false;
          time.value = value;
          time.disabled = !value;
          const label = time.labels?.[0]?.querySelector('[data-time-label]');
          if (!label) return;
          label.textContent = value;
          if (reducedMotion.matches || lightField?.dataset.motionPaused === 'true' || !label.animate) return;
          label.getAnimations().forEach(animation => animation.cancel());
          label.animate([{ opacity: .3, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], {
            duration: 360, delay: i * 45, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards',
          });
        });
        status.textContent = `День: ${day.value.toLowerCase()}. Выберите время.`;
      });
    });
    times.forEach(time => {
      time.disabled = false;
      time.addEventListener('change', () => {
        const day = days.find(option => option.checked);
        if (day) status.textContent = `Выбрано: ${day.value.toLowerCase()}, ${time.value}.`;
      });
    });
  }
}
const tasks=document.querySelector<HTMLElement>('[data-tasks]');
tasks?.querySelectorAll<HTMLInputElement>('input').forEach(input=> {input.disabled=false;});
tasks?.addEventListener('change',()=>{
  const count=tasks.querySelectorAll('input:checked').length;
  const progress=tasks.querySelector<HTMLProgressElement>('progress');
  if (!progress) return;
  const percentage=Math.round(100*count/progress.max);
  const description=`${count} из ${progress.max}`;
  progress.value=count;
  progress.setAttribute('aria-valuetext',description);
  tasks.style.setProperty('--task-progress',`${percentage}%`);
  tasks.querySelector('[data-progress-text]')!.textContent=description;
  tasks.querySelector('[data-progress-percent]')!.textContent=`${percentage}%`;
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
