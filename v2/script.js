/* ============================================================
   KOSOVO BANKING SYSTEM — MANAGEMENT DECISION COCKPIT v2
   Full interactive dashboard with NLB-centric logic
   ============================================================ */

// --- GLOBALS ---
const D = BANK_DATA;
const BANKS = D.banks;
const DATES = D.dates;
const CATS = D.categories;
const NLB_COLOR = '#230078';
const BANK_COLORS = {
    RBKO: '#e63946', NLB: '#230078', BKT: '#2a9d8f', PCB: '#e9c46a',
    TEB: '#264653', BEK: '#f4a261', BPB: '#6b7280', PRB: '#a78bfa',
    ZRB: '#06b6d4', CRB: '#94a3b8'
};
const CHART_INSTANCES = {};

// --- UTILITY FUNCTIONS ---
function commaFmt(v, decimals = 2) {
    if (v == null || isNaN(v)) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmt(v, decimals = 1) {
    if (v == null || isNaN(v)) return '—';
    if (Math.abs(v) >= 1e6) return (v / 1e6).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + 'B';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + 'M';
    return commaFmt(v, decimals);
}
function fmtUnit(v) {
    if (v == null || isNaN(v)) return 'k EUR';
    if (Math.abs(v) >= 1e6) return 'EUR';
    if (Math.abs(v) >= 1e3) return 'EUR';
    return 'k EUR';
}
function fmtK(v) { if (v == null) return '—'; return Math.round(v).toLocaleString('en-US'); }
function fmtPct(v, d = 2) { return v != null ? commaFmt(v, d) + '%' : '—'; }
function fmtPP(v) { if (v == null) return '—'; const sign = v > 0 ? '+' : ''; return sign + commaFmt(v, 2); }
function dateLabel(d) { const dt = new Date(d); const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return m[dt.getMonth()] + ' ' + dt.getFullYear(); }
function shortDate(d) { const dt = new Date(d); const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return m[dt.getMonth()] + "'" + String(dt.getFullYear()).slice(2); }
function getSelectedCategory() { return document.getElementById('filterCategory').value; }
function getSelectedPeriodIdx() { return parseInt(document.getElementById('filterPeriod').value); }
function getTopN() { return parseInt(document.getElementById('filterTopN').value); }
function getVal(sheet, cat, bank, idx) { const arr = D[sheet]?.[cat]?.[bank]; if (!arr) return null; return arr[idx]; }
function getSortedBanks(cat, idx, sheet = 'pct') { return BANKS.filter(b => getVal(sheet, cat, b, idx) != null).sort((a, b) => (getVal(sheet, cat, b, idx) || 0) - (getVal(sheet, cat, a, idx) || 0)); }

function destroyChart(id) { if (CHART_INSTANCES[id]) { CHART_INSTANCES[id].destroy(); delete CHART_INSTANCES[id]; } }

function renderChart(id, options) {
    destroyChart(id);
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    if (!options.chart) options.chart = {};
    options.chart.toolbar = { show: true, tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false }, export: { png: { filename: 'KBS_' + id }, svg: { filename: 'KBS_' + id } } };
    const chart = new ApexCharts(el, options);
    chart.render();
    CHART_INSTANCES[id] = chart;
}

function downloadTableAsImage(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const card = table.closest('.chart-card');
    if (!card) return;
    html2canvas(card, { backgroundColor: '#ffffff', scale: 2, logging: false, useCORS: true }).then(canvas => {
        const link = document.createElement('a');
        link.download = (filename || tableId) + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

function segLabel(c) { return c.replace('Deposits from ', 'Dep. ').replace('Corporate', 'Corp.').replace('Consumer', 'Cons.').replace('Housing', 'Hous.').replace('Gross ', ''); }

// --- INITIALIZATION ---
function init() {
    populateFilters();
    setupNavigation();
    setupComparisonSelectors();
    updateDashboard();
    document.getElementById('filterCategory').addEventListener('change', updateDashboard);
    document.getElementById('filterPeriod').addEventListener('change', updateDashboard);
    document.getElementById('filterTopN').addEventListener('change', updateDashboard);
    document.getElementById('compareA').addEventListener('change', updateComparison);
    document.getElementById('compareB').addEventListener('change', updateComparison);
}

function populateFilters() {
    const periodSelect = document.getElementById('filterPeriod');
    DATES.forEach((d, i) => { const opt = document.createElement('option'); opt.value = i; opt.textContent = dateLabel(d); if (i === DATES.length - 1) opt.selected = true; periodSelect.appendChild(opt); });
}

function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
            document.getElementById('sec-' + btn.dataset.section).classList.add('active');
            updateActiveSection(btn.dataset.section);
        });
    });
}

function setupComparisonSelectors() {
    const selA = document.getElementById('compareA');
    const selB = document.getElementById('compareB');
    selA.innerHTML = ''; selB.innerHTML = '';
    BANKS.forEach(b => { selA.appendChild(new Option(b + ' — ' + (D.bankFullNames[b] || b), b)); selB.appendChild(new Option(b + ' — ' + (D.bankFullNames[b] || b), b)); });
    selA.value = 'NLB'; selB.value = 'RBKO';
}

function updateActiveSection(section) {
    const sectionMap = { comparison: updateComparison, trends: updateTrends, competitive: updateCompetitive, segments: updateSegments, growth: updateGrowth, profitability: updateProfitability, insights: updateInsights, ceo: updateCEOPanel, gap: updateGapMomentum, waterfall: updateWaterfall, deposits: updateDeposits, quadrants: updateQuadrants, scanner: updateScanner, methodology: updateMethodology };
    if (sectionMap[section]) sectionMap[section]();
}

// ============================================================
// SECTION 1: EXECUTIVE OVERVIEW (same as v1)
// ============================================================
function updateDashboard() {
    const cat = getSelectedCategory();
    const idx = getSelectedPeriodIdx();
    const prevIdx = idx > 0 ? idx - 1 : null;
    const topN = getTopN();
    const period = dateLabel(DATES[idx]);

    document.getElementById('overviewSubtitle').textContent = `Kosovo Banking System — ${cat} at ${period}`;
    document.getElementById('rankingTitle').textContent = cat;

    const totalVal = getVal('eur', cat, 'Total', idx);
    const nlbVal = getVal('eur', cat, 'NLB', idx);
    const nlbShare = getVal('pct', cat, 'NLB', idx);
    const nlbSharePrev = prevIdx != null ? getVal('pct', cat, 'NLB', prevIdx) : null;
    const shareChange = (nlbShare != null && nlbSharePrev != null) ? nlbShare - nlbSharePrev : null;
    const sorted = getSortedBanks(cat, idx);
    const nlbRank = sorted.indexOf('NLB') + 1;
    const leaderShare = getVal('pct', cat, sorted[0], idx);
    const gapToLeader = (nlbShare != null && leaderShare != null) ? nlbShare - leaderShare : null;

    document.getElementById('kpiMarketSize').textContent = fmt(totalVal);
    document.getElementById('kpiMarketUnit').textContent = fmtUnit(totalVal);
    document.getElementById('kpiNlbValue').textContent = fmt(nlbVal);
    document.getElementById('kpiNlbUnit').textContent = fmtUnit(nlbVal);
    document.getElementById('kpiNlbShare').textContent = nlbShare != null ? nlbShare.toFixed(2) : '—';

    const scEl = document.getElementById('kpiShareChange');
    scEl.textContent = fmtPP(shareChange);
    scEl.className = 'kpi-value ' + (shareChange > 0 ? 'kpi-positive' : shareChange < 0 ? 'kpi-negative' : '');
    document.getElementById('kpiNlbRank').textContent = '#' + nlbRank;
    document.getElementById('kpiGapLeader').textContent = sorted[0] === 'NLB' ? 'Leader' : fmtPP(gapToLeader);

    const insightParts = [];
    if (nlbShare != null) insightParts.push(`NLB holds a ${nlbShare.toFixed(2)}% market share in ${cat}, ranking #${nlbRank} among ${sorted.length} banks.`);
    if (shareChange != null && shareChange !== 0) insightParts.push(`NLB ${shareChange > 0 ? 'gained' : 'lost'} ${Math.abs(shareChange).toFixed(2)}pp compared to the previous period.`);
    if (sorted[0] !== 'NLB' && gapToLeader != null) insightParts.push(`The gap to market leader ${sorted[0]} is ${Math.abs(gapToLeader).toFixed(2)}pp.`);
    document.getElementById('overviewInsightText').textContent = insightParts.join(' ') || 'Select a category and period to view insights.';

    renderPieChart(cat, idx, topN);
    renderNlbTrendChart(cat);
    renderRankingTable(cat, idx, prevIdx != null ? prevIdx : idx, topN);

    const activeNav = document.querySelector('.nav-btn.active');
    if (activeNav) updateActiveSection(activeNav.dataset.section);
}

function renderPieChart(cat, idx, topN) {
    const sorted = getSortedBanks(cat, idx);
    const banks = sorted.slice(0, topN);
    const values = banks.map(b => getVal('pct', cat, b, idx) || 0);
    document.getElementById('pieSubtitle').textContent = dateLabel(DATES[idx]);
    renderChart('chartPie', {
        chart: { type: 'donut', height: 320, fontFamily: 'Inter, sans-serif' },
        series: values, labels: banks, colors: banks.map(b => BANK_COLORS[b]),
        plotOptions: { pie: { donut: { size: '58%', labels: { show: true, name: { fontSize: '14px', fontWeight: 700 }, value: { fontSize: '18px', fontWeight: 700, formatter: v => parseFloat(v).toFixed(1) + '%' }, total: { show: true, label: 'NLB', fontSize: '13px', formatter: () => (getVal('pct', cat, 'NLB', idx) || 0).toFixed(1) + '%' } } } } },
        dataLabels: { enabled: false }, legend: { position: 'bottom', fontSize: '12px', fontWeight: 500, markers: { width: 10, height: 10, radius: 3 } },
        stroke: { width: 2, colors: ['#fff'] }, tooltip: { y: { formatter: v => v.toFixed(2) + '%' } }
    });
}

function renderNlbTrendChart(cat) {
    const nlbData = DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('pct', cat, 'NLB', i) })).filter(p => p.y != null);
    renderChart('chartNlbTrend', {
        chart: { type: 'area', height: 320, fontFamily: 'Inter, sans-serif', zoom: { enabled: false } },
        series: [{ name: 'NLB Market Share', data: nlbData }], colors: [NLB_COLOR],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 100] } },
        stroke: { width: 3, curve: 'smooth' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '11px' } } },
        yaxis: { labels: { formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px' } } }, dataLabels: { enabled: false },
        tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => v.toFixed(2) + '%' } }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 },
        annotations: { yaxis: nlbData.length > 0 ? [{ y: nlbData[nlbData.length - 1].y, borderColor: NLB_COLOR, strokeDashArray: 4, label: { text: 'Current: ' + nlbData[nlbData.length - 1].y.toFixed(2) + '%', style: { background: NLB_COLOR, color: '#fff', fontSize: '11px', padding: { left: 8, right: 8, top: 3, bottom: 3 } } } }] : [] }
    });
}

function renderRankingTable(cat, idx, prevIdx, topN) {
    const sorted = getSortedBanks(cat, idx);
    const banks = sorted.slice(0, topN);
    const tbody = document.getElementById('rankingBody');
    tbody.innerHTML = '';
    const maxShare = getVal('pct', cat, banks[0], idx) || 1;
    banks.forEach((b, i) => {
        const val = getVal('eur', cat, b, idx); const share = getVal('pct', cat, b, idx); const prevShare = getVal('pct', cat, b, prevIdx);
        const change = (share != null && prevShare != null) ? share - prevShare : null; const isNLB = b === 'NLB'; const barWidth = share != null ? (share / maxShare * 100) : 0;
        const tr = document.createElement('tr'); if (isNLB) tr.classList.add('nlb-row');
        tr.innerHTML = `<td><strong>#${i + 1}</strong></td><td><strong>${b}</strong> <span style="color:var(--text-muted);font-size:0.75rem">${D.bankFullNames[b] || ''}</span></td><td>${fmtK(val)}</td><td><strong>${fmtPct(share)}</strong></td><td class="${change > 0 ? 'kpi-positive' : change < 0 ? 'kpi-negative' : ''}">${fmtPP(change)} pp</td><td><div class="share-bar-wrapper"><div class="share-bar ${isNLB ? 'nlb' : ''}" style="width:${barWidth}%;background:${BANK_COLORS[b]}"></div></div></td>`;
        tbody.appendChild(tr);
    });
}

