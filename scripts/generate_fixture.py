#!/usr/bin/env python3
"""Generate the Emberfall campaign-setting fixture through the MCP surface.

Drives every product capability end-to-end: custom schemas with
inheritance, entries across all types, relation edges with annotations,
draft/canon/mixed statuses at entry/field/span granularity, revisions,
soft-schema warnings, edge deletion, and search — then the caller dumps
the world to fixtures/emberfall.json.

Usage: python3 scripts/generate_fixture.py [base_url]
"""

import itertools
import json
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"


class MCP:
    def __init__(self, base):
        self.url = base + "/mcp"
        self.session = None
        self.calls = 0
        self.errors = []
        self._rpc("initialize", {
            "protocolVersion": "2025-06-18", "capabilities": {},
            "clientInfo": {"name": "fixture-gen", "version": "1"},
        }, rpc_id=1)
        self._rpc("notifications/initialized", None, notify=True)

    def _rpc(self, method, params, rpc_id=None, notify=False):
        body = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            body["params"] = params
        if not notify:
            body["id"] = rpc_id or 2
        req = urllib.request.Request(
            self.url, data=json.dumps(body).encode(),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                **({"Mcp-Session-Id": self.session} if self.session else {}),
            })
        with urllib.request.urlopen(req) as resp:
            sid = resp.headers.get("Mcp-Session-Id")
            if sid:
                self.session = sid
            raw = resp.read().decode()
        if notify:
            return None
        for line in raw.splitlines():
            if line.startswith("data: "):
                raw = line[6:]
                break
        return json.loads(raw) if raw.strip() else None

    def call(self, name, args):
        self.calls += 1
        r = self._rpc("tools/call", {"name": name, "arguments": args})
        result = r["result"]
        text = result["content"][0]["text"] if result.get("content") else "{}"
        if result.get("isError"):
            self.errors.append((name, text))
            raise RuntimeError(f"{name}: {text}")
        return json.loads(text)


mcp = MCP(BASE)
log = lambda *a: print(*a, flush=True)

# ---------------------------------------------------------------- world
world = mcp.call("create_world", {"name": "Emberfall"})
WID = world["id"]
log(f"world Emberfall {WID}")

types = {t["name"]: t for t in mcp.call("get_world", {"world_id": WID})["types"]}


def new_type(name, parent, fields):
    r = mcp.call("create_entry_type", {
        "world_id": WID, "name": name,
        "parent_id": types[parent]["id"] if parent else "",
        "fields": fields,
    })
    types[name] = r["type"]
    return r.get("warnings") or []


# Custom schemas: inheritance chains + relation configs (SPEC: agents can
# create schemas). One field uses an unknown kind to exercise the
# soft-schema warning path.
new_type("Region", "Place", [
    {"name": "climate", "kind": "string"},
])
new_type("City", "Place", [
    {"name": "population", "kind": "number"},
    {"name": "ruler", "kind": "relation", "relation": {
        "targets": ["Character"], "template": "A is ruled by B",
        "inverse_label": "Rules"}},
])
new_type("Village", "Place", [
    {"name": "population", "kind": "number"},
])
new_type("Ruin", "Place", [
    {"name": "danger", "kind": "string"},
    {"name": "guarded_by", "kind": "relation", "relation": {
        "targets": ["Character", "Faction"], "many": True,
        "template": "A is guarded by B", "inverse_label": "Guards"}},
])
new_type("Artifact", "Item", [
    {"name": "attunement", "kind": "string"},
    {"name": "forged_in", "kind": "relation", "relation": {
        "targets": ["Place"], "template": "A was forged in B",
        "inverse_label": "Artifacts forged here"}},
])
warn = new_type("Deity", "Character", [
    {"name": "domain", "kind": "string"},
    {"name": "epoch", "kind": "timeline"},  # unknown kind -> soft warning
])
log(f"6 custom types; deliberate soft-schema warning: {warn}")

ids = {}      # title -> entry id
statuses = {} # title -> intended final treatment


