/* ============================================================
   KOSOVO BANKING SYSTEM - MANAGEMENT DECISION COCKPIT v2 DRAFT
   Full interactive dashboard with NLB-centric logic + enhancements
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
function commaFmt(v, decimals) {
    if (decimals === undefined) decimals = 2;
    if (v == null || isNaN(v)) return '\u2014';
    return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmt(v, decimals) {
    if (decimals === undefined) decimals = 1;
    if (v == null || isNaN(v)) return '\u2014';
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
function fmtK(v) { if (v == null) return '\u2014'; return Math.round(v).toLocaleString('en-US'); }
function fmtPct(v, d) { if (d === undefined) d = 2; return v != null ? commaFmt(v, d) + '%' : '\u2014'; }
function fmtPP(v) { if (v == null) return '\u2014'; var sign = v > 0 ? '+' : ''; return sign + commaFmt(v, 2); }
function dateLabel(d) { var dt = new Date(d); var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return m[dt.getMonth()] + ' ' + dt.getFullYear(); }
function shortDate(d) { var dt = new Date(d); var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return m[dt.getMonth()] + "'" + String(dt.getFullYear()).slice(2); }
function getSelectedCategory() { return document.getElementById('filterCategory').value; }
function getSelectedPeriodIdx() { return parseInt(document.getElementById('filterPeriod').value); }
function getTopN() { return parseInt(document.getElementById('filterTopN').value); }
function getVal(sheet, cat, bank, idx) { var arr = D[sheet] && D[sheet][cat] && D[sheet][cat][bank]; if (!arr) return null; return arr[idx]; }
function getSortedBanks(cat, idx, sheet) {
    if (!sheet) sheet = 'pct';
    return BANKS.filter(function(b) { return getVal(sheet, cat, b, idx) != null; }).sort(function(a, b) { return (getVal(sheet, cat, b, idx) || 0) - (getVal(sheet, cat, a, idx) || 0); });
}

function destroyChart(id) { if (CHART_INSTANCES[id]) { CHART_INSTANCES[id].destroy(); delete CHART_INSTANCES[id]; } }

function renderChart(id, options) {
    destroyChart(id);
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    if (!options.chart) options.chart = {};
    options.chart.toolbar = { show: true, tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false }, export: { png: { filename: 'KBS_' + id }, svg: { filename: 'KBS_' + id } } };
    var chart = new ApexCharts(el, options);
    chart.render();
    CHART_INSTANCES[id] = chart;
}

function downloadTableAsImage(tableId, filename) {
    var table = document.getElementById(tableId);
    if (!table) return;
    var card = table.closest('.chart-card');
    if (!card) return;
    html2canvas(card, { backgroundColor: '#ffffff', scale: 2, logging: false, useCORS: true }).then(function(canvas) {
        var link = document.createElement('a');
        link.download = (filename || tableId) + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

function segLabel(c) { return c.replace('Deposits from ', 'Dep. ').replace('Corporate', 'Corp.').replace('Consumer', 'Cons.').replace('Housing', 'Hous.').replace('Gross ', ''); }

function setTextIfExists(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
function setHTMLIfExists(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

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
    var periodSelect = document.getElementById('filterPeriod');
    DATES.forEach(function(d, i) { var opt = document.createElement('option'); opt.value = i; opt.textContent = dateLabel(d); if (i === DATES.length - 1) opt.selected = true; periodSelect.appendChild(opt); });
}

function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            document.querySelectorAll('.dashboard-section').forEach(function(s) { s.classList.remove('active'); });
            document.getElementById('sec-' + btn.dataset.section).classList.add('active');
            updateActiveSection(btn.dataset.section);
        });
    });
}

function setupComparisonSelectors() {
    var selA = document.getElementById('compareA');
    var selB = document.getElementById('compareB');
    selA.innerHTML = ''; selB.innerHTML = '';
    BANKS.forEach(function(b) { selA.appendChild(new Option(b + ' - ' + (D.bankFullNames[b] || b), b)); selB.appendChild(new Option(b + ' - ' + (D.bankFullNames[b] || b), b)); });
    selA.value = 'NLB'; selB.value = 'RBKO';
}

function updateActiveSection(section) {
    var sectionMap = { comparison: updateComparison, trends: updateTrends, competitive: updateCompetitive, segments: updateSegments, growth: updateGrowth, profitability: updateProfitability, insights: updateInsights, ceo: updateCEOPanel, gap: updateGapMomentum, waterfall: updateWaterfall, deposits: updateDeposits, quadrants: updateQuadrants, scanner: updateScanner, methodology: updateMethodology };
    if (sectionMap[section]) sectionMap[section]();
}

// ============================================================
// SECTION 1: EXECUTIVE OVERVIEW (enhanced with Executive Commentary)
// ============================================================
function updateDashboard() {
    var cat = getSelectedCategory();
    var idx = getSelectedPeriodIdx();
    var prevIdx = idx > 0 ? idx - 1 : null;
    var topN = getTopN();
    var period = dateLabel(DATES[idx]);

    document.getElementById('overviewSubtitle').textContent = 'Kosovo Banking System \u2014 ' + cat + ' at ' + period;
    document.getElementById('rankingTitle').textContent = cat;

    var totalVal = getVal('eur', cat, 'Total', idx);
    var nlbVal = getVal('eur', cat, 'NLB', idx);
    var nlbShare = getVal('pct', cat, 'NLB', idx);
    var nlbSharePrev = prevIdx != null ? getVal('pct', cat, 'NLB', prevIdx) : null;
    var shareChange = (nlbShare != null && nlbSharePrev != null) ? nlbShare - nlbSharePrev : null;
    var sorted = getSortedBanks(cat, idx);
    var nlbRank = sorted.indexOf('NLB') + 1;
    var leaderShare = getVal('pct', cat, sorted[0], idx);
    var gapToLeader = (nlbShare != null && leaderShare != null) ? nlbShare - leaderShare : null;

    document.getElementById('kpiMarketSize').textContent = fmt(totalVal);
    document.getElementById('kpiMarketUnit').textContent = fmtUnit(totalVal);
    document.getElementById('kpiNlbValue').textContent = fmt(nlbVal);
    document.getElementById('kpiNlbUnit').textContent = fmtUnit(nlbVal);
    document.getElementById('kpiNlbShare').textContent = nlbShare != null ? nlbShare.toFixed(2) : '\u2014';

    var scEl = document.getElementById('kpiShareChange');
    scEl.textContent = fmtPP(shareChange);
    scEl.className = 'kpi-value ' + (shareChange > 0 ? 'kpi-positive' : shareChange < 0 ? 'kpi-negative' : '');
    document.getElementById('kpiNlbRank').textContent = '#' + nlbRank;
    document.getElementById('kpiGapLeader').textContent = sorted[0] === 'NLB' ? 'Leader' : fmtPP(gapToLeader);

    var insightParts = [];
    if (nlbShare != null) insightParts.push('NLB holds a ' + nlbShare.toFixed(2) + '% market share in ' + cat + ', ranking #' + nlbRank + ' among ' + sorted.length + ' banks.');
    if (shareChange != null && shareChange !== 0) insightParts.push('NLB ' + (shareChange > 0 ? 'gained' : 'lost') + ' ' + Math.abs(shareChange).toFixed(2) + 'pp compared to the previous period.');
    if (sorted[0] !== 'NLB' && gapToLeader != null) insightParts.push('The gap to market leader ' + sorted[0] + ' is ' + Math.abs(gapToLeader).toFixed(2) + 'pp.');
    document.getElementById('overviewInsightText').textContent = insightParts.join(' ') || 'Select a category and period to view insights.';

    // === ENHANCEMENT: Executive Commentary ===
    var nlbValPrev = prevIdx != null ? getVal('eur', cat, 'NLB', prevIdx) : null;
    var nlbGrowth = (nlbVal && nlbValPrev) ? ((nlbVal / nlbValPrev - 1) * 100) : null;
    var leader = sorted[0];

    var whatHappened = '';
    if (nlbShare != null) {
        whatHappened = 'NLB\'s ' + cat + ' market share stands at ' + nlbShare.toFixed(2) + '%, ranking #' + nlbRank + ' in the sector.';
        if (shareChange != null && shareChange !== 0) {
            whatHappened += ' Share ' + (shareChange > 0 ? 'increased' : 'decreased') + ' by ' + Math.abs(shareChange).toFixed(2) + 'pp versus the prior period.';
        }
        if (nlbGrowth != null) {
            whatHappened += ' NLB\'s ' + cat + ' value ' + (nlbGrowth >= 0 ? 'grew' : 'declined') + ' by ' + Math.abs(nlbGrowth).toFixed(1) + '%.';
        }
    }
    setTextIfExists('execWhatHappened', whatHappened || 'Data loading...');

    var whyMatters = '';
    if (nlbRank === 1) {
        whyMatters = 'NLB leads the market in ' + cat + '. Maintaining this position is critical for pricing power and franchise value.';
        if (shareChange != null && shareChange < 0) whyMatters += ' However, the recent share decline signals competitive pressure from challengers.';
    } else if (gapToLeader != null) {
        whyMatters = 'NLB trails ' + leader + ' by ' + Math.abs(gapToLeader).toFixed(2) + 'pp. ';
        if (Math.abs(gapToLeader) < 3) whyMatters += 'The gap is narrow enough to close within 2-3 quarters with focused execution.';
        else if (Math.abs(gapToLeader) < 8) whyMatters += 'This is a meaningful gap that requires sustained above-market growth to close.';
        else whyMatters += 'This is a structural gap \u2014 NLB should focus on profitable niches rather than chasing overall leadership.';
        if (shareChange != null && shareChange < 0) whyMatters += ' The gap is widening, increasing competitive distance.';
    }
    setTextIfExists('execWhyMatters', whyMatters || 'Select a category to see strategic context.');

    var whatNext = '';
    if (nlbRank === 1 && shareChange != null && shareChange >= 0) {
        whatNext = 'Defend: Protect market leadership through customer retention, pricing discipline, and product innovation. Monitor challenger growth closely.';
    } else if (nlbRank === 1 && shareChange != null && shareChange < 0) {
        whatNext = 'Urgent defend: Leadership position is eroding. Identify sources of share loss and launch targeted retention. Review competitive pricing.';
    } else if (shareChange != null && shareChange > 0) {
        whatNext = 'Accelerate: Momentum is positive. Double down on what is working \u2014 analyze which segments drive the gain and allocate resources accordingly.';
    } else if (shareChange != null && shareChange < 0 && gapToLeader != null && Math.abs(gapToLeader) < 5) {
        whatNext = 'Attack: Despite recent share loss, the gap to #1 is still closable. Intensify commercial efforts and consider targeted campaigns in high-growth segments.';
    } else if (shareChange != null && shareChange < 0) {
        whatNext = 'Stabilize and fix: Arrest the share decline first. Diagnose root causes (pricing, distribution, product gaps) before attempting to grow.';
    } else {
        whatNext = 'Monitor: Track competitive dynamics and identify the highest-ROI segments for focused growth.';
    }
    setTextIfExists('execWhatNext', whatNext);

    renderPieChart(cat, idx, topN);
    renderNlbTrendChart(cat);
    renderRankingTable(cat, idx, prevIdx != null ? prevIdx : idx, topN);

    var activeNav = document.querySelector('.nav-btn.active');
    if (activeNav) updateActiveSection(activeNav.dataset.section);
}

function renderPieChart(cat, idx, topN) {
    var sorted = getSortedBanks(cat, idx);
    var banks = sorted.slice(0, topN);
    var values = banks.map(function(b) { return getVal('pct', cat, b, idx) || 0; });
    document.getElementById('pieSubtitle').textContent = dateLabel(DATES[idx]);
    renderChart('chartPie', {
        chart: { type: 'donut', height: 320, fontFamily: 'Inter, sans-serif' },
        series: values, labels: banks, colors: banks.map(function(b) { return BANK_COLORS[b]; }),
        plotOptions: { pie: { donut: { size: '58%', labels: { show: true, name: { fontSize: '14px', fontWeight: 700 }, value: { fontSize: '18px', fontWeight: 700, formatter: function(v) { return parseFloat(v).toFixed(1) + '%'; } }, total: { show: true, label: 'NLB', fontSize: '13px', formatter: function() { return (getVal('pct', cat, 'NLB', idx) || 0).toFixed(1) + '%'; } } } } } },
        dataLabels: { enabled: false }, legend: { position: 'bottom', fontSize: '12px', fontWeight: 500, markers: { width: 10, height: 10, radius: 3 } },
        stroke: { width: 2, colors: ['#fff'] }, tooltip: { y: { formatter: function(v) { return v.toFixed(2) + '%'; } } }
    });
}

function renderNlbTrendChart(cat) {
    var nlbData = DATES.map(function(d, i) { return { x: new Date(d).getTime(), y: getVal('pct', cat, 'NLB', i) }; }).filter(function(p) { return p.y != null; });
    renderChart('chartNlbTrend', {
        chart: { type: 'area', height: 320, fontFamily: 'Inter, sans-serif', zoom: { enabled: false } },
        series: [{ name: 'NLB Market Share', data: nlbData }], colors: [NLB_COLOR],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 100] } },
        stroke: { width: 3, curve: 'smooth' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '11px' } } },
        yaxis: { labels: { formatter: function(v) { return v.toFixed(1) + '%'; }, style: { fontSize: '11px' } } }, dataLabels: { enabled: false },
        tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return v.toFixed(2) + '%'; } } }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 },
        annotations: { yaxis: nlbData.length > 0 ? [{ y: nlbData[nlbData.length - 1].y, borderColor: NLB_COLOR, strokeDashArray: 4, label: { text: 'Current: ' + nlbData[nlbData.length - 1].y.toFixed(2) + '%', style: { background: NLB_COLOR, color: '#fff', fontSize: '11px', padding: { left: 8, right: 8, top: 3, bottom: 3 } } } }] : [] }
    });
}

function renderRankingTable(cat, idx, prevIdx, topN) {
    var sorted = getSortedBanks(cat, idx);
    var banks = sorted.slice(0, topN);
    var tbody = document.getElementById('rankingBody');
    tbody.innerHTML = '';
    var maxShare = getVal('pct', cat, banks[0], idx) || 1;
    banks.forEach(function(b, i) {
        var val = getVal('eur', cat, b, idx);
        var share = getVal('pct', cat, b, idx);
        var prevShare = getVal('pct', cat, b, prevIdx);
        var change = (share != null && prevShare != null) ? share - prevShare : null;
        var isNLB = b === 'NLB';
        var barWidth = share != null ? (share / maxShare * 100) : 0;
        var tr = document.createElement('tr');
        if (isNLB) tr.classList.add('nlb-row');
        tr.innerHTML = '<td><strong>#' + (i + 1) + '</strong></td><td><strong>' + b + '</strong> <span style="color:var(--text-muted);font-size:0.75rem">' + (D.bankFullNames[b] || '') + '</span></td><td>' + fmtK(val) + '</td><td><strong>' + fmtPct(share) + '</strong></td><td class="' + (change > 0 ? 'kpi-positive' : change < 0 ? 'kpi-negative' : '') + '">' + fmtPP(change) + ' pp</td><td><div class="share-bar-wrapper"><div class="share-bar ' + (isNLB ? 'nlb' : '') + '" style="width:' + barWidth + '%;background:' + BANK_COLORS[b] + '"></div></div></td>';
        tbody.appendChild(tr);
    });
}


// ============================================================
// SECTION 2: CEO ACTION PANEL (enhanced with Risk of Inaction)
// ============================================================
function updateCEOPanel() {
    var cat = getSelectedCategory();
    var idx = getSelectedPeriodIdx();
    var prevIdx = idx > 0 ? idx - 1 : null;
    var prev3Idx = idx >= 3 ? idx - 3 : null;
    var prof = D.profitability;
    var nlbROE = (prof && prof.ratios && prof.ratios.ROE) ? prof.ratios.ROE.NLB || 0 : 0;
    var nlbCIR = (prof && prof.ratios && prof.ratios.CIR) ? prof.ratios.CIR.NLB || 0 : 0;
    var nlbNPL = (prof && prof.ratios && prof.ratios.NPL) ? prof.ratios.NPL.NLB || 0 : 0;
    var nlbCAR = (prof && prof.ratios && prof.ratios.CAR) ? prof.ratios.CAR.NLB || 0 : 0;
    var nlbLCR = (prof && prof.ratios && prof.ratios.LCR) ? prof.ratios.LCR.NLB || 0 : 0;

    var nlbShare = getVal('pct', cat, 'NLB', idx) || 0;
    var nlbVal = getVal('eur', cat, 'NLB', idx) || 0;
    var sorted = getSortedBanks(cat, idx);
    var nlbRank = sorted.indexOf('NLB') + 1;
    var leader = sorted[0];
    var leaderShare = getVal('pct', cat, leader, idx) || 0;
    var gap = nlbShare - leaderShare;

    var nlbSharePrev = prevIdx != null ? (getVal('pct', cat, 'NLB', prevIdx) || 0) : null;
    var nlbValPrev = prevIdx != null ? (getVal('eur', cat, 'NLB', prevIdx) || 0) : null;
    var sc = nlbSharePrev != null ? nlbShare - nlbSharePrev : 0;
    var nlbGr = nlbValPrev ? ((nlbVal / nlbValPrev - 1) * 100) : 0;
    var prevSorted = prevIdx != null ? getSortedBanks(cat, prevIdx) : [];
    var nlbRankPrev = prevSorted.indexOf('NLB') + 1;
    var rankChange = nlbRankPrev > 0 ? nlbRankPrev - nlbRank : 0;

    var nlbShare3 = prev3Idx != null ? (getVal('pct', cat, 'NLB', prev3Idx) || 0) : null;
    var nlbVal3 = prev3Idx != null ? (getVal('eur', cat, 'NLB', prev3Idx) || 0) : null;
    var sc3 = nlbShare3 != null ? nlbShare - nlbShare3 : null;
    var nlbGr3 = nlbVal3 ? ((nlbVal / nlbVal3 - 1) * 100) : null;

    var bankDynamics = BANKS.map(function(b) {
        var cur = getVal('eur', cat, b, idx) || 0;
        var prev = prevIdx != null ? (getVal('eur', cat, b, prevIdx) || 0) : 0;
        var shareCur = getVal('pct', cat, b, idx) || 0;
        var sharePrev = prevIdx != null ? (getVal('pct', cat, b, prevIdx) || 0) : 0;
        var gr = prev ? ((cur / prev - 1) * 100) : 0;
        return { bank: b, val: cur, growth: gr, share: shareCur, shareChange: shareCur - sharePrev };
    });
    var fastestComp = bankDynamics.filter(function(d) { return d.bank !== 'NLB'; }).sort(function(a, b) { return b.growth - a.growth; })[0];
    var biggestGainer = bankDynamics.filter(function(d) { return d.bank !== 'NLB'; }).sort(function(a, b) { return b.shareChange - a.shareChange; })[0];

    var segCats = ['Gross Loans', 'Corporate Loans', 'Retail Loans', 'Housing Loans', 'Consumer Loans', 'Total Deposits', 'Deposits from Corporate', 'Deposits from Retail', 'Deposits CA', 'Deposits Saving', 'Deposits TDA'];
    var segPerf = segCats.map(function(c) {
        var sh = getVal('pct', c, 'NLB', idx);
        var shPrev = prevIdx != null ? getVal('pct', c, 'NLB', prevIdx) : null;
        var chg = sh != null && shPrev != null ? sh - shPrev : null;
        var segSorted = getSortedBanks(c, idx);
        var rk = segSorted.indexOf('NLB') + 1;
        return { cat: c, share: sh, change: chg, rank: rk };
    }).filter(function(s) { return s.share != null; });
    var bestSeg = segPerf.slice().sort(function(a, b) { return (b.share || 0) - (a.share || 0); })[0];
    var worstSeg = segPerf.slice().sort(function(a, b) { return (a.share || 0) - (b.share || 0); })[0];
    var mostImproved = segPerf.filter(function(s) { return s.change != null; }).sort(function(a, b) { return (b.change || 0) - (a.change || 0); })[0];
    var mostDeclined = segPerf.filter(function(s) { return s.change != null; }).sort(function(a, b) { return (a.change || 0) - (b.change || 0); })[0];

    // ===== POSITIVES =====
    var positives = [];
    if (nlbRank === 1) {
        positives.push('NLB is market leader in ' + cat + ' with ' + nlbShare.toFixed(2) + '% share' + (sc !== 0 ? ' (' + (sc > 0 ? '+' : '') + sc.toFixed(2) + 'pp MoM)' : '') + ' \u2014 #1 position.');
    } else if (sc > 0) {
        positives.push(cat + ' share gained ' + sc.toFixed(2) + 'pp MoM to ' + nlbShare.toFixed(2) + '% (rank #' + nlbRank + ')' + (rankChange > 0 ? ' \u2014 climbed ' + rankChange + ' position(s)' : '') + '.' + (nlbGr > 0 ? ' Value grew ' + nlbGr.toFixed(1) + '% vs prior period.' : ''));
    } else if (nlbRank <= 3) {
        positives.push('Strong #' + nlbRank + ' position in ' + cat + ' at ' + nlbShare.toFixed(2) + '% share.' + (sc3 != null && sc3 > 0 ? ' Gained ' + sc3.toFixed(2) + 'pp over last 3 periods.' : '') + (nlbGr > 0 ? ' Value grew ' + nlbGr.toFixed(1) + '% MoM.' : ''));
    }

    var nlbNetProfit = (prof && prof.plItems && prof.plItems['Net Profit']) ? prof.plItems['Net Profit'].NLB || 0 : 0;
    var nlbProfitRank = (prof && prof.ranks && prof.ranks['Net Profit']) ? prof.ranks['Net Profit'].NLB || 0 : 0;
    var nlbProfitShare = (prof && prof.ratios && prof.ratios['Net Profit Market Share']) ? prof.ratios['Net Profit Market Share'].NLB || 0 : 0;
    var npPct = D.pct ? D.pct['Net Profit'] : null;
    var npHistShare = npPct && npPct.NLB ? npPct.NLB[idx] : null;
    var npHistSharePrev = prevIdx != null && npPct && npPct.NLB ? npPct.NLB[prevIdx] : null;
    var npShareChg = npHistShare != null && npHistSharePrev != null ? npHistShare - npHistSharePrev : null;
    if (nlbProfitRank <= 2) {
        var msg = '#' + nlbProfitRank + ' in Net Profit \u2014 ' + commaFmt(nlbNetProfit, 0) + ' k EUR (' + nlbProfitShare.toFixed(1) + '% of sector)';
        if (npShareChg != null && npShareChg !== 0) msg += '. Profit share ' + (npShareChg > 0 ? 'up' : 'down') + ' ' + Math.abs(npShareChg).toFixed(1) + 'pp vs prior month';
        msg += '.';
        positives.push(msg);
    } else {
        positives.push('Net profit ' + commaFmt(nlbNetProfit, 0) + ' k EUR, rank #' + nlbProfitRank + '. Profit share ' + nlbProfitShare.toFixed(1) + '%' + (npShareChg != null ? ' (' + (npShareChg > 0 ? '+' : '') + npShareChg.toFixed(1) + 'pp MoM)' : '') + '.');
    }

    var avgROE = BANKS.reduce(function(s, b) { return s + ((prof && prof.ratios && prof.ratios.ROE) ? prof.ratios.ROE[b] || 0 : 0); }, 0) / BANKS.length;
    var avgCIR = BANKS.reduce(function(s, b) { return s + ((prof && prof.ratios && prof.ratios.CIR) ? prof.ratios.CIR[b] || 0 : 0); }, 0) / BANKS.length;
    if (nlbCIR < avgCIR) {
        positives.push('CIR ' + nlbCIR.toFixed(1) + '% \u2014 ' + (avgCIR - nlbCIR).toFixed(1) + 'pp better than sector avg (' + avgCIR.toFixed(1) + '%). ' + (nlbCIR < 35 ? 'Best-in-class efficiency.' : 'Strong cost discipline.') + ' ROE ' + nlbROE.toFixed(1) + '% ' + (nlbROE > avgROE ? 'exceeds' : 'trails') + ' avg ' + avgROE.toFixed(1) + '%.');
    } else if (nlbROE > avgROE) {
        positives.push('ROE ' + nlbROE.toFixed(1) + '% outperforms sector avg of ' + avgROE.toFixed(1) + '% \u2014 strong shareholder returns despite CIR of ' + nlbCIR.toFixed(1) + '%.');
    }
    if (bestSeg && bestSeg.share > 20) {
        positives.push('Strongest segment: ' + bestSeg.cat + ' at ' + bestSeg.share.toFixed(1) + '% (rank #' + bestSeg.rank + ')' + (bestSeg.change != null && bestSeg.change !== 0 ? ', ' + (bestSeg.change > 0 ? '+' : '') + bestSeg.change.toFixed(2) + 'pp MoM' : '') + '.');
    }
    if (mostImproved && mostImproved.change > 0 && (!bestSeg || mostImproved.cat !== bestSeg.cat)) {
        positives.push('Fastest improving segment: ' + mostImproved.cat + ' gained ' + mostImproved.change.toFixed(2) + 'pp to ' + mostImproved.share.toFixed(1) + '% share.');
    }
    if (nlbNPL < 2) positives.push('NPL ratio ' + nlbNPL.toFixed(2) + '% \u2014 excellent asset quality. CAR ' + nlbCAR.toFixed(1) + '% provides strong capital buffer.');
    if (nlbLCR > 400) positives.push('LCR at ' + nlbLCR.toFixed(0) + '% \u2014 very strong liquidity position, well above regulatory minimums.');

    var mktVal = getVal('eur', cat, 'Total', idx) || 0;
    var mktValPrev = prevIdx != null ? (getVal('eur', cat, 'Total', prevIdx) || 0) : 0;
    var mktGr = mktValPrev ? ((mktVal / mktValPrev - 1) * 100) : 0;
    if (nlbGr > mktGr + 0.5 && nlbGr > 0) positives.push('NLB growing faster (' + nlbGr.toFixed(1) + '%) than market (' + mktGr.toFixed(1) + '%) in ' + cat + ' \u2014 gaining organic share.');

    setHTMLIfExists('ceoPositives', positives.slice(0, 3).map(function(p) { return '<li>' + p + '</li>'; }).join(''));

    // ===== RISKS =====
    var risks = [];
    if (sc < 0) {
        var erosionMsg = cat + ' share lost ' + Math.abs(sc).toFixed(2) + 'pp MoM (' + nlbSharePrev.toFixed(2) + '% \u2192 ' + nlbShare.toFixed(2) + '%)';
        if (sc3 != null && sc3 < 0) erosionMsg += '. Persistent decline: ' + Math.abs(sc3).toFixed(2) + 'pp over last 3 periods';
        erosionMsg += '.';
        risks.push(erosionMsg);
    }
    if (fastestComp && fastestComp.growth > nlbGr + 1) {
        risks.push(fastestComp.bank + ' outpacing NLB in ' + cat + ': +' + fastestComp.growth.toFixed(1) + '% vs NLB +' + nlbGr.toFixed(1) + '%. ' + (biggestGainer && biggestGainer.shareChange > 0 ? biggestGainer.bank + ' gained ' + biggestGainer.shareChange.toFixed(2) + 'pp share.' : ''));
    }
    if (gap < 0 && leader !== 'NLB') {
        var gapPrev = prevIdx != null ? (nlbSharePrev - (getVal('pct', cat, leader, prevIdx) || 0)) : null;
        var gapTrend = gapPrev != null ? gap - gapPrev : null;
        risks.push('Gap to leader ' + leader + ': ' + Math.abs(gap).toFixed(2) + 'pp' + (gapTrend != null ? (gapTrend < 0 ? ' (widening by ' + Math.abs(gapTrend).toFixed(2) + 'pp)' : gapTrend > 0 ? ' (narrowing by ' + gapTrend.toFixed(2) + 'pp)' : ' (stable)') : '') + '.');
    }
    if (rankChange < 0) risks.push('Rank dropped ' + Math.abs(rankChange) + ' position(s) in ' + cat + ' (#' + nlbRankPrev + ' \u2192 #' + nlbRank + ') \u2014 competitive pressure intensifying.');
    if (mostDeclined && mostDeclined.change < -0.1) {
        risks.push('Weakest segment momentum: ' + mostDeclined.cat + ' lost ' + Math.abs(mostDeclined.change).toFixed(2) + 'pp MoM (now ' + mostDeclined.share.toFixed(1) + '%, rank #' + mostDeclined.rank + ').');
    }
    var intExpNLB = (prof && prof.plItems && prof.plItems['Interest Expense']) ? prof.plItems['Interest Expense'].NLB || 0 : 0;
    var intExpTotal = (prof && prof.plItems && prof.plItems['Interest Expense']) ? prof.plItems['Interest Expense'].Total || 0 : 0;
    var intExpShare = intExpTotal ? (Math.abs(intExpNLB) / Math.abs(intExpTotal) * 100) : 0;
    if (intExpShare > 18) risks.push('Interest expense share ' + intExpShare.toFixed(1) + '% of sector \u2014 NLB bears disproportionate funding costs vs ' + (getVal('pct', 'Assets', 'NLB', idx) || 0).toFixed(1) + '% asset share.');
    if (nlbCIR > avgCIR) risks.push('CIR ' + nlbCIR.toFixed(1) + '% above sector avg ' + avgCIR.toFixed(1) + '% \u2014 efficiency gap needs addressing.');
    if (nlbNPL > 2.5) risks.push('NPL ratio ' + nlbNPL.toFixed(2) + '% \u2014 credit quality warrants close monitoring.');
    if (risks.length < 3) risks.push('Market growing at ' + mktGr.toFixed(1) + '% \u2014 NLB must match or exceed to protect position.');

    setHTMLIfExists('ceoRisks', risks.slice(0, 3).map(function(r) { return '<li>' + r + '</li>'; }).join(''));

    // ===== ACTIONS =====
    var actions = [];
    if (sc < 0) {
        actions.push({ action: 'Reverse ' + cat + ' share decline: analyze lost ' + Math.abs(sc).toFixed(2) + 'pp \u2014 identify customer attrition sources and launch retention campaigns', owner: 'Head of ' + (cat.indexOf('Loan') >= 0 ? 'Lending' : cat.indexOf('Deposit') >= 0 ? 'Deposits' : 'Retail'), timing: 'Immediate', confidence: 'High' });
    } else if (nlbRank > 2) {
        actions.push({ action: 'Improve ' + cat + ' ranking from #' + nlbRank + ': target ' + sorted[nlbRank - 2] + ' (gap ' + ((getVal('pct', cat, sorted[nlbRank - 2], idx) || 0) - nlbShare).toFixed(2) + 'pp) through competitive pricing', owner: 'Head of Strategy', timing: 'Q2 2026', confidence: 'Medium' });
    } else {
        actions.push({ action: 'Defend #' + nlbRank + ' position in ' + cat + ' \u2014 strengthen ' + nlbShare.toFixed(1) + '% share through customer loyalty and cross-sell programs', owner: 'Head of Retail', timing: 'Ongoing', confidence: 'High' });
    }
    if (fastestComp && fastestComp.growth > nlbGr + 2) {
        actions.push({ action: 'Counter ' + fastestComp.bank + '\'s growth momentum (' + fastestComp.growth.toFixed(1) + '% vs NLB ' + nlbGr.toFixed(1) + '%) \u2014 benchmark their product offering and pricing', owner: 'Head of Strategy', timing: 'Q2 2026', confidence: 'Medium' });
    } else if (mostDeclined && mostDeclined.change < -0.2) {
        actions.push({ action: 'Arrest decline in ' + mostDeclined.cat + ' (lost ' + Math.abs(mostDeclined.change).toFixed(2) + 'pp) \u2014 review product competitiveness and distribution', owner: 'Product Head', timing: 'Q2 2026', confidence: 'High' });
    } else {
        actions.push({ action: 'Optimize deposit product mix: grow TDA and CA to strengthen funding base and reduce cost of funds', owner: 'Head of Treasury', timing: 'Q2-Q3 2026', confidence: 'Medium' });
    }
    if (bestSeg && bestSeg.share > 20 && bestSeg.rank <= 2) {
        actions.push({ action: 'Capitalize on ' + bestSeg.cat + ' leadership (' + bestSeg.share.toFixed(1) + '%, #' + bestSeg.rank + ') \u2014 expand through product innovation and cross-selling', owner: 'Head of Retail Lending', timing: 'Q2 2026', confidence: 'High' });
    } else if (intExpShare > 18) {
        actions.push({ action: 'Reduce funding cost concentration (' + intExpShare.toFixed(1) + '% of sector interest expense) \u2014 diversify deposit sourcing and optimize term structure', owner: 'Head of Treasury', timing: 'Q2-Q3 2026', confidence: 'Medium' });
    } else {
        actions.push({ action: 'Leverage best-in-class CIR (' + nlbCIR.toFixed(1) + '%) to invest in digital capabilities and grow market share profitably', owner: 'Head of Digital', timing: 'Q3 2026', confidence: 'High' });
    }

    var actBody = document.getElementById('ceoActionsBody');
    if (actBody) {
        actBody.innerHTML = actions.slice(0, 3).map(function(a) {
            return '<tr><td>' + a.action + '</td><td>' + a.owner + '</td><td>' + a.timing + '</td><td><span class="confidence-badge ' + (a.confidence === 'High' ? 'conf-high' : a.confidence === 'Medium' ? 'conf-medium' : 'conf-low') + '">' + a.confidence + '</span></td></tr>';
        }).join('');
    }

    // === ENHANCEMENT: Risk of Inaction ===
    var inactionParts = [];
    if (sc < 0) {
        var annualizedLoss = Math.abs(sc) * 12;
        inactionParts.push('If current share erosion pace continues (' + Math.abs(sc).toFixed(2) + 'pp/period), NLB could lose approximately ' + annualizedLoss.toFixed(1) + 'pp over the next year in ' + cat + ', dropping to ~' + (nlbShare - annualizedLoss).toFixed(1) + '% share.');
    }
    if (fastestComp && fastestComp.growth > nlbGr + 2) {
        inactionParts.push(fastestComp.bank + ' is growing at ' + fastestComp.growth.toFixed(1) + '% vs NLB\'s ' + nlbGr.toFixed(1) + '%. Without response, ' + fastestComp.bank + ' could overtake NLB within ' + Math.max(1, Math.ceil(Math.abs(gap) / (fastestComp.shareChange - sc))).toString() + ' periods.');
    }
    if (mostDeclined && mostDeclined.change < -0.2) {
        inactionParts.push('Continued neglect of ' + mostDeclined.cat + ' (losing ' + Math.abs(mostDeclined.change).toFixed(2) + 'pp/period) risks permanent franchise damage in this segment.');
    }
    if (intExpShare > 18) {
        inactionParts.push('Disproportionate funding costs (' + intExpShare.toFixed(1) + '% of sector interest expense vs ' + (getVal('pct', 'Assets', 'NLB', idx) || 0).toFixed(1) + '% asset share) will compress margins if not addressed.');
    }
    if (inactionParts.length === 0) {
        inactionParts.push('Current trajectory is stable, but complacency risks gradual competitive erosion. Market dynamics require continuous attention to maintain position.');
    }
    setHTMLIfExists('ceoInactionRiskText', inactionParts.join('<br><br>'));
}

// ============================================================
// SECTION 3: GAP & RANK MOMENTUM (enhanced with Strategic Implication)
// ============================================================
function updateGapMomentum() {
    var cat = getSelectedCategory();
    var idx = getSelectedPeriodIdx();
    var prevIdx = idx > 0 ? idx - 1 : idx;
    var qtrBack = Math.max(0, idx - 4);

    var sorted = getSortedBanks(cat, idx);
    var nlbRank = sorted.indexOf('NLB') + 1;
    var prevSorted = getSortedBanks(cat, prevIdx);
    var prevRank = prevSorted.indexOf('NLB') + 1;
    var leader = sorted[0];
    var nlbShare = getVal('pct', cat, 'NLB', idx) || 0;
    var leaderShare = getVal('pct', cat, leader, idx) || 0;
    var gap = nlbShare - leaderShare;
    var nlbShareQ = getVal('pct', cat, 'NLB', qtrBack) || 0;
    var leaderShareQ = getVal('pct', cat, getSortedBanks(cat, qtrBack)[0], qtrBack) || 0;
    var gapQ = nlbShareQ - leaderShareQ;
    var gapChange = gap - gapQ;

    document.getElementById('gapKpiRank').textContent = '#' + nlbRank;
    document.getElementById('gapKpiRankLabel').textContent = 'in ' + cat;
    var rcEl = document.getElementById('gapKpiRankChange');
    var rkChange = prevRank - nlbRank;
    rcEl.textContent = rkChange > 0 ? '+' + rkChange : rkChange < 0 ? String(rkChange) : '0';
    rcEl.className = 'kpi-value ' + (rkChange > 0 ? 'kpi-positive' : rkChange < 0 ? 'kpi-negative' : '');
    document.getElementById('gapKpiGap').textContent = leader === 'NLB' ? 'Leader' : fmtPP(gap);
    var gcEl = document.getElementById('gapKpiGapChange');
    gcEl.textContent = fmtPP(gapChange);
    gcEl.className = 'kpi-value ' + (gapChange > 0 ? 'kpi-positive' : gapChange < 0 ? 'kpi-negative' : '');

    var gapData = DATES.map(function(d, i) {
        var s = getSortedBanks(cat, i);
        var ls = getVal('pct', cat, s[0], i) || 0;
        var ns = getVal('pct', cat, 'NLB', i);
        return ns != null ? { x: new Date(d).getTime(), y: parseFloat((ns - ls).toFixed(2)) } : null;
    }).filter(Boolean);

    renderChart('chartGapTrend', {
        chart: { type: 'area', height: 320, fontFamily: 'Inter, sans-serif' },
        series: [{ name: 'Gap to Leader (pp)', data: gapData }], colors: [NLB_COLOR],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 } },
        stroke: { width: 2, curve: 'smooth' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
        yaxis: { labels: { formatter: function(v) { return (v > 0 ? '+' : '') + v.toFixed(1) + 'pp'; }, style: { fontSize: '11px' } } },
        dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return (v > 0 ? '+' : '') + v.toFixed(2) + 'pp'; } } },
        grid: { borderColor: '#f0f0f0', strokeDashArray: 3 },
        annotations: { yaxis: [{ y: 0, borderColor: '#c0392b', strokeDashArray: 0, borderWidth: 1 }] }
    });

    var rankData = DATES.map(function(d, i) {
        var s = getSortedBanks(cat, i);
        var r = s.indexOf('NLB') + 1;
        return r > 0 ? { x: new Date(d).getTime(), y: r } : null;
    }).filter(Boolean);

    renderChart('chartRankHistory', {
        chart: { type: 'line', height: 320, fontFamily: 'Inter, sans-serif' },
        series: [{ name: 'NLB Rank', data: rankData }], colors: [NLB_COLOR],
        stroke: { width: 3, curve: 'stepline' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
        yaxis: { reversed: true, min: 1, max: 6, labels: { formatter: function(v) { return '#' + v; }, style: { fontSize: '11px' } } },
        dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return '#' + v; } } },
        grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }, markers: { size: 3 }
    });

    var last6 = DATES.slice(-6);
    var last6Idx = DATES.length - 6;
    var heatSeries = CATS.map(function(c) {
        return {
            name: segLabel(c),
            data: last6.map(function(d, i) {
                var s = getSortedBanks(c, last6Idx + i);
                var r = s.indexOf('NLB') + 1;
                return { x: shortDate(d), y: r || 10 };
            })
        };
    });

    renderChart('chartRankHeatmap', {
        chart: { type: 'heatmap', height: 420, fontFamily: 'Inter, sans-serif' },
        series: heatSeries, colors: [NLB_COLOR],
        plotOptions: { heatmap: { radius: 4, colorScale: { ranges: [
            { from: 1, to: 2, color: '#230078', name: '#1-2' },
            { from: 2.01, to: 3, color: '#6c3fc8', name: '#3' },
            { from: 3.01, to: 5, color: '#b8a0f0', name: '#4-5' },
            { from: 5.01, to: 10, color: '#e8e0ff', name: '#6+' }
        ] } } },
        dataLabels: { enabled: true, formatter: function(v) { return '#' + v; }, style: { fontSize: '11px', fontWeight: 700 } },
        xaxis: { labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { style: { fontSize: '10px' } } },
        tooltip: { y: { formatter: function(v) { return 'Rank #' + v; } } }
    });

    // === ENHANCEMENT: Strategic Implication ===
    var strategyText = '';
    if (leader === 'NLB') {
        strategyText = 'NLB is the market leader in ' + cat + '. ';
        if (gapChange < 0) {
            strategyText += 'However, the gap advantage is shrinking \u2014 competitors are closing distance. ';
            strategyText += 'NLB needs to grow at least ' + (leaderShare > 0 ? ((gapChange) * -1).toFixed(2) : '0.5') + 'pp faster per quarter to maintain comfortable lead.';
        } else {
            strategyText += 'The leadership margin is stable or expanding \u2014 current strategy is effective. Continue monitoring challenger momentum.';
        }
    } else {
        var absGap = Math.abs(gap);
        if (gapChange > 0) {
            strategyText = 'NLB is closing the gap to ' + leader + ' (narrowed by ' + gapChange.toFixed(2) + 'pp over 4 periods). ';
            if (gapChange > 0.01) {
                var quartersToClose = Math.ceil(absGap / gapChange);
                strategyText += 'At current trajectory, NLB would need approximately ' + quartersToClose + ' quarters to reach #1. ';
            }
            strategyText += 'Maintain current growth momentum and consider accelerating in highest-impact segments.';
        } else if (gapChange < 0) {
            strategyText = 'NLB is losing distance to ' + leader + ' \u2014 the gap widened by ' + Math.abs(gapChange).toFixed(2) + 'pp over 4 periods. ';
            strategyText += 'To close the current ' + absGap.toFixed(2) + 'pp gap, NLB would need to grow approximately ' + (absGap / 4).toFixed(2) + 'pp faster than ' + leader + ' each quarter. ';
            strategyText += 'A strategic reassessment is needed \u2014 focus resources on segments where NLB can gain share most efficiently.';
        } else {
            strategyText = 'The gap to ' + leader + ' is stable at ' + absGap.toFixed(2) + 'pp. NLB needs a step-change in growth to close this gap \u2014 organic growth alone may not suffice.';
        }
    }
    setTextIfExists('gapStrategyInsightText', strategyText);
}


// ============================================================
// SECTION 4: MARKET TRENDS
// ============================================================
function updateTrends() {
    var cat = getSelectedCategory(); var topN = getTopN();
    var sorted = getSortedBanks(cat, DATES.length - 1);
    var banks = sorted.slice(0, topN);
    var series = banks.map(function(b) { return { name: b, data: DATES.map(function(d, i) { return { x: new Date(d).getTime(), y: getVal('pct', cat, b, i) }; }).filter(function(p) { return p.y != null; }) }; });
    renderChart('chartTrendAll', { chart: { type: 'line', height: 420, fontFamily: 'Inter, sans-serif' }, series: series, colors: banks.map(function(b) { return BANK_COLORS[b]; }), stroke: { width: banks.map(function(b) { return b === 'NLB' ? 4 : 2; }), curve: 'smooth' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '11px' } } }, yaxis: { labels: { formatter: function(v) { return v.toFixed(1) + '%'; }, style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return v ? v.toFixed(2) + '%' : '\u2014'; } } }, legend: { position: 'top', fontSize: '12px', fontWeight: 500 }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 } });
    var marketData = DATES.map(function(d, i) { return { x: new Date(d).getTime(), y: getVal('eur', cat, 'Total', i) }; }).filter(function(p) { return p.y != null; });
    renderChart('chartMarketSize', { chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Market Total', data: marketData }], colors: ['#d4d4e8'], plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { formatter: function(v) { return fmt(v, 0); }, style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return fmtK(v) + ' k EUR'; } } }, grid: { borderColor: '#f0f0f0' } });
    var top3 = sorted.filter(function(b) { return b !== 'NLB'; }).slice(0, 3);
    var nlbSeries = { name: 'NLB', data: DATES.map(function(d, i) { return { x: new Date(d).getTime(), y: getVal('pct', cat, 'NLB', i) }; }).filter(function(p) { return p.y != null; }) };
    var top3Series = top3.map(function(b) { return { name: b, data: DATES.map(function(d, i) { return { x: new Date(d).getTime(), y: getVal('pct', cat, b, i) }; }).filter(function(p) { return p.y != null; }) }; });
    renderChart('chartNlbVsTop3', { chart: { type: 'line', height: 320, fontFamily: 'Inter, sans-serif' }, series: [nlbSeries].concat(top3Series), colors: [NLB_COLOR].concat(top3.map(function(b) { return BANK_COLORS[b]; })), stroke: { width: [4, 2, 2, 2], curve: 'smooth', dashArray: [0, 4, 4, 4] }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { formatter: function(v) { return v.toFixed(1) + '%'; }, style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return v ? v.toFixed(2) + '%' : '\u2014'; } } }, legend: { position: 'top', fontSize: '12px' }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 } });
}

// ============================================================
// SECTION 5: COMPETITIVE
// ============================================================
function updateCompetitive() {
    var cat = getSelectedCategory(); var idx = getSelectedPeriodIdx(); var prevIdx = idx > 0 ? idx - 1 : idx;
    var topN = getTopN(); var sorted = getSortedBanks(cat, idx); var banks = sorted.slice(0, topN);
    renderChart('chartBarRanking', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Market Share', data: banks.map(function(b) { return { x: b, y: getVal('pct', cat, b, idx) || 0 }; }) }], colors: banks.map(function(b) { return BANK_COLORS[b]; }), plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 4, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: function(v) { return v.toFixed(1) + '%'; }, offsetX: 30, style: { fontSize: '12px', fontWeight: 700, colors: ['#333'] } }, xaxis: { labels: { formatter: function(v) { return v.toFixed(0) + '%'; }, style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: function(v) { return v.toFixed(2) + '%'; } } } });
    var changes = banks.map(function(b) { var cur = getVal('pct', cat, b, idx); var prev = getVal('pct', cat, b, prevIdx); return { x: b, y: (cur != null && prev != null) ? parseFloat((cur - prev).toFixed(4)) : 0 }; }).sort(function(a, b) { return b.y - a.y; });
    renderChart('chartShareChange', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Share Change (pp)', data: changes }], colors: [function(opts) { return opts.value >= 0 ? '#0d8a56' : '#c0392b'; }], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: function(v) { return (v > 0 ? '+' : '') + v.toFixed(2) + 'pp'; }, offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: function(v) { return v.toFixed(2) + 'pp'; }, style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: function(v) { return (v > 0 ? '+' : '') + v.toFixed(4) + ' pp'; } } } });
    var heatBanks = getSortedBanks('Assets', idx).slice(0, 7);
    var heatSeries = heatBanks.map(function(b) { return { name: b, data: CATS.map(function(c) { return { x: segLabel(c), y: getVal('pct', c, b, idx) || 0 }; }) }; });
    renderChart('chartHeatmap', { chart: { type: 'heatmap', height: 420, fontFamily: 'Inter, sans-serif' }, series: heatSeries, colors: [NLB_COLOR], dataLabels: { enabled: true, formatter: function(v) { return v.toFixed(1) + '%'; }, style: { fontSize: '10px' } }, plotOptions: { heatmap: { radius: 4, colorScale: { ranges: [{ from: 0, to: 8, color: '#e8e0ff', name: '0-8%' }, { from: 8, to: 14, color: '#b8a0f0', name: '8-14%' }, { from: 14, to: 20, color: '#7c50d0', name: '14-20%' }, { from: 20, to: 40, color: '#230078', name: '20%+' }] } } }, xaxis: { labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { style: { fontSize: '11px', fontWeight: 600 } } }, tooltip: { y: { formatter: function(v) { return v.toFixed(2) + '%'; } } } });
}

// ============================================================
// SECTION 6: BANK VS BANK
// ============================================================
function updateComparison() {
    var bankA = document.getElementById('compareA').value;
    var bankB = document.getElementById('compareB').value;
    var cat = getSelectedCategory(); var idx = getSelectedPeriodIdx(); var prevIdx = idx > 0 ? idx - 1 : idx;
    document.getElementById('thBankA').textContent = bankA; document.getElementById('thBankB').textContent = bankB;
    var aVal = getVal('eur', cat, bankA, idx); var bVal = getVal('eur', cat, bankB, idx);
    var aShare = getVal('pct', cat, bankA, idx); var bShare = getVal('pct', cat, bankB, idx);
    var aSharePrev = getVal('pct', cat, bankA, prevIdx); var bSharePrev = getVal('pct', cat, bankB, prevIdx);
    var aGrowth = (aVal && getVal('eur', cat, bankA, prevIdx)) ? ((aVal / getVal('eur', cat, bankA, prevIdx) - 1) * 100) : null;
    var bGrowth = (bVal && getVal('eur', cat, bankB, prevIdx)) ? ((bVal / getVal('eur', cat, bankB, prevIdx) - 1) * 100) : null;
    var sorted = getSortedBanks(cat, idx); var aRank = sorted.indexOf(bankA) + 1; var bRank = sorted.indexOf(bankB) + 1;
    var kpiData = [
        { label: 'Market Share', aVal: aShare, bVal: bShare, fmt: function(v) { return fmtPct(v); }, gapFmt: function(v) { return fmtPP(v) + ' pp'; }, better: 'higher' },
        { label: 'Value (k EUR)', aVal: aVal, bVal: bVal, fmt: function(v) { return fmt(v); }, gapFmt: function(v) { return (v > 0 ? '+' : '') + commaFmt(v, 0); }, better: 'higher' },
        { label: 'Growth Rate', aVal: aGrowth, bVal: bGrowth, fmt: function(v) { return v != null ? commaFmt(v, 2) + '%' : '\u2014'; }, gapFmt: function(v) { return fmtPP(v) + ' pp'; }, better: 'higher' },
        { label: 'Rank', aVal: aRank, bVal: bRank, fmt: function(v) { return '#' + v; }, gapFmt: function(v) { return (v > 0 ? '+' : '') + v; }, better: 'lower' },
        { label: 'Share Change', aVal: aShare != null && aSharePrev != null ? aShare - aSharePrev : null, bVal: bShare != null && bSharePrev != null ? bShare - bSharePrev : null, fmt: function(v) { return fmtPP(v); }, gapFmt: function(v) { return fmtPP(v) + ' pp'; }, better: 'higher' }
    ];
    var kpiContainer = document.getElementById('compareKpis'); kpiContainer.innerHTML = '';
    kpiData.forEach(function(kpi) {
        var aW = kpi.better === 'higher' ? (kpi.aVal || 0) >= (kpi.bVal || 0) : (kpi.aVal || 0) <= (kpi.bVal || 0);
        var gap = kpi.aVal != null && kpi.bVal != null ? kpi.aVal - kpi.bVal : null;
        var gapClass = gap != null ? (gap > 0 ? (kpi.better === 'higher' ? 'positive' : 'negative') : gap < 0 ? (kpi.better === 'higher' ? 'negative' : 'positive') : '') : '';
        kpiContainer.innerHTML += '<div class="compare-kpi-card"><span class="compare-kpi-label">' + kpi.label + '</span><div class="compare-kpi-values"><div class="compare-val"><span class="val-label">' + bankA + '</span><span class="val-num bank-a-color">' + kpi.fmt(kpi.aVal) + '</span></div><div class="compare-gap ' + gapClass + '">' + (gap != null ? kpi.gapFmt(gap) : '\u2014') + '</div><div class="compare-val"><span class="val-label">' + bankB + '</span><span class="val-num bank-b-color">' + kpi.fmt(kpi.bVal) + '</span></div></div><div style="text-align:center;margin-top:6px"><span class="leader-badge ' + (aW ? 'leader-a' : 'leader-b') + '">' + (aW ? bankA + ' leads' : bankB + ' leads') + '</span></div></div>';
    });
    var shareGap = aShare != null && bShare != null ? aShare - bShare : null;
    var summaryParts = [];
    if (shareGap != null) { if (shareGap > 0) summaryParts.push(bankA + ' leads ' + bankB + ' by ' + Math.abs(shareGap).toFixed(2) + 'pp in ' + cat + ' market share.'); else if (shareGap < 0) summaryParts.push(bankB + ' leads ' + bankA + ' by ' + Math.abs(shareGap).toFixed(2) + 'pp in ' + cat + ' market share.'); else summaryParts.push(bankA + ' and ' + bankB + ' have equal market share.'); }
    if (aGrowth != null && bGrowth != null) { var fb = aGrowth > bGrowth ? bankA : bankB; summaryParts.push(fb + ' is growing faster at ' + Math.max(aGrowth, bGrowth).toFixed(1) + '% vs ' + Math.min(aGrowth, bGrowth).toFixed(1) + '%.'); }
    if (aRank && bRank) summaryParts.push(bankA + ' ranks #' + aRank + ' and ' + bankB + ' ranks #' + bRank + '.');
    document.getElementById('compareSummaryText').textContent = summaryParts.join(' ') || 'Select two banks to compare.';
    var aSeries = DATES.map(function(d, i) { return { x: new Date(d).getTime(), y: getVal('pct', cat, bankA, i) }; }).filter(function(p) { return p.y != null; });
    var bSeries = DATES.map(function(d, i) { return { x: new Date(d).getTime(), y: getVal('pct', cat, bankB, i) }; }).filter(function(p) { return p.y != null; });
    renderChart('chartCompareTrend', { chart: { type: 'line', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: bankA, data: aSeries }, { name: bankB, data: bSeries }], colors: [NLB_COLOR, '#6b7280'], stroke: { width: [3, 3], curve: 'smooth' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { formatter: function(v) { return v.toFixed(1) + '%'; }, style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return v ? v.toFixed(2) + '%' : '\u2014'; } } }, legend: { position: 'top', fontSize: '13px', fontWeight: 600 }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }, markers: { size: 0, hover: { size: 5 } } });
    var segLabels2 = CATS.map(segLabel); var aSegVals = CATS.map(function(c) { return getVal('pct', c, bankA, idx) || 0; }); var bSegVals = CATS.map(function(c) { return getVal('pct', c, bankB, idx) || 0; });
    renderChart('chartCompareSegments', { chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: bankA, data: aSegVals }, { name: bankB, data: bSegVals }], colors: [NLB_COLOR, '#9ca3af'], plotOptions: { bar: { borderRadius: 3, columnWidth: '65%' } }, xaxis: { categories: segLabels2, labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: true } }, yaxis: { labels: { formatter: function(v) { return v.toFixed(0) + '%'; }, style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, legend: { position: 'top', fontSize: '12px', fontWeight: 600 }, tooltip: { y: { formatter: function(v) { return v.toFixed(2) + '%'; } } }, grid: { borderColor: '#f0f0f0' } });
    var aSegEur = CATS.map(function(c) { return getVal('eur', c, bankA, idx) || 0; }); var bSegEur = CATS.map(function(c) { return getVal('eur', c, bankB, idx) || 0; });
    renderChart('chartCompareBar', { chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: bankA, data: aSegEur }, { name: bankB, data: bSegEur }], colors: [NLB_COLOR, '#9ca3af'], plotOptions: { bar: { borderRadius: 3, columnWidth: '65%' } }, xaxis: { categories: segLabels2, labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: true } }, yaxis: { labels: { formatter: function(v) { return fmt(v, 0); }, style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, legend: { position: 'top', fontSize: '12px', fontWeight: 600 }, tooltip: { y: { formatter: function(v) { return fmtK(v) + ' k EUR'; } } }, grid: { borderColor: '#f0f0f0' } });
    var gapDataC = DATES.map(function(d, i) { var a2 = getVal('pct', cat, bankA, i); var b2 = getVal('pct', cat, bankB, i); return { x: new Date(d).getTime(), y: a2 != null && b2 != null ? parseFloat((a2 - b2).toFixed(4)) : null }; }).filter(function(p) { return p.y != null; });
    renderChart('chartCompareGap', { chart: { type: 'area', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Gap (' + bankA + ' - ' + bankB + ')', data: gapDataC }], colors: [NLB_COLOR], fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } }, stroke: { width: 2, curve: 'smooth' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { formatter: function(v) { return (v > 0 ? '+' : '') + v.toFixed(1) + 'pp'; }, style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return (v > 0 ? '+' : '') + v.toFixed(2) + ' pp'; } } }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }, annotations: { yaxis: [{ y: 0, borderColor: '#c0392b', strokeDashArray: 0, borderWidth: 1 }] } });
    var tbody = document.getElementById('compareBody'); tbody.innerHTML = '';
    CATS.forEach(function(c) { var as2 = getVal('pct', c, bankA, idx); var bs2 = getVal('pct', c, bankB, idx); var av2 = getVal('eur', c, bankA, idx); var bv2 = getVal('eur', c, bankB, idx); var g = as2 != null && bs2 != null ? as2 - bs2 : null; var ld = g > 0 ? bankA : g < 0 ? bankB : 'Tie';
        tbody.innerHTML += '<tr><td><strong>' + c + '</strong></td><td class="' + (g > 0 ? 'winner-a' : '') + '">' + fmtPct(as2) + ' <span style="color:var(--text-muted);font-size:0.75rem">(' + fmt(av2) + ')</span></td><td class="' + (g < 0 ? 'winner-b' : '') + '">' + fmtPct(bs2) + ' <span style="color:var(--text-muted);font-size:0.75rem">(' + fmt(bv2) + ')</span></td><td class="' + (g > 0 ? 'kpi-positive' : g < 0 ? 'kpi-negative' : '') + '">' + (g != null ? fmtPP(g) + ' pp' : '\u2014') + '</td><td><span class="leader-badge ' + (g > 0 ? 'leader-a' : g < 0 ? 'leader-b' : 'leader-tie') + '">' + ld + '</span></td></tr>'; });
}
function quickCompare(bank) { document.getElementById('compareA').value = 'NLB'; document.getElementById('compareB').value = bank; document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); }); document.querySelector('[data-section="comparison"]').classList.add('active'); document.querySelectorAll('.dashboard-section').forEach(function(s) { s.classList.remove('active'); }); document.getElementById('sec-comparison').classList.add('active'); updateComparison(); }

// ============================================================
// SECTION 7: SEGMENTS
// ============================================================
function updateSegments() {
    var idx = getSelectedPeriodIdx(); var sl = CATS.map(segLabel);
    var nlbShares = CATS.map(function(c) { return getVal('pct', c, 'NLB', idx) || 0; });
    renderChart('chartSegmentBar', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'NLB Market Share', data: nlbShares }], colors: [NLB_COLOR], plotOptions: { bar: { borderRadius: 5, columnWidth: '55%', dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: function(v) { return v.toFixed(1) + '%'; }, offsetY: -20, style: { fontSize: '12px', fontWeight: 700, colors: [NLB_COLOR] } }, xaxis: { categories: sl, labels: { style: { fontSize: '11px' } } }, yaxis: { labels: { formatter: function(v) { return v.toFixed(0) + '%'; }, style: { fontSize: '11px' } }, max: Math.max.apply(null, nlbShares) + 5 }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: function(v) { return v.toFixed(2) + '%'; } } }, annotations: { yaxis: [{ y: nlbShares.reduce(function(a, b) { return a + b; }, 0) / nlbShares.length, borderColor: '#c0392b', strokeDashArray: 4, label: { text: 'Average', style: { background: '#c0392b', color: '#fff', fontSize: '10px' } } }] } });
    var nlbVals = CATS.map(function(c) { return getVal('eur', c, 'NLB', idx) || 0; }); var marketVals = CATS.map(function(c) { return (getVal('eur', c, 'Total', idx) || 0) - (getVal('eur', c, 'NLB', idx) || 0); });
    renderChart('chartSegmentStack', { chart: { type: 'bar', height: 320, stacked: true, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'NLB', data: nlbVals }, { name: 'Rest of Market', data: marketVals }], colors: [NLB_COLOR, '#e5e7eb'], plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } }, xaxis: { categories: sl, labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: true } }, yaxis: { labels: { formatter: function(v) { return fmt(v, 0); }, style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, legend: { position: 'top', fontSize: '12px' }, tooltip: { y: { formatter: function(v) { return fmtK(v) + ' k EUR'; } } }, grid: { borderColor: '#f0f0f0' } });
    var nlbRanks = CATS.map(function(c) { var s = getSortedBanks(c, idx); return s.indexOf('NLB') + 1; });
    renderChart('chartSegmentRank', { chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'NLB Rank', data: nlbRanks }], colors: [function(opts) { var v = opts.value; return v <= 2 ? '#0d8a56' : v <= 4 ? '#d68a00' : '#c0392b'; }], plotOptions: { bar: { borderRadius: 4, columnWidth: '50%', distributed: true, dataLabels: { position: 'center' } } }, dataLabels: { enabled: true, formatter: function(v) { return '#' + v; }, style: { fontSize: '14px', fontWeight: 800, colors: ['#fff'] } }, xaxis: { categories: sl, labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: true } }, yaxis: { reversed: true, min: 0, max: 11, labels: { formatter: function(v) { return '#' + v; }, style: { fontSize: '11px' } } }, legend: { show: false }, tooltip: { y: { formatter: function(v) { return 'Rank #' + v; } } }, grid: { borderColor: '#f0f0f0' } });
}

// ============================================================
// SECTION 8: GROWTH DRIVERS
// ============================================================
function updateGrowth() {
    var cat = getSelectedCategory(); var idx = getSelectedPeriodIdx(); var prevIdx = idx > 0 ? idx - 1 : null; var topN = getTopN();
    if (prevIdx === null) { document.getElementById('growthInsightText').textContent = 'Growth data requires at least two periods.'; ['chartGrowthRate', 'chartGrowthContrib'].forEach(function(id) { var el = document.getElementById(id); if (el) el.innerHTML = '<p style="text-align:center;color:#999;padding:60px 0">No prior period available.</p>'; }); return; }
    var totalCur = getVal('eur', cat, 'Total', idx); var totalPrev = getVal('eur', cat, 'Total', prevIdx); var totalMarketGrowth = (totalCur && totalPrev) ? totalCur - totalPrev : 0;
    var growthData = BANKS.map(function(b) { var cur = getVal('eur', cat, b, idx); var prev = getVal('eur', cat, b, prevIdx); var growth = (cur && prev) ? ((cur / prev - 1) * 100) : null; var absChange = (cur != null && prev != null) ? cur - prev : null; var contribution = null; if (absChange != null && totalMarketGrowth !== 0) { contribution = (absChange / totalMarketGrowth) * 100; if (Math.abs(contribution) > 200) contribution = Math.sign(contribution) * 200; } return { bank: b, growth: growth, absChange: absChange, contribution: contribution }; }).filter(function(d) { return d.growth != null; }).sort(function(a, b) { return b.growth - a.growth; }).slice(0, topN);
    renderChart('chartGrowthRate', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Growth %', data: growthData.map(function(d) { return { x: d.bank, y: parseFloat(d.growth.toFixed(2)) }; }) }], colors: [function(opts) { var b = growthData[opts.dataPointIndex] ? growthData[opts.dataPointIndex].bank : ''; return b === 'NLB' ? NLB_COLOR : (growthData[opts.dataPointIndex] && growthData[opts.dataPointIndex].growth >= 0 ? '#0d8a56' : '#c0392b'); }], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: function(v) { return (v > 0 ? '+' : '') + v.toFixed(1) + '%'; }, offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: function(v) { return v.toFixed(1) + '%'; }, style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: function(v) { return v.toFixed(2) + '%'; } } } });
    var contribData = growthData.slice().sort(function(a, b) { return b.absChange - a.absChange; });
    renderChart('chartGrowthContrib', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Change (k EUR)', data: contribData.map(function(d) { return { x: d.bank, y: Math.round(d.absChange) }; }) }], colors: [function(opts) { var b = contribData[opts.dataPointIndex] ? contribData[opts.dataPointIndex].bank : ''; return b === 'NLB' ? NLB_COLOR : (contribData[opts.dataPointIndex] && contribData[opts.dataPointIndex].absChange >= 0 ? '#6b7280' : '#c0392b'); }], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: function(v) { return (v > 0 ? '+' : '') + fmtK(v); }, offsetX: 30, style: { fontSize: '10px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: function(v) { return fmt(v, 0); }, style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: function(v) { return fmtK(v) + ' k EUR'; } } } });
    var nlbGI = growthData.find(function(d) { return d.bank === 'NLB'; }); var fastest = growthData.slice().sort(function(a, b) { return b.growth - a.growth; })[0];
    var gInsight = [];
    if (nlbGI) gInsight.push('NLB grew by ' + nlbGI.growth.toFixed(1) + '% in ' + cat + ', with an absolute change of ' + fmtK(nlbGI.absChange) + ' k EUR.');
    if (fastest && fastest.bank !== 'NLB') gInsight.push('The fastest growing bank is ' + fastest.bank + ' at ' + fastest.growth.toFixed(1) + '%.');
    if (nlbGI && totalMarketGrowth !== 0) { var c2 = (nlbGI.absChange / totalMarketGrowth * 100); if (totalMarketGrowth > 0) gInsight.push('NLB contributed ' + c2.toFixed(1) + '% of total market growth.'); else gInsight.push('Total market declined. NLB accounted for ' + Math.abs(c2).toFixed(1) + '% of the decline.'); }
    document.getElementById('growthInsightText').textContent = gInsight.join(' ') || 'Select a category and period to view growth insights.';
}

// ============================================================
// SECTION 9: SHARE BRIDGE / WATERFALL (enhanced with Growth Quality)
// ============================================================
function updateWaterfall() {
    var idx = getSelectedPeriodIdx();
    var prevIdx = idx > 0 ? idx - 1 : idx;

    var segmentCats = ['Corporate Loans', 'Retail Loans', 'Housing Loans', 'Consumer Loans', 'Total Deposits', 'Securities'];
    var nlbAssetsCur = getVal('pct', 'Assets', 'NLB', idx) || 0;
    var nlbAssetsPrev = getVal('pct', 'Assets', 'NLB', prevIdx) || 0;
    var totalChange = nlbAssetsCur - nlbAssetsPrev;

    var bridgeData = segmentCats.map(function(cat) {
        var curShare = getVal('pct', cat, 'NLB', idx) || 0;
        var prevShare = getVal('pct', cat, 'NLB', prevIdx) || 0;
        var shareChange = curShare - prevShare;
        var segTotal = getVal('eur', cat, 'Total', idx) || 0;
        var assetTotal = getVal('eur', 'Assets', 'Total', idx) || 1;
        var weight = segTotal / assetTotal;
        return { cat: cat, shareChange: shareChange, weight: weight, contribution: shareChange * weight };
    });

    var posContribs = bridgeData.filter(function(d) { return d.contribution > 0; }).sort(function(a, b) { return b.contribution - a.contribution; });
    var negContribs = bridgeData.filter(function(d) { return d.contribution < 0; }).sort(function(a, b) { return a.contribution - b.contribution; });
    var wText = 'NLB\'s overall asset market share ' + (totalChange >= 0 ? 'increased' : 'decreased') + ' by ' + Math.abs(totalChange).toFixed(2) + 'pp.';
    if (posContribs.length > 0) wText += ' Positive drivers: ' + posContribs.map(function(d) { return segLabel(d.cat) + ' (+' + d.contribution.toFixed(3) + 'pp)'; }).join(', ') + '.';
    if (negContribs.length > 0) wText += ' Negative drag: ' + negContribs.map(function(d) { return segLabel(d.cat) + ' (' + d.contribution.toFixed(3) + 'pp)'; }).join(', ') + '.';
    document.getElementById('waterfallInsightText').textContent = wText;

    var wfLabels = ['Prior Share'].concat(segmentCats.map(segLabel)).concat(['Current Share']);
    var wfValues = [nlbAssetsPrev];
    bridgeData.forEach(function(d) { wfValues.push(d.shareChange); });
    wfValues.push(nlbAssetsCur);

    renderChart('chartWaterfall', {
        chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' },
        series: [{ name: 'Share Change (pp)', data: wfValues }],
        colors: [function(opts) {
            if (opts.dataPointIndex === 0 || opts.dataPointIndex === wfValues.length - 1) return NLB_COLOR;
            return opts.value >= 0 ? '#0d8a56' : '#c0392b';
        }],
        plotOptions: { bar: { borderRadius: 4, columnWidth: '55%', distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: function(v, opts) { return (opts.dataPointIndex === 0 || opts.dataPointIndex === wfValues.length - 1) ? v.toFixed(2) + '%' : (v > 0 ? '+' : '') + v.toFixed(3) + 'pp'; }, offsetY: -15, style: { fontSize: '11px', fontWeight: 700, colors: ['#333'] } },
        xaxis: { categories: wfLabels, labels: { style: { fontSize: '10px' }, rotate: -30 } },
        yaxis: { labels: { formatter: function(v) { return v.toFixed(1) + '%'; }, style: { fontSize: '11px' } } },
        legend: { show: false }, grid: { borderColor: '#f0f0f0' },
        tooltip: { y: { formatter: function(v, opts) { return (opts.dataPointIndex === 0 || opts.dataPointIndex === wfValues.length - 1) ? v.toFixed(2) + '%' : (v > 0 ? '+' : '') + v.toFixed(4) + 'pp'; } } }
    });

    document.getElementById('waterfallHead').innerHTML = '<tr><th>Segment</th><th>NLB Share (Current)</th><th>NLB Share (Prior)</th><th>Change (pp)</th><th>Segment Weight</th><th>Weighted Contribution</th></tr>';
    var wb = document.getElementById('waterfallBody'); wb.innerHTML = '';
    bridgeData.forEach(function(d) {
        var curS = getVal('pct', d.cat, 'NLB', idx); var prevS = getVal('pct', d.cat, 'NLB', prevIdx);
        wb.innerHTML += '<tr><td><strong>' + d.cat + '</strong></td><td>' + fmtPct(curS) + '</td><td>' + fmtPct(prevS) + '</td><td class="' + (d.shareChange > 0 ? 'kpi-positive' : d.shareChange < 0 ? 'kpi-negative' : '') + '">' + fmtPP(d.shareChange) + 'pp</td><td>' + (d.weight * 100).toFixed(1) + '%</td><td class="' + (d.contribution > 0 ? 'kpi-positive' : d.contribution < 0 ? 'kpi-negative' : '') + '">' + (d.contribution > 0 ? '+' : '') + d.contribution.toFixed(4) + 'pp</td></tr>';
    });
    wb.innerHTML += '<tr class="pl-bold-row"><td><strong>Total</strong></td><td><strong>' + fmtPct(nlbAssetsCur) + '</strong></td><td><strong>' + fmtPct(nlbAssetsPrev) + '</strong></td><td class="' + (totalChange > 0 ? 'kpi-positive' : totalChange < 0 ? 'kpi-negative' : '') + '"><strong>' + fmtPP(totalChange) + 'pp</strong></td><td>\u2014</td><td><strong>' + fmtPP(bridgeData.reduce(function(s, d) { return s + d.contribution; }, 0)) + 'pp</strong></td></tr>';

    // === ENHANCEMENT: Growth Quality Assessment ===
    var lendingContrib = bridgeData.filter(function(d) { return ['Corporate Loans', 'Retail Loans', 'Housing Loans', 'Consumer Loans'].indexOf(d.cat) >= 0; }).reduce(function(s, d) { return s + d.contribution; }, 0);
    var depositContrib = bridgeData.filter(function(d) { return d.cat === 'Total Deposits'; }).reduce(function(s, d) { return s + d.contribution; }, 0);
    var secContrib = bridgeData.filter(function(d) { return d.cat === 'Securities'; }).reduce(function(s, d) { return s + d.contribution; }, 0);

    var qualityParts = [];
    if (lendingContrib > 0 && depositContrib >= 0) {
        qualityParts.push('NLB growth is healthy \u2014 driven by core lending (contributing ' + lendingContrib.toFixed(3) + 'pp) with stable deposit support.');
    } else if (lendingContrib < 0 && depositContrib > 0) {
        qualityParts.push('NLB growth is defensive \u2014 driven by deposit/funding gains while lending share is eroding. This signals a shift toward lower-risk but lower-return positioning.');
    } else if (lendingContrib < 0 && depositContrib < 0) {
        qualityParts.push('NLB is losing ground across both lending and deposits \u2014 a broad-based competitive challenge requiring urgent strategic attention.');
    } else {
        qualityParts.push('Growth pattern is mixed \u2014 lending contributes ' + lendingContrib.toFixed(3) + 'pp and deposits ' + depositContrib.toFixed(3) + 'pp.');
    }

    var topDriver = bridgeData.slice().sort(function(a, b) { return Math.abs(b.contribution) - Math.abs(a.contribution); })[0];
    if (topDriver) {
        qualityParts.push('The single largest driver is ' + topDriver.cat + ' (' + (topDriver.contribution > 0 ? '+' : '') + topDriver.contribution.toFixed(3) + 'pp). ');
    }

    var posSegs = posContribs.map(function(d) { return d.cat; });
    var negSegs = negContribs.map(function(d) { return d.cat; });
    if (posSegs.length > 0) qualityParts.push('Products driving NLB share gains: ' + posSegs.join(', ') + '.');
    if (negSegs.length > 0) qualityParts.push('Products dragging NLB share: ' + negSegs.join(', ') + '.');

    setTextIfExists('growthQualityInsightText', qualityParts.join(' '));
}


// ============================================================
// SECTION 10: DEPOSITS & FUNDING DEEP-DIVE (MAJOR ENHANCEMENTS)
// ============================================================
function updateDeposits() {
    var idx = getSelectedPeriodIdx();
    var prevIdx = idx > 0 ? idx - 1 : idx;
    var prof = D.profitability;

    // KPIs
    var nlbDep = getVal('eur', 'Total Deposits', 'NLB', idx);
    var nlbDepShare = getVal('pct', 'Total Deposits', 'NLB', idx);
    var nlbRetDepShare = getVal('pct', 'Deposits from Retail', 'NLB', idx);
    var nlbCorpDepShare = getVal('pct', 'Deposits from Corporate', 'NLB', idx);
    var intExp = (prof && prof.plItems && prof.plItems['Interest Expense']) ? prof.plItems['Interest Expense'].NLB || 0 : 0;
    var depSorted = getSortedBanks('Total Deposits', idx);
    var depRank = depSorted.indexOf('NLB') + 1;

    document.getElementById('depKpiTotal').textContent = fmt(nlbDep);
    document.getElementById('depKpiTotalUnit').textContent = fmtUnit(nlbDep);
    document.getElementById('depKpiShare').textContent = nlbDepShare ? nlbDepShare.toFixed(2) : '\u2014';
    document.getElementById('depKpiRetail').textContent = nlbRetDepShare ? nlbRetDepShare.toFixed(2) : '\u2014';
    document.getElementById('depKpiCorp').textContent = nlbCorpDepShare ? nlbCorpDepShare.toFixed(2) : '\u2014';
    document.getElementById('depKpiIntExp').textContent = commaFmt(Math.abs(intExp), 0);
    document.getElementById('depKpiRank').textContent = '#' + depRank;

    // === NEW KPIs ===
    var nlbLoans = getVal('eur', 'Gross Loans', 'NLB', idx) || 0;
    var nlbDepVal = nlbDep || 0;
    var nlbCA = getVal('eur', 'Deposits CA', 'NLB', idx) || 0;
    var nlbSaving = getVal('eur', 'Deposits Saving', 'NLB', idx) || 0;
    var nlbTDA = getVal('eur', 'Deposits TDA', 'NLB', idx) || 0;

    var ltdRatio = nlbDepVal > 0 ? (nlbLoans / nlbDepVal * 100) : null;
    var casaRatio = nlbDepVal > 0 ? (nlbCA / nlbDepVal * 100) : null;
    var tdrRatio = nlbDepVal > 0 ? (nlbTDA / nlbDepVal * 100) : null;
    // Cost of Deposits: annualized. Period is Feb data = 2 months. Annualize by *12/2 = *6
    var periodMonths = 2;
    var codRatio = nlbDepVal > 0 ? (Math.abs(intExp) / nlbDepVal * 100 * (12 / periodMonths)) : null;

    setTextIfExists('depKpiLTD', ltdRatio != null ? ltdRatio.toFixed(1) : '\u2014');
    setTextIfExists('depKpiCASA', casaRatio != null ? casaRatio.toFixed(1) : '\u2014');
    setTextIfExists('depKpiTDR', tdrRatio != null ? tdrRatio.toFixed(1) : '\u2014');
    setTextIfExists('depKpiCoD', codRatio != null ? codRatio.toFixed(2) : '\u2014');

    // Insight
    var retailDep = getVal('eur', 'Deposits from Retail', 'NLB', idx) || 0;
    var corpDep = getVal('eur', 'Deposits from Corporate', 'NLB', idx) || 0;
    var retailPct = nlbDepVal ? (retailDep / nlbDepVal * 100) : 0;
    var depInsight = 'NLB\'s total deposits are ' + fmt(nlbDep) + ' (' + fmtPct(nlbDepShare) + ' market share, rank #' + depRank + '). ';
    depInsight += 'Retail deposits make up ' + retailPct.toFixed(0) + '% of NLB\'s funding base, with a ' + fmtPct(nlbRetDepShare) + ' sector share. ';
    depInsight += 'Interest expense is ' + commaFmt(Math.abs(intExp), 0) + ' k EUR. ';
    if (retailPct > 65) depInsight += 'Strong CASA-like retail franchise helps contain funding costs. ';
    else depInsight += 'Corporate deposit reliance at ' + (100 - retailPct).toFixed(0) + '% may increase funding cost volatility. ';
    document.getElementById('depositInsightText').textContent = depInsight;

    // === MANAGEMENT ASSESSMENT ===
    var mgmtParts = [];
    // LTD assessment
    if (ltdRatio != null) {
        if (ltdRatio < 80) mgmtParts.push('LTD ratio of ' + ltdRatio.toFixed(1) + '% indicates NLB is overfunded \u2014 excess deposits are not fully deployed into lending. This dampens NII but provides strong liquidity buffer.');
        else if (ltdRatio <= 100) mgmtParts.push('LTD ratio of ' + ltdRatio.toFixed(1) + '% suggests an efficiently balanced funding position \u2014 deposits are well-deployed into lending without excessive leverage.');
        else mgmtParts.push('LTD ratio of ' + ltdRatio.toFixed(1) + '% indicates NLB is under-funded relative to lending \u2014 loan book exceeds deposit base, requiring wholesale or interbank funding.');
    }
    // CASA assessment
    if (casaRatio != null && tdrRatio != null) {
        if (casaRatio > 50) mgmtParts.push('CA deposits represent ' + casaRatio.toFixed(1) + '% of total deposits \u2014 this is a low-cost funding base that supports profitability. TDA at ' + tdrRatio.toFixed(1) + '% keeps blended funding costs manageable.');
        else if (tdrRatio > 40) mgmtParts.push('Term deposits (TDA) represent ' + tdrRatio.toFixed(1) + '% of total deposits \u2014 relatively high-cost funding. Consider strategies to shift mix toward CA/current accounts.');
        else mgmtParts.push('Deposit mix is balanced: CA ' + casaRatio.toFixed(1) + '%, Saving ' + ((nlbDepVal > 0 ? nlbSaving / nlbDepVal * 100 : 0)).toFixed(1) + '%, TDA ' + tdrRatio.toFixed(1) + '%.');
    }
    // Deposit growth quality
    var nlbDepPrev = getVal('eur', 'Total Deposits', 'NLB', prevIdx) || 0;
    var nlbCAPrev = getVal('eur', 'Deposits CA', 'NLB', prevIdx) || 0;
    var nlbTDAPrev = getVal('eur', 'Deposits TDA', 'NLB', prevIdx) || 0;
    var depGrowth = nlbDepPrev > 0 ? ((nlbDepVal / nlbDepPrev - 1) * 100) : 0;
    var caGrowth = nlbCAPrev > 0 ? ((nlbCA / nlbCAPrev - 1) * 100) : 0;
    var tdaGrowth = nlbTDAPrev > 0 ? ((nlbTDA / nlbTDAPrev - 1) * 100) : 0;
    if (depGrowth > 0) {
        if (caGrowth > tdaGrowth) mgmtParts.push('Deposit growth (' + depGrowth.toFixed(1) + '%) is led by low-cost CA accounts (+' + caGrowth.toFixed(1) + '%) \u2014 this is margin-supportive growth.');
        else if (tdaGrowth > caGrowth) mgmtParts.push('Deposit growth (' + depGrowth.toFixed(1) + '%) is driven by TDA (+' + tdaGrowth.toFixed(1) + '%) \u2014 NLB may be buying growth with expensive term deposits.');
    }
    // Profitability support
    if (casaRatio != null && casaRatio > 45 && (codRatio == null || codRatio < 3)) {
        mgmtParts.push('Current deposit mix supports profitability with a strong low-cost funding base.');
    } else if (codRatio != null && codRatio > 3) {
        mgmtParts.push('Cost of deposits at ' + codRatio.toFixed(2) + '% (annualized) is elevated \u2014 monitor funding cost trajectory closely.');
    }
    setTextIfExists('depMgmtAssessmentText', mgmtParts.join(' ') || 'Deposit management assessment requires complete data.');

    // ===== EXISTING CHARTS =====
    // Deposit mix donut
    renderChart('chartDepositMix', {
        chart: { type: 'donut', height: 320, fontFamily: 'Inter, sans-serif' },
        series: [retailDep, corpDep], labels: ['Retail Deposits', 'Corporate Deposits'],
        colors: [NLB_COLOR, '#b8a0f0'],
        plotOptions: { pie: { donut: { size: '55%', labels: { show: true, value: { formatter: function(v) { return fmt(parseFloat(v)); } }, total: { show: true, label: 'Total', formatter: function() { return fmt(nlbDep); } } } } } },
        dataLabels: { enabled: true, formatter: function(v) { return v.toFixed(1) + '%'; }, style: { fontSize: '12px', fontWeight: 600 } },
        legend: { position: 'bottom', fontSize: '12px' }, stroke: { width: 2, colors: ['#fff'] },
        tooltip: { y: { formatter: function(v) { return fmtK(v) + ' k EUR'; } } }
    });

    // Deposit share by segment bar
    var depCats = ['Total Deposits', 'Deposits from Retail', 'Deposits from Corporate'];
    var depShares = depCats.map(function(c) { return getVal('pct', c, 'NLB', idx) || 0; });
    renderChart('chartDepositShare', {
        chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif' },
        series: [{ name: 'NLB Share %', data: depShares }], colors: [NLB_COLOR],
        plotOptions: { bar: { borderRadius: 5, columnWidth: '45%', dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: function(v) { return v.toFixed(1) + '%'; }, offsetY: -20, style: { fontSize: '13px', fontWeight: 700, colors: [NLB_COLOR] } },
        xaxis: { categories: ['Total Dep.', 'Retail Dep.', 'Corp. Dep.'], labels: { style: { fontSize: '12px' } } },
        yaxis: { labels: { formatter: function(v) { return v.toFixed(0) + '%'; }, style: { fontSize: '11px' } }, max: Math.max.apply(null, depShares) + 5 },
        grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: function(v) { return v.toFixed(2) + '%'; } } }
    });

    // Deposit trend NLB
    var depTrendSeries = ['Total Deposits', 'Deposits from Retail', 'Deposits from Corporate'].map(function(c) {
        return { name: segLabel(c), data: DATES.map(function(d, i) { return { x: new Date(d).getTime(), y: getVal('eur', c, 'NLB', i) }; }).filter(function(p) { return p.y != null; }) };
    });
    renderChart('chartDepositTrend', {
        chart: { type: 'line', height: 320, fontFamily: 'Inter, sans-serif' },
        series: depTrendSeries, colors: [NLB_COLOR, '#0d8a56', '#d68a00'],
        stroke: { width: [3, 2, 2], curve: 'smooth' },
        xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
        yaxis: { labels: { formatter: function(v) { return fmt(v, 0); }, style: { fontSize: '11px' } } },
        dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return fmtK(v) + ' k EUR'; } } },
        legend: { position: 'top', fontSize: '12px' }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }
    });

    // Interest expense bar chart
    var intExpData = BANKS.map(function(b) { return { bank: b, val: Math.abs((prof && prof.plItems && prof.plItems['Interest Expense']) ? prof.plItems['Interest Expense'][b] || 0 : 0) }; }).sort(function(a, b) { return b.val - a.val; });
    renderChart('chartIntExpense', {
        chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' },
        series: [{ name: 'Interest Expense (k EUR)', data: intExpData.map(function(d) { return { x: d.bank, y: d.val }; }) }],
        colors: [function(opts) { return intExpData[opts.dataPointIndex] && intExpData[opts.dataPointIndex].bank === 'NLB' ? NLB_COLOR : '#6b7280'; }],
        plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: function(v) { return commaFmt(v, 0); }, offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } },
        xaxis: { labels: { formatter: function(v) { return commaFmt(v, 0); }, style: { fontSize: '11px' } } },
        yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } },
        legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: function(v) { return commaFmt(v, 0) + ' k EUR'; } } }
    });

    // Deposit peer comparison
    var depPeerData = BANKS.map(function(b) { return { bank: b, val: getVal('pct', 'Total Deposits', b, idx) || 0 }; }).sort(function(a, b) { return b.val - a.val; });
    renderChart('chartDepositPeer', {
        chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' },
        series: [{ name: 'Deposit Share %', data: depPeerData.map(function(d) { return { x: d.bank, y: d.val }; }) }],
        colors: [function(opts) { return depPeerData[opts.dataPointIndex] && depPeerData[opts.dataPointIndex].bank === 'NLB' ? NLB_COLOR : '#6b7280'; }],
        plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: function(v) { return v.toFixed(1) + '%'; }, offsetX: 30, style: { fontSize: '12px', fontWeight: 700, colors: ['#333'] } },
        xaxis: { labels: { formatter: function(v) { return v.toFixed(0) + '%'; }, style: { fontSize: '11px' } } },
        yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } },
        legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: function(v) { return v.toFixed(2) + '%'; } } }
    });

    // === NEW CHARTS ===
    // chartDepProductTrend: Stacked area CA/Saving/TDA
    var productCats = ['Deposits CA', 'Deposits Saving', 'Deposits TDA'];
    var productSeries = productCats.map(function(c) {
        return { name: c.replace('Deposits ', ''), data: DATES.map(function(d, i) { return { x: new Date(d).getTime(), y: getVal('eur', c, 'NLB', i) }; }).filter(function(p) { return p.y != null; }) };
    });
    renderChart('chartDepProductTrend', {
        chart: { type: 'area', height: 320, stacked: true, fontFamily: 'Inter, sans-serif' },
        series: productSeries, colors: [NLB_COLOR, '#0d8a56', '#d68a00'],
        stroke: { width: 2, curve: 'smooth' },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.6, opacityTo: 0.1 } },
        xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
        yaxis: { labels: { formatter: function(v) { return fmt(v, 0); }, style: { fontSize: '11px' } } },
        dataLabels: { enabled: false },
        tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return fmtK(v) + ' k EUR'; } } },
        legend: { position: 'top', fontSize: '12px' }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }
    });

    // chartDepProductMix: Donut CA/Saving/TDA
    var mixVals = [nlbCA, nlbSaving, nlbTDA].filter(function(v) { return v > 0; });
    var mixLabels = ['CA', 'Saving', 'TDA'].filter(function(l, i) { return [nlbCA, nlbSaving, nlbTDA][i] > 0; });
    if (mixVals.length > 0) {
        renderChart('chartDepProductMix', {
            chart: { type: 'donut', height: 320, fontFamily: 'Inter, sans-serif' },
            series: mixVals, labels: mixLabels,
            colors: [NLB_COLOR, '#0d8a56', '#d68a00'],
            plotOptions: { pie: { donut: { size: '55%', labels: { show: true, value: { formatter: function(v) { return fmtPct(parseFloat(v) / nlbDepVal * 100, 1); } }, total: { show: true, label: 'Total', formatter: function() { return fmt(nlbDepVal); } } } } } },
            dataLabels: { enabled: true, formatter: function(v) { return v.toFixed(1) + '%'; }, style: { fontSize: '12px', fontWeight: 600 } },
            legend: { position: 'bottom', fontSize: '12px' }, stroke: { width: 2, colors: ['#fff'] },
            tooltip: { y: { formatter: function(v) { return fmtK(v) + ' k EUR'; } } }
        });
    }

    // chartIntExpDepTrend: Interest Expense / Total Deposits ratio trend
    // Interest Expenses data starts from period index 8
    var ieDepTrendData = [];
    for (var ti = 0; ti < DATES.length; ti++) {
        var ieVal = getVal('eur', 'Interest Expenses', 'NLB', ti);
        var depVal2 = getVal('eur', 'Total Deposits', 'NLB', ti);
        if (ieVal != null && depVal2 != null && depVal2 > 0) {
            ieDepTrendData.push({ x: new Date(DATES[ti]).getTime(), y: parseFloat((Math.abs(ieVal) / depVal2 * 100).toFixed(4)) });
        }
    }
    if (ieDepTrendData.length > 0) {
        renderChart('chartIntExpDepTrend', {
            chart: { type: 'line', height: 320, fontFamily: 'Inter, sans-serif' },
            series: [{ name: 'Int. Expense / Deposits %', data: ieDepTrendData }], colors: ['#c0392b'],
            stroke: { width: 3, curve: 'smooth' },
            xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
            yaxis: { labels: { formatter: function(v) { return v.toFixed(2) + '%'; }, style: { fontSize: '11px' } } },
            dataLabels: { enabled: false },
            tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return v.toFixed(4) + '%'; } } },
            markers: { size: 4 },
            grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }
        });
    }

    // chartLTDPeer: Horizontal bar of LTD ratio for all banks
    var ltdPeerData = BANKS.map(function(b) {
        var loans = getVal('eur', 'Gross Loans', b, idx) || 0;
        var deps = getVal('eur', 'Total Deposits', b, idx) || 1;
        return { bank: b, val: loans / deps * 100 };
    }).sort(function(a, b) { return b.val - a.val; });
    renderChart('chartLTDPeer', {
        chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' },
        series: [{ name: 'LTD Ratio %', data: ltdPeerData.map(function(d) { return { x: d.bank, y: parseFloat(d.val.toFixed(1)) }; }) }],
        colors: [function(opts) { return ltdPeerData[opts.dataPointIndex] && ltdPeerData[opts.dataPointIndex].bank === 'NLB' ? NLB_COLOR : '#6b7280'; }],
        plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: function(v) { return v.toFixed(1) + '%'; }, offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } },
        xaxis: { labels: { formatter: function(v) { return v.toFixed(0) + '%'; }, style: { fontSize: '11px' } } },
        yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } },
        legend: { show: false }, grid: { borderColor: '#f0f0f0' },
        tooltip: { y: { formatter: function(v) { return v.toFixed(2) + '%'; } } },
        annotations: { xaxis: [{ x: 100, borderColor: '#c0392b', strokeDashArray: 4, label: { text: '100%', style: { background: '#c0392b', color: '#fff', fontSize: '10px' } } }] }
    });

    // chartDepShareVsCost: Scatter plot
    var scatterData = BANKS.map(function(b) {
        var depShare = getVal('pct', 'Total Deposits', b, idx) || 0;
        var bankIntExp = Math.abs((prof && prof.plItems && prof.plItems['Interest Expense']) ? prof.plItems['Interest Expense'][b] || 0 : 0);
        var totalIntExp = Math.abs((prof && prof.plItems && prof.plItems['Interest Expense']) ? prof.plItems['Interest Expense'].Total || 0 : 1);
        var intExpPct = totalIntExp > 0 ? (bankIntExp / totalIntExp * 100) : 0;
        return { bank: b, x: depShare, y: intExpPct };
    });
    renderChart('chartDepShareVsCost', {
        chart: { type: 'scatter', height: 420, fontFamily: 'Inter, sans-serif', zoom: { enabled: false } },
        series: [{ name: 'Banks', data: scatterData.map(function(d) { return { x: d.x, y: d.y }; }) }],
        colors: scatterData.map(function(d) { return d.bank === 'NLB' ? NLB_COLOR : '#9ca3af'; }),
        markers: { size: scatterData.map(function(d) { return d.bank === 'NLB' ? 14 : 8; }) },
        xaxis: { title: { text: 'Deposit Market Share (%)', style: { fontSize: '12px', fontWeight: 600 } }, labels: { formatter: function(v) { return v.toFixed(1); }, style: { fontSize: '10px' } } },
        yaxis: { title: { text: 'Interest Expense Share of Sector (%)', style: { fontSize: '12px', fontWeight: 600 } }, labels: { formatter: function(v) { return v.toFixed(1); }, style: { fontSize: '10px' } } },
        dataLabels: { enabled: true, formatter: function(v, opts) { return scatterData[opts.dataPointIndex] ? scatterData[opts.dataPointIndex].bank : ''; }, style: { fontSize: '10px', fontWeight: 700 }, offsetY: -8 },
        tooltip: { custom: function(opts) { var d = scatterData[opts.dataPointIndex]; return '<div style="padding:8px;font-size:12px"><strong>' + d.bank + '</strong><br>Deposit Share: ' + d.x.toFixed(2) + '%<br>Int. Exp. Share: ' + d.y.toFixed(2) + '%</div>'; } },
        grid: { borderColor: '#f0f0f0' }, legend: { show: false },
        annotations: { yaxis: [{ y: 0, borderColor: '#ddd' }], points: [{ x: 0, y: 0 }] }
    });
}

// ============================================================
// SECTION 11: PROFITABILITY (enhanced with trend assessment + charts)
// ============================================================
function updateProfitability() {
    var prof = D.profitability; if (!prof) return;
    var pl = prof.plItems; var ratios = prof.ratios; var ranks = prof.ranks;
    document.getElementById('kpiNlbNetProfit').textContent = fmt(pl['Net Profit']['NLB']); document.getElementById('kpiNlbProfitUnit').textContent = fmtUnit(pl['Net Profit']['NLB']);
    document.getElementById('kpiSectorNetProfit').textContent = fmt(pl['Net Profit']['Total']); document.getElementById('kpiSectorProfitUnit').textContent = fmtUnit(pl['Net Profit']['Total']);
    document.getElementById('kpiNlbROE').textContent = commaFmt(ratios['ROE']['NLB'], 2); document.getElementById('kpiNlbCIR').textContent = commaFmt(ratios['CIR']['NLB'], 1);
    document.getElementById('kpiNlbProfitRank').textContent = '#' + ranks['Net Profit']['NLB']; document.getElementById('kpiNlbProfitShare').textContent = commaFmt(ratios['Net Profit Market Share']['NLB'], 1);
    var nlbROE = ratios['ROE']['NLB']; var nlbCIR = ratios['CIR']['NLB']; var avgROE = BANKS.reduce(function(s, b) { return s + (ratios['ROE'][b] || 0); }, 0) / BANKS.length; var avgCIR = BANKS.reduce(function(s, b) { return s + (ratios['CIR'][b] || 0); }, 0) / BANKS.length;
    var insP = []; insP.push('NLB reported net profit of ' + commaFmt(pl['Net Profit']['NLB'], 0) + ' k EUR, ranking #' + ranks['Net Profit']['NLB'] + ' and capturing ' + commaFmt(ratios['Net Profit Market Share']['NLB'], 1) + '% of sector profits.');
    insP.push('ROE of ' + commaFmt(nlbROE, 1) + '% ' + (nlbROE > avgROE ? 'exceeds' : 'trails') + ' the average of ' + commaFmt(avgROE, 1) + '%.');
    insP.push('CIR at ' + commaFmt(nlbCIR, 1) + '% is ' + (nlbCIR < avgCIR ? 'best in class' : 'above average') + ' \u2014 ' + (nlbCIR < 40 ? 'exceptional' : nlbCIR < 50 ? 'strong' : 'moderate') + ' efficiency.');
    document.getElementById('plInsightText').textContent = insP.join(' ');

    // Charts
    var profitData = BANKS.map(function(b) { return { bank: b, val: pl['Net Profit'][b] || 0 }; }).sort(function(a, b) { return b.val - a.val; });
    renderChart('chartNetProfit', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Net Profit (k EUR)', data: profitData.map(function(d) { return { x: d.bank, y: Math.round(d.val) }; }) }], colors: [function(opts) { return profitData[opts.dataPointIndex] && profitData[opts.dataPointIndex].bank === 'NLB' ? NLB_COLOR : (profitData[opts.dataPointIndex] && profitData[opts.dataPointIndex].val >= 0 ? '#6b7280' : '#c0392b'); }], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: function(v) { return commaFmt(v, 0); }, offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: function(v) { return commaFmt(v, 0); }, style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: function(v) { return commaFmt(v, 0) + ' k EUR'; } } } });

    var top5 = profitData.filter(function(d) { return d.val > 0; }).slice(0, 6).map(function(d) { return d.bank; });
    renderChart('chartIncomeStructure', { chart: { type: 'bar', height: 420, stacked: true, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'NII', data: top5.map(function(b) { return pl['Net Interest Income'][b] || 0; }) }, { name: 'NFCI', data: top5.map(function(b) { return pl['Net Fee & Commission Income'][b] || 0; }) }, { name: 'Other', data: top5.map(function(b) { return (pl['Total Income'][b] || 0) - (pl['Net Interest Income'][b] || 0) - (pl['Net Fee & Commission Income'][b] || 0); }) }], colors: [NLB_COLOR, '#6b7280', '#d4d4e8'], plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } }, xaxis: { categories: top5, labels: { style: { fontSize: '12px', fontWeight: 600 } } }, yaxis: { labels: { formatter: function(v) { return commaFmt(v, 0); }, style: { fontSize: '11px' } } }, dataLabels: { enabled: false }, legend: { position: 'top', fontSize: '12px' }, tooltip: { y: { formatter: function(v) { return commaFmt(v, 0) + ' k EUR'; } } }, grid: { borderColor: '#f0f0f0' } });

    var roeData = BANKS.map(function(b) { return { bank: b, val: ratios['ROE'][b] || 0 }; }).sort(function(a, b) { return b.val - a.val; });
    renderChart('chartROE', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'ROE %', data: roeData.map(function(d) { return { x: d.bank, y: d.val }; }) }], colors: [function(opts) { return roeData[opts.dataPointIndex] && roeData[opts.dataPointIndex].bank === 'NLB' ? NLB_COLOR : (roeData[opts.dataPointIndex] && roeData[opts.dataPointIndex].val >= 0 ? '#6b7280' : '#c0392b'); }], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: function(v) { return commaFmt(v, 1) + '%'; }, offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: function(v) { return v.toFixed(0) + '%'; }, style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: function(v) { return commaFmt(v, 2) + '%'; } } } });

    var cirData = BANKS.map(function(b) { return { bank: b, val: ratios['CIR'][b] || 0 }; }).sort(function(a, b) { return a.val - b.val; });
    renderChart('chartCIR', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'CIR %', data: cirData.map(function(d) { return { x: d.bank, y: d.val }; }) }], colors: [function(opts) { var b2 = cirData[opts.dataPointIndex]; return b2 && b2.bank === 'NLB' ? NLB_COLOR : (b2 && b2.val <= 50 ? '#0d8a56' : b2 && b2.val <= 80 ? '#d68a00' : '#c0392b'); }], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: function(v) { return commaFmt(v, 1) + '%'; }, offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: function(v) { return v.toFixed(0) + '%'; }, style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: function(v) { return commaFmt(v, 2) + '%'; } } }, annotations: { xaxis: [{ x: 50, borderColor: '#c0392b', strokeDashArray: 4, label: { text: '50%', style: { background: '#c0392b', color: '#fff', fontSize: '10px' } } }] } });

    var roaData = BANKS.map(function(b) { return { bank: b, val: ratios['ROA'][b] || 0 }; }).sort(function(a, b) { return b.val - a.val; });
    renderChart('chartROA', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'ROA %', data: roaData.map(function(d) { return { x: d.bank, y: d.val }; }) }], colors: [function(opts) { return roaData[opts.dataPointIndex] && roaData[opts.dataPointIndex].bank === 'NLB' ? NLB_COLOR : (roaData[opts.dataPointIndex] && roaData[opts.dataPointIndex].val >= 0 ? '#6b7280' : '#c0392b'); }], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: function(v) { return commaFmt(v, 2) + '%'; }, offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: function(v) { return v.toFixed(1) + '%'; }, style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: function(v) { return commaFmt(v, 2) + '%'; } } } });

    var nplData = BANKS.map(function(b) { return { bank: b, npl: ratios['NPL'][b] || 0, coverage: ratios['Coverage Ratio'][b] || 0 }; }).sort(function(a, b) { return a.npl - b.npl; });
    renderChart('chartNPL', { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'NPL %', data: nplData.map(function(d) { return d.npl; }), type: 'bar' }, { name: 'Coverage %', data: nplData.map(function(d) { return d.coverage; }), type: 'line' }], colors: [function(opts) { return nplData[opts.dataPointIndex] && nplData[opts.dataPointIndex].bank === 'NLB' ? NLB_COLOR : '#6b7280'; }, '#0d8a56'], plotOptions: { bar: { borderRadius: 3, columnWidth: '50%' } }, xaxis: { categories: nplData.map(function(d) { return d.bank; }), labels: { style: { fontSize: '12px', fontWeight: 600 } } }, yaxis: [{ title: { text: 'NPL %' }, labels: { formatter: function(v) { return v.toFixed(1) + '%'; }, style: { fontSize: '11px' } } }, { opposite: true, title: { text: 'Coverage %' }, labels: { formatter: function(v) { return v.toFixed(0) + '%'; }, style: { fontSize: '11px' } } }], dataLabels: { enabled: false }, legend: { position: 'top', fontSize: '12px' }, tooltip: { y: { formatter: function(v) { return commaFmt(v, 2) + '%'; } } }, grid: { borderColor: '#f0f0f0' }, stroke: { width: [0, 3], curve: 'smooth' }, markers: { size: [0, 5] } });

    // P&L Item bar charts
    function plBarChart(chartId, plItemKey, label, sortDesc) {
        if (sortDesc === undefined) sortDesc = true;
        var itemData = pl[plItemKey]; if (!itemData) return;
        var sorted2 = BANKS.map(function(b) { return { bank: b, val: itemData[b] || 0 }; }).sort(function(a, b) { return sortDesc ? b.val - a.val : a.val - b.val; });
        renderChart(chartId, { chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif' }, series: [{ name: label + ' (k EUR)', data: sorted2.map(function(d) { return { x: d.bank, y: Math.round(d.val) }; }) }], colors: [function(opts) { return sorted2[opts.dataPointIndex] && sorted2[opts.dataPointIndex].bank === 'NLB' ? NLB_COLOR : (sorted2[opts.dataPointIndex] && sorted2[opts.dataPointIndex].val >= 0 ? '#6b7280' : '#c0392b'); }], plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true, dataLabels: { position: 'top' } } }, dataLabels: { enabled: true, formatter: function(v) { return commaFmt(v, 0); }, offsetX: 30, style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] } }, xaxis: { labels: { formatter: function(v) { return commaFmt(v, 0); }, style: { fontSize: '11px' } } }, yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } }, legend: { show: false }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: function(v) { return commaFmt(v, 0) + ' k EUR'; } } } });
    }
    plBarChart('chartInterestIncome', 'Interest Income', 'Interest Income');
    plBarChart('chartInterestExpense', 'Interest Expense', 'Interest Expense', false);
    plBarChart('chartFeeCommIncome', 'Fee & Commission Income', 'Fee & Comm. Income');
    plBarChart('chartFeeCommExpense', 'Fee & Commission Expense', 'Fee & Comm. Expense', false);
    plBarChart('chartNetFeeCommIncome', 'Net Fee & Commission Income', 'Net Fee & Comm. Income');
    plBarChart('chartOpExpenses', 'Operating Expenses', 'Operating Expenses', false);

    // Tables
    var plItems = ['Interest Income', 'Interest Expense', 'Net Interest Income', 'Fee & Commission Income', 'Fee & Commission Expense', 'Net Fee & Commission Income', 'Total Income', 'Operating Expenses', 'Total Impairment', 'Profit Before Tax', 'Net Profit'];
    document.getElementById('plTableHead').innerHTML = '<tr><th>P&L Item</th>' + BANKS.map(function(b) { return '<th' + (b === 'NLB' ? ' class="nlb-col"' : '') + '>' + b + '</th>'; }).join('') + '<th>Total</th></tr>';
    var tb = document.getElementById('plTableBody'); tb.innerHTML = '';
    var boldItems = ['Net Interest Income', 'Total Income', 'Profit Before Tax', 'Net Profit'];
    plItems.forEach(function(item) { var data = pl[item]; if (!data) return; var isBold = boldItems.indexOf(item) >= 0; var isExp = (data['NLB'] || 0) < 0;
        tb.innerHTML += '<tr class="' + (isBold ? 'pl-bold-row' : '') + ' ' + (isExp ? 'pl-expense-row' : '') + '"><td><strong>' + item + '</strong></td>' + BANKS.map(function(b) { return '<td' + (b === 'NLB' ? ' class="nlb-col"' : '') + '>' + (data[b] != null ? commaFmt(data[b], 0) : '\u2014') + '</td>'; }).join('') + '<td><strong>' + (data['Total'] != null ? commaFmt(data['Total'], 0) : '\u2014') + '</strong></td></tr>'; });

    var ratioItems = ['ROA', 'ROE', 'CIR', 'NPL', 'CAR', 'Coverage Ratio', 'LCR', 'NII to Total Income', 'Net Profit Market Share'];
    var ratioLabels = { 'ROA': 'ROA (%)', 'ROE': 'ROE (%)', 'CIR': 'CIR (%)', 'NPL': 'NPL (%)', 'CAR': 'CAR (%)', 'Coverage Ratio': 'Coverage (%)', 'LCR': 'LCR (%)', 'NII to Total Income': 'NII/Income (%)', 'Net Profit Market Share': 'Profit Share (%)' };
    document.getElementById('ratiosTableHead').innerHTML = '<tr><th>Ratio</th>' + BANKS.map(function(b) { return '<th' + (b === 'NLB' ? ' class="nlb-col"' : '') + '>' + b + '</th>'; }).join('') + '</tr>';
    var rb = document.getElementById('ratiosTableBody'); rb.innerHTML = '';
    ratioItems.forEach(function(r) { var data = ratios[r]; if (!data) return; var isLB = ['CIR', 'NPL'].indexOf(r) >= 0; var vals = BANKS.map(function(b) { return { b: b, v: data[b] }; }).filter(function(d) { return d.v != null; }); var best = isLB ? vals.reduce(function(m, d) { return d.v < m.v ? d : m; }, vals[0]) : vals.reduce(function(m, d) { return d.v > m.v ? d : m; }, vals[0]);
        rb.innerHTML += '<tr><td><strong>' + (ratioLabels[r] || r) + '</strong></td>' + BANKS.map(function(b) { var v = data[b]; var isBest = best && best.b === b; return '<td class="' + (b === 'NLB' ? 'nlb-col' : '') + ' ' + (isBest ? 'best-ratio' : '') + '">' + (v != null ? commaFmt(v, 2) : '\u2014') + (isBest ? ' \u2605' : '') + '</td>'; }).join('') + '</tr>'; });

    // === ENHANCEMENT: Profitability Trend Assessment ===
    var idx = getSelectedPeriodIdx();
    var prevIdx = idx > 0 ? idx - 1 : null;
    var profTrendParts = [];

    // Net Profit trajectory
    var npArr = D.eur && D.eur['Net Profit'] && D.eur['Net Profit']['NLB'] ? D.eur['Net Profit']['NLB'] : null;
    if (npArr) {
        var validNP = [];
        for (var ni = 0; ni < npArr.length; ni++) { if (npArr[ni] != null) validNP.push({ idx: ni, val: npArr[ni] }); }
        if (validNP.length >= 2) {
            var latest = validNP[validNP.length - 1];
            var prior = validNP[validNP.length - 2];
            var npChange = latest.val - prior.val;
            var npGr = prior.val !== 0 ? ((latest.val / prior.val - 1) * 100) : 0;
            profTrendParts.push('NLB net profit ' + (npChange >= 0 ? 'increased' : 'decreased') + ' by ' + commaFmt(Math.abs(npChange), 0) + ' k EUR (' + (npGr >= 0 ? '+' : '') + npGr.toFixed(1) + '%) vs prior period.');
        }
    }

    // Profit share trend
    var npPctArr = D.pct && D.pct['Net Profit'] && D.pct['Net Profit']['NLB'] ? D.pct['Net Profit']['NLB'] : null;
    if (npPctArr && prevIdx != null && npPctArr[idx] != null && npPctArr[prevIdx] != null) {
        var profShareChg = npPctArr[idx] - npPctArr[prevIdx];
        profTrendParts.push('NLB profit share of sector: ' + npPctArr[idx].toFixed(1) + '% (' + (profShareChg >= 0 ? '+' : '') + profShareChg.toFixed(1) + 'pp vs prior).');
    }

    // CIR/ROE commentary
    profTrendParts.push('CIR at ' + commaFmt(nlbCIR, 1) + '% ' + (nlbCIR < avgCIR ? 'outperforms' : 'lags') + ' sector average of ' + commaFmt(avgCIR, 1) + '%. ROE at ' + commaFmt(nlbROE, 1) + '% ' + (nlbROE > avgROE ? 'exceeds' : 'trails') + ' average ' + commaFmt(avgROE, 1) + '%.');
    setTextIfExists('profTrendAssessmentText', profTrendParts.join(' '));

    // === NEW TREND CHARTS ===
    // chartProfitTrend: NLB Net Profit over time
    if (npArr) {
        var npTrendData = [];
        for (var pi = 0; pi < DATES.length; pi++) { if (npArr[pi] != null) npTrendData.push({ x: new Date(DATES[pi]).getTime(), y: npArr[pi] }); }
        if (npTrendData.length > 1) {
            renderChart('chartProfitTrend', {
                chart: { type: 'line', height: 320, fontFamily: 'Inter, sans-serif' },
                series: [{ name: 'NLB Net Profit', data: npTrendData }], colors: [NLB_COLOR],
                stroke: { width: 3, curve: 'smooth' },
                xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
                yaxis: { labels: { formatter: function(v) { return fmt(v, 0); }, style: { fontSize: '11px' } } },
                dataLabels: { enabled: false }, markers: { size: 4 },
                tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return commaFmt(v, 0) + ' k EUR'; } } },
                grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }
            });
        }
    }

    // chartProfitShareTrend: NLB Net Profit market share over time
    if (npPctArr) {
        var npShareTrendData = [];
        for (var psi = 0; psi < DATES.length; psi++) { if (npPctArr[psi] != null) npShareTrendData.push({ x: new Date(DATES[psi]).getTime(), y: npPctArr[psi] }); }
        if (npShareTrendData.length > 1) {
            renderChart('chartProfitShareTrend', {
                chart: { type: 'area', height: 320, fontFamily: 'Inter, sans-serif' },
                series: [{ name: 'NLB Profit Share %', data: npShareTrendData }], colors: [NLB_COLOR],
                fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 } },
                stroke: { width: 3, curve: 'smooth' },
                xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
                yaxis: { labels: { formatter: function(v) { return v.toFixed(1) + '%'; }, style: { fontSize: '11px' } } },
                dataLabels: { enabled: false },
                tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return v.toFixed(2) + '%'; } } },
                grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }
            });
        }
    }

    // chartROETrend and chartCIRTrend: placeholders
    var roeTrendEl = document.getElementById('chartROETrend');
    if (roeTrendEl) roeTrendEl.innerHTML = '<p style="text-align:center; color:#999; padding-top:60px;">Structure ready \u2014 requires multi-period ratio data feed</p>';
    var cirTrendEl = document.getElementById('chartCIRTrend');
    if (cirTrendEl) cirTrendEl.innerHTML = '<p style="text-align:center; color:#999; padding-top:60px;">Structure ready \u2014 requires multi-period ratio data feed</p>';
}


// ============================================================
// SECTION 12: PEER QUADRANTS
// ============================================================
function updateQuadrants() {
    var idx = getSelectedPeriodIdx();
    var prevIdx = idx > 0 ? idx - 1 : idx;
    var prof = D.profitability;
    var ratios = prof ? prof.ratios : null;
    if (!ratios) return;

    function scatterChart(id, xLabel, yLabel, data) {
        renderChart(id, {
            chart: { type: 'scatter', height: 420, fontFamily: 'Inter, sans-serif', zoom: { enabled: false } },
            series: [{ name: 'Banks', data: data.map(function(d) { return { x: d.x, y: d.y }; }) }],
            colors: data.map(function(d) { return d.bank === 'NLB' ? NLB_COLOR : '#9ca3af'; }),
            markers: { size: data.map(function(d) { return d.bank === 'NLB' ? 14 : 8; }) },
            xaxis: { title: { text: xLabel, style: { fontSize: '12px', fontWeight: 600 } }, labels: { formatter: function(v) { return v.toFixed(1); }, style: { fontSize: '10px' } } },
            yaxis: { title: { text: yLabel, style: { fontSize: '12px', fontWeight: 600 } }, labels: { formatter: function(v) { return v.toFixed(1); }, style: { fontSize: '10px' } } },
            dataLabels: { enabled: true, formatter: function(v, opts) { return data[opts.dataPointIndex] ? data[opts.dataPointIndex].bank : ''; }, style: { fontSize: '10px', fontWeight: 700 }, offsetY: -8 },
            tooltip: { custom: function(opts) { var d = data[opts.dataPointIndex]; return '<div style="padding:8px;font-size:12px"><strong>' + d.bank + '</strong><br>' + xLabel + ': ' + d.x.toFixed(2) + '<br>' + yLabel + ': ' + d.y.toFixed(2) + '</div>'; } },
            grid: { borderColor: '#f0f0f0' }, legend: { show: false }
        });
    }

    var q1 = BANKS.map(function(b) {
        var share = getVal('pct', 'Assets', b, idx) || 0;
        var cur = getVal('eur', 'Assets', b, idx); var prev = getVal('eur', 'Assets', b, prevIdx);
        var gr = prev ? ((cur / prev - 1) * 100) : 0;
        return { bank: b, x: share, y: gr };
    });
    scatterChart('chartQuad1', 'Market Share (%)', 'Growth (%)', q1);

    var q2 = BANKS.map(function(b) { return { bank: b, x: ratios['CIR'][b] || 0, y: ratios['ROE'][b] || 0 }; });
    scatterChart('chartQuad2', 'CIR (%) \u2014 lower is better', 'ROE (%)', q2);

    var q3 = BANKS.map(function(b) { return { bank: b, x: ratios['NPL'][b] || 0, y: ratios['Coverage Ratio'][b] || 0 }; });
    scatterChart('chartQuad3', 'NPL Ratio (%)', 'Coverage Ratio (%)', q3);

    var q4 = BANKS.map(function(b) {
        var depShare = getVal('pct', 'Total Deposits', b, idx) || 0;
        var loanCur = getVal('eur', 'Gross Loans', b, idx); var loanPrev = getVal('eur', 'Gross Loans', b, prevIdx);
        var loanGr = loanPrev ? ((loanCur / loanPrev - 1) * 100) : 0;
        return { bank: b, x: depShare, y: loanGr };
    });
    scatterChart('chartQuad4', 'Deposit Share (%)', 'Loan Growth (%)', q4);
}

// ============================================================
// SECTION 13: OPPORTUNITY SCANNER (enhanced with Management Notes + Rationale)
// ============================================================
function updateScanner() {
    var idx = getSelectedPeriodIdx();
    var prevIdx = idx > 0 ? idx - 1 : idx;

    var rows = CATS.map(function(cat) {
        var nlbShare = getVal('pct', cat, 'NLB', idx) || 0;
        var sorted = getSortedBanks(cat, idx);
        var rank = sorted.indexOf('NLB') + 1;
        var leaderShare = getVal('pct', cat, sorted[0], idx) || 0;
        var gap = nlbShare - leaderShare;
        var nlbCur = getVal('eur', cat, 'NLB', idx); var nlbPrev = getVal('eur', cat, 'NLB', prevIdx);
        var nlbGr = nlbPrev ? ((nlbCur / nlbPrev - 1) * 100) : 0;
        var mktCur = getVal('eur', cat, 'Total', idx); var mktPrev = getVal('eur', cat, 'Total', prevIdx);
        var mktGr = mktPrev ? ((mktCur / mktPrev - 1) * 100) : 0;

        var action, actionClass, mgmtNote;
        if (rank <= 2 && nlbGr >= mktGr) {
            action = 'Defend'; actionClass = 'action-defend';
            mgmtNote = 'Strong position (#' + rank + '). Growth at or above market. Focus on retention and cross-sell. Issue: maintaining scale advantage.';
        } else if (rank <= 3 && nlbGr > 0 && Math.abs(gap) < 5) {
            action = 'Attack'; actionClass = 'action-attack';
            mgmtNote = 'Close to leadership (gap ' + Math.abs(gap).toFixed(1) + 'pp). Growing positively. Opportunity to gain share with targeted campaigns. Issue: growth acceleration.';
        } else if (nlbGr < mktGr && rank > 3) {
            action = 'Fix'; actionClass = 'action-fix';
            mgmtNote = 'Underperforming market (NLB +' + nlbGr.toFixed(1) + '% vs mkt +' + mktGr.toFixed(1) + '%). Rank #' + rank + ' is weak. Diagnose pricing/product gaps. Issue: competitiveness.';
        } else if (nlbGr < 0 && rank > 5) {
            action = 'Deprioritize'; actionClass = 'action-deprioritize';
            mgmtNote = 'Low share (#' + rank + '), declining value. Not a strategic priority. Monitor but do not allocate incremental resources. Issue: scale too small.';
        } else if (nlbGr >= mktGr) {
            action = 'Attack'; actionClass = 'action-attack';
            mgmtNote = 'Growing faster than market. Positive momentum to exploit. Increase investment to accelerate share gains. Issue: sustaining growth.';
        } else {
            action = 'Fix'; actionClass = 'action-fix';
            mgmtNote = 'Growing below market rate. Risk of further share erosion. Review competitive positioning and pricing. Issue: growth deficit.';
        }

        return { cat: cat, nlbShare: nlbShare, rank: rank, gap: gap, nlbGr: nlbGr, mktGr: mktGr, action: action, actionClass: actionClass, mgmtNote: mgmtNote };
    });

    var sb = document.getElementById('scannerBody'); sb.innerHTML = '';
    rows.forEach(function(r) {
        sb.innerHTML += '<tr class="' + (r.cat === getSelectedCategory() ? 'nlb-row' : '') + '"><td><strong>' + r.cat + '</strong></td><td>' + fmtPct(r.nlbShare) + '</td><td>#' + r.rank + '</td><td class="' + (r.gap >= 0 ? 'kpi-positive' : 'kpi-negative') + '">' + (r.gap >= 0 ? 'Leader' : fmtPP(r.gap) + 'pp') + '</td><td class="' + (r.nlbGr >= 0 ? 'kpi-positive' : 'kpi-negative') + '">' + (r.nlbGr > 0 ? '+' : '') + r.nlbGr.toFixed(1) + '%</td><td>' + (r.mktGr > 0 ? '+' : '') + r.mktGr.toFixed(1) + '%</td><td><span class="action-label ' + r.actionClass + '">' + r.action + '</span></td><td style="font-size:0.8rem;max-width:280px">' + r.mgmtNote + '</td></tr>';
    });

    var attackSegs = rows.filter(function(r) { return r.action === 'Attack'; }).map(function(r) { return r.cat; });
    var defendSegs = rows.filter(function(r) { return r.action === 'Defend'; }).map(function(r) { return r.cat; });
    var fixSegs = rows.filter(function(r) { return r.action === 'Fix'; }).map(function(r) { return r.cat; });
    var depriSegs = rows.filter(function(r) { return r.action === 'Deprioritize'; }).map(function(r) { return r.cat; });
    var si = [];
    if (defendSegs.length > 0) si.push('Defend positions in: ' + defendSegs.join(', ') + '.');
    if (attackSegs.length > 0) si.push('Growth opportunity (Attack) in: ' + attackSegs.join(', ') + '.');
    if (fixSegs.length > 0) si.push('Underperformance requires attention (Fix) in: ' + fixSegs.join(', ') + '.');
    document.getElementById('scannerInsightText').textContent = si.join(' ') || 'All segments analyzed.';

    // === ENHANCEMENT: Strategy Rationale ===
    var rationale = [];
    rationale.push('Overall strategy: NLB has ' + defendSegs.length + ' segments to defend, ' + attackSegs.length + ' to attack, ' + fixSegs.length + ' requiring fixes, and ' + depriSegs.length + ' to deprioritize.');
    if (defendSegs.length > attackSegs.length) {
        rationale.push('NLB\'s portfolio is primarily in defend mode \u2014 strong positions but limited offensive growth. Consider shifting resources from defend to attack segments for share expansion.');
    } else if (attackSegs.length > defendSegs.length) {
        rationale.push('NLB has more attack opportunities than defensive positions \u2014 a growth-oriented posture. Ensure attack segments receive adequate investment to convert momentum into durable share gains.');
    }
    if (fixSegs.length >= 3) {
        rationale.push('Multiple segments require fixing (' + fixSegs.length + '). Prioritize by market size and strategic importance rather than spreading resources thin.');
    }
    setTextIfExists('scannerRationaleText', rationale.join(' '));
}

// ============================================================
// SECTION 14: STRATEGIC INSIGHTS
// ============================================================
function updateInsights() {
    var idx = getSelectedPeriodIdx(); var prevIdx = idx > 0 ? idx - 1 : 0; var period = dateLabel(DATES[idx]);
    var assetShare = getVal('pct', 'Assets', 'NLB', idx); var assetRank = getSortedBanks('Assets', idx).indexOf('NLB') + 1;
    var leader = getSortedBanks('Assets', idx)[0]; var leaderShare = getVal('pct', 'Assets', leader, idx); var gap = assetShare - leaderShare;
    document.getElementById('insightPosition').textContent = 'NLB holds ' + fmtPct(assetShare) + ' of total banking assets, ranking #' + assetRank + ' as of ' + period + '. Leader is ' + leader + ' with ' + fmtPct(leaderShare) + '. NLB trails by ' + Math.abs(gap).toFixed(2) + 'pp. Top 3 control over ' + ((getVal('pct', 'Assets', getSortedBanks('Assets', idx)[0], idx) || 0) + (getVal('pct', 'Assets', getSortedBanks('Assets', idx)[1], idx) || 0) + (getVal('pct', 'Assets', getSortedBanks('Assets', idx)[2], idx) || 0)).toFixed(0) + '% of assets.';
    var aN = getVal('eur', 'Assets', 'NLB', idx); var aP = getVal('eur', 'Assets', 'NLB', prevIdx); var nlbGr = aP ? ((aN / aP - 1) * 100) : 0;
    var mN = getVal('eur', 'Assets', 'Total', idx); var mP = getVal('eur', 'Assets', 'Total', prevIdx); var mktGr = mP ? ((mN / mP - 1) * 100) : 0;
    document.getElementById('insightGrowth').textContent = 'NLB\'s total assets ' + (nlbGr >= 0 ? 'grew' : 'declined') + ' by ' + Math.abs(nlbGr).toFixed(1) + '%, ' + (nlbGr > mktGr ? 'outpacing' : 'underperforming') + ' the market (' + mktGr.toFixed(1) + '%). ' + (nlbGr > mktGr ? 'This supports share gains.' : 'Pressure on maintaining share.');
    var fg = BANKS.filter(function(b) { return b !== 'NLB'; }).map(function(b) { var c = getVal('eur', 'Assets', b, idx); var pp = getVal('eur', 'Assets', b, prevIdx); return { bank: b, growth: pp ? ((c / pp - 1) * 100) : 0 }; }).sort(function(a, b) { return b.growth - a.growth; });
    document.getElementById('insightThreats').textContent = 'Fastest competitor: ' + fg[0].bank + ' (+' + fg[0].growth.toFixed(1) + '%). ' + (fg[0].growth > nlbGr ? fg[0].bank + ' outgrowing NLB \u2014 potential erosion risk.' : 'NLB currently outpacing competitors.') + ' Monitor scale advantages of ' + leader + ' and mid-tier expansion.';
    var lS = getVal('pct', 'Gross Loans', 'NLB', idx); var dS = getVal('pct', 'Total Deposits', 'NLB', idx);
    document.getElementById('insightOpportunities').textContent = 'NLB lending share (' + fmtPct(lS) + ') vs deposit share (' + fmtPct(dS) + ') suggests ' + (lS > dS ? 'strong deployment \u2014 focus on funding diversification' : 'room to grow loan book against deposit base') + '. Housing loans and retail segments offer upside.';
    var dR = getVal('pct', 'Deposits from Retail', 'NLB', idx); var dC = getVal('pct', 'Deposits from Corporate', 'NLB', idx);
    document.getElementById('insightDeposits').textContent = 'Deposit franchise: retail ' + fmtPct(dR) + ', corporate ' + fmtPct(dC) + '. ' + (dR > dC ? 'Retail deposits are the stronger base.' : 'Corporate deposits relatively stronger.') + ' Low-cost funding stability is critical.';
    var cL = getVal('pct', 'Corporate Loans', 'NLB', idx); var rL = getVal('pct', 'Retail Loans', 'NLB', idx); var hL = getVal('pct', 'Housing Loans', 'NLB', idx);
    document.getElementById('insightLending').textContent = 'Lending: corporate ' + fmtPct(cL) + ', retail ' + fmtPct(rL) + ', housing ' + fmtPct(hL) + '. ' + (cL > rL ? 'Corporate is stronger \u2014 diversify into retail.' : 'Retail well-positioned. Maintain credit quality while growing.');
    var top3D = DATES.map(function(d, i) { var s = getSortedBanks('Assets', i); return { x: new Date(d).getTime(), y: s.slice(0, 3).reduce(function(sum, b) { return sum + (getVal('pct', 'Assets', b, i) || 0); }, 0) }; }).filter(function(p2) { return p2.y > 0; });
    renderChart('chartConcentration', { chart: { type: 'area', height: 320, fontFamily: 'Inter, sans-serif' }, series: [{ name: 'Top 3 Share', data: top3D }], colors: ['#6b7280'], fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 } }, stroke: { width: 2, curve: 'smooth' }, xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } }, yaxis: { labels: { formatter: function(v) { return v.toFixed(0) + '%'; }, style: { fontSize: '11px' } }, min: 40, max: 70 }, dataLabels: { enabled: false }, tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: function(v) { return v.toFixed(1) + '%'; } } }, grid: { borderColor: '#f0f0f0', strokeDashArray: 3 } });
}

// ============================================================
// SECTION 15: METHODOLOGY & AUDIT (enhanced with Deposit + P&L checks)
// ============================================================
function updateMethodology() {
    var idx = getSelectedPeriodIdx();
    var cat = getSelectedCategory();
    var checks = [];

    var shareSum = BANKS.reduce(function(s, b) { return s + (getVal('pct', cat, b, idx) || 0); }, 0);
    checks.push({ check: 'Sum of ' + cat + ' shares = 100%', expected: '100.00%', actual: shareSum.toFixed(2) + '%', pass: Math.abs(shareSum - 100) < 1 });

    var valSum = BANKS.reduce(function(s, b) { return s + (getVal('eur', cat, b, idx) || 0); }, 0);
    var total = getVal('eur', cat, 'Total', idx) || 0;
    checks.push({ check: 'Sum of bank values = Total row (' + cat + ')', expected: fmtK(total), actual: fmtK(valSum), pass: Math.abs(valSum - total) / (total || 1) < 0.01 });

    var nlbVal = getVal('eur', cat, 'NLB', idx) || 0;
    var calcShare = total ? (nlbVal / total * 100) : 0;
    var dataShare = getVal('pct', cat, 'NLB', idx) || 0;
    checks.push({ check: 'NLB share recalculation', expected: calcShare.toFixed(2) + '%', actual: dataShare.toFixed(2) + '%', pass: Math.abs(calcShare - dataShare) < 0.5 });

    if (idx > 0) {
        var prevIdx2 = idx - 1;
        var tCur = getVal('eur', cat, 'Total', idx); var tPrev = getVal('eur', cat, 'Total', prevIdx2);
        var tGrowth = tCur - tPrev;
        if (Math.abs(tGrowth) > 0) {
            var contribSum = BANKS.reduce(function(s, b) {
                var c = getVal('eur', cat, b, idx); var pp = getVal('eur', cat, b, prevIdx2);
                return s + ((c != null && pp != null) ? (c - pp) : 0);
            }, 0);
            checks.push({ check: 'Growth contribution sum = Total growth', expected: fmtK(tGrowth), actual: fmtK(contribSum), pass: Math.abs(contribSum - tGrowth) / (Math.abs(tGrowth) || 1) < 0.01 });
        }
    }

    var sorted = getSortedBanks(cat, idx);
    var s1 = getVal('pct', cat, sorted[0], idx) || 0;
    var s2 = getVal('pct', cat, sorted[1], idx) || 0;
    checks.push({ check: '#1 share > #2 share', expected: 'True', actual: s1 >= s2 ? 'True' : 'False', pass: s1 >= s2 });

    var ab = document.getElementById('auditBody'); ab.innerHTML = '';
    checks.forEach(function(c) {
        ab.innerHTML += '<tr><td>' + c.check + '</td><td>' + c.expected + '</td><td>' + c.actual + '</td><td class="' + (c.pass ? 'audit-pass' : 'audit-fail') + '">' + (c.pass ? '\u2713 PASS' : '\u2717 FAIL') + '</td></tr>';
    });

    // === ENHANCEMENT: Deposit & Funding Validation ===
    var depChecks = [];
    var nlbCA = getVal('eur', 'Deposits CA', 'NLB', idx) || 0;
    var nlbSaving = getVal('eur', 'Deposits Saving', 'NLB', idx) || 0;
    var nlbTDA = getVal('eur', 'Deposits TDA', 'NLB', idx) || 0;
    var nlbTotalDep = getVal('eur', 'Total Deposits', 'NLB', idx) || 0;
    var sumComponents = nlbCA + nlbSaving + nlbTDA;

    depChecks.push({ check: 'NLB: CA + Saving + TDA \u2248 Total Deposits', expected: fmtK(nlbTotalDep), actual: fmtK(sumComponents), pass: nlbTotalDep > 0 ? Math.abs(sumComponents - nlbTotalDep) / nlbTotalDep < 0.05 : true });

    var nlbLoans = getVal('eur', 'Gross Loans', 'NLB', idx) || 0;
    var ltdCalc = nlbTotalDep > 0 ? (nlbLoans / nlbTotalDep * 100) : 0;
    depChecks.push({ check: 'NLB LTD = Gross Loans / Total Deposits x 100', expected: ltdCalc.toFixed(2) + '%', actual: ltdCalc.toFixed(2) + '%', pass: true });

    var prof = D.profitability;
    var intExp = (prof && prof.plItems && prof.plItems['Interest Expense']) ? prof.plItems['Interest Expense'].NLB || 0 : 0;
    var ieRatio = nlbTotalDep > 0 ? (Math.abs(intExp) / nlbTotalDep * 100) : 0;
    depChecks.push({ check: 'NLB Interest Expense / Deposits ratio is reasonable (<5%)', expected: '<5.00%', actual: ieRatio.toFixed(2) + '%', pass: ieRatio < 5 });

    // Sector-level check
    var sectorCA = getVal('eur', 'Deposits CA', 'Total', idx) || 0;
    var sectorSaving = getVal('eur', 'Deposits Saving', 'Total', idx) || 0;
    var sectorTDA = getVal('eur', 'Deposits TDA', 'Total', idx) || 0;
    var sectorTotalDep = getVal('eur', 'Total Deposits', 'Total', idx) || 0;
    var sectorSum = sectorCA + sectorSaving + sectorTDA;
    depChecks.push({ check: 'Sector: CA + Saving + TDA \u2248 Total Deposits', expected: fmtK(sectorTotalDep), actual: fmtK(sectorSum), pass: sectorTotalDep > 0 ? Math.abs(sectorSum - sectorTotalDep) / sectorTotalDep < 0.05 : true });

    var depAuditBody = document.getElementById('auditDepositBody');
    if (depAuditBody) {
        depAuditBody.innerHTML = '';
        depChecks.forEach(function(c) {
            depAuditBody.innerHTML += '<tr><td>' + c.check + '</td><td>' + c.expected + '</td><td>' + c.actual + '</td><td class="' + (c.pass ? 'audit-pass' : 'audit-fail') + '">' + (c.pass ? '\u2713 PASS' : '\u2717 FAIL') + '</td></tr>';
        });
    }

    // === ENHANCEMENT: P&L Consistency Checks ===
    var plChecks = [];
    if (prof && prof.plItems) {
        var plI = prof.plItems;
        // NII = Interest Income - Interest Expense
        var intInc = plI['Interest Income'] ? plI['Interest Income'].NLB || 0 : 0;
        var intExpPL = plI['Interest Expense'] ? plI['Interest Expense'].NLB || 0 : 0;
        var niiCalc = intInc + intExpPL; // intExp is negative
        var niiActual = plI['Net Interest Income'] ? plI['Net Interest Income'].NLB || 0 : 0;
        plChecks.push({ check: 'NII = Interest Income + Interest Expense', expected: commaFmt(niiCalc, 0), actual: commaFmt(niiActual, 0), pass: Math.abs(niiCalc - niiActual) < Math.abs(niiActual) * 0.02 + 1 });

        // Net Fee = Fee Income + Fee Expense (fee expense is negative)
        var feeInc = plI['Fee & Commission Income'] ? plI['Fee & Commission Income'].NLB || 0 : 0;
        var feeExp = plI['Fee & Commission Expense'] ? plI['Fee & Commission Expense'].NLB || 0 : 0;
        var netFeeCalc = feeInc + feeExp;
        var netFeeActual = plI['Net Fee & Commission Income'] ? plI['Net Fee & Commission Income'].NLB || 0 : 0;
        plChecks.push({ check: 'Net Fee = Fee Income + Fee Expense', expected: commaFmt(netFeeCalc, 0), actual: commaFmt(netFeeActual, 0), pass: Math.abs(netFeeCalc - netFeeActual) < Math.abs(netFeeActual) * 0.02 + 1 });

        // Total Income ~ NII + Net Fee + Other
        var totalIncome = plI['Total Income'] ? plI['Total Income'].NLB || 0 : 0;
        var totalIncCalc = niiActual + netFeeActual;
        plChecks.push({ check: 'Total Income \u2265 NII + Net Fee (Other may be included)', expected: '\u2265' + commaFmt(totalIncCalc, 0), actual: commaFmt(totalIncome, 0), pass: totalIncome >= totalIncCalc * 0.95 });

        // Net Profit ~ PBT - Tax (approximate)
        var pbt = plI['Profit Before Tax'] ? plI['Profit Before Tax'].NLB || 0 : 0;
        var netProfit = plI['Net Profit'] ? plI['Net Profit'].NLB || 0 : 0;
        var taxImplied = pbt - netProfit;
        var taxRate = pbt > 0 ? (taxImplied / pbt * 100) : 0;
        plChecks.push({ check: 'Net Profit = PBT - Tax (tax rate reasonable 5-30%)', expected: '5-30% tax', actual: taxRate.toFixed(1) + '% implied', pass: taxRate >= 0 && taxRate <= 35 });
    }

    var plAuditBody = document.getElementById('auditPLBody');
    if (plAuditBody) {
        plAuditBody.innerHTML = '';
        plChecks.forEach(function(c) {
            plAuditBody.innerHTML += '<tr><td>' + c.check + '</td><td>' + c.expected + '</td><td>' + c.actual + '</td><td class="' + (c.pass ? 'audit-pass' : 'audit-fail') + '">' + (c.pass ? '\u2713 PASS' : '\u2717 FAIL') + '</td></tr>';
        });
    }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', init);