// ============================================================
// SECTION 2: CEO ACTION PANEL
// ============================================================
function updateCEOPanel() {
    const cat = getSelectedCategory();
    const idx = getSelectedPeriodIdx();
    const prevIdx = idx > 0 ? idx - 1 : null;
    const prev3Idx = idx >= 3 ? idx - 3 : null;
    const prevYearIdx = idx >= 4 ? idx - 4 : null;
    const prof = D.profitability;
    const nlbROE = prof?.ratios?.ROE?.NLB || 0;
    const nlbCIR = prof?.ratios?.CIR?.NLB || 0;
    const nlbNPL = prof?.ratios?.NPL?.NLB || 0;
    const nlbCAR = prof?.ratios?.CAR?.NLB || 0;
    const nlbLCR = prof?.ratios?.LCR?.NLB || 0;

    // Current period data
    const nlbShare = getVal('pct', cat, 'NLB', idx) || 0;
    const nlbVal = getVal('eur', cat, 'NLB', idx) || 0;
    const sorted = getSortedBanks(cat, idx);
    const nlbRank = sorted.indexOf('NLB') + 1;
    const leader = sorted[0];
    const leaderShare = getVal('pct', cat, leader, idx) || 0;
    const gap = nlbShare - leaderShare;

    // Previous period comparisons
    const nlbSharePrev = prevIdx != null ? (getVal('pct', cat, 'NLB', prevIdx) || 0) : null;
    const nlbValPrev = prevIdx != null ? (getVal('eur', cat, 'NLB', prevIdx) || 0) : null;
    const sc = nlbSharePrev != null ? nlbShare - nlbSharePrev : 0;
    const nlbGr = nlbValPrev ? ((nlbVal / nlbValPrev - 1) * 100) : 0;
    const prevSorted = prevIdx != null ? getSortedBanks(cat, prevIdx) : [];
    const nlbRankPrev = prevSorted.indexOf('NLB') + 1;
    const rankChange = nlbRankPrev > 0 ? nlbRankPrev - nlbRank : 0;

    // 3-period (quarter) comparison
    const nlbShare3 = prev3Idx != null ? (getVal('pct', cat, 'NLB', prev3Idx) || 0) : null;
    const nlbVal3 = prev3Idx != null ? (getVal('eur', cat, 'NLB', prev3Idx) || 0) : null;
    const sc3 = nlbShare3 != null ? nlbShare - nlbShare3 : null;
    const nlbGr3 = nlbVal3 ? ((nlbVal / nlbVal3 - 1) * 100) : null;

    // Find per-bank dynamics
    const bankDynamics = BANKS.map(b => {
        const cur = getVal('eur', cat, b, idx) || 0;
        const prev = prevIdx != null ? (getVal('eur', cat, b, prevIdx) || 0) : 0;
        const shareCur = getVal('pct', cat, b, idx) || 0;
        const sharePrev = prevIdx != null ? (getVal('pct', cat, b, prevIdx) || 0) : 0;
        const gr = prev ? ((cur / prev - 1) * 100) : 0;
        return { bank: b, val: cur, growth: gr, share: shareCur, shareChange: shareCur - sharePrev };
    });
    const fastestComp = bankDynamics.filter(d => d.bank !== 'NLB').sort((a, b) => b.growth - a.growth)[0];
    const biggestGainer = bankDynamics.filter(d => d.bank !== 'NLB').sort((a, b) => b.shareChange - a.shareChange)[0];
    const biggestLoser = bankDynamics.filter(d => d.bank !== 'NLB').sort((a, b) => a.shareChange - b.shareChange)[0];

    // Find NLB's strongest and weakest segments dynamically
    const segCats = ['Gross Loans', 'Corporate Loans', 'Retail Loans', 'Housing Loans', 'Consumer Loans', 'Total Deposits', 'Deposits from Corporate', 'Deposits from Retail', 'Deposits CA', 'Deposits Saving', 'Deposits TDA'];
    const segPerf = segCats.map(c => {
        const sh = getVal('pct', c, 'NLB', idx);
        const shPrev = prevIdx != null ? getVal('pct', c, 'NLB', prevIdx) : null;
        const chg = sh != null && shPrev != null ? sh - shPrev : null;
        const segSorted = getSortedBanks(c, idx);
        const rk = segSorted.indexOf('NLB') + 1;
        return { cat: c, share: sh, change: chg, rank: rk };
    }).filter(s => s.share != null);
    const bestSeg = segPerf.sort((a, b) => (b.share || 0) - (a.share || 0))[0];
    const worstSeg = segPerf.sort((a, b) => (a.share || 0) - (b.share || 0))[0];
    const mostImproved = segPerf.filter(s => s.change != null).sort((a, b) => (b.change || 0) - (a.change || 0))[0];
    const mostDeclined = segPerf.filter(s => s.change != null).sort((a, b) => (a.change || 0) - (b.change || 0))[0];

    // ===== POSITIVES (fully dynamic) =====
    const positives = [];

    // 1. Category-specific position & momentum
    if (nlbRank === 1) {
        positives.push(`NLB is market leader in ${cat} with ${nlbShare.toFixed(2)}% share${sc !== 0 ? ' (' + (sc > 0 ? '+' : '') + sc.toFixed(2) + 'pp MoM)' : ''} — #1 position.`);
    } else if (sc > 0) {
        positives.push(`${cat} share gained ${sc.toFixed(2)}pp MoM to ${nlbShare.toFixed(2)}% (rank #${nlbRank})${rankChange > 0 ? ' — climbed ' + rankChange + ' position(s)' : ''}.${nlbGr > 0 ? ' Value grew ' + nlbGr.toFixed(1) + '% vs prior period.' : ''}`);
    } else if (nlbRank <= 3) {
        positives.push(`Strong #${nlbRank} position in ${cat} at ${nlbShare.toFixed(2)}% share.${sc3 != null && sc3 > 0 ? ' Gained ' + sc3.toFixed(2) + 'pp over last 3 periods.' : ''}${nlbGr > 0 ? ' Value grew ' + nlbGr.toFixed(1) + '% MoM.' : ''}`);
    }

    // 2. Profitability — dynamic with changes
    const nlbNetProfit = prof?.plItems?.['Net Profit']?.NLB || 0;
    const nlbProfitRank = prof?.ranks?.['Net Profit']?.NLB || 0;
    const nlbProfitShare = prof?.ratios?.['Net Profit Market Share']?.NLB || 0;
    const npPct = D.pct?.['Net Profit'];
    const npHistShare = npPct?.NLB?.[idx];
    const npHistSharePrev = prevIdx != null ? npPct?.NLB?.[prevIdx] : null;
    const npShareChg = npHistShare != null && npHistSharePrev != null ? npHistShare - npHistSharePrev : null;
    if (nlbProfitRank <= 2) {
        let msg = `#${nlbProfitRank} in Net Profit — ${commaFmt(nlbNetProfit, 0)} k EUR (${nlbProfitShare.toFixed(1)}% of sector)`;
        if (npShareChg != null && npShareChg !== 0) msg += `. Profit share ${npShareChg > 0 ? 'up' : 'down'} ${Math.abs(npShareChg).toFixed(1)}pp vs prior month`;
        msg += '.';
        positives.push(msg);
    } else {
        positives.push(`Net profit ${commaFmt(nlbNetProfit, 0)} k EUR, rank #${nlbProfitRank}. Profit share ${nlbProfitShare.toFixed(1)}%${npShareChg != null ? ' (' + (npShareChg > 0 ? '+' : '') + npShareChg.toFixed(1) + 'pp MoM)' : ''}.`);
    }

    // 3. Efficiency & returns
    const avgROE = BANKS.reduce((s, b) => s + (prof?.ratios?.ROE?.[b] || 0), 0) / BANKS.length;
    const avgCIR = BANKS.reduce((s, b) => s + (prof?.ratios?.CIR?.[b] || 0), 0) / BANKS.length;
    if (nlbCIR < avgCIR) {
        positives.push(`CIR ${nlbCIR.toFixed(1)}% — ${(avgCIR - nlbCIR).toFixed(1)}pp better than sector avg (${avgCIR.toFixed(1)}%). ${nlbCIR < 35 ? 'Best-in-class efficiency.' : 'Strong cost discipline.'} ROE ${nlbROE.toFixed(1)}% ${nlbROE > avgROE ? 'exceeds' : 'trails'} avg ${avgROE.toFixed(1)}%.`);
    } else if (nlbROE > avgROE) {
        positives.push(`ROE ${nlbROE.toFixed(1)}% outperforms sector avg of ${avgROE.toFixed(1)}% — strong shareholder returns despite CIR of ${nlbCIR.toFixed(1)}%.`);
    }

    // 4. Segment strengths — dynamic
    if (bestSeg && bestSeg.share > 20) {
        positives.push(`Strongest segment: ${bestSeg.cat} at ${bestSeg.share.toFixed(1)}% (rank #${bestSeg.rank})${bestSeg.change != null && bestSeg.change !== 0 ? ', ' + (bestSeg.change > 0 ? '+' : '') + bestSeg.change.toFixed(2) + 'pp MoM' : ''}.`);
    }
    if (mostImproved && mostImproved.change > 0 && mostImproved.cat !== bestSeg?.cat) {
        positives.push(`Fastest improving segment: ${mostImproved.cat} gained ${mostImproved.change.toFixed(2)}pp to ${mostImproved.share.toFixed(1)}% share.`);
    }

    // 5. Risk metrics as positives when strong
    if (nlbNPL < 2) positives.push(`NPL ratio ${nlbNPL.toFixed(2)}% — excellent asset quality. CAR ${nlbCAR.toFixed(1)}% provides strong capital buffer.`);
    if (nlbLCR > 400) positives.push(`LCR at ${nlbLCR.toFixed(0)}% — very strong liquidity position, well above regulatory minimums.`);

    // 6. Growth vs market
    const mktVal = getVal('eur', cat, 'Total', idx) || 0;
    const mktValPrev = prevIdx != null ? (getVal('eur', cat, 'Total', prevIdx) || 0) : 0;
    const mktGr = mktValPrev ? ((mktVal / mktValPrev - 1) * 100) : 0;
    if (nlbGr > mktGr + 0.5 && nlbGr > 0) positives.push(`NLB growing faster (${nlbGr.toFixed(1)}%) than market (${mktGr.toFixed(1)}%) in ${cat} — gaining organic share.`);

    document.getElementById('ceoPositives').innerHTML = positives.slice(0, 3).map((p, i) => `<li>${p}</li>`).join('');

    // ===== RISKS (fully dynamic) =====
    const risks = [];

    // 1. Share erosion with trend context
    if (sc < 0) {
        let erosionMsg = `${cat} share lost ${Math.abs(sc).toFixed(2)}pp MoM (${nlbSharePrev.toFixed(2)}% → ${nlbShare.toFixed(2)}%)`;
        if (sc3 != null && sc3 < 0) erosionMsg += `. Persistent decline: ${Math.abs(sc3).toFixed(2)}pp over last 3 periods`;
        erosionMsg += '.';
        risks.push(erosionMsg);
    }

    // 2. Competitive threats with specifics
    if (fastestComp && fastestComp.growth > nlbGr + 1) {
        risks.push(`${fastestComp.bank} outpacing NLB in ${cat}: +${fastestComp.growth.toFixed(1)}% vs NLB +${nlbGr.toFixed(1)}%. ${biggestGainer && biggestGainer.shareChange > 0 ? biggestGainer.bank + ' gained ' + biggestGainer.shareChange.toFixed(2) + 'pp share.' : ''}`);
    }

    // 3. Gap to leader
    if (gap < 0 && leader !== 'NLB') {
        const gapPrev = prevIdx != null ? (nlbSharePrev - (getVal('pct', cat, leader, prevIdx) || 0)) : null;
        const gapTrend = gapPrev != null ? gap - gapPrev : null;
        risks.push(`Gap to leader ${leader}: ${Math.abs(gap).toFixed(2)}pp${gapTrend != null ? (gapTrend < 0 ? ' (widening by ' + Math.abs(gapTrend).toFixed(2) + 'pp)' : gapTrend > 0 ? ' (narrowing by ' + gapTrend.toFixed(2) + 'pp)' : ' (stable)') : ''}.`);
    }

    // 4. Rank deterioration
    if (rankChange < 0) risks.push(`Rank dropped ${Math.abs(rankChange)} position(s) in ${cat} (#${nlbRankPrev} → #${nlbRank}) — competitive pressure intensifying.`);

    // 5. Segment weaknesses
    if (mostDeclined && mostDeclined.change < -0.1) {
        risks.push(`Weakest segment momentum: ${mostDeclined.cat} lost ${Math.abs(mostDeclined.change).toFixed(2)}pp MoM (now ${mostDeclined.share.toFixed(1)}%, rank #${mostDeclined.rank}).`);
    }

    // 6. Funding cost pressure
    const intExpNLB = prof?.plItems?.['Interest Expense']?.NLB || 0;
    const intExpTotal = prof?.plItems?.['Interest Expense']?.Total || 0;
    const intExpShare = intExpTotal ? (Math.abs(intExpNLB) / Math.abs(intExpTotal) * 100) : 0;
    if (intExpShare > 18) risks.push(`Interest expense share ${intExpShare.toFixed(1)}% of sector — NLB bears disproportionate funding costs vs ${(getVal('pct', 'Assets', 'NLB', idx) || 0).toFixed(1)}% asset share.`);

    // 7. CIR / NPL concerns
    if (nlbCIR > avgCIR) risks.push(`CIR ${nlbCIR.toFixed(1)}% above sector avg ${avgCIR.toFixed(1)}% — efficiency gap needs addressing.`);
    if (nlbNPL > 2.5) risks.push(`NPL ratio ${nlbNPL.toFixed(2)}% — credit quality warrants close monitoring.`);

    // Fallback
    if (risks.length < 3) risks.push(`Market growing at ${mktGr.toFixed(1)}% — NLB must match or exceed to protect position.`);

    document.getElementById('ceoRisks').innerHTML = risks.slice(0, 3).map((r, i) => `<li>${r}</li>`).join('');

    // ===== ACTIONS (dynamic based on identified issues) =====
    const actions = [];

    // Action based on share performance
    if (sc < 0) {
        actions.push({ action: `Reverse ${cat} share decline: analyze lost ${Math.abs(sc).toFixed(2)}pp — identify customer attrition sources and launch retention campaigns`, owner: 'Head of ' + (cat.includes('Loan') ? 'Lending' : cat.includes('Deposit') ? 'Deposits' : 'Retail'), timing: 'Immediate', confidence: 'High' });
    } else if (nlbRank > 2) {
        actions.push({ action: `Improve ${cat} ranking from #${nlbRank}: target ${sorted[nlbRank - 2]} (gap ${((getVal('pct', cat, sorted[nlbRank - 2], idx) || 0) - nlbShare).toFixed(2)}pp) through competitive pricing`, owner: 'Head of Strategy', timing: 'Q2 2026', confidence: 'Medium' });
    } else {
        actions.push({ action: `Defend #${nlbRank} position in ${cat} — strengthen ${nlbShare.toFixed(1)}% share through customer loyalty and cross-sell programs`, owner: 'Head of Retail', timing: 'Ongoing', confidence: 'High' });
    }

    // Action based on competitive threat
    if (fastestComp && fastestComp.growth > nlbGr + 2) {
        actions.push({ action: `Counter ${fastestComp.bank}'s growth momentum (${fastestComp.growth.toFixed(1)}% vs NLB ${nlbGr.toFixed(1)}%) — benchmark their product offering and pricing`, owner: 'Head of Strategy', timing: 'Q2 2026', confidence: 'Medium' });
    } else if (mostDeclined && mostDeclined.change < -0.2) {
        actions.push({ action: `Arrest decline in ${mostDeclined.cat} (lost ${Math.abs(mostDeclined.change).toFixed(2)}pp) — review product competitiveness and distribution`, owner: 'Product Head', timing: 'Q2 2026', confidence: 'High' });
    } else {
        actions.push({ action: 'Optimize deposit product mix: grow TDA and CA to strengthen funding base and reduce cost of funds', owner: 'Head of Treasury', timing: 'Q2-Q3 2026', confidence: 'Medium' });
    }

    // Action based on strengths to exploit
    if (bestSeg && bestSeg.share > 20 && bestSeg.rank <= 2) {
        actions.push({ action: `Capitalize on ${bestSeg.cat} leadership (${bestSeg.share.toFixed(1)}%, #${bestSeg.rank}) — expand through product innovation and cross-selling`, owner: 'Head of Retail Lending', timing: 'Q2 2026', confidence: 'High' });
    } else if (intExpShare > 18) {
        actions.push({ action: `Reduce funding cost concentration (${intExpShare.toFixed(1)}% of sector interest expense) — diversify deposit sourcing and optimize term structure`, owner: 'Head of Treasury', timing: 'Q2-Q3 2026', confidence: 'Medium' });
    } else {
        actions.push({ action: `Leverage best-in-class CIR (${nlbCIR.toFixed(1)}%) to invest in digital capabilities and grow market share profitably`, owner: 'Head of Digital', timing: 'Q3 2026', confidence: 'High' });
    }

    const actBody = document.getElementById('ceoActionsBody');
    actBody.innerHTML = actions.slice(0, 3).map(a => `<tr><td>${a.action}</td><td>${a.owner}</td><td>${a.timing}</td><td><span class="confidence-badge ${a.confidence === 'High' ? 'conf-high' : a.confidence === 'Medium' ? 'conf-medium' : 'conf-low'}">${a.confidence}</span></td></tr>`).join('');
}

