# 02 — Market Analysis (Parts 3–6)

**Audience:** CEO, Product, Architecture  
**Scope:** International + India HRMS landscape; competitive and gap analysis; MVP product strategy for an internal NestJS + React + PostgreSQL modular monolith (~500 FTE India IT consultancy; greytHR incumbent; 4 engineers × 12 weeks; zero/minimal cloud cost initially).  
**Evidence labels:** **Fact** | **Assumption** | **Estimate** | **Metric-to-measure** (see [00-README.md](00-README.md)).  
**Claim hygiene:** Vendor marketing claims are labeled as such. Independent review *patterns* (G2/Capterra aggregates, buyer guides, analyst summaries) are labeled separately from exact competitor pricing or market-share numbers that are not published on verified pages.

**Locked constraint (Fact — company decision):** Do **not** build a full Indian statutory payroll engine in MVP. Keep greytHR payroll (or integrate later). Do **not** edit the project plan file.

**Companion appendix:** [appendices/competitor-matrix.md](appendices/competitor-matrix.md)

---

## Part 3 — Current Market HRMS Analysis

### 3.1 International enterprise HCM (brief)

| Segment | Typical buyers | Characteristic pattern | Relevance to our ~500 India IT consultancy |
|---------|----------------|------------------------|---------------------------------------------|
| Global suite (Workday, SAP SuccessFactors, Oracle HCM) | Large multi-entity, multi-country | High capability, long implementations, premium TCO | Poor fit for MVP economics and timeline |
| Mid-market US/EU (BambooHR, HiBob, UKG/ADP mid) | SMB–mid-market, often US/EU payroll | Strong UX / workforce mgmt; India payroll weak or absent | Useful UX/product lessons; not buy-path for India statutory |
| HR + IT + Finance platforms (Rippling) | Fast-growth, often US-led global | Modular unification; pricing complexity | Interesting architecture lesson; overspec + cost for India-only |
| Global employment / EOR-adjacent (Deel, Remote-class) | Cross-border hiring | Employment + payroll rails | Not a replacement for India consultancy core HRMS |

