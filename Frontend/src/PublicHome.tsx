import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, errorMessage, forgetPhone, getRememberedPhone, rememberPhone } from './api';

type Language = 'en' | 'kn';
type IconName = 'leaf' | 'market' | 'store' | 'straw' | 'plan' | 'check' | 'arrow';

function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    leaf: <><path d="M20 3C9 2 3 7 5 14c2 7 14 6 15-11Z" /><path d="M3 22 15 10M8 17v-5M8 17h5" /></>,
    market: <><path d="M3 10h18l-2-6H5l-2 6ZM5 10v10h14V10M9 20v-6h6v6M3 10c0 4 4 4 4 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 4 4 4 0" /></>,
    store: <><path d="m3 10 9-7 9 7v11H3V10ZM8 21v-9h8v9M8 16h8" /><path d="M12 6v3" /></>,
    straw: <><path d="M12 21V5M8 21l-3-9M16 21l3-9M12 8C7 8 6 5 7 3c4 0 5 2 5 5ZM12 12c5 0 6-3 5-5-4 0-5 2-5 5ZM12 16c-5 0-6-3-5-5 4 0 5 2 5 5Z" /></>,
    plan: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M8 12l2 2 5-5M8 18h8" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  };
  return <svg className={`line-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const copy = {
  en: {
    home: 'Home', features: 'Features', how: 'How it works', start: 'Get started', menu: 'Menu',
    title: 'Sell your harvest smarter.', titleGreen: 'Make more of your straw.',
    intro: 'Compare nearby markets, decide when to sell, and find buyers for your ragi straw.', explore: 'Explore features',
    sample: 'Sample recommendation', action: 'Sell now at Market B', amount: '₹74,570', estimated: 'Estimated net return', buyer: 'Straw buyer available',
    featureTitle: 'Plan what happens after harvest',
    featureNames: ['Market prices', 'Sell or store', 'Straw buyers', 'Combined plan'],
    featureDescriptions: ['Compare nearby market prices and see when they were recorded.', 'Compare selling now with waiting, after costs and storage needs.', 'Find verified buyers suited to your available ragi straw.', 'Bring your crop and straw decisions into one practical plan.'],
    values: ['Nearby prices', 'Costs accounted for', 'Verified buyers', 'One combined plan'],
    previewTitle: 'See what you could take home',
    steps: ['Record your harvest', 'Compare your options', 'Choose your plan'],
    stepDescriptions: ['Add your ragi quantity, farm details and sale requirements.', 'See crop and straw options with costs accounted for.', 'Review the estimated return, timing and any warnings.'],
    sampleLabel: 'Sample harvest · Ragi', comparison: 'Crop comparison', market: 'Market', timing: 'Timing', net: 'Net return', status: 'Status', marketB: 'Market B', now: 'Sell now', selected: 'Selected', storage: 'Storage', unavailable: 'Not evaluated', noForecast: 'Storage not evaluated — insufficient price data', illustration: 'Illustrative sample, not a live market quote.',
    closing: 'Plan your next ragi sale', signin: 'Sign in', signinIntro: 'Use your mobile number to sign in to AgriValue.', number: 'Mobile number', send: 'Send OTP', language: 'Language', backend: 'OTP sign-in is not connected yet. No code was sent. Your number has been kept; try again once the accounts service is connected.', retry: 'Try again', back: 'Back to homepage', phoneError: 'Enter a valid 10-digit Indian mobile number.', photo: 'A farmer looking at a tablet in a ragi field in Karnataka',
  },
  kn: {
    home: 'ಮುಖಪುಟ', features: 'ವೈಶಿಷ್ಟ್ಯಗಳು', how: 'ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ', start: 'ಪ್ರಾರಂಭಿಸಿ', menu: 'ಮೆನು',
    title: 'ನಿಮ್ಮ ಬೆಳೆಯನ್ನು ಜಾಣ್ಮೆಯಿಂದ ಮಾರಿ.', titleGreen: 'ನಿಮ್ಮ ಒಣಹುಲ್ಲಿನಿಂದ ಹೆಚ್ಚು ಪಡೆಯಿರಿ.',
    intro: 'ಹತ್ತಿರದ ಮಾರುಕಟ್ಟೆಗಳನ್ನು ಹೋಲಿಸಿ, ಯಾವಾಗ ಮಾರಬೇಕೆಂದು ನಿರ್ಧರಿಸಿ ಮತ್ತು ರಾಗಿ ಒಣಹುಲ್ಲಿಗೆ ಖರೀದಿದಾರರನ್ನು ಹುಡುಕಿ.', explore: 'ವೈಶಿಷ್ಟ್ಯಗಳನ್ನು ನೋಡಿ',
    sample: 'ಮಾದರಿ ಶಿಫಾರಸು', action: 'ಮಾರುಕಟ್ಟೆ B ಯಲ್ಲಿ ಈಗ ಮಾರಿ', amount: '₹74,570', estimated: 'ಅಂದಾಜು ನಿವ್ವಳ ಆದಾಯ', buyer: 'ಒಣಹುಲ್ಲಿನ ಖರೀದಿದಾರರು ಲಭ್ಯ',
    featureTitle: 'ಕೊಯ್ಲಿನ ನಂತರದ ಯೋಜನೆ ರೂಪಿಸಿ',
    featureNames: ['ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು', 'ಮಾರಾಟ ಅಥವಾ ಸಂಗ್ರಹಣೆ', 'ಒಣಹುಲ್ಲಿನ ಖರೀದಿದಾರರು', 'ಸಂಯೋಜಿತ ಯೋಜನೆ'],
    featureDescriptions: ['ಹತ್ತಿರದ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು ಮತ್ತು ಅವುಗಳ ದಿನಾಂಕಗಳನ್ನು ಹೋಲಿಸಿ.', 'ವೆಚ್ಚ ಮತ್ತು ಸಂಗ್ರಹಣೆಯ ಅಗತ್ಯಗಳೊಂದಿಗೆ ಈಗ ಮಾರಾಟ ಮತ್ತು ಕಾಯುವುದನ್ನು ಹೋಲಿಸಿ.', 'ನಿಮ್ಮ ರಾಗಿ ಒಣಹುಲ್ಲಿಗೆ ಸೂಕ್ತವಾದ ಪರಿಶೀಲಿತ ಖರೀದಿದಾರರನ್ನು ಹುಡುಕಿ.', 'ಬೆಳೆ ಮತ್ತು ಒಣಹುಲ್ಲಿನ ನಿರ್ಧಾರಗಳನ್ನು ಒಂದೇ ಯೋಜನೆಯಲ್ಲಿ ಸೇರಿಸಿ.'],
    values: ['ಹತ್ತಿರದ ಬೆಲೆಗಳು', 'ವೆಚ್ಚಗಳ ಲೆಕ್ಕಾಚಾರ', 'ಪರಿಶೀಲಿತ ಖರೀದಿದಾರರು', 'ಒಂದು ಸಂಯೋಜಿತ ಯೋಜನೆ'],
    previewTitle: 'ನಿಮಗೆ ಸಿಗಬಹುದಾದ ಆದಾಯ ನೋಡಿ',
    steps: ['ಕೊಯ್ಲಿನ ವಿವರಗಳನ್ನು ದಾಖಲಿಸಿ', 'ನಿಮ್ಮ ಆಯ್ಕೆಗಳನ್ನು ಹೋಲಿಸಿ', 'ನಿಮ್ಮ ಯೋಜನೆಯನ್ನು ಆರಿಸಿ'],
    stepDescriptions: ['ರಾಗಿ ಪ್ರಮಾಣ, ಹೊಲದ ವಿವರಗಳು ಮತ್ತು ಮಾರಾಟದ ಅಗತ್ಯಗಳನ್ನು ಸೇರಿಸಿ.', 'ವೆಚ್ಚಗಳನ್ನು ಒಳಗೊಂಡ ಬೆಳೆ ಮತ್ತು ಒಣಹುಲ್ಲಿನ ಆಯ್ಕೆಗಳನ್ನು ನೋಡಿ.', 'ಅಂದಾಜು ಆದಾಯ, ಸಮಯ ಮತ್ತು ಎಚ್ಚರಿಕೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.'],
    sampleLabel: 'ಮಾದರಿ ಕೊಯ್ಲು · ರಾಗಿ', comparison: 'ಬೆಳೆ ಹೋಲಿಕೆ', market: 'ಮಾರುಕಟ್ಟೆ', timing: 'ಸಮಯ', net: 'ನಿವ್ವಳ ಆದಾಯ', status: 'ಸ್ಥಿತಿ', marketB: 'ಮಾರುಕಟ್ಟೆ B', now: 'ಈಗ ಮಾರಿ', selected: 'ಆಯ್ಕೆ ಮಾಡಲಾಗಿದೆ', storage: 'ಸಂಗ್ರಹಣೆ', unavailable: 'ಮೌಲ್ಯಮಾಪನ ಮಾಡಿಲ್ಲ', noForecast: 'ಸಂಗ್ರಹಣೆಯ ಮೌಲ್ಯಮಾಪನ ಮಾಡಿಲ್ಲ — ಸಾಕಷ್ಟು ಬೆಲೆ ಮಾಹಿತಿ ಇಲ್ಲ', illustration: 'ಇದು ಕೇವಲ ಮಾದರಿ; ನೇರ ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಅಲ್ಲ.',
    closing: 'ನಿಮ್ಮ ಮುಂದಿನ ರಾಗಿ ಮಾರಾಟವನ್ನು ಯೋಜಿಸಿ', signin: 'ಪ್ರವೇಶಿಸಿ', signinIntro: 'AgriValue ಗೆ ಪ್ರವೇಶಿಸಲು ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ಬಳಸಿ.', number: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ', send: 'OTP ಕಳುಹಿಸಿ', language: 'ಭಾಷೆ', backend: 'OTP ಸೇವೆ ಇನ್ನೂ ಸಂಪರ್ಕಗೊಂಡಿಲ್ಲ. ಕೋಡ್ ಕಳುಹಿಸಲಾಗಿಲ್ಲ. ನಿಮ್ಮ ಸಂಖ್ಯೆಯನ್ನು ಉಳಿಸಿಕೊಳ್ಳಲಾಗಿದೆ; ಸೇವೆ ಸಂಪರ್ಕಗೊಂಡ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', retry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ', back: 'ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ', phoneError: 'ಮಾನ್ಯವಾದ 10 ಅಂಕಿಗಳ ಭಾರತೀಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ.', photo: 'ಕರ್ನಾಟಕದ ರಾಗಿ ಹೊಲದಲ್ಲಿ ಟ್ಯಾಬ್ಲೆಟ್ ನೋಡುತ್ತಿರುವ ರೈತ',
  },
};

const authCopy = {
  en: {
    welcome: 'Welcome back', continue: 'Send an OTP to your saved number to sign in.',
    another: 'Use another number', remember: 'Remember my number on this device',
    keep: 'Keep me signed in on this device', shared: 'Using a shared phone? Turn both options off.',
  },
  kn: {
    welcome: 'ಮತ್ತೆ ಸ್ವಾಗತ', continue: 'ಪ್ರವೇಶಿಸಲು ಉಳಿಸಿದ ಸಂಖ್ಯೆಗೆ OTP ಕಳುಹಿಸಿ.',
    another: 'ಬೇರೆ ಸಂಖ್ಯೆ ಬಳಸಿ', remember: 'ಈ ಸಾಧನದಲ್ಲಿ ನನ್ನ ಸಂಖ್ಯೆಯನ್ನು ನೆನಪಿಡಿ',
    keep: 'ಈ ಸಾಧನದಲ್ಲಿ ನನ್ನನ್ನು ಪ್ರವೇಶದಲ್ಲಿರಿಸಿ', shared: 'ಹಂಚಿಕೊಂಡ ಫೋನ್ ಬಳಸುತ್ತಿದ್ದೀರಾ? ಈ ಆಯ್ಕೆಗಳನ್ನು ಆರಿಸಬೇಡಿ.',
  },
};

export default function PublicHome() {
  const [language, setLanguage] = useState<Language>(() => getRememberedPhone()?.language ?? 'en');
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(window.location.hash === '#sign-in');
  const [remembered, setRemembered] = useState(getRememberedPhone);
  const [phone, setPhone] = useState(() => getRememberedPhone()?.phone ?? '');
  const [useRemembered, setUseRemembered] = useState(() => Boolean(getRememberedPhone()));
  const [rememberNumber, setRememberNumber] = useState(() => Boolean(getRememberedPhone()));
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const mainRef = useRef<HTMLElement>(null);
  const t = copy[language];
  const auth = authCopy[language];

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const navigate = () => {
      const next = window.location.hash === '#sign-in';
      setSigningIn(next);
      setMenuOpen(false);
      if (next) {
        const saved = getRememberedPhone();
        setRemembered(saved);
        setPhone(saved?.phone ?? '');
        setUseRemembered(Boolean(saved));
        setRememberNumber(Boolean(saved));
        if (saved) setLanguage(saved.language);
        setOtpRequested(false); setOtp(''); setDemoOtp(''); setError('');
      }
      if (next || window.location.hash === '#public-home') {
        window.scrollTo({ top: 0 });
        mainRef.current?.focus();
      }
      if (['#features', '#how-it-works'].includes(window.location.hash)) {
        requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView());
      }
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.requestOtp(phone, language);
      setOtpRequested(true);
      setDemoOtp(result.demo_otp ?? '');
      setCooldown(60);
      setOtp('');
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.verifyOtp(phone, otp, keepSignedIn);
      if (rememberNumber) rememberPhone(phone, language);
      else forgetPhone();
      setRemembered(getRememberedPhone());
      setOtp('');
      setDemoOtp('');
      setPhone('');
      setOtpRequested(false);
      setCooldown(0);
      window.location.hash = 'home';
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  function changeLanguage(next: Language) {
    setLanguage(next);
    setError('');
  }

  function changeNumber() {
    forgetPhone();
    setRemembered(null); setUseRemembered(false); setRememberNumber(false);
    setPhone(''); setOtpRequested(false); setOtp(''); setDemoOtp(''); setError(''); setCooldown(0);
    requestAnimationFrame(() => document.getElementById('mobile-number')?.focus());
  }

  const featureIcons: IconName[] = ['market', 'store', 'straw', 'plan'];
  return (
    <div className="public-site" lang={language}>
      <a className="skip-link" href="#public-main" onClick={event => { event.preventDefault(); mainRef.current?.focus(); }}>{language === 'en' ? 'Skip to content' : 'ವಿಷಯಕ್ಕೆ ಹೋಗಿ'}</a>
      <header className="public-header">
        <div className="public-header-inner">
          <a className="public-brand" href="#public-home"><Icon name="leaf" />AgriValue</a>
          <button className="menu-button" type="button" aria-expanded={menuOpen} aria-controls="public-navigation" onClick={() => setMenuOpen(!menuOpen)}>{t.menu}<span aria-hidden="true">☰</span></button>
          <nav id="public-navigation" className={menuOpen ? 'public-nav is-open' : 'public-nav'} aria-label={language === 'en' ? 'Public navigation' : 'ಮುಖ್ಯ ಸಂಚರಣೆ'}>
            <a href="#public-home">{t.home}</a><a href="#features">{t.features}</a><a href="#how-it-works">{t.how}</a>
          </nav>
          <div className="header-actions">
            <label className="language-control"><span className="sr-only">{t.language}</span><select value={language} onChange={event => changeLanguage(event.target.value as Language)}><option value="en">English</option><option value="kn">ಕನ್ನಡ</option></select></label>
            <a className="button primary" href="#sign-in">{t.start}<Icon name="arrow" /></a>
          </div>
        </div>
      </header>

      <main className="public-main" id="public-main" ref={mainRef} tabIndex={-1}>
        <div hidden={signingIn}>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-photo"><img src="/images/ragi-farmer.png" width="1752" height="897" alt={t.photo} fetchPriority="high" /></div>
            <div className="hero-overlay" />
            <div className="hero-copy"><h1 id="hero-title">{t.title}<span>{t.titleGreen}</span></h1><p>{t.intro}</p><div className="hero-actions"><a className="button primary" href="#sign-in">{t.start}<Icon name="arrow" /></a><a className="button white-button" href="#features">{t.explore}</a></div></div>
            <aside className="hero-recommendation" aria-label={t.sample}><p className="sample-label"><span className="sample-dot" />{t.sample}</p><h2>{t.action}</h2><p className="hero-amount">{t.amount}<span>{t.estimated}</span></p><p className="buyer-note"><Icon name="check" />{t.buyer}</p></aside>
          </section>

          <section className="features-section page-width" id="features" aria-labelledby="features-title">
            <h2 className="marketing-heading centered" id="features-title">{t.featureTitle}</h2>
            <div className="feature-grid">{t.featureNames.map((name, index) => <article className="feature-card" key={name}><span className="feature-icon"><Icon name={featureIcons[index]} /></span><h3>{name}</h3><p>{t.featureDescriptions[index]}</p></article>)}</div>
          </section>

          <div className="value-band page-width">{t.values.map((value, index) => <div key={value}><Icon name={index === 1 ? 'check' : featureIcons[index]} /><span>{value}</span></div>)}</div>

          <section className="product-section page-width" id="how-it-works" aria-labelledby="preview-title">
            <div className="walkthrough"><h2 className="marketing-heading" id="preview-title">{t.previewTitle}</h2><ol>{t.steps.map((step, index) => <li key={step}><span className="step-number" aria-hidden="true">{index + 1}</span><div><h3>{step}</h3><p>{t.stepDescriptions[index]}</p></div></li>)}</ol></div>
            <div className="product-previews">
              <div className="desktop-preview"><div className="preview-toolbar"><span className="preview-brand"><Icon name="leaf" />AgriValue</span><span>{t.sampleLabel}</span></div><div className="desktop-preview-content"><h3>{t.comparison}</h3><p className="preview-sample">{t.sample}</p><table><caption className="sr-only">{t.comparison} — {t.sampleLabel}</caption><thead><tr><th scope="col">{t.market}</th><th scope="col">{t.timing}</th><th scope="col">{t.net}</th><th scope="col">{t.status}</th></tr></thead><tbody><tr><td>{t.marketB}</td><td>{t.now}</td><td className="numeric">{t.amount}</td><td><span className="selected-status">{t.selected}</span></td></tr></tbody></table><p className="forecast-note">{t.noForecast}</p><p className="sample-disclaimer">{t.illustration}</p></div></div>
              <div className="phone-preview"><div className="phone-speaker" /><div className="phone-header"><Icon name="leaf" />AgriValue</div><div className="phone-content"><p className="preview-sample">{t.sampleLabel}</p><p className="phone-title">{t.sample}</p><h3>{t.action}</h3><div className="sample-return"><span>{t.estimated}</span><strong>{t.amount}</strong></div><p className="phone-buyer"><Icon name="check" />{t.buyer}</p><p className="sample-disclaimer">{t.illustration}</p></div></div>
            </div>
          </section>

          <footer className="closing-cta"><div className="page-width"><Icon name="leaf" /><h2 className="marketing-heading">{t.closing}</h2><a className="button primary" href="#sign-in">{t.start}<Icon name="arrow" /></a></div></footer>
        </div>

        <section className="signin-section" hidden={!signingIn} aria-labelledby="signin-title">
          <a className="back-link" href="#public-home">← {t.back}</a>
          <div className="card signin-card"><Icon name="leaf" /><h1 id="signin-title">{useRemembered && remembered ? auth.welcome : t.signin}</h1><p>{useRemembered && remembered ? auth.continue : t.signinIntro}</p>
            <fieldset className="language-options"><legend>{t.language}</legend><label><input type="radio" name="language" checked={language === 'en'} onChange={() => changeLanguage('en')} />English</label><label lang="kn"><input type="radio" name="language" checked={language === 'kn'} onChange={() => changeLanguage('kn')} />ಕನ್ನಡ</label></fieldset>
            <form onSubmit={requestOtp}>
              {useRemembered && remembered ? <div className="remembered-number"><p>{t.number}: <strong>+91 ••••••{remembered.phone.slice(-4)}</strong></p><button className="button" type="button" disabled={busy} onClick={changeNumber}>{auth.another}</button></div> : <>
                <label htmlFor="mobile-number">{t.number}</label>
                <div className="phone-input"><span>+91</span><input id="mobile-number" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} required value={phone} disabled={busy || otpRequested} onChange={event => { setPhone(event.target.value); setError(''); event.target.setCustomValidity(''); }} onInvalid={event => event.currentTarget.setCustomValidity(t.phoneError)} /></div>
              </>}
              <label className="confirmation"><input type="checkbox" checked={keepSignedIn} onChange={event => setKeepSignedIn(event.target.checked)} disabled={busy} />{auth.keep}</label>
              <label className="confirmation"><input type="checkbox" checked={rememberNumber} onChange={event => { setRememberNumber(event.target.checked); if (!event.target.checked) { forgetPhone(); setRemembered(null); setUseRemembered(false); } }} disabled={busy} />{auth.remember}</label>
              <p className="secondary signin-options-hint">{auth.shared}</p>
              <button className="button primary" type="submit" disabled={busy || cooldown > 0}>{busy ? (language === 'en' ? 'Please wait…' : 'ದಯವಿಟ್ಟು ಕಾಯಿರಿ…') : cooldown > 0 ? `${language === 'en' ? 'Resend in' : 'ಮತ್ತೆ ಕಳುಹಿಸಿ'} ${cooldown}s` : otpRequested ? (language === 'en' ? 'Resend OTP' : 'OTP ಮತ್ತೆ ಕಳುಹಿಸಿ') : t.send}<Icon name="arrow" /></button>
            </form>
            {otpRequested && <form onSubmit={verifyOtp} className="otp-form">
              <p role="status">{language === 'en' ? 'Enter the six-digit OTP. It expires in five minutes.' : 'ಆರು ಅಂಕಿಗಳ OTP ನಮೂದಿಸಿ. ಇದು ಐದು ನಿಮಿಷಗಳಲ್ಲಿ ಅವಧಿ ಮುಗಿಯುತ್ತದೆ.'}</p>
              {demoOtp && <p className="status">{language === 'en' ? 'Development demo OTP (no SMS sent):' : 'ಡೆಮೊ OTP (SMS ಕಳುಹಿಸಿಲ್ಲ):'} <strong>{demoOtp}</strong></p>}
              <label htmlFor="otp-code">OTP</label><input id="otp-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={event => setOtp(event.target.value)} disabled={busy} />
              <button className="button primary" type="submit" disabled={busy}>{language === 'en' ? 'Verify and sign in' : 'ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಪ್ರವೇಶಿಸಿ'}</button>
              <button className="button" type="button" disabled={busy} onClick={changeNumber}>{auth.another}</button>
            </form>}
            {error && <p id="signin-error" className="status" role="alert">{error}</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
