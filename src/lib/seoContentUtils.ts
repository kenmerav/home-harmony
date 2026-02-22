export function estimateReadMinutes(sections: string[][]) {
  const totalWords = sections.flat().reduce((sum, line) => sum + line.split(/\s+/).filter(Boolean).length, 0);
  return Math.max(3, Math.ceil(totalWords / 180));
}
