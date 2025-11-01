/* =========================
   script.js — readable & simple
   Features:
   - sets up canvas ripple background
   - lazy-play behavior (keeps but we will only auto-play when expanded)
   - click-to-expand (lightbox) for both videos and photos
   - dim other items when expanded
   - click outside or Esc to close
   ========================= */

/* ---------- Helper to select elements ---------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const galleryImages = document.querySelectorAll('#photo-gallery img');
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.querySelector('.lightbox-image');
  const closeBtn = document.querySelector('.close');

/* ---------- 1) Set video <source> if data-src used (keeps original local paths) ---------- */
/* Note: in your HTML the <video><source src="F:\..."></video> already exists.
   If you ever switch to data-src attributes, you can set them here. */

/* ---------- 2) Canvas ripple background (kept simple and readable) ---------- */
(function canvasRipple(){
  const canvas = $('#rippleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W = innerWidth, H = innerHeight;
  function resize(){ W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
  addEventListener('resize', resize); resize();

  const ripples = [];
  function spawn() {
    ripples.push({ x: Math.random()*W, y: Math.random()*H, life: 0, r: Math.random()*60 + 30 });
  }
  for (let i=0; i<6; i++) spawn();

  function draw() {
    ctx.clearRect(0,0,W,H);
    // soft overlay
    const g = ctx.createLinearGradient(0,0,W,H);
    g.addColorStop(0, 'rgba(18,24,38,0.18)');
    g.addColorStop(1, 'rgba(2,4,10,0.36)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

    for (let i=ripples.length-1; i>=0; i--) {
      const r = ripples[i];
      r.life += 0.8;
      const alpha = Math.max(0, 0.14 - r.life / 220);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(120,170,255,${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.arc(r.x, r.y, r.r + r.life*1.6, 0, Math.PI*2);
      ctx.stroke();

      // inner sheen
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,255,255,${alpha*0.06})`;
      ctx.lineWidth = 0.6;
      ctx.arc(r.x, r.y, r.r + r.life*1.6 - 10, 0, Math.PI*2);
      ctx.stroke();

      if (r.life > 140) ripples.splice(i,1);
    }

    if (Math.random() < 0.04) spawn();
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ---------- 3) Prepare gallery & lightbox behavior ---------- */
(function galleryLightbox(){
  const videoGallery = $('#video-gallery');
  const photoGallery = $('#photo-gallery');
  const allGalleries = [videoGallery, photoGallery].filter(Boolean);

  const lightbox = $('#lightbox');
  const lightboxInner = $('#lightbox-inner');
  const lightboxPanel = document.querySelector('.lightbox-panel');

  // Keep track of currently expanded item
  let expandedCard = null;

  // Utility: show lightbox with element (either <video> or <img> node)
  function openLightboxFromCard(card) {
    // If something already expanded, close it first
    if (expandedCard) closeLightbox();

    // Clone content — safer than moving nodes
    const type = card.dataset.type; // "video" or "photo"
    const mediaNode = card.querySelector('.media > video') || card.querySelector('.media > img');

    if (!mediaNode) return;

    // Add dimming class to both galleries
    allGalleries.forEach(g => g.classList.add('dimmed'));

    // Mark gallery containing this card as not pointer-events for others
    // (we already dimmed; but we'll allow the clicked item to stay visible)
    card.style.transform = 'scale(1.03)'; // small pop while animating

    // Create element to show inside lightbox
    let node;
    if (mediaNode.tagName.toLowerCase() === 'video') {
      // Clone video and ensure it will play
      node = document.createElement('video');
      node.controls = true;
      node.autoplay = true;
      node.playsInline = true;
      node.style.outline = 'none';
      // copy sources (handles multiple <source> if any)
      const sources = mediaNode.querySelectorAll('source');
      if (sources.length) {
        sources.forEach(s => {
          const src = s.getAttribute('src');
          if (src) {
            const srcEl = document.createElement('source');
            srcEl.src = src;
            srcEl.type = s.type || 'video/mp4';
            node.appendChild(srcEl);
          }
        });
      } else {
        // fallback: use the video's src attribute
        node.src = mediaNode.currentSrc || mediaNode.src;
      }
      // ensure muted autoplay policies are respected: start muted, then unmute on user gesture
      node.muted = false;
      node.volume = 1;
    } else {
      // Photo
      node = document.createElement('img');
      node.alt = mediaNode.alt || '';
      node.src = mediaNode.src;
    }

    // Insert into lightbox and show
    lightboxInner.innerHTML = ''; // clear
    lightboxInner.appendChild(node);

    // Show lightbox (class toggles CSS transitions)
    lightbox.classList.add('visible');
    lightbox.setAttribute('aria-hidden', 'false');
    expandedCard = card;

    // Pause other videos (in thumbnails)
    pauseAllThumbnailsExcept(card);
    // Try to play if node is video (play returns a promise)
    if (node.tagName.toLowerCase() === 'video') {
      node.play().catch(()=>{ /* autoplay might be blocked until user interacts */ });
    }

    // focus for accessibility
    lightboxInner.focus();
  }

  

  // Close and cleanup
  function closeLightbox() {
    if (!expandedCard) return;
    // remove dimming
    allGalleries.forEach(g => g.classList.remove('dimmed'));

    // clear popup content and hide
    lightboxInner.innerHTML = '';
    lightbox.classList.remove('visible');
    lightbox.setAttribute('aria-hidden', 'true');

    // resume thumbnail visuals
    expandedCard.style.transform = '';
    expandedCard = null;

    // resume or leave thumbnail video paused (we don't auto-play thumbnails)
    pauseAllThumbnails();
  }

  // Pause all thumbnail videos except optional allowedCard
  function pauseAllThumbnailsExcept(allowedCard = null) {
    const videos = $$('video', document);
    videos.forEach(v => {
      // If this video is inside allowedCard (the one we expanded), skip pausing
      if (allowedCard && allowedCard.contains(v)) return;
      try { v.pause(); } catch(e){ /* ignore */ }
    });
  }
  function pauseAllThumbnails() { pauseAllThumbnailsExcept(null); }

  // When user clicks a card in any gallery: open lightbox with that item
  function onCardClick(e) {
    const card = e.currentTarget;
    openLightboxFromCard(card);
  }

  // Attach click listeners to each card (both galleries)
  allGalleries.forEach(gallery => {
    const cards = $$('.card', gallery);
    cards.forEach(card => {
      // Add subtle hover shine (already in CSS) — keep pointer cursor
      card.addEventListener('click', onCardClick);
      // Make cards keyboard-accessible: open on Enter
      card.tabIndex = 0;
      card.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onCardClick({ currentTarget: card });
        }
      });
    });
  });

  // Close lightbox when clicking outside the panel
  lightbox.addEventListener('click', (event) => {
    // if click happened on the lightbox background (not the inner panel), close
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  // Close with Escape key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeLightbox();
    }
  });

  // Optional: when window resizes, ensure lightbox panel stays centered (CSS handles this)
})();

/* ---------- 4) Lazy play while scrolling (lightweight) ----------
   We will NOT auto-play thumbnail videos when scrolled into view.
   Instead: when user expands a video, it plays. Thumbnails remain paused
   to reduce CPU usage. If you prefer autoplay thumbnails as they appear,
   we can enable the IntersectionObserver again, but it is optional.
*/
