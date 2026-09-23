#!/usr/bin/env python3
"""Build scripts/data/fy27-sea-calendars.json from the FY26/27 chapter learning calendars (SEA region).

Sources (received 2026-09-23): one file per chapter in xlsx / docx / pdf / poster form. Rows were normalised by hand:
- FY27 runs 1 Jul 2026 – 30 Jun 2027. Rows with only a month or marked TBC/tentative become DRAFT events on the 1st of
  the month with a "date to be confirmed" note; everything else is PUBLISHED.
- Single-day rows without a time get 09:00–17:00 and a "time to be confirmed" note; multi-day rows run 09:00 day one
  to 17:00 last day, in the chapter's timezone.
- Visibility: chapter events are LOCAL; "open to region" rows are REGIONAL; joint rows are CHAPTER_SPECIFIC.
- Global YPO events (GBS, EDGE, GLC, CMW, NLP, Sunrise/Apeiron) are not imported per chapter; Sunrise + Apeiron Jakarta
  appears once as a regional event hosted by Indonesia. Internal Excom meetings and public holidays are skipped.
Run:  python3 scripts/build-fy27-calendars.py && python3 scripts/import-events.py <url> <admin> scripts/data/fy27-sea-calendars.json
"""
import json
import os
import re

OUT = os.path.join(os.path.dirname(__file__), "data", "fy27-sea-calendars.json")

CHAPTERS = [
    # code, name, country
    ("SG", "Singapore", "Singapore"),
    ("SLC", "Singapore Lion City", "Singapore"),
    ("GCG", "Garden City Gold", "Singapore"),
    ("STIG", "Straits Tigers", "Singapore"),
    ("MY", "Malaysia", "Malaysia"),
    ("MYG", "Malaysia Gold", "Malaysia"),
    ("TH", "Thailand", "Thailand"),
    ("THG", "Thailand Gold", "Thailand"),
    ("SEAA", "SEA Angels", "Thailand"),
    ("ID", "Indonesia", "Indonesia"),
    ("IDG", "Indonesia Gold", "Indonesia"),
    ("PANID", "Pan Indonesia", "Indonesia"),
    ("PH", "Philippines", "Philippines"),
    ("PHG", "Philippines Gold", "Philippines"),
    ("PEARL", "Pearl of the Orient", "Philippines"),
    ("VN", "Vietnam", "Vietnam"),
    ("VNG", "Vietnam Gold", "Vietnam"),
    ("MM", "Myanmar", "Myanmar"),
    ("KH", "Cambodia", "Cambodia"),
    ("PANA", "Pan Asia", "Regional"),
    ("AU", "ASEAN United", "Regional"),
    ("SEAB", "SEA Beyond", "Regional"),
    ("SEAD", "SEA Dragon", "Regional"),
]
RENAMES = [
    {"code": "SGG", "name": "Singapore Lion City", "newCode": "SLC"},
]
EVENT_TYPES = [
    ("Business", "#2563eb"), ("Leadership", "#7c3aed"), ("Family", "#db2777"), ("Health & Wellness", "#16a34a"),
    ("Personal Growth", "#ea580c"), ("Networking", "#0891b2"), ("Social Impact", "#ca8a04"), ("Forum", "#475569"),
    ("Learning", "#0ea5e9"), ("Social", "#f59e0b"), ("Untold Story", "#8b5cf6"), ("Bridge Room", "#14b8a6"), ("Retreat", "#f43f5e"),
]
TZ = {
    "SG": "Asia/Singapore", "SLC": "Asia/Singapore", "GCG": "Asia/Singapore", "STIG": "Asia/Singapore",
    "MY": "Asia/Kuala_Lumpur", "MYG": "Asia/Kuala_Lumpur", "TH": "Asia/Bangkok", "THG": "Asia/Bangkok", "SEAA": "Asia/Bangkok",
    "ID": "Asia/Jakarta", "IDG": "Asia/Jakarta", "PANID": "Asia/Jakarta", "PH": "Asia/Manila", "PHG": "Asia/Manila",
    "PEARL": "Asia/Manila", "VN": "Asia/Ho_Chi_Minh", "VNG": "Asia/Ho_Chi_Minh", "MM": "Asia/Yangon", "KH": "Asia/Phnom_Penh",
    "PANA": "Asia/Singapore", "AU": "Asia/Singapore", "SEAB": "Asia/Singapore", "SEAD": "Asia/Singapore",
}
OFFSET = {"Asia/Singapore": "+08:00", "Asia/Kuala_Lumpur": "+08:00", "Asia/Manila": "+08:00", "Asia/Bangkok": "+07:00",
          "Asia/Jakarta": "+07:00", "Asia/Ho_Chi_Minh": "+07:00", "Asia/Phnom_Penh": "+07:00", "Asia/Yangon": "+06:30"}
THEME = {
    "SEAA": "IGNITE — Activate. Lead. Transform.", "MY": "Transform, Evolve, Discover (TED)", "PANA": "Live Long and Prosper",
    "AU": None, "GCG": "Awesome Tribe — Living Long, Staying Sharp, Thriving Together in the Age of AI",
    "IDG": None, "ID": "Beyond the Surface", "PANID": None, "PEARL": "Resilience", "PHG": "Vanguard",
    "PH": "APEX — The Standard Above", "SEAB": "Connect – Grow – Impact", "SEAD": "Future Technology & Humanity",
    "SLC": "Curiosity. Courage. Connection.", "SG": "ACDC: Authentic Conversations & Deeper Connections",
    "THG": "The Journey to Your Next Summit", "TH": "Be Bold", "MM": "Forward Together", "STIG": "Beyond the Familiar",
}

events = []


def E(chapter, title, date, *, type="Learning", time=None, chairs=None, resources=None, desc="", venue="", online=False,
      visibility="LOCAL", access=None, paid=None, tbc=False, draft=None):
    """date: 'YYYY-MM-DD' | 'YYYY-MM-DD..YYYY-MM-DD' | 'YYYY-MM' (month only → draft). time: 'HH:MM-HH:MM'."""
    tz = TZ[chapter]
    off = OFFSET[tz]
    notes = []
    month_only = re.fullmatch(r"\d{4}-\d{2}", date) is not None
    if month_only:
        d1 = d2 = f"{date}-01"
        notes.append("Date to be confirmed (placeholder: 1st of the month).")
    elif ".." in date:
        d1, d2 = date.split("..")
    else:
        d1 = d2 = date
    if tbc:
        notes.append("Date is tentative.")
    if time:
        t1, t2 = time.split("-")
    else:
        t1, t2 = "09:00", "17:00"
        if d1 == d2 and not month_only:
            notes.append("Time to be confirmed.")
    parts = []
    if desc:
        parts.append(desc.strip())
    if venue:
        parts.append(f"**Venue:** {venue}")
    if paid:
        parts.append(f"**Pricing:** {paid}")
    if notes:
        parts.append("_" + " ".join(notes) + "_")
    theme = THEME.get(chapter)
    name = next(n for c, n, _ in CHAPTERS if c == chapter)
    parts.append(f"Part of the YPO {name} Learning Calendar FY26/27" + (f" — *{theme}*." if theme else "."))
    if visibility == "LOCAL" and access:
        visibility = "CHAPTER_SPECIFIC"
    events.append({
        "title": title.strip(), "description": "\n\n".join(parts), "hostChapter": chapter,
        "eventType": type, "startAt": f"{d1}T{t1}:00{off}", "endAt": f"{d2}T{t2}:00{off}", "timezone": tz,
        "venue": "" if online else venue, "isOnline": online, "onlineUrl": None, "coverImageUrl": None,
        "visibility": visibility, "accessChapters": access or [], "capacity": None,
        "registrationOpensAt": None, "registrationClosesAt": None,
        "paymentType": "FREE", "price": None, "currency": None, "paymentInstructions": None, "paymentUrl": None,
        "chairs": [c.strip() for c in (chairs or []) if c.strip()],
        "resources": [{"name": r[0], "photoUrl": None, "bio": r[1] if len(r) > 1 else ""} if isinstance(r, (list, tuple)) else {"name": r, "photoUrl": None, "bio": ""} for r in (resources or [])],
        "agenda": [],
        "status": "DRAFT" if (draft if draft is not None else (month_only or tbc)) else "PUBLISHED",
    })


