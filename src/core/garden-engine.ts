import type { ActivityType, Emotion, EmotionEntry, GardenActivity, GardenSnapshot, GrowthStage, Plant } from './models';
import { EMOTION_META, EMOTIONS } from './models';

const day = 86400000;
export function stageFor(streak: number): GrowthStage { if (streak >= 14) return '结果'; if (streak >= 7) return '开花'; if (streak >= 3) return '发芽'; return '种子'; }
const STAGE_ORDER: Record<GrowthStage, number> = { 种子: 0, 发芽: 1, 开花: 2, 结果: 3 };
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
// 对比重算前后的植物，只记录本次实际跨越到的节点：连跨两级时不补发中间阶段，旧植物不回填历史。
export function deriveActivities(previous: Plant[], next: Plant[], existing: GardenActivity[] = [], now = new Date()): GardenActivity[] {
  const additions: GardenActivity[] = [];
  let seq = existing.reduce((max, item) => Math.max(max, item.seq), 0);
  const date = now.toISOString().slice(0, 10);
  next.forEach((plant) => {
    const before = previous.find((item) => item.id === plant.id);
    const type: ActivityType | undefined = !before
      ? '种下'
      : before.status === '繁茂' && plant.status === '枯萎'
        ? '枯萎'
        : plant.status === '繁茂' && plant.stage !== '种子' && STAGE_ORDER[plant.stage] > STAGE_ORDER[before.stage]
          ? plant.stage
          : undefined;
    if (type) additions.push({ seq: ++seq, id: `activity-${now.getTime()}-${seq}`, plantId: plant.id, emotion: plant.emotion, type, date });
  });
  return additions.length ? [...existing, ...additions] : existing;
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
  seed.forEach((emotion, index) => { const date = new Date(today.getTime() - (seed.length - index - 1) * day).toISOString().slice(0, 10); entries.push(createEntry(emotion, index % 2 ? '今天注意到了自己的节奏。' : '给这一天留下一颗种子。', (index % 5) + 1, date)); });
  return { entries, plants: syncPlants(entries), activities: [] };
}
