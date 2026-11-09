import type { Language } from '@/lib/i18n'

/**
 * Legal pages (Terms, Privacy, Responsible play) in both languages. Plain content, no markup:
 * the page renders headings and paragraphs. Change the operator details in one place below.
 * Product rules quoted here come from docs/architecture.md and docs/game-rules.md.
 */

export const OPERATOR = {
  name: 'Decode with Prabin',
  email: 'prabin.baral00@gmail.com',
  country: 'Nepal',
}

export const LEGAL_UPDATED = '2026-10-31'

export type LegalDoc = 'terms' | 'privacy' | 'responsible-play'
export const LEGAL_DOCS: LegalDoc[] = ['terms', 'privacy', 'responsible-play']

export interface LegalSection {
  heading: string
  paragraphs: string[]
}
export interface LegalContent {
  title: string
  intro: string
  sections: LegalSection[]
}

const o = OPERATOR

const ne: Record<LegalDoc, LegalContent> = {
  terms: {
    title: 'सेवा सर्तहरू (Terms & Conditions)',
    intro: `झण्डी बुर्जा ("खेल", "सेवा") ${o.name} ("हामी") ले सञ्चालन गर्छ। खाता खोल्दा वा खेल्दा तपाईं यी सर्तहरू मान्नुहुन्छ। मान्न नसक्ने भए खेल प्रयोग नगर्नुहोस्।`,
    sections: [
      {
        heading: '१. १८ वर्ष वा माथि मात्र',
        paragraphs: [
          'यो खेल १८ वर्ष वा सोभन्दा माथिका व्यक्तिका लागि मात्र हो। साइन इन गर्दा तपाईंले आफू १८+ भएको पुष्टि गर्नुपर्छ। १८ वर्षमुनिको व्यक्तिको खाता भेटिए तुरुन्त बन्द गरिन्छ।',
        ],
      },
      {
        heading: '२. कोइन काल्पनिक हुन् — पैसाको मूल्य छैन',
        paragraphs: [
          'खेलमा प्रयोग हुने "कोइन" पूर्ण रूपमा काल्पनिक (virtual) हुन्। तिनको कुनै नगद वा वास्तविक मूल्य छैन; किन्न, बेच्न, साट्न, झिक्न (withdraw) वा पैसा, सामान वा सेवामा बदल्न मिल्दैन। कोइन तपाईंको सम्पत्ति होइन, खेल्नका लागि दिइएको सीमित अनुमति (licence) मात्र हो।',
          'हामी कोइन बेच्दैनौँ, र कुनै तेस्रो पक्षमार्फत कोइनको किनबेच गर्नु निषेध छ। त्यस्तो गरेको भेटिए खाता बन्द र कोइन जफत हुन सक्छ।',
          'यो खेल जुवा वा वास्तविक रकमको बाजी होइन। खेलमा जित्दा वा हार्दा कुनै पैसा आउँदैन–जाँदैन।',
        ],
      },
      {
        heading: '३. खाता',
        paragraphs: [
          'एक व्यक्तिको एउटा मात्र खाता हुन्छ। Google खाता (वा अनुमति भए मोबाइल नम्बर) मार्फत साइन इन गरिन्छ। खाता अरूलाई दिन, बेच्न वा साट्न मिल्दैन।',
          'नयाँ खातामा दिइने साइन-अप कोइन र दैनिक बोनस हाम्रो स्वविवेकमा छन्; रकम कुनै पनि बेला बदल्न वा रोक्न सकिन्छ।',
        ],
      },
      {
        heading: '४. खेलका नियम',
        paragraphs: [
          'नियम, भुक्तानी दर, होस्टको न्यूनतम जमानी (bank), न्यूनतम/अधिकतम बाजी, दैनिक हार-सीमा र प्लेटफर्म शुल्क खेलभित्र र "खेलका नियम" मा लेखिएका छन्। होस्टको प्रत्येक राउन्डको शुद्ध जितमा प्लेटफर्म शुल्क (अहिले २%) काल्पनिक कोइनमै लाग्छ।',
          'पासा सर्भरले फाल्छ। हरेक राउन्ड अघि seed को hash देखाइन्छ र पछि seed खुलाइन्छ, जसले नतिजा पहिले नै निश्चित थियो भनी जाँच्न दिन्छ (commit–reveal)।',
        ],
      },
      {
        heading: '५. निषेधित काम',
        paragraphs: [
          'Bot, script वा स्वचालित खेल; एकभन्दा बढी खाता; होस्ट–खेलाडी मिलेमतो (collusion); bug वा त्रुटिको दुरुपयोग; अर्काको खाता चलाउनु; अरूलाई अपमान, धम्की वा घृणा फैलाउने chat; कोइनको वास्तविक रकममा किनबेच — यी सबै निषेध छन्।',
        ],
      },
      {
        heading: '६. हाम्रो अधिकार',
        paragraphs: [
          'नियम उल्लङ्घन, धोखाधडी वा सुरक्षाका कारणले हामी खाता रोक्न (freeze), बन्द गर्न (ban), कोइन घटाउन/बढाउन, राउन्ड रद्द गर्न वा कोठा बन्द गर्न सक्छौँ। त्रुटिले गलत कोइन परेमा सच्याइन्छ। यस्ता सबै कार्य अभिलेख (audit log) मा राखिन्छन्।',
        ],
      },
      {
        heading: '७. सेवा "जस्तो छ त्यस्तै"',
        paragraphs: [
          'सेवा निरन्तर, त्रुटिरहित वा सधैँ उपलब्ध हुने ग्यारेन्टी छैन। मर्मत, bug वा बाहिरी कारणले सेवा रोकिन, कोइन वा प्रगति हराउन सक्छ; कोइनको कुनै मूल्य नहुने हुँदा त्यसको क्षतिपूर्ति हुँदैन। कानुनले अनुमति दिएसम्म हामी कुनै अप्रत्यक्ष वा परिणामजन्य हानिका लागि जिम्मेवार हुँदैनौँ।',
        ],
      },
      {
        heading: '८. खाता बन्द र सर्तमा परिवर्तन',
        paragraphs: [
          `तपाईं जुनसुकै बेला खेल छोड्न सक्नुहुन्छ; खाता मेटाउन ${o.email} मा लेख्नुहोस्। हामी यी सर्त बदल्न सक्छौँ; ठूलो परिवर्तन खेलभित्र सूचित गरिन्छ र त्यसपछि खेल्दा नयाँ सर्त लागू हुन्छन्।`,
        ],
      },
      {
        heading: '९. कानुन र सम्पर्क',
        paragraphs: [
          `यी सर्तहरू ${o.country} को कानुन अनुसार व्याख्या हुन्छन्। प्रश्न वा उजुरीका लागि: ${o.email}`,
        ],
      },
    ],
  },
  privacy: {
    title: 'गोपनीयता नीति (Privacy Policy)',
    intro: `यो नीतिले ${o.name} ले झण्डी बुर्जा चलाउँदा तपाईंको कुन जानकारी लिन्छ, किन, र कसरी सुरक्षित राख्छ भन्ने बताउँछ।`,
    sections: [
      {
        heading: '१. हामी के जानकारी लिन्छौँ',
        paragraphs: [
          'साइन इन: Google खाताबाट तपाईंको नाम, इमेल, प्रोफाइल फोटो र Google को खाता पहिचान (ID)। मोबाइल साइन इन सक्रिय भए मोबाइल नम्बर। हामी Google password देख्दैनौँ र पाउँदैनौँ।',
          'खेल: तपाईंले खेलेका कोठा, राउन्ड, बाजी, कोइनको हरेक हिसाब (ledger), chat सन्देश, कहिले खेल्नुभयो।',
          'प्राविधिक: IP ठेगानाको hash (बोनस दुरुपयोग रोक्न; पूरा IP भण्डारण हुँदैन), browser/device को सामान्य जानकारी, त्रुटि log।',
          'हामी भुक्तानी वा बैंक विवरण लिँदैनौँ — खेलमा पैसा छैन।',
        ],
      },
      {
        heading: '२. किन प्रयोग गर्छौँ',
        paragraphs: [
          'खाता चलाउन र साइन इन गराउन; कोइनको सही हिसाब राख्न; धोखाधडी, मिलेमतो र धेरै खाता रोक्न; १८+ र जिम्मेवार खेल (दैनिक हार-सीमा, समय सम्झना) लागू गर्न; सेवा सुधार्न र त्रुटि खोज्न; कानुनी दायित्व पूरा गर्न।',
        ],
      },
      {
        heading: '३. कहाँ राखिन्छ',
        paragraphs: [
          'डेटा Supabase (PostgreSQL) को भारत–मुम्बई क्षेत्रका सर्भरमा र हामीले प्रयोग गर्ने hosting प्रदायकमा राखिन्छ। यसको अर्थ तपाईंको डेटा नेपालबाहिर प्रशोधन हुन्छ। सबै जडान TLS ले encrypt हुन्छ; पासवर्ड वा OTP कहिल्यै सादा रूपमा राखिँदैन।',
        ],
      },
      {
        heading: '४. कसलाई दिइन्छ',
        paragraphs: [
          'हामी तपाईंको डेटा बेच्दैनौँ। निम्नसँग मात्र साझा हुन्छ: Google (साइन इन गर्दा, Google को आफ्नै नीति अनुसार); हामीका hosting/database प्रदायक (हाम्रो निर्देशनमा मात्र); कानुनले बाध्य पारेमा सम्बन्धित निकाय।',
          'अन्य खेलाडीले कोठामा तपाईंको प्रदर्शित नाम, फोटो, बाजी र chat देख्छन्; इमेल वा नम्बर देख्दैनन्।',
        ],
      },
      {
        heading: '५. Cookies र भण्डारण',
        paragraphs: [
          'साइन इन राख्न एउटा सुरक्षित httpOnly cookie प्रयोग हुन्छ। भाषा र आवाज (mute) जस्ता प्राथमिकता तपाईंको browser मै (localStorage) बस्छन्। हामी विज्ञापन वा tracking cookie प्रयोग गर्दैनौँ।',
        ],
      },
      {
        heading: '६. कति समय राखिन्छ',
        paragraphs: [
          'खाता सक्रिय रहेसम्म, र कोइनको हिसाब (ledger) को शुद्धता र दुरुपयोग अनुसन्धानका लागि खाता बन्द भएपछि पनि आवश्यक अवधिसम्म। OTP code र पुराना साइन-इन token छिट्टै स्वतः मेटिन्छन्।',
        ],
      },
      {
        heading: '७. तपाईंका अधिकार',
        paragraphs: [
          `आफ्नो डेटाको प्रतिलिपि माग्न, सच्याउन वा खाता मेटाउन ${o.email} मा लेख्नुहोस्। हामी उचित समयभित्र जवाफ दिन्छौँ। खाता मेटाइएपछि नाम/इमेल हटाइन्छ; ledger को अभिलेख पहिचानरहित रूपमा रहन सक्छ।`,
        ],
      },
      {
        heading: '८. बालबालिका',
        paragraphs: [
          'सेवा १८+ का लागि मात्र हो। १८ वर्षमुनिको डेटा लिएको थाहा पाए खाता र डेटा मेटाइन्छ।',
        ],
      },
      {
        heading: '९. परिवर्तन र सम्पर्क',
        paragraphs: [
          `यो नीति बदलिन सक्छ; नयाँ संस्करण यहीँ प्रकाशित हुन्छ। प्रश्नका लागि: ${o.email}`,
        ],
      },
    ],
  },
  'responsible-play': {
    title: 'जिम्मेवार खेल (Responsible Play)',
    intro:
      'झण्डी बुर्जा रमाइलोका लागि हो। कोइन काल्पनिक हुन्, पैसा होइनन् — तर समय र भावना वास्तविक हुन्छन्। खेल रमाइलो रहोस् भन्नका लागि यी कुरा।',
    sections: [
      {
        heading: 'खेलभित्रै भएका सुरक्षा',
        paragraphs: [
          '१८+ पुष्टि: साइन इन गर्दा नै १८ वर्ष वा माथि भएको पुष्टि गर्नुपर्छ।',
          'दैनिक हार-सीमा: एक दिनमा (काठमाडौँ समय) तोकिएको भन्दा बढी कोइन हार्न मिल्दैन; सीमा पुगेपछि त्यो दिन बाजी बन्द हुन्छ।',
          'समय सम्झना: हरेक घण्टा खेलिरहेको सम्झाइन्छ।',
          'पारदर्शी पासा: हरेक राउन्डको नतिजा पहिले hash बाट कमिट गरिन्छ; "निष्पक्षता जाँच" बाट आफैँ प्रमाणित गर्न सकिन्छ।',
        ],
      },
      {
        heading: 'आफूलाई सोध्नुहोस्',
        paragraphs: [
          'के म सोचेभन्दा धेरै समय खेल्दैछु? के हारेको कोइन "फिर्ता ल्याउन" खेल्दैछु? के खेलले काम, पढाइ वा परिवारमा असर पारेको छ? एउटै पनि "हो" भए एकछिन रोकिनुहोस्।',
        ],
      },
      {
        heading: 'सम्झनुहोस्',
        paragraphs: [
          'कोइनलाई पैसामा साट्ने कुनै बाटो छैन — कसैले त्यस्तो प्रस्ताव राखे त्यो ठगी हो; हामीलाई खबर गर्नुहोस्।',
          'खेल रोक्न चाहनुभए खाता रोक्न (freeze) वा मेटाउन हामीलाई लेख्नुहोस्; हामी तुरुन्त गर्छौँ।',
        ],
      },
      {
        heading: 'सम्पर्क',
        paragraphs: [`${o.email} — खेल, खाता वा चिन्ताका लागि।`],
      },
    ],
  },
}