// ============================================================
// SECTION 3: GAP & RANK MOMENTUM
// ============================================================
function updateGapMomentum() {
    const cat = getSelectedCategory();
    const idx = getSelectedPeriodIdx();
    const prevIdx = idx > 0 ? idx - 1 : idx;
    const qtrBack = Math.max(0, idx - 4);

    const sorted = getSortedBanks(cat, idx);
    const nlbRank = sorted.indexOf('NLB') + 1;
    const prevSorted = getSortedBanks(cat, prevIdx);
    const prevRank = prevSorted.indexOf('NLB') + 1;
    const leader = sorted[0];
    const nlbShare = getVal('pct', cat, 'NLB', idx) || 0;
    const leaderShare = getVal('pct', cat, leader, idx) || 0;
    const gap = nlbShare - leaderShare;
    const nlbShareQ = getVal('pct', cat, 'NLB', qtrBack) || 0;
    const shareDelta4Q = nlbShare - nlbShareQ;
    const leaderShareQ = getVal('pct', cat, getSortedBanks(cat, qtrBack)[0], qtrBack) || 0;
    const gapQ = nlbShareQ - leaderShareQ;
    const gapChange = gap - gapQ;

    document.getElementById('gapKpiRank').textContent = '#' + nlbRank;
    document.getElementById('gapKpiRankLabel').textContent = `in ${cat}`;
    const rcEl = document.getElementById('gapKpiRankChange');
    const rankChange = prevRank - nlbRank;
    rcEl.textContent = rankChange > 0 ? '+' + rankChange : rankChange < 0 ? String(rankChange) : '0';
    rcEl.className = 'kpi-value ' + (rankChange > 0 ? 'kpi-positive' : rankChange < 0 ? 'kpi-negative' : '');
    document.getElementById('gapKpiGap').textContent = leader === 'NLB' ? 'Leader' : fmtPP(gap);
    const gcEl = document.getElementById('gapKpiGapChange');
    gcEl.textContent = fmtPP(gapChange);
    gcEl.className = 'kpi-value ' + (gapChange > 0 ? 'kpi-positive' : gapChange < 0 ? 'kpi-negative' : '');

    // Gap trend chart
    const gapData = DATES.map((d, i) => {
        const s = getSortedBanks(cat, i);
        const ls = getVal('pct', cat, s[0], i) || 0;
        const ns = getVal('pct', cat, 'NLB', i);
        return ns != null ? { x: new Date(d).getTime(), y: parseFloat((ns - ls).toFixed(2)) } : null;
    }).filter(Boolean);

    renderChart('chartGapTrend', {
        chart: { type: 'area', height: 320, fontFamily: 'Inter, sans-serif' },
        series: [{ name: 'Gap to Leader (pp)', data: gapData }], colors: [NLB_COLOR],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 } },
        stroke: { width: 2, curve: 'smooth' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
        yaxis: { labels: { formatter: v => (v > 0 ? '+' : '') + v.toFixed(1) + 'pp', style: { fontSize: '11px' } } },
        dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => (v > 0 ? '+' : '') + v.toFixed(2) + 'pp' } },
        grid: { borderColor: '#f0f0f0', strokeDashArray: 3 },
        annotations: { yaxis: [{ y: 0, borderColor: '#c0392b', strokeDashArray: 0, borderWidth: 1 }] }
    });

    // Rank history
    const rankData = DATES.map((d, i) => {
        const s = getSortedBanks(cat, i);
        const r = s.indexOf('NLB') + 1;
        return r > 0 ? { x: new Date(d).getTime(), y: r } : null;
    }).filter(Boolean);

    renderChart('chartRankHistory', {
        chart: { type: 'line', height: 320, fontFamily: 'Inter, sans-serif' },
        series: [{ name: 'NLB Rank', data: rankData }], colors: [NLB_COLOR],
        stroke: { width: 3, curve: 'stepline' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
        yaxis: { reversed: true, min: 1, max: 6, labels: { formatter: v => '#' + v, style: { fontSize: '11px' } } },
        dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => '#' + v } },
        grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }, markers: { size: 3 }
    });

    // Rank heatmap — last 6 periods across segments
    const last6 = DATES.slice(-6);
    const last6Idx = DATES.length - 6;
    const heatSeries = CATS.map(c => ({
        name: segLabel(c),
        data: last6.map((d, i) => {
            const s = getSortedBanks(c, last6Idx + i);
            const r = s.indexOf('NLB') + 1;
            return { x: shortDate(d), y: r || 10 };
        })
    }));

    renderChart('chartRankHeatmap', {
        chart: { type: 'heatmap', height: 420, fontFamily: 'Inter, sans-serif' },
        series: heatSeries, colors: [NLB_COLOR],
        plotOptions: { heatmap: { radius: 4, colorScale: { ranges: [
            { from: 1, to: 2, color: '#230078', name: '#1-2' },
            { from: 2.01, to: 3, color: '#6c3fc8', name: '#3' },
            { from: 3.01, to: 5, color: '#b8a0f0', name: '#4-5' },
            { from: 5.01, to: 10, color: '#e8e0ff', name: '#6+' }
        ] } } },
        dataLabels: { enabled: true, formatter: v => '#' + v, style: { fontSize: '11px', fontWeight: 700 } },
        xaxis: { labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { style: { fontSize: '10px' } } },
        tooltip: { y: { formatter: v => 'Rank #' + v } }
    });
}

