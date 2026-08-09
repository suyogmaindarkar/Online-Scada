// ═══════════════════════════════════════════════════════════
// Chatbot Service — Fuzzy Search + Context Awareness
// Uses Fuse.js for typo-tolerant matching
// ═══════════════════════════════════════════════════════════

import Fuse from 'fuse.js';
import { KNOWLEDGE_BASE, PAGE_CONTEXT } from '../data/scadaKnowledgeBase';

const fuseOptions = {
  keys: [
    { name: 'question',  weight: 3 },
    { name: 'keywords',  weight: 4 },
    { name: 'answer',    weight: 1 },
    { name: 'category',  weight: 2 },
  ],
  threshold: 0.4,          // 0.0 = exact match, 1.0 = match anything
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 2,
  useExtendedSearch: false,
};

const fuse = new Fuse(KNOWLEDGE_BASE, fuseOptions);

/**
 * Search knowledge base with query + optional page context
 * Returns top matches with relevance scores
 */
export function searchKnowledgeBase(query, currentPath = null, limit = 5) {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const results = fuse.search(trimmed).slice(0, limit);

  // Boost results matching current page category
  const pageCategory = currentPath ? PAGE_CONTEXT[currentPath] : null;
  if (pageCategory) {
    results.sort((a, b) => {
      const aBoost = a.item.category === pageCategory ? -0.1 : 0;
      const bBoost = b.item.category === pageCategory ? -0.1 : 0;
      return (a.score + aBoost) - (b.score + bBoost);
    });
  }

  return results.map(r => ({
    ...r.item,
    score: r.score,
    confidence: Math.round((1 - r.score) * 100),
  }));
}

/**
 * Get a specific entry by ID (for related topic lookup)
 */
export function getEntryById(id) {
  return KNOWLEDGE_BASE.find(entry => entry.id === id);
}

/**
 * Get all entries in a category
 */
export function getEntriesByCategory(categoryId) {
  return KNOWLEDGE_BASE.filter(entry => entry.category === categoryId);
}

/**
 * Get suggested topics for current page
 */
export function getSuggestionsForPage(currentPath) {
  const category = PAGE_CONTEXT[currentPath];
  if (!category) return [];
  return getEntriesByCategory(category).slice(0, 4);
}

/**
 * Format response — greeting fallback if no results
 */
export function generateResponse(query, currentPath = null) {
  const results = searchKnowledgeBase(query, currentPath, 3);

  if (results.length === 0) {
    return {
      type: 'no-match',
      message: `I couldn't find a specific answer for "${query}". Try rephrasing, or explore these categories:`,
      suggestions: [
        { label: 'How to add a PLC',    query: 'add plc' },
        { label: 'How to create an alarm', query: 'create alarm' },
        { label: 'PLC not connecting',  query: 'plc offline' },
        { label: 'Bind tag to element', query: 'bind tag' },
      ],
    };
  }

  const best = results[0];

  // If confidence is very high, return direct answer
  if (best.confidence > 60) {
    return {
      type: 'answer',
      entry: best,
      relatedResults: results.slice(1, 3),
    };
  }

  // Low confidence — show options to user
  return {
    type: 'ambiguous',
    message: `I found a few possible matches. Which one did you mean?`,
    options: results,
  };
}