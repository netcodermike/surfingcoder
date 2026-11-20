"""Publish the recent columns of NOAA's detailed wave summaries as JSON."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
import re
import sys
from urllib.error import HTTPError
from urllib.request import urlopen

FIELDS = dict(WVHT="wave", SwH="swell", SwP="swellPeriod", WWH="windWave",
              WWP="windWavePeriod", APD="averagePeriod", MWD="direction")
DIRECTIONS = set("N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW".split())


def read_summary(station, cutoff):
    try:
        with urlopen(f"https://www.ndbc.noaa.gov/data/realtime2/{station}.spec", timeout=12) as response:
            header = response.readline().decode("ascii").split()
            if not set(FIELDS) <= set(header):
                raise ValueError("Unexpected wave summary columns")
            result = []
            for raw in response:
                cells = raw.decode("ascii").split()
                if len(cells) != len(header) or not cells[0].isdigit():
                    continue
                stamp = datetime(*map(int, cells[:5]), tzinfo=timezone.utc)
                if stamp < cutoff:
                    continue
                record = dict(zip(header, cells))
                reading = {"time": int(stamp.timestamp() * 1000)}
                for field, name in FIELDS.items():
                    try:
                        value = float(record[field])
                    except ValueError:
                        continue
                    valid = 0 <= value <= 360 if field == "MWD" else 0 <= value < 99
                    if math.isfinite(value) and valid and (value > 0 or not name.endswith("eriod")):
                        reading[name] = value
                for field, name in (("SwD", "swellDirection"), ("WWD", "windWaveDirection")):
                    value = record.get(field)
                    if value in DIRECTIONS:
                        reading[name] = value
                    elif value and value.isdigit() and int(value) <= 360:
                        reading[name] = int(value)
                steepness = record.get("STEEPNESS")
                if steepness in {"VERY_STEEP", "STEEP", "AVERAGE", "SWELL"}:
                    reading["steepness"] = steepness.replace("_", " ").lower()
                if len(reading) > 1:
                    result.append(reading)
            return station, result
    except HTTPError as error:
        if error.code == 404:
            return station, []
        print(f"{station}: {error}", file=sys.stderr)
    except (OSError, ValueError) as error:
        print(f"{station}: {error}", file=sys.stderr)
    return station, None


def main(output):
    catalog = Path(__file__).resolve().parents[1] / "surfreport/src/ndbc-stations.json"
    stations = [row["id"] for row in json.loads(catalog.read_text(encoding="utf-8"))["stations"]
                if re.fullmatch(r"[0-9A-Z]{5}", row["id"])]
    cutoff = datetime.now(timezone.utc) - timedelta(hours=36)
    output.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda station: read_summary(station, cutoff), stations))
    if not any(readings for _, readings in results):
        raise SystemExit("NOAA returned no recent detailed wave summaries")
    count = 0
    for station, readings in results:
        path = output / f"{station}.json"
        if readings is None:
            existing = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
            readings = [row for row in existing if row["time"] >= cutoff.timestamp() * 1000]
        if readings:
            path.write_text(json.dumps(readings, separators=(",", ":")) + "\n", encoding="utf-8")
            count += 1
        else:
            path.unlink(missing_ok=True)
    print(f"Updated detailed NOAA wave observations for {count} stations")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
