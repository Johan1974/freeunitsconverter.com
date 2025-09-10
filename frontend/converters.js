const CONVERTERS = [
  {
    id: "length",
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
    units: {
      gram: "Gram",
      kilogram: "Kilogram",
      pound: "Pound",
      ounce: "Ounce"
    }
  },
  {
    id: "temperature",
    units: {
      celsius: "Celsius",
      fahrenheit: "Fahrenheit",
      kelvin: "Kelvin"
    }
  },
  {
    id: "volume",
    units: {
      milliliter: "Milliliter",
      liter: "Liter",
      cubic_meter: "Cubic Meter",
      gallon_us: "Gallon (US)",
      cup_us: "Cup (US)"
    }
  }
];

// Export for Node (sitemap + static page generation)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CONVERTERS };
}

// Export for browser
if (typeof window !== "undefined") {
  window.CONVERTERS = CONVERTERS;
}
