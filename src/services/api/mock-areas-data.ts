import type {
  Area,
  Block,
  CollectionSchema,
  DataSource,
  Item,
  ItemLink,
} from './types'

const stamp = (daysAgo = 0) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString()
}

const localDateAfter = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('-')
}

export const mockAreas: Area[] = [
  {
    id: 'personal-inventory',
    name: 'Personal Inventory',
    description: 'A considered record of the things I own and care for.',
    collectionIds: ['inventory'],
    pageIds: ['page-inventory'],
    accent: 'chart-3',
    order: 0,
    blockIds: [
      'inventory-value',
      'inventory-count',
      'inventory-warranties',
      'inventory-location',
      'inventory-recent',
    ],
    itemCount: 25,
    glance: '25 items, 3 warranties ending soon',
    lastActiveAt: stamp(1),
    icon: 'archive',
    coverTone: 'sand',
  },
  {
    id: 'home-budget',
    name: 'Home Budget',
    description: 'A clearer picture of what comes in and where it goes.',
    collectionIds: ['purchases', 'investments', 'income', 'taxes'],
    pageIds: ['page-budget'],
    accent: 'chart-3',
    order: 1,
    blockIds: [
      'budget-spent',
      'budget-income',
      'budget-taxes',
      'budget-spending',
      'budget-purchases',
      'budget-investments',
    ],
    itemCount: 2014,
    glance: '2,004 entries, spending is on track this month',
    lastActiveAt: stamp(0),
    icon: 'wallet',
    coverTone: 'sage',
  },
  {
    id: 'health-fitness',
    name: 'Health and Fitness',
    description: 'Small habits, steady progress, and room to notice patterns.',
    collectionIds: ['weight-log', 'workouts', 'recovery'],
    pageIds: ['page-health'],
    accent: 'chart-2',
    order: 2,
    blockIds: ['health-weight', 'health-workouts', 'health-recovery'],
    itemCount: 82,
    glance: '82 logs, sleep sync is up to date',
    lastActiveAt: stamp(2),
    icon: 'activity',
    coverTone: 'blue',
  },
  {
    id: 'outdoors',
    name: 'Outdoors',
    description: 'Trails, trips, and the places I want to remember.',
    collectionIds: ['hikes'],
    pageIds: ['page-outdoors'],
    accent: 'chart-5',
    order: 3,
    blockIds: ['outdoors-hikes'],
    itemCount: 14,
    glance: '14 hikes, 2 trips on the wishlist',
    lastActiveAt: stamp(3),
    icon: 'mountain',
    coverTone: 'clay',
  },
  {
    id: 'spirituality-code',
    name: 'Spirituality and Moral Code',
    description: 'Ideas and practices that help me live with intention.',
    collectionIds: ['concepts'],
    pageIds: ['page-spirituality'],
    accent: 'chart-1',
    order: 4,
    blockIds: ['creed', 'concepts-list'],
    itemCount: 3,
    glance: 'A personal creed and 3 guiding concepts',
    lastActiveAt: stamp(5),
    icon: 'sun',
    coverTone: 'lavender',
  },
]

const fields = (
  definitions: Array<
    [
      string,
      string,
      CollectionSchema['fields'][number]['type'],
      string?,
      string[]?,
    ]
  >,
) =>
  definitions.map(([id, name, type, unit, options], order) => ({
    id,
    name,
    type,
    unit,
    options,
    order,
  }))