// ============================================================
// SECTION 4: MARKET TRENDS (from v1)
// ============================================================
function updateTrends() {
    const cat = getSelectedCategory(); const topN = getTopN();
    const sorted = getSortedBanks(cat, DATES.length - 1);
    const banks = sorted.slice(0, topN);
    const series = banks.map(b => ({ name: b, data: DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('pct', cat, b, i) })).filter(p => p.y != null) }));
    renderChart('chartTrendAll', { chart: { type: 'line', height: 420, fontFamily: 'Inter, sans-serif' }, series, colors: banks.map(b => BANK_COLORS[b]), stroke: { width: banks.map(b => b === 'NLB' ? 4 : 2), curve: 'smooth' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '11px' } } }, yaxis: { labels: { formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => v ? v.toFixed(2) + '%' : '—' } }, legend: { position: 'top', fontSize: '12px', fontWeight: 500 }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 } });
    const marketData = DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('eur', cat, 'Total', i) })).filter(p => p.y != null);
    renderChart('chartMarketSize', { chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Market Total', data: marketData }], colors: ['#d4d4e8'], plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { formatter: v => fmt(v, 0), style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => fmtK(v) + ' k EUR' } }, grid: { borderColor: '#f0f0f0' } });
    const top3 = sorted.filter(b => b !== 'NLB').slice(0, 3);
    const nlbSeries = { name: 'NLB', data: DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('pct', cat, 'NLB', i) })).filter(p => p.y != null) };
    const top3Series = top3.map(b => ({ name: b, data: DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('pct', cat, b, i) })).filter(p => p.y != null) }));
    renderChart('chartNlbVsTop3', { chart: { type: 'line', height: 320, fontFamily: 'Inter, sans-serif' }, series: [nlbSeries, ...top3Series], colors: [NLB_COLOR, ...top3.map(b => BANK_COLORS[b])], stroke: { width: [4, 2, 2, 2], curve: 'smooth', dashArray: [0, 4, 4, 4] }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => v ? v.toFixed(2) + '%' : '—' } }, legend: { position: 'top', fontSize: '12px' }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 } });
}

// ============================================================
// SECTION 5: COMPETITIVE (from v1)
// ============================================================
function updateCompetitive() {
    const cat = getSelectedCategory(); const idx = getSelectedPeriodIdx(); const prevIdx = idx > 0 ? idx - 1 : idx;
    const topN = getTopN(); const sorted = getSortedBanks(cat, idx); const banks = sorted.slice(0, topN);
    renderChart('chartBarRanking', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Market Share', data: banks.map(b => ({ x: b, y: getVal('pct', cat, b, idx) || 0 })) }], colors: banks.map(b => BANK_COLORS[b]), plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 4, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%', offsetX: 30, style: { fontSize: '12px', fontWeight: 700, colors: ['#333'] } }, xaxis: { labels: { formatter: v => v.toFixed(0) + '%', style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: v => v.toFixed(2) + '%' } } });
    const changes = banks.map(b => { const cur = getVal('pct', cat, b, idx); const prev = getVal('pct', cat, b, prevIdx); return { x: b, y: (cur != null && prev != null) ? parseFloat((cur - prev).toFixed(4)) : 0 }; }).sort((a, b) => b.y - a.y);
    renderChart('chartShareChange', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Share Change (pp)', data: changes }], colors: [({ value }) => value >= 0 ? '#0d8a56' : '#c0392b'], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: v => (v > 0 ? '+' : '') + v.toFixed(2) + 'pp', offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: v => v.toFixed(2) + 'pp', style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: v => (v > 0 ? '+' : '') + v.toFixed(4) + ' pp' } } });
    const heatBanks = getSortedBanks('Assets', idx).slice(0, 7);
    const heatSeries = heatBanks.map(b => ({ name: b, data: CATS.map(c => ({ x: segLabel(c), y: getVal('pct', c, b, idx) || 0 })) }));
    renderChart('chartHeatmap', { chart: { type: 'heatmap', height: 420, fontFamily: 'Inter, sans-serif' }, series: heatSeries, colors: [NLB_COLOR], dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%', style: { fontSize: '10px' } }, plotOptions: { heatmap: { radius: 4, colorScale: { ranges: [{ from: 0, to: 8, color: '#e8e0ff', name: '0-8%' }, { from: 8, to: 14, color: '#b8a0f0', name: '8-14%' }, { from: 14, to: 20, color: '#7c50d0', name: '14-20%' }, { from: 20, to: 40, color: '#230078', name: '20%+' }] } } }, xaxis: { labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { style: { fontSize: '11px', fontWeight: 600 } } }, tooltip: { y: { formatter: v => v.toFixed(2) + '%' } } });
}

// ============================================================
// SECTION 6: BANK VS BANK (from v1)
// ============================================================
function updateComparison() {
    const bankA = document.getElementById('compareA').value;
    const bankB = document.getElementById('compareB').value;
    const cat = getSelectedCategory(); const idx = getSelectedPeriodIdx(); const prevIdx = idx > 0 ? idx - 1 : idx;
    document.getElementById('thBankA').textContent = bankA; document.getElementById('thBankB').textContent = bankB;
    const aVal = getVal('eur', cat, bankA, idx); const bVal = getVal('eur', cat, bankB, idx);
    const aShare = getVal('pct', cat, bankA, idx); const bShare = getVal('pct', cat, bankB, idx);
    const aSharePrev = getVal('pct', cat, bankA, prevIdx); const bSharePrev = getVal('pct', cat, bankB, prevIdx);
    const aGrowth = (aVal && getVal('eur', cat, bankA, prevIdx)) ? ((aVal / getVal('eur', cat, bankA, prevIdx) - 1) * 100) : null;
    const bGrowth = (bVal && getVal('eur', cat, bankB, prevIdx)) ? ((bVal / getVal('eur', cat, bankB, prevIdx) - 1) * 100) : null;
    const sorted = getSortedBanks(cat, idx); const aRank = sorted.indexOf(bankA) + 1; const bRank = sorted.indexOf(bankB) + 1;
    const kpiData = [
        { label: 'Market Share', aVal: aShare, bVal: bShare, fmt: v => fmtPct(v), gapFmt: v => fmtPP(v) + ' pp', better: 'higher' },
        { label: 'Value (k EUR)', aVal: aVal, bVal: bVal, fmt: v => fmt(v), gapFmt: v => (v > 0 ? '+' : '') + commaFmt(v, 0), better: 'higher' },
        { label: 'Growth Rate', aVal: aGrowth, bVal: bGrowth, fmt: v => v != null ? commaFmt(v, 2) + '%' : '—', gapFmt: v => fmtPP(v) + ' pp', better: 'higher' },
        { label: 'Rank', aVal: aRank, bVal: bRank, fmt: v => '#' + v, gapFmt: v => (v > 0 ? '+' : '') + v, better: 'lower' },
        { label: 'Share Change', aVal: aShare != null && aSharePrev != null ? aShare - aSharePrev : null, bVal: bShare != null && bSharePrev != null ? bShare - bSharePrev : null, fmt: v => fmtPP(v), gapFmt: v => fmtPP(v) + ' pp', better: 'higher' },
    ];
    const kpiContainer = document.getElementById('compareKpis'); kpiContainer.innerHTML = '';
    kpiData.forEach(kpi => {
        const aW = kpi.better === 'higher' ? (kpi.aVal || 0) >= (kpi.bVal || 0) : (kpi.aVal || 0) <= (kpi.bVal || 0);
        const gap = kpi.aVal != null && kpi.bVal != null ? kpi.aVal - kpi.bVal : null;
        const gapClass = gap != null ? (gap > 0 ? (kpi.better === 'higher' ? 'positive' : 'negative') : gap < 0 ? (kpi.better === 'higher' ? 'negative' : 'positive') : '') : '';
        kpiContainer.innerHTML += `<div class="compare-kpi-card"><span class="compare-kpi-label">${kpi.label}</span><div class="compare-kpi-values"><div class="compare-val"><span class="val-label">${bankA}</span><span class="val-num bank-a-color">${kpi.fmt(kpi.aVal)}</span></div><div class="compare-gap ${gapClass}">${gap != null ? kpi.gapFmt(gap) : '—'}</div><div class="compare-val"><span class="val-label">${bankB}</span><span class="val-num bank-b-color">${kpi.fmt(kpi.bVal)}</span></div></div><div style="text-align:center;margin-top:6px"><span class="leader-badge ${aW ? 'leader-a' : 'leader-b'}">${aW ? bankA + ' leads' : bankB + ' leads'}</span></div></div>`;
    });
    const shareGap = aShare != null && bShare != null ? aShare - bShare : null;
    let summaryParts = [];
    if (shareGap != null) { if (shareGap > 0) summaryParts.push(`${bankA} leads ${bankB} by ${Math.abs(shareGap).toFixed(2)}pp in ${cat} market share.`); else if (shareGap < 0) summaryParts.push(`${bankB} leads ${bankA} by ${Math.abs(shareGap).toFixed(2)}pp in ${cat} market share.`); else summaryParts.push(`${bankA} and ${bankB} have equal market share.`); }
    if (aGrowth != null && bGrowth != null) { const fb = aGrowth > bGrowth ? bankA : bankB; summaryParts.push(`${fb} is growing faster at ${Math.max(aGrowth, bGrowth).toFixed(1)}% vs ${Math.min(aGrowth, bGrowth).toFixed(1)}%.`); }
    if (aRank && bRank) summaryParts.push(`${bankA} ranks #${aRank} and ${bankB} ranks #${bRank}.`);
    document.getElementById('compareSummaryText').textContent = summaryParts.join(' ') || 'Select two banks to compare.';
    // Charts
    const aSeries = DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('pct', cat, bankA, i) })).filter(p => p.y != null);
    const bSeries = DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('pct', cat, bankB, i) })).filter(p => p.y != null);
    renderChart('chartCompareTrend', { chart: { type: 'line', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: bankA, data: aSeries }, { name: bankB, data: bSeries }], colors: [NLB_COLOR, '#6b7280'], stroke: { width: [3, 3], curve: 'smooth' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => v ? v.toFixed(2) + '%' : '—' } }, legend: { position: 'top', fontSize: '13px', fontWeight: 600 }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }, markers: { size: 0, hover: { size: 5 } } });
    const segLabels = CATS.map(segLabel); const aSegVals = CATS.map(c => getVal('pct', c, bankA, idx) || 0); const bSegVals = CATS.map(c => getVal('pct', c, bankB, idx) || 0);
    renderChart('chartCompareSegments', { chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: bankA, data: aSegVals }, { name: bankB, data: bSegVals }], colors: [NLB_COLOR, '#9ca3af'], plotOptions: { bar: { borderRadius: 3, columnWidth: '65%' } }, xaxis: { categories: segLabels, labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: true } }, yaxis: { labels: { formatter: v => v.toFixed(0) + '%', style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, legend: { position: 'top', fontSize: '12px', fontWeight: 600 }, tooltip: { y: { formatter: v => v.toFixed(2) + '%' } }, grid: { borderColor: '#f0f0f0' } });
    const aSegEur = CATS.map(c => getVal('eur', c, bankA, idx) || 0); const bSegEur = CATS.map(c => getVal('eur', c, bankB, idx) || 0);
    renderChart('chartCompareBar', { chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: bankA, data: aSegEur }, { name: bankB, data: bSegEur }], colors: [NLB_COLOR, '#9ca3af'], plotOptions: { bar: { borderRadius: 3, columnWidth: '65%' } }, xaxis: { categories: segLabels, labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: true } }, yaxis: { labels: { formatter: v => fmt(v, 0), style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, legend: { position: 'top', fontSize: '12px', fontWeight: 600 }, tooltip: { y: { formatter: v => fmtK(v) + ' k EUR' } }, grid: { borderColor: '#f0f0f0' } });
    const gapData = DATES.map((d, i) => { const a = getVal('pct', cat, bankA, i); const b2 = getVal('pct', cat, bankB, i); return { x: new Date(d).getTime(), y: a != null && b2 != null ? parseFloat((a - b2).toFixed(4)) : null }; }).filter(p => p.y != null);
    renderChart('chartCompareGap', { chart: { type: 'area', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: `Gap (${bankA} − ${bankB})`, data: gapData }], colors: [NLB_COLOR], fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } }, stroke: { width: 2, curve: 'smooth' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { formatter: v => (v > 0 ? '+' : '') + v.toFixed(1) + 'pp', style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => (v > 0 ? '+' : '') + v.toFixed(2) + ' pp' } }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }, annotations: { yaxis: [{ y: 0, borderColor: '#c0392b', strokeDashArray: 0, borderWidth: 1 }] } });
    // Compare table
    const tbody = document.getElementById('compareBody'); tbody.innerHTML = '';
    CATS.forEach(c => { const as = getVal('pct', c, bankA, idx); const bs = getVal('pct', c, bankB, idx); const av = getVal('eur', c, bankA, idx); const bv = getVal('eur', c, bankB, idx); const g = as != null && bs != null ? as - bs : null; const ld = g > 0 ? bankA : g < 0 ? bankB : 'Tie';
        tbody.innerHTML += `<tr><td><strong>${c}</strong></td><td class="${g > 0 ? 'winner-a' : ''}">${fmtPct(as)} <span style="color:var(--text-muted);font-size:0.75rem">(${fmt(av)})</span></td><td class="${g < 0 ? 'winner-b' : ''}">${fmtPct(bs)} <span style="color:var(--text-muted);font-size:0.75rem">(${fmt(bv)})</span></td><td class="${g > 0 ? 'kpi-positive' : g < 0 ? 'kpi-negative' : ''}">${g != null ? fmtPP(g) + ' pp' : '—'}</td><td><span class="leader-badge ${g > 0 ? 'leader-a' : g < 0 ? 'leader-b' : 'leader-tie'}">${ld}</span></td></tr>`; });
}
function quickCompare(bank) { document.getElementById('compareA').value = 'NLB'; document.getElementById('compareB').value = bank; document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); document.querySelector('[data-section="comparison"]').classList.add('active'); document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active')); document.getElementById('sec-comparison').classList.add('active'); updateComparison(); }

