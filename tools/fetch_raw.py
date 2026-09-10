"""Stage 1: download raw Riot / CommunityDragon data into ./cache."""
import json, os, sys, urllib.request, concurrent.futures

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "..", "cache")
DD = "https://ddragon.leagueoflegends.com"
CD = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default"

def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": "riotofaction-builder/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
    return raw if binary else json.loads(raw.decode("utf-8"))

def main():
    os.makedirs(CACHE, exist_ok=True)
    version = get(f"{DD}/api/versions.json")[0]
    print("Data Dragon version:", version)

    champs = get(f"{DD}/cdn/{version}/data/en_US/champion.json")["data"]
    print("champions:", len(champs))

    details = {}
    def one(cid):
        return cid, get(f"{DD}/cdn/{version}/data/en_US/champion/{cid}.json")["data"][cid]
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        for cid, data in ex.map(one, list(champs.keys())):
            details[cid] = data
    print("details fetched:", len(details))

    cd_skins = get(f"{CD}/v1/skins.json")
    cd_lines = get(f"{CD}/v1/skinlines.json")
    print("cd skins:", len(cd_skins), "skinlines:", len(cd_lines))

    out = {"version": version, "champions": details, "cd_skins": cd_skins, "cd_skinlines": cd_lines}
    with open(os.path.join(CACHE, "raw.json"), "w", encoding="utf-8") as f:
        json.dump(out, f)
    print("wrote cache/raw.json")

if __name__ == "__main__":
    main()
