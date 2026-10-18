"use client";
import { DataGate } from "@/components/DataState";
import { StoryPager } from "@/components/wow/Story";

export default function StoryPage() {
  return (
    <DataGate title="Your story">
      <StoryPager />
    </DataGate>
  );
}