# ----------------------------------------------------------------------------------------------------------------- SEA Angels
C = "SEAA"
E(C, "The World is Changing, How about you?", "2026-08-27", time="15:30-21:30", chairs=["Romeo"], resources=["Riaz Shah"], venue="Sindhorn Kempinski, Bangkok", desc="Ignite the Future series. For members and executives.")
E(C, "Inside the Mind of a Global CEO", "2026-09-18", time="16:00-21:00", chairs=["Omri", "Adva"], venue="Agoda Office @ One Bangkok", desc="Ignite Perspective series.")
E(C, "Wabi-Sabi", "2026-10-08", time="15:00-21:30", chairs=["Bird"], venue="Bangkok", desc="Ignite the Future series. Members and spouses.")
E(C, "The Competitive Edge: Pickleball Tournament", "2026-10-28", time="16:00-20:00", type="Social", chairs=["SooSing", "Levy"], venue="Bravo BKK", desc="Ignite Play. Members and spouses.")
E(C, "The Big Brick Off — LEGO® Serious Play® Family Edition", "2026-11-21", type="Family", chairs=["Selinta", "Adva"], desc="Ignite Deep Connections.")
E(C, "Gala Dinner", "2026-12-09", time="17:30-22:00", type="Social", chairs=["Sandy", "Win"], venue="Muse Hotel, Bangkok", desc="Ignite Celebrations.")
E(C, "Soma Longevity", "2027-01-23", type="Health & Wellness", chairs=["Neetu", "Pan"], venue="Soma Clinic", desc="Ignite Vitality.")
E(C, "Family Weekend @ Myanmar", "2027-01-29..2027-01-31", type="Retreat", chairs=["Aye"], desc="3D2N in Yangon with 2D1N in Shan State. User-pay plus chapter budget.")
E(C, "Power and Presence", "2027-04-28", chairs=["Ponk", "Belle"], venue="Bangkok", desc="Ignite Your Voice.")
E(C, "The Future of Money", "2027-05", time="17:00-21:00", chairs=["Tom (Joe)"], venue="Bangkok", desc="Ignite Innovation.")
E(C, "Chapter Retreat @ Mongolia", "2027-06", type="Retreat", chairs=["Pam Phornpapha", "Vishal Kedia", "Joe"], venue="Mongolia")

# ----------------------------------------------------------------------------------------------------------------- Malaysia (YPO & YPO Gold)
C = "MY"; MYJ = ["MY", "MYG"]
E(C, "The Art of Unforgettable — Designing moments that move people", "2026-07-04", chairs=["Zulaika Tann", "NK Tong"], resources=["Alex Koo"], access=MYJ, desc="Day Chair Event. Members, spouses and YNG.")
E(C, "The Future of Asian Capital Markets — Listings, Liquidity & Regional Competitiveness", "2026-07-21", type="Business", chairs=["Rachel Lau"], resources=["Bursa Malaysia x HKEX"], access=MYJ, desc="TED Talk Series.")
E(C, "Structuring Forever — The Malaysian Family Office Blueprint", "2026-07-30", type="Business", chairs=["Kishan Jasani"], resources=[("Datin Paduka Azalina Adham", "Managing Director, Securities Commission Malaysia"), ("Wong Kok Hong", "Head of Wealth Investment Advisory, Affin Bank Berhad"), ("Loy Teik Ngan", "YPO Malaysia Gold")], access=MYJ, desc="TED Talk Series · Family Business Series.")
E(C, "Inside Stories — A Conversation with Rafizi Ramli", "2026-08-10", chairs=["Teo Chi Ping", "Tan Aik Keong"], resources=["Rafizi Ramli"], access=MYJ, desc="TED Talk Series.")
E(C, "Breathing Yourself into Equilibrium — The Architecture Beneath", "2026-08-15", type="Health & Wellness", chairs=["Mac Chung Lynn"], resources=["Primal Integrity x IMD Breathwork"], access=MYJ, desc="TED Discover. Members and spouses.")
E(C, "Don't Blame Them. Understand Them. — How Gen X, Millennials and Gen Z can maximise each other's strengths", "2026-08-20", chairs=["Stephanie Khor"], access=MYJ, desc="TED Talk. Members and executives.")
E(C, "Demystifying the LGBTQ Phenomenon — Honest conversations with people living it, and how to show up for the ones you love", "2026-09-05", type="Family", chairs=["Sandy Tan"], access=MYJ, desc="TED Discover · TED Family. Fully sponsored.")
E(C, "Chapter Retreat: Topas Ecolodge, Vietnam", "2026-09-10..2026-09-13", type="Retreat", chairs=["Kent Chua", "Shirley Ding"], access=MYJ, desc="TED Connect. An impact retreat built around our relationship with ourselves, our businesses, and the world we are leaving behind. Members, spouses and YNG.", paid="User pay; details to follow.")
E(C, "Beyond The Founders — Next Chapter for Family Business", "2026-09-25", type="Business", chairs=["Amanda Chin"], resources=[("Till Vestring", "Former Bain SEA Managing Partner")], access=MYJ, desc="TED Education · Family Business Series.")
E(C, "Become A Top Content Creator — Learning from Malaysia's #1 YouTuber with 18M followers", "2026-09-26", type="Family", chairs=["Tan Aik Keong"], resources=[("Siowei (im_siowei)", "Forbes 30 under 30")], access=MYJ, desc="TED Family.")
E(C, "Winemaker Dinner Series — An evening with YPOer Cameron Ashmead of Elderton Wines", "2026-10-29", type="Social", chairs=["Tan Lei Cheng"], access=MYJ, desc="TED Passion. Members and spouses.")
E(C, "Moments That Matter — A YPO Parent-Child Experience", "2026-10", type="Family", chairs=["Jonathan Cheah", "Gavin Choong", "Daryll Choong"], access=MYJ, desc="TED Connect.")
E(C, "The AI Current — Part 1: Paddling Out & Part 2: Standing Up", "2026-10", chairs=["Andy Tan", "Tan Aik Keong", "Rafiq Jumabhoy"], access=MYJ, desc="TED Education. A hands-on trilogy building from AI fundamentals to your own deployed agent.")
E(C, "The AI Current — Part 3: Hang Ten", "2026-11", chairs=["Andy Tan", "Tan Aik Keong", "Rafiq Jumabhoy"], access=MYJ, desc="TED Education. A hands-on trilogy building from AI fundamentals to your own deployed agent.")
E(C, "NLP 2026 – A Personal Odyssey: Program 1 — Practitioner", "2026-11-13..2026-11-19", chairs=["NK Tong", "Catherine Tong"], resources=["Dr. Heidi Heron"], access=MYJ, desc="TED Education. Unleash your business and personal potential through Neuro-Linguistic Programming.", paid="User pay.")
E(C, "NLP 2026 – A Personal Odyssey: Program 2 — NLP Master Practitioner", "2026-11-22..2026-11-30", chairs=["NK Tong", "Catherine Tong"], resources=["Dr. Heidi Heron"], access=MYJ, desc="TED Education.", paid="User pay.")
E(C, "Doing Good — Leaving Your Legacy", "2026-11", type="Social Impact", chairs=["Amanda Chin"], resources=["Bridgespan"], access=MYJ, desc="TED Talk Series · Family Business Series.")
E(C, "Meet Malaysia's PrawnStar — How a Malaysian biotech entrepreneur is reviving Malaysia's giant freshwater prawns", "2026-12-08", type="Business", chairs=["Mok Yuen Lok"], access=MYJ, desc="TED Inside.")
E(C, "Seeing Clearly — What we rely on most, protect least: live eye refractive surgery", "2027-01", type="Health & Wellness", chairs=["Sandy Tan"], access=MYJ, desc="TED Inside.")
E(C, "Culinary War — Battles are fought in boardrooms. This one, in the kitchen.", "2027-01", type="Social", chairs=["YK Yong"], access=MYJ, desc="TED Passion.")
E(C, "Finish Together — The Ultimate Parent-Child Resilience Challenge", "2027-01", type="Family", chairs=["CG Tan", "Tan Zhao Lin"], resources=["YPO x YNG"], access=MYJ, desc="TED Family · TED Passion.")
E(C, "HBS: The Inflection Point — Part 1: Governance, Pay and the CEO in the Age of AI", "2027-02-16..2027-02-17", type="Leadership", chairs=["Terry Goh"], resources=[("Professor Boris Groysberg", "Harvard Business School")], access=MYJ, desc="TED Education Signature.", paid="User pay.")
E(C, "HBS: The Inflection Point — Part 2: Succession, Conflict and the Family Enterprise", "2027-02-18..2027-02-19", type="Leadership", chairs=["Terry Goh"], resources=[("Professor Boris Groysberg", "Harvard Business School")], access=MYJ, desc="TED Education · Family Business Series.", paid="User pay.")
E(C, "Project D: The Art of Drifting — How to keep an unstable state stable", "2027-02", type="Social", chairs=["Shirley Tan", "Tee We Chard"], access=MYJ, desc="TED Passion.")
E(C, "Nuking Myths — Powering Malaysia's energy future in a clean, affordable and very, very safe way", "2027-03", chairs=["NK Tong"], access=MYJ, desc="TED Education · TED Inside.")
E(C, "The Power Of Gold — What the smartest money is doing now", "2027-04", type="Business", chairs=["Tan Lee Koon"], access=MYJ, desc="TED Talk Series.")
E(C, "Beyond The Soil — Kedah Family Retreat", "2027-05", type="Retreat", chairs=["Louis Tan", "Kingston Liu"], access=MYJ, desc="TED Connect · TED Family. Where your family's next chapter begins.")
E(C, "Game of Impossible (GOI) — A Pemandu Lab with Idris & Leon Jala", "2027-05", chairs=["Ken R"], resources=["GOI | Pemandu"], access=MYJ, desc="TED Education. Turning your impossible into a plan.")
E(C, "Black Tie Masquerade Ball — Annual Hand Over Party", "2027-06", type="Social", access=MYJ, desc="TED Moments.")
E(C, "Permission To Lust — Nothing, Nobody, Never", "2027-06", chairs=["Teah Choon Lee"], access=MYJ, desc="TED Discover.")

