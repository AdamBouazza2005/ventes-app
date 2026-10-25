/* Ventes · BOUAZZA IMMO — application de suivi commercial (hors ligne, données sur l'appareil) */
'use strict';

/* ---------- constantes ---------- */
const KEY = 'bouazza-ventes-v1';
const NIVEAUX = [['RDC', 'Rez-de-chaussée'], ['1', '1er étage'], ['2', '2e étage'], ['3', '3e étage'], ['4', '4e étage']];
const NIVNOM = Object.fromEntries(NIVEAUX);
const PLANIMG = { RDC: 'rdc', '1': 'e23', '2': 'e23', '3': 'e23', '4': 'e4' };
const STATUTS = [['disponible', 'Disponible'], ['option', 'Option'], ['reserve', 'Réservé'], ['vendu', 'Vendu']];
const STNOM = Object.fromEntries(STATUTS);
const ETAPES = [['prospect', 'Prospect'], ['visite', 'Visite faite'], ['negociation', 'Négociation'], ['reserve', 'Réservataire'], ['acquereur', 'Acquéreur'], ['perdu', 'Perdu']];
const ETNOM = Object.fromEntries(ETAPES);
const SOURCES = ['Bouche-à-oreille', 'Panneau sur site', 'Facebook / Instagram', 'Avito', 'Agence', 'Bureau de vente', 'Autre'];
const MODES = ['Virement', 'Chèque', 'Espèces', 'Versement bancaire', 'Autre'];
const LOTMAP = Object.fromEntries(LOTS.map(l => [l.id, l]));

/* ---------- état ---------- */
function defaults() {
  return {
    v: 1,
    settings: {
      promoteur: 'BOUAZZA IMMO', projet: 'Résidence', ville: 'Al Hoceima',
      prixM2: { RDC: 0, '1': 0, '2': 0, '3': 0, '4': 0 }, prixTerrasseM2: 0,
      echeancier: [{ l: 'À la réservation', p: 30 }, { l: 'Achèvement du gros œuvre', p: 40 }, { l: 'Remise des clés et acte', p: 30 }],
      derniereSauvegarde: null
    },
    lots: Object.fromEntries(LOTS.map(l => [l.id, { statut: 'disponible', clientId: null, prix: null, prixVente: null, dateRes: '', dateVente: '', notes: '', echeances: [], hist: [] }])),
    clients: {}, paiements: {}
  };
}
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); const d = defaults(); s.settings = Object.assign(d.settings, s.settings); for (const id in d.lots) if (!s.lots[id]) s.lots[id] = d.lots[id]; return s; }
  } catch (e) { console.warn(e); }
  return defaults();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Enregistrement impossible : mémoire de l’appareil pleine ou bloquée'); }
}

/* ---------- utilitaires ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 12);
const NF = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const dh = n => (n || n === 0) && !isNaN(n) ? NF.format(Math.round(n)) + ' DH' : '—';
const today = () => new Date().toISOString().slice(0, 10);
const fdate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const parseMoney = v => { const n = parseFloat(String(v || '').replace(/\s| |DH/gi, '').replace(',', '.')); return isNaN(n) ? null : n; };
const pill = (st, solid) => `<span class="pill ${solid ? 'solid ' : ''}st-${st}">${STNOM[st]}</span>`;
const lotLabel = id => 'Lot ' + id;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400); }
function addDays(d, n) { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }

/* ---------- calculs ---------- */
function prixCatalogue(id) {
  const l = LOTMAP[id], st = S.lots[id];
  if (st.prix) return st.prix;
  const p = (S.settings.prixM2[l.niv] || 0) * l.s + (S.settings.prixTerrasseM2 || 0) * (l.ter || 0);
  return p || null;
}
const prixVente = id => S.lots[id].prixVente || prixCatalogue(id);
const paiementsLot = id => Object.values(S.paiements).filter(p => p.lotId === id && !p.desiste).sort((a, b) => a.date.localeCompare(b.date));
const encaisseLot = id => paiementsLot(id).reduce((s, p) => s + (p.montant || 0), 0);
function echeancesEtat(id) {
  let reste = encaisseLot(id);
  return [...S.lots[id].echeances].sort((a, b) => (a.date || '9').localeCompare(b.date || '9')).map(e => {
    const couvert = Math.min(reste, e.montant || 0); reste -= couvert;
    const payee = couvert >= (e.montant || 0) - 0.5;
    return Object.assign({}, e, { couvert, payee, retard: !payee && e.date && e.date < today() });
  });
}
const engage = id => ['reserve', 'vendu'].includes(S.lots[id].statut);
function totaux() {
  const c = { disponible: 0, option: 0, reserve: 0, vendu: 0 }; let ca = 0, enc = 0;
  for (const l of LOTS) { const st = S.lots[l.id].statut; c[st]++; if (engage(l.id)) { ca += prixVente(l.id) || 0; enc += encaisseLot(l.id); } }
  return { c, ca, enc, reste: Math.max(0, ca - enc) };
}
const clientNom = id => id && S.clients[id] ? S.clients[id].nom : '';
const lotsDuClient = cid => LOTS.filter(l => S.lots[l.id].clientId === cid);
function histo(id, txt) { S.lots[id].hist.unshift({ d: new Date().toISOString(), txt }); S.lots[id].hist = S.lots[id].hist.slice(0, 40); }