// ============================================================
// SECTION 7: SEGMENTS (from v1)
// ============================================================
function updateSegments() {
    const idx = getSelectedPeriodIdx(); const sl = CATS.map(segLabel);
    const nlbShares = CATS.map(c => getVal('pct', c, 'NLB', idx) || 0);
    renderChart('chartSegmentBar', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'NLB Market Share', data: nlbShares }], colors: [NLB_COLOR], plotOptions: { bar: { borderRadius: 5, columnWidth: '55%', dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%', offsetY: -20, style: { fontSize: '12px', fontWeight: 700, colors: [NLB_COLOR] } }, xaxis: { categories: sl, labels: { style: { fontSize: '11px' } } }, yaxis: { labels: { formatter: v => v.toFixed(0) + '%', style: { fontSize: '11px' } }, max: Math.max(...nlbShares) + 5 }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: v => v.toFixed(2) + '%' } }, annotations: { yaxis: [{ y: nlbShares.reduce((a, b) => a + b, 0) / nlbShares.length, borderColor: '#c0392b', strokeDashArray: 4, label: { text: 'Average', style: { background: '#c0392b', color: '#fff', fontSize: '10px' } } }] } });
    const nlbVals = CATS.map(c => getVal('eur', c, 'NLB', idx) || 0); const marketVals = CATS.map(c => (getVal('eur', c, 'Total', idx) || 0) - (getVal('eur', c, 'NLB', idx) || 0));
    renderChart('chartSegmentStack', { chart: { type: 'bar', height: 320, stacked: true, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'NLB', data: nlbVals }, { name: 'Rest of Market', data: marketVals }], colors: [NLB_COLOR, '#e5e7eb'], plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } }, xaxis: { categories: sl, labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: true } }, yaxis: { labels: { formatter: v => fmt(v, 0), style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, legend: { position: 'top', fontSize: '12px' }, tooltip: { y: { formatter: v => fmtK(v) + ' k EUR' } }, grid: { borderColor: '#f0f0f0' } });
    const nlbRanks = CATS.map(c => { const s = getSortedBanks(c, idx); return s.indexOf('NLB') + 1; });
    renderChart('chartSegmentRank', { chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'NLB Rank', data: nlbRanks }], colors: [({ value }) => value <= 2 ? '#0d8a56' : value <= 4 ? '#d68a00' : '#c0392b'], plotOptions: { bar: { borderRadius: 4, columnWidth: '50%', distributed: true, dataLabels: { position: 'center' } } }, dataLabels: { enabled: true, formatter: v => '#' + v, style: { fontSize: '14px', fontWeight: 800, colors: ['#fff'] } }, xaxis: { categories: sl, labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: true } }, yaxis: { reversed: true, min: 0, max: 11, labels: { formatter: v => '#' + v, style: { fontSize: '11px' } } }, legend: { show: false }, tooltip: { y: { formatter: v => 'Rank #' + v } }, grid: { borderColor: '#f0f0f0' } });
}