# ----------------------------------------------------------------------------------------------------------------- Pan Asia
C = "PANA"
E(C, "Seoul, South Korea — Member & Spouse Event", "2026-09-11..2026-09-13", type="Retreat", venue="Seoul, South Korea")
E(C, "Chiang Mai, Thailand — Member & Spouse Event", "2026-11-20..2026-11-22", type="Retreat", venue="Chiang Mai, Thailand")
E(C, "Colombo, Sri Lanka — Member-only Event", "2027-03-19..2027-03-21", type="Retreat", venue="Colombo, Sri Lanka")
E(C, "Bandar Seri Begawan, Brunei — Family Event", "2027-06-18..2027-06-20", type="Family", venue="Bandar Seri Begawan, Brunei")

# ----------------------------------------------------------------------------------------------------------------- ASEAN United
C = "AU"
E(C, "Education Program with Professor Randel Carlock — Singapore", "2026-09-23..2026-09-27", resources=[("Professor Randel Carlock", "INSEAD")], venue="Singapore")
E(C, "ASEAN United in Bangkok", "2026-11-19..2026-11-21", type="Retreat", venue="Bangkok, Thailand")
E(C, "ASEAN United in Hue", "2027-03-10..2027-03-14", type="Retreat", venue="Hue, Vietnam")
E(C, "ASEAN United in Kazakhstan", "2027-05-26..2027-05-30", type="Retreat", venue="Kazakhstan")

