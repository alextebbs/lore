#!/usr/bin/env python3
"""Generate the Emberfall campaign-setting fixture through the MCP surface.

v2: world settings + meta entry, individually written prose throughout,
unique names, origin/goals rich-text fields with [[mentions]], plus the
full feature sweep from v1 (custom schemas, statuses at all levels,
revisions, soft warnings, search).

Usage: python3 scripts/generate_fixture.py [base_url]
"""

import json
import sys
import urllib.request

sys.path.insert(0, "scripts")
from emberfall_npcs import MINORS

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"


class MCP:
    def __init__(self, base):
        self.url = base + "/mcp"
        self.session = None
        self.calls = 0
        self.errors = []
        self._rpc("initialize", {
            "protocolVersion": "2025-06-18", "capabilities": {},
            "clientInfo": {"name": "fixture-gen", "version": "2"},
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

mcp.call("update_world_settings", {"world_id": WID, "settings": {
    "vibe": ("Post-cataclysm low fantasy, a century after a comet broke apart "
             "over the world. Ash, salvage, contract law, and quiet dread; "
             "hope is real but always costs. Tonally: The Book of the New Sun "
             "meets a WoTC frontier gazetteer."),
    "style_prompt": ("Write like a veteran sourcebook author: concrete nouns, "
                     "specific numbers, sensory texture, history implied "
                     "rather than lectured. Vary sentence rhythm between "
                     "entries. Every NPC gets one unforgettable specific. "
                     "No stock phrases, no repeated sentence templates."),
    "humans_author_as": "canon",
    "ai_can_edit_canon": False,
}})

types = {t["name"]: t for t in mcp.call("get_world", {"world_id": WID})["types"]}

# meta entry (seeded canon by the server) — write the overview with an
# explicit override, since this generation run is user-directed.
meta_id = next(e["id"] for e in mcp.call("list_entries", {"world_id": WID})
               if e["type_name"] == "World")
mcp.call("update_entry", {"entry_id": meta_id, "canon_override": True, "body_md": (
    "A hundred and one years ago the comet Vhezar came apart in the high dark, "
    "and the world spent three days catching the pieces. The old kingdoms burned, "
    "drowned, or were simply misplaced; what survived crawled to the edges of the "
    "wound and started keeping ledgers. Emberfall is the after-world: four scarred "
    "regions strung together by toll roads, salvage fleets, and the stubborn "
    "arithmetic of people who intend to still be here in another hundred years.\n\n"
    "Play happens in the tension between recovery and relapse. The [[The Ledger-Court]] "
    "rules the coast by contract; the [[The Emberfaith]] tends shrine-forges at the "
    "crater's lip and argues about what the Fall *meant*; the [[The Ashen Hand]] has "
    "decided it meant *again*, and is collecting the comet's scattered embers to "
    "finish the job. Eleven are gathered. The twelfth walks around on two legs "
    "wearing a dead king's smile.\n\n"
    "Tone guidance: magic is residue, not utility. The dead are administered, not "
    "banished. Debts — financial, familial, cosmological — are the setting's true "
    "currency, and every faction below is, one way or another, a theory of how to "
    "pay one."
)})
log("settings + meta entry")

ids = {"__meta__": meta_id}


def new_type(name, parent, fields):
    r = mcp.call("create_entry_type", {
        "world_id": WID, "name": name,
        "parent_id": types[parent]["id"] if parent else "",
        "fields": fields,
    })
    types[name] = r["type"]
    return r.get("warnings") or []


new_type("Region", "Place", [{"name": "climate", "kind": "string"}])
new_type("City", "Place", [
    {"name": "population", "kind": "number"},
    {"name": "ruler", "kind": "relation", "relation": {
        "targets": ["Character"], "template": "A is ruled by B",
        "inverse_label": "Rules"}},
])
new_type("Village", "Place", [{"name": "population", "kind": "number"}])
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
log(f"6 custom types; soft-schema warning: {warn}")


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
    "The Cinderwastes": ("scorched; ash-storms; glass dunes", "The largest shard of Vhezar fell here, and the land has not finished flinching. By day the glass dunes are a furnace of refracted light where mirages come true often enough that guides charge extra for opinions; by night they cool into a black country of chimes and slow orange geysers. The old capital is somewhere underneath. Occasionally the wastes give a piece of it back — a paved half-street, a fountain still running — and the Emberfaith sends someone to thank them."),
    "The Verdant Throat": ("humid; riotous ember-changed growth", "Three kingdoms had names here before the jungle took them in a single generation of impossible growth. The canopy glows at night — spore-light, the Choir says, the forest dreaming — and the roads are branches wide enough for wagons, maintained by trees that seem to want the traffic. Everything grows fast in the Throat, including rumors, fevers, and second chances. The polite traveler asks permission at the treeline. The impolite traveler is usually fine, which somehow makes it worse."),
    "The Palegrave Peaks": ("alpine; sentient funerary fogs", "The mountains took the Fall's dead — carted up the switchback roads by the wagonload that first terrible winter — and they have been employed in the grief trade ever since. By day the passes are honest granite and hard weather. By night the fog comes down with a bureaucrat's patience and collects: names, mostly, and the occasional debtor. The mountain clans built their cities above the fog-line and their fortunes on the tolls, and they do not apologize for either."),
    "The Saltmere Coast": ("storm-lashed; mercantile; crowded", "The only coast the Fall spared, which everyone agrees was an oversight. A century of refugees, their descendants, their creditors, and their creditors' lawyers have packed the shore from the Reach to the reef-towns, and the resulting civilization runs on salvage, shipping, and the belief — legally enforceable — that a fair contract outranks a crown. It is loud, corrupt, generous, and alive, and it smells of tar, ink, and low tide."),
}
CITIES = {
    "Vellum Reach": ("The Saltmere Coast", 42000, "The de facto capital of the after-world announces itself twenty miles out: a smudge of lantern-light, a forest of masts, and the smell of hot paper from the contract-mills. The Ledger-Court rules from a drowned senate's salvaged benches, clerks outnumber soldiers forty to one, and the harbor's famous paper lanterns are re-inked nightly with the day's filed judgments. Nothing here is free, everything here is negotiable, and the city is oddly proud of both facts."),
    "Ashvault": ("The Cinderwastes", 9000, "A fortress-city socketed into the cooled crater wall, three streets deep and nine levels down. Ashvault exists because the comet-glass is worth more than comfort: the Union's cutting-songs echo up the shafts all day, the forges never bank, and the children are born with grey eyes and an instinct for which corridors to avoid. Visitors find it grim. Residents find visitors soft. Both are correct."),
    "Greenhollow": ("The Verdant Throat", 15000, "A city grown, not built: houses trained from living banyan, bridges that are roots holding hands, streets that drift a finger-width a year so that every address includes the decade. The Green Choir keeps the peace between citizens and habitat — mostly a matter of manners — and the night markets under the spore-light sell fruit that did not exist last season. Greenhollow smells of sap, rain, and patience."),
    "Cindral": ("The Cinderwastes", 6000, "The pilgrim city at the crater's edge, arranged like an amphitheater facing the wound. Seven shrine-forges burn day and night, each tended by a different lineage of the Emberfaith, and the streets are graded by heat: cool rim-terraces for inns and infirmaries, the glowing lower rings for clergy who have made their peace. Pilgrims arrive asking why the Fall happened. Cindral has spent a century declining to answer quickly."),
    "Highcairn": ("The Palegrave Peaks", 11000, "Terraced granite, iron bells, and the cleanest streets in the world — the clans sweep them the way sailors coil rope, because sloppiness on a mountain is a form of debt. Highcairn holds the keys to every high pass and the ledgers of every toll, and its wealth shows quietly: good wool, good bread, doors that fit. Above the top terrace the funerary roads begin, and the city's whole posture is that of a town living respectfully upstairs from its landlord."),
    "Brinemarket": ("The Saltmere Coast", 19000, "A thousand hulls lashed gunwale to gunwale make a city that creaks like a forest and never sleeps twice in the same shape. Brinemarket is the coast's id: everything the Reach's contracts forbid is for sale here under the one law all captains signed — the market itself is neutral ground. Violations to date, three. Survivors of violations, none. The fog-crows perch on the mast-tops and watch everything, for a client."),
    "Duskwell": ("The Palegrave Peaks", 4000, "The last town before the high fogs, built in rings around a well that never freezes and never empties. Duskwell is where the mountain trade catches its breath: mercenaries winter here, pilgrims stage here, and the Grey Company's contract-hall does steady business in escorts up the funerary roads. Since the Audit, the well runs three degrees warmer, and the town has decided, collectively, gratefully, not to wonder."),
}
VILLAGES = {
    "Fennel Crossing": ("The Verdant Throat", 400, "Where the branch-road meets the brown river, somebody must keep the ford, and the Crossing has made a village of it: eel-weirs, a toll-house older than the toll, and the crossroads shrine where Mother Meridian's unspendable coin sits in the open, politely ignored by three generations of thieves. Everything important in the Throat passes through eventually. The Crossing waves it through and remembers it."),
    "Greyharrow": ("The Palegrave Peaks", 250, "Sheep, slate, and silence, in that order, on a shelf of pasture below the fog-line. Greyharrow's humming harrowstones — carved by the same family for two centuries — give the village a day's warning of avalanche and a strange, tuneful reputation. The wool is celebrated. The people are laconic. The fog knows the village by name and, so far, has been content to leave it at that."),
    "Emberlight": ("The Cinderwastes", 300, "Glass-farmers who work the dunes by starlight, when the sand cools and the harvest chimes underfoot. Emberlight's terraces face away from the crater — an old superstition nobody will explain to outsiders — and its cellars hold the finest dune-glass ever cut. The Ember Gate is a half-day's walk east. The village does not organize excursions."),
    "Saltwhistle": ("The Saltmere Coast", 600, "The wind plays the carved cliffs like a pipe organ, which is charming for the first week and structural to the character of everyone raised there. Saltwhistle lives on salvage from the drowned promenade-town below its cliffs, licenses be damned, and its divers are the best on the coast. On midwinter nights the cliffs play a note no one taught them, and the village stands out to listen."),
    "Mosshaven": ("The Verdant Throat", 350, "Built inside the ribcage of something enormous that the Fall killed mid-stride, now furred green and load-bearing. The Choir says the beast doesn't mind; the village has decided to believe them. Mosshaven smokes the river's best eels, carves the beast's shed bone, and celebrates its founding with a festival whose central rite is an apology."),
    "Cairnfoot": ("The Palegrave Peaks", 500, "The village at the base of the funerary roads, where every family digs and the vocabulary for grief has forty words the way coastal towns have forty for weather. Cairnfoot equips the mountain's dead — graves, tokens, bells, bread — with a professional tenderness that unsettles outsiders and comforts everyone else. The night of the Fog Census, this village lit the lanterns and wrote fastest."),
}
RUINS = {
    "The Sunken Rotunda": ("The Saltmere Coast", "flooded; warded; argumentative", "The old kingdom's senate drowned mid-session, and the session declined to adjourn. At low tide the debate is audible from the sea-steps, word for word, a century stale — the motion on the floor is evacuation, and it keeps failing by two votes. Lantern Society divers work the archive-galleries under strict wards and stricter earplugs. The Rotunda's marble is still white. The water over it is always calm. Nobody likes either fact."),
    "Karvex Deep": ("The Cinderwastes", "extreme heat; glasswights; sealed", "The mine that dug too close to the buried shard and struck something that dug back. The Union sealed the lower galleries behind three doors and a choir of cutting-songs, and mines the upper veins on a rotation no foreman has ever asked to extend. The glass down there has grown into shapes that suggest furniture, or instruments, or hosts expecting company. Since the Ashen Hand's theft, the Deep has been singing louder."),
    "The Chained Library": ("The Palegrave Peaks", "curses; bibliomantic traps; escaped titles", "A monastery library whose books were chained to the shelves as discipline. After the Fall, the chains became necessary. The monks are gone — accounts differ on the direction — and the wardens keep the doors barred from the outside, which does not stop titles from turning up loose in valley markets: patient, well-preserved, and always, somehow, exactly the book its finder should not read."),
    "Thornmaw Palace": ("The Verdant Throat", "carnivorous flora; temporal sap", "The Green Queen's court was swallowed in one night of growth — the Choir calls it mercy, the Queen's surviving creditors call it default. The palace is still in there, wound through with thorn the color of old bronze, and the dinner party is, by several sober accounts, still seated: preserved in amber sap, mid-toast, waiting for a next course that the jungle has been preparing for forty years."),
    "The Ember Gate": ("The Cinderwastes", "unknown; do not enter on the ember-tide", "A free-standing arch of fused glass at the crater's exact center, tall as a chapel, warm as a held hand. It casts a shadow at noon that points the wrong way. Nothing that walks through on the ember-tide comes back unchanged; most things do not come back at all. The Emberfaith calls it the comet's keyhole. The Kindled King, who walked out of it wearing a dead man's face, calls it — fondly — the door."),
    "Wreck of the Lantern-Bearer": ("The Saltmere Coast", "structural collapse; cold ghost-light", "The comet-watchers' flagship was a mile offshore when the sky broke, and the wave threw her a mile inland, upright, keel-deep in a barley field. Her crow's nest still burns the cold blue signal-light her watch lit that night — no fuel, no heat, no permission to stop. Salvagers stripped her decades ago and returned everything within the year, item by item, without discussing it."),
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
    "Vhezar, the Broken Lantern": ("catastrophe; change; falling light", "The comet itself, worshipped and cursed with equal fervor and often by the same person before breakfast. Vhezar's theology is an open wound: judgment, accident, or invitation — the Emberfaith maintains all three doctrines under one roof and calls the argument liturgy. Its symbol is a lantern cracked but burning. Its prayers are short, on the grounds that the god demonstrated a preference for abrupt statements."),
    "Mother Meridian": ("roads; bargains; the space between", "Goddess of crossroads, thresholds, and every place that is on the way to somewhere else. She holds that a road is a promise and a toll is a sacrament, and her shrines — a post, a bowl, a coin no one dares spend — mark every junction worth the name. She is the most-worshipped god in the after-world by sheer foot traffic, and the only one whose clergy are required to keep walking."),
    "The Gardener Below": ("growth; patience; compost", "The Verdant Throat's slow divinity, who may be a god, a root-system, or a very large opinion. Prayers to the Gardener are planted, not spoken — written on seed-husks, buried, answered in seasons. The Choir teaches that the Gardener wastes nothing, forgets nothing, and loves nothing in any hurry, and that the Fall itself was, from a sufficiently patient perspective, mulch."),
    "Saint Ledger": ("contracts; debts; fair dealing", "A mortal harbor-clerk deified by common consensus and, uniquely, by notarized petition. His miracle is procedural: a debt written fairly cannot be unjustly enforced — collectors' hands cramp, forged clauses smear. The Reach's courts open sessions by sharpening a pen in his name. He is depicted with an quill behind one ear and the weary, kindly expression of a man who has seen your paperwork and knows."),
    "The Pale Auditor": ("death; memory; accounts", "Keeper of the funerary roads and counter of the fog's collected names. The Auditor forgets nothing, forgives nothing, and — the clans insist on this distinction — punishes nothing: it merely balances. It appears as a tall figure in unbleached wool whose face is a courteous smudge, and its rare descents into the towns of the living are called audits, survived, and never explained."),
}
for name, (domain, body) in DEITIES.items():
    create("Deity", name, {"domain": domain, "gender": "—", "occupation": "deity"}, body)
log(f"{len(DEITIES)} deities")

# ---------------------------------------------------------------- factions
FACTIONS = {
    "The Ledger-Court": ("Rule the coast by contract law", "Vellum Reach",
        "Born in a refugee camp where the only surviving authority was a harbor-clerk's ledger, the Court has spent eighty-eight years proving that a signature can do a crown's work. Its judges are auditors, its army is precedent, and its single article of faith — a fair contract outranks any power that would break it — has been tested by warlords, famines, and once by a god. The Court's weakness is the obvious one: it can only govern what agrees to sign."),
    "The Emberfaith": ("Tend the crater shrines; interpret the Fall", "Cindral",
        "Seven shrine-forges, seven lineages, one perpetual argument about what the sky meant by it. The Faith runs hospices, forges, and the pilgrim circuit, and holds the crater's edge against relic-thieves with a gentleness that should not be mistaken for softness — the Forge-Matron's predecessors have melted down three private collections and mailed back the slag with receipts. Doctrinally split on the Kindled King: abomination, or second chance."),
    "The Glasswrights' Union": ("Monopolize comet-glass; keep the Deep sealed", "Ashvault",
        "Equal parts guild, priesthood, and containment protocol. The Union's charter grants it every gram of comet-glass in the Cinderwastes; the unwritten codicil, paid for at the Glass Concord, obliges it to keep what lives in Karvex Deep from getting a wider audience. Its cutting-songs are trade secret, safety equipment, and lullaby at once. Union oaths are sworn on a sliver of the Dreaming Pane, and members report the sliver squeezes back."),
    "The Green Choir": ("Voice the Gardener; balance the Throat", "Greenhollow",
        "Interpreters between the jungle and its tenants. The Choir plants the prayers, reads the canopy's slow answers, and issues the annual Accommodations — which groves may be cut, which fruits are food this year, which paths have closed. They are not rulers and insist on it; they are translators for something that does not negotiate. Choir voices are planted as infants beneath the banyan court. Nobody knows what the trees do with the childhood, but the adults come out multilingual."),
    "The Cairn Wardens": ("Guard the funerary roads; work the toll-gates", "Highcairn",
        "The clans' answer to a mountain that employs the dead: a sworn service of gate-keepers, fog-readers, and road-guards who ensure the grief trade runs safely in both directions. Wardens learn the bell-codes, the harrowstone pitches, and the one negotiation that matters — what the fog will accept in lieu. Their oath is taken at the top gate at dusk, alone. Whatever is said back constitutes acceptance."),
    "The Saltmere Combine": ("Move everything; own the wet half of the law", "Brinemarket",
        "A hundred shipping houses, salvage fleets, and smuggler dynasties wearing one flag of convenience. The Combine controls the coast's cargo the way weather controls sailing — pervasively, unaccountably, with occasional drownings — and maintains an exquisitely profitable ambiguity about which of its manifests are the real ones. Its houses feud constantly; its response to outside threat is unanimous within the hour. Admiral Brack calls it a family. She is not being warm."),
    "The Lantern Society": ("Recover what the Fall buried, before it bites", "Vellum Reach",
        "Archivists with siege equipment. The Society dives the Rotunda, treats with the Chained Library, and races grave-robbers to every pre-Fall cache, on the theory that the old world's knowledge will be recovered by someone and had better be recovered by librarians. Its field teams are bonded, warded, and famously well-insured. Its motto — 'Read it first' — is variously a scholarly principle, a safety protocol, and a threat."),
    "The Ashen Hand": ("Finish the Fall", "Karvex Deep",
        "The Fall was not a catastrophe, teaches the Hand: it was a first attempt. They gather Vhezar's scattered embers with the devotion of reliquary monks and the methods of a murder-cult, and their cells honeycomb every city that thinks itself too civilized for them. The Hand pays debts, keeps promises, and funds orphanages — the Kindled King insists on it — which makes them harder to hate than anyone would like. Eleven embers down. Their arithmetic is patient."),
    "The Meridian Walkers": ("Keep the roads open, neutral, and paid-for", "Fennel Crossing",
        "Mother Meridian's itinerant clergy: part priesthood, part road-crew, part diplomatic pouch. Walkers repair bridges, carry sealed letters between enemies, marry the eloping, and bury the road's unclaimed dead, and by ancient convention no faction touches them — the last outfit that killed a Walker found every road in the region longer, in ways surveyors still cannot explain. They own nothing but their boots and are welcome absolutely everywhere."),
    "The Grey Company": ("Fight only under Saint Ledger's seal", "Duskwell",
        "Mercenaries who solved the profession's oldest problem — being on the wrong side — by outsourcing the question to a notary. The Company takes no contract unwitnessed, breaks none it takes, and walks away from employers who breach terms, with the deposit forfeit and the Company's lawyers, who are terrifying, in pursuit. Four hundred sabers whose real weapon is a reputation for doing exactly what the paper says. Winter quarters: Duskwell. Summer quarters: wherever the ink dries."),
}
for name, (purpose, base, body) in FACTIONS.items():
    create("Faction", name, {"purpose": purpose}, body)
    edge(name, "base", base)
log(f"{len(FACTIONS)} factions")

# ---------------------------------------------------------------- major NPCs
MAJORS = [
    ("Chancellor Ivex Callo", "female", "chancellor of the Ledger-Court", "Vellum Reach", ("The Ledger-Court", "First Signatory"),
     "Ivex Callo signs nothing she has not read twice and forgives nothing she has signed. She rose from harbor-clerk to Chancellor in nineteen years on the strength of a single audited ledger that hanged three trade princes, and she has governed since the way she audits: line by line, without appetite, without mercy, without error anyone has found yet. Her rare laughter is said to be warm. The Court's clerks trade sightings of it like relic-cards. {~draft}Rumor holds she keeps Saint Ledger's original quill, and that it writes one true sentence a year, and that this year's sentence concerned the Kindled King.{/~}",
     "Born in the fish-market district to a mother who salted cod and a father listed in the registry as 'absent, owing.' The debt shaped her: she paid it off at seventeen, with interest, and has been closing accounts ever since.",
     ["Bind the [[The Kindled King]] inside a contract he cannot charm his way out of", "Find a successor she trusts more than she trusts [[Archivist Pell Undertow]]", "Die owing nothing to anyone"]),
    ("Forge-Matron Sella Vhayne", "female", "high priest of the Emberfaith", "Cindral", ("The Emberfaith", "Forge-Matron"),
     "Sella tends the First Forge with burn-scarred hands and a patience that frightens younger clergy more than any temper could. She was a farrier's daughter who walked the pilgrim circuit at twenty and simply never left, and forty years of shrine-work have hammered her theology to a single hard point: the Fall was a lantern lowered into a dark world, and lanterns can be lowered twice. What that means in practice she declines to say. The Ashen Hand has offered her honors. She sent back the messenger's boots, resoled, with a note reading 'walk home a better road.'",
     "The circuit took her past the [[The Ember Gate]] on an ember-tide when she was twenty-two. She has never written down what she saw through the arch, but she stopped wearing shoes in the shrine that year and has not since.",
     ["Settle the Faith's doctrine on the [[The Kindled King]] before the schism does it for her", "Keep [[Vhezar's Ember]] out of the crater — any crater"]),
    ("Warden-Captain Douro Kest", "male", "commander of the Cairn Wardens", "Highcairn", ("The Cairn Wardens", "Warden-Captain"),
     "Douro has walked every funerary road twice and paid the fog-toll once, which is once more than most survive. He commands the Wardens with a mildness that new recruits mistake for softness until they watch him talk a panicked caravan through a night-fog by voice alone, forty minutes of steady mountain patois while the mist pressed its face to the lanterns. He does not speak of what the toll cost him. {~draft}It was his name; the man now answers to a borrowed one, and the Pale Auditor's ledgers list the original as 'retired.'{/~}",
     "Clan-born in Highcairn's third terrace, second son of a bell-founder. He was meant for the foundry; the mountain had a vacancy.",
     ["See [[Captain Erya Voss]] once a year without either of them admitting it is scheduled", "Retire the high gate's oldest debt — his own"]),
    ("Mirren of the Green Choir", "nonbinary", "voice of the Gardener Below", "Greenhollow", ("The Green Choir", "First Voice"),
     "Mirren was planted — their word — beneath the banyan court as an infant and raised by the Choir in the ordinary way, if the ordinary way includes a childhood the trees keep in trust. They translate the jungle's slow intentions into fast human words with a fluency no other voice approaches, and are never wrong, never hurried, and never entirely on anyone's side, including the jungle's. They collect pre-Fall gardening manuals, which they read the way others read comedies, laughing softly at the pruning advice.",
     "Their birth family is unknown even to them; the Choir's records say only 'given, freely, in the hungry year.' Mirren has never looked into it. The trees know, they say, and have not brought it up.",
     ["Negotiate this decade's Accommodations without ceding the river terraces", "Learn what the canopy is spelling — before [[Ivy Mossbourne]] does something young about it"]),
    ("Admiral Coa Brack", "female", "master of the Saltmere Combine", "Brinemarket", ("The Saltmere Combine", "Admiral of Hulls"),
     "Coa Brack owns a hundred ships on paper and three hundred off it, and can tell you the draft, debts, and dirty secrets of every hull between the reef and the Reach. She learned accounting from pirates and piracy from accountants, considers the distinction sentimental, and runs the Combine from a flagship that has not left harbor in nine years because, as she says, the fleet comes to her. Her table is famous: admirals, smugglers, and magistrates eat there in enforced adjacency, and more coast policy is settled over her fish stew than in the Ledger-Court.",
     "Third daughter of a reef-town wrecker family; she salvaged her first cargo at eleven and incorporated at fourteen. The wreck that made her fortune has never been named in her hearing without the room going quiet.",
     ["Put a Brack on the Ledger-Court bench within the decade", "Find out what [[Nightingale Ash]] paid for her silence in Year 99 — and to whom"]),
    ("Archivist Pell Undertow", "male", "recoverer of drowned texts", "Vellum Reach", ("The Lantern Society", "Senior Archivist"),
     "Pell dives the Sunken Rotunda with wax-sealed ears so the old debate cannot argue him into staying, and he has brought up more of the drowned archive than the rest of the Society combined. On land he is donnish, distractible, and gently shabby; below, colleagues describe something else entirely — a man swimming through a senate of ghosts with the unbothered calm of a fish who has read all their speeches. His recovered folios rebuilt half of contract law. His nightmares, he says, recite the other half, with corrections.",
     "Elder brother to [[Chancellor Ivex Callo]], a fact both of them have had notarized into irrelevance. The estrangement is itself under contract, with terms neither will disclose and both scrupulously honor.",
     ["Recover the Rotunda's final session — the vote everything else depends on", "Amend one specific clause of the estrangement before either signatory dies"]),
    ("Glassmother Oruna Veck", "female", "guildmaster of the Glasswrights", "Ashvault", ("The Glasswrights' Union", "Glassmother"),
     "Oruna shaped the first pane of dreaming glass as a journeyman and has refused every commission to shape another, a refusal she has maintained against kings' ransoms, three separate threats, and one proposal of marriage. The Union follows her because she alone reads the Deep's moods — which veins may be cut, which are load-bearing in some sense the word was not built for. She is blunt, generous with apprentices, and sleeps in a windowless room, by preference, with the lamp lit.",
     "A crater-wall childhood, grey-eyed and shaft-raised. She was in the counting-house the day the Deep first sang and is the only surviving witness who will say plainly what the first note was: a request.",
     ["Re-seal Karvex Deep before it finishes learning the cutting-songs", "Train [[Prentice Aury Cinderkin]], whose uselessness she believes is the point"]),
    ("Brother Tallow", "male", "walking priest", "Fennel Crossing", ("The Meridian Walkers", "Road-Brother"),
     "No one remembers Brother Tallow young, including, he says cheerfully, himself. He repairs bridges, marries travelers, buries the road's unclaimed dead, and walks — always — with a gait that eats miles without hurry, as if distance had agreed to meet him halfway. In his coin-purse he carries a single coin that every shrine of Mother Meridian politely refuses. {~draft}It is the First Toll itself, and it is looking for its way home, and Tallow's endless circuit is the shape of its searching.{/~}",
     "The Walkers' rolls list his ordination date in three different centuries, each in a different clerk's hand, each apparently sincere. The order has ruled the question 'not load-bearing.'",
     ["Deliver the coin wherever it is going", "Teach [[Weir-Child Nan Fennelwick]] the road-blessing before her naming-day"]),
    ("Captain Erya Voss", "female", "captain of the Grey Company", "Duskwell", ("The Grey Company", "Contract-Captain"),
     "Erya reads every contract aloud to her assembled company before a single saber is drawn — forty clauses in the mountain wind, her voice flat as a ledger-line — because soldiers who know exactly what they owe fight better and desert never. She has commanded eleven years, lost few, and broken exactly one contract; the offending clause hangs framed above her desk, crossed out in her own blood, as both apology and warning to future employers about what she considers an unconscionable term.",
     "Mountain-born, warden-raised, and departed at seventeen down the toll road with her mother's shield and a document, self-drafted, releasing the fog from any claim on her. The wardens still debate whether it was binding. The fog has honored it.",
     ["Keep the Company off both sides of the ember question as long as the ink allows", "Visit [[Warden-Captain Douro Kest]] once a year without either of them admitting it is scheduled"]),
    ("The Kindled King", "male", "claimant to the old throne", "The Ember Gate", ("The Ashen Hand", "Prophet-Sovereign"),
     "Something walked out of the Ember Gate on the ember-tide of Year 89 wearing the old king's face, a century after the old king died, and it has been charming the after-world ever since. It remembers everyone's name — that is the frightening part — funds orphanages, settles debts, weeps convincingly at funerals, and wants, with a patience that outlasts argument, every ember of Vhezar gathered in one place. The Ashen Hand calls it majesty. The Emberfaith calls it a question. {~draft}The Pale Auditor's ledgers call it an unpaid debt, and the fog has begun drifting down-mountain, out of jurisdiction, as if to collect.{/~}",
     "The old king died in the Fall with his kingdom; contemporary accounts agree on his death and disagree on his character, which the Kindled King has noticed, and exploits, being whichever version his audience mourned.",
     ["Gather the twelfth ember — [[Vhezar's Ember]] is already his; the eleventh was the hard one", "Be loved. This one appears to be sincere, which no one finds reassuring"]),
    ("Sarl Emberlight", "male", "glass-farmer and reluctant seer", "Emberlight", None,
     "Sarl harvests dune-glass like his mothers before him, except his harvest shows tomorrow's weather in its facets, and lately other tomorrows — a fleet burning, a green banner over the Reach, a door standing open in the dunes. He is thirty, unmarried, profoundly embarrassed by all of it, and would like to be left alone with the glass, which at least has the decency to show its horrors quietly. The village keeps his gift like a savings account: unspent, accruing, and increasingly difficult to hide. Three factions already suspect.",
     "Emberlight born and raised; he inherited the strip, the cellar, and — his grandmother's phrase — 'the family squint.' She had it too. She walked into the dunes on a clear morning, and Sarl is the only one who thinks she saw exactly where she was going.",
     ["Grind the visions out of his stock before the buyers notice", "Compare facets with [[Signe Glasseye]] until the door-image resolves", "Never once be useful to the [[The Ashen Hand]]"]),
    ("Nightingale Ash", "female", "information broker", "Brinemarket", ("The Saltmere Combine", "unlisted asset"),
     "Every secret in Brinemarket passes through the Nightingale's rookery, carried by fog-crows trained to a discretion most confessors never achieve. Her prices are notorious and non-negotiable: a memory, a habit, one hour of someone's name — currencies she banks somewhere no one has found. She is small, cheerful, and dresses like a widow at a wedding. In Year 99 her rookery went silent for nine days, and when it reopened every price had changed and she had a new scar shaped like a keyhole. She sells information about everything except those nine days.",
     "Nobody has bought her origin, which is itself the most expensive fact in the market. The crows arrived with her, already trained. The rookery's oldest bird is blind, flightless, and attends every negotiation, and she defers to it.",
     ["Reacquire what was taken from her in Year 99", "Own one secret the [[The Pale Auditor]] does not"]),
]
for name, gender, occ, home, faction, body, origin, goals in MAJORS:
    create("Character", name, {"gender": gender, "occupation": occ,
                               "origin": origin, "goals": goals}, body)
    edge(name, "hometown", home)
    if faction:
        edge(faction[0], "members", name, faction[1])
log(f"{len(MAJORS)} major NPCs")

# ---------------------------------------------------------------- minor NPCs
for name, gender, occ, home, faction, rank, body, goals in MINORS:
    fields = {"gender": gender, "occupation": occ}
    if goals:
        fields["goals"] = goals
    create("Character", name, fields, body)
    edge(name, "hometown", home)
    if faction:
        edge(faction, "members", name, f"rank: {rank}")
log(f"{len(MINORS)} minor NPCs")

# family ties: hand-written, varied
FAMILY_TIES = [
    ("Odessa Saltmarsh", "Hakon Saltmarsh", "Hakon is Odessa's uncle; he taught her knots before she could walk"),
    ("Odessa Saltmarsh", "Brine-Elder Maud Saltmarsh", "Maud is Odessa's great-aunt and holds her diving license in the iron chest, 'for safekeeping'"),
    ("Tegan Saltmarsh", "Brine-Elder Maud Saltmarsh", "Maud raised Tegan after the red-sail winter"),
    ("Ffion Saltmarsh", "Odessa Saltmarsh", "cousins, co-owners of one disputed rowboat"),
    ("Vessa Cinderkin", "Foreman Jorasz Cinderkin", "Jorasz is Vessa's father; they argue about the Deep in a private shorthand"),
    ("Old Marrow Cinderkin", "Foreman Jorasz Cinderkin", "Marrow is Jorasz's uncle, the last of the singing shift"),
    ("Sable Cinderkin", "Vessa Cinderkin", "sisters; Sable runs the samples Vessa refuses to cut"),
    ("Prentice Aury Cinderkin", "Old Marrow Cinderkin", "Marrow is Aury's grandfather and their only defender at family dinners"),
    ("Notary Prin Vellowine", "Cassick Vellowine", "Prin is Cassick's elder sister; she notarized his first collection contract"),
    ("Damaris Vellowine", "Notary Prin Vellowine", "cousins; Damaris cites Prin's seals, Prin proofreads Damaris's briefs"),
    ("Wick Vellowine", "Tobin Vellowine", "brothers; Tobin makes the ink, Wick burns the oil"),
    ("Shepherd Anwen Harrowgate", "Mercy Harrowgate", "Mercy is Anwen's daughter; the fog-warden learned the mist from her mother's flock"),
    ("Bryn Harrowgate", "Gwenna Harrowgate", "Gwenna is Bryn's aunt; he quarries the blanks she carves"),
    ("Ifor Harrowgate", "Bryn Harrowgate", "brothers-in-law; the inn's roof is Bryn's finest work and Ifor's best story"),
    ("Root-Doctor Sef Mossbourne", "Ivy Mossbourne", "Ivy is Sef's niece; he packs her satchel with remedies she trades along the branch-roads"),
    ("Hesper Mossbourne", "Colm Mossbourne", "Hesper is Colm's mother; she pays his ferry-toll in smoked eel, over-generously, to embarrass him"),
    ("Briar Mossbourne", "Hesper Mossbourne", "Briar is Hesper's child; her smokehouse and their carving-shed share a wall and a feud about smoke"),
    ("Sexton Ordo Palefrost", "Una Palefrost", "Ordo is Una's father; they do not discuss the third column"),
    ("Corporal Enid Palefrost", "Sexton Ordo Palefrost", "Enid is Ordo's niece; her mother's shield hung in his hall until she came for it"),
    ("Doone Palefrost", "Marged Palefrost", "Marged is Doone's sister; she knits, he plays, the fog attends both"),
    ("Harvest-Boss Kettil Glasseye", "Signe Glasseye", "Signe is Kettil's daughter; her rejects shelf began with his burn-map"),
    ("Widow Ansa Glasseye", "Harvest-Boss Kettil Glasseye", "Ansa is Kettil's sister-in-law; her husband was his brother"),
    ("Sarl Emberlight", "Signe Glasseye", "second cousins through the Glasseye line; the squint runs on that side"),
    ("Pell-of-the-Dunes Glasseye", "Torvald Glasseye", "Torvald is Pell's father, and has never once graded their guiding"),
    ("Arbor-Judge Lira Thornwald", "Berrin Thornwald", "Berrin is Lira's brother; he grew her courtroom's bench, which she notes is slowly turning to face him"),
    ("Nightshade Thornwald", "Arbor-Judge Lira Thornwald", "Lira is Nightshade's aunt and executed both of their brief wills"),
    ("Perpetua Thornwald", "Berrin Thornwald", "married twenty years; the seed-vault's door is his one metal work"),
    ("Quartermaster Hesse Brackwater", "Auctioneer Vole Brackwater", "brothers; Vole sells what Hesse cannot source, which is nothing"),
    ("Delia Brackwater", "Finn Brackwater", "Delia is Finn's elder sister and pretends not to check his knots"),
    ("Marisol Brackwater", "Quartermaster Hesse Brackwater", "Marisol is Hesse's estranged wife; she chalk-marked his warehouse-hulk once, as a warning, during the estrangement"),
    ("Digger-Prime Halvard Cairnson", "Petros Cairnson", "Petros is Halvard's son; the bell answers the spade"),
    ("Rilla Cairnson", "Digger-Prime Halvard Cairnson", "Rilla is Halvard's sister; her iron goes into his graves"),
    ("Edda Cairnson", "Sorrel Cairnson", "Sorrel is Edda's cousin and cooks for the reading of the names, every year, all night"),
    ("Toll-Mother Bess Fennelwick", "Sister Halda Fennelwick", "sisters; Bess prices the crossing, Halda records where it was going"),
    ("Gower Fennelwick", "Weir-Child Nan Fennelwick", "Nan is Gower's granddaughter and the named eels are his fault, he admits, having started it"),
    ("Jephta Fennelwick", "Toll-Mother Bess Fennelwick", "Jephta is Bess's nephew; she taught him to price people, he declined, preferring cargo"),
    ("Deacon Ashter Emberhart", "Candle-Wife Merenn Emberhart", "married; his forge lights her dipping-room, her candles time his sermons"),
    ("Pilgrim-Master Coale Emberhart", "Deacon Ashter Emberhart", "brothers; Coale walks the circuit Ashter forges brackets for"),
    ("Ember-Clerk Sidonie Emberhart", "Gratia Emberhart", "Gratia is Sidonie's mother; the moss-word on the crater wall is Sidonie's name"),
    ("Master Gudrun Deepdelve", "Ronwen Deepdelve", "cousins; stone and snow, the family's two dialects"),
    ("Keeper Aldous Deepdelve", "Master Gudrun Deepdelve", "Aldous is Gudrun's brother; she cut his gatehouse lintel with the family mark inward"),
    ("Chandler Pryce Deepdelve", "Keeper Aldous Deepdelve", "Aldous is Pryce's uncle and pretends the whispered names are not on the requisition forms"),
    ("Ferren Deepdelve", "Ronwen Deepdelve", "Ronwen is Ferren's mother; her avalanche postings are the only data Ferren takes on faith"),
    ("Doctor Imogen Lanterly", "Barrow Lanterly", "married; her case-notes are the only modern texts he has ever bound"),
    ("Sable-of-the-Stacks Lanterly", "Barrow Lanterly", "Barrow is Sable's parent; he binds the books, they become them"),
    ("Cornelius Lanterly", "Verity Lanterly", "Verity is Cornelius's aunt; she proof-read his catalogue and marked the harbor-log '?', which keeps him up nights"),
]
for a, b, note in FAMILY_TIES:
    edge(a, "family", b, note)
log(f"{len(FAMILY_TIES)} family ties")

# cross-major relations
edge("Chancellor Ivex Callo", "family", "Archivist Pell Undertow", "siblings; the estrangement is itself under contract")
edge("Warden-Captain Douro Kest", "family", "Captain Erya Voss", "Erya is Douro's daughter; she left the mountain with a self-drafted release the fog has honored")
mcp.call("create_edge", {"from_entry_id": ids["Vellum Reach"], "field": "ruler",
                         "to_entry_id": ids["Chancellor Ivex Callo"], "annotation": ""})
mcp.call("create_edge", {"from_entry_id": ids["The Sunken Rotunda"], "field": "guarded_by",
                         "to_entry_id": ids["The Lantern Society"], "annotation": "warded, dive-licensed, earplugs mandatory"})
mcp.call("create_edge", {"from_entry_id": ids["Karvex Deep"], "field": "guarded_by",
                         "to_entry_id": ids["The Glasswrights' Union"], "annotation": "three doors and a choir of cutting-songs"})
mcp.call("create_edge", {"from_entry_id": ids["The Ember Gate"], "field": "guarded_by",
                         "to_entry_id": ids["The Kindled King"], "annotation": "he calls it 'waiting', not guarding"})

# ---------------------------------------------------------------- items & artifacts
ARTIFACTS = {
    "The Unspent Coin": ("none — it chooses", "Ashvault", "Brother Tallow",
        "The first toll ever paid to Mother Meridian, struck from no metal any assayer will commit to. Whoever carries it always finds the road they need and never the road they want — a distinction its bearers learn to respect, then to fear, then, if they carry it long enough, to love. Every shrine of the goddess refuses it with what witnesses describe as embarrassment. It is warm in the hand, and heavier at crossroads, and [[Brother Tallow]] has carried it longer than anyone knows."),
    ("Ledgerbane"): ("a sworn oath-breaker", "Vellum Reach", "Captain Erya Voss",
        "A short sword of drowned-forge steel that cannot cut anyone who has kept every promise they ever made. In a century of use it has never once failed to cut. The Grey Company holds it as regimental property and awards it to each new contract-captain with the same grim toast — 'may it go dull in your hand' — and [[Captain Erya Voss]] wears it with the edge peace-bonded, out of what she calls realism about her correspondence backlog."),
    ("The Dreaming Pane"): ("glasswrights only", "Ashvault", "Glassmother Oruna Veck",
        "The first and only sheet of dreaming comet-glass, shaped by [[Glassmother Oruna Veck]] before anyone understood what shaping meant. Sleepers within thirty feet share one dream, communal and continuous, which the Union monitors in shifts and describes in minutes that are themselves becoming strange. Lately the dream has a doorway in it. Lately the doorway is closer. The Pane is kept in a vault, under wool, awake."),
    ("Vhezar's Ember"): ("forbidden", "Cindral", "The Kindled King",
        "A fist-sized fragment of the comet's heart that is still, by every instrument the Lantern Society dares point at it, falling — in some direction no compass names, at a speed no clock can hold. It warms the unworthy hand and burns the worthy one, a diagnostic the Emberfaith finds theologically intolerable. The Ashen Hand gathered eleven embers over sixty years. This is the twelfth, and [[The Kindled King]] carries it the way other men carry a pocket watch."),
    ("The Auditor's Bell"): ("the grieving", "Highcairn", "Warden-Captain Douro Kest",
        "A hand-bell of grave-iron, voiced in a foundry that no longer exists, by a method its maker's notes call 'listening backward.' Rung once, it tells the ringer whether a dead name has been collected by the fog — a clean tone for yes, silence for not yet. Rung twice, it tells the fog where you are. The Cairn Wardens keep it in a felt-lined box with a two-warden lock, and [[Warden-Captain Douro Kest]] carries both keys, against regulation, for reasons the regulation was not written to survive."),
    ("The Nightingale's Ledger"): ("paid in kind", "Brinemarket", "Nightingale Ash",
        "A book bound in weather-grey leather that lists every secret its owner has ever sold — and, on the facing pages, in a hand nobody taught it, what each buyer did with their purchase. The entries do not stop at the sale. [[Nightingale Ash]] reads the facing pages the way other brokers read markets, and prices accordingly, and there are debts in that book compounding in currencies that have no exchange rate. The keyhole-shaped scar she acquired in Year 99 fits nothing in the rookery. It fits the Ledger's clasp."),
}
for name, (att, forged, wielder, body) in ARTIFACTS.items():
    create("Artifact", name, {"kind": "artifact", "attunement": att}, body)
    mcp.call("create_edge", {"from_entry_id": ids[name], "field": "forged_in",
                             "to_entry_id": ids[forged], "annotation": ""})
    edge(name, "wielder", wielder)

ITEMS = {
    "Fog-crow whistle": ("tool", "Brinemarket", "Bone whistle tuned to one specific crow, who hears it at any distance and decides, independently, whether the summons is worth answering. The rookery sells them with a card explaining that the relationship is the product."),
    "Ember-tide charts": ("document", "Cindral", "Tide-tables for the crater's glass dunes, compiled by the Emberfaith and corrected in the field by whoever survives the errata. Wrong twice a year, in a pattern that would itself be valuable, if anyone lived to chart it."),
    "Chained folio, unopened": ("book", "The Chained Library", "A quarto volume in good condition whose chain is conspicuously newer than its binding. Someone re-shackled it after the Fall, with care, from the outside. The title has worn off, or been helped off. It is warm on the spine-side, like a sleeping cat."),
    "Meridian shrine-coin": ("token", "Fennel Crossing", "The coin no one dares spend: standard issue at every crossroads shrine, minted by no one, always exact change for something. Taking it is easy. Roads treat you differently afterward, and not worse, which is somehow the unsettling part."),
    "Glasswright's cutting-song": ("document", "Ashvault", "Sheet music in the Union's own notation, four staves, one of which is marked 'breath, held.' The Deep's glass veins split cleanly along the third harmony. The margins carry generations of penciled fingerings and one inked instruction: never hum it idle."),
    "Eel-farmer's toll receipt": ("document", "Fennel Crossing", "Proof of passage stamped by Brother Tallow in fading road-dust ink. Collectors prize the older stamps, which differ year to year in ways that, laid side by side, animate: a tiny figure, walking."),
    "Funerary road toll-marker": ("token", "Cairnfoot", "A grave-iron disc, palm-sized, stamped with the bearer's name and the standard rate. The fog honors it, mostly. The 'mostly' is why Cairnfoot's smiths stamp the name deep."),
    "Salvaged senate gavel": ("relic", "The Sunken Rotunda", "Recovered by Lantern Society divers and returned within the month by unanimous vote of everyone who slept in the building it was stored in. It bangs itself once at low tide, calling a session no one attends. Currently on a shelf in the Rotunda's dry gallery, facing the water, where it seems calmest."),
    "Green Choir seed-prayer": ("token", "Greenhollow", "A prayer written on a seed-husk in the Choir's planting script. Burying it is the asking; what grows is the answer; the gardener's own patience is the price. The Choir issues them freely and redeems no complaints."),
    "Grey Company standard contract": ("document", "Duskwell", "Forty clauses, Saint Ledger's seal, and one blank line that fills itself in — always with a term the signatories forgot to want, always binding, always fair. Company lawyers call it clause forty-one. Employers call it the reason the Company's word is good."),
    "Palegrave mourning veil": ("clothing", "Highcairn", "Woven fog-grey wool, worn for the mourning-year. The dead cannot see through it, which is its mercy; the living should not try, which is its warning. Highcairn's weavers make them in one width, having learned that grief does not come in sizes."),
    "Wreck-light lantern": ("tool", "Wreck of the Lantern-Bearer", "A ship's lantern that burns the same cold blue as the flagship's crow's nest, and only when carried by someone keeping a watch someone else abandoned. It is never lit by hand. Coastal families lend it the way other families lend a good name."),
}
for name, (kind, loc, body) in ITEMS.items():
    create("Item", name, {"kind": kind}, body)
    edge(name, "location", loc)
log(f"{len(ARTIFACTS)} artifacts, {len(ITEMS)} items")

# ---------------------------------------------------------------- events
EVENTS = [
    ("The Night of Falling Embers", "Year 0 — the Fall", "The Cinderwastes",
     [("Vhezar, the Broken Lantern", "the comet itself")],
     "The comet Vhezar came apart in the high dark and fell across a night that lasted three days. The old kingdoms burned, drowned, or vanished; the survivors' first shared act was counting, and every calendar of the after-world counts from this. What broke the comet — if anything did — remains the after-world's largest open question, and its most dangerous, since the Ashen Hand believes it has the answer and the answer wants finishing."),
    ("The Drowning of the Rotunda", "Year 0, third day of the Fall", "The Sunken Rotunda",
     [("Archivist Pell Undertow", "recovered the record, a century later")],
     "The Fall's great wave took the senate mid-session, in the middle of the evacuation debate. The motion had just failed by two votes. The building has been re-arguing it at every low tide since, and divers report the margin never changes, which the Ledger-Court's philosophers cite variously as a lesson about procedure, about pride, or about the sea's opinion of both."),
    ("The First Toll", "Year 4 AE", "Fennel Crossing",
     [("Brother Tallow", "paid it"), ("Mother Meridian", "collected it")],
     "The roads after the Fall belonged to wolves, slavers, and worse, until someone stood at the Fennel ford and paid for them — all of them, at once, in a currency the accounts refuse to specify. The roads have been passable since. What Brother Tallow rendered that morning is the Walkers' deepest secret and possibly Tallow's too; the coin in his purse is generally believed to be the change."),
    ("Founding of the Ledger-Court", "Year 12 AE", "Vellum Reach",
     [("Saint Ledger", "his ledgers were the founding texts"), ("The Ledger-Court", "founded")],
     "Refugee clerks in a burned customs house, lacking a king and unwilling to invent one, ruled instead that a fair contract outranks a crown — and made it stick by being the only people in the ruins who could prove who owned what. The Court has held for eighty-eight years on that single audacity. Its founding bench was salvaged senate furniture, still salt-stained, kept deliberately unrestored as a memorandum about where governments end up."),
    ("The Glass Concord", "Year 31 AE", "Ashvault",
     [("The Glasswrights' Union", "signatory"), ("Glassmother Oruna Veck", "negotiated as a journeyman")],
     "The Concord gave the Union sole rights to the crater's glass, and gave everyone else something harder to draft: the Union's sworn undertaking to keep sealed whatever had started singing back in Karvex Deep. The negotiation's minutes run to nine hundred pages; the operative clause runs to eleven words. Oruna Veck, then a journeyman, wrote the eleven words, and has spent the rest of her life keeping them."),
    ("The Green Swallowing", "Year 44 AE", "Thornmaw Palace",
     [("The Gardener Below", "acted, or slept restlessly"), ("The Green Choir", "interpreted")],
     "The Green Queen's palace vanished under jungle in a single night of growth — walls, court, and dinner party entire. The Choir ruled it mercy and has never specified for whom. {~draft}The Queen's guests are, by several sober accounts, still seated in the amber sap, mid-toast, and the toast, readable on their lips, is to long life.{/~}"),
    ("The Fog Census", "Year 58 AE", "The Palegrave Peaks",
     [("The Pale Auditor", "conducted"), ("The Cairn Wardens", "assisted under duress")],
     "For one night, from dusk-bell to dawn, the mountain fog spoke every name it had ever collected, in order, in the voices of the collected. The wardens' standing instruction — record nothing, the mountain's business is its own — lasted eleven minutes against the sound of the valley's grandmothers. Cairnfoot lit lanterns and transcribed 4,411 names before sunrise cut the reading short. The fog has never explained. The clans have never asked. The list is kept."),
    ("The Brinemarket Compact", "Year 71 AE", "Brinemarket",
     [("Admiral Coa Brack", "enforced it"), ("The Saltmere Combine", "profited")],
     "A hundred smuggler captains, wedged into one gun-deck by a storm none of their feuds could outshout, agreed on exactly one law: the market itself is neutral ground. The Compact is unwritten, unsigned, and the most perfectly observed statute on the coast. Violations to date: three. Survivors of violations: none. The Combine's law students are taken to the mast where the Compact was spoken and told, accurately, that they are looking at the whole statute book."),
    ("Return of the Kindled King", "Year 89 AE", "The Ember Gate",
     [("The Kindled King", "returned"), ("The Ashen Hand", "was waiting")],
     "On the ember-tide of Year 89 the Gate lit from the inside — witnesses describe a corridor, and a figure a long way down it, walking unhurried — and the old king stepped out smiling into a crowd of Ashen Hand faithful who had, somehow, known to bring a coat in his size. He remembered every pilgrim's name. He asked after their families, correctly. It was, survivors agree, the warmest thing that has ever frightened them."),
    ("The Eleventh Ember", "Year 97 AE", "Karvex Deep",
     [("The Ashen Hand", "stole it"), ("The Glasswrights' Union", "will not say what it was guarding")],
     "The Hand breached the sealed galleries through a shaft no survey shows, bypassed three doors without opening them, and left with a lead-wrapped burden the size of a heart. Union casualties: none, which Oruna Veck considers the most alarming detail — the Deep let them through. The seals were doubled, the cutting-song choir went to continuous rotation, and the Deep, for the first time in sixty years, changed key."),
    ("The Nightingale's Silence", "Year 99 AE", "Brinemarket",
     [("Nightingale Ash", "went silent for nine days")],
     "For nine days no secrets moved in Brinemarket: the rookery shuttered, the crows grounded, the market's whole nervous system numb. Deals collapsed; two houses fell; a third rose on the simple advantage of having nothing to hide. When the rookery reopened, every price had changed, the blind old crow had moved to the Nightingale's shoulder, and she had a new scar shaped like a keyhole. The nine days are the only commodity she has never offered for sale."),
    ("The Audit of Duskwell", "Year 100 AE", "Duskwell",
     [("The Pale Auditor", "walked the streets in person"), ("Captain Erya Voss", "escorted it, by contract")],
     "The Auditor came down from the fogs on foot, in office hours, and walked Duskwell's rings for a day counting something — doors, by the pattern of its pauses. The Grey Company's escort contract, drafted overnight by lamplight, is the only document known to bear the Auditor's mark: a thumbprint in frost that has not melted. It counted, thanked the town with a bow, and left. {~draft}The count was short by one door, and the Auditor knows which, and the well has been three degrees warmer ever since, like a held breath.{/~}"),
    ("The Present Unrest", "Year 101 AE — now", "Vellum Reach",
     [("Chancellor Ivex Callo", "holds the center"), ("The Kindled King", "makes generous offers"), ("The Lantern Society", "counts missing embers")],
     "Eleven embers gathered, the eleventh stolen from under the Union's seals, and the twelfth riding in a dead king's pocket. The Ledger-Court drafts contingencies it does not name in session; the Emberfaith's seven forges have quietly moved to a war footing of prayer; the Lantern Society's actuaries have produced a date. The after-world built itself out of the last Fall's wreckage in a century. It is increasingly, quietly certain it is being asked whether it would like to try for a faster time."),
]
for name, date, loc, participants, body in EVENTS:
    create("Event", name, {"date": date}, body)
    edge(name, "location", loc)
    for p, note in participants:
        edge(name, "participants", p, note)
log(f"{len(EVENTS)} events")

# ------------------------------------------------------- statuses & revisions
def canon(title, **scope):
    mcp.call("mark_canon", {"entry_id": ids[title], **scope})

minor_names = [m[0] for m in MINORS]
full_canon = (list(REGIONS) + list(CITIES) + list(VILLAGES) + list(RUINS)
              + list(DEITIES) + list(FACTIONS) + list(ITEMS) + list(ARTIFACTS)
              + [e[0] for e in EVENTS if "{~draft}" not in e[4]]
              + [m[0] for m in MAJORS if "{~draft}" not in m[5]])
for t in full_canon:
    canon(t)
for t in [m[0] for m in MAJORS if "{~draft}" in m[5]] + [e[0] for e in EVENTS if "{~draft}" in e[4]]:
    canon(t, fields=["gender", "occupation", "origin", "goals", "date"], edges=True)
for j, name in enumerate(minor_names):
    if j % 2 == 0:
        canon(name)
log("statuses applied")

# canon-protection demo: the bare AI edit must be refused, then the same
# edit succeeds under user-directed canon_override.
try:
    mcp.call("update_entry", {"entry_id": ids["Vellum Reach"], "fields": {"population": 43500}})
    log("ERROR: canon protection did not fire")
except RuntimeError as e:
    log(f"canon protection demo (expected refusal): {str(e)[:80]}")

# revisions + field-level AI-draft on canon entries (with override = the
# user directed this fixture build)
for title, patch in [
    ("Vellum Reach", {"canon_override": True, "fields": {"population": 43500}}),
    ("Brinemarket", {"canon_override": True, "fields": {"kind": "floating city"}}),
    ("Sarl Emberlight", {"canon_override": True, "body_md": "Sarl harvests dune-glass like his mothers before him, except his harvest shows tomorrow's weather in its facets, and lately other tomorrows — a fleet burning, a green banner over the Reach, a door standing open in the dunes. He is thirty, unmarried, profoundly embarrassed by all of it, and would like to be left alone with the glass, which at least has the decency to show its horrors quietly. The village keeps his gift like a savings account: unspent, accruing, and increasingly difficult to hide. Three factions already suspect. This season the facets have begun showing the door with someone standing in it."}),
]:
    mcp.call("update_entry", {"entry_id": ids[title], **patch})

w = mcp.call("update_entry", {"entry_id": ids["Nightingale Ash"],
                              "fields": {"favorite_secret": "unknown, obviously"}})
log(f"soft warning demo: {w.get('warnings')}")

tmp = mcp.call("create_edge", {"from_entry_id": ids["Brother Tallow"], "field": "family",
                               "to_entry_id": ids["The Kindled King"], "annotation": "surely not"})
mcp.call("delete_edge", {"edge_id": tmp["edge"]["id"]})

hits = mcp.call("find_relevant", {"world_id": WID, "query": "comet glass mining",
                                  "near": [ids["Ashvault"]], "limit": 5})
log("search:", [(round(h["score"], 2), h["title"]) for h in hits])

summary = mcp.call("list_entries", {"world_id": WID})
from collections import Counter
log("totals:", dict(Counter(e["type_name"] for e in summary)))
log("statuses:", dict(Counter(e["status"] for e in summary)))
log(f"WORLD_ID={WID}")
log(f"mcp calls: {mcp.calls}, errors: {len(mcp.errors)}")