export const mockCollections: CollectionSchema[] = [
  {
    id: 'inventory',
    areaId: 'personal-inventory',
    name: 'Personal Inventory',
    description: 'Things worth keeping track of.',
    fields: fields([
      ['make', 'Make', 'text'],
      ['model', 'Model', 'text'],
      ['serial', 'Serial number', 'text'],
      ['purchaseDate', 'Purchase date', 'date'],
      ['amount', 'Amount', 'currency'],
      ['warrantyEnds', 'Warranty ends', 'date'],
      [
        'location',
        'Location',
        'choice',
        undefined,
        [
          'Studio shelf',
          'Living room',
          'Bedroom dresser',
          'Garage',
          'Hall closet',
        ],
      ],
      ['photo', 'Photo', 'image'],
    ]),
    createdAt: stamp(120),
    updatedAt: stamp(1),
  },
  {
    id: 'purchases',
    areaId: 'home-budget',
    name: 'Purchases',
    description: 'Everyday spending, with the details close by.',
    fields: fields([
      ['merchant', 'Merchant', 'text'],
      ['description', 'Description', 'text'],
      [
        'category',
        'Category',
        'choice',
        undefined,
        [
          'Groceries',
          'Home',
          'Dining',
          'Transport',
          'Health',
          'Utilities',
          'Personal',
        ],
      ],
      ['amount', 'Amount', 'currency'],
      ['date', 'Date', 'date'],
      ['payment', 'Payment', 'choice', undefined, ['Card', 'Checking', 'Cash']],
      ['reference', 'Related item', 'reference'],
    ]).map((field) =>
      // Purchases keep a description, but the table reads better without it.
      field.id === 'description' ? { ...field, hiddenByDefault: true } : field,
    ),
    flow: 'outgoing',
    createdAt: stamp(180),
    updatedAt: stamp(0),
  },
  {
    id: 'income',
    areaId: 'home-budget',
    name: 'Income',
    description: 'Paychecks and other money coming in this month.',
    fields: fields([
      ['source', 'Source', 'text'],
      ['amount', 'Amount', 'currency'],
      ['date', 'Date', 'date'],
    ]),
    flow: 'incoming',
    createdAt: stamp(180),
    updatedAt: stamp(0),
  },
  {
    id: 'taxes',
    areaId: 'home-budget',
    name: 'Tax savings',
    description: 'Money set aside for upcoming taxes.',
    fields: fields([
      ['source', 'Source', 'text'],
      ['amount', 'Amount', 'currency'],
      ['date', 'Date', 'date'],
    ]),
    createdAt: stamp(180),
    updatedAt: stamp(0),
  },
  {
    id: 'investments',
    areaId: 'home-budget',
    name: 'Investments',
    description: 'Accounts and the holdings inside them.',
    fields: fields([
      ['account', 'Account', 'text'],
      [
        'kind',
        'Type',
        'choice',
        undefined,
        ['Investment account', 'Retirement', 'Cash reserve'],
      ],
      ['value', 'Value', 'currency'],
      ['change', 'Change', 'number', '%'],
    ]),
    createdAt: stamp(150),
    updatedAt: stamp(4),
  },
  {
    id: 'weight-log',
    areaId: 'health-fitness',
    name: 'Weight log',
    description: 'A gentle record of daily measurements.',
    fields: fields([
      ['weight', 'Weight', 'number', 'lb'],
      ['date', 'Date', 'date'],
    ]),
    createdAt: stamp(80),
    updatedAt: stamp(2),
  },
  {
    id: 'workouts',
    areaId: 'health-fitness',
    name: 'Workouts',
    description: 'Movement, duration, and muscle groups.',
    fields: fields([
      ['workout', 'Workout', 'text'],
      ['duration', 'Duration', 'duration'],
      ['muscles', 'Muscle groups', 'multiChoice'],
      ['date', 'Date', 'date'],
    ]),
    createdAt: stamp(80),
    updatedAt: stamp(3),
  },
  {
    id: 'recovery',
    areaId: 'health-fitness',
    name: 'Sleep and recovery',
    description: 'Readings from an example connected source.',
    fields: fields([
      ['sleep', 'Sleep', 'duration'],
      ['recovery', 'Recovery', 'number', '%'],
      ['date', 'Date', 'date'],
    ]),
    createdAt: stamp(80),
    updatedAt: stamp(2),
  },
  {
    id: 'hikes',
    areaId: 'outdoors',
    name: 'Hikes',
    description: 'Routes, stories, and gear that made the day.',
    fields: fields([
      ['trail', 'Trail', 'text'],
      ['distance', 'Distance', 'number', 'mi'],
      ['date', 'Date', 'date'],
      ['photos', 'Photos', 'image'],
    ]),
    createdAt: stamp(190),
    updatedAt: stamp(3),
  },
  {
    id: 'concepts',
    areaId: 'spirituality-code',
    name: 'Concepts',
    description: 'Principles I want to keep returning to.',
    fields: fields([
      ['definition', 'Definition', 'longText'],
      ['principles', 'Principles', 'longText'],
    ]),
    createdAt: stamp(200),
    updatedAt: stamp(5),
  },
]