# ----------------------------------------------------------------------------------------------------------------- Garden City Gold
C = "GCG"
E(C, "Trust Your Gut: An Evening of Connection, Health, AI & Longevity", "2026-07-09", type="Health & Wellness", resources=[("Evan Tan", "INSEAD MBA and former Senior Technical Program Manager in Grab's CTO office; co-founded Wellsprout after seeing how AI could compress years of startup work into months."), ("Dr. Alexandra Lim", "Completed her doctorate at Oxford researching gut-derived biomarkers and metabolomics; holds a Master's in Human Nutrition from Imperial College London.")], desc="Evan Tan and Dr. Alexandra Lim are a founder-scientist duo on a mission to transform how leaders think about health, performance and longevity. They will take members on a journey through the emerging science of the gut-brain axis and show how AI is accelerating the future of personalised health. Expect a conversation that challenges assumptions and sends every CEO home with practical tools for sharper thinking, stronger energy and a longer game.")
E(C, "Run Your Brain For Lifespan and Mindspan with N.K. Tong", "2026-07-30", type="Health & Wellness", resources=[("N.K. Tong", "Master NLP practitioner and executive coach whose work sits at the intersection of neuroscience, human performance and longevity.")], desc="A live mental upgrade lab: a 90-minute embodied experience designed for CEOs navigating the age of AI. Members will run two mental technologies, the Perspective Upgrade and Future-Self Installation, and leave with tools they can use the very next morning.")
E(C, "CEO AI Workshop with Daniel Jarosch", "2026-08-20", resources=[("Daniel Jarosch", "AI practitioner and business leader who builds, deploys and stress-tests AI tools in real organisations.")], desc="A hands-on workshop through the AI stack that top operators actually use: productivity tools, prompting techniques, live demonstrations and a clear framework for leading AI transformation. Members benchmark themselves against peers and leave with specific tools to try and one committed action for the next 30 to 90 days.")
E(C, "'9 Bots, $300. No Code' — How To AI Your Leadership Team with Greg Krasnov", "2026-09-04", resources=[("Greg Krasnov", "Founder, fintech pioneer and YPO member who built Southeast Asia's first digital-only bank, Tonik.")], desc="Over two weekends, with no dev team and no code written by hand, Greg built nine AI bots that now run his working day for under US$300 a month. He opens up his complete AI operating system: the bots, the stack, the workflows and the mindset shift behind them.")
E(C, "Art Jam: Spouse Event", "2026-10-06", type="Social")
E(C, "An Evening with German Business — Oktoberfest with Jens Rübbert (Dine Around #1)", "2026-10", type="Networking", resources=[("Jens Rübbert", "Managing Director of LBBW in Singapore and President of EuroCham Singapore; recognised with Germany's Order of Merit.")], desc="Jens brings a rare 360-degree view of how geopolitics, trade policy and business leadership intersect across cultures, and inspires fellow CEOs to think beyond borders and lead with strategic empathy.")
E(C, "From YNG to Triple Impact Business with Richard Blossom", "2026-11-19", type="Social Impact", resources=[("Richard W. Blossom", "Former YPO Singapore member; founder of Wawee Valley and HTO, a regenerative agroforestry and organic egg venture built on YNG roots and all-YPO investor capital.")], desc="The honest version of building a purpose-driven venture with commercial discipline and peer capital behind it: what worked, what nearly broke, and what it really takes. The model delivers on 11 of the 17 UN Sustainable Development Goals.")
E(C, "Christmas Party", "2026-12-05", type="Social")
E(C, "A Visit to a Longevity Clinic + New Year Resolutions", "2027-01", type="Health & Wellness")
E(C, "CNY Lunch", "2027-02-11", type="Social")
E(C, "Family Event", "2027-03-16..2027-03-21", type="Family", tbc=True)
E(C, "Dine Around #2", "2027-04", type="Networking")
E(C, "The Long Game: Fertility, Longevity & the Future of Family with Margaret Wang", "2027-05-13", type="Health & Wellness", resources=[("Margaret Wang", "Harvard, Stanford GSB, former head of Bridgewater Singapore, now CEO of Rhea Fertility & GenPrime, a global reproductive health platform backed by Thiel Capital.")], desc="Biological timelines and planning for the long arc; AI in reproductive medicine; what it means to build a company from lived experience.")
E(C, "Overtaken: What Happens When The Market Leader Loses The Lead with Matthias Schepers", "2027-06-18", type="Business", resources=[("Matthias Schepers", "Managing Director for Marketing and Sales at Audi China; nearly two decades leading Volkswagen Group and Audi operations across Asia.")], desc="A candid peer conversation on how a former market leader diagnoses its own decline, what a real turnaround strategy requires, and what every CEO should understand about China, competition and legacy industries under pressure.")
E(C, "White Asparagus Dinner", "2027-06", type="Social")

# ----------------------------------------------------------------------------------------------------------------- Indonesia (joint 3 chapters where marked)
C = "ID"; J3 = ["ID", "IDG", "PANID"]; J2 = ["ID", "PANID"]
E(C, "World Cup Final", "2026-07-19", type="Family", chairs=["Monika Rudijono"], access=J3, desc="Joint event of the three Indonesia chapters.")
E(C, "Rethink: Have we been reading the world wrong", "2026-07-21", chairs=["Yuan Zhang Lee", "Tommy Tjiptadjaja"], resources=["Bilahari Kausikan"], access=J2, desc="Joint YPO Indonesia and Pan Indonesia.")
E(C, "Day Chair Training", "2026-08-26", chairs=["Learning Officers"], resources=["Alan Hepburn"], access=J3, desc="Joint event of the three Indonesia chapters.")
E(C, "Forum Foundations (FF)", "2026-09-05", type="Forum", resources=["Jody Dharmawan"], access=J3)
E(C, "GREW Jakarta 2026 — Golf", "2026-09-17..2026-09-20", type="Networking", chairs=["Richmond Blando"], visibility="REGIONAL", venue="Jakarta", desc="Regional golf gathering hosted by the Indonesia chapters. Self pay.")
E(C, "Handover Party", "2026-09-26", type="Social", chairs=["Eng Khim Lim", "Denise Tjokrosaputro", "Winston", "Fadly", "Anthony Bingei"], access=J3)
E(C, "An Evening with Dr. Majid Fotuhi", "2026-09", resources=["Dr. Majid Fotuhi"], access=J3)
E(C, "Executive Education: Strategy — Building & Sustaining Competitive Advantage", "2026-10-09..2026-10-10", chairs=["Jefrey Joe", "Evelyn Sasmito", "Edwin Hendriadi", "Eddy Tamboto"], resources=[("Prof. Ramon Casadesus-Masanell", "Harvard Business School")], access=J2, desc="HBS Executive Education. Joint YPO Indonesia and Pan Indonesia.")
E(C, "FMLD", "2026-10-13", type="Forum", resources=["Andrea Pereira"], access=J3)
E(C, "OneSEA Sunrise 2026/27 & Apeiron Jakarta", "2026-10-23..2026-10-24", type="Networking", visibility="REGIONAL", venue="Jakarta", desc="Regional gathering for all SEA chapters: OneSEA Sunrise (officers and members) and Apeiron, the onboarding experience for new members and spouses.")
E(C, "Kopi Kenangan", "2026-10", access=J3)
E(C, "Family Kids Adventure", "2026-11-14", type="Family")
E(C, "Spouse Event: Pre-menopause", "2026-12-03", type="Health & Wellness", access=J2)
E(C, "Love Code Couple Workshop", "2027-01-21", type="Family", resources=["Craig Tunnell"])
E(C, "Family Signature Retreat (Belitung / Toba)", "2027-01-29..2027-01-31", type="Retreat", access=J3)
E(C, "Cybersecurity", "2027-02-19", chairs=["Kanishk Laroya"], access=J3)
E(C, "Succession Planning", "2027-03")
E(C, "Family Legacy (Napak Tilas)", "2027-04-10", type="Family")
E(C, "Dine Around", "2027-04-24", type="Networking", access=J3)
E(C, "Chapter Retreat (Mongolia / India)", "2027-04", type="Retreat")
E(C, "Journaling & Manifestations", "2027-05-20", type="Health & Wellness", desc="Spouse event.")

# ----------------------------------------------------------------------------------------------------------------- Indonesia Gold
C = "IDG"
E(C, "Workshop: Lifespan & Hotspan", "2026-08-11", type="Health & Wellness")
E(C, "Independence Day", "2026-08-17", type="Family", access=J3)
E(C, "Kopi Kenangan: Inside the Boardroom (Gold)", "2026-08-29")
E(C, "Gold Roundtable (August)", "2026-08")
E(C, "Interview Skills at SCTV", "2026-10-03", access=J3)
E(C, "Will Writing", "2026-10", resources=["Goldman Sachs / law firm (to be confirmed)"])
E(C, "Gold Roundtable (October)", "2026-10")
E(C, "Bakmi Battle", "2026-10-31", type="Networking", access=J3, desc="Food Network.")
E(C, "Beauty ABC Korea Learning Trip (Gold)", "2026-11-06..2026-11-10", type="Retreat", venue="South Korea", paid="Self pay.")
E(C, "Gold Handover / Christmas", "2026-12-05", type="Social")
E(C, "Wealth Management", "2027-01")
E(C, "Bukber", "2027-02-18", type="Family", access=J3, tbc=True, desc="18 or 25 February, to be confirmed.")
E(C, "Gold Roundtable (February)", "2027-02")
E(C, "Deathcode", "2027-02-22")
E(C, "Gold Chapter Retreat", "2027-03", type="Retreat", paid="Self pay.")
E(C, "Spring Break Family Retreat (mother-daughter or father-son)", "2027-03", type="Family")
E(C, "Moderator Appreciation Dinner", "2027-05", type="Forum", access=J3)
E(C, "Day Chair Appreciation Dinner", "2027-05", access=J3)

