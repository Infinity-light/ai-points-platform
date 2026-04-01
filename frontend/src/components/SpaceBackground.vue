<template>
  <div class="space-bg" aria-hidden="true">
    <div class="space-bg__gradient" />
    <div class="space-bg__stars space-bg__stars--small" />
    <div class="space-bg__stars space-bg__stars--medium" />
    <div class="space-bg__stars space-bg__stars--large" />
  </div>
</template>

<style>
.space-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

:root:not(.dark) .space-bg {
  opacity: 0;
}

.space-bg__gradient {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 20% 0%, hsl(224 33% 14%) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 100%, hsl(239 40% 12%) 0%, transparent 40%),
              hsl(222 47% 5%);
}

.space-bg__stars {
  position: absolute;
  inset: 0;
}

/* Small stars — dense, static */
.space-bg__stars--small {
  background-image:
    radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 25% 45%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 40% 15%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 55% 70%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 70% 35%, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 85% 80%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 15% 65%, rgba(255,255,255,0.3), transparent),
    radial-gradient(1px 1px at 50% 90%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 90% 10%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 35% 55%, rgba(255,255,255,0.3), transparent),
    radial-gradient(1px 1px at 65% 25%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 5% 85%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 78% 58%, rgba(255,255,255,0.3), transparent),
    radial-gradient(1px 1px at 22% 92%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 48% 38%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 93% 48%, rgba(255,255,255,0.3), transparent);
}

/* Medium stars — moderate, gentle twinkle */
.space-bg__stars--medium {
  background-image:
    radial-gradient(1.5px 1.5px at 18% 30%, rgba(192,199,214,0.7), transparent),
    radial-gradient(1.5px 1.5px at 42% 60%, rgba(192,199,214,0.6), transparent),
    radial-gradient(1.5px 1.5px at 68% 15%, rgba(192,199,214,0.8), transparent),
    radial-gradient(1.5px 1.5px at 88% 72%, rgba(192,199,214,0.5), transparent),
    radial-gradient(1.5px 1.5px at 33% 85%, rgba(192,199,214,0.6), transparent),
    radial-gradient(1.5px 1.5px at 75% 45%, rgba(192,199,214,0.7), transparent),
    radial-gradient(1.5px 1.5px at 8% 52%, rgba(192,199,214,0.5), transparent),
    radial-gradient(1.5px 1.5px at 58% 8%, rgba(192,199,214,0.6), transparent);
  animation: space-twinkle 8s ease-in-out infinite;
}

/* Large stars — few, brighter twinkle */
.space-bg__stars--large {
  background-image:
    radial-gradient(2px 2px at 30% 25%, rgba(255,255,255,0.9), transparent),
    radial-gradient(2px 2px at 60% 75%, rgba(192,199,214,1), transparent),
    radial-gradient(2px 2px at 82% 40%, rgba(99,102,241,0.8), transparent),
    radial-gradient(2.5px 2.5px at 15% 70%, rgba(56,189,248,0.7), transparent),
    radial-gradient(2px 2px at 50% 50%, rgba(255,255,255,0.8), transparent);
  animation: space-twinkle 6s ease-in-out infinite reverse;
}

@keyframes space-twinkle {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .space-bg__stars--medium,
  .space-bg__stars--large {
    animation: none;
  }
}
</style>
