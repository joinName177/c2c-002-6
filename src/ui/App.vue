<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue';
import { LocalGardenRepository } from '../adapters/local-garden.repository';
import { EMOTION_META, EMOTIONS, type ActivityType, type Emotion, type GardenActivity } from '../core/models';
import { annualReport, createEntry, growGarden, sampleSnapshot } from '../core/garden-engine';

const repo = new LocalGardenRepository();
const state = reactive(repo.load());
const tab = ref<'花园' | '种植' | '动态' | '时间轴' | '标本馆' | '年报'>('花园');
const selectedEmotion = ref<Emotion>('喜悦');
const notice = ref('');
const draft = reactive({ note: '', intensity: 3 });
const report = computed(() => annualReport(state.entries));
const living = computed(() => state.plants.filter((plant) => plant.status === '繁茂'));
const specimens = computed(() => state.plants.filter((plant) => plant.status === '枯萎'));
const timeline = computed(() => [...state.entries].sort((a, b) => b.date.localeCompare(a.date)));
const feed = computed(() => [...state.activities].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)));
const ACTIVITY_NOTICE: Record<ActivityType, (name: string) => string> = {
  种下: (name) => `${name} 已经种下`,
  发芽: (name) => `${name} 发芽了，去看看它的新叶`,
  开花: (name) => `${name} 今天开花了`,
  结果: (name) => `${name} 结果了`,
  枯萎: (name) => `${name} 枯萎了，已收入标本馆`,
};
const ACTIVITY_DETAIL: Record<ActivityType, string> = {
  种下: '一颗新的情绪，落进了土壤里',
  发芽: '连续记录 3 天，顶出了第一片新叶',
  开花: '连续记录 7 天，今天静静绽放',
  结果: '连续记录 14 天，结出了自己的果实',
  枯萎: '断了浇水，被好好制成标本',
};
function plant() {
  const entry = createEntry(selectedEmotion.value, draft.note, draft.intensity);
  state.entries.unshift(entry); draft.note = '';
  const grown = growGarden(state.entries, state.plants, state.activities, entry.date);
  const fresh = grown.activities.slice(state.activities.length);
  state.plants = grown.plants; state.activities = grown.activities;
  repo.save({ entries: state.entries, plants: state.plants, activities: state.activities });
  const latest = fresh[fresh.length - 1];
  notice.value = latest ? ACTIVITY_NOTICE[latest.type](EMOTION_META[selectedEmotion.value].plant) : '';
  const affected = state.plants.find((item) => item.emotion === selectedEmotion.value);
  tab.value = '花园';
  if (affected && latest) void flashPlant(affected.id);
}
function selectTab(name: typeof tab.value) { notice.value = ''; tab.value = name; }
function reset() { const fresh = sampleSnapshot(); state.entries = fresh.entries; state.plants = fresh.plants; state.activities = fresh.activities; repo.save(fresh); notice.value = '已恢复初始示例花园'; }
async function flashPlant(plantId: string) {
  await nextTick();
  const card = document.querySelector(`[data-plant-id="${plantId}"]`);
  if (card) { card.classList.remove('plant-flash'); void (card as HTMLElement).offsetWidth; card.classList.add('plant-flash'); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}
async function openActivity(activity: GardenActivity) {
  const plant = state.plants.find((item) => item.id === activity.plantId);
  if (!plant) return;
  tab.value = plant.status === '繁茂' ? '花园' : '标本馆';
  await flashPlant(activity.plantId);
}
function formatDate(date: string) { return new Date(`${date}T00:00:00`).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }); }
</script>