# ----------------------------------------------------------------------------------------------------------------- Pan Indonesia
C = "PANID"
E(C, "Kintsugi Art", "2026-09-16", type="Social", desc="Spouse event.")
E(C, "Say It Before It's Too Late", "2026-11-26", resources=["Craig Tunnell"])
E(C, "Chinese New Year Celebration", "2027-02-13", type="Social", access=J3)
E(C, "Session with a Tsinghua Professor", "2027-02", desc="Late February; topic to be announced.")
E(C, "Freakonomics of Sport", "2027-03-27", resources=["Indonesia National Hockey Team"], desc="Source listed 2026-03-27, read as 27 March 2027.")
E(C, "Dealing with Aging Parents", "2027-04-27", type="Family", desc="Speaker to be confirmed. Source listed 2026-04-27, read as 27 April 2027.")
E(C, "Empire Fitness Navy Seal Weekend", "2027-06", type="Health & Wellness", desc="Date to be announced.")
E(C, "Sustainability with Chandran Nair", "2027-06", type="Social Impact", resources=[("Chandran Nair", "WEC, sustainability")], desc="Date to be announced.")
E(C, "Factory Visits (bring the kids)", "2027-06", type="Family", desc="Date to be announced.")
E(C, "China Trip — AI", "2027-06", type="Retreat", desc="Date to be announced.")

# ----------------------------------------------------------------------------------------------------------------- Pearl of the Orient
C = "PEARL"
E(C, "Peri-Menopause with Dr Chua Yang", "2026-08", type="Health & Wellness", resources=["Dr Chua Yang"], venue="Manila")
E(C, "Christmas Party", "2026-11", type="Social", venue="Manila")
E(C, "Singapore Event", "2027-04", venue="Singapore", desc="Mid April; details to follow.")
E(C, "AGM", "2027-06", type="Social", venue="Manila")

# ----------------------------------------------------------------------------------------------------------------- Philippines (APEX) and Philippines Gold
C = "PH"; PHJ = ["PH", "PHG"]
E(C, "GFBN Meet-Up | Connections in Manila", "2026-07-11", type="Networking", desc="Global Family Business Network event in Manila: conversations, connections and community.")
E(C, "Personal Assistants Night: AI Learning for PAs", "2026-07-31", access=PHJ, desc="Never work alone again: personal AI augmentation.")
E(C, "YPO Appreciation Night: APEX Opening Assembly", "2026-08-11", type="Social", access=PHJ, venue="Medusa, BGC", desc="Introduction of the new EXCO, leadership turnover ceremony, vision and direction for APEX 2026–2027, chapter standards and member experience reset.")
E(C, "Toyota Family Event — Toyota Alabang Kids Tech", "2026-08-15", type="Family", chairs=["Anton Alcantara", "Pinky Tiu-Lim"], access=PHJ, venue="Toyota Alabang")
E(C, "YPO with Father Greg Boyle on Mental Health", "2026-09-09", type="Health & Wellness", resources=[("Fr. Greg Boyle", "American Jesuit priest, founder and director of Homeboy Industries, the world's largest gang intervention and rehabilitation program.")])
E(C, "Cybersecurity AI Event with Inspira", "2026-09-17", resources=["Chetan Jain"], access=PHJ, venue="The Finance Centre, BGC")
E(C, "APEX Longevity: Performance Without Decline", "2026-09", type="Health & Wellness", desc="Longevity and peptides, executive health optimisation, hormones, cognition, recovery and sleep, wellness and sustainable high performance.")
E(C, "APEX Performance Lab: Discipline Under Pressure", "2026-10", type="Leadership", desc="Mental resilience, physical performance, leadership under stress, competitive mindset.")
E(C, "APEX Legacy: The Cost of Power with Sebastian Marroquin", "2026-11", resources=["Sebastian Marroquin"], desc="Legacy and reputation, family consequences, violence, redemption and identity, what leaders leave behind.")
E(C, "The APEX Gala: An Evening at the Highest Level", "2026-12-03", type="Social", chairs=["Rikki Dee", "Marvin Tiu-Lim"], access=PHJ, venue="Mandarin, Makati", desc="Christmas gala with a concert performance, elegant dinner, recognition moments and YPO Gold integration.")
E(C, "Kawayan Dine-Around", "2027-01-16..2027-01-17", type="Networking", chairs=["Chris Chilip"], access=PHJ, venue="Kawayan Cove", desc="Overnight packed-day event at Kawayan Cove members' houses.")
E(C, "APEX Ascent: Parents & Kids Mountain Retreat", "2027-01-29..2027-01-31", type="Family", access=PHJ, venue="Balesin Pines, Baguio", desc="Hiking and outdoor activities, parent-child bonding, leadership through shared experiences.")
E(C, "APEX Partners: Strong Leaders. Strong Relationships.", "2027-02-14", type="Family", desc="Wellness and connection, marriage under pressure, leadership at home, intentional relationships.")
E(C, "APEX Sports Series: Competition Builds Brotherhood", "2027-02", type="Social", desc="February to May: golf, pickleball, tennis and basketball tournaments.")
E(C, "Inside APEX: Building a World-Class Filipino Brand", "2027-03", type="Business", desc="Factory immersion, innovation showcase, family-friendly experience, Filipino entrepreneurship story.")
E(C, "APEX Expedition: Tawi-Tawi Explorations", "2027-04", type="Retreat", chairs=["Miguel Dominguez"], access=PHJ, venue="Tawi-Tawi", desc="Members only. Filipino identity, frontier leadership, culture and geopolitics, perspective expansion.")
E(C, "The APEX Family Retreat: Legacy Beyond Business", "2027-05", type="Retreat", desc="Multi-generational connection, family leadership, shared experiences, reflection and celebration.")

