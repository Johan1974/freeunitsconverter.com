from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Free Units Converter API")

# Allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to FreeUnitsConverter API"}

# Length conversion
@app.get("/api/convert/length")
def convert_length(value: float, from_unit: str, to_unit: str):
    if from_unit == "meters" and to_unit == "feet":
        return {"result": value * 3.28084}
    elif from_unit == "feet" and to_unit == "meters":
        return {"result": value / 3.28084}
    return {"error": "Conversion not supported"}

# Weight conversion
@app.get("/api/convert/weight")
def convert_weight(value: float, from_unit: str, to_unit: str):
    if from_unit == "kg" and to_unit == "lbs":
        return {"result": value * 2.20462}
    elif from_unit == "lbs" and to_unit == "kg":
        return {"result": value / 2.20462}
    return {"error": "Conversion not supported"}

# Temperature conversion
@app.get("/api/convert/temperature")
def convert_temperature(value: float, from_unit: str, to_unit: str):
    if from_unit == "C" and to_unit == "F":
        return {"result": (value * 9/5) + 32}
    elif from_unit == "F" and to_unit == "C":
        return {"result": (value - 32) * 5/9}
    return {"error": "Conversion not supported"}

# Time conversion
@app.get("/api/convert/time")
def convert_time(value: float, from_unit: str, to_unit: str):
    if from_unit == "hours" and to_unit == "minutes":
        return {"result": value * 60}
    elif from_unit == "minutes" and to_unit == "hours":
        return {"result": value / 60}
    return {"error": "Conversion not supported"}

# Volume conversion
@app.get("/api/convert/volume")
def convert_volume(value: float, from_unit: str, to_unit: str):
    if from_unit == "liters" and to_unit == "gallons":
        return {"result": value * 0.264172}
    elif from_unit == "gallons" and to_unit == "liters":
        return {"result": value / 0.264172}
    return {"error": "Conversion not supported"}
