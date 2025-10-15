export function isHumanLatency(ms: number) { return ms >= 60; }
export function anomalyFlags(reactions: number[]) {
  const tooManyFast = reactions.filter(v => v < 120).length > reactions.length * 0.7;
  return { tooManyFast };
}