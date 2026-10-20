import { create } from 'zustand'

const ne = {
  appName: 'झण्डी बुर्जा',
  tagline: 'दशैंको रमाइलो, अनलाइन',
  phoneLabel: 'मोबाइल नम्बर',
  phonePlaceholder: '98XXXXXXXX',
  sendCode: 'कोड पठाउनुहोस्',
  codeLabel: '६ अंकको कोड',
  codeSentTo: 'कोड पठाइयो:',
  devCodeNotice: 'डेभलपमेन्ट मोड: SMS पठाइँदैन। कोड:',
  verify: 'साइन इन',
  changeNumber: 'नम्बर बदल्नुहोस्',
  resendIn: 'फेरि पठाउन {s} सेकेन्ड',
  resend: 'कोड फेरि पठाउनुहोस्',
  orContinueWith: 'वा',
  welcomeTitle: 'स्वागत छ, {name}!',
  welcomeBonus: 'तपाईंलाई दशैंको उपहार',
  coins: 'कोइन',
  welcomePlay: 'खेल्नुहोस्',
  welcomePlayHint: 'कुनै कोठामा गएर झण्डा वा बुर्जामा कोइन राख्नुहोस्।',
  welcomeHost: 'खेलाउनुहोस् (होस्ट)',
  welcomeHostHint: '५,००० कोइन राखेर आफ्नै कोठा खोल्नुहोस्।',
  continue: 'अगाडि बढ्नुहोस्',
  comingSoon: 'छिट्टै आउँदैछ',
  balance: 'ब्यालेन्स',
  dailyBonus: 'आजको बोनस',
  claim: 'लिनुहोस्',
  claimed: 'आजको बोनस लिइसक्नुभयो',
  nextBonusAt: 'अर्को बोनस: {time}',
  wallet: 'वालेट',
  history: 'कारोबार',
  loadMore: 'अझै हेर्नुहोस्',
  noTransactions: 'अहिलेसम्म कुनै कारोबार छैन।',
  logout: 'लग आउट',
  home: 'गृह',
  lobby: 'लबी',
  'tx.SIGNUP_BONUS': 'साइन-अप बोनस',
  'tx.DAILY_BONUS': 'दैनिक बोनस',
  'tx.HOST_DEPOSIT': 'होस्ट डिपोजिट',
  'tx.BANK_TOPUP': 'बैंक थप',
  'tx.BET': 'बाजी',
  'tx.BET_CANCEL': 'बाजी रद्द',
  'tx.SETTLE': 'नतिजा',
  'tx.PLATFORM_FEE': 'प्लेटफर्म शुल्क',
  'tx.ROOM_CLOSE': 'कोठा बन्द',
  'tx.ADJUSTMENT': 'समायोजन',
  'error.generic': 'केही गडबड भयो। फेरि प्रयास गर्नुहोस्।',
  'error.INVALID_CODE': 'कोड मिलेन वा म्याद सकियो।',
  'error.RATE_LIMITED': 'धेरै पटक प्रयास भयो। केही बेर पर्खनुहोस्।',
  'error.VALIDATION_FAILED': 'नम्बर वा कोड जाँच गर्नुहोस्।',
  'error.ALREADY_CLAIMED': 'आजको बोनस लिइसक्नुभयो।',
  'error.FORBIDDEN': 'यो खाता सक्रिय छैन।',
} as const

export type MessageKey = keyof typeof ne

const en: Record<MessageKey, string> = {
  appName: 'Jhandi Burja',
  tagline: 'Dashain fun, online',
  phoneLabel: 'Mobile number',
  phonePlaceholder: '98XXXXXXXX',
  sendCode: 'Send code',
  codeLabel: '6-digit code',
  codeSentTo: 'Code sent to',
  devCodeNotice: 'Development mode: no SMS is sent. Code:',
  verify: 'Sign in',
  changeNumber: 'Change number',
  resendIn: 'Resend in {s}s',
  resend: 'Resend code',
  orContinueWith: 'or',
  welcomeTitle: 'Welcome, {name}!',
  welcomeBonus: 'Your Dashain gift',
  coins: 'coins',
  welcomePlay: 'Play',
  welcomePlayHint: 'Join a room and put coins on the flag or the crown.',
  welcomeHost: 'Host',
  welcomeHostHint: 'Deposit 5,000 coins and open your own room.',
  continue: 'Continue',
  comingSoon: 'Coming soon',
  balance: 'Balance',
  dailyBonus: "Today's bonus",
  claim: 'Claim',
  claimed: "Today's bonus claimed",
  nextBonusAt: 'Next bonus: {time}',
  wallet: 'Wallet',
  history: 'Transactions',
  loadMore: 'Load more',
  noTransactions: 'No transactions yet.',
  logout: 'Log out',
  home: 'Home',
  lobby: 'Lobby',
  'tx.SIGNUP_BONUS': 'Sign-up bonus',
  'tx.DAILY_BONUS': 'Daily bonus',
  'tx.HOST_DEPOSIT': 'Host deposit',
  'tx.BANK_TOPUP': 'Bank top-up',
  'tx.BET': 'Bet',
  'tx.BET_CANCEL': 'Bet cancelled',
  'tx.SETTLE': 'Round result',
  'tx.PLATFORM_FEE': 'Platform fee',
  'tx.ROOM_CLOSE': 'Room closed',
  'tx.ADJUSTMENT': 'Adjustment',
  'error.generic': 'Something went wrong. Please try again.',
  'error.INVALID_CODE': 'Wrong or expired code.',
  'error.RATE_LIMITED': 'Too many attempts. Please wait a bit.',
  'error.VALIDATION_FAILED': 'Please check the number or code.',
  'error.ALREADY_CLAIMED': "You've already claimed today's bonus.",
  'error.FORBIDDEN': 'This account is not active.',
}

export type Language = 'ne' | 'en'

const dictionaries: Record<Language, Record<MessageKey, string>> = { ne, en }

const readStoredLanguage = (): Language => {
  try {
    return localStorage.getItem('lang') === 'en' ? 'en' : 'ne'
  } catch {
    return 'ne'
  }
}

interface LanguageStore {
  language: Language
  setLanguage: (language: Language) => void
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  language: readStoredLanguage(),
  setLanguage: (language) => {
    try {
      localStorage.setItem('lang', language)
    } catch {
      // Private mode: the choice just isn't remembered.
    }
    document.documentElement.lang = language
    set({ language })
  },
}))

export const translate = (
  language: Language,
  key: MessageKey,
  params: Record<string, string | number> = {},
): string =>
  Object.entries(params).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    dictionaries[language][key],
  )

export const useT = () => {
  const language = useLanguageStore((s) => s.language)
  return (key: MessageKey, params?: Record<string, string | number>) =>
    translate(language, key, params)
}

export const isMessageKey = (key: string): key is MessageKey => key in ne
