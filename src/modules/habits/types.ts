import type { Frequency, HabitStats } from "./streaks";

export interface HabitDTO {
  id: string;
  name: string;
  description: string | null;
  frequency: Frequency;
  weekdays: number[];
  targetPerPeriod: number;
  startDate: string;
  endDate: string | null;
  reminderTime: string | null;
  categoryId: string | null;
  categoryName: string | null;
  color: string;
  icon: string;
  archived: boolean;
  stats: HabitStats;
  dueToday: boolean;
}

export interface HabitMonthDTO {
  month: string; // yyyy-mm
  days: { date: string; scheduled: boolean; done: boolean; future: boolean; beforeStart: boolean }[];
  firstWeekday: number; // 0 = Sunday of the 1st
}
