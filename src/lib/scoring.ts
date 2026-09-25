import type { Criterion, Rating } from '../types'

/**
 * Weighted score (0-5) for one user on one property, using only the
 * criteria that user actually rated (so a partially-rated property still
 * gets a meaningful score instead of being dragged down by zeros).
 */
export function weightedScore(ratings: Rating[], criteria: Criterion[]): number | null {
  if (ratings.length === 0) return null

  const criteriaById = new Map(criteria.map((c) => [c.id, c]))
  let weightSum = 0
  let starWeightSum = 0

  for (const rating of ratings) {
    const criterion = criteriaById.get(rating.criterionId)
    if (!criterion || !criterion.active) continue
    weightSum += criterion.weight
    starWeightSum += rating.stars * criterion.weight
  }

  if (weightSum === 0) return null
  return starWeightSum / weightSum
}

export function combinedScore(perUser: (number | null)[]): number | null {
  const values = perUser.filter((v): v is number => v !== null)
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function formatScore(score: number | null): string {
  if (score === null) return '—'
  return score.toFixed(1)
}