**Independent pattern (Avasant / Computer Economics lineage):** HCM suites show **high adoption** but comparatively **lower satisfaction and only moderate ROI/TCO success**, often attributed to suite complexity, change management shortfalls, and the tension between integrated suites vs. best-of-breed stacks that force employees to switch tools.  
Sources: [Despite High Adoption, HCM Systems Fail to Deliver on Satisfaction and ROI — Avasant](https://avasant.com/report/despite-high-adoption-hcm-systems-fail-to-deliver-on-satisfaction-and-roi/), [HCM Ever Popular, but Satisfaction Lags — Avasant](https://avasant.com/report/hcm-ever-popular-but-satisfaction-lags/), [Cloud HCM Suites 2024–2025 RadarView — Avasant](https://avasant.com/report/cloud-hcm-suites-2024-2025-radarview/).

**Implication for us (Assumption):** Building “another full suite” that mirrors Darwinbox/Workday breadth will recreate the satisfaction gap. Prefer a **narrow, high-adoption core** (ESS, manager workflows, attendance/leave, documents, analytics slice) with **payroll kept external**.

### 3.2 India HRMS market (mid-market focus)

India mid-market buyers (~200–2,000 FTE) typically optimize for:

1. **Statutory payroll & compliance depth** (PF, ESI, PT, LWF, TDS, Form 16, state variance) — **Fact:** this is where greytHR, Keka, Pocket HRMS, and similar vendors compete hardest.  
2. **Attendance / biometric / geo / shift** — high operational load for IT consultancies with hybrid/client-site work.  
3. **ESS + manager approvals** — daily volume; UX determines adoption.  
4. **Implementation speed & admin self-service** — scarce HRIS specialists.  
5. **Total cost of ownership** including add-ons (SSO, API, recruit, PMS, expense).

**Competitive clusters (descriptive, not market-share claims):**

| Cluster | Examples | Typical pitch (vendor) | Independent / buyer-guide pattern |
|---------|----------|------------------------|-----------------------------------|
| India payroll-strong SMB/mid | greytHR, Keka, Pocket HRMS, Zoho People (+ Zoho Payroll) | Compliance + PEPM affordability | Payroll strength; uneven UX / support / mobile parity |
| India enterprise / scale-up suite | Darwinbox, PeopleStrong | Configurable HCM + talent | Config/implementation weight; often overspec under ~500–1000 |
| Recruitment-led | Freshteam (Freshworks HRMS) | ATS + Freshworks suite | Weak as sole India payroll system of record |
| Global products used in India | BambooHR, Workday, Rippling, Deel/HiBob | Global brand / UX / unification | India payroll usually external or secondary |

**Our incumbent (Fact):** Company runs **greytHR** today. Any build must treat greytHR as (a) source of truth for payroll during MVP, (b) migration/integration partner, not a product to replicate wholesale.

**Third-party India roundups (directional, often vendor-biased):** [PeoplePilot — best HR software India](https://www.peoplepilot.io/blog/best-hr-software-in-india-2026), [HROne — Darwinbox review](https://hrone.cloud/blog/darwinbox-review-india/), [thePeopleStack — Rippling vs Workday vs BambooHR](https://www.thepeoplestack.co/post/rippling-vs-workday-vs-bamboohr-decision-guide-2026).

---

## Part 4 — Product Landscape (Profiles)

Evidence key: **V** = vendor site claim; **I** = independent buyer guide / review-site *pattern*; **C** = company context / planning assumption.

### 4.1 Workday (enterprise — brief)

| Dimension | Assessment |
|-----------|------------|
| Positioning | Cloud HCM / Finance suite for large organizations |
| Fit for ~500 India IT | **Poor** for our constraints |
| Strengths (I) | Breadth, analytics, global enterprise credibility |
| Weaknesses (I) | Cost, complexity, implementation burden |
| Implementation (I) | Traditional deployments commonly cited in the **6–18 month** range; accelerated “Launch/GO”-style paths can be shorter for standardized mid-market configs — still heavy vs. 12-week internal build |
| Pricing | **Unknown / not verified publicly** as list price (custom quote). Third-party guides publish PEPM *ranges* — treat as **Estimate from secondary sources**, not Fact |

**Independent guides (2025–2026 patterns):** Mid-market buyers are cautioned that Workday remains expensive/administratively heavy under roughly **500–1,000** employees for many orgs; enterprise implementations often measured in many months.  
Sources: [OutSail — Workday reviews / pricing / pros-cons](https://www.outsail.co/post/workday-reviews-pricing-pros-cons-user-reviews), [OutSail — Workday vs Rippling 2026](https://www.outsail.co/post/workday-vs-rippling-a-2026-comparison), [thePeopleStack 2026 decision guide](https://www.thepeoplestack.co/post/rippling-vs-workday-vs-bamboohr-decision-guide-2026), [teamed. — Workday for small companies](https://www.teamed.global/insights/workday-for-small-companies-implementation-guide-2025).

**Our response:** Do not compete with Workday. Steal nothing except the lesson: **over-scope kills ROI**.

### 4.2 SAP SuccessFactors (enterprise — brief)

| Dimension | Assessment |
|-----------|------------|
| Positioning | Enterprise talent + HCM, often alongside SAP ERP |
| India payroll | Frequently partner/localization-dependent (**I** pattern in India buyer guides) |
| Fit | Poor for 4-engineer / 12-week / India-only internal MVP |

**Our response:** Out of scope as buy-option and as feature target.

### 4.3 Oracle HCM Cloud (enterprise — brief)

| Dimension | Assessment |
|-----------|------------|
| Positioning | Enterprise HCM within Oracle Cloud Applications |
| Fit | Same as Workday/SAP — enterprise TCO and SI dependency |

**Our response:** Ignore for MVP product design.

### 4.4 UKG / ADP (brief)

| Dimension | Assessment |
|-----------|------------|
| Positioning | Workforce management / payroll giants (US-heavy heritage; global footprints) |
| India relevance | Not primary India mid-market “system of record” for our peer set (**Assumption**) |
| Lesson | Deep WFM (schedules, time) is a specialist domain — do not over-build shift complexity in week 1 |

### 4.5 BambooHR

| Dimension | Assessment |
|-----------|------------|
| Strengths (I/V) | Simplicity, core HRIS UX, ATS for SMB |
| Weaknesses for India (I) | **No Indian statutory payroll** (EPF/ESI/PT/TDS); common pattern is BambooHR + Indian payroll underneath |
| Pricing | Quote-based; historical PEPM figures appear in secondary blogs — **not treated as Fact here** |

Sources: [Peorient — HR software for India payroll](https://peorient.com/blog/hr-software-india/), [TopHRSoftware — BambooHR vs Rippling](https://tophrsoftware.com/comparisons/bamboohr-vs-rippling), [thePeopleStack](https://www.thepeoplestack.co/post/rippling-vs-workday-vs-bamboohr-decision-guide-2026).

**Our response:** Compete on **simplicity and ESS clarity** (Bamboo-like), not on global brand. Keep payroll external (greytHR) — same architectural pattern BambooHR forces in India.

### 4.6 Rippling

| Dimension | Assessment |
|-----------|------------|
| Positioning (V) | HR + IT + Finance unification; modular platform |
| Strengths (I) | Automation, single employee graph, IT provisioning story |
| Weaknesses (I) | **Modular pricing complexity**; TCO rises as modules stack; implementation not “flip a switch” for full platform |
| Pricing (V / vendor blog) | Vendor materials describe modular PEPM (e.g., core HRIS and payroll as separate lines). Exact contract totals vary — do not invent bundle totals |

Sources: [Rippling — payroll review / modular pricing (vendor)](https://www.rippling.com/blog/rippling-payroll-review), [PeopleOpsClub — BambooHR vs Rippling](https://peopleopsclub.com/compare/bamboohr-vs-rippling), [OutSail — Workday vs Rippling](https://www.outsail.co/post/workday-vs-rippling-a-2026-comparison).

**Our response:** Adopt the **employee master + modular domains** idea in architecture (`tenant_id`, bounded contexts). Do **not** chase IT/device management or global payroll in MVP.

### 4.7 Deel / HiBob (as relevant)

| Product | Relevance |
|---------|-----------|
| **Deel** | Cross-border employment / payroll aggregation narrative. Relevant only if company later hires abroad — **out of MVP** (India-only). |
| **HiBob** | Mid-market people platform with strong culture/UX reputation in US/EU. **India payroll not a primary differentiator** for our buy decision. |

**Our response:** Study UX patterns for manager experience; do not position against Deel/HiBob commercially in Stage A.

### 4.8 Zoho People

| Dimension | Assessment |
|-----------|------------|
| Positioning | Affordable HR within Zoho ecosystem |
| Strengths (I/V) | Price entry, Zoho suite glue |
| Weaknesses (I) | Payroll often **separate** (Zoho Payroll); compliance depth cited as shallower than greytHR/Keka in India comparisons; support quality mixed at SMB tiers |

Sources: [HROne — Zoho People alternatives India](https://hrone.cloud/blog/zoho-people-alternatives-india/), [NeuralHR — Best HR software India](https://neuralhr.ai/en/best-hr-software-india) (third-party roundup; treat rankings as **opinion**, not Fact), [PeoplePilot India roundup](https://www.peoplepilot.io/blog/best-hr-software-in-india-2026).

**Our response:** Validate that “cheap PEPM” without workflow depth still leaves HR ops in spreadsheets — our wedge is **ops workflows + analytics**, not race-to-bottom pricing (we are building internal-first).

### 4.9 Darwinbox

| Dimension | Assessment |
|-----------|------------|
| Positioning (V) | Enterprise / mid-market HCM born for Asia; broad module set |
| Strengths (I/V) | Configurability, mobile-first narrative, India/APAC localization story |
| Weaknesses (I) | **Config & implementation complexity**; module sprawl risk (buy many, use few); often **overspec for ~500 FTE** with limited HRIS admin capacity |
| Pricing | Custom quote — **Unknown / not verified publicly** as list. Secondary sites publish PEPM *estimates*; treat as **Estimate / unverified** |
| Implementation (I) | Commonly cited in multi-month ranges (e.g., ~3–6 months class in partner/review commentary); vendor case studies may show faster — treat **V** success metrics as vendor-reported |

Sources: [hr.software Darwinbox review](https://www.hr.software/reviews/darwinbox), [Skima — Darwinbox review 2026](https://skima.ai/blog/product-deep-dives/darwinbox-reviews), [HROne Darwinbox review India](https://hrone.cloud/blog/darwinbox-review-india/), [Mainstay — Darwinbox vs SAP vs Workday](https://mainstayconsulting.in/hrms-comparison-for-indian-enterprises/), vendor case study: [Emcure / Darwinbox](https://explore.darwinbox.com/resources/casestudy/emcure) (**V**).

**Our response:** Do not replicate Darwinbox breadth. Compete later (SaaS) on **time-to-value for mid-market India IT**, not enterprise config surface area.

### 4.10 Keka

| Dimension | Assessment |
|-----------|------------|
| Positioning (V) | Modern people ops for growing Indian businesses |
| Strengths (I — G2/Capterra patterns) | Frequently praised **UX / ease of use**, consolidated HR ops |
| Weaknesses (I — review patterns) | Recurring themes: **support responsiveness**, **mobile parity vs web**, **customization / reporting limits**, occasional implementation friction |
| Pricing | Typically quote / custom — **Unknown / not verified publicly** as a complete list comparable to greytHR’s published cards |

Sources: [G2 — Keka](https://ai.g2.com/product/keka), [Capterra / Software Advice Keka reviews](https://www.softwareadvice.com/hr/keka-profile/reviews/), [Capterra SG Keka](https://www.capterra.com.sg/software/149253/keka), App Store themes: [Keka HR iOS](https://apps.apple.com/in/app/keka-hr/id1448024119).

**Our response:** Match or beat **perceived UX quality** for ESS/Manager. Differentiate on **supportability we control** (internal product) and **reporting flexibility** for consultancy delivery metrics. Do not attempt to out-payroll Keka in MVP.

### 4.11 greytHR (incumbent — deep dive)

| Dimension | Detail | Label |
|-----------|--------|-------|
| Vendor | [greythr.com](https://www.greythr.com/) | Fact (V) |
| Published pricing | Essential from **₹2,495/month** (first 50 employees) + **₹45/emp** above 50; Growth from **₹4,495/month** + **₹85/emp** above 50; Premium **custom** | Fact (V) — [Pricing](https://www.greythr.com/pricing/) |
| Plan content (V) | Every plan includes complete payroll, leave, ESS basics; attendance & advanced HR on Growth+; many modules as add-ons | Fact (V) |
| Add-ons (V) | Expense, PMS, Recruit (e.g. **₹2,500/recruiter/month** on pricing page), GeoMark+/Visage, etc. | Fact (V) |
| SSO & API | Documented as **add-ons** on Essential/Growth; SSO (SAML) and REST API shown as PEPM add-ons on vendor calculators (e.g. SSO ~₹10/emp/mo, REST API ~₹15/emp/mo on ROI calculator — **vendor-published indicative**) | Fact (V) — [ROI calculator](https://www.greythr.com/roi-calculator/), [Price calculator](https://www.greythr.com/pricing-calculator/), [SSO help](https://greythr.freshdesk.com/support/solutions/articles/1060000065666-how-can-admin-enable-sso-based-login-with-greythr-), [API docs](https://api-docs.greythr.com/) |
| Strengths | India payroll/compliance, attendance ecosystem, broad SMB install base claims (vendor: “30,000+ companies” on pricing page — **V**, not independently audited here) | Fact (V) / Assumption on “best payroll keep” |
| Weaknesses for *our* build thesis | Add-on tax for SSO/API; product breadth optimized for payroll-centric SMB; may feel limited for IT consultancy **project/resource** workflows and custom analytics | Assumption — validate with HR/IT stakeholders |
| MVP strategy | **Keep payroll on greytHR**; build PeopleOS as HR ops + ESS/manager system of engagement; integrate via API when add-on economics justified | Locked decision |

**Estimate (illustrative TCO math, not ROI claim):** At ~500 employees on Growth: `₹4,495 + ₹85 × 450 ≈ ₹42,745/month` before GST/add-ons (**Estimate** from published formula). SSO+API PEPM add-ons could add further thousands/month if licensed on full headcount (**Estimate**). Exact invoice depends on negotiated contract — verify with Finance.

**CEO honesty check:** If the only goal is “run India payroll reliably,” **continuing greytHR (buy)** is often rational. Build is justified by **platform ownership + workflow/UX/API differentiation + SaaS path**, not by beating greytHR at PF/ESI filing in 12 weeks.

**Metric-to-measure:** Current greytHR invoice (base + add-ons + GST); % of HR tickets attributable to ESS vs payroll; API call volume if API already purchased.

### 4.12 PeopleStrong

| Dimension | Assessment |
|-----------|------------|
| Positioning (V) | India enterprise HCM; mobile ESS; built-in Indian payroll narrative |
| Strengths (V) | Compliance + mobile + workflows for large Indian enterprises |
| Weaknesses (I — competitor blog patterns) | Desktop clutter / approval lag themes appear in third-party comparisons; implementation measured in weeks (often 8–14 cited) — **treat competitor blogs as biased** |
| Fit for us | Viable *buy* alternative to Darwinbox for larger India enterprises; heavy vs. building internal MVP |

Source examples: [PeopleStrong vs Zoho People (vendor)](https://www.peoplestrong.com/compare/zoho-people/), [HROne — PeopleStrong alternatives](https://hrone.cloud/blog/peoplestrong-alternatives/).

### 4.13 Pocket HRMS

| Dimension | Assessment |
|-----------|------------|
| Positioning | SMB India HR + payroll; attendance/shop-floor friendliness |
| Fit | Better for smaller / manufacturing-heavy than 500-FTE IT consultancy with complex professional-services workflows (**Assumption**) |
| Pricing | Custom / PEPM — **Unknown / not verified publicly** in this document |

### 4.14 Freshteam (Freshworks)

| Dimension | Assessment |
|-----------|------------|
| Positioning | Recruitment / ATS-led HR; Freshworks ecosystem |
| Strengths | Hiring workflow, free tier historically for small teams |
| Weaknesses for India HRMS | Payroll & Indian statutory **not** the product center; unsuitable as sole replacement for greytHR |

Sources: [NeuralHR roundup](https://neuralhr.ai/en/best-hr-software-india), [Softwr Freshteam vs Zoho People](https://www.softwr.com/compare/freshteam-vs-zoho-people).

---

## Part 5 — Competitive Analysis

### 5.1 Segment comparison table

| Product | Primary geography | Best-fit size (I/V pattern) | India payroll depth | Implementation weight | Price transparency | Threat to our internal build |
|---------|-------------------|----------------------------|---------------------|-----------------------|--------------------|------------------------------|
| Workday | Global enterprise | Often 1,000+ (mid-market Launch expanding) | Partner / limited native India story | High (months) | Low (quote) | Low (wrong economics) |
| SAP SF | Global enterprise | Large / SAP houses | Partner-heavy India | High | Low | Low |
| Oracle HCM | Global enterprise | Large | Enterprise SI | High | Low | Low |
| UKG/ADP | US/global WFM | Mid–large | Not India mid default | Med–High | Low | Low |
| BambooHR | US/global SMB | SMB–mid | Weak / none India | Low–Med | Quote | Low (complement pattern) |
| Rippling | US-led global | Mid-market growth | Expanding global payroll (**V**) | Med | Modular (complex) | Low–Med (cost) |
| Deel / HiBob | Global | Cross-border / mid | EOR / non-India-core | Med | Quote | Low |
| Zoho People | India + global SMB | SMB | Partial / separate payroll | Low | Relatively open | Med (cheap buy) |
| Darwinbox | India/APAC enterprise | Mid–large | Strong (**V/I**) | Med–High | Quote | Med (overspec) |
| Keka | India mid | SMB–mid | Strong | Med | Quote | **High** (closest peer buy) |
| greytHR | India SMB–mid | SMB–mid | **Strong (incumbent)** | Low–Med | **Published cards** | **High** (status quo) |
| PeopleStrong | India enterprise | Mid–large | Strong (**V**) | Med | Quote | Med |
| Pocket HRMS | India SMB | Small | Native | Low | Opaque | Low |
| Freshteam | Global SMB hiring | Small hiring teams | Not native | Low | Tiered historically | Low |

### 5.2 Capability heat map (MVP-relevant)

Legend: ● Strong / ○ Partial / – Weak or N/A / ? Unknown publicly. Judgments mix **V** and **I**; not a lab benchmark.

| Capability | greytHR | Keka | Darwinbox | Zoho People | BambooHR | Rippling | Workday |
|------------|---------|------|-----------|-------------|----------|----------|---------|
| India statutory payroll | ● | ● | ● | ○ | – | ○/? | ○/? |
| Attendance / time | ● | ● | ● | ○ | ○ | ● | ● |
| Leave / ESS | ● | ● | ● | ● | ● | ● | ● |
| Manager workflows | ○ | ● | ● | ○ | ● | ● | ● |
| Performance | ○ (add-on) | ● | ● | ○ | ○ | ○ | ● |
| Recruit / ATS | ○ (add-on) | ● | ● | ○ | ● | ○ | ● |
| Analytics / custom reports | ○ | ○ | ● | ○ | ○ | ● | ● |
| SSO / API openness | ○ (add-on) | ? | ● | ○ | ○ | ● | ● |
| Mobile parity | ○ | ○ (complaint pattern) | ● (**V**) | ○ | ○ | ○ | ○ |
| IT consultancy project fit | ○ | ○ | ○ | ○ | – | ○ | ○ |

### 5.3 Product strength analysis (major products)

#### greytHR — strength analysis
- **Core strength:** Payroll + compliance + attendance as a packaged India SMB/mid product with **transparent published pricing**.  
- **Monetization pattern:** Base plan + PEPM overage + **add-on ladder** (SSO, API, Recruit, PMS, Expense, geo/face).  
- **Risk if we stay forever:** Progressive lock-in; analytics and consultancy-specific workflows remain secondary.  
- **Risk if we rip-and-replace payroll:** Compliance regression — **Avoid in MVP**.

#### Keka — strength analysis
- **Core strength:** Modern UX reputation; all-in-one people ops narrative.  
- **Fragility:** Support and mobile parity complaint clusters on review sites.  
- **Buy vs build:** Strongest commercial alternative to continuing greytHR for a 500-FTE India firm — but buying kills the “own the platform / SaaS optionality” thesis (**Assumption** of strategic intent).

#### Darwinbox — strength analysis
- **Core strength:** Enterprise configurability and breadth.  
- **Fragility:** Implementation and unused modules; overspec for lean HR teams.  
- **Buy vs build:** High TCO path; fails 12-week / 4-engineer constraint.

#### Workday / SAP / Oracle — strength analysis
- **Core strength:** Global suite depth and governance.  
- **Fragility:** Time and money. Irrelevant as MVP competitors except as cautionary tales.

#### Rippling — strength analysis
- **Core strength:** Unified employee graph across HR/IT/Finance.  
- **Fragility:** Pricing modularity → surprise TCO.  
- **Lesson for architecture:** Modular monolith with clear domain boundaries mirrors Rippling’s product modularity without their commercial model.

#### BambooHR — strength analysis
- **Core strength:** Ruthless simplicity.  
- **Fragility:** India payroll hole.  
- **Lesson:** UX clarity > feature count for adoption (aligns with Avasant satisfaction gap).

### 5.4 User review / pain-point patterns

Format: **Observed Market Pain → Evidence → Opportunity**

| Observed Market Pain | Evidence | Opportunity for PeopleOS |
|----------------------|----------|---------------------------|
| Suite complexity → low satisfaction despite adoption | Avasant: high adoption, lower satisfaction / moderate ROI-TCO ([link](https://avasant.com/report/despite-high-adoption-hcm-systems-fail-to-deliver-on-satisfaction-and-roi/)) | Ship a **thin vertical** employees actually use daily |
| Employees switch across too many tools | Avasant / Computer Economics commentary on suite vs best-of-breed tension ([link](https://avasant.com/report/hcm-ever-popular-but-satisfaction-lags/)) | One ESS + manager surface for leave, attendance exceptions, docs, approvals; payroll remains greytHR until later |
| Mobile ≠ web | Keka review patterns (Capterra/G2/App Store themes) | Mobile-critical flows first: apply leave, approve, punch/geo exception, payslip *link* |
| Support lag on SaaS HRMS | Keka / mid-market India review patterns | Internal product: SLA we own; knowledge base for managers |
| Reporting / customization ceilings | Keka cons clusters; greytHR add-on analytics limits (**Assumption** pending stakeholder interviews) | Configurable reports for bench, utilization inputs, attrition slices without full BI suite |
| SSO/API gated behind add-ons | greytHR pricing pages & calculators | Design **SSO + API as first-class** in our stack (OIDC + OpenAPI) even if greytHR side remains add-on |
| Enterprise config theater | Darwinbox independent reviews (implementation/config weight); [HROne Darwinbox review](https://hrone.cloud/blog/darwinbox-review-india/) | Opinionated defaults for India IT consultancy; config later |
| Workday/SI cost & timeline | OutSail / thePeopleStack / implementation guides | Never shortlist for this company stage |
| India payroll gap in global HRIS | BambooHR + India payroll pairing articles | Keep greytHR; do not “Bamboo ourselves” without a payroll plan |
| Modular TCO surprises | Rippling buyer guides + vendor modular price | Clear internal module map; avoid surprise add-on theater in future SaaS packaging |

**Metric-to-measure (post-MVP):** ESS weekly active rate; median approval cycle time; % tickets “where do I…?”; manager NPS; payroll-related incidents (should stay on greytHR baseline).

---

## Part 6 — Market Gap Analysis & Product Strategy

### 6.1 Market gaps (relevant to us)

| Gap | Who fails it today | Why it matters at ~500 India IT | Label |
|-----|--------------------|----------------------------------|-------|
| Mid-market **ops UX** without enterprise config tax | Darwinbox / Workday overspec; SMB tools under-deliver analytics | HR ops + delivery managers need speed, not 6-month SI | Assumption + I patterns |
| **API/SSO included** economics | greytHR add-on model | IT consultancies integrate AD/Entra, Jira, project tools | Fact (greytHR add-on) |
| Consultancy-specific data (bench, skills, client allocation) | Generic HRMS treat as afterthought | Revenue depends on staffing, not only attendance | Assumption — validate |
| Honest **payroll hybrid** architecture | Vendors push full suite replacement | Reduces compliance risk; fits 12-week build | Fact (locked decision) |
| Adoption-first design (Avasant gap) | Suites optimized for HR admin, not employee | Satisfaction lag is industry-wide | I (Avasant) |

### 6.2 What we should NOT compete on (validated from research)

| Do not compete on | Why (evidence) |
|-------------------|----------------|
| Full Indian statutory payroll engine | Incumbent greytHR strength; legal/compliance risk; 12-week capacity (**Fact** constraint + **V** greytHR payroll depth) |
| Workday/SAP breadth | Implementation & TCO patterns (**I**) |
| Darwinbox-level configurability | Overspec / unused modules (**I**) |
| Global EOR / multi-country employment | India-only MVP (**Fact**) |
| Rippling IT/device management | Out of HRMS MVP scope; pricing complexity lesson only |
| Published PEPM price war vs Zoho | We are internal-first; SaaS pricing is Stage C+ |
| “AI HR” as MVP differentiator | Industry noise; Avasant notes GenAI expansion — ship workflows first (**Assumption**) |

### 6.3 What we COULD compete on (validated / research-aligned)

| Could compete on | Why | MVP? |
|------------------|-----|------|
| ESS + manager approval UX clarity | Bamboo/Keka praise patterns; Avasant adoption–satisfaction gap | **Yes** |
| Native SSO + API (no add-on tax in *our* product) | greytHR gates SSO/API (**Fact** V) | **Yes** (design); integrate greytHR API if licensed |
| Opinionated India IT consultancy workflows | Gap vs generic SMB HRMS (**Assumption**) | **Partial** MVP |
| Reporting that HR/Delivery actually export | Review-site customization complaints (**I** pattern) | **Yes** (thin) |
| Time-to-value & change management | Suite implementation failures (**I**) | **Yes** (process) |
| Future SaaS: mid-market India “HR ops + payroll integrate” | Hybrid architecture rarely marketed cleanly | **Future** |

### 6.4 Product strategy table

| Market Observation | Competitor Evidence | User Problem | Opportunity | Proposed Response | MVP? | Future SaaS? |
|--------------------|---------------------|--------------|-------------|-------------------|------|--------------|
| High HCM adoption, low satisfaction | Avasant reports | Employees hate cluttered suites | Narrow daily surface | ESS/Manager-first IA | Yes | Yes |
| greytHR strong on payroll | greythr.com pricing & modules | Fear of payroll breakage | Hybrid SoR | Keep greytHR payroll; sync master data | Yes | Optional connector |
| SSO/API often paid add-ons | greytHR pricing/ROI calc | IT wants Entra + integrations | First-class identity & API | OIDC SSO + versioned REST | Yes | Yes (tiering later) |
| Keka wins on UX | G2/Capterra praise | Users compare us to Keka | UX parity | Design system + mobile critical paths | Yes | Yes |
| Keka weak on support/mobile/reporting | Review patterns | Frustration after go-live | Reliability & reports | Internal SLAs; exportable reports | Yes | Yes |
| Darwinbox heavy | Independent reviews / HROne | Mid-market overbuy | Right-sized product | Opinionated defaults, limited config | Yes | Mid-market SKU |
| Workday expensive/slow | OutSail / thePeopleStack | Wrong shortlist | Avoid distraction | Explicit non-goal | N/A | No |
| Rippling modular TCO surprises | Buyer guides + vendor modular price | CFO unpredictability | Clear module map | Modular monolith, simple internal cost | Arch yes | Transparent packaging |
| Bamboo simplicity, weak India payroll | Peorient / thePeopleStack | Global UX ≠ India compliance | Best of both | Bamboo-like UX + greytHR payroll | Yes | India-first SaaS |
| Tool sprawl | Avasant best-of-breed vs suite | Context switching | Single engagement layer | PeopleOS portal; deep links to greytHR payslips | Yes | Marketplace later |
| Freshteam ≠ full HRMS | India roundups | Hiring-only tools leave gaps | Don’t replace ATS blindly | Optional recruit later; integrate if needed | No | Maybe |
| 4 eng × 12 weeks | Capacity (**Estimate**) | Scope creep | Ruthless cut | See “explicit answers” below | Yes | After internal proof |

### 6.5 Explicit strategy answers

#### What to **build** (MVP)
- Employee master (aligned to greytHR IDs), org structure, roles  
- Leave, attendance *exceptions* / policies as needed, approvals  
- ESS + manager consoles (web-first; mobile-responsive)  
- Documents / letters (thin), basic workflows  
- Audit log, RBAC, SSO (Entra/OIDC)  
- Reporting exports (headcount, leave balances, attrition inputs)  
- Integration *stubs* + optional greytHR API sync if licensed  

#### What to **build better** than typical India SMB HRMS
- Identity & API as core (not add-on theater)  
- Manager experience and approval SLAs  
- Consultancy-oriented fields/reports (after discovery)  
- Change-management-friendly simplicity (Avasant lesson)  

#### What to keep **standard** (do not innovate)
- Leave state machines, role models, audit trails, password/SSO flows  
- Document storage patterns, notification basics  

#### What to **integrate** (not rebuild)
- **greytHR payroll & statutory** (locked)  
- Biometric devices if already on greytHR  
- Corporate IdP (Microsoft Entra ID)  
- Email / Teams notifications  
- Later: accounting, ATS, project/PSA tools  

#### What to **avoid**
- Full Indian payroll engine, tax engines, challan automation  
- Global multi-entity / multi-currency employment  
- Darwinbox-scale talent suite (LMS, complex OKR, engagement suite) in MVP  
- AI chatbots as a substitute for missing workflows  
- Premature multi-tenant SaaS operations (schema may include `tenant_id` only)  

#### SaaS differentiation (future — do not fund prematurely)
- “India mid-market HR ops platform with **first-class payroll connectors** (greytHR/Keka/others)” rather than forcing payroll rip-replace  
- Opinionated vertical for **IT consultancies / services** (bench, skills — after internal validation)  
- Transparent packaging (avoid greytHR-style surprise add-ons for SSO/API) — **Assumption** of buyer preference  
- Faster time-to-value than Darwinbox for 200–800 FTE  

**Metric-to-measure before SaaS:** Internal adoption ≥ target WAU; payroll incident rate ≤ greytHR baseline; integration reliability; cost vs status-quo greytHR invoice (**no invented ROI** — measure actual).

---

## Competitive positioning one-pager

```text
                    India payroll depth
                         high
                          │
           greytHR ●      │      ● Keka
           Pocket  ●      │      ● PeopleStrong
                          │           ● Darwinbox
     UX /                 │
     simplicity  ─────────┼─────────────────── enterprise config
                          │
           Zoho ●         │      ○ Workday/SAP
           Bamboo ●       │
                          │
                         low
                          │
                    PeopleOS MVP target:
                    high UX, medium ops depth,
                    payroll via greytHR connector (not on Y-axis yet)
```

---

## Sources

### Vendor / primary
- [greytHR](https://www.greythr.com/)
- [greytHR Pricing](https://www.greythr.com/pricing/)
- [greytHR Price Calculator](https://www.greythr.com/pricing-calculator/)
- [greytHR ROI Calculator](https://www.greythr.com/roi-calculator/)
- [greytHR SSO help](https://greythr.freshdesk.com/support/solutions/articles/1060000065666-how-can-admin-enable-sso-based-login-with-greythr-)
- [greytHR API docs](https://api-docs.greythr.com/)
- [Rippling payroll review (vendor)](https://www.rippling.com/blog/rippling-payroll-review)
- [PeopleStrong vs Zoho People (vendor)](https://www.peoplestrong.com/compare/zoho-people/)
- [Darwinbox Emcure case study (vendor)](https://explore.darwinbox.com/resources/casestudy/emcure)

### Independent / buyer guides / analyst summaries
- [Avasant — Despite High Adoption…](https://avasant.com/report/despite-high-adoption-hcm-systems-fail-to-deliver-on-satisfaction-and-roi/)
- [Avasant — HCM Ever Popular, but Satisfaction Lags](https://avasant.com/report/hcm-ever-popular-but-satisfaction-lags/)
- [Avasant — Cloud HCM Suites 2024–2025 RadarView](https://avasant.com/report/cloud-hcm-suites-2024-2025-radarview/)
- [OutSail — Workday reviews](https://www.outsail.co/post/workday-reviews-pricing-pros-cons-user-reviews)
- [OutSail — Workday vs Rippling 2026](https://www.outsail.co/post/workday-vs-rippling-a-2026-comparison)
- [thePeopleStack — Rippling vs Workday vs BambooHR 2026](https://www.thepeoplestack.co/post/rippling-vs-workday-vs-bamboohr-decision-guide-2026)
- [PeoplePilot — Best HR software India 2026](https://www.peoplepilot.io/blog/best-hr-software-in-india-2026)
- [HROne — Darwinbox review India](https://hrone.cloud/blog/darwinbox-review-india/)
- [hr.software — Darwinbox review](https://www.hr.software/reviews/darwinbox)
- [Skima — Darwinbox review 2026](https://skima.ai/blog/product-deep-dives/darwinbox-reviews)
- [Mainstay — Darwinbox vs SAP vs Workday](https://mainstayconsulting.in/hrms-comparison-for-indian-enterprises/)
- [G2 — Keka](https://ai.g2.com/product/keka)
- [Software Advice — Keka reviews](https://www.softwareadvice.com/hr/keka-profile/reviews/)
- [Capterra — Keka](https://www.capterra.com.sg/software/149253/keka)
- [Peorient — HR software India payroll](https://peorient.com/blog/hr-software-india/)
- [PeopleOpsClub — BambooHR vs Rippling](https://peopleopsclub.com/compare/bamboohr-vs-rippling)
- [HROne — PeopleStrong alternatives](https://hrone.cloud/blog/peoplestrong-alternatives/)
- [HROne — Zoho People alternatives](https://hrone.cloud/blog/zoho-people-alternatives-india/)
- [NeuralHR — Best HR software India](https://neuralhr.ai/en/best-hr-software-india)

### Note on review sites
G2/Capterra aggregates are **directional patterns**, not statistically controlled studies. Competitor blogs (e.g., HROne comparing peers) are **biased**. Prefer greytHR published pricing as Fact; treat PEPM estimates for Darwinbox/Keka/Workday from secondary sites as **Estimate / not verified**.

---

*Document owner: Product + Solution Architect. Refresh after stakeholder discovery and greytHR invoice/API entitlement review. Do not invent ROI for CEO pack — attach measured baselines only.*