def create(type_name, title, fields=None, body=None):
    e = mcp.call("create_entry", {
        "world_id": WID, "type_id": types[type_name]["id"], "title": title})
    ids[title] = e["id"]
    if fields or body:
        args = {"entry_id": e["id"]}
        if fields:
            args["fields"] = fields
        if body:
            args["body_md"] = body
        mcp.call("update_entry", args)
    return e["id"]


def edge(frm, field, to, annotation=""):
    return mcp.call("create_edge", {
        "from_entry_id": ids[frm], "field": field,
        "to_entry_id": ids[to], "annotation": annotation})


# ---------------------------------------------------------------- places
REGIONS = {
    "The Cinderwastes": ("scorched, ash-storms", "Where the largest shard of the comet Vhezar fell. Glass dunes, ember geysers, and the ruins of the old capital. Nothing grows here but firemoss and grudges."),
    "The Verdant Throat": ("humid, riotous growth", "A jungle valley that swallowed three kingdoms after the Fall. The canopy glows faintly at night — spores from the ember-changed trees."),
    "The Palegrave Peaks": ("alpine, haunted fogs", "Mountains where the dead of the Fall were carried for burial. The passes are safe by day. By night the fog remembers names."),
    "The Saltmere Coast": ("storm-lashed, mercantile", "The only coastline spared by the Fall, now choked with refugees' descendants, trade houses, and smugglers' fleets."),
}
CITIES = {
    "Vellum Reach": ("The Saltmere Coast", 42000, "The great port and de facto capital of the after-world. Paper lanterns, ink-stained clerks, and the Ledger-Court that rules by contract law."),
    "Ashvault": ("The Cinderwastes", 9000, "A fortress-city built into the cooled crater wall. Its founders mine the comet-glass; its children are born with grey eyes."),
    "Greenhollow": ("The Verdant Throat", 15000, "A city grown rather than built — houses trained from living banyan, streets that shift a finger-width every year."),
    "Cindral": ("The Cinderwastes", 6000, "The pilgrim city at the crater's edge, where the Emberfaith keeps its eternal forge-shrines."),
    "Highcairn": ("The Palegrave Peaks", 11000, "Terraced granite city of the mountain clans, keepers of the funerary roads and the toll-gates on every pass."),
    "Brinemarket": ("The Saltmere Coast", 19000, "A floating bazaar lashed together from a thousand hulls. Anything can be bought; most of it was stolen."),
    "Duskwell": ("The Palegrave Peaks", 4000, "The last city before the high fogs, built around a well that never freezes and never empties."),
}
VILLAGES = {
    "Fennel Crossing": ("The Verdant Throat", 400, "A river-ford village of eel-farmers and toll-takers."),
    "Greyharrow": ("The Palegrave Peaks", 250, "Sheep, slate, and silence. The harrowstones hum before avalanches."),
    "Emberlight": ("The Cinderwastes", 300, "Glass-farmers who harvest the dunes by starlight, when the sand cools."),
    "Saltwhistle": ("The Saltmere Coast", 600, "A shore village famous for wind-carved whistling cliffs and unlicensed salvage."),
    "Mosshaven": ("The Verdant Throat", 350, "Built in the ribcage of some vast Fall-killed beast, now furred green."),
    "Cairnfoot": ("The Palegrave Peaks", 500, "The village at the base of the funerary roads. Every family digs."),
}
RUINS = {
    "The Sunken Rotunda": ("The Saltmere Coast", "flooded, warded", "The drowned senate-hall of the old kingdom, its debate still audible at low tide, word for word, a century stale."),
    "Karvex Deep": ("The Cinderwastes", "extreme heat, glasswights", "The mine that dug too close to the buried shard. Its tunnels are now grown with comet-glass that dreams."),
    "The Chained Library": ("The Palegrave Peaks", "curses, bibliomantic traps", "A monastery library whose books were chained to stop them leaving. After the Fall, the chains were needed."),
    "Thornmaw Palace": ("The Verdant Throat", "carnivorous flora", "The overgrown court of the Green Queen, swallowed in a single night of growth."),
    "The Ember Gate": ("The Cinderwastes", "unknown", "A free-standing arch of fused glass at the crater's exact center. Nothing that walks through it on the ember-tide returns unchanged."),
    "Wreck of the Lantern-Bearer": ("The Saltmere Coast", "structural collapse, ghost-light", "The comet-watcher's flagship, thrown a mile inland by the Fall's wave, still burning a cold blue light in its crow's nest."),
}

