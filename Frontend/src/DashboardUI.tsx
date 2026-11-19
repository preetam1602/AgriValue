import type { Harvest, Profile } from './api';

type IconName = 'home' | 'harvests' | 'markets' | 'profile' | 'leaf' | 'arrow' | 'plus' | 'logout' | 'farm';
export function DashboardIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v11H3Z" /><path d="M9 21v-8h6v8" /></>,
    harvests: <><path d="M12 22V4M12 9C6 9 5 6 5 3c5 0 7 2 7 6ZM12 15c6 0 7-3 7-6-5 0-7 2-7 6ZM12 20c-6 0-7-3-7-6 5 0 7 2 7 6Z" /></>,
    markets: <><path d="M3 10h18l-2-6H5ZM5 10v11h14V10M9 21v-7h6v7" /><path d="M3 10c0 4 4 4 4 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 4 4 4 0" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 22v-2a8 8 0 0 1 16 0v2" /></>,
    leaf: <><path d="M20 3C9 2 3 7 5 14c2 7 14 6 15-11Z" /><path d="m3 22 12-12" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    logout: <><path d="M9 4H4v16h5M9 12h12m-4-4 4 4-4 4" /></>,
    farm: <><path d="m3 11 9-8 9 8v10H3ZM9 21v-8h6v8M3 11h18" /></>,
  };
  return <svg className="dashboard-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function DashboardHome({ profile, harvests, loading }: { profile: Profile | null; harvests: Harvest[]; loading: boolean }) {
  return <>
    <header className="dashboard-page-heading"><div><p className="eyebrow">YOUR FARM, AT A GLANCE</p><h1>{profile?.name ? `Welcome back, ${profile.name}` : 'Welcome to your farm dashboard'}</h1><p>A little planning. More possibilities for every harvest.</p></div><a className="button primary" href="#add-harvest"><DashboardIcon name="plus" />Add harvest</a></header>
    <div className="dashboard-stats" aria-label="Farm overview">
      <article className="dashboard-stat"><span className="stat-icon orange"><DashboardIcon name="harvests" /></span><div><p>Harvest records</p><strong>{loading ? '—' : harvests.length}</strong><span>Everything you have recorded</span></div><a href="#harvests" aria-label="View harvest records"><DashboardIcon name="arrow" /></a></article>
    </div>
    <div className="dashboard-home-grid">
      <section className="dashboard-panel"><header className="dashboard-panel-heading"><div><h2>Your harvests</h2><p>Keep your crop details in one place.</p></div><a href="#harvests">View all <DashboardIcon name="arrow" /></a></header>
        {loading ? <div className="dashboard-empty"><p>Loading your harvests…</p></div> : harvests.length ? <div className="recent-harvests">{harvests.slice(-3).reverse().map(harvest => <a className="recent-harvest" href="#harvests" key={harvest.id}><span className="stat-icon"><DashboardIcon name="harvests" /></span><div><strong>{harvest.crop}</strong><span>{harvest.variety} · Harvest #{harvest.id}</span></div><div className="recent-quantity"><strong>{harvest.quantity_qtl} qtl</strong><span>{harvest.harvest_date}</span></div></a>)}</div> : <div className="dashboard-empty"><span className="empty-crop"><DashboardIcon name="harvests" /></span><h3>Your next harvest starts here</h3><p>Record your crop, quantity and sale dates.<br />We’ll keep the details together for you.</p><a className="button primary" href="#add-harvest"><DashboardIcon name="plus" />Record your first harvest</a></div>}
      </section>
      <aside className="dashboard-start"><span className="dashboard-tag"><DashboardIcon name="leaf" />YOUR HARVEST, ONE PLACE</span><h2>Enter once.<br />Keep it together.</h2><p>Fill in your location, crop, quantity and sale dates. Tap Save harvest to keep everything in one harvest record.</p><p>Your records are the starting point for future predictions and selling plans.</p><a className="button" href="#add-harvest">Add harvest</a></aside>
    </div>
    <div className="dashboard-footnote"><DashboardIcon name="leaf" /><span>A clearer picture of your farm, one harvest at a time.</span></div>
  </>;
}

export function AccountOverview({ profile }: { profile: Profile }) {
  return <section className="dashboard-panel account-overview" aria-labelledby="account-overview-title">
    <div className="account-overview-heading"><span className="account-portrait">{profile.name?.slice(0, 1).toUpperCase() || <DashboardIcon name="profile" />}</span><div><p className="eyebrow">YOUR AGRIVALUE ACCOUNT</p><h2 id="account-overview-title">{profile.name || 'Your account'}</h2><p>Account #{profile.id}</p></div></div>
    <dl className="account-details"><div><dt>Account role</dt><dd className="account-role">{profile.role}</dd></div><div><dt>Status</dt><dd><span className={`account-status ${profile.status === 'active' ? 'is-active' : ''}`}>{profile.status}</span></dd></div><div><dt>Preferred language</dt><dd>{profile.language === 'kn' ? 'ಕನ್ನಡ (Kannada)' : 'English'}</dd></div></dl>
  </section>;
}
