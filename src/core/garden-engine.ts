import type { ActivityType, Emotion, EmotionEntry, GardenActivity, GardenSnapshot, GrowthStage, Plant } from './models';
import { EMOTION_META, EMOTIONS } from './models';

const day = 86400000;
export function stageFor(streak: number): GrowthStage { if (streak >= 14) return '结果'; if (streak >= 7) return '开花'; if (streak >= 3) return '发芽'; return '种子'; }
export function streakFor(entries: EmotionEntry[], emotion: Emotion): number {
  const dates = new Set(entries.filter((item) => item.emotion === emotion).map((item) => item.date));
  let streak = 0; const cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  while (dates.has(cursor.toISOString().slice(0, 10))) { streak += 1; cursor.setTime(cursor.getTime() - day); }
  if (!streak) {
    const sortedDates = [...dates].sort(); const latest = sortedDates[sortedDates.length - 1]; if (!latest) return 0;
    const distance = Math.floor((Date.now() - new Date(`${latest}T00:00:00`).getTime()) / day);
    if (distance > 1) return 0;
    streak = 1;
  }
  return streak;
}
export function syncPlants(entries: EmotionEntry[], previous: Plant[] = []): Plant[] {
  return EMOTIONS.filter((emotion) => entries.some((item) => item.emotion === emotion)).map((emotion) => {
    const own = entries.filter((item) => item.emotion === emotion).sort((a, b) => a.date.localeCompare(b.date));
    const existing = previous.find((item) => item.emotion === emotion);
    const streak = streakFor(entries, emotion);
    return { id: existing?.id ?? `plant-${emotion}`, emotion, plantedAt: own[0].date, lastWatered: own[own.length - 1].date, streak, stage: stageFor(streak), status: streak ? '繁茂' : '枯萎', entryIds: own.map((item) => item.id) };
  });
}
const STAGE_RANK: Record<GrowthStage, number> = { 种子: 0, 发芽: 1, 开花: 2, 结果: 3 };
const STAGE_ACTIVITY: Partial<Record<GrowthStage, ActivityType>> = { 发芽: '发芽', 开花: '开花', 结果: '结果' };
let activitySeq = 0;
function newActivityId() { return `activity-${Date.now()}-${(activitySeq += 1)}-${Math.random().toString(36).slice(2, 7)}`; }
// 重算植物，并与重算前的状态对比，自动生成生命周期动态：
// 新出现的植物记「种下」；连续天数跨级时只记当前达成的那一级；繁茂转枯萎记「枯萎」；复活不补记。
export function growGarden(entries: EmotionEntry[], previous: Plant[] = [], activities: GardenActivity[] = [], date = new Date().toISOString().slice(0, 10)): { plants: Plant[]; activities: GardenActivity[] } {
  const plants = syncPlants(entries, previous);
  const fresh: GardenActivity[] = [];
  for (const plant of plants) {
    const before = previous.find((item) => item.id === plant.id);
    if (!before) { fresh.push({ id: newActivityId(), plantId: plant.id, emotion: plant.emotion, type: '种下', date: plant.plantedAt }); continue; }
    if (before.status === '繁茂' && plant.status === '枯萎') fresh.push({ id: newActivityId(), plantId: plant.id, emotion: plant.emotion, type: '枯萎', date });
    else if (plant.status === '繁茂') { const reached = STAGE_ACTIVITY[plant.stage]; if (reached && STAGE_RANK[plant.stage] > STAGE_RANK[before.stage]) fresh.push({ id: newActivityId(), plantId: plant.id, emotion: plant.emotion, type: reached, date }); }
  }
  return { plants, activities: [...activities, ...fresh] };
}
export function createEntry(emotion: Emotion, note: string, intensity: number, date = new Date().toISOString().slice(0, 10)): EmotionEntry { return { id: `emotion-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date, emotion, note: note.trim() || EMOTION_META[emotion].hint, intensity: Math.min(5, Math.max(1, Number(intensity) || 3)) }; }
export function annualReport(entries: EmotionEntry[]) {
  const counts = EMOTIONS.map((emotion) => ({ emotion, count: entries.filter((item) => item.emotion === emotion).length })).sort((a, b) => b.count - a.count);
  const active = new Set(entries.map((item) => item.date)).size;
  const intensity = entries.length ? entries.reduce((sum, item) => sum + item.intensity, 0) / entries.length : 0;
  return { top: counts[0], counts, active, lushness: Math.min(100, Math.round((active / 90) * 70 + (intensity / 5) * 30)), intensity: Math.round(intensity * 10) / 10 };
}
export function sampleSnapshot(): GardenSnapshot {
  const today = new Date(); const entries: EmotionEntry[] = [];
  const seed: Emotion[] = ['喜悦', '喜悦', '平静', '平静', '平静', '平静', '喜悦', '忧伤', '焦虑', '平静', '喜悦'];
  let plants: Plant[] = []; let activities: GardenActivity[] = [];
  seed.forEach((emotion, index) => {
    const date = new Date(today.getTime() - (seed.length - index - 1) * day).toISOString().slice(0, 10);
    const entry = createEntry(emotion, index % 2 ? '今天注意到了自己的节奏。' : '给这一天留下一颗种子。', (index % 5) + 1, date);
    entries.push(entry);
    // 逐日重算，让动态经由阶段对比自然产生，而不是回填历史
    ({ plants, activities } = growGarden(entries, plants, activities, date));
  });
  return { entries, plants, activities };
}