for name, (climate, body) in REGIONS.items():
    create("Region", name, {"climate": climate, "kind": "region"}, body)
for name, (region, pop, body) in CITIES.items():
    create("City", name, {"population": pop, "kind": "city"}, body)
    edge(name, "located_in", region)
for name, (region, pop, body) in VILLAGES.items():
    create("Village", name, {"population": pop, "kind": "village"}, body)
    edge(name, "located_in", region)
for name, (region, danger, body) in RUINS.items():
    create("Ruin", name, {"danger": danger, "kind": "ruin"}, body)
    edge(name, "located_in", region)
log(f"{len(REGIONS)+len(CITIES)+len(VILLAGES)+len(RUINS)} places")

# ---------------------------------------------------------------- deities
DEITIES = {
    "Vhezar, the Broken Lantern": ("catastrophe, change", "The comet itself, worshipped and cursed in equal measure. Its clergy argue whether the Fall was judgment, accident, or invitation."),
    "Mother Meridian": ("roads, bargains", "Goddess of the space between places. Every crossroads shrine holds a coin no one dares spend."),
    "The Gardener Below": ("growth, patience", "The Verdant Throat's slow god. Prayers are planted, not spoken, and answered in seasons."),
    "Saint Ledger": ("contracts, debts", "A mortal clerk deified by common consensus in Vellum Reach. His miracle: a debt, once written fairly, cannot be unjustly enforced."),
    "The Pale Auditor": ("death, memory", "Keeper of the funerary roads. Counts every name the fog remembers, and forgets none itself."),
}
for name, (domain, body) in DEITIES.items():
    create("Deity", name, {"domain": domain, "gender": "—", "occupation": "deity"}, body)
log(f"{len(DEITIES)} deities")

# ---------------------------------------------------------------- factions
FACTIONS = {
    "The Ledger-Court": ("Rule Vellum Reach by contract law", "Vellum Reach"),
    "The Emberfaith": ("Tend the crater shrines and interpret the Fall", "Cindral"),
    "The Glasswrights' Union": ("Monopolize comet-glass mining and shaping", "Ashvault"),
    "The Green Choir": ("Serve the Gardener Below; keep the jungle fed and fed-upon in balance", "Greenhollow"),
    "The Cairn Wardens": ("Guard the funerary roads and the toll-gates", "Highcairn"),
    "The Saltmere Combine": ("Control shipping, salvage, and smuggling alike", "Brinemarket"),
    "The Lantern Society": ("Recover pre-Fall knowledge before it burns, rots, or bites", "Vellum Reach"),
    "The Ashen Hand": ("A murder-cult that believes the Fall must be finished", "Karvex Deep"),
    "The Meridian Walkers": ("Itinerant priests of Mother Meridian; keep the roads passable and neutral", "Fennel Crossing"),
    "The Grey Company": ("Mercenaries who only take contracts written under Saint Ledger's seal", "Duskwell"),
}
for name, (purpose, base) in FACTIONS.items():
    create("Faction", name, {"purpose": purpose},
           f"*{purpose}.* Founded in the hungry decades after the Fall, the {name.split(chr(39))[0]} now shapes the politics of the after-world.")
    edge(name, "base", base)
log(f"{len(FACTIONS)} factions")

