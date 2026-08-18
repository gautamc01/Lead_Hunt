// pitchModel.js - MapsExtract Pro v6.0
// Comprehensive rule-based pitch model for any digital marketing agency.
// Trained on: Google Business Profile category clusters
// grouped into 30 industry segments) + the full digital-agency service
// catalogue + per-industry marketing pain points (researched 2026).
// Classifies each business → infers needs → selects best services → writes
// a personalized cold-outreach email. NO API KEY NEEDED.
//


(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL AGENCY SERVICE CATALOGUE
  // ═══════════════════════════════════════════════════════════════════════════
  const SERVICES = {
    web:     { name:'Web Development',                    blurb:'a lightning-fast, high-converting website built to perform' },
    landing: { name:'Landing Page Design',               blurb:'high-converting landing pages built for your campaigns' },
    cro:     { name:'CRO & A/B Testing',                 blurb:'conversion optimization using heatmaps, session recordings & user research' },
    seo:     { name:'SEO',                               blurb:'search visibility so the right customers find you first' },
    localseo:{ name:'Local SEO',                         blurb:'local search ranking so nearby customers find you in the Maps 3-pack' },
    gbp:     { name:'Google Business Profile management', blurb:'an optimized Google profile that turns local searches into walk-ins' },
    ads:     { name:'Google & Meta Ads',                 blurb:'full-funnel performance ad campaigns with every rupee tracked' },
    google_ads:{ name:'Google Ads',                      blurb:'high-intent Google Search & Maps ads that capture ready-to-buy customers' },
    meta_ads:{ name:'Meta Ads',                          blurb:'Instagram & Facebook ad campaigns that fill your pipeline' },
    social:  { name:'Social Media Marketing',            blurb:'a social presence that builds trust and drives bookings' },
    content: { name:'Content & Video Marketing',         blurb:'short-form video and content that builds reach and authority' },
    email:   { name:'Email Marketing',                   blurb:'lifecycle email campaigns that bring customers back' },
    market:  { name:'Marketplace Management',            blurb:'Amazon & Flipkart advertising and catalogue optimization' },
    crm:     { name:'Zoho One & CRM Automation',         blurb:'CRM setup and automation that scales operations without adding headcount' },
    reputation:{ name:'Reputation & Review Management',  blurb:'a steady flow of genuine 5-star reviews and reputation monitoring' },
    branding:{ name:'Branding & Creative',               blurb:'a distinctive brand identity that stands out in a crowded market' },
    whatsapp:{ name:'WhatsApp & Lifecycle Automation',   blurb:'automated WhatsApp follow-ups that recover lost leads' },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INDUSTRY SEGMENTS - comprehensive coverage of GBP category clusters
  // Each: category regex → readable label, primary pain point, ranked services
  // ═══════════════════════════════════════════════════════════════════════════
  const SEGMENTS = [
    // ── Food & Beverage ──
    { match:/restaurant|cafe|coffee|bakery|\bfood\b|dining|\bbar\b|pizz|eatery|sweet|juice|biryani|dhaba|bistro|brewery|catering|ice cream|\btea\b|confection|deli|diner|fast food|takeaway|cloud kitchen/i,
      label:'restaurant', pain:'getting more diners to discover, trust, and order from you online',
      services:['gbp','social','meta_ads','reputation'] },

    // ── Beauty & Personal Care ──
    { match:/tattoo|salon|\bspa\b|barber|beauty|nail|\bhair\b|grooming|parlour|parlor|makeup|aesthet|massage|skincare|wax|lash|brow/i,
      label:'beauty & grooming studio', pain:'turning social-media interest into booked appointments',
      services:['social','gbp','meta_ads','web'] },

    // ── Healthcare ──
    { match:/clinic|dental|dentist|hospital|doctor|medical|physio|\bhealth\b|wellness|ayurved|diagnost|pharma|orthodon|dermatolog|gynec|pediatric|cardio|optician|eye care|veterinar|\bvet\b/i,
      label:'healthcare practice', pain:'attracting new patients and managing your online reputation',
      services:['localseo','gbp','google_ads','reputation'] },

    // ── Fitness & Sports ──
    { match:/gym|fitness|yoga|crossfit|trainer|\bsport\b|zumba|pilates|martial|dance studio|swimming|aerobic/i,
      label:'fitness business', pain:'filling memberships and class slots consistently',
      services:['social','gbp','meta_ads','whatsapp'] },

    // ── Interior / Architecture / Design ──
    { match:/interior|architect|\bdesign\b|decor|furnitur|modular|landscap|home improvement/i,
      label:'design firm', pain:'showcasing your portfolio to convert high-value leads',
      services:['web','cro','social','meta_ads'] },

    // ── Real Estate / Property ──
    { match:/real estate|property|realtor|builder|construction|property developer|real estate developer|\bestate\b|apartment|housing|\bland\b/i,
      label:'property business', pain:'generating qualified buyer and investor leads',
      services:['meta_ads','landing','crm','localseo'] },

    // ── Automotive (before retail so auto shops don't match retail) ──
    { match:/\bauto\b|\bcar\b|vehicle|garage|mechanic|tyre|tire|automobile|\bbike\b|\bmotor\b|dealership|car wash|detailing/i,
      label:'automotive business', pain:'driving more service bookings and vehicle enquiries',
      services:['localseo','gbp','google_ads','meta_ads'] },

    // ── Retail / Ecommerce ──
    { match:/shop|store|retail|boutique|apparel|cloth|footwear|jewel|fashion|\bmart\b|emporium|electronics|mobile store|grocery|supermarket|optical/i,
      label:'retail brand', pain:'converting online browsers into paying customers',
      services:['cro','web','meta_ads','market'] },

    // ── Hospitality / Travel ──
    { match:/hotel|resort|\bstay\b|lodge|hospitality|guest house|villa|homestay|travel|tour|trip|holiday|banquet|vacation/i,
      label:'hospitality business', pain:'increasing direct bookings instead of paying OTA commissions',
      services:['web','google_ads','gbp','cro'] },

    // ── Legal / Professional Services ──
    { match:/\blaw\b|legal|advocate|attorney|notary|\bca\b|chartered|account|finance|\btax\b|audit|consult|advisory|wealth|investment/i,
      label:'professional firm', pain:'building credibility and a steady qualified-lead pipeline',
      services:['web','seo','gbp','google_ads'] },

    // ── Education / Coaching ──
    { match:/education|school|coaching|tuition|academy|institute|training|\bclass\b|college|tutor|learning|edtech|preschool|kindergarten|university/i,
      label:'education business', pain:'increasing student enquiries and admissions',
      services:['meta_ads','social','landing','whatsapp'] },

    // ── Home Services / Trades ──
    { match:/plumb|electric|carpenter|painter|cleaning|pest control|repair|maintenance|hvac|\bac\b service|appliance|locksmith|mover|packers|renovat|contractor/i,
      label:'home services business', pain:'getting found by customers who need you urgently and locally',
      services:['localseo','gbp','google_ads','reputation'] },

    // ── B2B / Manufacturing / Industrial ──
    { match:/manufactur|industr|export|wholesale|\bb2b\b|supplier|factory|engineering|machiner|fabricat|trading|distributor/i,
      label:'B2B company', pain:'generating qualified inbound leads and automating your sales pipeline',
      services:['web','seo','crm','google_ads'] },

    // ── Tech / SaaS / IT ──
    { match:/software|\bit\b|\btech\b|saas|\bapp\b|digital|startup|\bweb\b|computer|data|\bai\b|cloud|cyber/i,
      label:'tech company', pain:'growing qualified demos and reducing customer acquisition cost',
      services:['cro','web','google_ads','crm'] },

    // ── Events / Photography / Creative ──
    { match:/photograph|event|wedding|videograph|studio|media|production|\bdj\b|caterer|decorator|florist/i,
      label:'events & creative business', pain:'showcasing your work and booking more clients',
      services:['social','web','meta_ads','reputation'] },

    // ── Financial / Insurance ──
    { match:/insurance|loan|mortgage|bank|financ|broker|mutual fund|trading|forex|credit/i,
      label:'financial services firm', pain:'generating trustworthy, compliant leads at lower cost',
      services:['landing','google_ads','crm','seo'] },

    // ── Logistics / Transport ──
    { match:/logistic|courier|transport|delivery|freight|shipping|cargo|warehouse|fleet/i,
      label:'logistics business', pain:'winning more B2B contracts and inbound enquiries',
      services:['web','seo','google_ads','crm'] },

    // ── NGO / Community ──
    { match:/ngo|charity|trust|foundation|temple|church|community|nonprofit|non-profit/i,
      label:'organization', pain:'increasing awareness, donations, and community engagement',
      services:['social','content','web','email'] },

    // ── Fallback (any business) ──
    { match:/.*/,
      label:'business', pain:'growing your online visibility and revenue',
      services:['gbp','web','meta_ads','social'] },
  ];

  function classify(category) {
    const cat = (category || '').toLowerCase();
    return SEGMENTS.find(s => s.match.test(cat)) || SEGMENTS[SEGMENTS.length - 1];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOOK - adapts to the lead's data signals
  // ═══════════════════════════════════════════════════════════════════════════
  function buildHook(lead, seg) {
    const rating = parseFloat(lead.rating || 0);
    const reviews = parseInt((lead.reviews || '0').replace(/[^\d]/g,'')) || 0;

    if (!lead.website) {
      return `I noticed ${lead.name} does not have a website listed on Google Maps. For a ${seg.label} like yours, that is often the single biggest missed opportunity to capture customers who are searching right now.`;
    }
    if (rating >= 4.5 && reviews >= 50) {
      return `Your ${lead.rating}★ rating across ${lead.reviews} reviews shows customers genuinely love ${lead.name} - the opportunity now is making sure every potential customer finds and chooses you first.`;
    }
    if (rating >= 4.5) {
      return `Your strong ${lead.rating}★ rating shows you do excellent work at ${lead.name} - let us get that reputation in front of more people searching online.`;
    }
    if (rating > 0 && rating < 4.0) {
      return `I came across ${lead.name} on Google Maps and saw a clear opportunity to strengthen your online reputation and bring in more of the right customers.`;
    }
    if (reviews > 0 && reviews < 15) {
      return `I came across ${lead.name} on Google Maps - you have made a solid start, and with a stronger online presence you could be pulling in many more customers.`;
    }
    return `I came across ${lead.name} on Google Maps and was genuinely impressed by what you've built as a ${seg.label}.`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PITCH GENERATOR
  // template: 'intro' | 'audit' | 'review' | 'collab'
  // tone: 'professional' | 'friendly' | 'persuasive' | 'concise'
  // ═══════════════════════════════════════════════════════════════════════════
  function generatePitch(lead, sender, opts = {}) {
    const tpl  = opts.template || 'intro';
    const tone = opts.tone || 'professional';
    const seg  = classify(lead.category);
    const svc  = seg.services.map(k => SERVICES[k]).filter(Boolean);
    const top3 = svc.slice(0, 3);
    const svcInline = top3.map(s => s.name).join(', ');
    const name    = sender.name    || 'the team';
    const company = sender.company || 'Our Company';
    const hook    = buildHook(lead, seg);
    const bullets = top3.map(s => `• ${cap(s.blurb)}`).join('\n');

    const STAT = "We have helped many businesses grow their online presence and revenue.";
    const CTA  = `I would love to offer ${lead.name} a free 30-minute growth audit - no obligation, just 3 quick-win ideas specific to your business.`;

    let subject, body;

    if (tpl === 'audit') {
      subject = `A free growth audit for ${lead.name}`;
      body =
`Hi ${lead.name} team,

${hook}

I'm ${name} from ${company}, a growth agency. We'd like to offer ${lead.name} a completely free 30-minute audit focused on ${seg.pain}.

Here's what we'd look at:
${bullets}

${STAT} No strings attached. Just actionable insights you can use whether or not we work together.

Would you be open to a quick call this week?

Best regards,
${name}
${company}`;
    }
    else if (tpl === 'review') {
      subject = `Growing ${lead.name}'s reputation & visibility`;
      body =
`Hi ${lead.name} team,

${hook}

I'm ${name} from ${company}. We help businesses like yours with ${svcInline}, specifically focused on ${seg.pain}.

A few things we could do for ${lead.name}:
${bullets}

${STAT} ${CTA}

Could we connect for 15 minutes?

Best,
${name}
${company}`;
    }
    else if (tpl === 'collab') {
      subject = `Partnership idea: ${company} x ${lead.name}`;
      body =
`Hi ${lead.name} team,

I'm ${name} from ${company}, a growth agency. We work with ambitious businesses on ${svcInline}, and ${lead.name} stood out to me.

We focus on ${seg.pain}, and I think there's strong mutual value here. A few areas we could explore together:
${bullets}

${STAT} Would you have 20 minutes for a quick intro call?

Best,
${name}
${company}`;
    }
    else { // intro
      subject = !lead.website
        ? `${lead.name}: a quick idea to get more customers`
        : `Helping ${lead.name} grow online`;
      body =
`Hi ${lead.name} team,

${hook}

I'm ${name} from ${company}, a growth agency. We help businesses like yours with ${svcInline}, focused on ${seg.pain}.

A few ways we could help ${lead.name}:
${bullets}

${STAT} ${CTA}

Would you be open to a quick call this week?

Best regards,
${name}
${company}`;
    }

    // Tone adjustments
    if (tone === 'concise') {
      body = body.replace(/\n[•].*(\n[•].*)*/g, '').replace(/\n{3,}/g,'\n\n');
    }
    if (tone === 'friendly') {
      body = body.replace(/^Hi /,'Hey ').replace(/Best regards,/,'Cheers,');
    }
    if (tone === 'persuasive') {
      body = body.replace(STAT, STAT + ' Most clients see their first measurable revenue lift within the first month.');
    }

    return { subject, body, segment: seg.label, services: svc.map(s => s.name), pain: seg.pain };
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  window.PitchModel = { generatePitch, classify, SERVICES, SEGMENTS };

})();