const en: Record<LegalDoc, LegalContent> = {
  terms: {
    title: 'Terms & Conditions',
    intro: `Jhandi Burja (the "Game", the "Service") is operated by ${o.name} ("we"). By creating an account or playing you agree to these terms. If you do not agree, do not use the Game.`,
    sections: [
      {
        heading: '1. 18 or older only',
        paragraphs: [
          'The Game is for people aged 18 or over. You confirm this at sign-in. Accounts found to belong to anyone under 18 are closed immediately.',
        ],
      },
      {
        heading: '2. Coins are virtual and have no cash value',
        paragraphs: [
          'The "coins" used in the Game are entirely virtual. They have no monetary or real-world value and cannot be bought, sold, traded, withdrawn or exchanged for money, goods or services. Coins are not your property; they are a limited licence to play.',
          'We do not sell coins, and buying or selling coins through any third party is prohibited. Accounts doing so may be closed and their coins removed.',
          'The Game is not gambling and involves no real-money wagering. Winning or losing in the Game never moves money.',
        ],
      },
      {
        heading: '3. Your account',
        paragraphs: [
          'One account per person, signed in with a Google account (or a mobile number where enabled). Accounts may not be shared, sold or transferred.',
          'The sign-up coins and the daily bonus are given at our discretion and may be changed or withdrawn at any time.',
        ],
      },
      {
        heading: '4. Game rules',
        paragraphs: [
          'Rules, payouts, the host deposit, bet limits and the platform fee are shown in the Game and in "Game rules". A platform fee (currently 2%) is taken from a host\'s net win per round, in virtual coins only.',
          'The server rolls the dice. Before each round a hash of the seed is published and the seed is revealed afterwards, so anyone can verify that the result was fixed in advance (commit–reveal).',
        ],
      },
      {
        heading: '5. Prohibited conduct',
        paragraphs: [
          "Bots, scripts or automated play; multiple accounts; host–player collusion; exploiting bugs; using someone else's account; abusive, threatening or hateful chat; trading coins for real value. All of these are prohibited.",
        ],
      },
      {
        heading: '6. Our rights',
        paragraphs: [
          'For rule violations, fraud or security reasons we may freeze or ban accounts, adjust coin balances, void rounds or close rooms. Balances caused by errors are corrected. Every such action is recorded in an audit log.',
        ],
      },
      {
        heading: '7. Service provided "as is"',
        paragraphs: [
          'We do not guarantee the Service will be uninterrupted, error-free or always available. Maintenance, bugs or outside events may interrupt play or lose coins or progress; because coins have no value, no compensation is owed. To the extent permitted by law we are not liable for indirect or consequential loss.',
        ],
      },
      {
        heading: '8. Ending your account and changes to these terms',
        paragraphs: [
          `You may stop playing at any time; to delete your account write to ${o.email}. We may change these terms; material changes are announced in the Game and apply to play after that.`,
        ],
      },
      {
        heading: '9. Law and contact',
        paragraphs: [
          `These terms are governed by the laws of ${o.country}. Questions or complaints: ${o.email}`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: `This policy explains what information ${o.name} collects when you use Jhandi Burja, why, and how it is protected.`,
    sections: [
      {
        heading: '1. What we collect',
        paragraphs: [
          'Sign-in: your name, e-mail, profile picture and account ID from Google; your mobile number if phone sign-in is enabled. We never see or receive your Google password.',
          'Play: the rooms, rounds and bets you take part in, every coin movement (ledger), chat messages, and when you played.',
          'Technical: a hash of your IP address (to prevent bonus abuse; the full IP is not stored), general browser/device information, error logs.',
          'We collect no payment or bank details — there is no money in the Game.',
        ],
      },
      {
        heading: '2. Why we use it',
        paragraphs: [
          'To run your account and sign you in; keep coin balances correct; prevent fraud, collusion and multiple accounts; enforce 18+ and responsible-play measures (time reminders); improve the Service and fix errors; meet legal obligations.',
        ],
      },
      {
        heading: '3. Where it is stored',
        paragraphs: [
          'Data is stored with Supabase (PostgreSQL) in the Mumbai, India region and with the hosting providers we use, which means it is processed outside Nepal. All connections are encrypted with TLS; passwords or one-time codes are never stored in plain text.',
        ],
      },
      {
        heading: '4. Who it is shared with',
        paragraphs: [
          "We do not sell your data. It is shared only with: Google (when you sign in, under Google's own policy); our hosting/database providers (acting on our instructions); authorities where the law requires.",
          'Other players see your display name, picture, bets and chat in a room; never your e-mail or number.',
        ],
      },
      {
        heading: '5. Cookies and storage',
        paragraphs: [
          'A secure httpOnly cookie keeps you signed in. Preferences such as language and sound live in your own browser (localStorage). We use no advertising or tracking cookies.',
        ],
      },
      {
        heading: '6. How long we keep it',
        paragraphs: [
          'For as long as your account is active, and afterwards for as long as needed to keep the coin ledger consistent and investigate abuse. One-time codes and old sign-in tokens are deleted automatically.',
        ],
      },
      {
        heading: '7. Your rights',
        paragraphs: [
          `To get a copy of your data, correct it or delete your account, write to ${o.email}. We respond within a reasonable time. After deletion your name and e-mail are removed; ledger records may remain in anonymised form.`,
        ],
      },
      {
        heading: '8. Children',
        paragraphs: [
          'The Service is for adults (18+). If we learn we hold data of anyone under 18, the account and data are deleted.',
        ],
      },
      {
        heading: '9. Changes and contact',
        paragraphs: [
          `This policy may change; the current version is always published here. Questions: ${o.email}`,
        ],
      },
    ],
  },
  'responsible-play': {
    title: 'Responsible Play',
    intro:
      'Jhandi Burja is for fun. Coins are virtual, not money — but your time and feelings are real. Here is how we keep play healthy.',
    sections: [
      {
        heading: 'Built into the game',
        paragraphs: [
          '18+ confirmation at sign-in.',
          'Bet limits per table: each host sets the smallest and largest bet for their table.',
          'Time reminder: a notice every hour you keep playing.',
          'Transparent dice: every round is committed by hash beforehand; "Check fairness" lets you verify it yourself.',
        ],
      },
      {
        heading: 'Ask yourself',
        paragraphs: [
          'Am I playing longer than I meant to? Am I playing to "win back" coins? Is play affecting work, study or family? If any answer is yes, take a break.',
        ],
      },
      {
        heading: 'Remember',
        paragraphs: [
          'There is no way to turn coins into money — anyone offering that is running a scam; please report it to us.',
          'If you want to stop, write to us to freeze or delete your account; we do it promptly.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [`${o.email} — for anything about the game, your account or a concern.`],
      },
    ],
  },
}

export const legalContent: Record<Language, Record<LegalDoc, LegalContent>> = { ne, en }