# ---------------------------------------------------------------- major NPCs
MAJORS = [
    ("Chancellor Ivex Callo", "female", "chancellor of the Ledger-Court", "Vellum Reach", ("The Ledger-Court", "First Signatory"),
     "Ivex Callo signs nothing she has not read twice and forgives nothing she has signed. She rose from harbor-clerk to Chancellor in nineteen years, on the strength of a single audited ledger that hanged three trade princes. {~draft}Rumor holds she keeps Saint Ledger's original quill, and that it writes one true sentence a year.{/~}"),
    ("Forge-Matron Sella Vhayne", "female", "high priest of the Emberfaith", "Cindral", ("The Emberfaith", "Forge-Matron"),
     "Sella tends the eternal forges with burn-scarred hands and a patience that frightens younger clergy. She preaches that the Fall was a lantern lowered to a dark world — and that lanterns can be lowered twice."),
    ("Warden-Captain Douro Kest", "male", "commander of the Cairn Wardens", "Highcairn", ("The Cairn Wardens", "Warden-Captain"),
     "Douro has walked every funerary road twice and paid the fog-toll once, which is once more than most survive. He does not speak of what name the fog took from him in payment. {~draft}It was his own; the man now answers to a borrowed one.{/~}"),
    ("Mirren of the Green Choir", "nonbinary", "voice of the Gardener Below", "Greenhollow", ("The Green Choir", "First Voice"),
     "Mirren was planted — their word — as an infant beneath the banyan court and raised by the Choir. They translate the jungle's slow intentions into fast human words, and are never wrong, and never entirely on anyone's side."),
    ("Admiral Coa Brack", "female", "master of the Saltmere Combine", "Brinemarket", ("The Saltmere Combine", "Admiral of Hulls"),
     "Coa Brack owns a hundred ships on paper and three hundred off it. She learned accounting from pirates and piracy from accountants, and considers the distinction sentimental."),
    ("Archivist Pell Undertow", "male", "recoverer of drowned texts", "Vellum Reach", ("The Lantern Society", "Senior Archivist"),
     "Pell dives the Sunken Rotunda with wax-sealed ears so the old debates cannot argue him into staying. His recovered folios rebuilt half of contract law. His nightmares recite the other half."),
    ("Glassmother Oruna Veck", "female", "guildmaster of the Glasswrights", "Ashvault", ("The Glasswrights' Union", "Glassmother"),
     "Oruna shaped the first pane of dreaming glass and has refused every offer to shape another. The Union follows her because she alone knows which veins of the Deep may be safely cut."),
    ("Brother Tallow", "male", "walking priest", "Fennel Crossing", ("The Meridian Walkers", "Road-Brother"),
     "No one remembers Brother Tallow young. He repairs bridges, marries travelers, buries the road's dead, and carries in his coin-purse a single coin that every shrine of Mother Meridian refuses. {~draft}The coin is the first toll ever paid, and it is looking for its way home.{/~}"),
    ("Captain Erya Voss", "female", "captain of the Grey Company", "Duskwell", ("The Grey Company", "Contract-Captain"),
     "Erya reads every contract aloud to her company before a single sword is drawn, and has broken exactly one — the clause is framed above her desk, crossed out in her own blood."),
    ("The Kindled King", "male", "claimant to the old throne", "The Ember Gate", ("The Ashen Hand", "Prophet-Sovereign"),
     "Something walked back out of the Ember Gate wearing the old king's face, a century after the old king died. It is charming, patient, generous to the poor — and it wants every ember of Vhezar gathered in one place. The Ashen Hand calls it majesty. {~draft}The Pale Auditor's ledgers list the Kindled King as an unpaid debt.{/~}"),
    ("Sarl Emberlight", "male", "glass-farmer and reluctant seer", "Emberlight", None,
     "Sarl harvests dune-glass like his mothers before him, except his harvest shows tomorrow's weather in its facets, and lately, other tomorrows. The village keeps his gift quiet. Three factions already suspect."),
    ("Nightingale Ash", "female", "information broker", "Brinemarket", ("The Saltmere Combine", "unlisted asset"),
     "Every secret in Brinemarket passes through the Nightingale's rookery of trained fog-crows. Her prices are strange: a memory, a habit, one hour of someone's name."),
]
for name, gender, occ, home, faction, body in MAJORS:
    create("Character", name, {"gender": gender, "occupation": occ}, body)
    edge(name, "hometown", home)
    if faction:
        edge(faction[0], "members", name, faction[1])
log(f"{len(MAJORS)} major NPCs")

