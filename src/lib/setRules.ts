import type { SetRules } from '../types'

export function normalizeSetRules(rules: Partial<SetRules> | undefined): SetRules {
  const group = rules?.group
  const knockout = rules?.knockout_early ?? rules?.quarters ?? rules?.semis
  const finals = rules?.finals

  return {
    group: group === 5 || group === 7 ? group : 3,
    knockout_early: knockout === 3 || knockout === 7 ? knockout : 5,
    quarters:
      rules?.quarters === 3 || rules?.quarters === 7
        ? rules.quarters
        : knockout === 3 || knockout === 7
          ? knockout
          : 5,
    semis:
      rules?.semis === 3 || rules?.semis === 7
        ? rules.semis
        : knockout === 3 || knockout === 7
          ? knockout
          : 5,
    finals: finals === 7 ? 7 : 5,
  }
}

export function formatSetRulesSummary(rules: SetRules): {
  group: string
  knockout: string
  finals: string
} {
  return {
    group: `Best of ${rules.group}`,
    knockout: `Best of ${rules.knockout_early}`,
    finals: `Best of ${rules.finals}`,
  }
}
