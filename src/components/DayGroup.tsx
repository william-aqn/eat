import type { Entry } from "../db";
import { t, useLocale } from "../i18n";
import { dayLabel, dayLabelPrint } from "../ui/format";
import EntryItem from "./EntryItem";

export default function DayGroup({ day, items }: { day: number; items: Entry[] }) {
  const locale = useLocale();
  return (
    <section className="day">
      <h2 className="day-label">
        <span className="screen-only">{dayLabel(day, locale, t("today"), t("yesterday"))}</span>
        <span className="print-only">{dayLabelPrint(day, locale)}</span>
      </h2>
      <ul className="day-list">
        {items.map((e) => (
          <EntryItem key={e.id} entry={e} />
        ))}
      </ul>
    </section>
  );
}