# ---------------------------------------------------------------- minor NPCs
FIRST = ["Arden", "Bess", "Corvin", "Dela", "Edrik", "Fara", "Goss", "Hilde",
         "Ivo", "Jessa", "Kellen", "Lira", "Marek", "Nessa", "Orin", "Petra",
         "Quill", "Rosk", "Senna", "Tobias", "Ula", "Vann", "Wren", "Yara", "Zeph"]
FAMILIES = {
    "Saltmarsh": "Saltwhistle", "Cinderkin": "Ashvault", "Vellowine": "Vellum Reach",
    "Harrowgate": "Greyharrow", "Mossbourne": "Mosshaven", "Palefrost": "Duskwell",
    "Glasseye": "Emberlight", "Thornwald": "Greenhollow", "Brackwater": "Brinemarket",
    "Cairnson": "Cairnfoot", "Fennelwick": "Fennel Crossing", "Emberhart": "Cindral",
    "Deepdelve": "Highcairn", "Lanterly": "Vellum Reach",
}
OCCUPATIONS = ["fisher", "glass-miner", "scribe", "toll-keeper", "herbalist",
               "caravan guard", "eel-farmer", "salvager", "stonecutter", "innkeep",
               "fog-warden", "chandler", "smuggler", "shrine-sweeper", "cartographer"]
GENDERS = ["female", "male", "nonbinary"]
BODY_BITS = [
    "Known in {home} for an unmatched memory for faces and debts.",
    "Survived a crossing of the funerary roads and will not say how.",
    "Keeps a shard of comet-glass under the floorboards, and it keeps warm.",
    "Owes the {faction} a favor that grows interest.",
    "Once sold Nightingale Ash a secret and has felt lighter ever since.",
    "Third-generation {occ}, and the first to hate it.",
    "Claims to have heard the Sunken Rotunda finish a sentence.",
    "Feeds the fog-crows. The fog-crows remember.",
    "Wears a Meridian coin on a cord and has never been lost.",
    "Lost a sibling to the Ember Gate and writes them letters anyway.",
]
faction_names = list(FACTIONS)
minors = []
i = 0
for surname, home in FAMILIES.items():
    for k in range(5):  # 14 families x 5 = 70 minors
        first = FIRST[(i * 7 + k * 3) % len(FIRST)]
        name = f"{first} {surname}"
        if name in ids:
            name = f"{first} {surname} the Younger"
        occ = OCCUPATIONS[(i + k) % len(OCCUPATIONS)]
        gender = GENDERS[(i * 3 + k) % len(GENDERS)]
        fac = faction_names[(i + k) % len(faction_names)] if (i + k) % 3 == 0 else None
        bits = [BODY_BITS[(i * 5 + k) % len(BODY_BITS)], BODY_BITS[(i * 5 + k + 4) % len(BODY_BITS)]]
        body = " ".join(b.format(home=home, occ=occ, faction=fac or "Ledger-Court") for b in bits)
        create("Character", name, {"gender": gender, "occupation": occ}, body)
        edge(name, "hometown", home)
        if fac:
            edge(fac, "members", name, f"rank: {['initiate','journeyman','sworn','elder'][(i+k)%4]}")
        minors.append((name, surname))
        i += 1

# family edges within each surname cluster
by_family = {}
for name, surname in minors:
    by_family.setdefault(surname, []).append(name)
REL = ["{a} is {b}'s elder sibling", "{a} is {b}'s parent", "{a} and {b} are cousins",
       "{a} is married to {b}", "{a} raised {b} after the fog took their parents"]
fam_edges = 0
for surname, members in by_family.items():
    for j in range(len(members) - 1):
        a, b = members[j], members[j + 1]
        edge(a, "family", b, REL[(fam_edges) % len(REL)].format(a=a.split()[0], b=b.split()[0]))
        fam_edges += 1
log(f"{len(minors)} minor NPCs, {fam_edges} family edges")