<template>
  <div class="garden-app">
    <header class="garden-topbar"><div class="garden-brand"><span class="garden-mark">✿</span><div><span class="eyebrow">THE INNER GARDEN / 02</span><h1>情绪植物园</h1></div></div><div class="garden-top-actions"><span class="weather">今日花园 · {{ living.length }} 株在生长</span><button class="quiet-button" type="button" @click="reset">重置演示</button></div></header>
    <main class="garden-wrap"><section class="garden-hero"><div><span class="eyebrow green-text">DAILY EMOTION CULTIVATION</span><h2>给情绪一块<br /><i>可以生长的土壤。</i></h2><p>你不需要每天都阳光明媚，只需要为此刻诚实地浇一次水。</p></div><div class="garden-stats"><div><strong>{{ report.active }}</strong><span>活跃日</span></div><div><strong>{{ report.lushness }}<small>%</small></strong><span>花园繁茂度</span></div><div><strong>{{ state.entries.length }}</strong><span>情绪标本</span></div></div></section>
      <nav class="garden-tabs"><button v-for="item in ['花园', '种植', '动态', '时间轴', '标本馆', '年报']" :key="item" type="button" :class="{ active: tab === item }" @click="selectTab(item as typeof tab)">{{ item }}</button></nav>
      <section v-if="tab === '花园'" class="garden-board"><p v-if="notice" class="garden-notice">✦ {{ notice }}</p><div class="board-heading"><div><span class="eyebrow">YOUR EMOTIONAL BIOME</span><h3>正在生长的情绪</h3></div><span class="season-label">秋季 · 第 40 周</span></div><div class="plant-grid"><article v-for="plant in living" :key="plant.id" :data-plant-id="plant.id" class="plant-card" :style="{ '--plant-color': EMOTION_META[plant.emotion].color }"><div class="plant-card-top"><span class="plant-status">正在生长</span><span>{{ plant.streak }} 天连续</span></div><div class="plant-illustration"><span class="plant-glow"></span><strong>{{ EMOTION_META[plant.emotion].symbol }}</strong><i v-for="n in Math.min(plant.streak + 1, 5)" :key="n" :style="{ '--n': n }">●</i></div><div class="plant-info"><span class="plant-emotion">{{ plant.emotion }}</span><h4>{{ EMOTION_META[plant.emotion].plant }}</h4><p>{{ EMOTION_META[plant.emotion].hint }}</p><div class="growth-track"><span :style="{ width: `${Math.min(100, Math.max(12, plant.streak / 14 * 100))}%` }"></span></div><small>{{ plant.stage }} · 下一阶段还需 {{ Math.max(0, 3 - plant.streak) }} 天</small></div></article><button class="add-plant-card" type="button" @click="tab = '种植'"><span>＋</span><strong>种下一颗新情绪</strong><small>每天记录，植物就会长大</small></button></div></section>
      <section v-else-if="tab === '种植'" class="planting-layout"><article class="plant-form"><div class="board-heading"><div><span class="eyebrow">PLANT A FEELING</span><h3>今天的你，是什么天气？</h3></div></div><div class="emotion-picker"><button v-for="emotion in EMOTIONS" :key="emotion" type="button" :class="{ selected: selectedEmotion === emotion }" :style="{ '--emotion-color': EMOTION_META[emotion].color }" @click="selectedEmotion = emotion"><span>{{ EMOTION_META[emotion].symbol }}</span><b>{{ emotion }}</b><small>{{ EMOTION_META[emotion].plant }}</small></button></div><label>给这颗情绪留一句话<textarea v-model="draft.note" rows="5" placeholder="它今天为什么来到这里？"></textarea></label><label>情绪强度 <output>{{ draft.intensity }} / 5</output><input v-model.number="draft.intensity" type="range" min="1" max="5" /></label><button class="plant-button" type="button" @click="plant">种下这颗情绪 ✦</button><p class="notice">{{ notice }}</p></article><aside class="plant-preview" :style="{ '--preview-color': EMOTION_META[selectedEmotion].color }"><span class="eyebrow">PREVIEW / {{ selectedEmotion }}</span><div class="preview-plant">{{ EMOTION_META[selectedEmotion].symbol }}</div><h3>{{ EMOTION_META[selectedEmotion].plant }}</h3><p>今天种下，连续记录 3 天后发芽，7 天后开花，14 天后结果。</p></aside></section>
      <section v-else-if="tab === '动态'" class="feed-section"><div class="board-heading"><div><span class="eyebrow">GARDEN ACTIVITY</span><h3>花园动态</h3></div><span class="season-label">{{ feed.length }} 条生命节点</span></div><div v-if="feed.length" class="activity-feed"><button v-for="activity in feed" :key="activity.id" type="button" class="activity-item" :class="`is-${activity.type}`" @click="openActivity(activity)"><span class="activity-symbol">{{ EMOTION_META[activity.emotion].symbol }}</span><span class="activity-body"><strong>{{ EMOTION_META[activity.emotion].plant }} · {{ activity.type }}</strong><small>{{ ACTIVITY_DETAIL[activity.type] }}</small></span><time>{{ formatDate(activity.date) }}</time><i class="activity-go">查看 →</i></button></div><div v-else class="empty-state">花园还很安静。种下第一颗情绪后，它的每一次发芽、开花都会出现在这里。</div></section>
      <section v-else-if="tab === '时间轴'" class="timeline-section"><div class="board-heading"><div><span class="eyebrow">GROWTH TIMELINE</span><h3>每一天，都留下了一片叶子</h3></div></div><div class="timeline"><div v-for="(entry, index) in timeline" :key="entry.id" class="timeline-item"><div class="timeline-date"><strong>{{ new Date(`${entry.date}T00:00:00`).getDate() }}</strong><span>{{ new Date(`${entry.date}T00:00:00`).toLocaleDateString('zh-CN', { month: 'short' }) }}</span></div><div class="timeline-dot" :style="{ background: EMOTION_META[entry.emotion].color }"></div><div class="timeline-content"><div><span class="timeline-emotion" :style="{ color: EMOTION_META[entry.emotion].color }">{{ EMOTION_META[entry.emotion].symbol }} {{ entry.emotion }}</span><span class="intensity">强度 {{ entry.intensity }}/5</span></div><p>{{ entry.note }}</p><small>{{ EMOTION_META[entry.emotion].plant }} · 第 {{ index + 1 }} 片叶子</small></div></div></div></section>
      <section v-else-if="tab === '标本馆'" class="specimen-section"><div class="board-heading"><div><span class="eyebrow">SPECIMEN ARCHIVE</span><h3>枯萎不是消失，是被好好保存</h3></div></div><div v-if="specimens.length" class="specimen-grid"><div v-for="plant in specimens" :key="plant.id" :data-plant-id="plant.id" class="specimen-card"><div class="pressed-flower">{{ EMOTION_META[plant.emotion].symbol }}</div><div><span>{{ plant.emotion }} · {{ EMOTION_META[plant.emotion].plant }}</span><strong>生长了 {{ plant.entryIds.length }} 天</strong><small>最后浇水：{{ plant.lastWatered }}</small></div></div></div><div v-else class="empty-state">你的标本馆还是空的。持续记录，等一朵花完成它的季节。</div></section>
      <section v-else class="report-section"><div class="report-heading"><span class="eyebrow">EMOTIONAL ECOLOGY REPORT · 2026</span><h3>你的情绪生态年报</h3><p>这一年，你和自己的内在天气相处得怎么样？</p></div><div class="report-grid"><div class="report-score"><span>花园繁茂度</span><strong>{{ report.lushness }}<small>/ 100</small></strong><div class="report-progress"><i :style="{ width: `${report.lushness}%` }"></i></div><p>每一次诚实的记录，都会让生态系统更完整。</p></div><div class="top-emotion"><span>最常出现的物种</span><div><strong :style="{ color: EMOTION_META[report.top.emotion].color }">{{ EMOTION_META[report.top.emotion].symbol }}</strong><h4>{{ report.top.emotion }}</h4></div><p>{{ report.top.count }} 次记录 · 是你今年最熟悉的一种天气</p></div><div class="count-chart"><span>情绪物种分布</span><div v-for="item in report.counts" :key="item.emotion" class="count-row"><b>{{ item.emotion }}</b><div><i :style="{ width: `${Math.max(5, item.count / Math.max(report.top.count, 1) * 100)}%`, background: EMOTION_META[item.emotion].color }"></i></div><small>{{ item.count }}</small></div></div></div></section>
    </main>
  </div>
</template>
