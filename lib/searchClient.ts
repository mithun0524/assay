export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface SearchResponse {
  answer?: string;
  results: SearchResult[];
  query: string;
}

const CONTENT_CAP = 800;

export async function executeSearch(
  query: string,
  maxResults = 5
): Promise<SearchResponse> {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, maxResults }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `Search failed (${res.status})`);
  }

  const data = await res.json();
  return {
    answer: data.answer ?? undefined,
    results: (data.results ?? []).map((r: any) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: r.content ?? '',
      score: r.score ?? 0,
    })),
    query,
  };
}

export function formatSearchResults(data: SearchResponse): string {
  const lines: string[] = ['<web_search_results>'];
  lines.push(`<query>${data.query}</query>`);

  if (data.answer) {
    lines.push(`<answer>${data.answer}</answer>`);
  }

  for (const result of data.results) {
    const content =
      result.content.length > CONTENT_CAP
        ? result.content.slice(0, CONTENT_CAP) + '...'
        : result.content;
    lines.push('<result>');
    lines.push(`  <title>${result.title}</title>`);
    lines.push(`  <url>${result.url}</url>`);
    lines.push(`  <content>${content}</content>`);
    lines.push('</result>');
  }

  lines.push('</web_search_results>');
  return lines.join('\n');
}