C = "PHG"
E(C, "New Members & Excom Dinner", "2026-07-30..2026-07-31", type="Networking", chairs=["Diday Riingen"])
E(C, "Forum Moderators Meeting (Members-only)", "2026-08-25..2026-08-26", type="Forum", chairs=["Jasen Ko"], venue="Jasen Ko's residence")
E(C, "AI in Action: Roadmap for Business Transformation", "2026-09", chairs=["Diday Riingen"])
E(C, "Spouse Event: Art Workshop with Solenn Bolzico", "2026-09-22..2026-09-23", type="Social", resources=["Solenn Bolzico"])
E(C, "Membership Engagement Dinner with Excom (October)", "2026-10", type="Networking", chairs=["Diday Riingen"])
E(C, "Spouse Event: Christmas Florals, Tablescape & Butlery", "2026-11", type="Social")
E(C, "YNG Holiday Mixer", "2026-12", type="Social", chairs=["Rick Santos"])
E(C, "Membership Engagement Dinner with Excom (January)", "2027-01", type="Networking", chairs=["Diday Riingen"])
E(C, "Flower Island Couples Retreat", "2027-02", type="Retreat", chairs=["Jacques Branellec"], venue="Flower Island, Palawan")
E(C, "Forum Moderators Meeting (Members-only) — February", "2027-02", type="Forum", chairs=["Jasen Ko"])
E(C, "Spouse Event: Retro Revival or Taiwanese Nourish Kitchen", "2027-02", type="Social")
E(C, "Mega Sardines Plant Tour", "2027-03", type="Business", chairs=["Marvin Tiu-Lim"], venue="Batangas Plant")
E(C, "Membership Engagement Dinner with Excom (March)", "2027-03", type="Networking", chairs=["Diday Riingen"])
E(C, "Inter-Chapter with YPO Vietnam", "2027-04", venue="Vietnam")
E(C, "EDGE Chapter Retreat — Mexico", "2027-05", type="Retreat", chairs=["Diday Riingen"], venue="Mexico")
E(C, "Membership Engagement Dinner with Excom (May)", "2027-05", type="Networking", chairs=["Diday Riingen"])
E(C, "Spouse Event: Pickle & Padel (Small Group)", "2027-05", type="Social")

# ----------------------------------------------------------------------------------------------------------------- SEA Beyond
C = "SEAB"
E(C, "Needs & Leads", "2026-07-31", time="17:00-18:30", type="Networking", online=True, desc="Online, 5pm Singapore time.")
E(C, "The Untold Stories of Wall Street", "2026-09-02", time="17:30-20:30", venue="Singapore (venue to be confirmed)")
E(C, "Virtual Treasure Hunt (Family Event)", "2027-01-24", time="17:00-18:30", type="Family", online=True, desc="Online, 5pm Singapore time.")
E(C, "Chapter Retreat — Bangkok", "2027-03-12..2027-03-14", type="Retreat", venue="Bangkok, Thailand")

# ----------------------------------------------------------------------------------------------------------------- SEA Dragon
C = "SEAD"
E(C, "Xinjiang — From the Silk Road to the Belt and Road: Understanding Culture, Connection, and the Future of Eurasia", "2026-09-10..2026-09-15", type="Retreat", chairs=["Gladdy He", "Echo Liu"], resources=[("Jianyu Zhang", "Executive Dean, Belt and Road Green Development International Institute"), ("Jonathan Anderson", "Former Chief Economist at UBS & Goldman Sachs; former IMF representative"), ("Huang Qi", "Cultural researcher and historical journey curator"), ("Zi Hua", "Lecturer in Classical Chinese Thought and Traditional Culture"), ("Xu Yichao", "Calligraphy artist and 'Nian Zi Ti' designer")], venue="Xinjiang, China", paid="Members USD 1,000 · Spouses USD 1,500.")
E(C, "Shanghai Learning Trip", "2026-12-02..2026-12-06", type="Retreat", chairs=["Laura Zhang", "Jason Cai", "CK Tan"], venue="Shanghai, China")
E(C, "Chapter Retreat Cebu — SEA Dragon & Pearl", "2027-03-04..2027-03-06", type="Retreat", chairs=["Kevin Foo", "Jean Foo"], access=["SEAD", "PEARL"], venue="Cebu, Philippines", desc="Joint retreat with YPO Pearl of the Orient.")
E(C, "Lisbon Learning Trip", "2027-06-09..2027-06-13", type="Retreat", chairs=["Craig Ng"], venue="Lisbon, Portugal")

# ----------------------------------------------------------------------------------------------------------------- Singapore Lion City
C = "SLC"
E(C, "Morning Run + Breakfast", "2026-08-15", type="Health & Wellness", chairs=["Thomas"], desc="New format; wellness opener.")
E(C, "Chapter Kick-off Cocktails", "2026-08-28", type="Social", chairs=["Thomas"], desc="Set the tone for the year.")
E(C, "Australian Open Showcase", "2026-09-03", type="Social", chairs=["Pooja"], resources=["Mark Philippoussis"], desc="Philippoussis fireside and court clinic.")
E(C, "Jeffersonian Dinner #1", "2026-09-16", type="Networking", chairs=["Pooja"], venue="St Regis Singapore")
E(C, "F1 Lead-up: Karting", "2026-09", type="Social", chairs=["Thomas"], desc="Exploratory; venue to be confirmed.")
E(C, "Needs & Leads #1", "2026-10-01", type="Networking", chairs=["Cameron"], desc="First session, Cameron leading. Sets the format baseline.")
E(C, "F1 Evening with Goldman Sachs", "2026-10-09", type="Social", chairs=["Pooja"], desc="9 or 10 October, to be confirmed. Goldman Sachs return.")
E(C, "F1 VIP Experience with Zak Brown (MBS)", "2026-10-09..2026-10-11", type="Social", chairs=["Pooja"], tbc=True, desc="Opportunistic.")
E(C, "Shenzhen 4.0: Blueprint to Breakthrough", "2026-10-11..2026-10-15", type="Retreat", chairs=["Pan GBA", "Thomas"], visibility="REGIONAL", venue="Shenzhen, China", desc="Hardware, manufacturing and the China lens. Departs straight after F1.")
E(C, "Deepavali Celebration", "2026-11-08", type="Family", chairs=["Family Officers"], desc="Family-inclusive.")
E(C, "YPO SLC Chapter Retreat 2026 — Sri Lanka", "2026-11-12..2026-11-15", type="Retreat", chairs=["Retreat team"], venue="Sri Lanka")
E(C, "Flagship Speaker Dinner", "2026-11", chairs=["Thomas"], desc="Anduril / Neuralink, visit dates to be confirmed.")
E(C, "Needs & Leads #2 (reserved)", "2026-11", type="Networking", chairs=["Cameron"], desc="Converts to N&L #2 if the October pilot lands well.")
E(C, "Jeffersonian Dinner #2 + Ice Bath", "2026-12", type="Networking", chairs=["Pooja"], desc="Pre year-end.")
E(C, "Christmas Family Event", "2026-12", type="Family", chairs=["Family Officers"], desc="Exploratory.")
E(C, "Virtual AI Workshop", "2027-01", chairs=["Thomas", "Natalia"], online=True, desc="Office hours; accessible to regional members.")
E(C, "AO Melbourne Experience", "2027-01", type="Retreat", chairs=["Pooja"], venue="Melbourne, Australia", desc="Australian Open package.")
E(C, "Needs & Leads #3 (reserved)", "2027-01", type="Networking", chairs=["Cameron"])
E(C, "Chinese New Year Celebration", "2027-02-17", type="Family", chairs=["Family Officers"], desc="Family-inclusive.")
E(C, "AI Accountability Panel Lunch", "2027-02", chairs=["Thomas"], desc="Insurance, legal and governance angle.")
E(C, "PJ Brady Fireside", "2027-03", chairs=["Thomas"], resources=["PJ Brady"], desc="Family and leadership; values-driven.")
E(C, "Jeffersonian Dinner #3", "2027-03", type="Networking", chairs=["Pooja", "Natalia"], desc="INSEAD-led; macro or negotiation.")
E(C, "Fintech Speaker Dinner", "2027-04", type="Business", chairs=["Thomas"], desc="Wise / Revolut template.")
E(C, "Qigong / Wellness Session", "2027-04", type="Health & Wellness", chairs=["Thomas"], desc="Sunday morning, mindfulness.")
E(C, "Boardroom Lunch", "2027-05", type="Business", desc="A member presents their own business.")
E(C, "Jeffersonian Dinner #4", "2027-05", type="Networking", chairs=["Pooja", "Natalia"], desc="INSEAD-led; dual-career or strategy.")
E(C, "INSEAD Mini-MBA", "2027-06", chairs=["Natalia"], desc="Q4 target; longer-term, cross-topic day.")
E(C, "Cinema Night + Year-end", "2027-06", type="Social", chairs=["Thomas", "Pooja"], desc="Closing the year together.")