// ============================================================
// SECTION 8: GROWTH DRIVERS (from v1 with fixes)
// ============================================================
function updateGrowth() {
    const cat = getSelectedCategory(); const idx = getSelectedPeriodIdx(); const prevIdx = idx > 0 ? idx - 1 : null; const topN = getTopN();
    if (prevIdx === null) { document.getElementById('growthInsightText').textContent = 'Growth data requires at least two periods.'; ['chartGrowthRate', 'chartGrowthContrib'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = '<p style="text-align:center;color:#999;padding:60px 0">No prior period available.</p>'; }); return; }
    const totalCur = getVal('eur', cat, 'Total', idx); const totalPrev = getVal('eur', cat, 'Total', prevIdx); const totalMarketGrowth = (totalCur && totalPrev) ? totalCur - totalPrev : 0;
    const growthData = BANKS.map(b => { const cur = getVal('eur', cat, b, idx); const prev = getVal('eur', cat, b, prevIdx); const growth = (cur && prev) ? ((cur / prev - 1) * 100) : null; const absChange = (cur != null && prev != null) ? cur - prev : null; let contribution = null; if (absChange != null && totalMarketGrowth !== 0) { contribution = (absChange / totalMarketGrowth) * 100; if (Math.abs(contribution) > 200) contribution = Math.sign(contribution) * 200; } return { bank: b, growth, absChange, contribution }; }).filter(d => d.growth != null).sort((a, b) => b.growth - a.growth).slice(0, topN);
    renderChart('chartGrowthRate', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Growth %', data: growthData.map(d => ({ x: d.bank, y: parseFloat(d.growth.toFixed(2)) })) }], colors: [({ dataPointIndex }) => { const b = growthData[dataPointIndex]?.bank; return b === 'NLB' ? NLB_COLOR : (growthData[dataPointIndex]?.growth >= 0 ? '#0d8a56' : '#c0392b'); }], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: v => (v > 0 ? '+' : '') + v.toFixed(1) + '%', offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: v => v.toFixed(2) + '%' } } });
    const contribData = [...growthData].sort((a, b) => b.absChange - a.absChange);
    renderChart('chartGrowthContrib', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Change (k EUR)', data: contribData.map(d => ({ x: d.bank, y: Math.round(d.absChange) })) }], colors: [({ dataPointIndex }) => { const b = contribData[dataPointIndex]?.bank; return b === 'NLB' ? NLB_COLOR : (contribData[dataPointIndex]?.absChange >= 0 ? '#6b7280' : '#c0392b'); }], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: v => (v > 0 ? '+' : '') + fmtK(v), offsetX: 30, style: { fontSize: '10px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: v => fmt(v, 0), style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: v => fmtK(v) + ' k EUR' } } });
    const nlbGI = growthData.find(d => d.bank === 'NLB'); const fastest = [...growthData].sort((a, b) => b.growth - a.growth)[0];
    let gInsight = [];
    if (nlbGI) gInsight.push(`NLB grew by ${nlbGI.growth.toFixed(1)}% in ${cat}, with an absolute change of ${fmtK(nlbGI.absChange)} k EUR.`);
    if (fastest && fastest.bank !== 'NLB') gInsight.push(`The fastest growing bank is ${fastest.bank} at ${fastest.growth.toFixed(1)}%.`);
    if (nlbGI && totalMarketGrowth !== 0) { const c = (nlbGI.absChange / totalMarketGrowth * 100); if (totalMarketGrowth > 0) gInsight.push(`NLB contributed ${c.toFixed(1)}% of total market growth.`); else gInsight.push(`Total market declined. NLB accounted for ${Math.abs(c).toFixed(1)}% of the decline.`); }
    document.getElementById('growthInsightText').textContent = gInsight.join(' ') || 'Select a category and period to view growth insights.';
}

// ============================================================
// SECTION 9: SHARE BRIDGE / WATERFALL
// ============================================================
function updateWaterfall() {
    const idx = getSelectedPeriodIdx();
    const prevIdx = idx > 0 ? idx - 1 : idx;

    // Overall NLB assets share change decomposed by segment weight
    // Approach: for each segment, calculate NLB share change × segment weight in total assets
    const segmentCats = ['Corporate Loans', 'Retail Loans', 'Housing Loans', 'Consumer Loans', 'Total Deposits', 'Securities'];
    const nlbAssetsCur = getVal('pct', 'Assets', 'NLB', idx) || 0;
    const nlbAssetsPrev = getVal('pct', 'Assets', 'NLB', prevIdx) || 0;
    const totalChange = nlbAssetsCur - nlbAssetsPrev;

    const bridgeData = segmentCats.map(cat => {
        const curShare = getVal('pct', cat, 'NLB', idx) || 0;
        const prevShare = getVal('pct', cat, 'NLB', prevIdx) || 0;
        const shareChange = curShare - prevShare;
        // Weight = segment total / assets total
        const segTotal = getVal('eur', cat, 'Total', idx) || 0;
        const assetTotal = getVal('eur', 'Assets', 'Total', idx) || 1;
        const weight = segTotal / assetTotal;
        return { cat, shareChange, weight, contribution: shareChange * weight };
    });

    // Waterfall insight
    const posContribs = bridgeData.filter(d => d.contribution > 0).sort((a, b) => b.contribution - a.contribution);
    const negContribs = bridgeData.filter(d => d.contribution < 0).sort((a, b) => a.contribution - b.contribution);
    let wText = `NLB's overall asset market share ${totalChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(totalChange).toFixed(2)}pp.`;
    if (posContribs.length > 0) wText += ` Positive drivers: ${posContribs.map(d => `${segLabel(d.cat)} (+${d.contribution.toFixed(3)}pp)`).join(', ')}.`;
    if (negContribs.length > 0) wText += ` Negative drag: ${negContribs.map(d => `${segLabel(d.cat)} (${d.contribution.toFixed(3)}pp)`).join(', ')}.`;
    document.getElementById('waterfallInsightText').textContent = wText;

    // Waterfall chart (approximation using bar chart)
    const wfLabels = ['Prior Share', ...segmentCats.map(segLabel), 'Current Share'];
    let running = nlbAssetsPrev;
    const wfValues = [nlbAssetsPrev];
    bridgeData.forEach(d => { wfValues.push(d.shareChange); running += d.shareChange; });
    wfValues.push(nlbAssetsCur);

    // Use grouped bar to simulate waterfall
    renderChart('chartWaterfall', {
        chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' },
        series: [{ name: 'Share Change (pp)', data: wfValues.map((v, i) => (i === 0 || i === wfValues.length - 1) ? v : v) }],
        colors: [({ dataPointIndex, value }) => {
            if (dataPointIndex === 0 || dataPointIndex === wfValues.length - 1) return NLB_COLOR;
            return value >= 0 ? '#0d8a56' : '#c0392b';
        }],
        plotOptions: { bar: { borderRadius: 4, columnWidth: '55%', distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: (v, { dataPointIndex }) => (dataPointIndex === 0 || dataPointIndex === wfValues.length - 1) ? v.toFixed(2) + '%' : (v > 0 ? '+' : '') + v.toFixed(3) + 'pp', offsetY: -15, style: { fontSize: '11px', fontWeight: 700, colors: ['#333'] } },
        xaxis: { categories: wfLabels, labels: { style: { fontSize: '10px' }, rotate: -30 } },
        yaxis: { labels: { formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px' } } },
        legend: { show: false }, grid: { borderColor: '#f0f0f0' },
        tooltip: { y: { formatter: (v, { dataPointIndex }) => (dataPointIndex === 0 || dataPointIndex === wfValues.length - 1) ? v.toFixed(2) + '%' : (v > 0 ? '+' : '') + v.toFixed(4) + 'pp' } }
    });

    // Detail table
    document.getElementById('waterfallHead').innerHTML = '<tr><th>Segment</th><th>NLB Share (Current)</th><th>NLB Share (Prior)</th><th>Change (pp)</th><th>Segment Weight</th><th>Weighted Contribution</th></tr>';
    const wb = document.getElementById('waterfallBody'); wb.innerHTML = '';
    bridgeData.forEach(d => {
        const curS = getVal('pct', d.cat, 'NLB', idx); const prevS = getVal('pct', d.cat, 'NLB', prevIdx);
        wb.innerHTML += `<tr><td><strong>${d.cat}</strong></td><td>${fmtPct(curS)}</td><td>${fmtPct(prevS)}</td><td class="${d.shareChange > 0 ? 'kpi-positive' : d.shareChange < 0 ? 'kpi-negative' : ''}">${fmtPP(d.shareChange)}pp</td><td>${(d.weight * 100).toFixed(1)}%</td><td class="${d.contribution > 0 ? 'kpi-positive' : d.contribution < 0 ? 'kpi-negative' : ''}">${d.contribution > 0 ? '+' : ''}${d.contribution.toFixed(4)}pp</td></tr>`;
    });
    wb.innerHTML += `<tr class="pl-bold-row"><td><strong>Total</strong></td><td><strong>${fmtPct(nlbAssetsCur)}</strong></td><td><strong>${fmtPct(nlbAssetsPrev)}</strong></td><td class="${totalChange > 0 ? 'kpi-positive' : totalChange < 0 ? 'kpi-negative' : ''}"><strong>${fmtPP(totalChange)}pp</strong></td><td>—</td><td><strong>${fmtPP(bridgeData.reduce((s, d) => s + d.contribution, 0))}pp</strong></td></tr>`;
}

// ============================================================
// SECTION 10: DEPOSITS & FUNDING DEEP-DIVE
// ============================================================
function updateDeposits() {
    const idx = getSelectedPeriodIdx();
    const prevIdx = idx > 0 ? idx - 1 : idx;
    const prof = D.profitability;

    // KPIs
    const nlbDep = getVal('eur', 'Total Deposits', 'NLB', idx);
    const nlbDepShare = getVal('pct', 'Total Deposits', 'NLB', idx);
    const nlbRetDepShare = getVal('pct', 'Deposits from Retail', 'NLB', idx);
    const nlbCorpDepShare = getVal('pct', 'Deposits from Corporate', 'NLB', idx);
    const intExp = prof?.plItems?.['Interest Expense']?.NLB || 0;
    const depSorted = getSortedBanks('Total Deposits', idx);
    const depRank = depSorted.indexOf('NLB') + 1;

    document.getElementById('depKpiTotal').textContent = fmt(nlbDep);
    document.getElementById('depKpiTotalUnit').textContent = fmtUnit(nlbDep);
    document.getElementById('depKpiShare').textContent = nlbDepShare ? nlbDepShare.toFixed(2) : '—';
    document.getElementById('depKpiRetail').textContent = nlbRetDepShare ? nlbRetDepShare.toFixed(2) : '—';
    document.getElementById('depKpiCorp').textContent = nlbCorpDepShare ? nlbCorpDepShare.toFixed(2) : '—';
    document.getElementById('depKpiIntExp').textContent = commaFmt(Math.abs(intExp), 0);
    document.getElementById('depKpiRank').textContent = '#' + depRank;

    // Insight
    const retailDep = getVal('eur', 'Deposits from Retail', 'NLB', idx) || 0;
    const corpDep = getVal('eur', 'Deposits from Corporate', 'NLB', idx) || 0;
    const retailPct = nlbDep ? (retailDep / nlbDep * 100) : 0;
    let depInsight = `NLB's total deposits are ${fmt(nlbDep)} (${fmtPct(nlbDepShare)} market share, rank #${depRank}). `;
    depInsight += `Retail deposits make up ${retailPct.toFixed(0)}% of NLB's funding base, with a ${fmtPct(nlbRetDepShare)} sector share. `;
    depInsight += `Interest expense is ${commaFmt(Math.abs(intExp), 0)} k EUR. `;
    if (retailPct > 65) depInsight += `Strong CASA-like retail franchise helps contain funding costs. `;
    else depInsight += `Corporate deposit reliance at ${(100 - retailPct).toFixed(0)}% may increase funding cost volatility. `;
    document.getElementById('depositInsightText').textContent = depInsight;

    // Deposit mix donut
    renderChart('chartDepositMix', {
        chart: { type: 'donut', height: 320, fontFamily: 'Inter, sans-serif' },
        series: [retailDep, corpDep], labels: ['Retail Deposits', 'Corporate Deposits'],
        colors: [NLB_COLOR, '#b8a0f0'],
        plotOptions: { pie: { donut: { size: '55%', labels: { show: true, value: { formatter: v => fmt(parseFloat(v)) }, total: { show: true, label: 'Total', formatter: () => fmt(nlbDep) } } } } },
        dataLabels: { enabled: true, formatter: (v) => v.toFixed(1) + '%', style: { fontSize: '12px', fontWeight: 600 } },
        legend: { position: 'bottom', fontSize: '12px' }, stroke: { width: 2, colors: ['#fff'] },
        tooltip: { y: { formatter: v => fmtK(v) + ' k EUR' } }
    });

    // Deposit share by segment bar
    const depCats = ['Total Deposits', 'Deposits from Retail', 'Deposits from Corporate'];
    const depShares = depCats.map(c => getVal('pct', c, 'NLB', idx) || 0);
    renderChart('chartDepositShare', {
        chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif' },
        series: [{ name: 'NLB Share %', data: depShares }], colors: [NLB_COLOR],
        plotOptions: { bar: { borderRadius: 5, columnWidth: '45%', dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%', offsetY: -20, style: { fontSize: '13px', fontWeight: 700, colors: [NLB_COLOR] } },
        xaxis: { categories: ['Total Dep.', 'Retail Dep.', 'Corp. Dep.'], labels: { style: { fontSize: '12px' } } },
        yaxis: { labels: { formatter: v => v.toFixed(0) + '%', style: { fontSize: '11px' } }, max: Math.max(...depShares) + 5 },
        grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: v => v.toFixed(2) + '%' } }
    });

    // Deposit trend NLB
    const depTrendSeries = ['Total Deposits', 'Deposits from Retail', 'Deposits from Corporate'].map(c => ({
        name: segLabel(c), data: DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('eur', c, 'NLB', i) })).filter(p => p.y != null)
    }));
    renderChart('chartDepositTrend', {
        chart: { type: 'line', height: 320, fontFamily: 'Inter, sans-serif' },
        series: depTrendSeries, colors: [NLB_COLOR, '#0d8a56', '#d68a00'],
        stroke: { width: [3, 2, 2], curve: 'smooth' },
        xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
        yaxis: { labels: { formatter: v => fmt(v, 0), style: { fontSize: '11px' } } },
        dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => fmtK(v) + ' k EUR' } },
        legend: { position: 'top', fontSize: '12px' }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }
    });

    // Interest expense bar chart — all banks
    const intExpData = BANKS.map(b => ({ bank: b, val: Math.abs(prof?.plItems?.['Interest Expense']?.[b] || 0) })).sort((a, b) => b.val - a.val);
    renderChart('chartIntExpense', {
        chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' },
        series: [{ name: 'Interest Expense (k EUR)', data: intExpData.map(d => ({ x: d.bank, y: d.val })) }],
        colors: [({ dataPointIndex }) => intExpData[dataPointIndex]?.bank === 'NLB' ? NLB_COLOR : '#6b7280'],
        plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: v => commaFmt(v, 0), offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } },
        xaxis: { labels: { formatter: v => commaFmt(v, 0), style: { fontSize: '11px' } } },
        yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } },
        legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: v => commaFmt(v, 0) + ' k EUR' } }
    });

    // Deposit peer comparison
    const depPeerData = BANKS.map(b => ({ bank: b, val: getVal('pct', 'Total Deposits', b, idx) || 0 })).sort((a, b) => b.val - a.val);
    renderChart('chartDepositPeer', {
        chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' },
        series: [{ name: 'Deposit Share %', data: depPeerData.map(d => ({ x: d.bank, y: d.val })) }],
        colors: [({ dataPointIndex }) => depPeerData[dataPointIndex]?.bank === 'NLB' ? NLB_COLOR : '#6b7280'],
        plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%', offsetX: 30, style: { fontSize: '12px', fontWeight: 700, colors: ['#333'] } },
        xaxis: { labels: { formatter: v => v.toFixed(0) + '%', style: { fontSize: '11px' } } },
        yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } },
        legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: v => v.toFixed(2) + '%' } }
    });
}

