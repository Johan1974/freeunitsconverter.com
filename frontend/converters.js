const CONVERTERS = [
    { id: 'length', label: 'Length', baseUnit: 'meter', units: { /* ... */ } },
    { id: 'weight', label: 'Weight', baseUnit: 'kilogram', units: { /* ... */ } },
    { id: 'temperature', label: 'Temperature', baseUnit: 'celsius', type: 'temperature', units: { /* ... */ } },
    { id: 'volume', label: 'Volume', baseUnit: 'liter', units: { /* ... */ } }
  ];
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONVERTERS };
  }
  