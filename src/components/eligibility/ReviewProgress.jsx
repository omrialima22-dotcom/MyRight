import React from "react";

export default function ReviewProgress({ coveragesTotal, coveragesReviewed, answered, total, remaining }) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  return (
    <div className="mb-5">
      <h2 className="font-heading text-xl font-bold mb-3">בדיקת הזכאות שלך</h2>

      {coveragesTotal > 0 && (
        <p className="text-sm text-muted-foreground mb-1">
          בדקנו {coveragesReviewed} מתוך {coveragesTotal} אפשרויות
        </p>
      )}

      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[15px] font-medium text-foreground">
          {total > 0 ? (
            <>ענית על {answered} מתוך {total} שאלות</>
          ) : (
            <>{answered} שאלות הושלמו</>
          )}
        </p>
        {total > 0 && remaining > 0 && (
          <span className="text-xs text-muted-foreground">נשארו {remaining} שאלות</span>
        )}
      </div>

      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {total > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground/80 leading-relaxed">
          * מספר השאלות עשוי להתעדכן תוך כדי הבדיקה, בהתאם לתשובות שלך.
        </p>
      )}
    </div>
  );
}