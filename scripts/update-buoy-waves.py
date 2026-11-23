"""Mirror recent standard and detailed NOAA wave observations as JSON."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
import re
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

STANDARD = dict(WVHT="wave", DPD="period", APD="averagePeriod", MWD="direction", WTMP="temperature")
SUMMARY = dict(WVHT="wave", SwH="swell", SwP="swellPeriod", WWH="windWave",
               WWP="windWavePeriod", APD="averagePeriod", MWD="direction")
SUMMARY_DIRECTIONS = dict(SwD="swellDirection", WWD="windWaveDirection")
COMPASS = set("N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW".split())
DETAIL_KEYS = set(SUMMARY.values()) | set(SUMMARY_DIRECTIONS.values()) | {"steepness"}
WAVE_KEYS = {"wave", "swell", "windWave"}


def valid_number(field, text):
    try:
        value = float(text)
    except ValueError:
        return None
    if not math.isfinite(value):
        return None
    if field == "WTMP":
        return value if -5 <= value <= 50 else None
    if field == "MWD":
        return value if 0 <= value <= 360 else None
    if field in {"DPD", "APD", "SwP", "WWP"}:
        return value if 0 < value < 99 else None
    return value if 0 <= value < 99 else None


def parse_feed(lines, fields, cutoff, detailed=False):
    header = next(lines, b"").decode("ascii").split()
    if header[:5] != ["#YY", "MM", "DD", "hh", "mm"] or not set(fields) <= set(header):
        raise ValueError("Unexpected NOAA observation columns")
    readings = []
    for line in lines:
        cells = line.decode("ascii").split()
        if len(cells) != len(header) or not cells[0].isdigit():
            continue
        stamp = datetime(*map(int, cells[:5]), tzinfo=timezone.utc)
        if stamp < cutoff:
            break  # NOAA realtime files are newest first.
        record = dict(zip(header, cells))
        reading = {"time": int(stamp.timestamp() * 1000)}
        for field, name in fields.items():
            value = valid_number(field, record[field])
            if value is not None:
                reading[name] = value
        if detailed:
            for field, name in SUMMARY_DIRECTIONS.items():
                value = record.get(field, "")
                if value in COMPASS:
                    reading[name] = value
                elif value.isdigit() and int(value) <= 360:
                    reading[name] = int(value)
            steepness = record.get("STEEPNESS")
            if steepness in {"VERY_STEEP", "STEEP", "AVERAGE", "SWELL"}:
                reading["steepness"] = steepness.replace("_", " ").lower()
        if len(reading) > 1:
            readings.append(reading)
    return readings


def read_feed(station, extension, cutoff, fields):
    url = f"https://www.ndbc.noaa.gov/data/realtime2/{station}.{extension}"
    try:
        request = Request(url, headers={"User-Agent": "SurfingCoder NOAA observation mirror"})
        with urlopen(request, timeout=12) as response:
            return parse_feed(iter(response), fields, cutoff, detailed=extension == "spec")
    except HTTPError as error:
        if error.code == 404:
            return []
        print(f"{station}.{extension}: {error}", file=sys.stderr)
    except (OSError, ValueError) as error:
        print(f"{station}.{extension}: {error}", file=sys.stderr)
    return None


def read_station(station, cutoff):
    detailed = read_feed(station, "spec", cutoff, SUMMARY)
    standard = read_feed(station, "txt", cutoff, STANDARD)
    return station, standard, detailed


def combine_readings(standard, detailed, existing, cutoff):
    rows = {}
    for reading in existing:
        if reading["time"] < cutoff:
            continue
        if standard is None and detailed is None:
            rows[reading["time"]] = reading
        elif standard is None:
            rows[reading["time"]] = {k: v for k, v in reading.items() if k in {"time", *STANDARD.values()}}
        elif detailed is None:
            rows[reading["time"]] = {k: v for k, v in reading.items() if k in {"time", *DETAIL_KEYS}}
    for feed in (standard, detailed):
        for reading in feed or []:
            rows.setdefault(reading["time"], {}).update(reading)
    return [row for _, row in sorted(rows.items(), reverse=True) if WAVE_KEYS & row.keys()]


def main(output):
    catalog = Path(__file__).resolve().parents[1] / "surfreport/src/ndbc-stations.json"
    stations = [row["id"] for row in json.loads(catalog.read_text(encoding="utf-8"))["stations"]
                if re.fullmatch(r"[0-9A-Z]{5}", row["id"])]
    # Keep a buffer beyond the seven-day display in case a scheduled refresh runs late.
    cutoff = datetime.now(timezone.utc) - timedelta(days=7, hours=12)
    cutoff_ms = int(cutoff.timestamp() * 1000)
    output.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(lambda station: read_station(station, cutoff), stations))
    if not any(standard or detailed for _, standard, detailed in results):
        raise SystemExit("NOAA returned no recent wave observations")
    count = 0
    for station, standard, detailed in results:
        path = output / f"{station}.json"
        existing = json.loads(path.read_text(encoding="utf-8")) if path.exists() and (standard is None or detailed is None) else []
        readings = combine_readings(standard, detailed, existing, cutoff_ms)
        if readings:
            path.write_text(json.dumps(readings, separators=(",", ":")) + "\n", encoding="utf-8")
            count += 1
        else:
            path.unlink(missing_ok=True)
    print(f"Updated NOAA wave observations for {count} stations")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