const inventoryItems: Item[] = [
  {
    id: 'inventory-camera',
    areaId: 'personal-inventory',
    collectionId: 'inventory',
    title: 'Rangefinder camera',
    type: 'inventory',
    data: {
      make: 'Nikon',
      model: 'FM2',
      serial: 'N-2048117',
      purchaseDate: '2024-05-18',
      amount: 820,
      warrantyEnds: localDateAfter(57),
      location: 'Studio shelf',
      photo: '/areas/inventory-camera.webp',
    },
    createdAt: stamp(160),
    updatedAt: stamp(1),
  },
  {
    id: 'inventory-chair',
    areaId: 'personal-inventory',
    collectionId: 'inventory',
    title: 'Walnut lounge chair',
    type: 'inventory',
    data: {
      make: 'Hearth & Hand',
      model: 'Lounge 02',
      serial: 'HH-88420',
      purchaseDate: '2023-11-09',
      amount: 1250,
      warrantyEnds: localDateAfter(35),
      location: 'Living room',
      photo: '/areas/inventory-chair.webp',
    },
    createdAt: stamp(250),
    updatedAt: stamp(7),
  },
  {
    id: 'inventory-watch',
    areaId: 'personal-inventory',
    collectionId: 'inventory',
    title: 'Everyday watch',
    type: 'inventory',
    data: {
      make: 'Junghans',
      model: 'Max Bill',
      serial: 'JM-41028',
      purchaseDate: '2025-03-04',
      amount: 690,
      warrantyEnds: localDateAfter(46),
      location: 'Bedroom dresser',
      photo: '/areas/inventory-watch.webp',
    },
    createdAt: stamp(90),
    updatedAt: stamp(11),
  },
  {
    id: 'inventory-bike',
    areaId: 'personal-inventory',
    collectionId: 'inventory',
    title: 'Steel road bicycle',
    type: 'inventory',
    data: {
      make: 'All-City',
      model: 'Space Horse',
      serial: 'AC-743991',
      purchaseDate: '2022-06-12',
      amount: 1800,
      warrantyEnds: localDateAfter(237),
      location: 'Garage',
      photo: '/areas/inventory-bike.webp',
    },
    createdAt: stamp(340),
    updatedAt: stamp(28),
  },
]

// [title, make, model, location, price, bought (days ago), warranty (days left; negative = expired)]
const extraInventory: Array<
  [string, string, string, string, number, number, number]