# ----------------------------------------------------------------------------------------------------------------- Singapore
C = "SG"
E(C, "An Evening with Marc Pictet", "2026-07-09", time="17:30-21:30", chairs=["Vivek Agarwal"], resources=["Marc Pictet"], venue="Atout")
E(C, "LALA with Fu Wei", "2026-07-17", time="11:30-14:00", chairs=["Brandon Chia"], resources=["Fu Wei"], venue="Paragon Member's Club")
E(C, "Lifeline Event", "2026-07-23", tbc=True)
E(C, "The Future Of Human Behaviour with Milo Wilkinson", "2026-07-28", time="18:00-21:00", chairs=["Alan Hepburn"], resources=["Milo Wilkinson"], venue="Grand Hyatt Singapore")
E(C, "AI Virtual", "2026-08-06", chairs=["TJ", "Nipun"], online=True, tbc=True)
E(C, "Fireside with Kim Yong, Woh Hup Chairman (Third Generation)", "2026-08-14", time="11:30-14:00", type="Business", chairs=["Elaine Yew (moderator)"], resources=["Kim Yong"])
E(C, "Lifeline Event with Tan Su Shan", "2026-08-19", time="17:00-21:00", chairs=["Bianca Cheo", "Betty Leong"], resources=["Tan Su Shan"])
E(C, "The Menopause Revolution — Spouse Event", "2026-08-27", time="09:30-13:00", type="Health & Wellness", chairs=["Rajul Mehta"], resources=["Rohini Rao"], venue="The Nanson")
E(C, "Lifestyle & Health with Luke Coutinho", "2026-08-28", type="Health & Wellness", chairs=["Rajul Mehta"], resources=["Luke Coutinho"])
E(C, "Nir Eyal Event", "2026-09-01", time="08:30-10:30", resources=["Nir Eyal"])
E(C, "Bob McCooey Event", "2026-09-02", resources=["Bob McCooey"])
E(C, "ECW Training", "2026-09-02..2026-09-03", tbc=True, desc="2–3 Sep or 3–4 Sep.")
E(C, "ExecEd (NUS / INSEAD / IMD) — September", "2026-09")
E(C, "LALA with Melvin Heng", "2026-09-11", time="11:30-14:00", resources=["Melvin Heng"])
E(C, "Breathwork Event with Lucia Giovannini", "2026-09-19", time="09:30-18:00", type="Health & Wellness", chairs=["Rajul Mehta"], resources=["Lucia Giovannini"])
E(C, "LALA with Stephanie Sievers", "2026-09-25", time="11:30-14:00", resources=["Stephanie Sievers"])
E(C, "Lifeline — President Tharman (to be confirmed)", "2026-09")
E(C, "LALA with Scott Chen", "2026-10-02", resources=["Scott Chen"])
E(C, "F1 Event", "2026-10-09", type="Social")
E(C, "Lifeline — A Visiting YPOer", "2026-10")
E(C, "Learning Trip — Jakarta", "2026-10-22", type="Retreat", venue="Jakarta")
E(C, "Diwali Party", "2026-10-30", type="Social")
E(C, "Diwali Event", "2026-11-01", type="Family")
E(C, "LALA with Ng Gim Choo, EtonHouse Founder", "2026-11-13", time="11:30-14:00", chairs=["Jaelle Ang (moderator)"], resources=["Ng Gim Choo"])
E(C, "Learning Trip — Taiwan", "2026-11-15..2026-11-18", type="Retreat", chairs=["Surbhit", "Adelena", "Teck Moh"], venue="Taiwan")
E(C, "LALA — Amrita Randhawa, Publicis", "2026-11-23", time="16:00-19:00", resources=["Amrita Randhawa"])
E(C, "ExecEd (NUS / INSEAD / IMD) — November", "2026-11")
E(C, "LALA — Haji Munshi", "2026-12-01", resources=["Haji Munshi"])
E(C, "Christmas Party", "2026-12-06", type="Social")
E(C, "Maldives / SEA — Couples", "2026-12-10..2026-12-13", type="Retreat", venue="Maldives")
E(C, "LALA — Loh Lik Peng", "2027-01-15", resources=["Loh Lik Peng"])
E(C, "Mahjong — Spouse Event", "2027-01-16", type="Social", chairs=["Rajul Mehta"], venue="American Club")
E(C, "Intriguing Conversation", "2027-01-21")
E(C, "Gautam Kumra Book Event x McKinsey", "2027-01-29", type="Business", resources=["Gautam Kumra"])
E(C, "Chinese New Year Engagement", "2027-01-31", type="Family")
E(C, "CIPLA — Kamil Hamied", "2027-01", type="Business", chairs=["Hari Krishnan"], resources=["Kamil Hamied"])
E(C, "ExecEd (NUS / INSEAD / IMD) — February", "2027-02")
E(C, "Lifeline — Ho Kwon Ping (to be confirmed)", "2027-02")
E(C, "Spouse LALA", "2027-02")
E(C, "Chapter Retreat — India", "2027-02", type="Retreat", venue="India", desc="End of February.")
E(C, "Trip — Cambodia Cataract", "2027-03-25..2027-03-28", type="Social Impact", venue="Cambodia", desc="Depart Thu 25 Mar at 4.30pm; optional 1-day extension.")
E(C, "LALA — Youngro (to be confirmed)", "2027-04")
E(C, "Kids Session with SRT", "2027-05", type="Family", chairs=["Asha", "Eleanor"])
E(C, "Cambodia Cataract Mission", "2027-05-14..2027-05-17", type="Social Impact", venue="Cambodia")
E(C, "Kids Improv Session", "2027-05-22", type="Family")
E(C, "Trip — Africa Family Safari", "2027-06-19..2027-06-27", type="Retreat", venue="Africa")

# ----------------------------------------------------------------------------------------------------------------- Thailand Gold
C = "THG"
E(C, "Raxa Retreat", "2026-07", type="Retreat")
E(C, "Wine Education Event", "2026-08", type="Social", chairs=["Nop", "Chone"])
E(C, "Leadership in an AI-ready Organization", "2026-09", type="Leadership", chairs=["Burt", "B"])
E(C, "China 5.0", "2026-11", chairs=["Kas"], desc="Late November.")
E(C, "Economic Outlook", "2027-01", type="Business", chairs=["Pae"])
E(C, "NDO Music Fest", "2027-01", type="Social", chairs=["NDO Forum"])
E(C, "Blue Zone 2.0 Retreat", "2027-05", type="Retreat", chairs=["Yui", "Ko"])

