// Hardcoded mock data used by all screens while the app is not yet wired to the API.

export const CURRENT_USER_ID = 'user-1';

export const MOCK_MEMBERS = [
  { id: 'user-1', name: 'Alice' },
  { id: 'user-2', name: 'Bob' },
  { id: 'user-3', name: 'Carol' },
  { id: 'user-4', name: 'Dan' },
];

export const MOCK_GROUP = {
  id: 'group-1',
  name: 'Barcelona Trip',
  emoji: '🇪🇸',
  members: MOCK_MEMBERS,
};

export const MOCK_EXPENSES = [
  {
    id: 'exp-1',
    description: 'Dinner at La Boqueria',
    amount: 8450,
    currencyCode: 'GBP',
    paidById: 'user-1',
    participantIds: ['user-1', 'user-2', 'user-3', 'user-4'],
    date: new Date().toISOString(),
    category: '🍽️',
  },
  {
    id: 'exp-2',
    description: 'Hotel deposit',
    amount: 30000,
    currencyCode: 'GBP',
    paidById: 'user-1',
    participantIds: ['user-1', 'user-2', 'user-3', 'user-4'],
    date: new Date().toISOString(),
    category: '🏨',
  },
  {
    id: 'exp-3',
    description: 'Taxi from airport',
    amount: 3200,
    currencyCode: 'GBP',
    paidById: 'user-2',
    participantIds: ['user-1', 'user-2', 'user-3'],
    date: new Date(Date.now() - 86400000).toISOString(), // yesterday
    category: '🚕',
  },
  {
    id: 'exp-4',
    description: 'Museum tickets',
    amount: 5600,
    currencyCode: 'GBP',
    paidById: 'user-3',
    participantIds: ['user-2', 'user-3', 'user-4'],
    date: new Date(Date.now() - 86400000).toISOString(),
    category: '🎨',
  },
];

export const MOCK_BALANCES = [
  { userId: 'user-1', net: 4230 },  // positive = owed money
  { userId: 'user-2', net: -1560 },
  { userId: 'user-3', net: -2070 },
  { userId: 'user-4', net: -600 },
];

export const MOCK_SETTLEMENTS = [
  { fromUserId: 'user-2', toUserId: 'user-1', amount: 1560 },
  { fromUserId: 'user-3', toUserId: 'user-1', amount: 2070 },
  { fromUserId: 'user-4', toUserId: 'user-1', amount: 600 },
];