> = [
  [
    'Ceramic table lamp',
    'Hearth & Hand',
    'Dune lamp',
    'Living room',
    129,
    410,
    -45,
  ],
  [
    'Leather weekender',
    'Northline',
    'Weekender 48',
    'Hall closet',
    340,
    620,
    480,
  ],
  [
    'Oak bookshelf',
    'Field & Oak',
    'Ladder shelf',
    'Living room',
    410,
    900,
    -200,
  ],
  [
    'Field binoculars',
    'Lumen Optics',
    '8x42 Trail',
    'Hall closet',
    289,
    300,
    62,
  ],
  ['Wool throw', 'Hearth & Hand', 'Merino throw', 'Bedroom', 98, 120, -10],
  ['Desk microphone', 'Clearwave', 'CW-1 USB', 'Studio', 149, 210, 21],
  ['Travel tripod', 'Peakline', 'Carbon 4', 'Studio', 230, 480, 250],
  ['Stoneware set', 'Kiln & Co', 'Service for 6', 'Kitchen', 175, 700, -300],
  ['Canvas daypack', 'All-City', 'Commuter 22L', 'Hall closet', 120, 260, 105],
  ['Floor mirror', 'Field & Oak', 'Arched 65"', 'Bedroom', 260, 150, 580],
  ['Garden shears', 'Rootwork', 'Bypass pruner', 'Garage', 46, 95, 270],
  ['Portable speaker', 'Clearwave', 'Go Mini', 'Kitchen', 89, 330, 35],
  ['Reading glasses', 'Lumen Optics', 'Classic +1.5', 'Bedroom', 64, 60, 300],
  ['Coffee grinder', 'Kiln & Co', 'Burr 40', 'Kitchen', 199, 380, 74],
  ['Drawing tablet', 'Pixelpad', 'Pro 13', 'Studio', 649, 240, 490],
  [
    'Linen duvet',
    'Hearth & Hand',
    'Stonewashed queen',
    'Bedroom',
    220,
    180,
    -5,
  ],
  ['Tool chest', 'Rootwork', 'Rolling 7-drawer', 'Garage', 380, 1100, 900],
  ['Studio headphones', 'Clearwave', 'Monitor 70', 'Studio', 179, 400, 13],
  ['Camping stove', 'Peakline', 'Twin burner', 'Garage', 135, 520, 210],
  ['Mechanical keyboard', 'Pixelpad', 'Low profile 75', 'Studio', 159, 90, 640],
  ['Porcelain vase', 'Kiln & Co', 'Tall bud vase', 'Living room', 58, 45, -1],
]

const additionalInventoryItems: Item[] = extraInventory.map(
  ([title, make, model, location, amount, bought, warrantyLeft], index) => ({
    id: `inventory-extra-${index + 1}`,
    areaId: 'personal-inventory',
    collectionId: 'inventory',
    title,
    type: 'inventory',
    data: {
      make,
      model,
      serial: `${make.slice(0, 2).toUpperCase()}-${204900 + index * 37}`,
      purchaseDate: localDateAfter(-bought),
      amount,
      warrantyEnds: localDateAfter(warrantyLeft),
      location,
    },
    createdAt: stamp(bought),
    updatedAt: stamp(index + 1),
  }),
)

/** Days ago that still falls in the current month (the 1st, 3rd, 5th, ...). */
const thisMonth = (index: number) =>
  Math.max(0, new Date().getDate() - 1 - index * 2)

const financeItems: Item[] = [
  ...[
    ['Primary paycheck', 5200],
    ['Partner paycheck', 2600],
    ['Freelance work', 800],
    ['Interest', 180],
  ].map(([source, amount], index): Item => ({
    id: `income-${index + 1}`,
    areaId: 'home-budget',
    collectionId: 'income',
    title: String(source),
    type: 'income',
    occurredAt: stamp(thisMonth(index)),
    data: {
      source: String(source),
      amount: Number(amount),
      date: stamp(thisMonth(index)).slice(0, 10),
    },
    createdAt: stamp(thisMonth(index)),
    updatedAt: stamp(thisMonth(index)),
  })),
  ...[
    ['Quarterly estimate', 900],
    ['Federal withholding', 420],
    ['State withholding', 180],
  ].map(([source, amount], index): Item => ({
    id: `tax-${index + 1}`,
    areaId: 'home-budget',
    collectionId: 'taxes',
    title: String(source),
    type: 'tax',
    occurredAt: stamp(thisMonth(index)),
    data: {
      source: String(source),
      amount: Number(amount),
      date: stamp(thisMonth(index)).slice(0, 10),
    },
    createdAt: stamp(thisMonth(index)),
    updatedAt: stamp(thisMonth(index)),
  })),
]

