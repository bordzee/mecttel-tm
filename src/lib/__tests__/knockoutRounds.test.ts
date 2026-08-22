import { describe, expect, it } from 'vitest'
import {
  formatKnockoutByePreview,
  formatKnockoutByePreviewFromGroupSizes,
  knockoutRoundFromBracketSize,
  knockoutRoundTabLabel,
  previewKnockoutByes,
  previewKnockoutByesFromGroupSizes,
  resolveEffectiveKnockoutRounds,
} from '../knockoutRounds'

describe('knockoutRounds', () => {
  it('maps bracket size to round ids', () => {
    expect(knockoutRoundFromBracketSize(128)).toBe('r128')
    expect(knockoutRoundFromBracketSize(64)).toBe('r64')
    expect(knockoutRoundFromBracketSize(32)).toBe('r32')
    expect(knockoutRoundFromBracketSize(16)).toBe('r16')
    expect(knockoutRoundFromBracketSize(8)).toBe('quarter')
    expect(knockoutRoundFromBracketSize(4)).toBe('semi')
    expect(knockoutRoundFromBracketSize(2)).toBe('final')
  })

  it('labels tabs from round id', () => {
    expect(knockoutRoundTabLabel('r16')).toBe('R16')
    expect(knockoutRoundTabLabel('quarter')).toBe('QF')
    expect(knockoutRoundTabLabel('semi')).toBe('SF')
    expect(knockoutRoundTabLabel('third_place')).toBe('3rd Place')
  })

  it('previews knockout byes from group count and advance per group', () => {
    expect(previewKnockoutByes(4, 2)).toMatchObject({
      advancers: 8,
      bracketSize: 8,
      byeCount: 0,
      skipRoundLabel: null,
    })
    expect(previewKnockoutByes(5, 2)).toMatchObject({
      advancers: 10,
      bracketSize: 16,
      byeCount: 6,
    })
    expect(formatKnockoutByePreview(4, 2)).toBe('4 groups · 8 advancers · no byes')
    expect(formatKnockoutByePreview(5, 2)).toContain('10 advancers · 6 byes')
    expect(formatKnockoutByePreview(5, 2)).toContain('round of 16')
  })

  it('previews byes from actual group sizes after late check-in', () => {
    expect(previewKnockoutByesFromGroupSizes([4, 4, 4, 4, 4, 4, 4, 4], 2)).toMatchObject({
      advancers: 16,
      byeCount: 0,
    })
    expect(previewKnockoutByesFromGroupSizes([4, 4, 4, 4, 4, 4, 4, 4, 2], 2)).toMatchObject({
      advancers: 18,
      byeCount: 14,
      bracketSize: 32,
    })
    expect(formatKnockoutByePreviewFromGroupSizes([4, 4, 4, 4, 4, 4, 4, 4, 2], 2)).toContain(
      '9 groups · 18 advancers',
    )
  })

  it('infers effective rounds from source tree (legacy mis-labeled semis)', () => {
    const matches = [
      { id: 'q0', round: 'quarter', source_match_a_id: null, source_match_b_id: null },
      { id: 'q1', round: 'quarter', source_match_a_id: null, source_match_b_id: null },
      { id: 'q2', round: 'quarter', source_match_a_id: null, source_match_b_id: null },
      { id: 'q3', round: 'quarter', source_match_a_id: null, source_match_b_id: null },
      { id: 'q4', round: 'quarter', source_match_a_id: null, source_match_b_id: null },
      { id: 'q5', round: 'quarter', source_match_a_id: null, source_match_b_id: null },
      { id: 'q6', round: 'quarter', source_match_a_id: null, source_match_b_id: null },
      { id: 'q7', round: 'quarter', source_match_a_id: null, source_match_b_id: null },
      { id: 's0', round: 'semi', source_match_a_id: 'q0', source_match_b_id: 'q1' },
      { id: 's1', round: 'semi', source_match_a_id: 'q2', source_match_b_id: 'q3' },
      { id: 's2', round: 'semi', source_match_a_id: 'q4', source_match_b_id: 'q5' },
      { id: 's3', round: 'semi', source_match_a_id: 'q6', source_match_b_id: 'q7' },
      { id: 's4', round: 'semi', source_match_a_id: 's0', source_match_b_id: 's1' },
      { id: 's5', round: 'semi', source_match_a_id: 's2', source_match_b_id: 's3' },
      { id: 'f0', round: 'final', source_match_a_id: 's4', source_match_b_id: 's5' },
    ]

    const effective = resolveEffectiveKnockoutRounds(matches)
    expect(effective.get('q0')).toBe('r16')
    expect(effective.get('s0')).toBe('quarter')
    expect(effective.get('s4')).toBe('semi')
    expect(effective.get('f0')).toBe('final')
  })
})
