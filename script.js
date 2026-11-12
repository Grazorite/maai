(() => {
  'use strict';
  if (document.body.classList.contains('guide-page')) {
    if (window.self !== window.top) {
      document.body.classList.add('is-embedded');
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); window.parent.postMessage('maai:close-guide', '*'); }
      });
    }
    return;
  }
  const $ = (selector) => document.querySelector(selector);
  const slides = [...document.querySelectorAll('.slide')];
  const dialogs = [...document.querySelectorAll('dialog')];
  const overview = $('#overview-dialog');
  const notes = $('#notes-dialog');
  let current = 0;
  let returnFocus = null;
  let toastTimer;

  const pillars = [
    ['Body awareness & isolation', 'Move one part at a time. Work on clear stops and different textures.'],
    ['Rhythm & coordination', 'Keep one rhythm going while another part of you follows a different one.'],
    ['Footwork & weight transfer', 'Feel your weight shift. Stay balanced as you stop or change direction.'],
    ['Creative exploration', 'Explore what feels like you. Find your own style and develop your process for making choreography.'],
    ['Strength & conditioning', 'Build the strength, stability and stamina that support all of this. We’ll focus on glutes, core and upper body.'],
    ['Pickup & retention', 'Learn choreography in less time. Understand the details, dance it accurately and remember it without following me.']
  ];
  const labs = [
    ['Work on the basics', 'Technical Lab', 'Work on a core skill, practise drills and share what you’ve found.'],
    ['Learn, remember, explore', 'Choreography Lab', 'Learn short choreos within a set time, remember them after a break and try your own ideas.']
  ];
  const growth = [
    ['Control', 'Can you engage what you mean to?'],
    ['Timing', 'Can you stay with the music as the rhythm changes?'],
    ['Memory', 'How much of the choreo can you remember in a session?'],
    ['Ideas', 'Which choices in your piece feel most like you?']
  ];

  const closingDialogs = new WeakMap();
  function openDialog(dialog, trigger) {
    returnFocus = trigger || document.activeElement;
    dialogs.forEach(item => {
      if (item.open) { item.getAnimations().forEach(animation => animation.cancel()); item.close(); }
      item.classList.remove('is-closing');
    });
    dialog.showModal();
    dialog.dataset.motionState = 'opening';
    Promise.all(dialog.getAnimations().map(animation => animation.finished.catch(() => {}))).then(() => {
      if (dialog.open && !dialog.classList.contains('is-closing')) dialog.dataset.motionState = 'open';
    });
    if (dialog === overview) overview.querySelector('[aria-current="true"]').focus();
  }
  function closeDialog(dialog) {
    if (closingDialogs.has(dialog)) return closingDialogs.get(dialog);
    if (!dialog.open) return Promise.resolve();
    const focusTarget = returnFocus;
    dialog.classList.add('is-closing');
    dialog.dataset.motionState = 'closing';
    const done = Promise.all(dialog.getAnimations().map(animation => animation.finished.catch(() => {}))).then(() => {
      dialog.close();
      dialog.classList.remove('is-closing');
      dialog.dataset.motionState = 'closed';
      closingDialogs.delete(dialog);
      if (focusTarget?.isConnected && !focusTarget.closest('[hidden]')) focusTarget.focus({preventScroll:true});
      else slides[current].focus({preventScroll:true});
    });
    closingDialogs.set(dialog, done);
    return done;
  }
  function updateNotes() {
    $('#notes-title').textContent = slides[current].dataset.title;
    $('#notes-content').replaceChildren(...[...slides[current].querySelector('.speaker-notes').children].map(node => node.cloneNode(true)));
    $('#notes-position').textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    $('#notes-previous').disabled = current === 0;
    $('#notes-next').disabled = current === slides.length - 1;
  }
  // Maai is interpreted here through changing distance and shared timing.
  // One persistent field links the chapters; each chapter has a distinct phrase.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const runningAnimations = new Set();
  const planes = [...document.querySelectorAll('.interval-plane')];
  const frameSnapshots = new Map();
  const frameStyleKeys = ['left','top','width','height','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','opacity','clipPath'];
  function readFrameStyle(frame) {
    const css = getComputedStyle(frame);
    return Object.fromEntries(frameStyleKeys.map(key => [key, css[key]]));
  }
  let hasShown = false;
  let motionGeneration = 0;
  function play(element, frames, options) {
    const animation = element.animate(frames, options);
    runningAnimations.add(animation);
    animation.finished.then(() => runningAnimations.delete(animation), () => runningAnimations.delete(animation));
    return animation;
  }
  function stopMotion() {
    const field = $('.spotlight-field');
    field.style.opacity = getComputedStyle(field).opacity;
    // Resume interrupted journeys from their visible state, not the previous destination.
    planes.forEach(frame => frameSnapshots.set(frame, readFrameStyle(frame)));
    runningAnimations.forEach(animation => animation.cancel());
    runningAnimations.clear();
  }
  // Keep the old light muted until the actual surface transition has finished.
  async function syncSpotlightTheme(theme, token) {
    const field = $('.spotlight-field');
    const surfaces = document.body.getAnimations().filter(animation => animation.transitionProperty === 'background-color');
    if (!hasShown || reducedMotion.matches || !surfaces.length) {
      field.dataset.theme = theme;
      field.style.opacity = '1';
      field.dataset.lightState = 'settled';
      return;
    }
    const surfaceDone = Promise.all(surfaces.map(animation => animation.finished.catch(() => {})));
    field.dataset.lightState = 'dimming';
    const dim = play(field, [{opacity:getComputedStyle(field).opacity},{opacity:0}], {duration:120,fill:'forwards'});
    const dimmed = await dim.finished.then(() => true, () => false);
    if (!dimmed || token !== motionGeneration) return;
    field.style.opacity = '0';
    dim.cancel();
    field.dataset.lightState = 'waiting';
    await surfaceDone;
    if (token !== motionGeneration) return;
    field.dataset.theme = theme;
    field.dataset.lightState = 'revealing';
    field.style.opacity = '1';
    const reveal = play(field, [{opacity:0},{opacity:1}], {duration:320,easing:'ease-out'});
    await reveal.finished.catch(() => {});
    if (token === motionGeneration) field.dataset.lightState = 'settled';
  }
  // A soft pool of light travels to a meaningful anchor, then rests there.
  function moveSpotlight(index, animate) {
    const scene = slides[index];
    const field = $('.spotlight-field');
    const light = $('.spotlight');
    const target = scene.querySelector(scene.dataset.spotlight);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const stage = field.getBoundingClientRect();
    const size = window.innerWidth <= 800 ? 360 : 620;
    const next = {
      left: `${rect.left + rect.width / 2 - stage.left - size / 2}px`,
      top: `${rect.top + rect.height / 2 - stage.top - size / 2}px`,
      width: `${size}px`, height: `${size}px`
    };
    light.dataset.target = target.id || scene.dataset.spotlight;
    if (Object.keys(next).every(key => light.style[key] === next[key])) return;
    const css = getComputedStyle(light);
    const previous = {left:css.left, top:css.top, width:css.width, height:css.height, opacity:css.opacity};
    light.getAnimations().forEach(animation => animation.cancel());
    Object.assign(light.style, next);
    if (animate && !reducedMotion.matches) {
      const from = hasShown ? previous : {...next, opacity:0};
      play(light, [from, {...next, opacity:1}], {duration:1500,easing:'cubic-bezier(.25,.6,.3,1)'});
    }
  }
  // Translate the composition as one unit; retain every internal gap and offset.
  function centerContent(scene) {
    scene.style.setProperty('--content-offset', '0px');
    const header = scene.firstElementChild;
    const children = [...scene.children].filter(child => child !== header && !child.hidden && child.getClientRects().length);
    if (!children.length) return;
    const stage = scene.getBoundingClientRect();
    const rects = children.map(child => child.getBoundingClientRect());
    const top = Math.min(...rects.map(rect => rect.top)) - stage.top + scene.scrollTop;
    const bottom = Math.max(...rects.map(rect => rect.bottom)) - stage.top + scene.scrollTop;
    const height = bottom - top;
    const css = getComputedStyle(scene);
    const contentStart = header.getBoundingClientRect().bottom - stage.top + scene.scrollTop + 24;
    const contentEnd = scene.clientHeight - parseFloat(css.paddingBottom);
    const available = contentEnd - contentStart;
    // Keep the header fixed; oversized compositions retain their scrollable start.
    const offset = height <= available
      ? contentStart + (available - height) / 2 - top
      : 0;
    scene.style.setProperty('--content-offset', `${offset}px`);
  }
  // Measure the real content: the shared frames now carry attention, not decoration.
  function moveField(index, animate = false) {
    const scene = slides[index];
    centerContent(scene);
    const field = $('.interval-field');
    const fieldRect = field.getBoundingClientRect();
    const padding = window.innerWidth <= 800 ? 9 : 14;
    const mode = scene.dataset.frameMode || 'focus';
    const together = mode === 'together';
    const previousFrames = planes.map(frame => frameSnapshots.get(frame) || readFrameStyle(frame));
    frameSnapshots.clear();
    field.dataset.mode = mode;
    field.classList.toggle('is-together', together);
    [scene.dataset.frameA, scene.dataset.frameB].forEach((selector, i) => {
      const target = scene.querySelector(selector);
      const frame = planes[i];
      frame.hidden = !target;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const before = previousFrames[i];
      const offsetMode = together || mode === 'offset';
      const overlap = offsetMode ? (i === 0 ? -1 : 1) * (window.innerWidth <= 800 ? 5 : 10) : 0;
      const after = {
        left: `${rect.left - fieldRect.left - padding + overlap}px`,
        top: `${rect.top - fieldRect.top - padding + overlap}px`,
        width: `${rect.width + padding * 2}px`,
        height: `${rect.height + padding * 2}px`
      };
      if (mode === 'bridge') {
        const width = (rect.width + padding * 2) * .64;
        after.width = `${width}px`;
        after.left = `${i === 0 ? rect.left - fieldRect.left - padding : rect.right - fieldRect.left + padding - width}px`;
      }
      frame.getAnimations().forEach(animation => animation.cancel());
      Object.assign(frame.style, after);
      frame.dataset.target = target.id;
      frame.dataset.frameState = 'settled';
      if (animate && !reducedMotion.matches) {
        frame.dataset.frameState = 'moving';
        const destination = {...readFrameStyle(frame), ...after};
        const origin = hasShown ? before : {...destination, opacity:0};
        const geometryKeys = ['left','top','width','height'];
        const shapeKeys = frameStyleKeys.filter(key => !geometryKeys.includes(key));
        const pick = (style, keys) => Object.fromEntries(keys.map(key => [key, style[key]]));
        // Clear outgoing edges quickly while the frame continues its journey.
        play(frame, [pick(origin, shapeKeys), pick(destination, shapeKeys)], {duration:140,easing:'ease-out'});
        const movement = play(frame, [pick(origin, geometryKeys), pick(destination, geometryKeys)], {duration:together?1100:850,easing:'cubic-bezier(.22,1,.36,1)'});
        movement.finished.then(() => {frame.dataset.frameState = 'settled';}, () => {});
      }
    });
    moveSpotlight(index, animate);
  }
  let frameUpdate;
  function refreshFrames() {
    cancelAnimationFrame(frameUpdate);
    frameUpdate = requestAnimationFrame(() => {
      if (hasShown && $('#deck').dataset.motionState === 'settled') moveField(current);
    });
  }
  window.addEventListener('resize', refreshFrames);
  slides.forEach(slide => slide.addEventListener('scroll', refreshFrames, {passive:true}));
  const contentResize = new ResizeObserver(refreshFrames);
  slides.forEach(slide => {
    contentResize.observe(slide);
    slide.querySelectorAll('[role="tabpanel"]').forEach(panel => contentResize.observe(panel));
  });
  document.fonts.ready.then(refreshFrames);
  function transitionTo(previous, next, backwards, animate) {
    const token = ++motionGeneration;
    stopMotion();
    const lightReady = syncSpotlightTheme(next.dataset.theme, token);
    const motion = next.dataset.motion;
    const direction = backwards ? -1 : 1;
    const recipes = {
      open: [{opacity:0},{opacity:1}],
      approach: [{opacity:0,transform:'scale(1.006)'},{opacity:1,transform:'scale(1)'}],
      focus: [{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],
      exchange: [{opacity:0,transform:`translateY(${direction * -7}px)`},{opacity:1,transform:'translateY(0)'}],
      layer: [{opacity:0,transform:'scale(.996)'},{opacity:1,transform:'scale(1)'}],
      return: [{opacity:0,transform:'translateY(-5px)'},{opacity:1,transform:'translateY(0)'}],
      gather: [{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}]
    };
    moveField(slides.indexOf(next), animate);
    if (!animate) {
      $('#deck').dataset.motionState = 'moving';
      lightReady.then(() => { if (token === motionGeneration) { $('#deck').dataset.motionState = 'settled'; moveField(current); } });
      return;
    }
    $('#deck').dataset.motionState = 'moving';
    if (previous && previous !== next) {
      previous.hidden = false;
      previous.classList.add('leaving');
      // It remains visual for the exit, but is already inert and hidden from assistive tech.
      const exit = play(previous, [{opacity:1},{opacity:0}], {duration:240,easing:'ease-in',fill:'forwards'});
      exit.finished.then(() => {
        if (token === motionGeneration) { previous.hidden=true; previous.classList.remove('leaving'); exit.cancel(); }
      }, () => {});
    }
    play(next, recipes[motion], {duration:680,delay:previous?100:0,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
    Promise.all([lightReady, ...[...runningAnimations].map(animation => animation.finished.catch(() => {}))]).then(() => {
      if (token === motionGeneration) { $('#deck').dataset.motionState = 'settled'; moveField(current); }
    });
  }
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    ++motionGeneration;
    stopMotion();
    slides.forEach((slide,i) => {slide.hidden=i!==current;slide.classList.remove('leaving');});
    $('#deck').dataset.motionState = 'settled';
    syncSpotlightTheme(slides[current].dataset.theme, motionGeneration);
    moveField(current);
  });

  function showSlide(index, { focus = false, updateHash = true } = {}) {
    const next = Math.max(0, Math.min(slides.length - 1, index));
    if (hasShown && next === current) return;
    const previous = hasShown ? slides[current] : null;
    const backwards = next < current;
    slides.forEach((slide, i) => {
      slide.hidden = i !== next;
      slide.classList.toggle('active', i === next);
      slide.classList.remove('leaving');
      slide.inert = i !== next;
      slide.setAttribute('aria-hidden', String(i !== next));
    });
    current = next;
    if (slides[current].id === 'slide-3') selectPillar.reset();
    if (slides[current].id === 'slide-4') selectLab.reset();
    if (slides[current].id === 'slide-6') selectGrowth.reset();
    slides[current].scrollTop = 0;
    document.body.dataset.theme = slides[current].dataset.theme;
    $('#current-number').textContent = String(current + 1).padStart(2, '0');
    $('#intro-guide').hidden = current !== 0;
    $('#previous-button').disabled = current === 0;
    $('#next-button').disabled = current === slides.length - 1;
    $('#slide-announcement').textContent = `Slide ${current + 1} of ${slides.length}: ${slides[current].dataset.title}`;
    document.title = `MAAI / ${slides[current].dataset.title}`;
    document.querySelectorAll('.overview-item').forEach((button, i) => button.setAttribute('aria-current', String(i === current)));
    updateNotes();
    if (updateHash && location.hash !== `#${current + 1}`) {
      // Works from file:// too; hashchange is a safe fallback where History is restricted.
      try { history.replaceState(null, '', `#${current + 1}`); }
      catch { location.hash = String(current + 1); }
    }
    transitionTo(previous, slides[current], backwards, !reducedMotion.matches && !notes.open);
    hasShown = true;
    if (focus) slides[current].focus({ preventScroll: true });
  }
  function readHash() {
    const match = location.hash.match(/^#(?:slide-)?(\d+)$/);
    showSlide(match ? Number(match[1]) - 1 : 0, { updateHash: false });
  }
  function announce(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5500);
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else announce('Use your browser’s View menu to enter fullscreen.');
    } catch {
      announce('Fullscreen is unavailable here. Use your browser’s View menu.');
    }
  }
  function setupTabs(selector, panel, render, vertical = false) {
    const buttons = [...document.querySelectorAll(selector)];
    const initialIndex = Math.max(0, buttons.findIndex(button => button.getAttribute('aria-selected') === 'true'));
    const select = (index, focus = false, refreshField = true) => {
      buttons.forEach((button, i) => {
        button.setAttribute('aria-selected', String(i === index));
        button.tabIndex = i === index ? 0 : -1;
      });
      $(panel).setAttribute('aria-labelledby', buttons[index].id);
      render(index, buttons[index]);
      if (refreshField && $('#deck').dataset.motionState === 'settled') moveField(current, true);
      if (focus) buttons[index].focus();
    };
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => select(index));
      button.addEventListener('keydown', event => {
        const previous = vertical ? 'ArrowUp' : 'ArrowLeft';
        const next = vertical ? 'ArrowDown' : 'ArrowRight';
        let target;
        if (button.hasAttribute('data-pillar') && event.key.startsWith('Arrow')) {
          // Follow the two application cards, three core columns and shared base.
          const neighbours = {
            ArrowUp: {4: 1, 0: 5, 1: 5, 2: 3, 5: 5, 3: 3},
            ArrowDown: {5: 0, 3: 2, 0: 4, 1: 4, 2: 4, 4: 4},
            ArrowLeft: {5: 5, 3: 5, 0: 0, 1: 0, 2: 1, 4: 4},
            ArrowRight: {5: 3, 3: 3, 0: 1, 1: 2, 2: 2, 4: 4}
          };
          const nextPillar = neighbours[event.key][button.dataset.pillar];
          target = buttons.findIndex(item => Number(item.dataset.pillar) === nextPillar);
        } else {
          if (event.key === previous) target = (index - 1 + buttons.length) % buttons.length;
          if (event.key === next) target = (index + 1) % buttons.length;
        }
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = buttons.length - 1;
        if (target !== undefined) {
          event.preventDefault(); event.stopPropagation(); select(target, true);
        }
      });
    });
    select.reset = () => select(initialIndex, false, false);
    return select;
  }

  const selectPillar = setupTabs('[data-pillar]', '#pillar-panel', (position, button) => {
    const index = Number(button.dataset.pillar);
    $('#pillar-heading').textContent = pillars[index][0];
    $('#pillar-copy').textContent = pillars[index][1];
  }, true);
  // Reserve the larger lab explanation at every width, without exposing duplicate copy.
  const labPanel = $('#lab-panel');
  const labContent = document.createElement('div');
  labContent.className = 'lab-content';
  labContent.append(...labPanel.childNodes);
  labPanel.append(labContent);
  labs.forEach(([kicker, heading, copy]) => {
    const reference = document.createElement('div');
    reference.className = 'lab-size-reference';
    reference.setAttribute('aria-hidden', 'true');
    reference.inert = true;
    [kicker, heading, copy].forEach((text, index) => {
      const element = document.createElement(index === 1 ? 'h3' : 'p');
      if (index === 0) element.className = 'eyebrow';
      element.textContent = text;
      reference.append(element);
    });
    labPanel.append(reference);
  });
  const selectLab = setupTabs('[data-lab]', '#lab-panel', index => {
    $('#lab-kicker').textContent = labs[index][0];
    $('#lab-heading').textContent = labs[index][1];
    $('#lab-copy').textContent = labs[index][2];
  });
  const selectGrowth = setupTabs('[data-growth]', '#growth-panel', index => {
    $('#growth-heading').textContent = growth[index][0];
    $('#growth-copy').textContent = growth[index][1];
  });

  slides.forEach((slide, index) => {
    const button = document.createElement('button');
    button.className = 'overview-item';
    button.setAttribute('aria-label', `Slide ${index + 1}: ${slide.dataset.title}`);
    const number = document.createElement('span');
    number.textContent = String(index + 1).padStart(2, '0');
    const title = document.createElement('span');
    title.textContent = slide.dataset.title;
    button.append(number, title);
    button.addEventListener('click', async () => { await closeDialog(overview); showSlide(index, { focus: true }); });
    $('#overview-grid').append(button);
  });
  window.addEventListener('message', event => {
    if (event.source === $('#guide-dialog iframe').contentWindow && event.data === 'maai:close-guide') closeDialog($('#guide-dialog'));
  });
  $('#intro-guide').addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openDialog($('#guide-dialog'), event.currentTarget);
  });
  $('#previous-button').addEventListener('click', () => showSlide(current - 1));
  $('#next-button').addEventListener('click', () => showSlide(current + 1));
  $('#notes-previous').addEventListener('click', () => showSlide(current - 1));
  $('#notes-next').addEventListener('click', () => showSlide(current + 1));
  $('#overview-button').addEventListener('click', event => openDialog(overview, event.currentTarget));
  $('#notes-button').addEventListener('click', event => openDialog(notes, event.currentTarget));
  $('#conversation-button').addEventListener('click', event => openDialog($('#conversation-dialog'), event.currentTarget));
  $('#fullscreen-button').addEventListener('click', fullscreen);
  document.addEventListener('fullscreenchange', () => {
    $('#fullscreen-button').innerHTML = `${document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'} <kbd>F</kbd>`;
  });
  dialogs.forEach(dialog => {
    dialog.querySelector('[data-close]').addEventListener('click', () => closeDialog(dialog));
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialog); });
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeDialog(dialog);
    });
  });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    const open = dialogs.find(dialog => dialog.open);
    if (open?.classList.contains('is-closing')) return;
    if (event.repeat && ['o', 'n', 'f'].includes(key)) return;
    if (open) {
      if ((key === 'n' && open === notes) || (key === 'o' && open === overview)) { event.preventDefault(); closeDialog(open); }
      else if (open === notes && ['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault(); showSlide(current + (['ArrowRight', 'PageDown'].includes(event.key) ? 1 : -1));
      }
      return;
    }
    if (['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      let index = current + (['ArrowRight', 'PageDown'].includes(event.key) ? 1 : -1);
      if (event.key === 'Home') index = 0;
      if (event.key === 'End') index = slides.length - 1;
      showSlide(index, { focus: true });
    } else if (key === 'o') { event.preventDefault(); openDialog(overview); }
    else if (key === 'n') { event.preventDefault(); openDialog(notes); }
    else if (key === 'f') { event.preventDefault(); fullscreen(); }
  });
  $('#total-slides').textContent = String(slides.length).padStart(2, '0');
  window.addEventListener('hashchange', readHash);
  readHash();
})();