// Each category: merchants, [title, description] pairs, and a typical amount range.
const purchaseCatalog: Array<{
  category: string
  weight: number
  merchants: string[]
  entries: Array<[string, string]>
  range: [number, number]
}> = [
  {
    category: 'Groceries',
    weight: 9,
    merchants: ['Market Basket', 'Green Grocer', 'Corner Market'],
    entries: [
      ['Weekly pantry restock', 'Produce, dairy, and pantry staples'],
      ['Big grocery run', 'Stocking up for the month'],
      ['Bread and fruit', 'A quick stop on the way home'],
    ],
    range: [14, 185],
  },
  {
    category: 'Dining',
    weight: 6,
    merchants: ['Corner Table', 'Noodle House', 'Harbor Cafe'],
    entries: [
      ['Lunch with a friend', 'Catching up over lunch'],
      ['Takeout dinner', 'Too tired to cook'],
      ['Coffee and pastry', 'Morning treat'],
    ],
    range: [6, 88],
  },
  {
    category: 'Transport',
    weight: 5,
    merchants: ['City Transit', 'Fuel Stop', 'Park & Go'],
    entries: [
      ['Transit pass reload', 'Monthly fare card top-up'],
      ['Fuel', 'Full tank'],
      ['Parking downtown', 'Two hours near the office'],
    ],
    range: [3, 75],
  },
  {
    category: 'Personal',
    weight: 3,
    merchants: ['Northline Books', 'Field Supply', 'Studio Goods'],
    entries: [
      ['A new field notebook', 'Dot grid, pocket size'],
      ['Paperback for the trip', 'Something to read on the train'],
      ['Haircut', 'Every six weeks'],
    ],
    range: [9, 65],
  },
  {
    category: 'Health',
    weight: 2,
    merchants: ['Willow Pharmacy', 'Northside Clinic'],
    entries: [
      ['Pharmacy essentials', 'Vitamins and first aid restock'],
      ['Prescription refill', '90-day supply'],
    ],
    range: [8, 95],
  },
  {
    category: 'Home',
    weight: 3,
    merchants: ['Studio Goods', 'Hardware Depot', 'Weekend Market'],
    entries: [
      ['Hardware for the studio', 'Hooks, anchors, and a level'],
      ['Weekend market flowers', 'Tulips for the table'],
      ['Cleaning supplies', 'Restocking under the sink'],
    ],
    range: [12, 240],
  },
  {
    category: 'Utilities',
    weight: 1,
    merchants: ['Bright Electric', 'City Water', 'Fiberline Internet'],
    entries: [
      ['Utility bill payment', 'Monthly bill'],
      ['Internet bill', 'Monthly plan'],
    ],
    range: [45, 210],
  },
]

/** Small seeded random number generator, so the demo data is the same on every load. */
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const purchaseRandom = seededRandom(20261018)
const totalWeight = purchaseCatalog.reduce(
  (sum, entry) => sum + entry.weight,
  0,
)
const pickCategory = (roll: number) => {
  let left = roll * totalWeight
  for (const entry of purchaseCatalog) {
    left -= entry.weight
    if (left < 0) return entry
  }
  return purchaseCatalog[0]
}
const pick = <T>(list: T[]) => list[Math.floor(purchaseRandom() * list.length)]