# ----------------------------------------------------------------------------------------------------------------- Thailand
C = "TH"
E(C, "China Insights: Beyond the Headlines", "2026-07-14", time="18:00-21:00", type="Business", chairs=["Pop Soravit"], resources=["Aj Arm"], venue="Dusit Thani")
E(C, "A Multi-Billion Sushi Stall: The story of a university student who refused to see limits", "2026-08-04", time="18:00-21:00", type="Business", chairs=["Boom Jitpon"], resources=["K. Sharp Shinkanzen"], venue="Siam@Siam")
E(C, "CEOs Roundtable with K. Nakrin", "2026-08-28", time="18:00-21:00", type="Business", chairs=["Sun Sittipat"], resources=["Nakrin Narula"], venue="Wahlok")
E(C, "AI Twin", "2026-09")
E(C, "Family Forum", "2026-09", type="Forum")
E(C, "GPHG", "2026-10-16", time="11:00-14:00", resources=["Note Narun"])
E(C, "CEO Sleep Room", "2026-11", type="Health & Wellness")
E(C, "Parent & Child Retreat (6–13 years)", "2026-11", type="Family")
E(C, "Chapter Retreat — Taiwan", "2026-11-26..2026-11-29", type="Retreat", chairs=["Flow Forum"], venue="Taiwan")
E(C, "Christmas Party", "2026-12-20", type="Family", chairs=["Rise Forum"], venue="Sama Garden x Beat Active, BITEC")
E(C, "Member & Teen Retreat", "2026-12", type="Family")
E(C, "Future Food Safety", "2027-02", type="Business", chairs=["Santi"], resources=["K.Bank Sea Value"])
E(C, "The Decision Lab", "2027-03")
E(C, "Family Retreat: The Thai Polo", "2027-03", type="Family")
E(C, "AGM & Gala", "2027-06-25", time="15:00-21:00", type="Social")

# ----------------------------------------------------------------------------------------------------------------- Myanmar (Yangon calendar)
C = "MM"
E(C, "YPO x World Bank Series", "2026-08-13..2026-08-14")
E(C, "YPO Uncorked: An Evening of Flavours & Friendships", "2026-08-22", type="Social")
E(C, "Wellness / Longevity", "2026-09-10", type="Health & Wellness")
E(C, "Shaolin Experience", "2026-09-20", type="Personal Growth", desc="Experience and cultural learning.")
E(C, "Dine-Around 1", "2026-11-01", type="Networking")
E(C, "Family Forum Training with CFF (Virtual)", "2026-11", type="Forum", online=True, visibility="REGIONAL", desc="YPO-style forum designed for family members: spouses and children aged 5 to 37. Open to the region.")
E(C, "YPO Gives Back", "2026-11-15..2026-11-16", type="Social Impact")
E(C, "Taste of Hyrox", "2026-11", type="Health & Wellness")
E(C, "Chapter Family Retreat", "2026-12", type="Retreat", visibility="REGIONAL", desc="Mid December. Open to the region.")
E(C, "Year-end Social", "2026-12", type="Social")
E(C, "Success Across Generations (S-2)", "2027-01", type="Family")
E(C, "AI Event", "2027-01")
E(C, "Taste of YPO in Mandalay", "2027-01", type="Networking", venue="Mandalay", desc="End of January.")
E(C, "Dine-Around 2 (Gold Dinner)", "2027-02", type="Networking")
E(C, "YPO Yoma Yangon Marathon", "2027-02", type="Family")
E(C, "Executive Education with Prof Boris Groysberg (Series II)", "2027-03", resources=[("Professor Boris Groysberg", "Harvard Business School")])
E(C, "YPO Global Members Visit to Yangon", "2027-03-18..2027-03-24", type="Networking", chairs=["Pascal"])
E(C, "Chapter Retreat — Himalayas", "2027-03-26..2027-03-30", type="Retreat", chairs=["Pascal", "Yin Min Han"])
E(C, "Thingyan / Family Day", "2027-04", type="Family")
E(C, "Day Chair Training", "2027-06")
E(C, "YIC Annual General Meeting", "2027-06-26", type="Social")

# ----------------------------------------------------------------------------------------------------------------- Straits Tigers (poster)
C = "STIG"
E(C, "The Craft Behind Taste", "2026-08-20", type="Social", desc="An exploration of food, wine, cocktails and premium experiences through the lens of craftsmanship, perception and excellence. Engagement + learning.")
E(C, "Inside Vietnam", "2026-09-10..2026-09-12", type="Retreat", venue="Vietnam", desc="A deep immersion into Vietnam's culture, economy, politics and society. Designed to reveal the Vietnam most visitors never see.")
E(C, "Building Great Companies", "2026-10-15", type="Business", desc="An exclusive session with leading builders and operators of great companies. Exploring what it takes to build enduring businesses, strong teams and scalable, resilient organisations.")
E(C, "India 2047", "2026-11-19..2026-11-21", type="Retreat", venue="India", desc="Exploring one of the world's most ambitious economic, technological and societal transformation agendas as India builds towards its vision of a developed nation by 2047.")
E(C, "Masters of Performance", "2026-12-03", desc="An evening with exceptional performers, whether athletes, mentalists, negotiators or others who perform under pressure. Exploring what separates good from exceptional when the stakes are highest.")
E(C, "Operating at Scale", "2027-01-15", type="Business", desc="A behind-the-scenes look at a world-class operation. From manufacturing and logistics to infrastructure and technology, we explore how excellence is delivered consistently at scale.")
E(C, "Inner Operating System: East Bali", "2027-03-11..2027-03-13", type="Retreat", venue="East Bali, Indonesia", desc="A wellness and personal development experience focused on energy, mindset, resilience and sustainable performance. Investing in the one system that runs everything: yourself.")
E(C, "Collectors & Obsessions", "2027-04-08", type="Social", desc="An evening with passionate collectors, creators and connoisseurs. Exploring judgment, expertise, taste and what obsession can teach us about excellence.")
E(C, "Stewardship Across Generations", "2027-05-14", type="Business", desc="A conversation with owners and stewards of enduring enterprises. Exploring succession, stewardship, ownership and building organisations that outlast us.")
E(C, "Above the Noise: Japanese Alps", "2027-06-17..2027-06-20", type="Retreat", venue="Japanese Alps, Japan", desc="The year's culminating flagship experience. Set amidst the Japanese Alps, this journey combines awe, perspective, movement and unique access. Designed to create deeper conversations, stronger connections and a chance to step away from the demands of daily life to gain a longer view.")

# ----------------------------------------------------------------------------------------------------------------- write
data = {
    "renames": RENAMES,
    "chapters": [{"code": c, "name": n, "country": k, "isActive": True} for c, n, k in CHAPTERS],
    "eventTypes": [{"name": n, "color": col, "sortOrder": i, "isActive": True} for i, (n, col) in enumerate(EVENT_TYPES)],
    "events": events,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(data, open(OUT, "w"), ensure_ascii=False, indent=1)
by = {}
for e in events:
    by.setdefault(e["hostChapter"], [0, 0])[0 if e["status"] == "PUBLISHED" else 1] += 1
print(f"{len(events)} events written to {OUT}")
for code, (pub, dr) in sorted(by.items()):
    print(f"  {code:6} published {pub:3}  draft {dr:3}")
