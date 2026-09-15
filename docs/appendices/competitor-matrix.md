# Appendix — Competitor Capability Matrix

**Parent document:** [02-market-analysis.md](../02-market-analysis.md)  
**Purpose:** Side-by-side capability comparison for products relevant to a ~500-employee India IT consultancy currently on greytHR, evaluating buy options and informing what an internal NestJS + React + PostgreSQL HRMS (PeopleOS) should and should not replicate.  
**Evidence labels:** **Fact** (cited public page) | **Assumption** | **Estimate** | **Metric-to-measure**.  
**Unknowns:** Marked **Unknown / not verified publicly** when list pricing, multi-tenancy internals, or module depth cannot be confirmed from public pages without a sales demo.  
**Bias warning:** Vendor sites over-claim; G2/Capterra themes are *patterns*; competitor comparison blogs (e.g., HROne) are commercially biased.

**How to read cells**
- **Native** = generally offered in-product for the stated market  
- **Add-on / separate** = sold separately or via partner  
- **Weak / limited** = frequently cited as shallow for India mid-market  
- **N/A** = not a meaningful product focus  

---

## 1. Positioning snapshot

| Attribute | Workday | SAP SuccessFactors | Oracle HCM | UKG / ADP (brief) | BambooHR | Rippling | Deel | HiBob | Zoho People | Darwinbox | Keka | greytHR | PeopleStrong | Pocket HRMS | Freshteam |
|-----------|---------|-------------------|------------|-------------------|----------|----------|------|-------|-------------|-----------|------|---------|--------------|-------------|---------|
| **Target customer** | Global enterprises & expanding mid-market | Large enterprises, often SAP ERP estates | Large Oracle Cloud enterprises | Mid–large workforce / payroll buyers (US-heavy heritage) | SMB–mid HR teams wanting simplicity | Fast-growth companies unifying HR+IT+Finance | Cross-border / EOR & global payroll buyers | Mid-market people/culture-led orgs (US/EU-weighted) | SMB / Zoho-suite shops | India/APAC mid–enterprise | India SMB–mid growth companies | India SMB–mid HR+payroll | India mid–enterprise | India SMB, often attendance-heavy | Hiring-led SMB; Freshworks ecosystem |
| **Geography** | Global | Global | Global | Global (regional depth varies) | Global (US core) | Global (US-led) | Global employment focus | Global (US/EU strength) | Global + strong India SMB | India / APAC / MENA emphasis | India-first | India-first | India-first | India | Global SMB hiring |
| **Company size (typical fit pattern)** | Often 1,000+; Launch/GO paths for mid-market (**I**) | 1,000+ typical | 1,000+ typical | Mid–large | ~25–1,000 common narrative | Mid-market growth | Any size going cross-border | Mid-market | SMB–lower mid | ~200–10,000+ narratives (**I/V**) | SMB–mid (~50–2,000 narratives) | SMB–mid; strong sub-~500 payroll story in roundups (**I**) | Mid–large | Sub-~200 common in roundups (**I**) | Small hiring teams; free tier historically |
| **Best-fit summary** | Complex global HCM/Finance | SAP-centric talent/HCM | Oracle-centric HCM | WFM + payroll at scale | Simple core HRIS (non-India payroll) | Unified workforce platform | International employment | Culture + HRIS mid-market | Low-cost Zoho HR | Configurable Asia enterprise HCM | Modern India all-in-one | India payroll/compliance incumbent | India enterprise mobile HCM | Lightweight India payroll+attendance | ATS-first, not full India HRMS |
| **Limitations (one line)** | Cost, time, overspec under ~500–1,000 for many | SI dependency; India payroll partner-heavy | Enterprise TCO | Not default India mid SoR | No Indian statutory payroll | Modular TCO complexity | Not India consultancy core HRMS | India payroll not differentiator | Payroll often separate; depth limits | Config/implementation weight | Support/mobile/reporting complaint patterns | SSO/API & advanced modules often add-ons | Heavier than lean mid-market need | Limited enterprise workflow depth | Weak payroll/compliance as SoR |