export const mockItems: Item[] = [
  ...inventoryItems,
  ...additionalInventoryItems,
  ...financeItems,
  ...Array.from({ length: 2000 }, (_, index): Item => {
    // About five purchases a day over the past year, newest first. The first
    // one is always a grocery run, which the collection tests rely on.
    const daysAgo = Math.floor((index * 365) / 2000)
    const date = stamp(daysAgo)
    const entry =
      index === 0 ? purchaseCatalog[0] : pickCategory(purchaseRandom())
    const merchant = index === 0 ? entry.merchants[0] : pick(entry.merchants)
    const [title, description] =
      index === 0 ? entry.entries[0] : pick(entry.entries)
    const [low, high] = entry.range
    const amount =
      Math.round((low + purchaseRandom() * (high - low)) * 100) / 100
    return {
      id: `purchase-${String(index + 1).padStart(4, '0')}`,
      areaId: 'home-budget',
      collectionId: 'purchases',
      title,
      type: 'purchase',
      occurredAt: date,
      data: {
        merchant,
        description,
        category: entry.category,
        amount,
        date: date.slice(0, 10),
        payment: pick(['Card', 'Card', 'Card', 'Checking', 'Cash']),
        ...(index % 113 === 0
          ? {
              reference: {
                itemId: 'inventory-camera',
                title: 'Rangefinder camera',
                areaId: 'personal-inventory',
              },
            }
          : {}),
      },
      createdAt: date,
      updatedAt: date,
    }
  }),
  ...[
    ['Brokerage', 'Investment account', 54280, 5.2],
    ['Roth IRA', 'Retirement', 36240, 8.4],
    ['401(k)', 'Retirement', 82710, 4.7],
    ['Emergency fund', 'Cash reserve', 18450, 1.1],
  ].map(([account, kind, value, change], index): Item => ({
    id: `investment-${index + 1}`,
    areaId: 'home-budget',
    collectionId: 'investments',
    title: String(account),
    type: 'investment',
    data: {
      account: String(account),
      kind: String(kind),
      value: Number(value),
      change: Number(change),
    },
    createdAt: stamp(200),
    updatedAt: stamp(4),
  })),
  ...Array.from({ length: 42 }, (_, index): Item => {
    const date = stamp(index * 2)
    return {
      id: `weight-${index + 1}`,
      areaId: 'health-fitness',
      collectionId: 'weight-log',
      title: `Weigh-in ${index + 1}`,
      type: 'weight',
      occurredAt: date,
      data: {
        weight: 152 - index * 0.08 + (index % 5) * 0.3,
        date: date.slice(0, 10),
      },
      createdAt: date,
      updatedAt: date,
    }
  }),
  ...Array.from({ length: 14 }, (_, index): Item => {
    const date = stamp(index * 4)
    return {
      id: `workout-${index + 1}`,
      areaId: 'health-fitness',
      collectionId: 'workouts',
      title: ['Strength session', 'Easy run', 'Long walk'][index % 3],
      type: 'workout',
      occurredAt: date,
      data: {
        workout: ['Strength session', 'Easy run', 'Long walk'][index % 3],
        duration: 25 + (index % 5) * 10,
        muscles: ['Full body'],
        date: date.slice(0, 10),
      },
      createdAt: date,
      updatedAt: date,
    }
  }),
  ...Array.from({ length: 14 }, (_, index): Item => {
    const date = stamp(index * 5)
    return {
      id: `recovery-${index + 1}`,
      areaId: 'health-fitness',
      collectionId: 'recovery',
      title: `Recovery reading ${index + 1}`,
      type: 'recovery',
      occurredAt: date,
      data: {
        sleep: 6.5 + (index % 4) * 0.4,
        recovery: 62 + ((index * 7) % 34),
        date: date.slice(0, 10),
      },
      createdAt: date,
      updatedAt: date,
    }
  }),
  ...Array.from({ length: 14 }, (_, index): Item => {
    const date = stamp(index * 12)
    return {
      id: `hike-${index + 1}`,
      areaId: 'outdoors',
      collectionId: 'hikes',
      title: ['Cedar Loop', 'Lake Overlook', 'Pine Ridge'][index % 3],
      type: 'hike',
      occurredAt: date,
      data: {
        trail: ['Cedar Loop', 'Lake Overlook', 'Pine Ridge'][index % 3],
        distance: 2.4 + (index % 6) * 0.7,
        date: date.slice(0, 10),
        photos: '',
      },
      createdAt: date,
      updatedAt: date,
    }
  }),
  ...[
    [
      'Acceptance',
      'Making room for what is here without giving up the ability to change it.',
      'Notice before reacting; allow feelings to pass through.',
    ],
    [
      'Tolerance',
      'Holding space for difference while staying rooted in care.',
      'Stay curious; keep boundaries clear.',
    ],
    [
      'Boundaries',
      'The honest shape of what I can give and what I need.',
      'Say the true thing early; let no be complete.',
    ],
  ].map(([title, definition, principles], index): Item => ({
    id: `concept-${index + 1}`,
    areaId: 'spirituality-code',
    collectionId: 'concepts',
    title,
    type: 'concept',
    data: { definition, principles },
    createdAt: stamp(20 + index),
    updatedAt: stamp(5),
  })),
]

