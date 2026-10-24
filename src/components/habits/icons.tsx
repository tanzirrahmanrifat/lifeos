import { BookOpen, Brain, CircleCheck, Coffee, Droplet, Dumbbell, Heart, Leaf, Moon, Music, Pencil, Sun, type LucideIcon } from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  check: CircleCheck,
  dumbbell: Dumbbell,
  book: BookOpen,
  brain: Brain,
  droplet: Droplet,
  sun: Sun,
  moon: Moon,
  pencil: Pencil,
  heart: Heart,
  coffee: Coffee,
  music: Music,
  leaf: Leaf,
};

export function HabitIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? CircleCheck;
  return <Icon className={className} aria-hidden />;
}