Sources for positioning patterns: [OutSail Workday](https://www.outsail.co/post/workday-reviews-pricing-pros-cons-user-reviews), [Avasant HCM adoption](https://avasant.com/report/despite-high-adoption-hcm-systems-fail-to-deliver-on-satisfaction-and-roi/), [hr.software Darwinbox](https://www.hr.software/reviews/darwinbox), [Peorient India payroll](https://peorient.com/blog/hr-software-india/), [HROne roundups](https://hrone.cloud/blog/peoplestrong-alternatives/), [greytHR](https://www.greythr.com/).

---

## 2. Core modules & HR processes

| Capability | Workday | SAP SF | Oracle HCM | UKG/ADP | BambooHR | Rippling | Deel | HiBob | Zoho People | Darwinbox | Keka | greytHR | PeopleStrong | Pocket HRMS | Freshteam |
|------------|---------|--------|------------|---------|----------|----------|------|-------|-------------|-----------|------|---------|--------------|-------------|---------|
| **Core HR / employee master** | Native | Native | Native | Native | Native | Native | Partial (employment-centric) | Native | Native | Native | Native | Native | Native | Native | Partial (directory / HR lite) |
| **Recruitment / ATS** | Native | Native | Native | Varies by product | Strong ATS | Available / modular | Hiring + compliance adjacent | Available | Via Zoho Recruit ecosystem often | Native | Native | **Add-on** (Recruit; e.g. ₹2,500/recruiter/mo on [pricing](https://www.greythr.com/pricing/)) **Fact V** | Native (**V**) | Limited / basic | **Core strength** |
| **Attendance / time** | Native | Native / partner | Native | **Strength** (WFM) | Limited vs India biometric stacks | Strong WFM modules | Time for global payroll contexts | PTO/time features | Attendance modules | Native (strong narrative) | Native (praised) | Native (Growth+ advanced; Essential more payroll/leave-centric) **Fact V** | Native | **Strength** (shop-floor / biometric narratives) | Limited |
| **Leave / absence** | Native | Native | Native | Native | Native (strength) | Native | Country-dependent | Native | Native | Native | Native | Native (all plans claim leave) **Fact V** | Native | Native | Basic time off |
| **Payroll** | Native (country depth varies) | Native / partner | Native / partner | **Strength** | US add-on; **no India statutory** (**I**) | Modular global payroll (**V**) | Global payroll / EOR | Limited India statutory story | **Separate** Zoho Payroll often | Native India/APAC emphasis (**V/I**) | Native India | **Core strength** India statutory **Fact V** | Native India (**V**) | Native India | **Not native** India payroll |
| **Performance / goals** | Native | **Strength** | Native | Varies | Available | Available / modular | Limited | Strength (people) | Available | Native | Native | **Add-on** (PMS) **Fact V** | Native (OKR/360 narratives **V**) | Basic | Limited |
| **ESS (employee self-service)** | Native | Native | Native | Native | Native (UX strength) | Native | Employee apps for global workers | Native | Native | Native (mobile-first **V**) | Native (UX praise **I**) | Native **Fact V** | Native (mobile **V**) | Native | Limited HR ESS |
| **Manager experience** | Native | Native | Native | Native | Strong simplicity | Strong automation | Manager of global team | Strong | Moderate | Strong configurable | Strong UX (**I**) | Moderate / payroll-admin weighted (**Assumption**) | Strong mobile narratives | Basic | Hiring manager focus |
| **Workflows / approvals** | Native (enterprise) | Native | Native | Native | Practical SMB workflows | Strong automation | Employment workflows | Native | Forms/workflows | **Highly configurable** (**I**) | Native | Native leave/expense-style flows | Advanced workflow claims (**V**) | Basic | Hiring pipelines |
| **Documents / letters** | Native | Native | Native | Varies | Native | Native | Employment docs | Native | Native | Native | Native | Available | Native | Basic | Candidate docs |
| **Assets** | Often via modules / partners | Partner / limited | Varies | Varies | Limited | **IT/device strength** | N/A | Limited | Limited | Available in suites (**?** depth) | Available | Unknown / not verified publicly | Available narratives | Limited | N/A |
| **Expense** | Native / adjacent | Native / adjacent | Native | Varies | Limited / integrations | Spend modules | Expense for global workers | Available | Available / Zoho Expense | Available | Available | **Add-on** **Fact V** | Reimbursement narratives | Limited | N/A |
| **Analytics / reporting** | **Strength** | **Strength** | **Strength** | Strong WFM analytics | SMB reports | Strong cross-domain | Payroll/compliance analytics | People analytics | Basic–moderate | Strong enterprise claims | Moderate; **customization limits** complaint pattern (**I**) | Operational reports; advanced may be limited vs enterprise (**Assumption**) | Advanced claims (**V**) | Basic | Hiring analytics |
| **Integrations** | Broad marketplace | SAP + partners | Oracle + partners | Broad | Marketplace | Deep (HR+IT) | Payroll/EOR ecosystem | Integrations | **Zoho suite glue** | Broad enterprise | Growing | REST API (**add-on** on lower plans) **Fact V** — [API docs](https://api-docs.greythr.com/) | Enterprise integrations | Limited | Freshworks suite |
| **Mobile apps** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes (emphasis **V**) | Yes; **parity complaints** (**I**) | Yes | Yes (emphasis **V**) | Yes | Yes (hiring) |
| **AI features** | Expanding (**V/I** industry) | Expanding | Expanding | Expanding | Assist features | Automation-led | Expanding | Expanding | Assist features | GenAI narratives (**V**) | Expanding | Expanding / marketing (**V**) | GenAI claims (**V**) | Basic | Assist / matching |
| **Customization** | Config + restricted platform rules | Config + partner | Config + partner | Config | Low–moderate (by design) | Config + modules | Country templates | Moderate | Low–moderate | **High config** (**I**) | Moderate; limits cited (**I**) | Config within SMB product | High enterprise config | Low | Low–moderate ATS |
| **SSO** | Enterprise standard | Enterprise standard | Enterprise standard | Enterprise | Available (plan-dependent) | Strong | Available | Available | Available (plan-dependent) | Enterprise | Available | **Add-on** (SAML) on Essential/Growth **Fact V** — [pricing](https://www.greythr.com/pricing/), [SSO help](https://greythr.freshdesk.com/support/solutions/articles/1060000065666-how-can-admin-enable-sso-based-login-with-greythr-) | Available | Unknown / not verified publicly | Freshworks SSO patterns |
| **API** | Rich | Rich | Rich | Rich | Available | Rich | Available | Available | Available | Rich | Available | REST API **add-on** / Premium-bundled narratives **Fact V** — [pricing calculator](https://www.greythr.com/pricing-calculator/) | Available | Unknown / not verified publicly | Available |
| **Multi-tenancy** | SaaS multi-tenant cloud (**V**) | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS; multi-company **add-on** narratives **Fact V** | SaaS | SaaS | SaaS |
| **Implementation complexity** | **High** (often 6–18 mo traditional; faster Launch paths exist) **I** | **High** | **High** | Med–High | **Low–Med** | **Med** (module sprawl) | Med | Med | **Low** | **Med–High** (config-heavy) **I** | **Med** | **Low–Med** | **Med** (often ~8–14 weeks in biased roundups) | **Low** | **Low** |
| **Pricing model** | Custom PEPM + SI | Custom + SI | Custom + SI | Custom / PEPM | Quote / PEPM | **Modular PEPM** (**V**: e.g. HRIS & payroll separate lines) | Quote / PEPM / EOR | Quote | Per-user / PEPM (relatively transparent in ecosystem) | Custom quote | Custom quote | **Published**: Essential ₹2,495/mo + ₹45/emp >50; Growth ₹4,495 + ₹85/emp >50; Premium custom **Fact V** | Custom quote | Custom / PEPM | Free tier + paid seats (historical Freshworks HRMS tiers) |
| **Pricing transparency** | Low | Low | Low | Low | Low–Med | Med (modular but quote) | Low | Low | Med–High | Low | Low | **High** (public cards) | Low | Low | Med |

---

## 3. Strengths, weaknesses, complaints, best-fit

| Product | Strengths | Weaknesses | Common complaints / review patterns (**I** unless noted) | Best-fit | Limitations vs our context (~500 India IT, greytHR, 12-week build) |
|---------|-----------|------------|----------------------------------------------------------|----------|-------------------------------------------------------------------|
| **Workday** | Suite depth, analytics, global credibility | Cost, complexity, change mgmt | Long implementations; admin burden; mid-market TCO concerns ([OutSail](https://www.outsail.co/post/workday-reviews-pricing-pros-cons-user-reviews)) | Large complex orgs | Wrong economics & timeline; poor fit under ~500–1,000 for many orgs (**I**) |
| **SAP SuccessFactors** | Talent suite + SAP alignment | SI lock-in; localization via partners | Implementation weight; India payroll partner friction (**I** pattern) | SAP ERP enterprises | Out of scope |
| **Oracle HCM** | Oracle Cloud coherence | Same enterprise TCO | SI dependency | Oracle estates | Out of scope |
| **UKG / ADP** | WFM & payroll muscle | Not India mid default SoR | Complexity of enterprise WFM | Large WFM buyers | Overkill; not India consultancy default |
| **BambooHR** | Simplicity, ATS, SMB UX | **No Indian statutory payroll** ([Peorient](https://peorient.com/blog/hr-software-india/)) | International/payroll gaps | US/EU simple HRIS | Would still need greytHR underneath |
| **Rippling** | HR+IT+Finance unification | Modular pricing complexity ([PeopleOpsClub](https://peopleopsclub.com/compare/bamboohr-vs-rippling)) | TCO surprises as modules add | US-led global growth cos | Costly; IT modules unused for us |
| **Deel** | Cross-border employment | Not full India HRMS replacement | EOR vs entity nuances | International hiring | India-only MVP → N/A |
| **HiBob** | People/culture UX | India payroll not core differentiator | Pricing opacity | Mid-market US/EU | Weak buy-path for India statutory |
| **Zoho People** | Price, Zoho glue | Payroll separate; depth limits ([HROne](https://hrone.cloud/blog/zoho-people-alternatives-india/)) | Support queues; feature shallowness | Zoho SMB shops | Cheap but may not beat greytHR payroll |
| **Darwinbox** | Configurable Asia HCM, mobile narrative | Implementation/config; module sprawl ([Skima](https://skima.ai/blog/product-deep-dives/darwinbox-reviews)) | Setup effort; unused modules | Larger India/APAC enterprises | Often **overspec for 500 FTE** |
| **Keka** | Modern UX; all-in-one India | Support & mobile parity themes ([G2](https://ai.g2.com/product/keka), [Software Advice](https://www.softwareadvice.com/hr/keka-profile/reviews/)) | Support lag; mobile < web; reporting/customization limits | India SMB–mid wanting UX | Strongest **buy** alternative; kills build/SaaS optionality if chosen |
| **greytHR** | India payroll/compliance/attendance; **published pricing** | Add-on ladder (SSO, API, Recruit, PMS, Expense) **Fact V** | Admin UX / advanced analytics limits (**Assumption** — validate internally) | India SMB–mid payroll SoR | **Keep payroll**; build ops UX around it |
| **PeopleStrong** | India enterprise + mobile claims (**V**) | Heavier mid-market footprint | Desktop clutter / approval lag themes in competitor blogs (biased) | Larger India enterprises | Buy path heavy vs internal MVP |
| **Pocket HRMS** | Simple India payroll + attendance | Limited complex workflow / multi-entity depth (**I** roundups) | Enterprise feature gaps | Smaller / shop-floor SMB | Underpowered for consultancy ops |
| **Freshteam** | ATS / hiring UX | Not India payroll SoR | Incomplete HRMS replacement | Freshworks hiring teams | Cannot replace greytHR |

---

## 4. Large comparison matrix (printable)

Single wide matrix for workshops. Cells shortened; see §2 for nuance.

| Dimension | Workday | SAP SF | Oracle HCM | UKG/ADP | BambooHR | Rippling | Deel | HiBob | Zoho People | Darwinbox | Keka | **greytHR** | PeopleStrong | Pocket HRMS | Freshteam | **PeopleOS (proposed)** |
|-----------|---------|--------|------------|---------|----------|----------|------|-------|-------------|-----------|------|-------------|--------------|-------------|---------|-------------------------|
| Target customer | Enterprise | Enterprise | Enterprise | Mid–large | SMB HR | Growth mid | Global emp. | Mid people | SMB Zoho | India/APAC mid–ent | India growth | India SMB–mid | India mid–ent | India SMB | Hiring SMB | Internal India IT → future SaaS |
| Geography | Global | Global | Global | Global | Global | Global | Global | Global | IN+global | IN/APAC | India | **India** | India | India | Global | **India-only MVP** |
| Size fit | 1k+ / mid Launch | 1k+ | 1k+ | Mid–large | SMB–mid | Mid | Any intl | Mid | SMB | 200–10k+ | SMB–mid | SMB–mid | Mid–large | <~200 | Small | **~500** |
| Core modules | Full suite | Full suite | Full suite | WFM/payroll | Core HRIS | Modular suite | Emp/payroll | People HRIS | HR modules | Full HCM | Full HR+payroll | HR+**payroll** | Full HCM | HR+payroll | ATS+HR lite | Core HR, leave, attendance ops, ESS, mgr, docs, reports |
| Recruitment | Yes | Yes | Yes | Varies | Strong | Yes | Adjacent | Yes | Recruit eco | Yes | Yes | Add-on | Yes | Basic | **Core** | Integrate / later |
| Attendance | Yes | Yes | Yes | **Strong** | Limited | Strong | Context | PTO/time | Yes | Yes | Yes | **Yes** | Yes | **Strong** | Limited | Yes (ops; device via greytHR) |
| Leave | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Yes | Yes | Basic | **Yes MVP** |
| Payroll | Yes | Partner/native | Partner/native | Strong | **No IN** | Global modular | Global/EOR | Weak IN | Separate | Yes IN | Yes IN | **Yes IN (keep)** | Yes IN | Yes IN | **No** | **Integrate — do not build** |
| Performance | Yes | Strong | Yes | Varies | Yes | Modular | Limited | Strong | Yes | Yes | Yes | Add-on | Yes | Basic | Limited | Later |
| ESS | Yes | Yes | Yes | Yes | Strong | Yes | Yes | Yes | Yes | Yes | Strong UX | Yes | Strong mobile | Yes | Limited | **Yes — differentiate** |
| Manager | Yes | Yes | Yes | Yes | Strong | Strong | Yes | Strong | Moderate | Yes | Strong | Moderate | Yes | Basic | Hiring mgr | **Yes — differentiate** |
| Workflows | Enterprise | Enterprise | Enterprise | Yes | SMB | Strong | Yes | Yes | Forms | **High config** | Yes | Yes | Advanced | Basic | Pipelines | Opinionated MVP |
| Documents | Yes | Yes | Yes | Varies | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Basic | Candidate | Thin MVP |
| Assets | Partner/mod | Limited | Varies | Varies | Limited | **IT strong** | N/A | Limited | Limited | ? | Yes | ? | Yes | Limited | N/A | Later / unknown need |
| Expense | Yes | Yes | Yes | Varies | Limited | Spend | Yes | Yes | Zoho Exp | Yes | Yes | Add-on | Yes | Limited | N/A | Later / integrate |
| Analytics | **Strong** | **Strong** | **Strong** | Strong | SMB | Strong | Focused | People | Basic+ | Strong | Moderate | Operational | Strong claims | Basic | Hiring | **Thin exports MVP** |
| Integrations | Broad | Broad | Broad | Broad | Market | **Deep** | Eco | Yes | Zoho | Broad | Growing | API add-on | Broad | Limited | Freshworks | **SSO+API first-class** |
| Mobile | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Emphasized | Yes (parity issues) | Yes | Emphasized | Yes | Yes | Responsive MVP |
| AI | Expanding | Expanding | Expanding | Expanding | Assist | Automation | Expanding | Expanding | Assist | GenAI **V** | Expanding | Marketing **V** | GenAI **V** | Basic | Assist | **Avoid as MVP bet** |
| Customization | Platform | Platform | Platform | Config | Low–med | Med | Templates | Med | Low–med | **High** | Med | SMB config | High | Low | Low–med | Low config MVP |
| SSO | Yes | Yes | Yes | Yes | Plan-dep | Yes | Yes | Yes | Plan-dep | Yes | Yes | **Add-on** | Yes | ? | Suite | **Core** |
| API | Rich | Rich | Rich | Rich | Yes | Rich | Yes | Yes | Yes | Rich | Yes | **Add-on** | Yes | ? | Yes | **Core** |
| Multi-tenancy | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | SaaS | Schema `tenant_id`; single-tenant runtime MVP |
| Impl. complexity | High | High | High | Med–High | Low–Med | Med | Med | Med | Low | Med–High | Med | Low–Med | Med | Low | Low | **12 weeks / 4 eng** |
| Pricing model | Quote | Quote | Quote | Quote | Quote | Modular PEPM | Quote | Quote | PEPM | Quote | Quote | **Published INR** | Quote | Quote | Freemium+ | Internal cost; SaaS later |
| Strengths | Depth | Talent/SAP | Oracle fit | WFM | Simplicity | Unification | Cross-border | Culture UX | Price/suite | Config Asia | UX India | **IN payroll** | India enterprise | Simple IN payroll | ATS | Controlled UX + hybrid payroll |
| Weaknesses | Cost/time | SI | SI | Not IN mid | No IN payroll | Price stack | Not core HRMS | IN payroll | Depth | Overspec | Support/mobile | Add-on tax | Heavy | Shallow workflows | Not HRMS | Must not rebuild payroll |
| Common complaints | Impl. length | Complexity | Complexity | Complexity | Intl payroll | TCO surprise | Wrong tool misuse | Price opacity | Support/depth | Config effort | Support/mobile/reports | ? validate | UI clutter themes | Scale limits | Incomplete HR | N/A (not shipped) |
| Best-fit | Global ent | SAP ent | Oracle ent | WFM scale | Simple HRIS | HR+IT orgs | Intl hire | Mid people | Zoho SMB | Large IN/APAC | IN mid UX | **IN payroll SoR** | Large IN | Small IN | Hiring teams | **This company MVP** |
| Limitations | Wrong stage | Wrong stage | Wrong stage | Wrong stage | Needs greytHR | Cost | Scope | Scope | May under-serve | Overspec | Buy vs build | Keep + wrap | Buy heavy | Too small | Not SoR | No statutory engine MVP |

---

## 5. greytHR commercial detail (incumbent reference)

| Item | Public detail | Label | URL |
|------|---------------|-------|-----|
| Essential | From ₹2,495/month; 50 employees included; ₹45/emp above 50 | Fact V | https://www.greythr.com/pricing/ |
| Growth | From ₹4,495/month; 50 included; ₹85/emp above 50 | Fact V | https://www.greythr.com/pricing/ |
| Premium | Custom; SSO/API/multi-company narratives included in marketing of tier | Fact V | https://www.greythr.com/pricing/ |
| SSO | Add-on on Essential/Growth; SAML feature documented | Fact V | https://www.greythr.com/pricing/ , https://greythr.freshdesk.com/support/solutions/articles/1060000065666-how-can-admin-enable-sso-based-login-with-greythr- |
| REST API | Add-on; OAuth2 API docs public; calculator shows PEPM add-on | Fact V | https://api-docs.greythr.com/ , https://www.greythr.com/pricing-calculator/ |
| Recruit | ₹2,500/recruiter/month on pricing page | Fact V | https://www.greythr.com/pricing/ |
| Indicative add-on PEPM (SSO ~₹10, API ~₹15) | Shown on vendor ROI calculator | Fact V (vendor indicative) | https://www.greythr.com/roi-calculator/ |
| Company claim “30,000+ companies” | Marketing on pricing page | Fact V (unaudited here) | https://www.greythr.com/pricing/ |

**Estimate (not invoice):** Growth at 500 employees ≈ ₹4,495 + ₹85×450 = ₹42,745/month before GST/add-ons.  
**Metric-to-measure:** Actual billed amount; which add-ons active; whether API/SSO already purchased.

---

## 6. PeopleOS mapping (build guidance)

| Matrix row | MVP stance | Rationale |
|------------|------------|-----------|
| Payroll | Integrate / keep greytHR | Locked; greytHR strength; compliance risk |
| ESS / Manager / Leave | Build better | UX + adoption gap (Avasant; Keka praise patterns) |
| Attendance | Build ops layer; devices via greytHR if present | Avoid biometric hardware stack in 12 weeks |
| Recruitment / Performance / Expense / Assets | Defer or integrate | Capacity; greytHR/Keka already monetize these |
| SSO / API | Build as core | Competitor add-on tax is a documented gap vs greytHR |
| Analytics | Thin, exportable | Review-site customization pain pattern |
| AI | Avoid as differentiator | Noise; ship workflows first |
| Multi-tenancy | Schema only | SaaS-ready without operating SaaS |
| Implementation | Internal 12-week | Cannot match Darwinbox breadth; must beat suite time-to-value |

---

## 7. Sources

### Vendor
- https://www.greythr.com/
- https://www.greythr.com/pricing/
- https://www.greythr.com/pricing-calculator/
- https://www.greythr.com/roi-calculator/
- https://api-docs.greythr.com/
- https://greythr.freshdesk.com/support/solutions/articles/1060000065666-how-can-admin-enable-sso-based-login-with-greythr-
- https://www.rippling.com/blog/rippling-payroll-review
- https://www.peoplestrong.com/compare/zoho-people/
- https://explore.darwinbox.com/resources/casestudy/emcure

### Independent / secondary (patterns, not audited market share)
- https://avasant.com/report/despite-high-adoption-hcm-systems-fail-to-deliver-on-satisfaction-and-roi/
- https://avasant.com/report/hcm-ever-popular-but-satisfaction-lags/
- https://avasant.com/report/cloud-hcm-suites-2024-2025-radarview/
- https://www.outsail.co/post/workday-reviews-pricing-pros-cons-user-reviews
- https://www.outsail.co/post/workday-vs-rippling-a-2026-comparison
- https://www.hr.software/reviews/darwinbox
- https://skima.ai/blog/product-deep-dives/darwinbox-reviews
- https://ai.g2.com/product/keka
- https://www.softwareadvice.com/hr/keka-profile/reviews/
- https://peorient.com/blog/hr-software-india/
- https://peopleopsclub.com/compare/bamboohr-vs-rippling
- https://hrone.cloud/blog/peoplestrong-alternatives/
- https://hrone.cloud/blog/zoho-people-alternatives-india/
- https://neuralhr.ai/en/best-hr-software-india
- https://mainstayconsulting.in/hrms-comparison-for-indian-enterprises/

---

*Maintainers: Product + Architecture. Update cells from “Unknown / not verified publicly” only after demo notes or contract exhibits are filed — do not invent competitor PEPM or market share.*