export const mockBlocks: Block[] = [
  {
    id: 'budget-spent',
    areaId: 'home-budget',
    type: 'view',
    order: 0,
    size: 'medium',
    view: {
      id: 'spent',
      title: 'Spent this month',
      collectionId: 'purchases',
      display: 'stat',
      filter: [],
      period: 'thisMonth',
      aggregate: { operation: 'sum', fieldId: 'amount' },
      size: 'medium',
    },
  },
  {
    id: 'budget-income',
    areaId: 'home-budget',
    type: 'view',
    order: 1,
    size: 'small',
    view: {
      id: 'income',
      title: 'Income',
      collectionId: 'income',
      display: 'stat',
      filter: [],
      period: 'thisMonth',
      aggregate: { operation: 'sum', fieldId: 'amount' },
      size: 'small',
    },
  },
  {
    id: 'budget-taxes',
    areaId: 'home-budget',
    type: 'view',
    order: 2,
    size: 'small',
    view: {
      id: 'taxes',
      title: 'Set aside for taxes',
      collectionId: 'taxes',
      display: 'stat',
      filter: [],
      period: 'thisMonth',
      aggregate: { operation: 'sum', fieldId: 'amount' },
      size: 'small',
    },
  },
  {
    id: 'budget-spending',
    areaId: 'home-budget',
    type: 'view',
    order: 3,
    size: 'wide',
    view: {
      id: 'spending',
      title: 'Spending over time',
      collectionId: 'purchases',
      display: 'bar',
      filter: [],
      period: '12Months',
      groupBy: 'month',
      aggregate: { operation: 'sum', fieldId: 'amount' },
      chartType: 'bar',
      size: 'wide',
    },
  },
  {
    id: 'budget-purchases',
    areaId: 'home-budget',
    type: 'view',
    order: 4,
    size: 'wide',
    view: {
      id: 'purchases',
      title: 'Recent purchases',
      collectionId: 'purchases',
      display: 'table',
      filter: [],
      period: 'last30Days',
      limit: 15,
      columns: ['merchant', 'category', 'amount', 'date'],
      size: 'wide',
    },
  },
  {
    id: 'budget-investments',
    areaId: 'home-budget',
    type: 'view',
    order: 5,
    size: 'medium',
    view: {
      id: 'accounts',
      title: 'Investments by account',
      collectionId: 'investments',
      display: 'donut',
      filter: [],
      period: 'allTime',
      groupBy: 'account',
      aggregate: { operation: 'sum', fieldId: 'value' },
      chartType: 'donut',
      size: 'medium',
    },
  },
  {
    id: 'health-weight',
    areaId: 'health-fitness',
    type: 'view',
    order: 0,
    size: 'medium',
    view: {
      id: 'weight-trend',
      title: 'Weight trend',
      collectionId: 'weight-log',
      display: 'line',
      filter: [],
      period: '12Months',
      groupBy: 'month',
      aggregate: { operation: 'average', fieldId: 'weight' },
    },
  },
  {
    id: 'health-workouts',
    areaId: 'health-fitness',
    type: 'view',
    order: 1,
    size: 'medium',
    view: {
      id: 'workout-types',
      title: 'Movement',
      collectionId: 'workouts',
      display: 'bar',
      filter: [],
      period: '12Months',
      groupBy: 'workout',
      aggregate: { operation: 'count' },
    },
  },
  {
    id: 'health-recovery',
    areaId: 'health-fitness',
    type: 'view',
    order: 2,
    size: 'small',
    view: {
      id: 'recovery-score',
      title: 'Average recovery',
      collectionId: 'recovery',
      display: 'stat',
      filter: [],
      period: '12Months',
      aggregate: { operation: 'average', fieldId: 'recovery' },
    },
  },
  {
    id: 'outdoors-hikes',
    areaId: 'outdoors',
    type: 'view',
    order: 0,
    size: 'wide',
    view: {
      id: 'hike-log',
      title: 'Recent hikes',
      collectionId: 'hikes',
      display: 'timeline',
      filter: [],
      period: 'allTime',
      sort: { fieldId: 'date', direction: 'desc' },
      limit: 14,
    },
  },
  {
    id: 'inventory-value',
    areaId: 'personal-inventory',
    type: 'view',
    order: 0,
    size: 'small',
    view: {
      id: 'inventory-value-view',
      title: 'Total value',
      collectionId: 'inventory',
      display: 'stat',
      filter: [],
      period: 'allTime',
      aggregate: { operation: 'sum', fieldId: 'amount' },
    },
  },
  {
    id: 'inventory-count',
    areaId: 'personal-inventory',
    type: 'view',
    order: 1,
    size: 'small',
    view: {
      id: 'inventory-count-view',
      title: 'Items tracked',
      collectionId: 'inventory',
      display: 'stat',
      filter: [],
      period: 'allTime',
      aggregate: { operation: 'count' },
    },
  },
  {
    id: 'inventory-warranties',
    areaId: 'personal-inventory',
    type: 'view',
    order: 2,
    size: 'wide',
    view: {
      id: 'inventory-warranty-view',
      title: 'Warranties ending soon',
      collectionId: 'inventory',
      display: 'table',
      filter: [
        {
          fieldId: 'warrantyEnds',
          operator: 'greaterThan',
          value: localDateAfter(0),
        },
        {
          fieldId: 'warrantyEnds',
          operator: 'lessThan',
          value: localDateAfter(90),
        },
      ],
      sort: { fieldId: 'warrantyEnds', direction: 'asc' },
      limit: 8,
      columns: ['make', 'model', 'warrantyEnds'],
    },
  },
  {
    id: 'inventory-location',
    areaId: 'personal-inventory',
    type: 'view',
    order: 3,
    size: 'medium',
    view: {
      id: 'inventory-location-view',
      title: 'Items by location',
      collectionId: 'inventory',
      display: 'bar',
      filter: [],
      period: 'allTime',
      groupBy: 'location',
      aggregate: { operation: 'count' },
    },
  },
  {
    id: 'inventory-recent',
    areaId: 'personal-inventory',
    type: 'view',
    order: 4,
    size: 'medium',
    view: {
      id: 'inventory-recent-view',
      title: 'Recently added',
      collectionId: 'inventory',
      display: 'list',
      filter: [],
      period: 'allTime',
      sort: { fieldId: 'createdAt', direction: 'desc' },
      limit: 5,
      columns: ['make', 'model', 'location'],
    },
  },
  {
    id: 'creed',
    areaId: 'spirituality-code',
    type: 'text',
    title: 'A personal creed',
    order: 0,
    body: 'Be curious before being certain. Make room for tenderness. Keep promises to myself and the people I love.',
  },
  {
    id: 'concepts-list',
    areaId: 'spirituality-code',
    type: 'collection',
    title: 'Guiding concepts',
    order: 1,
    collectionId: 'concepts',
  },
]

export const mockItemLinks: ItemLink[] = []
export const mockDataSources: DataSource[] = [
  {
    id: 'source-recovery',
    collectionId: 'recovery',
    name: 'Recovery readings',
    provider: 'Example fitness tracker',
    kind: 'service',
    status: 'connected',
    lastSyncedAt: stamp(0),
    nextSyncAt: stamp(-1),
  },
]

export const cloneMockData = <T>(value: T): T => structuredClone(value)
