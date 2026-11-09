// src/lib/categories.js

// Shop names mapped to categories, in spec order. A description belongs to a shop
// when it contains the shop name, ignoring case.
export const rules = [
  { shop: 'Greenbarrow Fresh', category: 'groceries' },
  { shop: 'Pennywhistle Market', category: 'groceries' },
  { shop: 'Lowtide Grocers', category: 'groceries' },
  { shop: 'Harvest Lane Foods', category: 'groceries' },
  { shop: 'Pasta, Pizza & Co', category: 'eating_out' },
  { shop: 'Kestrel Coffee Bar', category: 'eating_out' },
  { shop: 'Saltbush Noodle House', category: 'eating_out' },
  { shop: 'Ember Grill', category: 'eating_out' },
  { shop: 'Waverly Fuel Stop', category: 'transport' },
  { shop: 'Tramline Fares', category: 'transport' },
  { shop: 'Lantern Rideshare', category: 'transport' },
  { shop: 'Northgate Parking', category: 'transport' },
  { shop: 'Brightfield Power', category: 'bills' },
  { shop: 'Clearwater Utilities', category: 'bills' },
  { shop: 'Skyline Broadband', category: 'bills' },
  { shop: 'Hollis Insurance', category: 'bills' },
  { shop: 'Marlowe Homewares', category: 'shopping' },
  { shop: 'Quillon Books', category: 'shopping' },
  { shop: 'Fernhill Outfitters', category: 'shopping' },
  { shop: 'Pixel Parade Tech', category: 'shopping' },
  { shop: 'Larkspur Pharmacy', category: 'health' },
  { shop: 'Elmgrove Physio', category: 'health' },
  { shop: 'Cobalt Dental', category: 'health' },
  { shop: 'Sunnyvale Optical', category: 'health' },
  { shop: 'Brightwave Payroll', category: 'income' },
  { shop: 'Tidepool Interest', category: 'income' },
  { shop: 'Oakridge Dividends', category: 'income' },
];

// Display label for each category key. 'other' is the fallback for unmatched descriptions.
export const labels = {
  groceries: 'Groceries',
  eating_out: 'Eating out',
  transport: 'Transport',
  bills: 'Bills',
  shopping: 'Shopping',
  health: 'Health',
  income: 'Income',
  other: 'Other',
};
