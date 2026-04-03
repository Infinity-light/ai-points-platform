<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';

const props = defineProps<{ content: string }>();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

const rendered = computed(() => md.render(props.content));
</script>

<template>
  <div class="brain-prose" v-html="rendered" />
</template>

<style scoped>
.brain-prose {
  line-height: 1.7;
  word-break: break-word;
}

.brain-prose :deep(h1) {
  font-size: 1.5em;
  font-weight: 700;
  margin: 1em 0 0.5em;
  color: var(--foreground);
}

.brain-prose :deep(h2) {
  font-size: 1.3em;
  font-weight: 600;
  margin: 0.8em 0 0.4em;
  color: var(--foreground);
}

.brain-prose :deep(h3) {
  font-size: 1.1em;
  font-weight: 600;
  margin: 0.6em 0 0.3em;
  color: var(--foreground);
}

.brain-prose :deep(h4) {
  font-size: 1em;
  font-weight: 600;
  margin: 0.5em 0 0.2em;
  color: var(--foreground);
}

.brain-prose :deep(p) {
  margin: 0.5em 0;
}

.brain-prose :deep(ul),
.brain-prose :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.brain-prose :deep(li) {
  margin: 0.2em 0;
}

.brain-prose :deep(ul) {
  list-style: disc;
}

.brain-prose :deep(ol) {
  list-style: decimal;
}

.brain-prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.8em 0;
  font-size: 0.9em;
}

.brain-prose :deep(th),
.brain-prose :deep(td) {
  border: 1px solid hsl(var(--border));
  padding: 0.4em 0.8em;
  text-align: left;
}

.brain-prose :deep(th) {
  background: hsl(var(--muted));
  font-weight: 600;
}

.brain-prose :deep(code) {
  background: hsl(var(--muted));
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.brain-prose :deep(pre) {
  background: hsl(var(--muted));
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.8em 0;
}

.brain-prose :deep(pre code) {
  background: transparent;
  padding: 0;
}

.brain-prose :deep(blockquote) {
  border-left: 3px solid hsl(var(--primary));
  padding-left: 1em;
  margin: 0.8em 0;
  color: hsl(var(--muted-foreground));
}

.brain-prose :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.brain-prose :deep(a:hover) {
  opacity: 0.8;
}

.brain-prose :deep(hr) {
  border: none;
  border-top: 1px solid hsl(var(--border));
  margin: 1em 0;
}

.brain-prose :deep(strong) {
  font-weight: 600;
  color: var(--foreground);
}
</style>
