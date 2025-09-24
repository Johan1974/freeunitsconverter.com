const CONVERTERS = [
  {
    id: "length",
    label: "Length",
    units: {
      millimeter: "Millimeter",
      centimeter: "Centimeter",
      meter: "Meter",
      kilometer: "Kilometer",
      inch: "Inch",
      foot: "Foot",
      yard: "Yard",
      mile: "Mile"
    }
  },
  {
    id: "weight",
    label: "Weight",
    units: {
      gram: "Gram",
      kilogram: "Kilogram",
      pound: "Pound",
      ounce: "Ounce"
    }
  },
  {
    id: "temperature",
    label: "Temperature",
    units: {
      celsius: "Celsius",
      fahrenheit: "Fahrenheit",
      kelvin: "Kelvin"
    }
  },
  {
    id: "volume",
    label: "Volume",
    units: {
      milliliter: "Milliliter",
      liter: "Liter",
      cubic_meter: "Cubic Meter",
      gallon_us: "Gallon (US)",
      cup_us: "Cup (US)"
    }
  }
];

// Export for Node (static pages)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CONVERTERS };
}

// Export for browser
if (typeof window !== "undefined") {
  window.CONVERTERS = CONVERTERS;
}
