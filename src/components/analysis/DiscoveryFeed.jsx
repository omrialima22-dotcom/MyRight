import React from "react";
import DiscoveryCard from "./DiscoveryCard";

const MAX_VISIBLE = 10;

export default function DiscoveryFeed({ discoveries, coverageCount }) {
  if (discoveries.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          עדיין לא זיהינו פרטים. מיד שנמצא משהו בפוליסה, הוא יופיע כאן.
        </p>
      </div>
    );
  }

  const visible = discoveries.slice(0, MAX_VISIBLE);
  const hidden = discoveries.length - visible.length;

  return (
    <div>
      {coverageCount > 0 && (
        <p className="text-sm text-muted-foreground mb-3">
          מצאנו {coverageCount} כיסוי{coverageCount === 1 ? "" : "ים"}
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {visible.map((d) => (
          <DiscoveryCard key={d.key} discovery={d} />
        ))}
      </div>
      {hidden > 0 && (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          ועוד {hidden} פרטים שמורים ברקע — יופיעו במסך הזכויות.
        </p>
      )}
    </div>
  );
}