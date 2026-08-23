/** MECTTEL Singles – Open (Aug 2026 live event). Top 2 per group from yesterday's standings. */
export const MECTTEL_SINGLES_OPEN = {
  tournament: {
    name: 'MECTTEL Singles Tournament',
    venue: 'MECTTEL Sports Hall',
    start_date: '2026-08-22',
  },
  event: {
    name: 'Singles – Open',
    event_type: 'single' as const,
    category: 'open' as const,
    status: 'ongoing' as const,
    config: {
      advance_count: 2,
      knockout_bracket: 'mirror' as const,
      group_count: 8,
      entries_per_group: 5,
      group_sizes: [4, 5, 5, 4, 4, 4, 5, 5],
      set_rules: {
        group: 5 as const,
        knockout_early: 5 as const,
        quarters: 5 as const,
        semis: 5 as const,
        finals: 5 as const,
      },
    },
  },
  /** Players in finish-strength order within each group (index 0 = group #1). */
  groups: [
    {
      label: 'A',
      players: [
        { name: 'Luke Moriles', organization: 'Abellana' },
        { name: 'Ronnie Bajarias', organization: 'MECTTEL' },
        { name: 'Madrazo', organization: 'CIT' },
        { name: 'Alipin', organization: 'CIT' },
      ],
    },
    {
      label: 'B',
      players: [
        { name: 'Boyaks', organization: 'MECTTEL' },
        { name: 'Enicka', organization: 'USC' },
        { name: 'Candilada', organization: 'CIT' },
        { name: 'Soria', organization: 'CIT' },
        { name: 'Lumapak', organization: 'CIT' },
      ],
    },
    {
      label: 'C',
      players: [
        { name: 'Kanot', organization: 'MECTTEL' },
        { name: 'Martin', organization: 'MECTTEL' },
        { name: 'Quinon', organization: 'CIT' },
        { name: 'Noel', organization: 'CIT' },
        { name: 'Dela Cruz', organization: 'CIT' },
      ],
    },
    {
      label: 'D',
      players: [
        { name: 'Franco', organization: 'MECTTEL' },
        { name: 'Nathan Bucotot', organization: 'Toledo' },
        { name: 'Reyes', organization: 'Toledo' },
        { name: 'Santos', organization: 'MECTTEL' },
      ],
    },
    {
      label: 'E',
      players: [
        { name: 'Cabaron', organization: 'CIT' },
        { name: 'Ricafort', organization: 'CIT' },
        { name: 'Garcia', organization: 'CIT' },
        { name: 'Cruz', organization: 'CIT' },
      ],
    },
    {
      label: 'F',
      players: [
        { name: 'Bordz', organization: 'MECTTEL' },
        { name: 'Takeru fujimura', organization: '' },
        { name: 'Tanaka', organization: '' },
        { name: 'Yamamoto', organization: '' },
      ],
    },
    {
      label: 'G',
      players: [
        { name: 'Hayato Fujimura', organization: '' },
        { name: 'Hans Ignacio', organization: 'UP' },
        { name: 'Park', organization: 'UP' },
        { name: 'Kim', organization: 'UP' },
        { name: 'Lee', organization: '' },
      ],
    },
    {
      label: 'H',
      players: [
        { name: 'JM Aquino', organization: 'Maasin' },
        { name: 'Marlon', organization: 'MECTTEL' },
        { name: 'Villanueva', organization: 'Maasin' },
        { name: 'Ramos', organization: 'MECTTEL' },
        { name: 'Torres', organization: 'Abellana' },
      ],
    },
  ],
} as const

/** Manual paper R16 from the Aug 2026 live event (mirror cross). */
export const EXPECTED_MIRROR_R16 = [
  'Luke Moriles vs Marlon',
  'Boyaks vs Hans Ignacio',
  'Kanot vs Takeru fujimura',
  'Franco vs Ricafort',
  'Cabaron vs Nathan Bucotot',
  'Bordz vs Martin',
  'Hayato Fujimura vs Enicka',
  'JM Aquino vs Ronnie Bajarias',
] as const