// ============================================================
// SECTION 11: PROFITABILITY (from v1)
// ============================================================
function updateProfitability() {
    const prof = D.profitability; if (!prof) return;
    const pl = prof.plItems; const ratios = prof.ratios; const ranks = prof.ranks;
    document.getElementById('kpiNlbNetProfit').textContent = fmt(pl['Net Profit']['NLB']); document.getElementById('kpiNlbProfitUnit').textContent = fmtUnit(pl['Net Profit']['NLB']);
    document.getElementById('kpiSectorNetProfit').textContent = fmt(pl['Net Profit']['Total']); document.getElementById('kpiSectorProfitUnit').textContent = fmtUnit(pl['Net Profit']['Total']);
    document.getElementById('kpiNlbROE').textContent = commaFmt(ratios['ROE']['NLB'], 2); document.getElementById('kpiNlbCIR').textContent = commaFmt(ratios['CIR']['NLB'], 1);
    document.getElementById('kpiNlbProfitRank').textContent = '#' + ranks['Net Profit']['NLB']; document.getElementById('kpiNlbProfitShare').textContent = commaFmt(ratios['Net Profit Market Share']['NLB'], 1);
    const nlbROE = ratios['ROE']['NLB']; const nlbCIR = ratios['CIR']['NLB']; const avgROE = BANKS.reduce((s, b) => s + (ratios['ROE'][b] || 0), 0) / BANKS.length; const avgCIR = BANKS.reduce((s, b) => s + (ratios['CIR'][b] || 0), 0) / BANKS.length;
    let insP = []; insP.push(`NLB reported net profit of ${commaFmt(pl['Net Profit']['NLB'], 0)} k EUR, ranking #${ranks['Net Profit']['NLB']} and capturing ${commaFmt(ratios['Net Profit Market Share']['NLB'], 1)}% of sector profits.`);
    insP.push(`ROE of ${commaFmt(nlbROE, 1)}% ${nlbROE > avgROE ? 'exceeds' : 'trails'} the average of ${commaFmt(avgROE, 1)}%.`);
    insP.push(`CIR at ${commaFmt(nlbCIR, 1)}% is ${nlbCIR < avgCIR ? 'best in class' : 'above average'} — ${nlbCIR < 40 ? 'exceptional' : nlbCIR < 50 ? 'strong' : 'moderate'} efficiency.`);
    document.getElementById('plInsightText').textContent = insP.join(' ');
    // Charts
    const profitData = BANKS.map(b => ({ bank: b, val: pl['Net Profit'][b] || 0 })).sort((a, b) => b.val - a.val);
    renderChart('chartNetProfit', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Net Profit (k EUR)', data: profitData.map(d => ({ x: d.bank, y: Math.round(d.val) })) }], colors: [({ dataPointIndex }) => profitData[dataPointIndex]?.bank === 'NLB' ? NLB_COLOR : (profitData[dataPointIndex]?.val >= 0 ? '#6b7280' : '#c0392b')], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: v => commaFmt(v, 0), offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: v => commaFmt(v, 0), style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: v => commaFmt(v, 0) + ' k EUR' } } });
    const top5 = profitData.filter(d => d.val > 0).slice(0, 6).map(d => d.bank);
    renderChart('chartIncomeStructure', { chart: { type: 'bar', height: 420, stacked: true, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'NII', data: top5.map(b => pl['Net Interest Income'][b] || 0) }, { name: 'NFCI', data: top5.map(b => pl['Net Fee & Commission Income'][b] || 0) }, { name: 'Other', data: top5.map(b => (pl['Total Income'][b] || 0) - (pl['Net Interest Income'][b] || 0) - (pl['Net Fee & Commission Income'][b] || 0)) }], colors: [NLB_COLOR, '#6b7280', '#d4d4e8'], plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } }, xaxis: { categories: top5, labels: { style: { fontSize: '12px', fontWeight: 600 } } }, yaxis: { labels: { formatter: v => commaFmt(v, 0), style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, legend: { position: 'top', fontSize: '12px' }, tooltip: { y: { formatter: v => commaFmt(v, 0) + ' k EUR' } }, grid: { borderColor: '#f0f0f0' } });
    const roeData = BANKS.map(b => ({ bank: b, val: ratios['ROE'][b] || 0 })).sort((a, b) => b.val - a.val);
    renderChart('chartROE', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'ROE %', data: roeData.map(d => ({ x: d.bank, y: d.val })) }], colors: [({ dataPointIndex }) => roeData[dataPointIndex]?.bank === 'NLB' ? NLB_COLOR : (roeData[dataPointIndex]?.val >= 0 ? '#6b7280' : '#c0392b')], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: v => commaFmt(v, 1) + '%', offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: v => v.toFixed(0) + '%', style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: v => commaFmt(v, 2) + '%' } } });
    const cirData = BANKS.map(b => ({ bank: b, val: ratios['CIR'][b] || 0 })).sort((a, b) => a.val - b.val);
    renderChart('chartCIR', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'CIR %', data: cirData.map(d => ({ x: d.bank, y: d.val })) }], colors: [({ dataPointIndex }) => { const b = cirData[dataPointIndex]?.bank; const v = cirData[dataPointIndex]?.val; return b === 'NLB' ? NLB_COLOR : (v <= 50 ? '#0d8a56' : v <= 80 ? '#d68a00' : '#c0392b'); }], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: v => commaFmt(v, 1) + '%', offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: v => v.toFixed(0) + '%', style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: v => commaFmt(v, 2) + '%' } }, annotations: { xaxis: [{ x: 50, borderColor: '#c0392b', strokeDashArray: 4, label: { text: '50%', style: { background: '#c0392b', color: '#fff', fontSize: '10px' } } }] } });
    const roaData = BANKS.map(b => ({ bank: b, val: ratios['ROA'][b] || 0 })).sort((a, b) => b.val - a.val);
    renderChart('chartROA', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'ROA %', data: roaData.map(d => ({ x: d.bank, y: d.val })) }], colors: [({ dataPointIndex }) => roaData[dataPointIndex]?.bank === 'NLB' ? NLB_COLOR : (roaData[dataPointIndex]?.val >= 0 ? '#6b7280' : '#c0392b')], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: v => commaFmt(v, 2) + '%', offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: v => commaFmt(v, 2) + '%' } } });
    const nplData = BANKS.map(b => ({ bank: b, npl: ratios['NPL'][b] || 0, coverage: ratios['Coverage Ratio'][b] || 0 })).sort((a, b) => a.npl - b.npl);
    renderChart('chartNPL', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'NPL %', data: nplData.map(d => d.npl), type: 'bar' }, { name: 'Coverage %', data: nplData.map(d => d.coverage), type: 'line' }], colors: [({ dataPointIndex }) => nplData[dataPointIndex]?.bank === 'NLB' ? NLB_COLOR : '#6b7280', '#0d8a56'], plotOptions: { bar: { borderRadius: 3, columnWidth: '50%' } }, xaxis: { categories: nplData.map(d => d.bank), labels: { style: { fontSize: '12px', fontWeight: 600 } } }, yaxis: [{ title: { text: 'NPL %' }, labels: { formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px' } } }, { opposite: true, title: { text: 'Coverage %' }, labels: { formatter: v => v.toFixed(0) + '%', style: { fontSize: '11px' } } }], dataLabels: { enabled: false }, legend: { position: 'top', fontSize: '12px' }, tooltip: { y: { formatter: v => commaFmt(v, 2) + '%' } }, grid: { borderColor: '#f0f0f0' }, stroke: { width: [0, 3], curve: 'smooth' }, markers: { size: [0, 5] } });
    // P&L Item ranked bar charts
    function plBarChart(chartId, plItemKey, label, sortDesc = true) {
        const itemData = pl[plItemKey]; if (!itemData) return;
        const sorted = BANKS.map(b => ({ bank: b, val: itemData[b] || 0 })).sort((a, b) => sortDesc ? b.val - a.val : a.val - b.val);
        renderChart(chartId, { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: label + ' (k EUR)', data: sorted.map(d => ({ x: d.bank, y: Math.round(d.val) })) }], colors: [({ dataPointIndex }) => sorted[dataPointIndex]?.bank === 'NLB' ? NLB_COLOR : (sorted[dataPointIndex]?.val >= 0 ? '#6b7280' : '#c0392b')], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: v => commaFmt(v, 0), offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: v => commaFmt(v, 0), style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: v => commaFmt(v, 0) + ' k EUR' } } });
    }
    plBarChart('chartInterestIncome', 'Interest Income', 'Interest Income');
    plBarChart('chartInterestExpense', 'Interest Expense', 'Interest Expense', false);
    plBarChart('chartFeeCommIncome', 'Fee & Commission Income', 'Fee & Comm. Income');
    plBarChart('chartFeeCommExpense', 'Fee & Commission Expense', 'Fee & Comm. Expense', false);
    plBarChart('chartNetFeeCommIncome', 'Net Fee & Commission Income', 'Net Fee & Comm. Income');
    plBarChart('chartOpExpenses', 'Operating Expenses', 'Operating Expenses', false);

    // Tables
    const plItems = ['Interest Income', 'Interest Expense', 'Net Interest Income', 'Fee & Commission Income', 'Fee & Commission Expense', 'Net Fee & Commission Income', 'Total Income', 'Operating Expenses', 'Total Impairment', 'Profit Before Tax', 'Net Profit'];
    document.getElementById('plTableHead').innerHTML = `<tr><th>P&L Item</th>${BANKS.map(b => `<th${b === 'NLB' ? ' class="nlb-col"' : ''}>${b}</th>`).join('')}<th>Total</th></tr>`;
    const tb = document.getElementById('plTableBody'); tb.innerHTML = '';
    const boldItems = ['Net Interest Income', 'Total Income', 'Profit Before Tax', 'Net Profit'];
    plItems.forEach(item => { const data = pl[item]; if (!data) return; const isBold = boldItems.includes(item); const isExp = (data['NLB'] || 0) < 0;
        tb.innerHTML += `<tr class="${isBold ? 'pl-bold-row' : ''} ${isExp ? 'pl-expense-row' : ''}"><td><strong>${item}</strong></td>${BANKS.map(b => `<td${b === 'NLB' ? ' class="nlb-col"' : ''}>${data[b] != null ? commaFmt(data[b], 0) : '—'}</td>`).join('')}<td><strong>${data['Total'] != null ? commaFmt(data['Total'], 0) : '—'}</strong></td></tr>`; });
    const ratioItems = ['ROA', 'ROE', 'CIR', 'NPL', 'CAR', 'Coverage Ratio', 'LCR', 'NII to Total Income', 'Net Profit Market Share'];
    const ratioLabels = { 'ROA': 'ROA (%)', 'ROE': 'ROE (%)', 'CIR': 'CIR (%)', 'NPL': 'NPL (%)', 'CAR': 'CAR (%)', 'Coverage Ratio': 'Coverage (%)', 'LCR': 'LCR (%)', 'NII to Total Income': 'NII/Income (%)', 'Net Profit Market Share': 'Profit Share (%)' };
    document.getElementById('ratiosTableHead').innerHTML = `<tr><th>Ratio</th>${BANKS.map(b => `<th${b === 'NLB' ? ' class="nlb-col"' : ''}>${b}</th>`).join('')}</tr>`;
    const rb = document.getElementById('ratiosTableBody'); rb.innerHTML = '';
    ratioItems.forEach(r => { const data = ratios[r]; if (!data) return; const isLB = ['CIR', 'NPL'].includes(r); const vals = BANKS.map(b => ({ b, v: data[b] })).filter(d => d.v != null); const best = isLB ? vals.reduce((m, d) => d.v < m.v ? d : m, vals[0]) : vals.reduce((m, d) => d.v > m.v ? d : m, vals[0]);
        rb.innerHTML += `<tr><td><strong>${ratioLabels[r] || r}</strong></td>${BANKS.map(b => { const v = data[b]; const isBest = best && best.b === b; return `<td class="${b === 'NLB' ? 'nlb-col' : ''} ${isBest ? 'best-ratio' : ''}">${v != null ? commaFmt(v, 2) : '—'}${isBest ? ' ★' : ''}</td>`; }).join('')}</tr>`; });
}

// ============================================================
// SECTION 12: PEER QUADRANTS
// ============================================================
function updateQuadrants() {
    const idx = getSelectedPeriodIdx();
    const prevIdx = idx > 0 ? idx - 1 : idx;
    const prof = D.profitability;
    const ratios = prof?.ratios;
    if (!ratios) return;

    function scatterChart(id, xLabel, yLabel, data, invertX = false) {
        renderChart(id, {
            chart: { type: 'scatter', height: 420, fontFamily: 'Inter, sans-serif', zoom: { enabled: false } },
            series: [{ name: 'Banks', data: data.map(d => ({ x: d.x, y: d.y })) }],
            colors: data.map(d => d.bank === 'NLB' ? NLB_COLOR : '#9ca3af'),
            markers: { size: data.map(d => d.bank === 'NLB' ? 14 : 8) },
            xaxis: { title: { text: xLabel, style: { fontSize: '12px', fontWeight: 600 } }, labels: { formatter: v => v.toFixed(1), style: { fontSize: '10px' } } },
            yaxis: { title: { text: yLabel, style: { fontSize: '12px', fontWeight: 600 } }, labels: { formatter: v => v.toFixed(1), style: { fontSize: '10px' } } },
            dataLabels: { enabled: true, formatter: (v, { dataPointIndex }) => data[dataPointIndex]?.bank || '', style: { fontSize: '10px', fontWeight: 700 }, offsetY: -8 },
            tooltip: { custom: ({ dataPointIndex }) => { const d = data[dataPointIndex]; return `<div style="padding:8px;font-size:12px"><strong>${d.bank}</strong><br>${xLabel}: ${d.x.toFixed(2)}<br>${yLabel}: ${d.y.toFixed(2)}</div>`; } },
            grid: { borderColor: '#f0f0f0' }, legend: { show: false }
        });
    }

    // Quad 1: Market Share vs Growth
    const q1 = BANKS.map(b => {
        const share = getVal('pct', 'Assets', b, idx) || 0;
        const cur = getVal('eur', 'Assets', b, idx); const prev = getVal('eur', 'Assets', b, prevIdx);
        const gr = prev ? ((cur / prev - 1) * 100) : 0;
        return { bank: b, x: share, y: gr };
    });
    scatterChart('chartQuad1', 'Market Share (%)', 'Growth (%)', q1);

    // Quad 2: ROE vs CIR
    const q2 = BANKS.map(b => ({ bank: b, x: ratios['CIR'][b] || 0, y: ratios['ROE'][b] || 0 }));
    scatterChart('chartQuad2', 'CIR (%) — lower is better', 'ROE (%)', q2);

    // Quad 3: NPL vs Coverage
    const q3 = BANKS.map(b => ({ bank: b, x: ratios['NPL'][b] || 0, y: ratios['Coverage Ratio'][b] || 0 }));
    scatterChart('chartQuad3', 'NPL Ratio (%)', 'Coverage Ratio (%)', q3);

    // Quad 4: Deposit Share vs Loan Growth
    const q4 = BANKS.map(b => {
        const depShare = getVal('pct', 'Total Deposits', b, idx) || 0;
        const loanCur = getVal('eur', 'Gross Loans', b, idx); const loanPrev = getVal('eur', 'Gross Loans', b, prevIdx);
        const loanGr = loanPrev ? ((loanCur / loanPrev - 1) * 100) : 0;
        return { bank: b, x: depShare, y: loanGr };
    });
    scatterChart('chartQuad4', 'Deposit Share (%)', 'Loan Growth (%)', q4);
}

