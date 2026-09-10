# -*- coding: utf-8 -*-
"""Derive skin release dates by walking Data Dragon's patch history.

Riot publishes no release date for skins anywhere, so we reconstruct it: sample
championFull.json every few patches, note the first sample in which each skin
id appears, and place its release between that sample and the one before it.

Resolution is the sampling interval (~10 weeks). Data Dragon only serves
championFull.json back to season 5, so anything already present in the oldest
sample is recorded as "2015 or earlier" rather than guessed at.

Writes cache/dates.json. Slow (~60 files, a few hundred MB) but only needs
re-running when you want to pick up newly released skins.
"""
import concurrent.futures
import datetime
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
DD = "https://ddragon.leagueoflegends.com"

# Patches to sample within each season. Roughly every 10 weeks, with one near
# the end of the year so December skins land in the right year.
SAMPLE_PATCHES = [1, 6, 11, 16, 21]
FIRST_SEASON = 5                      # older patches 403 on championFull.json


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "riotofaction-builder/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode("utf-8"))


def season_year(season):
    return 2010 + season


def patch_date(season, patch):
    """LoL patches run roughly biweekly from early January."""
    base = datetime.date(season_year(season), 1, 8)
    return base + datetime.timedelta(days=14 * (patch - 1))


def pick_samples(versions):
    """Earliest real version string for each (season, patch) we want to sample."""
    by_sp = {}
    for v in versions:
        m = re.match(r"^(\d+)\.(\d+)\.", v)
        if not m:
            continue
        s, p = int(m.group(1)), int(m.group(2))
        if s < FIRST_SEASON:
            continue
        by_sp.setdefault((s, p), []).append(v)

    picked = []
    seasons = sorted({s for s, _ in by_sp})
    for s in seasons:
        for p in SAMPLE_PATCHES:
            if (s, p) in by_sp:
                picked.append((s, p, sorted(by_sp[(s, p)])[0]))
    latest = versions[0]
    m = re.match(r"^(\d+)\.(\d+)\.", latest)
    if m:
        tail = (int(m.group(1)), int(m.group(2)), latest)
        if tail[:2] not in [(a, b) for a, b, _ in picked]:
            picked.append(tail)
    picked.sort(key=lambda t: (t[0], t[1]))
    return picked


def skins_in(version):
    data = get("%s/cdn/%s/data/en_US/championFull.json" % (DD, version))["data"]
    ids = set()
    for c in data.values():
        try:
            key = int(c["key"])
        except (KeyError, ValueError):
            continue
        for s in c.get("skins", []):
            ids.add(key * 1000 + int(s["num"]))
    return ids


def main():
    versions = get(DD + "/api/versions.json")
    samples = pick_samples(versions)
    print("sampling %d patches from %s to %s" % (
        len(samples), samples[0][2], samples[-1][2]))

    results = {}

    def one(item):
        s, p, v = item
        try:
            return v, skins_in(v)
        except Exception as e:                                  # noqa: BLE001
            print("  !! %s failed: %r" % (v, e))
            return v, None

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        for i, (v, ids) in enumerate(ex.map(one, samples), 1):
            results[v] = ids
            print("  [%2d/%d] %-10s %s" % (
                i, len(samples), v, len(ids) if ids is not None else "SKIPPED"))

    usable = [(s, p, v) for (s, p, v) in samples if results.get(v)]
    if not usable:
        raise SystemExit("no patch samples downloaded")

    # First sample index in which each skin id appears.
    first = {}
    for idx, (s, p, v) in enumerate(usable):
        for sid in results[v]:
            if sid not in first:
                first[sid] = idx

    meta = []
    for s, p, v in usable:
        d = patch_date(s, p)
        meta.append({"version": v, "season": s, "patch": p, "date": d.isoformat()})

    out = {
        "generated": datetime.date.today().isoformat(),
        "samples": meta,
        "first": {str(k): v for k, v in sorted(first.items())}
    }
    path = os.path.join(ROOT, "cache", "dates.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f)

    floor = sum(1 for v in first.values() if v == 0)
    print("\n%d skins dated (%d at or before the %s floor)" % (
        len(first), floor, meta[0]["date"][:4]))
    print("wrote cache/dates.json")


if __name__ == "__main__":
    main()
