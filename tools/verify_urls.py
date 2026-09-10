# -*- coding: utf-8 -*-
"""Spot-check that the URL rules used by js/data.js resolve on the live CDNs.

    python tools/verify_urls.py [sample_size]     # default 25, "all" for everything
"""
import concurrent.futures
import json
import os
import random
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
CD = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/"
DD = "https://ddragon.leagueoflegends.com/cdn/img/champion/"


def load():
    with open(os.path.join(ROOT, "data", "skins.js"), encoding="utf-8") as f:
        txt = f.read()
    return json.loads(txt[txt.index("{"):txt.rindex("}") + 1])


def urls_for(champ, skin):
    d = skin.get("d") or champ["a"].lower()
    folder = "base" if skin["n"] == 0 else "skin%02d" % skin["n"]
    centered = skin.get("cp") or "assets/characters/%s/skins/%s/images/%s_splash_centered_%d.jpg" % (
        d, folder, d, skin["n"])
    load_p = skin["lp"] if "lp" in skin else "assets/characters/%s/skins/%s/%sloadscreen_%d.jpg" % (
        d, folder, d, skin["n"])
    out = {
        "cd_centered": CD + centered,
        "cd_uncentered": CD + centered.replace("_splash_centered_", "_splash_uncentered_"),
        "cd_tile": CD + centered.replace("_splash_centered_", "_splash_tile_"),
        "dd_splash": "%ssplash/%s_%d.jpg" % (DD, champ["a"], skin["n"]),
        "dd_loading": "%sloading/%s_%d.jpg" % (DD, champ["a"], skin["n"]),
    }
    if load_p:
        out["cd_load"] = CD + load_p
    return out


def check(item):
    label, url = item
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "riotofaction-verify/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return label, url, r.status
    except urllib.error.HTTPError as e:
        return label, url, e.code
    except Exception as e:  # noqa: BLE001
        return label, url, repr(e)[:60]


def main():
    data = load()
    pairs = [(c, s) for c in data["champions"] for s in c["s"]]
    arg = sys.argv[1] if len(sys.argv) > 1 else "25"
    if arg != "all":
        random.seed()
        pairs = random.sample(pairs, min(int(arg), len(pairs)))
    jobs = []
    for c, s in pairs:
        for label, url in urls_for(c, s).items():
            jobs.append(("%s / %s [%s]" % (c["n"], s["t"], label), url))
    print("checking %d skins (%d requests)..." % (len(pairs), len(jobs)))

    bad = []
    stats = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        for label, url, status in ex.map(check, jobs):
            kind = label[label.rindex("[") + 1:-1]
            ok = status == 200
            stats.setdefault(kind, [0, 0])[0 if ok else 1] += 1
            if not ok:
                bad.append((label, url, status))

    for kind, (ok, fail) in sorted(stats.items()):
        print("  %-14s ok %-5d fail %d" % (kind, ok, fail))
    if bad:
        print("\nfailures (%d):" % len(bad))
        for label, url, status in bad[:40]:
            print("  %s -> %s\n     %s" % (label, status, url))
    else:
        print("\nall good")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
