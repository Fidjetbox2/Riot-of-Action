# -*- coding: utf-8 -*-
"""Stage 2: merge cache/raw.json + tools/metadata.py into data/skins.js.

Output is a plain JS assignment (not JSON) so the site also works when opened
straight off disk with file:// -- no local web server required.

Run tools/fetch_raw.py first, then this.
"""
import datetime
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
import metadata  # noqa: E402

SPECIES_LABELS = {
    "human": "Human",
    "yordle": "Yordle",
    "vastaya": "Vastaya",
    "undead": "Undead",
    "spirit": "Spirit",
    "beast": "Beast",
    "construct": "Construct",
    "celestial": "Celestial",
    "void": "Void",
    "darkin": "Darkin",
    "dragon": "Dragon",
    "demon": "Demon",
    "elemental": "Elemental",
    "ascended": "Ascended",
    "god": "Demigod",
    "plant": "Plant",
    "other": "Other",
}

REGION_LABELS = {
    "demacia": "Demacia",
    "noxus": "Noxus",
    "ionia": "Ionia",
    "freljord": "Freljord",
    "shadow-isles": "Shadow Isles",
    "piltover": "Piltover",
    "zaun": "Zaun",
    "bilgewater": "Bilgewater",
    "targon": "Mount Targon",
    "shurima": "Shurima",
    "ixtal": "Ixtal",
    "bandle-city": "Bandle City",
    "void": "The Void",
    "camavor": "Camavor",
    "runeterra": "Runeterra (unaffiliated)",
}

# Order here is the order the sidebar shows them in.
GENDER_LABELS = {
    "male": "Male",
    "female": "Female",
    "other": "Other",
}

ROLE_LABELS = {
    "assassin": "Assassin",
    "fighter": "Fighter",
    "mage": "Mage",
    "marksman": "Marksman",
    "support": "Support",
    "tank": "Tank",
}

RARITY_LABELS = {
    "base": "Base skin",
    "standard": "Standard",
    "rare": "Rare",
    "epic": "Epic",
    "legendary": "Legendary",
    "mythic": "Mythic",
    "ultimate": "Ultimate",
    "transcendent": "Transcendent",
    "exalted": "Exalted",
}

RARITY_MAP = {
    "kNoRarity": "standard",
    "kRare": "rare",
    "kEpic": "epic",
    "kLegendary": "legendary",
    "kMythic": "mythic",
    "kUltimate": "ultimate",
    "kTranscendent": "transcendent",
    "kExalted": "exalted",
}


def asset_path(p):
    """/lol-game-data/assets/ASSETS/... -> assets/... (CommunityDragon serves lowercase)."""
    if not p:
        return ""
    return p.replace("/lol-game-data/assets/", "").lower()


def load_dates():
    """skin id -> year*100+month estimate, or 0 for "at/before the floor".

    cache/dates.json records the first patch sample each skin appeared in; the
    release itself sits between that sample and the previous one, so we take
    the midpoint. Absent file just means no date filtering.
    """
    path = os.path.join(ROOT, "cache", "dates.json")
    if not os.path.exists(path):
        print("note: cache/dates.json missing -- run tools/fetch_dates.py for "
              "release-date filters")
        return {}, None

    with open(path, encoding="utf-8") as f:
        blob = json.load(f)

    samples = blob["samples"]
    dates = [datetime.date.fromisoformat(s["date"]) for s in samples]

    out = {}
    for sid, idx in blob["first"].items():
        idx = int(idx)
        if idx == 0:
            out[int(sid)] = 0                       # 2015 floor, or older
            continue
        prev, cur = dates[idx - 1], dates[idx]
        mid = prev + (cur - prev) / 2
        out[int(sid)] = mid.year * 100 + mid.month
    return out, dates[0]