// ============================================================
// SECTION 13: OPPORTUNITY SCANNER
// ============================================================
function updateScanner() {
    const idx = getSelectedPeriodIdx();
    const prevIdx = idx > 0 ? idx - 1 : idx;

    const rows = CATS.map(cat => {
        const nlbShare = getVal('pct', cat, 'NLB', idx) || 0;
        const sorted = getSortedBanks(cat, idx);
        const rank = sorted.indexOf('NLB') + 1;
        const leaderShare = getVal('pct', cat, sorted[0], idx) || 0;
        const gap = nlbShare - leaderShare;
        const nlbCur = getVal('eur', cat, 'NLB', idx); const nlbPrev = getVal('eur', cat, 'NLB', prevIdx);
        const nlbGr = nlbPrev ? ((nlbCur / nlbPrev - 1) * 100) : 0;
        const mktCur = getVal('eur', cat, 'Total', idx); const mktPrev = getVal('eur', cat, 'Total', prevIdx);
        const mktGr = mktPrev ? ((mktCur / mktPrev - 1) * 100) : 0;

        // Action logic
        let action, actionClass;
        if (rank <= 2 && nlbGr >= mktGr) { action = 'Defend'; actionClass = 'action-defend'; }
        else if (rank <= 3 && nlbGr > 0 && Math.abs(gap) < 5) { action = 'Attack'; actionClass = 'action-attack'; }
        else if (nlbGr < mktGr && rank > 3) { action = 'Fix'; actionClass = 'action-fix'; }
        else if (nlbGr < 0 && rank > 5) { action = 'Deprioritize'; actionClass = 'action-deprioritize'; }
        else if (nlbGr >= mktGr) { action = 'Attack'; actionClass = 'action-attack'; }
        else { action = 'Fix'; actionClass = 'action-fix'; }

        return { cat, nlbShare, rank, gap, nlbGr, mktGr, action, actionClass };
    });

    const sb = document.getElementById('scannerBody'); sb.innerHTML = '';
    rows.forEach(r => {
        sb.innerHTML += `<tr class="${r.cat === getSelectedCategory() ? 'nlb-row' : ''}"><td><strong>${r.cat}</strong></td><td>${fmtPct(r.nlbShare)}</td><td>#${r.rank}</td><td class="${r.gap >= 0 ? 'kpi-positive' : 'kpi-negative'}">${r.gap >= 0 ? 'Leader' : fmtPP(r.gap) + 'pp'}</td><td class="${r.nlbGr >= 0 ? 'kpi-positive' : 'kpi-negative'}">${(r.nlbGr > 0 ? '+' : '') + r.nlbGr.toFixed(1)}%</td><td>${(r.mktGr > 0 ? '+' : '') + r.mktGr.toFixed(1)}%</td><td><span class="action-label ${r.actionClass}">${r.action}</span></td></tr>`;
    });

    // Insight
    const attackSegs = rows.filter(r => r.action === 'Attack').map(r => r.cat);
    const defendSegs = rows.filter(r => r.action === 'Defend').map(r => r.cat);
    const fixSegs = rows.filter(r => r.action === 'Fix').map(r => r.cat);
    let si = [];
    if (defendSegs.length > 0) si.push(`Defend positions in: ${defendSegs.join(', ')}.`);
    if (attackSegs.length > 0) si.push(`Growth opportunity (Attack) in: ${attackSegs.join(', ')}.`);
    if (fixSegs.length > 0) si.push(`Underperformance requires attention (Fix) in: ${fixSegs.join(', ')}.`);
    document.getElementById('scannerInsightText').textContent = si.join(' ') || 'All segments analyzed.';
}

// ============================================================
// SECTION 14: STRATEGIC INSIGHTS (from v1)
// ============================================================
function updateInsights() {
    const idx = getSelectedPeriodIdx(); const prevIdx = idx > 0 ? idx - 1 : 0; const period = dateLabel(DATES[idx]);
    const assetShare = getVal('pct', 'Assets', 'NLB', idx); const assetRank = getSortedBanks('Assets', idx).indexOf('NLB') + 1;
    const leader = getSortedBanks('Assets', idx)[0]; const leaderShare = getVal('pct', 'Assets', leader, idx); const gap = assetShare - leaderShare;
    document.getElementById('insightPosition').textContent = `NLB holds ${fmtPct(assetShare)} of total banking assets, ranking #${assetRank} as of ${period}. Leader is ${leader} with ${fmtPct(leaderShare)}. NLB trails by ${Math.abs(gap).toFixed(2)}pp. Top 3 control over ${((getVal('pct', 'Assets', getSortedBanks('Assets', idx)[0], idx) || 0) + (getVal('pct', 'Assets', getSortedBanks('Assets', idx)[1], idx) || 0) + (getVal('pct', 'Assets', getSortedBanks('Assets', idx)[2], idx) || 0)).toFixed(0)}% of assets.`;
    const aN = getVal('eur', 'Assets', 'NLB', idx); const aP = getVal('eur', 'Assets', 'NLB', prevIdx); const nlbGr = aP ? ((aN / aP - 1) * 100) : 0;
    const mN = getVal('eur', 'Assets', 'Total', idx); const mP = getVal('eur', 'Assets', 'Total', prevIdx); const mktGr = mP ? ((mN / mP - 1) * 100) : 0;
    document.getElementById('insightGrowth').textContent = `NLB's total assets ${nlbGr >= 0 ? 'grew' : 'declined'} by ${Math.abs(nlbGr).toFixed(1)}%, ${nlbGr > mktGr ? 'outpacing' : 'underperforming'} the market (${mktGr.toFixed(1)}%). ${nlbGr > mktGr ? 'This supports share gains.' : 'Pressure on maintaining share.'}`;
    const fg = BANKS.filter(b => b !== 'NLB').map(b => { const c = getVal('eur', 'Assets', b, idx); const p = getVal('eur', 'Assets', b, prevIdx); return { bank: b, growth: p ? ((c / p - 1) * 100) : 0 }; }).sort((a, b) => b.growth - a.growth);
    document.getElementById('insightThreats').textContent = `Fastest competitor: ${fg[0].bank} (+${fg[0].growth.toFixed(1)}%). ${fg[0].growth > nlbGr ? `${fg[0].bank} outgrowing NLB — potential erosion risk.` : 'NLB currently outpacing competitors.'} Monitor scale advantages of ${leader} and mid-tier expansion.`;
    const lS = getVal('pct', 'Gross Loans', 'NLB', idx); const dS = getVal('pct', 'Total Deposits', 'NLB', idx);
    document.getElementById('insightOpportunities').textContent = `NLB lending share (${fmtPct(lS)}) vs deposit share (${fmtPct(dS)}) suggests ${lS > dS ? 'strong deployment — focus on funding diversification' : 'room to grow loan book against deposit base'}. Housing loans and retail segments offer upside.`;
    const dR = getVal('pct', 'Deposits from Retail', 'NLB', idx); const dC = getVal('pct', 'Deposits from Corporate', 'NLB', idx);
    document.getElementById('insightDeposits').textContent = `Deposit franchise: retail ${fmtPct(dR)}, corporate ${fmtPct(dC)}. ${dR > dC ? 'Retail deposits are the stronger base.' : 'Corporate deposits relatively stronger.'} Low-cost funding stability is critical.`;
    const cL = getVal('pct', 'Corporate Loans', 'NLB', idx); const rL = getVal('pct', 'Retail Loans', 'NLB', idx); const hL = getVal('pct', 'Housing Loans', 'NLB', idx);
    document.getElementById('insightLending').textContent = `Lending: corporate ${fmtPct(cL)}, retail ${fmtPct(rL)}, housing ${fmtPct(hL)}. ${cL > rL ? 'Corporate is stronger — diversify into retail.' : 'Retail well-positioned. Maintain credit quality while growing.'}`;
    // Concentration chart
    const top3D = DATES.map((d, i) => { const s = getSortedBanks('Assets', i); return { x: new Date(d).getTime(), y: s.slice(0, 3).reduce((sum, b) => sum + (getVal('pct', 'Assets', b, i) || 0), 0) }; }).filter(p => p.y > 0);
    renderChart('chartConcentration', { chart: { type: 'area', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Top 3 Share', data: top3D }], colors: ['#6b7280'], fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 } }, stroke: { width: 2, curve: 'smooth' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { formatter: v => v.toFixed(0) + '%', style: { fontSize: '11px' } }, min: 40, max: 70 }, dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => v.toFixed(1) + '%' } }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 } });
}

// ============================================================
// SECTION 15: METHODOLOGY & AUDIT
// ============================================================
function updateMethodology() {
    const idx = getSelectedPeriodIdx();
    const cat = getSelectedCategory();
    const checks = [];

    // Check 1: Sum of bank shares ≈ 100%
    const shareSum = BANKS.reduce((s, b) => s + (getVal('pct', cat, b, idx) || 0), 0);
    checks.push({ check: `Sum of ${cat} shares = 100%`, expected: '100.00%', actual: shareSum.toFixed(2) + '%', pass: Math.abs(shareSum - 100) < 1 });

    // Check 2: Sum of bank values ≈ Total row
    const valSum = BANKS.reduce((s, b) => s + (getVal('eur', cat, b, idx) || 0), 0);
    const total = getVal('eur', cat, 'Total', idx) || 0;
    checks.push({ check: `Sum of bank values = Total row (${cat})`, expected: fmtK(total), actual: fmtK(valSum), pass: Math.abs(valSum - total) / (total || 1) < 0.01 });

    // Check 3: NLB share = NLB value / Total × 100
    const nlbVal = getVal('eur', cat, 'NLB', idx) || 0;
    const calcShare = total ? (nlbVal / total * 100) : 0;
    const dataShare = getVal('pct', cat, 'NLB', idx) || 0;
    checks.push({ check: 'NLB share recalculation', expected: calcShare.toFixed(2) + '%', actual: dataShare.toFixed(2) + '%', pass: Math.abs(calcShare - dataShare) < 0.5 });

    // Check 4: Growth contribution sum ≈ 100% (if not first period)
    if (idx > 0) {
        const prevIdx = idx - 1;
        const tCur = getVal('eur', cat, 'Total', idx); const tPrev = getVal('eur', cat, 'Total', prevIdx);
        const tGrowth = tCur - tPrev;
        if (Math.abs(tGrowth) > 0) {
            const contribSum = BANKS.reduce((s, b) => {
                const c = getVal('eur', cat, b, idx); const p = getVal('eur', cat, b, prevIdx);
                return s + ((c != null && p != null) ? (c - p) : 0);
            }, 0);
            checks.push({ check: 'Growth contribution sum = Total growth', expected: fmtK(tGrowth), actual: fmtK(contribSum), pass: Math.abs(contribSum - tGrowth) / (Math.abs(tGrowth) || 1) < 0.01 });
        }
    }

    // Check 5: Ranking consistency
    const sorted = getSortedBanks(cat, idx);
    const s1 = getVal('pct', cat, sorted[0], idx) || 0;
    const s2 = getVal('pct', cat, sorted[1], idx) || 0;
    checks.push({ check: '#1 share > #2 share', expected: 'True', actual: s1 >= s2 ? 'True' : 'False', pass: s1 >= s2 });

    const ab = document.getElementById('auditBody'); ab.innerHTML = '';
    checks.forEach(c => {
        ab.innerHTML += `<tr><td>${c.check}</td><td>${c.expected}</td><td>${c.actual}</td><td class="${c.pass ? 'audit-pass' : 'audit-fail'}">${c.pass ? '✓ PASS' : '✗ FAIL'}</td></tr>`;
    });
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', init);
