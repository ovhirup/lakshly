"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/components/DataState";
import { Icon } from "@/components/Icon";
import { Amount } from "@/components/Privacy";
import { useTier } from "@/components/useTier";
import { Glass, PageHeader } from "@/components/ui";
import { formatINR, formatMonth, formatPct } from "@/lib/format";
import { pctMasked } from "@/lib/privacy";
import type { ReviewTxn } from "@/lib/review";
import { months } from "@/lib/selectors";
import {
  buildStory, shareTiles, storyMonthOpen, storySlides,
  type MonthlyStory, type StorySlide,
} from "@/lib/wow/story";
import { StoryShareSection } from "@/components/wow/StoryShare";
import "../wow.css";

function tileValue(story: MonthlyStory, label: string): string {
  if (label !== "Budgets kept" && pctMasked()) return formatPct(0);
  return shareTiles(story).find((row) => row.label === label)?.value ?? "\u2014";
}

function useStoryInput() {
  const { can } = useTier();
  const { transactions, rawTransactions, budgets, review } = useData();
  const monthList = useMemo(() => months(rawTransactions), [rawTransactions]);
  const latest = monthList[monthList.length - 1] ?? "";
  const share = can("wow.storyShare");
  const storyFor = (month: string): MonthlyStory => buildStory(
    rawTransactions,
    review.state,
    month,
    budgets,
    review.now,
    transactions as ReviewTxn[],
  );
  return { can, monthList, latest, share, storyFor };
}

function MiniStat({ title, value, testid }: { title: string; value: string; testid: string }) {
  return (
    <div className="wow-story-stat" data-testid={testid}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

/** Latest-month story on Overview. Free (`wow.story`). */
export function StoryCard() {
  const { can, latest, storyFor } = useStoryInput();
  if (!can("wow.story") || !latest) return null;
  const story = storyFor(latest);
  return (
    <Glass className="card wow-story-card" data-testid="wow-story-card">
      <h2>{story.label} story</h2>
      <p className="wow-story-win" data-testid="wow-story-win">{story.win}</p>
      <div className="wow-story-stats">
        <MiniStat title="Spend change" value={tileValue(story, "Spend vs last month")} testid="wow-story-spendChange" />
        <MiniStat title="Wants share" value={tileValue(story, "Wants share")} testid="wow-story-wantsShare" />
        <MiniStat title="Budgets kept" value={tileValue(story, "Budgets kept")} testid="wow-story-budgetsKept" />
      </div>
      <Link className="btn primary" href="/story/" data-testid="wow-story-open">Open story</Link>
    </Glass>
  );
}

function AmountLine({ caption, paise, id }: { caption: string; paise: number; id: string }) {
  const text = formatINR(paise);
  return (
    <div className="wow-metric" data-testid={`wow-story-amount-${id}`}>
      <span>{caption}</span>
      <strong><Amount>{text}</Amount></strong>
    </div>
  );
}

function SlideAmount({ slide, story }: { slide: StorySlide; story: MonthlyStory }) {
  if (slide.id === "intro") return <AmountLine caption="Spent" paise={story.spendPaise} id={slide.id} />;
  if (slide.id === "category" && story.topCategory.paise > 0) return <AmountLine caption="Spent" paise={story.topCategory.paise} id={slide.id} />;
  if (slide.id === "want" && story.topWant) return <AmountLine caption="Spent" paise={story.topWant.paise} id={slide.id} />;
  if (slide.id === "savings" && story.incomePaise > 0) return <AmountLine caption="Income" paise={story.incomePaise} id={slide.id} />;
  return null;
}

/** One slide at a time, with month chips. Past months stay locked on Free. */
export function StoryPager() {
  const { can, monthList, latest, share, storyFor } = useStoryInput();
  const [picked, setPicked] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const month = picked && storyMonthOpen(picked, monthList, share) ? picked : latest;
  const story = month ? storyFor(month) : null;
  const slides = story ? storySlides(story) : [];
  const bounded = slides.length === 0 ? 0 : Math.min(Math.max(0, index), slides.length - 1);
  const slide = slides[bounded] ?? { id: "empty", label: "Story", headline: "No story yet", detail: "" };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select")) return;
      event.preventDefault();
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      setIndex((current) => {
        const last = Math.max(0, slides.length - 1);
        return Math.min(last, Math.max(0, current + delta));
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  if (!can("wow.story")) return null;
  if (!story || !month) {
    return (
      <Glass className="card wow-story-pager" data-testid="wow-story-pager">
        <PageHeader title="Your story" />
        <p>No story yet</p>
      </Glass>
    );
  }

  const choose = (item: string) => {
    if (!storyMonthOpen(item, monthList, share)) return;
    setPicked(item);
    setIndex(0);
  };

  return (
    <Glass className="card wow-story-pager" data-testid="wow-story-pager">
      <PageHeader title={`${story.label} story`} />
      <div className="wow-story-months" data-testid="wow-story-months" role="group" aria-label="Month">
        {monthList.map((item) => {
          const open = storyMonthOpen(item, monthList, share);
          const selected = item === month;
          const name = formatMonth(item);
          return (
            <button
              key={item}
              type="button"
              className={`wow-story-chip${selected ? " on" : ""}`}
              disabled={!open}
              aria-pressed={selected}
              aria-label={open ? name : `${name} (Premium)`}
              data-testid={`wow-story-month-${item}`}
              onClick={() => choose(item)}
            >
              {open ? null : <Icon name="lock" size={12} />}
              {name}
            </button>
          );
        })}
      </div>
      <div className="wow-story-slide" data-testid={`wow-story-slide-${slide.id}`} aria-live="polite">
        <p className="wow-story-kicker">{slide.label}</p>
        <p className="wow-story-headline">{slide.headline}</p>
        {slide.detail ? <p className="wow-story-detail">{slide.detail}</p> : null}
        <SlideAmount slide={slide} story={story} />
      </div>
      <div className="wow-story-controls">
        <button
          type="button"
          className="btn ghost"
          data-testid="wow-story-previous"
          disabled={bounded <= 0}
          onClick={() => setIndex((current) => Math.max(0, current - 1))}
        >
          Previous
        </button>
        <div
          className="wow-story-dots"
          data-testid="wow-story-dots"
          role="img"
          aria-label={`Slide ${bounded + 1} of ${Math.max(slides.length, 1)}`}
        >
          {slides.map((row, dot) => (
            <span key={row.id} className={`wow-story-dot${dot === bounded ? " on" : ""}`} />
          ))}
        </div>
        <button
          type="button"
          className="btn primary"
          data-testid="wow-story-next"
          disabled={slides.length === 0 || bounded >= slides.length - 1}
          onClick={() => setIndex((current) => (slides.length === 0 ? 0 : Math.min(slides.length - 1, current + 1)))}
        >
          Next
        </button>
      </div>
      <StoryShareSection story={story} />
    </Glass>
  );
}
