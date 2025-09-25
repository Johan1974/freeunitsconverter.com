// frontend/categories.js
const CATEGORIES = [
    {
      id: "length",
      label: "Length",
      units: ["millimeter","centimeter","meter","kilometer","inch","foot","yard","mile"]
    },
    {
      id: "weight",
      label: "Weight",
      units: ["gram","kilogram","pound","ounce"]
    },
    {
      id: "temperature",
      label: "Temperature",
      units: ["celsius","fahrenheit","kelvin"]
    },
    {
      id: "volume",
      label: "Volume",
      units: ["milliliter","liter","cubic_meter","gallon_us","cup_us"]
    }
  ];
  
  // Node export
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { CATEGORIES };
  }
  
  // Browser export
  if (typeof window !== "undefined") {
    window.CATEGORIES = CATEGORIES;
  }
  