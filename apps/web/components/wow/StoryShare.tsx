"use client";
import { useAppState } from "@/components/AppState";
import { Icon } from "@/components/Icon";
import { useTier } from "@/components/useTier";
import { Glass, PremiumBadge } from "@/components/ui";
import { IS_BETA } from "@/lib/edition";
import type { MonthlyStory } from "@/lib/wow/story";

/** Round 2c fills the share image. Premium renders nothing until then. */
export function StoryShareSection({ story }: { story: MonthlyStory }) {
  const { can } = useTier();
  const { setPlan } = useAppState();
  if (can("wow.storyShare")) return null;
  return (
    <Glass className="card wow-locked" data-testid="wow-storyShare-card" data-month={story.month}>
      <div className="wow-locked-top">
        <div className="wow-lock" aria-hidden="true"><Icon name="lock" size={18} /></div>
        <div>
          <h2>Share your story</h2>
          <p className="muted">Pick any past month and share a story card. The image shows percentages only, never amounts.</p>
        </div>
      </div>
      <PremiumBadge small />
      {IS_BETA
        ? <button type="button" className="btn primary" data-testid="wow-storyShare-preview" onClick={() => setPlan("premium")}>Preview Premium (demo)</button>
        : <p className="tiny muted">Payments aren’t live yet.</p>}
    </Glass>
  );
}