# a few cross-major relations
edge("Chancellor Ivex Callo", "family", "Archivist Pell Undertow", "Pell is Ivex's estranged brother; the estrangement is itself under contract")
edge("Warden-Captain Douro Kest", "family", "Captain Erya Voss", "Erya is Douro's daughter; she left the mountains to escape the fog's ledger")
mcp.call("create_edge", {"from_entry_id": ids["Vellum Reach"], "field": "ruler",
                         "to_entry_id": ids["Chancellor Ivex Callo"], "annotation": ""})
mcp.call("create_edge", {"from_entry_id": ids["The Sunken Rotunda"], "field": "guarded_by",
                         "to_entry_id": ids["The Lantern Society"], "annotation": "warded and dive-licensed"})
mcp.call("create_edge", {"from_entry_id": ids["Karvex Deep"], "field": "guarded_by",
                         "to_entry_id": ids["The Glasswrights' Union"], "annotation": "sealed gates, union keys"})
mcp.call("create_edge", {"from_entry_id": ids["The Ember Gate"], "field": "guarded_by",
                         "to_entry_id": ids["The Kindled King"], "annotation": "he calls it 'waiting', not guarding"})

# ---------------------------------------------------------------- items & artifacts
ARTIFACTS = {
    "The Unspent Coin": ("attunement: none — it chooses", "Ashvault", "Brother Tallow", "The first toll ever paid to Mother Meridian. Whoever carries it always finds the road they need, never the road they want."),
    "Ledgerbane": ("attunement: sworn oath-breaker", "Vellum Reach", "Captain Erya Voss", "A short sword that cannot cut anyone who has kept every promise they made. It has never once failed to cut."),
    "The Dreaming Pane": ("attunement: glasswright", "Ashvault", "Glassmother Oruna Veck", "The first and only sheet of dreaming comet-glass. Sleepers near it share one dream, and lately the dream has a doorway in it."),
    "Vhezar's Ember": ("attunement: forbidden", "Cindral", "The Kindled King", "A fist-sized fragment of the comet's heart, still falling in some direction no compass names. The Ashen Hand has gathered eleven. This is the twelfth."),
    "The Auditor's Bell": ("attunement: the grieving", "Highcairn", "Warden-Captain Douro Kest", "Rung once, it tells you if a dead name has been collected by the fog. Rung twice, it tells the fog where you are."),
    "The Nightingale's Ledger": ("attunement: paid in kind", "Brinemarket", "Nightingale Ash", "A book listing every secret its owner has ever sold — and, on the facing pages, what each buyer did with it."),
}
for name, (att, forged, wielder, body) in ARTIFACTS.items():
    create("Artifact", name, {"kind": "artifact", "attunement": att}, body)
    mcp.call("create_edge", {"from_entry_id": ids[name], "field": "forged_in",
                             "to_entry_id": ids[forged], "annotation": ""})
    edge(name, "wielder", wielder)

ITEMS = {
    "Fog-crow whistle": ("tool", "Brinemarket", "Bone whistle that calls one specific crow, who decides whether to answer."),
    "Ember-tide charts": ("document", "Cindral", "Tide-tables for the crater's glass dunes; wrong twice a year, fatally."),
    "Chained folio, unopened": ("book", "The Chained Library", "Its chain is newer than the book. Someone re-shackled it after the Fall."),
    "Meridian shrine-coin": ("token", "Fennel Crossing", "A coin no one dares spend. Standard issue at every crossroads."),
    "Glasswright's cutting-song": ("document", "Ashvault", "Sheet music. The Deep's glass veins split cleanly along the third harmony."),
    "Eel-farmer's toll receipt": ("document", "Fennel Crossing", "Proof of passage, stamped by Brother Tallow. Older ones are collector's items."),
    "Funerary road toll-marker": ("token", "Cairnfoot", "Grave-iron disc; the fog honors it, mostly."),
    "Salvaged senate gavel": ("relic", "The Sunken Rotunda", "Still bangs itself once at low tide, calling a session no one attends."),
    "Green Choir seed-prayer": ("token", "Greenhollow", "A prayer written on a seed-husk. Planting it is the asking."),
    "Grey Company standard contract": ("document", "Duskwell", "Forty clauses, Saint Ledger's seal, and one blank line that fills itself in."),
    "Palegrave mourning veil": ("clothing", "Highcairn", "Woven fog-grey. The dead cannot see through it; the living should not try."),
    "Wreck-light lantern": ("tool", "Wreck of the Lantern-Bearer", "Burns the same cold blue as the flagship's crow's nest. Never lit by hand."),
}
for name, (kind, loc, body) in ITEMS.items():
    create("Item", name, {"kind": kind}, body)
    edge(name, "location", loc)
