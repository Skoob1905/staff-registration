export function getTagName(
  tagsMap: Record<string, string>,
  tagId: string,
): string | undefined {
  return tagsMap[tagId];
}
