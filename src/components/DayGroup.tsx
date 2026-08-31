import type { Notice } from "../App";
import type { Entry } from "../db";
import { t, useLocale } from "../i18n";
import { dayLabel } from "../ui/format";
import EntryItem from "./EntryItem";

export default function DayGroup({
  day,
  items,
  onNotice
}: {
  day: number;
  items: Entry[];
  onNotice: (n: Notice) => void;
}) {
  const locale = useLocale();
  return (
    <section className="day">
      <h2 className="day-label">{dayLabel(day, locale, t("today"), t("yesterday"))}</h2>
      <ul className="day-list">
        {items.map((e) => (
          <EntryItem key={e.id} entry={e} onNotice={onNotice} />
        ))}
      </ul>
    </section>
  );
}