log(f"{len(ARTIFACTS)} artifacts, {len(ITEMS)} items")

# ---------------------------------------------------------------- events
EVENTS = [
    ("The Night of Falling Embers", "Year 0 — the Fall", "The Cinderwastes",
     [("Vhezar, the Broken Lantern", "the comet itself")],
     "The comet Vhezar broke apart in the high dark and fell across a night that lasted three days. Every calendar of the after-world counts from this."),
    ("The Drowning of the Rotunda", "Year 0, third day of the Fall", "The Sunken Rotunda",
     [("Archivist Pell Undertow", "recovered the record, a century later")],
     "The Fall's wave took the senate mid-debate. The motion on the floor — evacuation — had just failed by two votes."),
    ("The First Toll", "Year 4 AE", "Fennel Crossing",
     [("Brother Tallow", "paid it"), ("Mother Meridian", "collected it")],
     "The roads after the Fall were not safe until someone paid for them. What Brother Tallow paid is not recorded. The roads have been passable since."),
    ("Founding of the Ledger-Court", "Year 12 AE", "Vellum Reach",
     [("Saint Ledger", "his ledgers were the founding texts"), ("The Ledger-Court", "founded")],
     "Refugee clerks, lacking a king, ruled that a fair contract outranks a crown. It has held for eighty-eight years."),
    ("The Glass Concord", "Year 31 AE", "Ashvault",
     [("The Glasswrights' Union", "signatory"), ("Glassmother Oruna Veck", "negotiated as a journeyman")],
     "The Union won sole rights to the Deep in exchange for sealing whatever had started singing back."),
    ("The Green Swallowing", "Year 44 AE", "Thornmaw Palace",
     [("The Gardener Below", "acted, or slept restlessly"), ("The Green Choir", "interpreted")],
     "The Green Queen's palace vanished under jungle in one night. The Choir insists it was mercy. {~draft}The Queen's dinner guests are, by some accounts, still dining.{/~}"),
    ("The Fog Census", "Year 58 AE", "The Palegrave Peaks",
     [("The Pale Auditor", "conducted"), ("The Cairn Wardens", "assisted under duress")],
     "For one night the mountain fog spoke every name it had collected, in order. Cairnfoot transcribed 4,411 of them before dawn."),
    ("The Brinemarket Compact", "Year 71 AE", "Brinemarket",
     [("Admiral Coa Brack", "enforced it"), ("The Saltmere Combine", "profited")],
     "A hundred smuggler captains agreed on exactly one law: the market itself is neutral ground. Violations to date: three. Survivors of violations: none."),
    ("Return of the Kindled King", "Year 89 AE", "The Ember Gate",
     [("The Kindled King", "returned"), ("The Ashen Hand", "was waiting")],
     "On the ember-tide of Year 89, the Gate lit from the inside, and the old king walked out smiling. He remembered everyone's name. That was the frightening part."),
    ("The Eleventh Ember", "Year 97 AE", "Karvex Deep",
     [("The Ashen Hand", "stole it"), ("The Glasswrights' Union", "will not say what it was guarding")],
     "The Ashen Hand breached the sealed gates and left with a lead-wrapped burden. The Union resealed the Deep and doubled the choir of cutting-songs."),
    ("The Nightingale's Silence", "Year 99 AE", "Brinemarket",
     [("Nightingale Ash", "went silent for nine days")],
     "For nine days no secrets moved in Brinemarket. When the rookery reopened, every price had changed, and the Nightingale had a new scar shaped like a keyhole."),
    ("The Audit of Duskwell", "Year 100 AE", "Duskwell",
     [("The Pale Auditor", "walked the streets in person"), ("Captain Erya Voss", "escorted it, by contract")],
     "The Auditor came down from the fogs to count something in Duskwell. It counted, thanked the town politely, and left. The well has been three degrees warmer since. {~draft}What it counted was doors.{/~}"),
    ("The Present Unrest", "Year 101 AE — now", "Vellum Reach",
     [("Chancellor Ivex Callo", "holds the center"), ("The Kindled King", "makes generous offers"), ("The Lantern Society", "counts missing embers")],
     "Eleven embers gathered, one stolen, and the twelfth on the Kindled King's person. The Ledger-Court drafts contingencies. The Emberfaith prays for a lantern. The Ashen Hand prays for a second Fall."),
]
for name, date, loc, participants, body in EVENTS:
    create("Event", name, {"date": date}, body)
    edge(name, "location", loc)
    for p, note in participants:
        edge(name, "participants", p, note)
