// ═══════════════════════════════════════════════════════════
// Chatbot Analytics — Local Storage Based
// Tracks: queries, matches, feedback, unmatched
// All data stays in browser (no server, no privacy concerns)
// ═══════════════════════════════════════════════════════════

const STORAGE_KEY = 'scada_chatbot_analytics';
const MAX_HISTORY = 500; // cap to prevent localStorage bloat

// ─── Load analytics from localStorage ─────────────────────
function loadAnalytics() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultAnalytics();
    const parsed = JSON.parse(raw);
    return { ...getDefaultAnalytics(), ...parsed };
  } catch {
    return getDefaultAnalytics();
  }
}

function getDefaultAnalytics() {
  return {
    totalQueries:   0,
    matchedQueries: 0,
    unmatchedQueries: 0,
    queries:        [],  // last N queries
    entryStats:     {},  // { entryId: { hits, likes, dislikes } }
    unmatchedList:  [],  // queries that got no match
    startedAt:      new Date().toISOString(),
  };
}

// ─── Save to localStorage ──────────────────────────────────
function saveAnalytics(data) {
  try {
    // Cap arrays to prevent bloat
    if (data.queries.length > MAX_HISTORY) {
      data.queries = data.queries.slice(-MAX_HISTORY);
    }
    if (data.unmatchedList.length > MAX_HISTORY) {
      data.unmatchedList = data.unmatchedList.slice(-MAX_HISTORY);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[Analytics] Failed to save:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

/**
 * Track a query and its match result
 */
export function trackQuery(query, matchedEntryId, matchType) {
  const data = loadAnalytics();
  data.totalQueries += 1;

  const record = {
    query,
    matchedEntryId,
    matchType,       // 'answer' | 'ambiguous' | 'no-match'
    timestamp:       new Date().toISOString(),
  };
  data.queries.push(record);

  if (matchType === 'no-match') {
    data.unmatchedQueries += 1;
    data.unmatchedList.push({ query, timestamp: record.timestamp });
  } else {
    data.matchedQueries += 1;
    if (matchedEntryId) {
      if (!data.entryStats[matchedEntryId]) {
        data.entryStats[matchedEntryId] = { hits: 0, likes: 0, dislikes: 0 };
      }
      data.entryStats[matchedEntryId].hits += 1;
    }
  }

  saveAnalytics(data);
}

/**
 * Track feedback (thumbs up/down) on an answer
 */
export function trackFeedback(entryId, isPositive) {
  if (!entryId) return;
  const data = loadAnalytics();
  if (!data.entryStats[entryId]) {
    data.entryStats[entryId] = { hits: 0, likes: 0, dislikes: 0 };
  }
  if (isPositive) {
    data.entryStats[entryId].likes += 1;
  } else {
    data.entryStats[entryId].dislikes += 1;
  }
  saveAnalytics(data);
}

/**
 * Get analytics summary for the dashboard
 */
export function getAnalyticsSummary() {
  const data = loadAnalytics();

  // Top asked
  const topAsked = Object.entries(data.entryStats)
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 10);

  // Top liked
  const topLiked = Object.entries(data.entryStats)
    .map(([id, stats]) => ({ id, ...stats, score: stats.likes - stats.dislikes }))
    .filter(s => s.likes > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Top disliked (needs improvement)
  const needsImprovement = Object.entries(data.entryStats)
    .map(([id, stats]) => ({ id, ...stats, ratio: stats.dislikes / (stats.likes + stats.dislikes) }))
    .filter(s => s.dislikes > 0 && (s.likes + s.dislikes) >= 2)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 10);

  // Recent unmatched queries
  const recentUnmatched = [...data.unmatchedList].reverse().slice(0, 20);

  // Recent queries
  const recentQueries = [...data.queries].reverse().slice(0, 20);

  return {
    totalQueries:     data.totalQueries,
    matchedQueries:   data.matchedQueries,
    unmatchedQueries: data.unmatchedQueries,
    matchRate:        data.totalQueries > 0
      ? Math.round((data.matchedQueries / data.totalQueries) * 100)
      : 0,
    startedAt:        data.startedAt,
    topAsked,
    topLiked,
    needsImprovement,
    recentUnmatched,
    recentQueries,
  };
}

/**
 * Export analytics as JSON blob for download
 */
export function exportAnalytics() {
  const data = loadAnalytics();
  return JSON.stringify(data, null, 2);
}

/**
 * Reset all analytics data
 */
export function resetAnalytics() {
  localStorage.removeItem(STORAGE_KEY);
}