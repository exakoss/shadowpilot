"use client";

import clsx from "clsx";

type TabItem = {
  description: string;
  id: string;
  label: string;
  value?: string;
};

export function ConsoleSectionTabs({
  activeId,
  items,
  onChange,
}: {
  activeId: string;
  items: readonly TabItem[];
  onChange: (id: string) => void;
}) {
  const activeItem = items.find((item) => item.id === activeId) ?? items[0];

  return (
    <section className="panel rounded-[24px] p-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const selected = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={clsx(
                "min-w-fit rounded-[18px] border px-4 py-3 text-left transition",
                selected
                  ? "border-[var(--line-strong)] bg-[var(--background-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                  : "border-transparent bg-transparent hover:border-[var(--line)] hover:bg-[var(--background-muted)]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-fit">
                  <p className="text-sm font-semibold text-[var(--text)]">{item.label}</p>
                </div>
                {item.value ? (
                  <span
                    className={clsx(
                      "rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em]",
                      selected
                        ? "border-[var(--line-strong)] bg-white text-[var(--text)]"
                        : "border-[var(--line)] bg-[var(--background-muted)] text-[var(--text-muted)]",
                    )}
                  >
                    {item.value}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {activeItem ? (
        <div className="mt-3 rounded-[18px] border border-[var(--line)] bg-[var(--background-muted)] px-4 py-3">
          <p className="text-sm leading-6 text-[var(--text-muted)]">{activeItem.description}</p>
        </div>
      ) : null}
    </section>
  );
}