log(f"{len(EVENTS)} events")

# ------------------------------------------------------- statuses & revisions
# Everything above is AI-authored => draft. Promote per user directive to
# build a mixed-status fixture: regions/cities/villages/factions/deities/
# events fully canon; majors canon EXCEPT their draft spans stay via
# fields+edges-only scope where a body has {~draft}; artifacts canon;
# minors: half canon, rest left draft; some field-only promotions => mixed.
def canon(title, **scope):
    mcp.call("mark_canon", {"entry_id": ids[title], **scope})

full_canon = (list(REGIONS) + list(CITIES) + list(VILLAGES) + list(RUINS)
              + list(DEITIES) + list(FACTIONS) + list(ITEMS)
              + [e[0] for e in EVENTS if "{~draft}" not in e[4]]
              + [m[0] for m in MAJORS if "{~draft}" not in m[5]]
              + list(ARTIFACTS))
for t in full_canon:
    canon(t)
# span-preserving promotions: fields+edges canon, draft spans stay => mixed
for t in [m[0] for m in MAJORS if "{~draft}" in m[5]] + [e[0] for e in EVENTS if "{~draft}" in e[4]]:
    canon(t, fields=["gender", "occupation", "date"], edges=True)
# minors: even index canon, odd stays draft
for j, (name, _) in enumerate(minors):
    if j % 2 == 0:
        canon(name)
log("statuses applied")

# revisions + field-level draft: AI touches a canon entry's field => mixed
for title, patch in [
    ("Vellum Reach", {"fields": {"population": 43500}}),
    ("Sarl Emberlight", {"body_md": "Sarl harvests dune-glass like his mothers before him, except his harvest shows tomorrow's weather in its facets, and lately, other tomorrows. The village keeps his gift quiet. Three factions already suspect. This season the facets have begun showing a door."}),
    ("Brinemarket", {"fields": {"kind": "floating city"}}),
]:
    mcp.call("update_entry", {"entry_id": ids[title], **patch})

# soft-schema warning on purpose (undeclared field)
w = mcp.call("update_entry", {"entry_id": ids["Nightingale Ash"],
                              "fields": {"favorite_secret": "unknown, obviously"}})
log(f"soft warning demo: {w.get('warnings')}")

# draft edge lifecycle: create then delete (AI may delete drafts)
tmp = mcp.call("create_edge", {"from_entry_id": ids["Brother Tallow"], "field": "family",
                               "to_entry_id": ids["The Kindled King"], "annotation": "surely not"})
mcp.call("delete_edge", {"edge_id": tmp["edge"]["id"]})

# search sanity through MCP
hits = mcp.call("find_relevant", {"world_id": WID, "query": "comet glass mining",
                                  "near": [ids["Ashvault"]], "limit": 5})
log("search 'comet glass mining':", [(round(h["score"], 2), h["title"]) for h in hits])

summary = mcp.call("list_entries", {"world_id": WID})
from collections import Counter
log("totals:", dict(Counter(e["type_name"] for e in summary)))
log("statuses:", dict(Counter(e["status"] for e in summary)))
log(f"WORLD_ID={WID}")
log(f"mcp calls: {mcp.calls}, errors: {len(mcp.errors)}")
