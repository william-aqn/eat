import type { Entry } from "../db";
import { t, useLocale } from "../i18n";
import { dayLabel } from "../ui/format";
import EntryItem from "./EntryItem";

export default function DayGroup({ day, items }: { day: number; items: Entry[] }) {
  const locale = useLocale();
  return (
    <section className="day">
      <h2 className="day-label">{dayLabel(day, locale, t("today"), t("yesterday"))}</h2>
      <ul className="day-list">
        {items.map((e) => (
          <EntryItem key={e.id} entry={e} />
        ))}
      </ul>
    </section>
  );
}
