# Minor NPCs of Emberfall — every name unique, every biography written
# individually. Format: (name, gender, occupation, home, faction, rank,
# body, goals) where faction/rank/goals may be None.

MINORS = [
    # --- The Saltmarsh family, Saltwhistle (salvage-folk) ---
    ("Odessa Saltmarsh", "female", "salvage diver", "Saltwhistle", "The Saltmere Combine", "sworn",
     "Odessa free-dives the drowned streets south of the cliffs, where the old promenade lamps still stand in twenty feet of green water. She works by feel and by memory, having mapped more of the sunken town than any chart the Combine owns, and she surfaces with brass, coin, and — twice now — sealed letters that she will not sell. Ask about the letters and she orders another drink and talks about the weather.",
     ["Find the writer of the sealed letters, or their grave", "Buy her own boat out from under the [[The Saltmere Combine]] lien"]),
    ("Hakon Saltmarsh", "male", "cliff-rigger", "Saltwhistle", None, None,
     "The whistling cliffs eat rope the way goats eat washing, and Hakon splices what they leave. He is broad, patient, mostly deaf from a childhood fever, and reads lips in three languages. Sailors treat his silences as wisdom. In fact he is usually thinking about his supper, which he takes seriously, and about his niece Odessa, whom he taught to knot before she could walk.", None),
    ("Brine-Elder Maud Saltmarsh", "female", "village elder", "Saltwhistle", None, None,
     "Maud has buried two husbands, one Combine tax-collector, and — she is careful with the phrasing — 'no one who didn't need it.' She keeps Saltwhistle's ledgers, marriages, and grudges in the same iron chest. When the wind plays the cliffs at midwinter she stands at the edge with her hat off, listening for a note she says the village owes her.", None),
    ("Tegan Saltmarsh", "nonbinary", "net-mender", "Saltwhistle", "The Meridian Walkers", "initiate",
     "Youngest of the family and the only one who prays. Tegan walked the coast road to Fennel Crossing at fifteen, came back with a shrine-coin on a cord and a calm that unsettles their relatives, and has mended nets ever since with the concentration of a monk illuminating scripture. The nets they mend catch more. Nobody discusses this.", None),
    ("Ffion Saltmarsh", "female", "smuggler", "Saltwhistle", "The Saltmere Combine", "unlisted",
     "Ffion runs a shallow-draft ketch called *Polite Fiction* through the reef passages on moonless nights. Her manifest always says salt cod. It has never once been salt cod. She is saving against the day her luck runs out, and the sum she considers sufficient keeps growing, which her aunt Maud says is how the sea tells you it already owns you.",
     ["Retire before the Combine audits the *Polite Fiction*"]),

    # --- The Cinderkin family, Ashvault (glass-miners) ---
    ("Foreman Jorasz Cinderkin", "male", "mine foreman", "Ashvault", "The Glasswrights' Union", "elder",
     "Jorasz has worked the crater veins for forty years and lost three fingers, one brother, and — he insists — nothing else to them. He can tell by lantern-light which glass will sing and which will shatter, and he pulls his crews out hours before the surveys say to. The young miners joke that the Deep is afraid of him. Jorasz does not laugh at this joke.", None),
    ("Vessa Cinderkin", "female", "glass-cutter", "Ashvault", "The Glasswrights' Union", "journeyman",
     "Where her father Jorasz reads the veins, Vessa reads the finished glass. Her cuts follow flaws so fine that other cutters call them imaginary, and her panes ring true in any frame. She has begun, privately, to notice that her best work shows faint scenes in strong sunlight — a road, a gate, a walking figure — and she has begun, privately, to work worse on purpose.",
     ["Understand the scenes in the glass without telling the [[The Glasswrights' Union]]"]),
    ("Old Marrow Cinderkin", "male", "retired miner", "Ashvault", None, None,
     "Marrow was in Karvex Deep the day it started singing, and he is the only man of that shift who still sleeps well. He spends his pension at the crater-wall taverns telling the story differently every time — sometimes the glass sang a lullaby, sometimes a debt-collector's knock, once (only once, and he was very drunk) he said it sang his mother's voice asking to be let out.", None),
    ("Sable Cinderkin", "female", "ember-tide runner", "Ashvault", None, None,
     "When the dunes cool, someone has to carry the first samples from the far fields to the assay office, and that someone is Sable, who runs the glass like other people run meadows. She wears cork-soled boots of her own design and holds the unofficial record: Emberlight to Ashvault in nine hours. There is no official record. The Union discourages the sport on the grounds that the dunes are a workplace.", None),
    ("Prentice Aury Cinderkin", "nonbinary", "apprentice glasswright", "Ashvault", "The Glasswrights' Union", "initiate",
     "Aury is sixteen, talks too much, and is the first Cinderkin in three generations that the glass does not like — their cuts wander, their panes cloud. Glassmother Oruna keeps them on anyway, which everyone finds mysterious except Oruna, who has noticed that when Aury sweeps the workshop, the dreaming pane in the vault stops murmuring.", None),

    # --- The Vellowine family, Vellum Reach (clerks and worse) ---
    ("Notary Prin Vellowine", "female", "notary public", "Vellum Reach", "The Ledger-Court", "sworn",
     "Prin's seal is among the most trusted in the Reach, which is why three separate trade houses have tried to buy it, rent it, or steal it. Her office above the fish market smells of wax and lemon oil, and her testimony has ended four careers. She reads romances of the pre-Fall court, keeps a fencing sabre behind the door, and has used both.", None),
    ("Cassick Vellowine", "male", "debt collector", "Vellum Reach", "The Ledger-Court", "journeyman",
     "Soft-spoken, immaculate, unfailingly polite: Cassick collects for the Court and has never once raised his voice, because a man who knows exactly what you owe rarely needs to. He carries a copy of every contract he enforces and reads the relevant clause aloud on the doorstep. Doors open. His sister Prin says he was a shrieking terror as a child and became calm the day he learned to read.", None),
    ("Wick Vellowine", "male", "lamplighter", "Vellum Reach", None, None,
     "The paper lanterns of the Reach are supposed to be self-tending, and mostly are, but the harbor fog drowns a few each night and Wick rows out to relight them. He knows which lantern marks a sunken bell-tower, which one drifts, and which one — the blue one, past the mole — was never hung by anyone the harbor-master employs. He relights that one too. It seems only fair.", None),
    ("Damaris Vellowine", "female", "contract lawyer", "Vellum Reach", "The Ledger-Court", "sworn",
     "Damaris argues before the Ledger-Court in a voice like a paper-knife and has made partner in a firm that did not previously admit women, natives of the fish-market district, or anyone under forty. She is all three. Her filed briefs cite Saint Ledger's original marginalia, which she has somehow read, and opposing counsel have learned to settle.",
     ["Trace how the firm's founding charter was notarized three days before the Fall", "Argue once before [[Chancellor Ivex Callo]] and win"]),
    ("Tobin Vellowine", "male", "ink-maker", "Vellum Reach", "The Lantern Society", "initiate",
     "Tobin grinds pigments in a cellar and supplies half the Court's chambers, but his passion is recovered pre-Fall recipes: iron gall that outlasts empires, blue-black from drowned oak. The Lantern Society pays him to reproduce inks so archivists can date forgeries. Lately a buyer he has never met orders a red he cannot source the recipe for, and pays too well for him to ask questions he asks anyway.", None),

    # --- The Harrowgate family, Greyharrow (slate and sheep) ---
    ("Shepherd Anwen Harrowgate", "female", "shepherd", "Greyharrow", None, None,
     "Anwen grazes the high pastures right to the fog-line, closer than anyone else dares, because the flock knows the fog's moods better than any warden and she trusts the flock. She carries a sling, a harrowstone chip that hums when the mist thickens, and a private tally: seventeen springs on the mountain, four sheep lost, none to the fog. Wolves, she says, are at least honest.", None),
    ("Bryn Harrowgate", "male", "slate-splitter", "Greyharrow", None, None,
     "Bryn's quarry sits below the funerary road, and by ancient custom he downs tools whenever a procession passes, cap off, until the bell fades. He splits slate so clean the pieces look sawn, roofs half the Palegrave, and once carved a headstone free of charge for a stranger the fog left at the village gate. His wife says the stranger's name changed overnight. Bryn re-carved it without comment.", None),
    ("Mercy Harrowgate", "female", "fog-warden", "Greyharrow", "The Cairn Wardens", "sworn",
     "The youngest sworn warden in a generation, Mercy patrols the harrowstone line above the village with a bell, a ledger, and a temper her captain calls 'clarifying.' She has turned back eleven travelers who tried the pass at dusk and dragged two out by the collar. Both sent letters of thanks. She keeps the letters in her coat, against the day the fog finally argues back.",
     ["Earn a posting on the high tolls under [[Warden-Captain Douro Kest]]"]),
    ("Ifor Harrowgate", "male", "innkeep", "Greyharrow", None, None,
     "The Split Slate is the last warm room before the high passes, and Ifor runs it on a simple rule: any traveler may sleep by the fire, but no one goes up the mountain after the second bell, and he has barred the door with his own body to enforce this. He brews dark beer, remembers every guest, and sets one table each night that no one is allowed to clear until morning.", None),
    ("Gwenna Harrowgate", "female", "harrowstone carver", "Greyharrow", None, None,
     "The humming stones that ring the village were carved by somebody, and in this generation that somebody is Gwenna, who apprenticed to her grandmother and learned the angles that catch the mountain's voice. New stones take her a season each. She is teaching no one, not from spite but because no child of the village can yet hold still long enough, and she is starting to worry about it.", None),

    # --- The Mossbourne family, Mosshaven (bone-town) ---
    ("Root-Doctor Sef Mossbourne", "male", "herbalist", "Mosshaven", "The Green Choir", "journeyman",
     "Sef doctors the village from a pharmacopoeia that grows on the great ribs themselves — mosses that knit cuts, a lichen tea for grief. The Choir taught him which harvests require asking first. He asks always, aloud, politely, and village children follow him on his rounds specifically to hear a grown man saying good morning to a wall of fur-covered bone.", None),
    ("Briar Mossbourne", "nonbinary", "beast-bone carver", "Mosshaven", None, None,
     "Briar carves combs, dice, and flutes from the fallen chips of the great skeleton — never cutting, only gathering what the beast sheds the way a forest sheds branches. Their flutes have a low double note that other bone cannot make. A Brinemarket dealer offered them a year's wages for exclusive supply, and Briar, who had been to Brinemarket exactly once, said no in a way that ended the conversation.", None),
    ("Hesper Mossbourne", "female", "eel-wife", "Mosshaven", None, None,
     "Hesper keeps eel-weirs in the slow water beneath the beast's shadow, and her smokehouse feeds the village through the wet season. She is loud, generous, unbeaten at cards, and the person Mosshaven actually consults before doing anything the Choir might notice. Her price for advice is fixed: one hour of scaling fish, during which she talks and you listen.", None),
    ("Colm Mossbourne", "male", "ferryman", "Mosshaven", "The Meridian Walkers", "initiate",
     "Colm poles the reed-ferry across the Throat's brown river, a crossing old enough that Mother Meridian claims it, which makes Colm technically clergy — a fact he mentions to every passenger, delighted, as if it had just happened. He takes coin, gossip, or verses in payment. The verses he writes into the ferry's hull, which is now more poem than boat and floats anyway.", None),
    ("Ivy Mossbourne", "female", "canopy-runner", "Mosshaven", "The Green Choir", "initiate",
     "Ivy carries messages through the branch-roads between Mosshaven and Greenhollow, three days of climbing that she does in two. The Choir gave her the routes when she was twelve and the jungle has never once touched her, which the Choir finds significant and Ivy finds convenient. She sleeps in the crooks of glowing trees and claims, credibly, to have seen the canopy bloom in patterns that answered her humming.",
     ["Map a branch-road no Choir voice has walked", "Learn what the canopy is spelling"]),

    # --- The Palefrost family, Duskwell ---
    ("Sexton Ordo Palefrost", "male", "sexton", "Duskwell", "The Cairn Wardens", "journeyman",
     "Ordo digs Duskwell's graves shallow and its cellars deep, as mountain custom requires, and can explain the reasoning for an hour if permitted. He rings the well-bell at dusk, keeps the town's death-registry in a hand like frost ferns, and leaves a lit stub candle on the sill of the warden-house every night for Captain Voss's company, 'so the contract knows where to come home to.'", None),
    ("Una Palefrost", "female", "well-keeper", "Duskwell", None, None,
     "The well that never freezes has a keeper, and the keeper is Una, who lowers the measuring-line each dawn and records temperature, depth, and — since the Audit — a third column she declines to name. She is brisk, kind, and impossible to draw on the subject. The town has noticed that she started her third column the morning after the Pale Auditor left, and that she now wears her hair over one ear.", None),
    ("Corporal Enid Palefrost", "female", "mercenary", "Duskwell", "The Grey Company", "sworn",
     "Enid joined the Company at nineteen with her mother's shield and a temper she has since filed down to something useful. She reads every contract twice, as trained, and keeps a private list of clauses she considers cursed — phrases that appear in jobs that go wrong. Captain Voss has started consulting the list. Enid pretends this is a burden.", None),
    ("Doone Palefrost", "male", "tavern musician", "Duskwell", None, None,
     "Doone plays the cold-harp at the Last Lamp, songs from before the Fall that he learned from a book of notation nobody else can read. On still nights the fog comes down to the town's edge while he plays and hangs there, listening, and leaves when he stops. The Last Lamp's owner pays him double to keep playing until dawn on the nights the fog arrives.", None),
    ("Marged Palefrost", "female", "toll-gate clerk", "Duskwell", "The Cairn Wardens", "initiate",
     "Marged stamps passage-papers at the lower gate with the fixed courtesy of someone who has heard every possible argument about the toll and been moved by none of them. She knits between travelers. The scarves pile up in the gatehouse until autumn, when she gives them to the season's first shivering pilgrim with a lecture about mountain weather that is, itself, warming.", None),

    # --- The Glasseye family, Emberlight ---
    ("Harvest-Boss Kettil Glasseye", "male", "glass-farm boss", "Emberlight", None, None,
     "Kettil calls the night harvests: when the dunes cool, whose strip runs first, when the ember-tide charts can be trusted and when they lie. He has the burn-map of a wrong call on his left arm and consults it, openly, before every decision — 'asking the mistake,' he calls it. Emberlight has lost no one to the tides in the eleven years since he took the horn.", None),
    ("Signe Glasseye", "female", "lens-grinder", "Emberlight", "The Glasswrights' Union", "journeyman",
     "Signe grinds dune-glass into lenses that the Union sells to navigators and the Lantern Society, and keeps her rejects — the ones with faint internal stars — on a shelf she calls the night sky. Her far-seer lenses show things a half-breath before they happen, too slight to sell, too strange to ignore. She and her cousin Sarl have begun comparing notes by lamplight, quietly.",
     ["Grind a lens that shows a full minute ahead", "Keep [[Sarl Emberlight]]'s gift out of faction hands"]),
    ("Pell-of-the-Dunes Glasseye", "nonbinary", "dune-guide", "Emberlight", None, None,
     "Not to be confused with the archivist in the Reach, which they find perpetually funny. Pell walks buyers, pilgrims, and the occasional fool out among the glass at safe hours, roped together like mountaineers. Their rule is absolute: you carry out what you carry in, and you take nothing that sings. Two clients have broken the second rule. Pell speaks of neither, and takes no bookings in the month of the ember-tide.", None),
    ("Widow Ansa Glasseye", "female", "charm-maker", "Emberlight", None, None,
     "Ansa strings dull glass beads against nightmares, wind-chimes against staleness, and — since her husband walked into the dunes on a clear morning eight years ago — small grey pendants she gives to travelers, free, that grow warm near the Ember Gate. She does not explain them. The Emberfaith has twice sent clergy to ask about them, and both times Ansa fed them supper and told them nothing.", None),
    ("Torvald Glasseye", "male", "assayer", "Emberlight", "The Glasswrights' Union", "sworn",
     "Torvald weighs, grades, and stamps every harvest before it ships to Ashvault, and his stamp has never been questioned, which he considers his life's work in four words. He is meticulous, humorless about scales, and privately keeps the most beautiful flawed piece from each season in a drawer he thinks nobody knows about. Everybody knows. The village finds it endearing.", None),

    # --- The Thornwald family, Greenhollow ---
    ("Arbor-Judge Lira Thornwald", "female", "magistrate", "Greenhollow", "The Green Choir", "sworn",
     "Disputes in Greenhollow are heard beneath the oldest banyan, and Lira hears them — property lines that move with the trees, marriages, the peculiar torts of a city that grows. Her sentences favor restitution planted in soil: an orchard for an arson, a bridge for a broken oath. Appeals go to the canopy itself, via the Choir, and the canopy has upheld her every ruling but one, which she still thinks about.", None),
    ("Berrin Thornwald", "male", "graft-wright", "Greenhollow", None, None,
     "Houses in Greenhollow are trained, not built, and Berrin is the best trainer living — he can persuade a banyan to grow a staircase in six years, a spiral one in nine. He talks to his commissions constantly, gossips to them, apologizes when he must cut. His masterwork, the Whistling Gallery on the third terrace, plays chords in a north wind and is, structurally, one enormous flute he grew around a rumor.", None),
    ("Nightshade Thornwald", "nonbinary", "poison-taster", "Greenhollow", "The Green Choir", "journeyman",
     "The jungle feeds Greenhollow and occasionally tries to kill it, and Nightshade tells the difference — a taster trained by the Choir to read the Throat's new fruits, which appear each season as the ember-changed canopy keeps inventing. They have died twice, briefly, by their own account, and describe the experience as 'informative.' New fruit goes to Nightshade first. This is law.", None),
    ("Fenwick Thornwald", "male", "bridge-warden", "Greenhollow", None, None,
     "The root-bridges between terraces are alive, and Fenwick knows each one's temper: which sags in the rains, which dislikes crowds, which one — the Lowspan — genuinely hates goats and must be apologized to after market days. He posts the day's crossings at dawn in chalk. Visitors laugh at the notices until they watch the Lowspan shrug a goat-cart into the river with what witnesses agree was deliberation.", None),
    ("Perpetua Thornwald", "female", "seed-archivist", "Greenhollow", "The Lantern Society", "journeyman",
     "Perpetua keeps the seed-vault: clay pots of every cultivar the Verdant Throat has produced since the Fall, and — the pride of the collection — forty-one seeds from before it, viable, waiting. The Lantern Society funds her; the Green Choir watches her; the two arrangements are not comfortable. She has planted exactly one pre-Fall seed in her life. She will not say what came up.",
     ["Catalogue the ember-changed cultivars before they drift again", "Decide, finally, about the other forty seeds"]),

    # --- The Brackwater family, Brinemarket ---
    ("Quartermaster Hesse Brackwater", "male", "quartermaster", "Brinemarket", "The Saltmere Combine", "elder",
     "Hesse runs supply for the Admiral's legitimate fleet, which everyone understands to mean both fleets, and can source anything afloat in three days: rope, mercury, a chaplain, a small cannon with paperwork. His warehouse-hulk is lashed at the market's exact center, which is also, not coincidentally, the driest spot in Brinemarket. He collects ship's figureheads and treats them as staff.", None),
    ("Delia Brackwater", "female", "rope-walker", "Brinemarket", None, None,
     "The fastest way across Brinemarket is the high lines, and Delia crosses them at a run with cargo on her back — documents, medicine, once a live and furious goose. Between runs she holds court at the mast-top platforms, where the fog-crows gather near her and, the rookery-keepers note sourly, tell her things for free that Nightingale Ash sells at a premium.", None),
    ("Auctioneer Vole Brackwater", "male", "auctioneer", "Brinemarket", "The Saltmere Combine", "sworn",
     "Vole's voice can hold three hundred bidders and his hammer has settled cargoes worth more than most towns. His genius is the pause — the half-second in which a room decides what a thing is worth — and his private ledger of what sold for far too much, and to whom, and why they wanted it, is the kind of document Nightingale Ash has standing offers on. He is saving it for retirement. One way or another.", None),
    ("Marisol Brackwater", "female", "hull-witch", "Brinemarket", None, None,
     "Every lashed-together city needs someone who knows where it is weakest, and Marisol walks the waterline daily, tapping hulls, listening, condemning planks with a chalk mark no captain dares scrub off. She learned the trade from the shipwrights of the drowned coast and adds to it something unteachable: she dreams of leaks before they open. The market council pays her in silence and mooring rights.", None),
    ("Finn Brackwater", "male", "crow-boy", "Brinemarket", None, None,
     "Finn is eleven, feral in a professional way, and employed by no one, which in Brinemarket is a job title. He runs messages the high lines can't take, knows which hulls connect below the waterline, and feeds the fog-crows scraps against future favors, a practice he invented himself and which the Nightingale's rookery-keepers observe with something between amusement and alarm.", None),

    # --- The Cairnson family, Cairnfoot ---
    ("Digger-Prime Halvard Cairnson", "male", "master gravedigger", "Cairnfoot", "The Cairn Wardens", "elder",
     "Every family in Cairnfoot digs, and the Cairnsons dig first. Halvard sets the season's plots by a reckoning of frost, stone, and precedent that takes him three days and a bottle. He has dug for paupers with the same care as for merchant princes, which the mountain is believed to notice, and he can tell from the first spade-cut whether a grave will 'sit quiet.' His record on this is perfect and unwelcome.", None),
    ("Rilla Cairnson", "female", "grave-goods smith", "Cairnfoot", None, None,
     "Rilla forges the iron tokens the dead carry up the funerary roads — toll-markers, name-discs, small locks for the memories the family wants kept. Her work is severe and lovely and utterly without ornament, 'because the fog reads plainly.' Once a year a commission arrives by unmarked courier, paid in old coin, patterns she does not recognize. She forges them exactly and asks the mountain no questions.", None),
    ("Petros Cairnson", "male", "bell-ringer", "Cairnfoot", "The Cairn Wardens", "journeyman",
     "Processions leave Cairnfoot to the sound of Petros's bell, struck in patterns that tell the wardens up-mountain what is coming: how many dead, how mourned, whether the family paid the full toll. He learned the code from his aunt and added, on his own initiative, a stroke that means *this one was loved*. The wardens pretended not to notice for a year. Now they all use it.", None),
    ("Sorrel Cairnson", "nonbinary", "wake-cook", "Cairnfoot", None, None,
     "Grief in Cairnfoot is fed, and Sorrel feeds it: funeral breads, the bitter mountain tea, the honey cakes that mean the mourning-year has ended. They know the correct dish for every stage of loss the way a pharmacist knows doses, and their kitchen door is never locked, because sorrow keeps no schedule. Sorrel themself has never worn mourning. Their pots, the village says, do it for them.", None),
    ("Edda Cairnson", "female", "memory-keeper", "Cairnfoot", None, None,
     "The village transcribed 4,411 names the night of the Fog Census, and Edda, who was nine that night and held the lantern, has appointed herself keeper of the list. She recopies it each winter, reads it aloud on the anniversary — all night, in shifts with anyone who will share the task — and cross-references travelers' accounts, hunting the names the transcription missed. She has recovered thirty-one.",
     ["Recover the names lost when dawn cut the Census short", "Hear the [[The Pale Auditor]] confirm the list, just once"]),

    # --- The Fennelwick family, Fennel Crossing ---
    ("Toll-Mother Bess Fennelwick", "female", "toll-keeper", "Fennel Crossing", "The Meridian Walkers", "sworn",
     "Bess keeps the ford's toll-house, and her counting-bowl has taken coin, buttons, songs, and once a genuinely excellent mule. The toll must be paid; Mother Meridian is flexible about the currency, and Bess is her flexibility. She can price a crossing at a glance — what a traveler can spare, what it would improve them to part with — and in thirty years no one has crossed unpaid or been turned away poor.", None),
    ("Gower Fennelwick", "male", "eel-farmer", "Fennel Crossing", None, None,
     "Gower's weirs produce the fat green eels that the Crossing smokes and sells the length of the river, and his rivalry with the Mossbourne eel-wives downstream is conducted entirely through the quality of the catch, escalating annually, to the benefit of everyone with a plate. He is mild, methodical, and composes insulting couplets about Hesper Mossbourne that he recites only to the eels.", None),
    ("Sister Halda Fennelwick", "female", "shrine-keeper", "Fennel Crossing", "The Meridian Walkers", "journeyman",
     "Halda sweeps the crossroads shrine, polishes the coin no one dares spend, and maintains the guest-book in which travelers may write where they are going, so that someone, somewhere, knows. The book fills yearly; she shelves them in the shrine loft, decades of departures. Wardens, creditors, and the grieving come to consult them, and Halda turns the pages for them with clean white gloves and no questions.", None),
    ("Jephta Fennelwick", "male", "bridge-toll assessor", "Fennel Crossing", None, None,
     "Where Bess prices people, Jephta prices cargo, and his manifest-eye is famous: he once assessed a wagon of 'turnips' at the tariff for silk, correctly, without touching the load. Merchants grumble that he is unbribable, which is not quite true — he can be bribed with new riddles, payable before assessment begins, and the toll is levied accurately anyway. He simply likes riddles.", None),
    ("Weir-Child Nan Fennelwick", "female", "apprentice eel-farmer", "Fennel Crossing", None, None,
     "Nan is Gower's granddaughter, nine years old, and famous along the river for having named every eel in the home weir — names she remembers and the adults do not, leading to weekly small tragedies at the smokehouse that she negotiates like a tiny, furious diplomat. Brother Tallow, passing through last spring, listened to her full register of names and pronounced it 'the completest act of prayer on this road.'", None),

    # --- The Emberhart family, Cindral ---
    ("Deacon Ashter Emberhart", "male", "forge-shrine deacon", "Cindral", "The Emberfaith", "sworn",
     "Ashter tends the third shrine-forge, the one pilgrims visit last, and his sermons are worked, not spoken — he preaches with hammer and stock, drawing a bar of iron into a lantern-bracket while the congregation watches, and the shape the metal takes is the homily. Literalists find him obscure. Smiths travel days to attend. He has not spoken at volume in eleven years and is the loudest man in Cindral.", None),
    ("Candle-Wife Merenn Emberhart", "female", "chandler", "Cindral", "The Emberfaith", "journeyman",
     "Merenn renders and pours the pilgrim-candles, each wick dipped once in crater ash so the flame burns a breath of orange at the last. Her candles time the vigils: a night-watch candle, a confession candle, the little stub called a forgiveness that burns exactly as long as most people need. She knows the length of every human ceremony in wax, and can estimate a stranger's grief to the half-inch.", None),
    ("Pilgrim-Master Coale Emberhart", "male", "pilgrimage guide", "Cindral", "The Emberfaith", "sworn",
     "Coale walks the crater circuit with the season's pilgrims — nine days, seven shrines, one dawn at the rim in silence. He has made the circuit two hundred times and reports, when pressed, that it is different every time, 'because the pilgrims are.' He carries no staff, keeps the party's pace to its slowest member as doctrine, and has left the circuit unfinished only twice, both times to carry someone home.", None),
    ("Ember-Clerk Sidonie Emberhart", "female", "shrine archivist", "Cindral", "The Lantern Society", "journeyman",
     "Sidonie records the miracles. Cindral produces a steady trickle of them — glass that weeps, forges that light unbidden — and her job, held jointly and uneasily between the Faith and the Lantern Society, is to document each claim with dates, witnesses, and residue samples. Her files disprove nine in ten. The tenth files she keeps in a fireproof chest, which she has noticed she has never needed.",
     ["Publish the tenth files before either patron can edit them"]),
    ("Gratia Emberhart", "female", "ash-gardener", "Cindral", None, None,
     "Nothing grows in the Cinderwastes except firemoss, and Gratia grows it magnificently — terraced beds of smoldering orange velvet on the crater wall, harvested for tinder, dye, and the Faith's incense. She talks about the moss the way other gardeners talk about roses and maintains a running feud with the pilgrims who touch it. Her beds spell a word, viewed from the rim. She planted them before she could read.", None),

    # --- The Deepdelve family, Highcairn ---
    ("Master Gudrun Deepdelve", "female", "stonemason", "Highcairn", None, None,
     "Gudrun cuts the terrace-stones of Highcairn to a tolerance her apprentices call impossible and she calls adequate. Her family delved before the Fall, and she keeps the old marks — each stone signed on its hidden face, 'because the mountain reads the inside.' The funerary road's newest mile is hers, every slab, and wardens report that the fog crosses it without lingering, which is the only review she wanted.", None),
    ("Keeper Aldous Deepdelve", "male", "toll-gate keeper", "Highcairn", "The Cairn Wardens", "sworn",
     "Aldous keeps the high gate, last post before the long fog, and his gatehouse log is a document of quiet dread: names in, names out, the difference. He is scrupulously fair, charges the posted toll to lords and paupers alike, and keeps a drawer of small comforts — dry socks, barley sugar, a bone whistle — for travelers whose courage runs out at his door. More take the socks than the whistle.", None),
    ("Ronwen Deepdelve", "female", "avalanche-reader", "Highcairn", None, None,
     "Ronwen reads the snowpack the way her cousin Gudrun reads stone: test pits, listening-rods, a palmful of powder tasted like wine. Her postings close the passes days before the weather shows its hand, and the caravan-masters who once ignored her now pay a subscription. She lost her father to the white in her twelfth winter and has spent every winter since telling the mountain: not again, not on my watch.", None),
    ("Chandler Pryce Deepdelve", "male", "funerary chandler", "Highcairn", "The Cairn Wardens", "initiate",
     "Pryce dips the road-candles that mourners carry up the funerary miles — tallow banded with grave-iron filings, which the fog is said to respect. He is new to the sworn work, earnest, and keeps a private practice the elder wardens have not noticed yet: into each candle he whispers the dead one's name as the wax sets, 'so the light knows who it works for.' The candles burn steadier than they should.", None),
    ("Ferren Deepdelve", "nonbinary", "cartographer", "Highcairn", "The Lantern Society", "journeyman",
     "Ferren maps the funerary roads, which is harder than it sounds: the fog rearranges the upper miles, subtly, seasonally, and Ferren's charts are the only ones that track the drift. They survey in rope-teams, by bell-count and chain, and publish through the Lantern Society with errata each thaw. Their masterwork is a map of where the roads have ever been, layered like tree rings. It is beautiful and wrong everywhere at once.",
     ["Chart the drift for a full decade and prove the pattern", "Walk one mile the map says has never existed"]),

    # --- The Lanterly family, Vellum Reach ---
    ("Doctor Imogen Lanterly", "female", "physician", "Vellum Reach", None, None,
     "Imogen doctors the harbor district from a narrow house marked by a blue lamp, and her waiting room seats dockers next to trade princes in strict order of arrival, a policy she enforces personally and once, memorably, with a boat-hook. She trained on pre-Fall texts the Lantern Society recovered and pays her subscription in kind: careful notes on which old cures still work in a changed world. Most do. Three emphatically do not.", None),
    ("Barrow Lanterly", "male", "bookbinder", "Vellum Reach", "The Lantern Society", "sworn",
     "Recovered folios arrive at Barrow's bench drowned, burned, or chewed, and leave whole. He rebinds the Society's rescues with a patience that borders on communion — matching pre-Fall thread twists, grinding period glues from Tobin Vellowine's recipes. He talks to the books, which is common among binders, and swears mildly that the Chained Library's volumes answer, which is not.", None),
    ("Sable-of-the-Stacks Lanterly", "nonbinary", "archive courier", "Vellum Reach", "The Lantern Society", "journeyman",
     "When a recovered text is too dangerous, contested, or simply valuable to ship, the Society sends Sable, who memorizes it and walks. Their memory is trained in the old palace mnemonic style, loci and lamps, and holds — at current count — nineteen complete volumes and the middle third of a twentieth. They speak carefully in company. Certain phrases, said aloud, open books in them that are difficult to close.", None),
    ("Cornelius Lanterly", "male", "lens-clerk", "Vellum Reach", "The Lantern Society", "initiate",
     "Cornelius catalogues optics: recovered spectacles, spyglasses, the survey lenses Signe Glasseye ships from Emberlight. His delight in the work is total and slightly alarming — he tests each lens at the same window, at the same hour, against the same harbor view, and his log of what each one shows has begun to record small, systematic disagreements about what is actually in the harbor. He assumes instrument error. He is running out of instruments to blame.", None),
    ("Verity Lanterly", "female", "proof-reader", "Vellum Reach", "The Ledger-Court", "journeyman",
     "Contracts before the Ledger-Court pass under Verity's eye last, and her marginal marks — a dry '?' that has sunk merchant houses — are studied like scripture by the clerks she trains. She reads four hundred pages a day, remembers all of them, and unwinds each evening with pulp romances, which she proof-reads involuntarily, resentfully, in pencil, and returns to the bookseller improved.", None),
]

assert len(MINORS) == 70, len(MINORS)
_names = [m[0] for m in MINORS]
assert len(set(_names)) == 70, "duplicate minor names"
_firsts = [n.split()[0] for n in _names]
assert len(set(_firsts)) == len(_firsts), "duplicate first names"