def main():
    with open(os.path.join(ROOT, "cache", "raw.json"), encoding="utf-8") as f:
        raw = json.load(f)

    skin_dates, floor_date = load_dates()

    version = raw["version"]
    dd_champs = raw["champions"]
    cd_skins = raw["cd_skins"]
    cd_lines = raw["cd_skinlines"]

    missing = sorted(set(dd_champs) - set(metadata.CHAMPIONS))
    if missing:
        raise SystemExit(
            "No curated gender/species/region for: %s\n"
            "Riot does not publish these, so add a line for each in "
            "tools/metadata.py and re-run." % ", ".join(missing))

    stale = sorted(set(metadata.CHAMPIONS) - set(dd_champs))
    if stale:
        print("note: metadata.py has entries Data Dragon no longer lists: %s"
              % ", ".join(stale))

    for alias, (g, sp, re_) in metadata.CHAMPIONS.items():
        if g not in GENDER_LABELS:
            raise SystemExit("%s: unknown gender %r" % (alias, g))
        if sp not in SPECIES_LABELS:
            raise SystemExit("%s: unknown species %r" % (alias, sp))
        if re_ not in REGION_LABELS:
            raise SystemExit("%s: unknown region %r" % (alias, re_))

    lines = {}
    for line in cd_lines:
        name = (line.get("name") or "").strip()
        if name and name.lower() != "none":
            lines[line["id"]] = name

    used_lines = set()
    champions = []
    skipped = 0
    dated = [0, 0, 0]        # floor, precise, undated
    overrides = {"splash": 0, "load": 0}

    for alias, c in sorted(dd_champs.items(), key=lambda kv: kv[1]["name"]):
        key = int(c["key"])
        gender, species, region = metadata.CHAMPIONS[alias]

        rows = []
        for sid, s in cd_skins.items():
            sid = int(sid)
            if sid // 1000 != key:
                continue
            # Deliberately not filtering on skinClassification: Pyke's base
            # skin is tagged kGeneric rather than kChampion, and screening on
            # that field silently dropped it. Belonging to a real champion key
            # is the check that actually means something -- it already excludes
            # the stray non-champion ids in the 60000000 range.
            num = sid % 1000
            splash = asset_path(s.get("splashPath"))
            load = asset_path(s.get("loadScreenPath"))
            if not splash:
                skipped += 1
                continue

            m = re.match(r"assets/characters/([^/]+)/skins/", splash)
            cdir = m.group(1) if m else ""
            folder = "base" if num == 0 else "skin%02d" % num
            exp_splash = "assets/characters/%s/skins/%s/images/%s_splash_centered_%d.jpg" % (
                cdir, folder, cdir, num)
            exp_load = "assets/characters/%s/skins/%s/%sloadscreen_%d.jpg" % (
                cdir, folder, cdir, num)

            row = {
                "n": num,
                "t": s.get("name") or c["name"],
                "r": "base" if s.get("isBase") else RARITY_MAP.get(s.get("rarity"), "standard"),
            }
            if s.get("isLegacy"):
                row["lg"] = 1
            if sid in skin_dates:
                row["dt"] = skin_dates[sid]         # 0 == floor bucket
                dated[0 if skin_dates[sid] == 0 else 1] += 1
            else:
                dated[2] += 1
            ids = [x["id"] for x in (s.get("skinLines") or []) if x.get("id") in lines]
            if ids:
                row["l"] = ids
                used_lines.update(ids)
            # Only store paths that deviate from the predictable pattern.
            if cdir and cdir != alias.lower():
                row["d"] = cdir
            if splash != exp_splash:
                row["cp"] = splash
                overrides["splash"] += 1
            if load and load != exp_load:
                row["lp"] = load
                overrides["load"] += 1
            elif not load:
                row["lp"] = ""
            rows.append(row)

        rows.sort(key=lambda r: r["n"])
        champions.append({
            "k": key,
            "a": alias,
            "n": c["name"],
            "ti": c["title"],
            "g": gender,
            "sp": species,
            "re": region,
            "c": [t.lower() for t in c["tags"]],
            "s": rows,
        })

    data = {
        "version": version,
        "generated": datetime.date.today().isoformat(),
        "labels": {
            "gender": GENDER_LABELS,
            "species": SPECIES_LABELS,
            "region": REGION_LABELS,
            "role": ROLE_LABELS,
            "rarity": RARITY_LABELS,
        },
        "lines": {str(k): v for k, v in sorted(lines.items()) if k in used_lines},
        "dateFloor": floor_date.year if floor_date else None,
        "champions": champions,
    }

    out = os.path.join(ROOT, "data", "skins.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("/* Generated by tools/build_data.py -- do not edit by hand. */\n")
        f.write("window.RIOT_OF_ACTION_DATA = ")
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
        f.write(";\n")

    total = sum(len(c["s"]) for c in champions)
    size = os.path.getsize(out)
    print("champions: %d   skins: %d   skin lines: %d" % (len(champions), total, len(data["lines"])))
    print("path overrides: %d splash, %d loadscreen   (skipped %d)" % (
        overrides["splash"], overrides["load"], skipped))
    print("dates: %d precise, %d at/before %s floor, %d undated" % (
        dated[1], dated[0], floor_date.year if floor_date else "?", dated[2]))
    print("wrote data/skins.js  (%.0f KB)" % (size / 1024.0))


if __name__ == "__main__":
    main()
