import { useEffect, useRef, useState, type FormEvent } from 'react';
import PublicHome from './PublicHome';
import FarmLocation from './FarmLocation';
import { AccountOverview, DashboardHome, DashboardIcon } from './DashboardUI';
import { api, ApiError, errorMessage, hasSession, setLanguage, type Farm, type Harvest, type Profile, type ReferenceData } from './api';

const destinations = ['home', 'harvests', 'add-harvest', 'markets', 'profile'] as const;
type Screen = typeof destinations[number];
function currentScreen(): Screen {
  return destinations.find(destination => destination === window.location.hash.slice(1)) ?? 'home';
}
const isPrivateRoute = () => destinations.some(destination => destination === window.location.hash.slice(1));

export default function App() {
  const [screen, setScreen] = useState<Screen>(currentScreen);
  const [privateRoute, setPrivateRoute] = useState(isPrivateRoute);
  const [signedIn, setSignedIn] = useState(hasSession);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [farmId, setFarmId] = useState('');
  const [addingFarm, setAddingFarm] = useState(false);
  const [crop, setCrop] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('qtl');
  const [confirmHigh, setConfirmHigh] = useState(false);
  const [highWarning, setHighWarning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [deleteHarvestId, setDeleteHarvestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recordsLoadFailed, setRecordsLoadFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const harvestForm = useRef<HTMLFormElement>(null);
  const recordsRequest = useRef(0);
  const activeDestination = screen === 'add-harvest' ? 'harvests' : screen;
  const publicView = !privateRoute || !signedIn;
  const selectedFarm = farms.find(farm => String(farm.id) === farmId);

  async function refreshSavedRecords() {
    const request = ++recordsRequest.current;
    const [farmRecords, harvestRecords] = await Promise.allSettled([api.farms(), api.harvests()]);
    if (!hasSession() || request !== recordsRequest.current) return false;
    if (farmRecords.status === 'fulfilled') setFarms(farmRecords.value);
    if (harvestRecords.status === 'fulfilled') setHarvests(harvestRecords.value);
    return farmRecords.status === 'fulfilled' && harvestRecords.status === 'fulfilled';
  }

  function chooseFarm(id: string) {
    setFarmId(id);
    setAddingFarm(!id);
    setConfirmHigh(false);
    setHighWarning(false);
  }

  useEffect(() => {
    if (screen === 'add-harvest' && (error || notice)) document.getElementById('harvest-save-status')?.focus();
  }, [error, notice, screen]);

  useEffect(() => {
    const navigate = () => { setScreen(currentScreen()); setPrivateRoute(isPrivateRoute()); mainRef.current?.focus(); };
    const sessionChanged = () => { setSignedIn(hasSession()); if (hasSession()) setReload(value => value + 1); };
    window.addEventListener('hashchange', navigate);
    window.addEventListener('sessionchange', sessionChanged);
    return () => { window.removeEventListener('hashchange', navigate); window.removeEventListener('sessionchange', sessionChanged); };
  }, []);

  useEffect(() => {
    if (!signedIn && privateRoute) window.location.hash = 'sign-in';
    if (signedIn && window.location.hash === '#sign-in') window.location.hash = 'home';
    if (signedIn && !window.location.hash) window.location.hash = 'home';
  }, [signedIn, privateRoute]);

  useEffect(() => {
    const request = ++recordsRequest.current;
    if (!signedIn) { setProfile(null); setFarms([]); setHarvests([]); setReference(null); setFarmId(''); setAddingFarm(false); setDeleteHarvestId(null); setError(''); setRecordsLoadFailed(false); setNotice(''); return; }
    let cancelled = false;
    setLoading(true);
    setError('');
    setRecordsLoadFailed(false);
    async function load() {
      try {
        const me = await api.profile();
        if (cancelled) return;
        setProfile(me);
        setLanguage(me.language);
        const [farmRecords, harvestRecords, options] = await Promise.all([api.farms(), api.harvests(), api.referenceData()]);
        if (!cancelled && request === recordsRequest.current) {
          setFarms(farmRecords); setHarvests(harvestRecords); setReference(options);
          setFarmId(previous => farmRecords.some(farm => String(farm.id) === previous) ? previous : addingFarm ? '' : String(farmRecords[0]?.id ?? ''));
          setCrop(previous => previous in options.crops ? previous : '');
        }
      } catch (error) { if (!cancelled) { setError(errorMessage(error)); setRecordsLoadFailed(true); } }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [signedIn, reload]);

  useEffect(() => {
    if (!signedIn || !reference || busy || (screen !== 'home' && screen !== 'harvests')) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void refreshSavedRecords();
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [signedIn, reference, busy, screen]);

  async function saveHarvest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    if (!configured) { setError(`${saveBlockedReason} Your entered details are still here.`); return; }
    const values = new FormData(form);
    const value = (key: string) => String(values.get(key) ?? '');
    if (!farmId && (!value('latitude') || !value('longitude'))) {
      setError('Please add your farm location: use your current location while at the farm, or enter it with help.');
      document.getElementById('capture-farm-location')?.focus();
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const location = farmId ? { farm_id: Number(farmId) } : { farm: { district: value('district'), village: value('village'),
          latitude: value('latitude'), longitude: value('longitude'), entered_area: value('area'), area_unit: value('areaUnit'),
          storage_capacity_qtl: value('storage'), vehicle_capacity_qtl: value('vehicle') } };
      const { farm, harvest } = await api.saveHarvestRecord({ ...location, crop, variety: value('variety'), grade: value('grade'),
        entered_value: quantity, entered_unit: unit, harvest_date: value('harvestDate'), latest_sale_date: value('saleDate'),
        cash_needed: Number(value('cash')) > 0 ? value('cash') : null,
        cash_needed_by: Number(value('cash')) > 0 ? value('cashDate') || null : null,
        confirm_high_quantity: confirmHigh });
      setFarms(previous => [...previous.filter(record => record.id !== farm.id), farm]);
      setFarmId(String(farm.id));
      setAddingFarm(false);
      setHarvests(previous => [...previous.filter(record => record.id !== harvest.id), harvest]);
      const refreshed = await refreshSavedRecords();
      setNotice(`Harvest #${harvest.id} saved.${harvest.warnings.length ? ' Warning: quantity is unusually high for the farm area.' : ''}${refreshed ? '' : ' Saved successfully, but the full records list could not be refreshed.'}`);
      setHighWarning(false); setConfirmHigh(false); setQuantity('');
      form.reset();
      window.location.hash = 'harvests';
    } catch (error) {
      setNotice('');
      setError(`Harvest not saved. ${errorMessage(error)} Your entries have been kept. Check the details and tap Save harvest again.`);
      if (error instanceof ApiError && error.code === 'HIGH_QUANTITY_CONFIRMATION_REQUIRED') setHighWarning(true);
    } finally { setBusy(false); }
  }

  async function deleteHarvest(id: number) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.deleteHarvest(id);
      ++recordsRequest.current;
      setHarvests(previous => previous.filter(harvest => harvest.id !== id));
      setDeleteHarvestId(null);
      const refreshed = await refreshSavedRecords();
      setNotice(`Harvest #${id} deleted.${refreshed ? '' : ' The remaining records could not be refreshed.'}`);
      mainRef.current?.focus();
    } catch (error) {
      setError(`Could not delete the harvest. ${errorMessage(error)}`);
      mainRef.current?.focus();
    } finally { setBusy(false); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError(''); setNotice('');
    try {
      const updated = await api.updateProfile(String(values.get('name') ?? ''), values.get('language') === 'kn' ? 'kn' : 'en');
      setProfile(updated); setLanguage(updated.language); setNotice('Profile saved.');
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try { await api.logout(); }
    catch { /* The local session is cleared even when the server is unavailable. */ }
    finally { setConfirmSignOut(false); harvestForm.current?.reset(); setQuantity(''); setConfirmHigh(false); setHighWarning(false); setBusy(false); window.location.hash = 'sign-in'; }
  }

  const cropOptions = reference?.crops[crop];
  const quantityFactor = unit === 'kg' ? 0.01 : unit === 'tonne' ? 10 : unit === 'bags' ? Number(cropOptions?.bag_weight_kg ?? 0) / 100 : 1;
  const conversion = Number(quantity) > 0 ? `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(Number(quantity) * quantityFactor)} quintals` : 'Enter quantity to see quintals.';
  const saveBlockedReason = !reference ? 'Farm and crop options have not loaded yet.'
    : !Object.keys(reference.crops).length ? 'Crop options need to be set up before you can save. Contact your farm coordinator.'
    : !farmId && !reference.pilot_districts.length && !reference.allow_manual_district ? 'Farm districts need to be set up before you can add a farm and save this harvest. Contact your farm coordinator.'
    : '';
  const configured = !saveBlockedReason;
  const dateLimits = reference?.date_limits;
  const displayDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
  const harvestDateHelp = dateLimits ? `Choose the date you harvested, from ${displayDate(dateLimits.harvest_min)} to ${displayDate(dateLimits.harvest_max)}.` : 'Choose the date you harvested, within the past year and no later than today.';

  return <>
    <div hidden={!publicView}><PublicHome /></div>
    {signedIn && <div className="dashboard-app" hidden={publicView} lang="en">
      <a className="skip-link" href="#main" onClick={event => { event.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
      <header className="app-header"><a className="brand" href="#home"><span className="brand-symbol"><DashboardIcon name="leaf" /></span>AgriValue<span className="brand-divider" /></a><span className="header-context">Your harvest planning</span><a className="header-account" href="#profile" aria-label="View your account" aria-current={screen === 'profile' ? 'page' : undefined}><span className="account-avatar">{profile?.name?.slice(0, 1).toUpperCase() || <DashboardIcon name="profile" />}</span><span className="account-name">{profile?.name || 'My account'}</span></a><button className="button" onClick={() => setConfirmSignOut(true)} disabled={busy} aria-expanded={confirmSignOut} aria-controls="signout-options"><DashboardIcon name="logout" /><span>Sign out</span></button></header>
      <div className="app-layout">
        <aside className="dashboard-sidebar"><p className="sidebar-label">WORKSPACE</p><nav className="navigation" aria-label="Main navigation">{(['home', 'harvests', 'markets', 'profile'] as const).map(destination => <a key={destination} href={`#${destination}`} aria-current={activeDestination === destination ? 'page' : undefined}><DashboardIcon name={destination} /><span>{destination[0].toUpperCase() + destination.slice(1)}</span>{destination === 'harvests' && harvests.length > 0 && <span className="nav-count">{harvests.length}</span>}</a>)}</nav><div className="sidebar-note"><DashboardIcon name="leaf" /><strong>Every harvest matters.</strong><p>Make room for a better plan.</p></div><a className="sidebar-profile" href="#profile"><span className="account-avatar"><DashboardIcon name="profile" /></span><span><strong>{profile?.name || 'Your account'}</strong><small>Profile & preferences</small></span></a></aside>
        <main ref={mainRef} id="main" tabIndex={-1}>
          {confirmSignOut && <section id="signout-options" className="card" aria-labelledby="signout-title"><h2 id="signout-title">Do you want to sign out?</h2><p>You can close this page and return without signing out if you chose to stay signed in. Signing out will require an OTP next time.</p><div className="session-actions"><button type="button" className="button primary" onClick={() => setConfirmSignOut(false)}>Keep using AgriValue</button><button type="button" className="button" onClick={logout} disabled={busy}>Sign out</button></div></section>}
          {loading && <p role="status">Loading your records...</p>}
          {error && (screen !== 'add-harvest' || recordsLoadFailed) && <div className="status" role="alert"><p>{error}</p>{recordsLoadFailed && <button type="button" className="button" onClick={() => setReload(value => value + 1)} disabled={busy || loading}>Retry loading records</button>}</div>}
          {notice && screen !== 'add-harvest' && <p className="status" role="status">{notice}</p>}
          <section className="screen" hidden={screen !== 'home'}><DashboardHome profile={profile} harvests={harvests} loading={loading} /></section>
          <section className="screen" hidden={screen !== 'harvests'}><header className="dashboard-page-heading"><div><p className="eyebrow">YOUR CROP RECORDS</p><h1>Harvest records</h1><p>Your saved crop, quantity and sale details.</p></div><a className="button primary" href="#add-harvest"><DashboardIcon name="plus" />Add harvest</a></header>
            {!loading && !harvests.length && <article className="dashboard-panel dashboard-empty"><span className="empty-crop"><DashboardIcon name="harvests" /></span><h2>No saved harvests yet</h2><p>Your crop records will appear here once you add a harvest.</p></article>}
            <div className="panel-grid harvest-record-grid">{[...harvests].sort((a, b) => b.id - a.id).map(harvest => <article className="card" key={harvest.id}><h2>{harvest.crop} / Harvest #{harvest.id}</h2><p>{harvest.variety} / {harvest.grade}</p><p>{harvest.quantity_qtl} quintals</p><p>Farm: {farms.find(farm => farm.id === harvest.farm_id)?.village ?? harvest.farm_id}</p><p>Harvested: {harvest.harvest_date}<br />Latest sale: {harvest.latest_sale_date}</p>
              {deleteHarvestId === harvest.id ? <div role="group" aria-label={`Delete ${harvest.crop} harvest #${harvest.id}?`}><p>Delete this harvest and any straw records linked to it? This cannot be undone.</p><div className="session-actions"><button type="button" className="button" disabled={busy} onClick={() => setDeleteHarvestId(null)}>Keep harvest</button><button type="button" className="button danger" disabled={busy} aria-busy={busy} onClick={() => void deleteHarvest(harvest.id)}>{busy ? 'Deleting...' : 'Yes, delete'}</button></div></div> : <button type="button" className="button danger" disabled={busy || loading} aria-label={`Delete ${harvest.crop} harvest #${harvest.id}`} onClick={() => setDeleteHarvestId(harvest.id)}>Delete harvest</button>}
            </article>)}</div>
          </section>
          <section className="screen harvest-entry" hidden={screen !== 'add-harvest'}>
            <a className="back-link" href="#harvests">Back to harvests</a>
            <header className="harvest-intro"><div><p className="eyebrow">FROM YOUR FIELD TO YOUR NEXT SALE</p><h1>Record a harvest</h1><p>Enter your details and tap Save harvest. Everything stays together in Harvest records.</p></div><span className="harvest-badge">New harvest</span></header>
            <ol className="harvest-guide" aria-label="Harvest entry sections"><li><span>01</span> Your farm</li><li><span>02</span> Your harvest</li><li><span>03</span> Sale preferences</li></ol>
            {!loading && reference && !configured && <p className="status" role="alert">{saveBlockedReason} Your entered details will stay here.</p>}
            <form className="harvest-form" ref={harvestForm} onSubmit={saveHarvest} onChange={event => { if (!(event.target instanceof HTMLInputElement && event.target.type === 'checkbox')) { setConfirmHigh(false); setHighWarning(false); } }}>
              <fieldset disabled={busy || loading} className="entry-fields">
              <div className="harvest-workspace"><div className="harvest-sections">
                <section className="card harvest-card" aria-labelledby="farm-section-title"><div className="harvest-card-heading"><span className="section-number">01</span><div><h2 id="farm-section-title">Where was it grown?</h2><p>Location details are included with this harvest.</p></div></div>
                  {farms.length > 1 && !addingFarm && <><label htmlFor="farm">Harvest location</label><select id="farm" value={farmId} onChange={event => chooseFarm(event.target.value)}>{farms.map(farm => <option key={farm.id} value={farm.id}>{farm.village}, {farm.district} / {farm.area_acres} acres</option>)}</select></>}
                  {selectedFarm && <><p><strong>{selectedFarm.village}, {selectedFarm.district}</strong><br />{selectedFarm.area_acres} acres</p><button type="button" className="button" onClick={() => chooseFarm('')}>Enter a different location</button></>}
                  {!farmId && farms.length > 0 && <button type="button" className="button" onClick={() => chooseFarm(String(farms[0].id))}>Use previous location</button>}
                  {!farmId && <>
                    <FarmLocation districts={reference?.pilot_districts ?? []} allowManualDistrict={reference?.allow_manual_district} />
                    <div className="field-row"><div><label htmlFor="area">Farm area</label><input id="area" name="area" type="number" min="0.000001" step="0.000001" required /></div><div><label htmlFor="area-unit">Area unit</label><select id="area-unit" name="areaUnit"><option value="acre">Acres</option><option value="hectare">Hectares</option><option value="gunta">Guntas</option></select></div></div>
                    <div className="field-row"><div><label htmlFor="storage">Storage capacity <span className="field-unit">(quintals)</span></label><input id="storage" name="storage" type="number" min="0" step="0.01" required /></div><div><label htmlFor="vehicle">Vehicle capacity <span className="field-unit">(quintals)</span></label><input id="vehicle" name="vehicle" type="number" min="0" step="0.01" required /></div></div>
                  </>}
                </section>
                <section className="card harvest-card" aria-labelledby="crop-section-title"><div className="harvest-card-heading"><span className="section-number">02</span><div><h2 id="crop-section-title">What did you harvest?</h2><p>Add your crop details and the quantity available to sell.</p></div></div>
                  <label htmlFor="crop">Crop</label><select id="crop" disabled={!Object.keys(reference?.crops ?? {}).length} value={crop} onChange={event => { setCrop(event.target.value); setUnit('qtl'); }} required><option value="">{Object.keys(reference?.crops ?? {}).length ? 'Choose your crop' : 'Crops not set up yet'}</option>{Object.keys(reference?.crops ?? {}).map(code => <option key={code} value={code}>{code}</option>)}</select>
                  <div key={crop}><label htmlFor="variety">Variety</label><select id="variety" name="variety" required disabled={!cropOptions?.varieties.length}><option value="">Choose variety</option>{cropOptions?.varieties.map(variety => <option key={variety}>{variety}</option>)}</select><label htmlFor="grade">Grade</label><select id="grade" name="grade" required disabled={!cropOptions?.grades.length}><option value="">Choose grade</option>{cropOptions?.grades.map(grade => <option key={grade}>{grade}</option>)}</select></div>
                  <p className="field-help">Choose your crop to see its variety and grade options. Use your buyer’s grade; choose “Ungraded / not sure” if you do not know it.</p>
                  <div className="field-row"><div><label htmlFor="quantity">Quantity</label><input id="quantity" placeholder="e.g. 25" type="number" min="0.000001" step="0.000001" value={quantity} onChange={event => setQuantity(event.target.value)} required aria-describedby="converted" /></div><div><label htmlFor="unit">Unit</label><select id="unit" value={unit} onChange={event => setUnit(event.target.value)}><option value="qtl">Quintals</option><option value="kg">Kilograms</option><option value="tonne">Tonnes</option>{Number(cropOptions?.bag_weight_kg) > 0 && <option value="bags">Bags</option>}</select></div></div>
                  <p id="converted" className="quantity-conversion" aria-live="polite">{conversion}</p>
                  <label htmlFor="harvest-date">When did you harvest?</label><input id="harvest-date" name="harvestDate" type="date" min={dateLimits?.harvest_min} max={dateLimits?.harvest_max} required aria-describedby="harvest-date-help" onInvalid={event => { if (event.currentTarget.validity.rangeUnderflow || event.currentTarget.validity.rangeOverflow) event.currentTarget.setCustomValidity(harvestDateHelp); }} onChange={event => event.currentTarget.setCustomValidity('')} /><p id="harvest-date-help" className="field-help">{harvestDateHelp}</p>
                </section>
                <section className="card harvest-card" aria-labelledby="sale-section-title"><div className="harvest-card-heading"><span className="section-number">03</span><div><h2 id="sale-section-title">Plan your sale</h2><p>Let us know your selling window and any cash requirements.</p></div></div>
                  <label htmlFor="sale-date">Latest sale date</label><input id="sale-date" name="saleDate" type="date" min={dateLimits?.sale_min} max={dateLimits?.sale_max} required />
                  {dateLimits && <p className="field-help">Choose your sale deadline between {displayDate(dateLimits.sale_min)} and {displayDate(dateLimits.sale_max)}.</p>}
                  <label htmlFor="cash">Cash needed (INR)</label><input id="cash" name="cash" type="number" min="0" step="0.01" onChange={event => { const deadline = event.currentTarget.form?.elements.namedItem('cashDate') as HTMLInputElement; deadline.required = Number(event.currentTarget.value) > 0; }} /><p className="field-help">Optional. Add both an amount and a deadline if you need cash by a particular date.</p>
                  <label htmlFor="cash-date">Cash deadline</label><input id="cash-date" name="cashDate" type="date" min={dateLimits?.sale_min} />
                </section>
              </div>
              <aside className="harvest-summary" aria-labelledby="summary-title">
                <div className="summary-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2"><path d="M24 40V14M24 22C12 23 9 15 10 8c10 0 14 5 14 14ZM24 30c12 1 15-7 14-14-10 0-14 5-14 14Z" /></svg></div>
                <p className="eyebrow">AT A GLANCE</p><h2 id="summary-title">Your harvest record</h2><p className="summary-description">Your details come together here as you fill in the form.</p>
                <dl><div><dt>Farm</dt><dd>{farms.find(farm => String(farm.id) === farmId)?.village || 'New farm'}</dd></div><div><dt>Crop</dt><dd>{crop || 'Choose a crop'}</dd></div><div><dt>Quantity</dt><dd aria-live="polite">{Number(quantity) > 0 ? conversion : 'Not entered yet'}</dd></div></dl>
                <div className="summary-tip"><strong>One record for your harvest</strong><p>Your location, crop, quantity and sale dates are saved together.</p></div>
                <p className="summary-footnote">Your saved harvest is available immediately in Harvest records.</p>
              </aside></div>
              {highWarning && <label className="confirmation"><input type="checkbox" checked={confirmHigh} onChange={event => setConfirmHigh(event.target.checked)} onClick={event => event.stopPropagation()} />I confirm this unusually high quantity is correct.</label>}
              {error && !recordsLoadFailed && <div id="harvest-save-status" className="status" role="alert" tabIndex={-1}><p>{error}</p></div>}
              <footer className="harvest-actions"><div><strong>{configured ? 'Ready to record your harvest?' : 'Setup required before saving'}</strong><p id="harvest-save-hint">{configured ? 'Check your details before saving.' : saveBlockedReason}</p></div><div className="session-actions"><a className="button harvest-cancel" href="#harvests" aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }}>Back</a><button className="button primary" type="submit" aria-describedby="harvest-save-hint" aria-busy={busy || loading} title={!configured ? saveBlockedReason : undefined} disabled={busy || loading || !configured || (highWarning && !confirmHigh)}>{busy ? 'Saving...' : loading ? 'Loading records...' : !configured ? 'Setup required' : 'Save harvest'}</button></div></footer>
              </fieldset>
            </form>
          </section>
          <section className="screen" hidden={screen !== 'markets'}><header className="dashboard-page-heading"><div><p className="eyebrow">BEYOND THE FARM</p><h1>Markets</h1><p>Your market planning workspace.</p></div></header><article className="dashboard-panel dashboard-empty"><span className="empty-crop"><DashboardIcon name="markets" /></span><h2>Market data is not available yet</h2><p>The current backend supports accounts, farms and harvest records. Market prices and recommendations will appear when those services are added.</p></article></section>
          <section className="screen" hidden={screen !== 'profile'}><header className="dashboard-page-heading"><div><p className="eyebrow">ACCOUNT & PREFERENCES</p><h1>Profile</h1><p>Make AgriValue feel a little more like you.</p></div></header>{profile && <div className="account-page-grid"><AccountOverview profile={profile} /><form key={`${profile.id}-${profile.name}-${profile.language}`} className="card dashboard-profile-form" onSubmit={saveProfile}><fieldset disabled={busy} className="entry-fields"><div className="profile-form-heading"><h2>Personal details</h2><p>Update your name and preferred language.</p></div><label htmlFor="profile-name">Name</label><input id="profile-name" name="name" maxLength={100} autoComplete="name" defaultValue={profile.name ?? ''} /><label htmlFor="profile-language">Preferred language</label><select id="profile-language" name="language" defaultValue={profile.language}><option value="en">English</option><option value="kn">Kannada</option></select><button className="button primary" type="submit">{busy ? 'Saving...' : 'Save profile'}</button></fieldset></form></div>}</section>
        </main>
      </div>
    </div>}
  </>;
}