/* ---------- feuille (formulaire modal) ---------- */
const sheet = $('#sheet'), sheetform = $('#sheetform');
let sheetHandler = null;
function openSheet(html, onOk) {
  sheetform.innerHTML = html; sheetHandler = onOk; sheet.showModal();
  const f = sheetform.querySelector('input:not([type=hidden]),select,textarea'); if (f && matchMedia('(pointer:fine)').matches) f.focus();
}
sheetform.addEventListener('submit', e => {
  const v = e.submitter && e.submitter.value;
  if (v === 'ok' && sheetHandler) {
    const fd = Object.fromEntries(new FormData(sheetform));
    if (sheetHandler(fd, e.submitter) === false) { e.preventDefault(); return; }
  }
  sheetHandler = null;
});
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });
const btnsOkCancel = (ok = 'Enregistrer', danger) => `<div class="sheetbtns"><button class="btn ghost" value="cancel" formnovalidate>Annuler</button><button class="btn ${danger ? 'danger' : ''}" value="ok">${ok}</button></div>`;
const opts = (list, sel) => list.map(([v, t]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`).join('');

/* ---------- routeur ---------- */
const ui = { lotsVue: 'liste', lotsNiv: '', lotsSt: '', planNiv: 'RDC', cliQ: '', cliEt: '' };
try { Object.assign(ui, JSON.parse(localStorage.getItem(KEY + '-ui') || '{}')); } catch (e) { }
const saveUi = () => { try { localStorage.setItem(KEY + '-ui', JSON.stringify(ui)); } catch (e) { } };

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [p, a] = h.split('/');
  const top = $('#topact'); top.hidden = true; top.onclick = null;
  $('#back').hidden = !['lot', 'client'].includes(p);
  document.querySelectorAll('.tabs a').forEach(t => t.classList.toggle('on', t.dataset.tab === ({ lot: 'lots', client: 'clients' }[p] || p || 'home')));
  $('#brand').textContent = S.settings.promoteur || 'Ventes';
  const v = $('#view');
  if (p === 'lots') viewLots(v);
  else if (p === 'lot' && LOTMAP[decodeURIComponent(a)]) viewLot(v, decodeURIComponent(a));
  else if (p === 'clients') viewClients(v);
  else if (p === 'client' && S.clients[a]) viewClient(v, a);
  else if (p === 'paiements') viewPaiements(v);
  else if (p === 'reglages') viewReglages(v);
  else viewHome(v);
  v.focus({ preventScroll: true });
}
function setTitle(t) { $('#title').textContent = t; document.title = t + ' · ' + (S.settings.promoteur || 'Ventes'); }
function topAction(label, fn) { const t = $('#topact'); t.textContent = label; t.hidden = false; t.onclick = fn; }
window.addEventListener('hashchange', () => { route(); $('#view').scrollTop = 0; });
$('#back').onclick = () => { const p = location.hash.split('/')[1]; location.hash = p === 'client' ? '#/clients' : '#/lots'; };
function rerender() { const top = $('#view').scrollTop; route(); $('#view').scrollTop = top; }

/* ---------- accueil ---------- */
function viewHome(v) {
  setTitle('Tableau de bord');
  const t = totaux(), n = LOTS.length;
  const noPrice = LOTS.some(l => !prixCatalogue(l.id));
  const ech = [];
  for (const l of LOTS) if (engage(l.id)) for (const e of echeancesEtat(l.id)) if (!e.payee && e.date && e.date <= addDays(today(), 45)) ech.push(Object.assign(e, { lot: l.id }));
  ech.sort((a, b) => a.date.localeCompare(b.date));
  const rel = Object.values(S.clients).filter(c => c.relance && c.relance <= addDays(today(), 7) && !['acquereur', 'perdu'].includes(c.etape)).sort((a, b) => a.relance.localeCompare(b.relance));
  const options = LOTS.filter(l => S.lots[l.id].statut === 'option');
  const pct = x => (x / n * 100).toFixed(2) + '%';
  v.innerHTML = `<div class="wrap">
  ${noPrice ? `<div class="callout">Les prix au m² ne sont pas encore saisis. <a href="#/reglages">Définir les prix</a> pour calculer le chiffre d’affaires.</div>` : ''}
  <div class="kpis">
    <div class="kpi"><span>Disponibles</span><b class="num">${t.c.disponible}</b><small>sur ${n} lots</small></div>
    <div class="kpi"><span>Options · Réservés</span><b class="num">${t.c.option + t.c.reserve}</b><small>${t.c.option} option${t.c.option > 1 ? 's' : ''}, ${t.c.reserve} réservé${t.c.reserve > 1 ? 's' : ''}</small></div>
    <div class="kpi"><span>Vendus</span><b class="num">${t.c.vendu}</b><small>${Math.round(t.c.vendu / n * 100)} % du programme</small></div>
    <div class="kpi"><span>Encaissé</span><b class="num" style="font-size:26px">${dh(t.enc)}</b><small>reste ${dh(t.reste)}</small></div>
  </div>
  <section class="card sec">
    <div class="sech"><h2>Avancement</h2><span class="muted small num">CA engagé ${dh(t.ca)}</span></div>
    <div class="stack" role="img" aria-label="Répartition des lots par statut">${STATUTS.map(([s]) => `<i class="st-${s}" style="width:${pct(t.c[s])};background:currentColor"></i>`).join('')}</div>
    <div class="legend">${STATUTS.map(([s, nm]) => `<span class="st-${s}"><span style="color:var(--text)">${nm} ${t.c[s]}</span></span>`).join('')}</div>
    <div class="levels">${NIVEAUX.map(([k, nm]) => { const ls = LOTS.filter(l => l.niv === k); const done = ls.filter(l => engage(l.id)).length; return `<div class="lvl"><span>${nm}</span><div class="stack">${STATUTS.map(([s]) => `<i class="st-${s}" style="width:${(ls.filter(l => S.lots[l.id].statut === s).length / ls.length * 100).toFixed(2)}%;background:currentColor"></i>`).join('')}</div><span class="num muted small" style="text-align:right">${done}/${ls.length}</span></div>`; }).join('')}</div>
  </section>
  <section class="card sec">
    <div class="sech"><h2>Échéances</h2><span class="muted small">45 prochains jours et retards</span></div>
    ${ech.length ? `<div class="list">${ech.slice(0, 12).map(e => `<a class="li" href="#/lot/${e.lot}"><div class="grow"><div class="t">${lotLabel(e.lot)} · ${esc(clientNom(S.lots[e.lot].clientId) || 'sans client')}</div><div class="small ${e.retard ? 'late' : 'muted'}">${e.retard ? 'En retard depuis le ' : ''}${fdate(e.date)} · ${esc(e.libelle || '')}</div></div><span class="num">${dh((e.montant || 0) - e.couvert)}</span><span class="chev">›</span></a>`).join('')}</div>` : `<div class="empty">Aucune échéance à venir. Les échéanciers se créent depuis la fiche d’un lot réservé ou vendu.</div>`}
  </section>
  <section class="card sec">
    <div class="sech"><h2>Relances</h2><a class="small" href="#/clients">Tous les clients</a></div>
    ${rel.length ? `<div class="list">${rel.map(c => `<a class="li" href="#/client/${c.id}"><div class="grow"><div class="t">${esc(c.nom)}</div><div class="small ${c.relance < today() ? 'late' : 'muted'}">${c.relance < today() ? 'Relance en retard · ' : 'Relance · '}${fdate(c.relance)} · ${ETNOM[c.etape]}</div></div><span class="chev">›</span></a>`).join('')}</div>` : `<div class="empty">Aucune relance prévue cette semaine.</div>`}
  </section>
  ${options.length ? `<section class="card sec"><div class="sech"><h2>Lots en option</h2></div><div class="list">${options.map(l => `<a class="li" href="#/lot/${l.id}"><div class="grow"><div class="t">${lotLabel(l.id)}</div><div class="small muted">${esc(clientNom(S.lots[l.id].clientId) || 'sans client')} · depuis le ${fdate((S.lots[l.id].hist.find(h => /Option/.test(h.txt)) || {}).d?.slice(0, 10))}</div></div><span class="chev">›</span></a>`).join('')}</div></section>` : ''}
  </div>`;
}

/* ---------- lots ---------- */
function lotCard(l) {
  const st = S.lots[l.id];
  return `<a class="lotrow" href="#/lot/${l.id}" style="--c:var(--${{ disponible: 'dispo', option: 'option', reserve: 'reserve', vendu: 'vendu' }[st.statut]})">
    <div class="row"><b class="grow">${l.id}</b></div><div>${pill(st.statut)}</div>
    <div class="meta num">${l.s} m²${l.ter ? ' + ' + l.ter + ' m² terrasse' : ''} · ${dh(prixVente(l.id))}</div>
    ${st.clientId ? `<div class="who">${esc(clientNom(st.clientId))}</div>` : ''}</a>`;
}
function viewLots(v) {
  setTitle('Lots');
  const f = LOTS.filter(l => (!ui.lotsNiv || l.niv === ui.lotsNiv) && (!ui.lotsSt || S.lots[l.id].statut === ui.lotsSt));
  let body;
  if (ui.lotsVue === 'plan') {
    const k = ui.planNiv, img = PLANIMG[k];
    const pref = k === 'RDC' ? 'R' : k === '4' ? 'T' : 'E';
    const spots = LOTS.filter(l => l.niv === k).map(l => (HOT[l.type] || []).map((b, i) => `<a class="hot" href="#/lot/${l.id}" aria-label="${lotLabel(l.id)}, ${STNOM[S.lots[l.id].statut]}" style="left:${b[0]}%;top:${b[1]}%;width:${b[2]}%;height:${b[3]}%;--c:var(--${{ disponible: 'dispo', option: 'option', reserve: 'reserve', vendu: 'vendu' }[S.lots[l.id].statut]})">${i === 0 ? `<span>${l.id}</span>` : ''}</a>`).join('')).join('');
    body = `<div class="toolbar"><div class="seg" role="group" aria-label="Niveau">${NIVEAUX.map(([n, nm]) => `<button type="button" data-plan="${n}" aria-pressed="${n === k}">${n === 'RDC' ? 'RDC' : n + (n === '1' ? 'er' : 'e')}</button>`).join('')}</div></div>
      <div class="scrollx"><div class="planbox"><img src="img/floor_${img}.jpg" alt="Plan du ${esc(NIVNOM[k].toLowerCase())}" width="1800" height="${img === 'rdc' ? 956 : 990}">${spots}</div></div>
      <div class="legend">${STATUTS.map(([s, nm]) => `<span class="st-${s}"><span style="color:var(--text)">${nm}</span></span>`).join('')}</div>
      <p class="small muted" style="margin:0">Touchez un appartement pour ouvrir sa fiche.</p>`;
  } else {
    body = `<div class="toolbar">
      <select class="f" id="fniv" aria-label="Niveau"><option value="">Tous les niveaux</option>${opts(NIVEAUX, ui.lotsNiv)}</select>
      <select class="f" id="fst" aria-label="Statut"><option value="">Tous les statuts</option>${opts(STATUTS, ui.lotsSt)}</select></div>
      ${NIVEAUX.map(([k, nm]) => { const ls = f.filter(l => l.niv === k); return ls.length ? `<section class="niv"><h3>${nm}</h3><div class="lotgrid">${ls.map(lotCard).join('')}</div></section>` : ''; }).join('') || '<div class="empty">Aucun lot ne correspond à ces filtres.</div>'}`;
  }
  v.innerHTML = `<div class="wrap"><div class="toolbar"><div class="seg" role="group" aria-label="Affichage"><button type="button" data-vue="liste" aria-pressed="${ui.lotsVue !== 'plan'}">Liste</button><button type="button" data-vue="plan" aria-pressed="${ui.lotsVue === 'plan'}">Plan</button></div><span class="muted small">${f.length} lot${f.length > 1 ? 's' : ''}</span></div>${body}</div>`;
  v.querySelectorAll('[data-vue]').forEach(b => b.onclick = () => { ui.lotsVue = b.dataset.vue; saveUi(); rerender(); });
  v.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => { ui.planNiv = b.dataset.plan; saveUi(); rerender(); });
  const fn = $('#fniv'), fs = $('#fst');
  if (fn) fn.onchange = () => { ui.lotsNiv = fn.value; saveUi(); rerender(); };
  if (fs) fs.onchange = () => { ui.lotsSt = fs.value; saveUi(); rerender(); };
}

function viewLot(v, id) {
  const l = LOTMAP[id], st = S.lots[id];
  setTitle(lotLabel(id));
  const enc = encaisseLot(id), pv = prixVente(id), ech = echeancesEtat(id), pays = paiementsLot(id);
  const c = st.clientId && S.clients[st.clientId];
  v.innerHTML = `<div class="wrap">
  <section class="card sec">
    <div class="row"><span class="eyebrow grow">${esc(NIVNOM[l.niv])} · type ${l.type.slice(1)}</span>${pill(st.statut, true)}</div>
    <dl class="facts" style="margin:0">
      <div><dt>Surface</dt><dd class="num">${l.s} m²</dd></div>
      <div><dt>Terrasse</dt><dd class="num">${l.ter ? l.ter + ' m²' : '—'}</dd></div>
      <div><dt>Pièces</dt><dd>F3 · 2 chambres · ${l.sdb} salle${l.sdb > 1 ? 's' : ''} d’eau</dd></div>
      <div><dt>Extérieur</dt><dd>${esc(l.ext)}</dd></div>
      <div><dt>Exposition</dt><dd>${esc(l.expo)}</dd></div>
      <div><dt>Prix catalogue</dt><dd class="num">${dh(prixCatalogue(id))}</dd></div>
    </dl>
  </section>
  <section class="sec">
    <div class="sech"><h2>Statut</h2></div>
    <div class="status-seg" role="group" aria-label="Statut du lot">${STATUTS.map(([s, nm]) => `<button type="button" class="st-${s}" data-st="${s}" aria-pressed="${st.statut === s}">${nm}</button>`).join('')}</div>
  </section>
  <section class="card sec">
    <div class="sech"><h2>Client</h2>${st.statut !== 'disponible' ? `<button class="btn small ghost" type="button" id="chgcli">${c ? 'Changer' : 'Choisir'}</button>` : ''}</div>
    ${c ? `<a class="li" href="#/client/${c.id}"><div class="grow"><div class="t">${esc(c.nom)}</div><div class="small muted">${esc(c.tel || '')} · ${ETNOM[c.etape]}</div></div><span class="chev">›</span></a>` : `<div class="muted small">${st.statut === 'disponible' ? 'Passez le lot en option, réservé ou vendu pour lui associer un client.' : 'Aucun client associé.'}</div>`}
  </section>
  ${st.statut !== 'disponible' ? `<section class="card sec">
    <div class="sech"><h2>Vente</h2><button class="btn small ghost" type="button" id="editvente">Modifier</button></div>
    <div class="kv"><span>Prix de vente</span><b class="num">${dh(pv)}</b></div>
    <div class="kv"><span>Date de réservation</span><b>${fdate(st.dateRes)}</b></div>
    <div class="kv"><span>Date de vente (acte)</span><b>${fdate(st.dateVente)}</b></div>
    <div class="kv"><span>Encaissé</span><b class="num ok">${dh(enc)}</b></div>
    <div class="kv"><span>Reste à encaisser</span><b class="num">${pv ? dh(Math.max(0, pv - enc)) : '—'}</b></div>
    ${pv ? `<div class="bar" aria-label="Part encaissée"><i style="width:${Math.min(100, enc / pv * 100).toFixed(1)}%"></i></div>` : ''}
  </section>
  <section class="card sec">
    <div class="sech"><h2>Échéancier</h2><button class="btn small ghost" type="button" id="addech">Ajouter</button></div>
    ${ech.length ? `<div class="tl">${ech.map(e => `<div class="tli"><div><div class="t">${esc(e.libelle || 'Échéance')}</div><div class="small ${e.payee ? 'ok' : e.retard ? 'late' : 'muted'}">${fdate(e.date)} · ${e.payee ? 'réglée' : e.retard ? 'en retard' : e.couvert ? 'partiellement réglée' : 'à venir'}</div></div><span class="num">${dh(e.montant)}</span><button class="x" type="button" data-delech="${e.id}" aria-label="Supprimer l’échéance">×</button></div>`).join('')}</div>`
      : `<div class="empty">Pas encore d’échéancier.${pv ? ` <button class="btn small" type="button" id="echtype">Créer l’échéancier type</button>` : ' Saisissez d’abord un prix.'}</div>`}
  </section>
  <section class="card sec">
    <div class="sech"><h2>Encaissements</h2><button class="btn small" type="button" id="addpay">Encaisser</button></div>
    ${pays.length ? `<div class="tl">${pays.map(p => `<div class="tli"><div><div class="t num">${dh(p.montant)}</div><div class="small muted">${fdate(p.date)} · ${esc(p.mode)}${p.ref ? ' · ' + esc(p.ref) : ''}</div></div><span></span><button class="x" type="button" data-delpay="${p.id}" aria-label="Supprimer l’encaissement">×</button></div>`).join('')}</div>` : '<div class="muted small">Aucun encaissement.</div>'}
  </section>` : ''}
  <section class="card sec">
    <div class="sech"><h2>Notes</h2></div>
    <textarea class="f" id="notes" placeholder="Remarques, demandes du client, conditions particulières…">${esc(st.notes)}</textarea>
  </section>
  ${st.hist.length ? `<section class="sec"><div class="sech"><h2>Historique</h2></div><div class="list small">${st.hist.slice(0, 12).map(h => `<div class="li"><span class="muted num" style="min-width:92px">${fdate(h.d.slice(0, 10))}</span><span class="grow">${esc(h.txt)}</span></div>`).join('')}</div></section>` : ''}
  </div>`;

  v.querySelectorAll('[data-st]').forEach(b => b.onclick = () => changeStatut(id, b.dataset.st));
  const n = $('#notes'); n.onchange = () => { st.notes = n.value; save(); toast('Note enregistrée'); };
  const q = s => v.querySelector(s);
  if (q('#chgcli')) q('#chgcli').onclick = () => pickClient(id, st.statut);
  if (q('#editvente')) q('#editvente').onclick = () => editVente(id);
  if (q('#addech')) q('#addech').onclick = () => addEcheance(id);
  if (q('#echtype')) q('#echtype').onclick = () => echeancierType(id);
  if (q('#addpay')) q('#addpay').onclick = () => addPaiement(id);
  v.querySelectorAll('[data-delech]').forEach(b => b.onclick = () => confirmSheet('Supprimer cette échéance ?', 'L’échéance sera retirée de l’échéancier. Les encaissements ne changent pas.', () => { st.echeances = st.echeances.filter(e => e.id !== b.dataset.delech); save(); rerender(); }));
  v.querySelectorAll('[data-delpay]').forEach(b => b.onclick = () => { const p = S.paiements[b.dataset.delpay]; confirmSheet('Supprimer cet encaissement ?', `${dh(p.montant)} du ${fdate(p.date)} sera retiré du journal.`, () => { delete S.paiements[p.id]; histo(id, `Encaissement supprimé (${dh(p.montant)})`); save(); rerender(); }); });
}

function changeStatut(id, ns) {
  const st = S.lots[id];
  if (st.statut === ns) return;
  if (ns === 'disponible') {
    const enc = encaisseLot(id);
    return confirmSheet('Remettre le lot en vente ?', `Le client, le prix négocié et l’échéancier seront détachés du lot.${enc ? ` Les ${dh(enc)} déjà encaissés restent dans le journal, marqués « désistement ».` : ''}`, () => {
      paiementsLot(id).forEach(p => p.desiste = true);
      histo(id, `Remis en vente (était ${STNOM[st.statut]}${st.clientId ? ', ' + clientNom(st.clientId) : ''})`);
      Object.assign(st, { statut: 'disponible', clientId: null, prixVente: null, dateRes: '', dateVente: '', echeances: [] });
      save(); rerender(); toast('Lot remis en vente');
    }, 'Remettre en vente');
  }
  if (!st.clientId) return pickClient(id, ns);
  applyStatut(id, ns);
}
function applyStatut(id, ns) {
  const st = S.lots[id];
  histo(id, `${STNOM[st.statut]} → ${STNOM[ns]}${st.clientId ? ' · ' + clientNom(st.clientId) : ''}`);
  st.statut = ns;
  if (ns === 'reserve' && !st.dateRes) st.dateRes = today();
  if (ns === 'vendu' && !st.dateVente) st.dateVente = today();
  const c = S.clients[st.clientId];
  if (c) { if (ns === 'reserve' && c.etape !== 'acquereur') c.etape = 'reserve'; if (ns === 'vendu') c.etape = 'acquereur'; if (ns === 'option' && ['prospect', 'visite'].includes(c.etape)) c.etape = 'negociation'; }
  save(); rerender(); toast(lotLabel(id) + ' : ' + STNOM[ns].toLowerCase());
}
function pickClient(id, ns) {
  const list = Object.values(S.clients).filter(c => c.etape !== 'perdu').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  openSheet(`<h2>${STNOM[ns]} · ${lotLabel(id)}</h2>
    <label class="fl">Client existant<select class="f" name="cid"><option value="">— Nouveau client —</option>${list.map(c => `<option value="${c.id}" ${c.id === S.lots[id].clientId ? 'selected' : ''}>${esc(c.nom)}${c.tel ? ' · ' + esc(c.tel) : ''}</option>`).join('')}</select></label>
    <p class="small muted" style="margin:0">Ou créez-le ici :</p>
    <label class="fl">Nom et prénom<input class="f" name="nom" autocomplete="off"></label>
    <label class="fl">Téléphone<input class="f" name="tel" type="tel" inputmode="tel" autocomplete="off"></label>
    ${btnsOkCancel('Valider')}`, fd => {
    let cid = fd.cid;
    if (!cid) {
      if (!fd.nom.trim()) { toast('Choisissez un client ou saisissez un nom'); return false; }
      cid = uid(); S.clients[cid] = newClient({ id: cid, nom: fd.nom.trim(), tel: fd.tel.trim(), source: 'Bureau de vente' });
    }
    S.lots[id].clientId = cid;
    const c = S.clients[cid]; if (!c.lots.includes(id)) c.lots.push(id);
    applyStatut(id, ns);
  });
}
function editVente(id) {
  const st = S.lots[id];
  openSheet(`<h2>Vente · ${lotLabel(id)}</h2>
    <label class="fl">Prix de vente (DH)<input class="f" name="pv" inputmode="decimal" value="${st.prixVente ? NF.format(st.prixVente) : ''}" placeholder="${prixCatalogue(id) ? 'Catalogue : ' + NF.format(prixCatalogue(id)) : 'Montant'}"></label>
    <div class="two"><label class="fl">Réservation<input class="f" type="date" name="dr" value="${st.dateRes}"></label><label class="fl">Acte de vente<input class="f" type="date" name="dv" value="${st.dateVente}"></label></div>
    <label class="fl">Prix catalogue propre à ce lot (DH)<input class="f" name="pc" inputmode="decimal" value="${st.prix ? NF.format(st.prix) : ''}" placeholder="Calculé depuis le prix au m²"></label>
    ${btnsOkCancel()}`, fd => {
    const pv = parseMoney(fd.pv);
    if (pv !== st.prixVente) histo(id, `Prix de vente : ${dh(pv)}`);
    st.prixVente = pv; st.dateRes = fd.dr; st.dateVente = fd.dv; st.prix = parseMoney(fd.pc);
    save(); rerender(); toast('Vente enregistrée');
  });
}
function addEcheance(id) {
  openSheet(`<h2>Nouvelle échéance</h2>
    <label class="fl">Libellé<input class="f" name="l" placeholder="Ex. Achèvement du gros œuvre"></label>
    <div class="two"><label class="fl">Date<input class="f" type="date" name="d" required value="${today()}"></label><label class="fl">Montant (DH)<input class="f" name="m" inputmode="decimal" required></label></div>
    ${btnsOkCancel('Ajouter')}`, fd => {
    const m = parseMoney(fd.m); if (!m) { toast('Indiquez un montant'); return false; }
    S.lots[id].echeances.push({ id: uid(), libelle: fd.l.trim(), date: fd.d, montant: m }); save(); rerender();
  });
}
function echeancierType(id) {
  const pv = prixVente(id), st = S.lots[id], base = st.dateRes || today();
  const rows = S.settings.echeancier;
  openSheet(`<h2>Échéancier type</h2>
    <p class="small muted" style="margin:0">Sur un prix de ${dh(pv)}. Ajustez les dates, les montants restent modifiables ensuite.</p>
    ${rows.map((r, i) => `<div class="two"><label class="fl">${esc(r.l)} · ${r.p} %<input class="f" type="date" name="d${i}" value="${i === 0 ? base : ''}"></label><label class="fl">Montant<input class="f" name="m${i}" inputmode="decimal" value="${NF.format(Math.round(pv * r.p / 100))}"></label></div>`).join('')}
    ${btnsOkCancel('Créer')}`, fd => {
    st.echeances = rows.map((r, i) => ({ id: uid(), libelle: r.l, date: fd['d' + i] || '', montant: parseMoney(fd['m' + i]) || 0 }));
    histo(id, 'Échéancier créé'); save(); rerender();
  });
}
function addPaiement(lotId) {
  const engages = LOTS.filter(l => S.lots[l.id].statut !== 'disponible');
  if (!engages.length) return toast('Aucun lot réservé ou vendu pour l’instant');
  openSheet(`<h2>Encaissement</h2>
    <label class="fl">Lot<select class="f" name="lot" required>${engages.map(l => `<option value="${l.id}" ${l.id === lotId ? 'selected' : ''}>${lotLabel(l.id)} · ${esc(clientNom(S.lots[l.id].clientId) || 'sans client')}</option>`).join('')}</select></label>
    <div class="two"><label class="fl">Montant (DH)<input class="f" name="m" inputmode="decimal" required></label><label class="fl">Date<input class="f" type="date" name="d" value="${today()}" required></label></div>
    <div class="two"><label class="fl">Mode<select class="f" name="mode">${MODES.map(m => `<option>${m}</option>`).join('')}</select></label><label class="fl">Référence<input class="f" name="ref" placeholder="N° chèque, virement…"></label></div>
    ${btnsOkCancel('Encaisser')}`, fd => {
    const m = parseMoney(fd.m); if (!m) { toast('Indiquez un montant'); return false; }
    const id = uid(); S.paiements[id] = { id, lotId: fd.lot, clientId: S.lots[fd.lot].clientId, date: fd.d, montant: m, mode: fd.mode, ref: fd.ref.trim() };
    histo(fd.lot, `Encaissement ${dh(m)} (${fd.mode})`); save(); rerender(); toast('Encaissement enregistré');
  });
}
function confirmSheet(title, text, ok, okLabel = 'Supprimer') {
  openSheet(`<h2>${esc(title)}</h2><p style="margin:0">${esc(text)}</p>${btnsOkCancel(okLabel, true)}`, () => { ok(); });
}

/* ---------- clients ---------- */
function newClient(o) { return Object.assign({ id: uid(), nom: '', tel: '', email: '', ville: '', source: '', etape: 'prospect', budget: null, lots: [], relance: '', notes: '', cree: today() }, o); }
function viewClients(v) {
  setTitle('Clients');
  topAction('+ Client', () => editClient());
  const q = ui.cliQ.trim().toLowerCase();
  const list = Object.values(S.clients).filter(c => (!ui.cliEt || c.etape === ui.cliEt) && (!q || (c.nom + ' ' + c.tel + ' ' + c.email).toLowerCase().includes(q))).sort((a, b) => (a.relance || '9').localeCompare(b.relance || '9') || a.nom.localeCompare(b.nom, 'fr'));
  const counts = Object.fromEntries(ETAPES.map(([e]) => [e, Object.values(S.clients).filter(c => c.etape === e).length]));
  v.innerHTML = `<div class="wrap">
    <div class="toolbar"><input class="f grow" type="search" id="cq" placeholder="Rechercher un nom, un téléphone…" value="${esc(ui.cliQ)}" aria-label="Rechercher">
    <select class="f" id="cet" aria-label="Étape"><option value="">Toutes les étapes</option>${ETAPES.map(([e, n]) => `<option value="${e}" ${e === ui.cliEt ? 'selected' : ''}>${n} (${counts[e]})</option>`).join('')}</select></div>
    ${list.length ? `<div class="card list" style="padding:4px 14px">${list.map(c => { const ls = lotsDuClient(c.id).map(l => l.id).join(', '); return `<a class="li" href="#/client/${c.id}"><div class="grow"><div class="t">${esc(c.nom)}</div><div class="small muted">${ETNOM[c.etape]}${ls ? ' · ' + ls : c.lots.length ? ' · intéressé : ' + c.lots.join(', ') : ''}${c.relance ? ` · <span class="${c.relance < today() ? 'late' : ''}">relance ${fdate(c.relance)}</span>` : ''}</div></div><span class="chev">›</span></a>`; }).join('')}</div>`
      : `<div class="empty">${Object.keys(S.clients).length ? 'Aucun client ne correspond.' : 'Aucun client pour l’instant. Ajoutez vos prospects avec « + Client » : nom, téléphone, lots qui les intéressent et date de relance.'}</div>`}
  </div>`;
  const cq = $('#cq'); cq.oninput = () => { ui.cliQ = cq.value; saveUi(); const pos = cq.selectionStart; rerender(); const n = $('#cq'); n.focus(); n.setSelectionRange(pos, pos); };
  $('#cet').onchange = e => { ui.cliEt = e.target.value; saveUi(); rerender(); };
}
function editClient(id) {
  const c = id ? S.clients[id] : newClient({});
  openSheet(`<h2>${id ? 'Modifier le client' : 'Nouveau client'}</h2>
    <label class="fl">Nom et prénom<input class="f" name="nom" required value="${esc(c.nom)}" autocomplete="off"></label>
    <div class="two"><label class="fl">Téléphone<input class="f" name="tel" type="tel" inputmode="tel" value="${esc(c.tel)}" autocomplete="off"></label><label class="fl">E-mail<input class="f" name="email" type="email" value="${esc(c.email)}" autocomplete="off"></label></div>
    <div class="two"><label class="fl">Ville<input class="f" name="ville" value="${esc(c.ville)}"></label><label class="fl">Budget (DH)<input class="f" name="budget" inputmode="decimal" value="${c.budget ? NF.format(c.budget) : ''}"></label></div>
    <div class="two"><label class="fl">Source<select class="f" name="source"><option value=""></option>${SOURCES.map(s => `<option ${s === c.source ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="fl">Étape<select class="f" name="etape">${opts(ETAPES, c.etape)}</select></label></div>
    <label class="fl">Lots qui l’intéressent<input class="f" name="lots" value="${esc(c.lots.join(', '))}" placeholder="Ex. 2-A, 3-A, 4-C"></label>
    <label class="fl">Prochaine relance<input class="f" type="date" name="relance" value="${esc(c.relance)}"></label>
    <label class="fl">Notes<textarea class="f" name="notes">${esc(c.notes)}</textarea></label>
    ${btnsOkCancel()}`, fd => {
    if (!fd.nom.trim()) { toast('Le nom est obligatoire'); return false; }
    const lots = fd.lots.toUpperCase().split(/[\s,;]+/).map(x => x.replace(/^LOT/, '')).filter(x => LOTMAP[x]);
    Object.assign(c, { nom: fd.nom.trim(), tel: fd.tel.trim(), email: fd.email.trim(), ville: fd.ville.trim(), budget: parseMoney(fd.budget), source: fd.source, etape: fd.etape, lots, relance: fd.relance, notes: fd.notes });
    S.clients[c.id] = c; save();
    if (!id) location.hash = '#/client/' + c.id; else rerender();
    toast('Client enregistré');
  });
}
function viewClient(v, id) {
  const c = S.clients[id];
  setTitle(c.nom);
  topAction('Modifier', () => editClient(id));
  const ls = lotsDuClient(id), pays = Object.values(S.paiements).filter(p => p.clientId === id).sort((a, b) => b.date.localeCompare(a.date));
  const telw = (c.tel || '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^0/, '212');
  v.innerHTML = `<div class="wrap">
  <section class="card sec">
    <div class="row"><span class="eyebrow grow">${ETNOM[c.etape]}${c.source ? ' · ' + esc(c.source) : ''}</span><span class="small muted">depuis le ${fdate(c.cree)}</span></div>
    ${c.tel ? `<div class="btns"><a class="btn" href="tel:${esc(c.tel.replace(/\s/g, ''))}">Appeler</a><a class="btn ghost" href="https://wa.me/${esc(telw)}" target="_blank" rel="noopener">WhatsApp</a>${c.email ? `<a class="btn ghost" href="mailto:${esc(c.email)}">E-mail</a>` : ''}</div>` : ''}
    <div class="kv"><span>Téléphone</span><b class="num">${esc(c.tel) || '—'}</b></div>
    <div class="kv"><span>E-mail</span><b>${esc(c.email) || '—'}</b></div>
    <div class="kv"><span>Ville</span><b>${esc(c.ville) || '—'}</b></div>
    <div class="kv"><span>Budget</span><b class="num">${dh(c.budget)}</b></div>
    <div class="kv"><span>Prochaine relance</span><b class="${c.relance && c.relance < today() ? 'late' : ''}">${fdate(c.relance)}</b></div>
  </section>
  <section class="sec"><div class="sech"><h2>Étape</h2></div>
    <select class="f" id="etape" aria-label="Étape du client">${opts(ETAPES, c.etape)}</select>
    <div class="btns"><button class="btn small ghost" type="button" data-rel="3">Relancer dans 3 j</button><button class="btn small ghost" type="button" data-rel="7">Dans 1 semaine</button><button class="btn small ghost" type="button" data-rel="30">Dans 1 mois</button>${c.relance ? '<button class="btn small ghost" type="button" data-rel="0">Pas de relance</button>' : ''}</div>
  </section>
  <section class="card sec"><div class="sech"><h2>Lots</h2></div>
    ${ls.length ? `<div class="lotgrid">${ls.map(lotCard).join('')}</div>` : ''}
    ${c.lots.filter(x => !ls.find(l => l.id === x)).length ? `<div class="small muted">Intéressé par :</div><div class="lotgrid">${c.lots.filter(x => !ls.find(l => l.id === x)).map(x => lotCard(LOTMAP[x])).join('')}</div>` : ''}
    ${!ls.length && !c.lots.length ? '<div class="muted small">Aucun lot associé. Indiquez ses lots d’intérêt avec « Modifier », ou réservez un lot depuis sa fiche.</div>' : ''}
  </section>
  ${pays.length ? `<section class="card sec"><div class="sech"><h2>Encaissements</h2><b class="num">${dh(pays.filter(p => !p.desiste).reduce((s, p) => s + p.montant, 0))}</b></div><div class="tl">${pays.map(p => `<div class="tli"><div><div class="t num">${dh(p.montant)}${p.desiste ? ' <span class="small late">désistement</span>' : ''}</div><div class="small muted">${fdate(p.date)} · ${lotLabel(p.lotId)} · ${esc(p.mode)}</div></div><span></span><span></span></div>`).join('')}</div></section>` : ''}
  <section class="card sec"><div class="sech"><h2>Notes</h2></div><textarea class="f" id="cnotes" placeholder="Situation, financement, préférences…">${esc(c.notes)}</textarea></section>
  ${!ls.length && !pays.length ? `<button class="btn danger" type="button" id="delcli">Supprimer ce client</button>` : ''}
  </div>`;
  $('#etape').onchange = e => { c.etape = e.target.value; save(); toast('Étape : ' + ETNOM[c.etape]); rerender(); };
  v.querySelectorAll('[data-rel]').forEach(b => b.onclick = () => { const n = +b.dataset.rel; c.relance = n ? addDays(today(), n) : ''; save(); rerender(); toast(n ? 'Relance le ' + fdate(c.relance) : 'Relance retirée'); });
  const n = $('#cnotes'); n.onchange = () => { c.notes = n.value; save(); toast('Note enregistrée'); };
  const d = $('#delcli'); if (d) d.onclick = () => confirmSheet('Supprimer ce client ?', `${c.nom} sera supprimé définitivement de cet appareil.`, () => { delete S.clients[id]; save(); location.hash = '#/clients'; });
}

/* ---------- encaissements ---------- */
function viewPaiements(v) {
  setTitle('Encaissements');
  topAction('+ Encaisser', () => addPaiement());
  const all = Object.values(S.paiements).sort((a, b) => b.date.localeCompare(a.date));
  const valid = all.filter(p => !p.desiste);
  const total = valid.reduce((s, p) => s + p.montant, 0);
  const mois = today().slice(0, 7), duMois = valid.filter(p => p.date.startsWith(mois)).reduce((s, p) => s + p.montant, 0);
  const parMode = MODES.map(m => [m, valid.filter(p => p.mode === m).reduce((s, p) => s + p.montant, 0)]).filter(x => x[1]);
  const t = totaux();
  const groups = {}; all.forEach(p => (groups[p.date.slice(0, 7)] = groups[p.date.slice(0, 7)] || []).push(p));
  v.innerHTML = `<div class="wrap">
  <div class="kpis">
    <div class="kpi"><span>Total encaissé</span><b class="num" style="font-size:26px">${dh(total)}</b></div>
    <div class="kpi"><span>Ce mois-ci</span><b class="num" style="font-size:26px">${dh(duMois)}</b></div>
    <div class="kpi"><span>Reste à encaisser</span><b class="num" style="font-size:26px">${dh(t.reste)}</b><small>sur les lots réservés et vendus</small></div>
    <div class="kpi"><span>Versements</span><b class="num">${valid.length}</b></div>
  </div>
  ${parMode.length ? `<section class="card sec"><div class="sech"><h2>Par mode</h2></div>${parMode.map(([m, s]) => `<div class="kv"><span>${m}</span><b class="num">${dh(s)}</b></div>`).join('')}</section>` : ''}
  ${all.length ? Object.entries(groups).map(([m, ps]) => `<section class="sec"><div class="sech"><h2 style="font-size:20px;text-transform:capitalize">${new Date(m + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h2><span class="num muted small">${dh(ps.filter(p => !p.desiste).reduce((s, p) => s + p.montant, 0))}</span></div><div class="card list" style="padding:4px 14px">${ps.map(p => `<a class="li" href="#/lot/${p.lotId}"><div class="grow"><div class="t num">${dh(p.montant)}${p.desiste ? ' <span class="small late">désistement</span>' : ''}</div><div class="small muted">${fdate(p.date)} · ${lotLabel(p.lotId)} · ${esc(clientNom(p.clientId) || '—')} · ${esc(p.mode)}</div></div><span class="chev">›</span></a>`).join('')}</div></section>`).join('')
      : `<div class="empty">Aucun encaissement enregistré. Réservez un lot, puis enregistrez l’avance avec « + Encaisser ».</div>`}
  </div>`;
}

/* ---------- réglages ---------- */
function viewReglages(v) {
  setTitle('Réglages');
  const s = S.settings;
  v.innerHTML = `<div class="wrap">
  <form class="card sec" id="fset">
    <div class="sech"><h2>Programme</h2></div>
    <div class="two"><label class="fl">Promoteur<input class="f" name="promoteur" value="${esc(s.promoteur)}"></label><label class="fl">Nom du programme<input class="f" name="projet" value="${esc(s.projet)}"></label></div>
    <div class="sech"><h2>Prix au m²</h2><span class="small muted">DH par m² habitable</span></div>
    <div class="two">${NIVEAUX.map(([k, n]) => `<label class="fl">${n}<input class="f" name="p_${k}" inputmode="decimal" value="${s.prixM2[k] ? NF.format(s.prixM2[k]) : ''}" placeholder="Ex. 9 000"></label>`).join('')}
    <label class="fl">Terrasse (DH/m²)<input class="f" name="pter" inputmode="decimal" value="${s.prixTerrasseM2 ? NF.format(s.prixTerrasseM2) : ''}" placeholder="Ex. 3 000"></label></div>
    <div class="sech"><h2>Échéancier type</h2><span class="small muted">total ${s.echeancier.reduce((a, r) => a + r.p, 0)} %</span></div>
    ${s.echeancier.map((r, i) => `<div class="two"><label class="fl">Étape ${i + 1}<input class="f" name="el${i}" value="${esc(r.l)}"></label><label class="fl">Part (%)<input class="f" name="ep${i}" inputmode="numeric" value="${r.p}"></label></div>`).join('')}
    <div class="btns"><button class="btn" type="submit">Enregistrer les réglages</button></div>
  </form>
  <section class="card sec">
    <div class="sech"><h2>Sauvegarde</h2></div>
    <p class="small" style="margin:0">Les données restent sur cet appareil, sans compte ni serveur. Exportez une sauvegarde régulièrement et gardez-la en lieu sûr ; elle permet aussi de passer les données sur un autre téléphone.</p>
    <div class="small muted">Dernière sauvegarde : ${s.derniereSauvegarde ? fdate(s.derniereSauvegarde.slice(0, 10)) : 'jamais'}</div>
    <div class="btns"><button class="btn" type="button" id="exp">Exporter la sauvegarde</button><label class="btn ghost" for="imp">Importer une sauvegarde</label><input type="file" id="imp" accept="application/json,.json" hidden></div>
    <div class="sech"><h2 style="font-size:20px">Tableaux Excel</h2></div>
    <div class="btns"><button class="btn small ghost" type="button" data-csv="lots">Lots (CSV)</button><button class="btn small ghost" type="button" data-csv="clients">Clients (CSV)</button><button class="btn small ghost" type="button" data-csv="paiements">Encaissements (CSV)</button></div>
  </section>
  <section class="card sec">
    <div class="sech"><h2>Données</h2></div>
    <div class="small muted">${Object.keys(S.clients).length} clients · ${Object.keys(S.paiements).length} encaissements · ${LOTS.length} lots</div>
    <div class="btns"><button class="btn danger small" type="button" id="wipe">Tout effacer sur cet appareil</button></div>
  </section>
  <p class="small muted" style="text-align:center;margin:0">Ventes · ${esc(s.promoteur)} · v1.0</p>
  </div>`;
  $('#fset').onsubmit = e => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    s.promoteur = fd.promoteur.trim(); s.projet = fd.projet.trim();
    NIVEAUX.forEach(([k]) => s.prixM2[k] = parseMoney(fd['p_' + k]) || 0); s.prixTerrasseM2 = parseMoney(fd.pter) || 0;
    s.echeancier = s.echeancier.map((r, i) => ({ l: fd['el' + i].trim() || r.l, p: parseFloat(fd['ep' + i]) || 0 }));
    save(); rerender(); toast('Réglages enregistrés');
  };
  $('#exp').onclick = async () => {
    S.settings.derniereSauvegarde = new Date().toISOString(); save();
    await download(`ventes-sauvegarde-${today()}.json`, JSON.stringify(S, null, 1), 'application/json'); rerender();
  };
  $('#imp').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result); if (!d.lots || !d.settings) throw 0;
        confirmSheet('Remplacer les données ?', `La sauvegarde « ${f.name} » remplacera toutes les données de cet appareil (${Object.keys(d.clients || {}).length} clients, ${Object.keys(d.paiements || {}).length} encaissements).`, () => { localStorage.setItem(KEY, JSON.stringify(d)); S = load(); rerender(); toast('Sauvegarde importée'); }, 'Importer');
      } catch (err) { toast('Ce fichier n’est pas une sauvegarde valide'); }
    };
    r.readAsText(f); e.target.value = '';
  };
  v.querySelectorAll('[data-csv]').forEach(b => b.onclick = () => exportCsv(b.dataset.csv));
  $('#wipe').onclick = () => openSheet(`<h2>Tout effacer ?</h2><p style="margin:0">Clients, statuts, échéanciers et encaissements seront supprimés de cet appareil. Exportez d’abord une sauvegarde. Tapez EFFACER pour confirmer.</p><input class="f" name="w" autocomplete="off">${btnsOkCancel('Effacer', true)}`, fd => {
    if (fd.w.trim().toUpperCase() !== 'EFFACER') { toast('Tapez EFFACER pour confirmer'); return false; }
    S = defaults(); save(); location.hash = '#/'; toast('Données effacées');
  });
}
async function download(name, text, mime) {
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Fichier exporté');
}
function exportCsv(kind) {
  const cell = v => { const s = String(v ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const n = v => (v || v === 0) ? String(Math.round(v)) : '';
  let rows;
  if (kind === 'lots') rows = [['Lot', 'Niveau', 'Surface m²', 'Terrasse m²', 'Statut', 'Client', 'Téléphone', 'Prix catalogue', 'Prix de vente', 'Encaissé', 'Reste', 'Réservation', 'Acte']].concat(LOTS.map(l => { const st = S.lots[l.id], c = S.clients[st.clientId] || {}; const pv = engage(l.id) ? prixVente(l.id) : null; return [l.id, NIVNOM[l.niv], l.s, l.ter || '', STNOM[st.statut], c.nom, c.tel, n(prixCatalogue(l.id)), n(pv), n(encaisseLot(l.id)), pv ? n(pv - encaisseLot(l.id)) : '', st.dateRes, st.dateVente]; }));
  else if (kind === 'clients') rows = [['Nom', 'Téléphone', 'E-mail', 'Ville', 'Source', 'Étape', 'Budget', 'Lots', 'Relance', 'Créé le', 'Notes']].concat(Object.values(S.clients).map(c => [c.nom, c.tel, c.email, c.ville, c.source, ETNOM[c.etape], n(c.budget), lotsDuClient(c.id).map(l => l.id).concat(c.lots).filter((x, i, a) => a.indexOf(x) === i).join(' '), c.relance, c.cree, c.notes]));
  else rows = [['Date', 'Lot', 'Client', 'Montant', 'Mode', 'Référence', 'Désistement']].concat(Object.values(S.paiements).sort((a, b) => a.date.localeCompare(b.date)).map(p => [p.date, p.lotId, clientNom(p.clientId), n(p.montant), p.mode, p.ref, p.desiste ? 'oui' : '']));
  download(`${kind}-${today()}.csv`, '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n'), 'text/csv');
}

/* ---------- démarrage ---------- */
route();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
