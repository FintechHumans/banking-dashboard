/* ============================================================
   KOSOVO BANKING SYSTEM — DASHBOARD LOGIC
   Full interactive dashboard with bank comparison
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
function fmtK(v) {
    if (v == null) return '—';
    return Math.round(v).toLocaleString('en-US');
}
function fmtPct(v, d = 2) { return v != null ? commaFmt(v, d) + '%' : '—'; }
function fmtPP(v) {
    if (v == null) return '—';
    const sign = v > 0 ? '+' : '';
    return sign + commaFmt(v, 2);
}
function dateLabel(d) {
    const dt = new Date(d);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[dt.getMonth()] + ' ' + dt.getFullYear();
}
function shortDate(d) {
    const dt = new Date(d);
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return m[dt.getMonth()] + "'" + String(dt.getFullYear()).slice(2);
}
function getSelectedCategory() { return document.getElementById('filterCategory').value; }
function getSelectedPeriodIdx() { return parseInt(document.getElementById('filterPeriod').value); }
function getTopN() { return parseInt(document.getElementById('filterTopN').value); }

function getVal(sheet, cat, bank, idx) {
    const arr = D[sheet]?.[cat]?.[bank];
    if (!arr) return null;
    return arr[idx];
}

function getSortedBanks(cat, idx, sheet = 'pct') {
    return BANKS.filter(b => getVal(sheet, cat, b, idx) != null)
        .sort((a, b) => (getVal(sheet, cat, b, idx) || 0) - (getVal(sheet, cat, a, idx) || 0));
}

function destroyChart(id) {
    if (CHART_INSTANCES[id]) {
        CHART_INSTANCES[id].destroy();
        delete CHART_INSTANCES[id];
    }
}

function renderChart(id, options) {
    destroyChart(id);
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    const chart = new ApexCharts(el, options);
    chart.render();
    CHART_INSTANCES[id] = chart;
}

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
    DATES.forEach((d, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = dateLabel(d);
        if (i === DATES.length - 1) opt.selected = true;
        periodSelect.appendChild(opt);
    });
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
    selA.innerHTML = '';
    selB.innerHTML = '';
    BANKS.forEach(b => {
        const o1 = new Option(b + ' — ' + (D.bankFullNames[b] || b), b);
        const o2 = new Option(b + ' — ' + (D.bankFullNames[b] || b), b);
        selA.appendChild(o1);
        selB.appendChild(o2);
    });
    selA.value = 'NLB';
    selB.value = 'RBKO';
}

function updateActiveSection(section) {
    if (section === 'comparison') updateComparison();
    else if (section === 'trends') updateTrends();
    else if (section === 'competitive') updateCompetitive();
    else if (section === 'segments') updateSegments();
    else if (section === 'growth') updateGrowth();
    else if (section === 'insights') updateInsights();
}

// --- MAIN UPDATE ---
function updateDashboard() {
    const cat = getSelectedCategory();
    const idx = getSelectedPeriodIdx();
    const prevIdx = idx > 0 ? idx - 1 : 0;
    const topN = getTopN();
    const period = dateLabel(DATES[idx]);

    // Update subtitles
    document.getElementById('overviewSubtitle').textContent = `Kosovo Banking System — ${cat} at ${period}`;
    document.getElementById('rankingTitle').textContent = cat;

    // KPIs
    const totalVal = getVal('eur', cat, 'Total', idx);
    const nlbVal = getVal('eur', cat, 'NLB', idx);
    const nlbShare = getVal('pct', cat, 'NLB', idx);
    const nlbSharePrev = getVal('pct', cat, 'NLB', prevIdx);
    const shareChange = (nlbShare != null && nlbSharePrev != null) ? nlbShare - nlbSharePrev : null;

    const sorted = getSortedBanks(cat, idx);
    const nlbRank = sorted.indexOf('NLB') + 1;
    const leaderShare = getVal('pct', cat, sorted[0], idx);
    const gapToLeader = (nlbShare != null && leaderShare != null) ? nlbShare - leaderShare : null;

    document.getElementById('kpiMarketSize').textContent = fmt(totalVal);
    document.getElementById('kpiNlbValue').textContent = fmt(nlbVal);
    document.getElementById('kpiNlbShare').textContent = nlbShare != null ? nlbShare.toFixed(2) : '—';

    const scEl = document.getElementById('kpiShareChange');
    scEl.textContent = fmtPP(shareChange);
    scEl.className = 'kpi-value ' + (shareChange > 0 ? 'kpi-positive' : shareChange < 0 ? 'kpi-negative' : '');

    document.getElementById('kpiNlbRank').textContent = '#' + nlbRank;
    document.getElementById('kpiGapLeader').textContent = sorted[0] === 'NLB' ? 'Leader' : fmtPP(gapToLeader);

    // Insight text
    const insightParts = [];
    if (nlbShare != null) insightParts.push(`NLB holds a ${nlbShare.toFixed(2)}% market share in ${cat}, ranking #${nlbRank} among ${sorted.length} banks.`);
    if (shareChange != null && shareChange !== 0) {
        insightParts.push(`NLB ${shareChange > 0 ? 'gained' : 'lost'} ${Math.abs(shareChange).toFixed(2)}pp compared to the previous period.`);
    }
    if (sorted[0] !== 'NLB' && gapToLeader != null) {
        insightParts.push(`The gap to market leader ${sorted[0]} is ${Math.abs(gapToLeader).toFixed(2)}pp.`);
    }
    document.getElementById('overviewInsightText').textContent = insightParts.join(' ') || 'Select a category and period to view insights.';

    // Pie Chart
    renderPieChart(cat, idx, topN);
    // NLB Trend
    renderNlbTrendChart(cat);
    // Ranking Table
    renderRankingTable(cat, idx, prevIdx, topN);

    // Update other visible sections
    const activeNav = document.querySelector('.nav-btn.active');
    if (activeNav) updateActiveSection(activeNav.dataset.section);
}

// --- PIE CHART ---
function renderPieChart(cat, idx, topN) {
    const sorted = getSortedBanks(cat, idx);
    const banks = sorted.slice(0, topN);
    const values = banks.map(b => getVal('pct', cat, b, idx) || 0);
    const colors = banks.map(b => BANK_COLORS[b]);

    document.getElementById('pieSubtitle').textContent = dateLabel(DATES[idx]);

    renderChart('chartPie', {
        chart: { type: 'donut', height: 320, fontFamily: 'Inter, sans-serif' },
        series: values,
        labels: banks,
        colors: colors,
        plotOptions: {
            pie: {
                donut: {
                    size: '58%',
                    labels: {
                        show: true,
                        name: { fontSize: '14px', fontWeight: 700 },
                        value: { fontSize: '18px', fontWeight: 700, formatter: v => parseFloat(v).toFixed(1) + '%' },
                        total: { show: true, label: 'NLB', fontSize: '13px',
                            formatter: () => (getVal('pct', cat, 'NLB', idx) || 0).toFixed(1) + '%'
                        }
                    }
                }
            }
        },
        dataLabels: { enabled: false },
        legend: { position: 'bottom', fontSize: '12px', fontWeight: 500, markers: { width: 10, height: 10, radius: 3 } },
        stroke: { width: 2, colors: ['#fff'] },
        tooltip: { y: { formatter: v => v.toFixed(2) + '%' } }
    });
}

// --- NLB TREND CHART ---
function renderNlbTrendChart(cat) {
    const nlbData = DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('pct', cat, 'NLB', i) })).filter(p => p.y != null);

    renderChart('chartNlbTrend', {
        chart: { type: 'area', height: 320, fontFamily: 'Inter, sans-serif', toolbar: { show: false },
            zoom: { enabled: false }
        },
        series: [{ name: 'NLB Market Share', data: nlbData }],
        colors: [NLB_COLOR],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 100] } },
        stroke: { width: 3, curve: 'smooth' },
        xaxis: { type: 'datetime', labels: { style: { fontSize: '11px' } } },
        yaxis: { labels: { formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px' } } },
        dataLabels: { enabled: false },
        tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => v.toFixed(2) + '%' } },
        grid: { borderColor: '#f0f0f0', strokeDashArray: 3 },
        annotations: {
            yaxis: nlbData.length > 0 ? [{
                y: nlbData[nlbData.length - 1].y,
                borderColor: NLB_COLOR,
                strokeDashArray: 4,
                label: { text: 'Current: ' + nlbData[nlbData.length - 1].y.toFixed(2) + '%',
                    style: { background: NLB_COLOR, color: '#fff', fontSize: '11px', padding: { left: 8, right: 8, top: 3, bottom: 3 } }
                }
            }] : []
        }
    });
}

// --- RANKING TABLE ---
function renderRankingTable(cat, idx, prevIdx, topN) {
    const sorted = getSortedBanks(cat, idx);
    const banks = sorted.slice(0, topN);
    const tbody = document.getElementById('rankingBody');
    tbody.innerHTML = '';
    const maxShare = getVal('pct', cat, banks[0], idx) || 1;

    banks.forEach((b, i) => {
        const val = getVal('eur', cat, b, idx);
        const share = getVal('pct', cat, b, idx);
        const prevShare = getVal('pct', cat, b, prevIdx);
        const change = (share != null && prevShare != null) ? share - prevShare : null;
        const isNLB = b === 'NLB';
        const barWidth = share != null ? (share / maxShare * 100) : 0;

        const tr = document.createElement('tr');
        if (isNLB) tr.classList.add('nlb-row');
        tr.innerHTML = `
            <td><strong>#${i + 1}</strong></td>
            <td><strong>${b}</strong> <span style="color:var(--text-muted);font-size:0.75rem">${D.bankFullNames[b] || ''}</span></td>
            <td>${fmtK(val)}</td>
            <td><strong>${fmtPct(share)}</strong></td>
            <td class="${change > 0 ? 'kpi-positive' : change < 0 ? 'kpi-negative' : ''}">${fmtPP(change)} pp</td>
            <td><div class="share-bar-wrapper"><div class="share-bar ${isNLB ? 'nlb' : ''}" style="width:${barWidth}%;background:${BANK_COLORS[b]}"></div></div></td>
        `;
        tbody.appendChild(tr);
    });
}

// --- SECTION 2: TRENDS ---
function updateTrends() {
    const cat = getSelectedCategory();
    const topN = getTopN();
    const sorted = getSortedBanks(cat, DATES.length - 1);
    const banks = sorted.slice(0, topN);

    // All banks trend
    const series = banks.map(b => ({
        name: b,
        data: DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('pct', cat, b, i) })).filter(p => p.y != null)
    }));
    const colors = banks.map(b => BANK_COLORS[b]);

    renderChart('chartTrendAll', {
        chart: { type: 'line', height: 420, fontFamily: 'Inter, sans-serif', toolbar: { show: true, tools: { download: true, selection: false, zoom: false, pan: false, reset: false } } },
        series, colors,
        stroke: { width: banks.map(b => b === 'NLB' ? 4 : 2), curve: 'smooth' },
        xaxis: { type: 'datetime', labels: { style: { fontSize: '11px' } } },
        yaxis: { labels: { formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px' } } },
        dataLabels: { enabled: false },
        tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => v ? v.toFixed(2) + '%' : '—' } },
        legend: { position: 'top', fontSize: '12px', fontWeight: 500 },
        grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }
    });

    // Market size
    const marketData = DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('eur', cat, 'Total', i) })).filter(p => p.y != null);
    renderChart('chartMarketSize', {
        chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [{ name: 'Market Total', data: marketData }],
        colors: ['#d4d4e8'],
        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
        xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
        yaxis: { labels: { formatter: v => fmt(v, 0), style: { fontSize: '11px' } } },
        dataLabels: { enabled: false },
        tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => fmtK(v) + ' k EUR' } },
        grid: { borderColor: '#f0f0f0' }
    });

    // NLB vs Top 3
    const top3 = sorted.filter(b => b !== 'NLB').slice(0, 3);
    const nlbSeries = { name: 'NLB', data: DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('pct', cat, 'NLB', i) })).filter(p => p.y != null) };
    const top3Series = top3.map(b => ({
        name: b,
        data: DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('pct', cat, b, i) })).filter(p => p.y != null)
    }));

    renderChart('chartNlbVsTop3', {
        chart: { type: 'line', height: 320, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [nlbSeries, ...top3Series],
        colors: [NLB_COLOR, ...top3.map(b => BANK_COLORS[b])],
        stroke: { width: [4, 2, 2, 2], curve: 'smooth', dashArray: [0, 4, 4, 4] },
        xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
        yaxis: { labels: { formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px' } } },
        dataLabels: { enabled: false },
        tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => v ? v.toFixed(2) + '%' : '—' } },
        legend: { position: 'top', fontSize: '12px' },
        grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }
    });
}

// --- SECTION 3: COMPETITIVE ---
function updateCompetitive() {
    const cat = getSelectedCategory();
    const idx = getSelectedPeriodIdx();
    const prevIdx = idx > 0 ? idx - 1 : 0;
    const topN = getTopN();
    const sorted = getSortedBanks(cat, idx);
    const banks = sorted.slice(0, topN);

    // Bar ranking
    renderChart('chartBarRanking', {
        chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [{ name: 'Market Share', data: banks.map(b => ({ x: b, y: getVal('pct', cat, b, idx) || 0 })) }],
        colors: banks.map(b => BANK_COLORS[b]),
        plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 4, distributed: true,
            dataLabels: { position: 'top' }
        } },
        dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%', offsetX: 30,
            style: { fontSize: '12px', fontWeight: 700, colors: ['#333'] }
        },
        xaxis: { labels: { formatter: v => v.toFixed(0) + '%', style: { fontSize: '11px' } } },
        yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } },
        legend: { show: false },
        grid: { borderColor: '#f0f0f0' },
        tooltip: { y: { formatter: v => v.toFixed(2) + '%' } }
    });

    // Share change
    const changes = banks.map(b => {
        const cur = getVal('pct', cat, b, idx);
        const prev = getVal('pct', cat, b, prevIdx);
        return { x: b, y: (cur != null && prev != null) ? parseFloat((cur - prev).toFixed(4)) : 0 };
    }).sort((a, b) => b.y - a.y);

    renderChart('chartShareChange', {
        chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [{ name: 'Share Change (pp)', data: changes }],
        colors: [({ value }) => value >= 0 ? '#0d8a56' : '#c0392b'],
        plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3 } },
        dataLabels: { enabled: true, formatter: v => (v > 0 ? '+' : '') + v.toFixed(2) + 'pp', offsetX: 5,
            style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] }
        },
        xaxis: { labels: { formatter: v => v.toFixed(2) + 'pp', style: { fontSize: '11px' } } },
        yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } },
        legend: { show: false },
        grid: { borderColor: '#f0f0f0' },
        tooltip: { y: { formatter: v => (v > 0 ? '+' : '') + v.toFixed(4) + ' pp' } }
    });

    // Heatmap
    const heatCats = CATS.slice(0, 9);
    const heatBanks = getSortedBanks('Assets', idx).slice(0, 7);
    const heatSeries = heatBanks.map(b => ({
        name: b,
        data: heatCats.map(c => ({ x: c.replace('Deposits from ', 'Dep. ').replace('Corporate', 'Corp.').replace('Consumer', 'Cons.').replace('Housing', 'Hous.'), y: getVal('pct', c, b, idx) || 0 }))
    }));

    renderChart('chartHeatmap', {
        chart: { type: 'heatmap', height: 420, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: heatSeries,
        colors: [NLB_COLOR],
        dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%', style: { fontSize: '10px' } },
        plotOptions: { heatmap: { radius: 4, colorScale: {
            ranges: [
                { from: 0, to: 8, color: '#e8e0ff', name: '0-8%' },
                { from: 8, to: 14, color: '#b8a0f0', name: '8-14%' },
                { from: 14, to: 20, color: '#7c50d0', name: '14-20%' },
                { from: 20, to: 40, color: '#230078', name: '20%+' }
            ]
        } } },
        xaxis: { labels: { style: { fontSize: '10px' }, rotateAlways: false } },
        yaxis: { labels: { style: { fontSize: '11px', fontWeight: 600 } } },
        tooltip: { y: { formatter: v => v.toFixed(2) + '%' } }
    });
}

// --- SECTION 4: BANK VS BANK COMPARISON ---
function updateComparison() {
    const bankA = document.getElementById('compareA').value;
    const bankB = document.getElementById('compareB').value;
    const cat = getSelectedCategory();
    const idx = getSelectedPeriodIdx();
    const prevIdx = idx > 0 ? idx - 1 : 0;

    document.getElementById('thBankA').textContent = bankA;
    document.getElementById('thBankB').textContent = bankB;

    const aVal = getVal('eur', cat, bankA, idx);
    const bVal = getVal('eur', cat, bankB, idx);
    const aShare = getVal('pct', cat, bankA, idx);
    const bShare = getVal('pct', cat, bankB, idx);
    const aSharePrev = getVal('pct', cat, bankA, prevIdx);
    const bSharePrev = getVal('pct', cat, bankB, prevIdx);
    const aGrowth = (aVal && getVal('eur', cat, bankA, prevIdx)) ? ((aVal / getVal('eur', cat, bankA, prevIdx) - 1) * 100) : null;
    const bGrowth = (bVal && getVal('eur', cat, bankB, prevIdx)) ? ((bVal / getVal('eur', cat, bankB, prevIdx) - 1) * 100) : null;
    const sorted = getSortedBanks(cat, idx);
    const aRank = sorted.indexOf(bankA) + 1;
    const bRank = sorted.indexOf(bankB) + 1;

    // KPI Cards
    const kpiData = [
        { label: 'Market Share', aVal: aShare, bVal: bShare, fmt: v => fmtPct(v), better: 'higher' },
        { label: 'Value (k EUR)', aVal: aVal, bVal: bVal, fmt: v => fmt(v), better: 'higher' },
        { label: 'Growth Rate', aVal: aGrowth, bVal: bGrowth, fmt: v => v != null ? v.toFixed(2) + '%' : '—', better: 'higher' },
        { label: 'Rank', aVal: aRank, bVal: bRank, fmt: v => '#' + v, better: 'lower' },
        { label: 'Share Change (pp)', aVal: aShare != null && aSharePrev != null ? aShare - aSharePrev : null,
          bVal: bShare != null && bSharePrev != null ? bShare - bSharePrev : null, fmt: v => fmtPP(v), better: 'higher' },
    ];

    const kpiContainer = document.getElementById('compareKpis');
    kpiContainer.innerHTML = '';
    kpiData.forEach(kpi => {
        const aW = kpi.better === 'higher' ? (kpi.aVal || 0) >= (kpi.bVal || 0) : (kpi.aVal || 0) <= (kpi.bVal || 0);
        const gap = kpi.aVal != null && kpi.bVal != null ? kpi.aVal - kpi.bVal : null;
        const gapClass = gap != null ? (gap > 0 ? (kpi.better === 'higher' ? 'positive' : 'negative') : (kpi.better === 'higher' ? 'negative' : 'positive')) : '';

        kpiContainer.innerHTML += `
            <div class="compare-kpi-card">
                <span class="compare-kpi-label">${kpi.label}</span>
                <div class="compare-kpi-values">
                    <div class="compare-val">
                        <span class="val-label">${bankA}</span>
                        <span class="val-num bank-a-color">${kpi.fmt(kpi.aVal)}</span>
                    </div>
                    <div class="compare-gap ${gapClass}">
                        ${gap != null ? (gap > 0 ? '+' : '') + commaFmt(gap, 2) : '—'}
                    </div>
                    <div class="compare-val">
                        <span class="val-label">${bankB}</span>
                        <span class="val-num bank-b-color">${kpi.fmt(kpi.bVal)}</span>
                    </div>
                </div>
                <div style="text-align:center;margin-top:6px">
                    <span class="leader-badge ${aW ? 'leader-a' : 'leader-b'}">${aW ? bankA + ' leads' : bankB + ' leads'}</span>
                </div>
            </div>
        `;
    });

    // Summary text
    const shareGap = aShare != null && bShare != null ? aShare - bShare : null;
    let summaryParts = [];
    if (shareGap != null) {
        if (shareGap > 0) summaryParts.push(`${bankA} leads ${bankB} by ${Math.abs(shareGap).toFixed(2)}pp in ${cat} market share.`);
        else if (shareGap < 0) summaryParts.push(`${bankB} leads ${bankA} by ${Math.abs(shareGap).toFixed(2)}pp in ${cat} market share.`);
        else summaryParts.push(`${bankA} and ${bankB} have equal market share in ${cat}.`);
    }
    if (aGrowth != null && bGrowth != null) {
        const fasterBank = aGrowth > bGrowth ? bankA : bankB;
        summaryParts.push(`${fasterBank} is growing faster at ${Math.max(aGrowth, bGrowth).toFixed(1)}% vs ${Math.min(aGrowth, bGrowth).toFixed(1)}%.`);
    }
    if (aRank && bRank) {
        summaryParts.push(`${bankA} ranks #${aRank} and ${bankB} ranks #${bRank} in the market.`);
    }
    // Check historical gap trend
    const firstShareGap = getVal('pct', cat, bankA, 0) != null && getVal('pct', cat, bankB, 0) != null
        ? getVal('pct', cat, bankA, 0) - getVal('pct', cat, bankB, 0) : null;
    if (firstShareGap != null && shareGap != null) {
        const gapChange = Math.abs(shareGap) - Math.abs(firstShareGap);
        if (Math.abs(gapChange) > 0.2) {
            summaryParts.push(`The gap between the two banks has ${gapChange > 0 ? 'widened' : 'narrowed'} by ${Math.abs(gapChange).toFixed(1)}pp since ${dateLabel(DATES[0])}.`);
        }
    }
    document.getElementById('compareSummaryText').textContent = summaryParts.join(' ') || 'Select two banks to compare.';

    // Trend chart
    const aSeries = DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('pct', cat, bankA, i) })).filter(p => p.y != null);
    const bSeries = DATES.map((d, i) => ({ x: new Date(d).getTime(), y: getVal('pct', cat, bankB, i) })).filter(p => p.y != null);

    renderChart('chartCompareTrend', {
        chart: { type: 'line', height: 320, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [{ name: bankA, data: aSeries }, { name: bankB, data: bSeries }],
        colors: [NLB_COLOR, '#6b7280'],
        stroke: { width: [3, 3], curve: 'smooth' },
        xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
        yaxis: { labels: { formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px' } } },
        dataLabels: { enabled: false },
        tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => v ? v.toFixed(2) + '%' : '—' } },
        legend: { position: 'top', fontSize: '13px', fontWeight: 600 },
        grid: { borderColor: '#f0f0f0', strokeDashArray: 3 },
        markers: { size: 0, hover: { size: 5 } }
    });

    // Bar comparison across segments
    const segCats = CATS.slice(0, 9);
    const aSegVals = segCats.map(c => getVal('pct', c, bankA, idx) || 0);
    const bSegVals = segCats.map(c => getVal('pct', c, bankB, idx) || 0);
    const segLabels = segCats.map(c => c.replace('Deposits from ', 'Dep. ').replace('Corporate', 'Corp.').replace('Consumer', 'Cons.').replace('Housing', 'Hous.').replace('Gross ', ''));

    renderChart('chartCompareSegments', {
        chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [{ name: bankA, data: aSegVals }, { name: bankB, data: bSegVals }],
        colors: [NLB_COLOR, '#9ca3af'],
        plotOptions: { bar: { borderRadius: 3, columnWidth: '65%' } },
        xaxis: { categories: segLabels, labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: true } },
        yaxis: { labels: { formatter: v => v.toFixed(0) + '%', style: { fontSize: '11px' } } },
        dataLabels: { enabled: false },
        legend: { position: 'top', fontSize: '12px', fontWeight: 600 },
        tooltip: { y: { formatter: v => v.toFixed(2) + '%' } },
        grid: { borderColor: '#f0f0f0' }
    });

    // Value comparison bar
    const aSegEur = segCats.map(c => getVal('eur', c, bankA, idx) || 0);
    const bSegEur = segCats.map(c => getVal('eur', c, bankB, idx) || 0);

    renderChart('chartCompareBar', {
        chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [{ name: bankA, data: aSegEur }, { name: bankB, data: bSegEur }],
        colors: [NLB_COLOR, '#9ca3af'],
        plotOptions: { bar: { borderRadius: 3, columnWidth: '65%' } },
        xaxis: { categories: segLabels, labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: true } },
        yaxis: { labels: { formatter: v => fmt(v, 0), style: { fontSize: '11px' } } },
        dataLabels: { enabled: false },
        legend: { position: 'top', fontSize: '12px', fontWeight: 600 },
        tooltip: { y: { formatter: v => fmtK(v) + ' k EUR' } },
        grid: { borderColor: '#f0f0f0' }
    });

    // Gap analysis
    const gapData = DATES.map((d, i) => {
        const a = getVal('pct', cat, bankA, i);
        const b = getVal('pct', cat, bankB, i);
        return { x: new Date(d).getTime(), y: a != null && b != null ? parseFloat((a - b).toFixed(4)) : null };
    }).filter(p => p.y != null);

    renderChart('chartCompareGap', {
        chart: { type: 'area', height: 320, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [{ name: `Gap (${bankA} − ${bankB})`, data: gapData }],
        colors: [NLB_COLOR],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
        stroke: { width: 2, curve: 'smooth' },
        xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
        yaxis: { labels: { formatter: v => (v > 0 ? '+' : '') + v.toFixed(1) + 'pp', style: { fontSize: '11px' } } },
        dataLabels: { enabled: false },
        tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => (v > 0 ? '+' : '') + v.toFixed(2) + ' pp' } },
        grid: { borderColor: '#f0f0f0', strokeDashArray: 3 },
        annotations: { yaxis: [{ y: 0, borderColor: '#c0392b', strokeDashArray: 0, borderWidth: 1 }] }
    });

    // Comparison table
    renderCompareTable(bankA, bankB, idx, prevIdx);
}

function renderCompareTable(bankA, bankB, idx, prevIdx) {
    const tbody = document.getElementById('compareBody');
    tbody.innerHTML = '';
    const segCats = CATS.slice(0, 9);

    segCats.forEach(cat => {
        const aShare = getVal('pct', cat, bankA, idx);
        const bShare = getVal('pct', cat, bankB, idx);
        const aVal = getVal('eur', cat, bankA, idx);
        const bVal = getVal('eur', cat, bankB, idx);
        const gap = aShare != null && bShare != null ? aShare - bShare : null;
        const leader = gap > 0 ? bankA : gap < 0 ? bankB : 'Tie';
        const leaderClass = gap > 0 ? 'winner-a' : gap < 0 ? 'winner-b' : '';

        tbody.innerHTML += `
            <tr>
                <td><strong>${cat}</strong></td>
                <td class="${gap > 0 ? 'winner-a' : ''}">${fmtPct(aShare)} <span style="color:var(--text-muted);font-size:0.75rem">(${fmt(aVal)})</span></td>
                <td class="${gap < 0 ? 'winner-b' : ''}">${fmtPct(bShare)} <span style="color:var(--text-muted);font-size:0.75rem">(${fmt(bVal)})</span></td>
                <td class="${gap > 0 ? 'kpi-positive' : gap < 0 ? 'kpi-negative' : ''}">${gap != null ? fmtPP(gap) + ' pp' : '—'}</td>
                <td><span class="leader-badge ${gap > 0 ? 'leader-a' : gap < 0 ? 'leader-b' : 'leader-tie'}">${leader}</span></td>
            </tr>
        `;
    });
}

function quickCompare(bank) {
    document.getElementById('compareA').value = 'NLB';
    document.getElementById('compareB').value = bank;
    // Navigate to comparison section
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-section="comparison"]').classList.add('active');
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    document.getElementById('sec-comparison').classList.add('active');
    updateComparison();
}

// --- SECTION 5: SEGMENTS ---
function updateSegments() {
    const idx = getSelectedPeriodIdx();
    const segCats = CATS.slice(0, 9);
    const segLabels = segCats.map(c => c.replace('Deposits from ', 'Dep. ').replace('Corporate', 'Corp.').replace('Consumer', 'Cons.').replace('Housing', 'Hous.').replace('Gross ', ''));

    // NLB share by segment
    const nlbShares = segCats.map(c => getVal('pct', c, 'NLB', idx) || 0);

    renderChart('chartSegmentBar', {
        chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [{ name: 'NLB Market Share', data: nlbShares }],
        colors: [NLB_COLOR],
        plotOptions: { bar: { borderRadius: 5, columnWidth: '55%',
            dataLabels: { position: 'top' }
        } },
        dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%', offsetY: -20,
            style: { fontSize: '12px', fontWeight: 700, colors: [NLB_COLOR] }
        },
        xaxis: { categories: segLabels, labels: { style: { fontSize: '11px' } } },
        yaxis: { labels: { formatter: v => v.toFixed(0) + '%', style: { fontSize: '11px' } }, max: Math.max(...nlbShares) + 5 },
        grid: { borderColor: '#f0f0f0' },
        tooltip: { y: { formatter: v => v.toFixed(2) + '%' } },
        annotations: {
            yaxis: [{
                y: nlbShares.reduce((a, b) => a + b, 0) / nlbShares.length,
                borderColor: '#c0392b',
                strokeDashArray: 4,
                label: { text: 'Average', style: { background: '#c0392b', color: '#fff', fontSize: '10px' } }
            }]
        }
    });

    // NLB vs Market stacked
    const nlbVals = segCats.map(c => getVal('eur', c, 'NLB', idx) || 0);
    const marketVals = segCats.map(c => {
        const total = getVal('eur', c, 'Total', idx) || 0;
        const nlb = getVal('eur', c, 'NLB', idx) || 0;
        return total - nlb;
    });

    renderChart('chartSegmentStack', {
        chart: { type: 'bar', height: 320, stacked: true, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [{ name: 'NLB', data: nlbVals }, { name: 'Rest of Market', data: marketVals }],
        colors: [NLB_COLOR, '#e5e7eb'],
        plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
        xaxis: { categories: segLabels, labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: true } },
        yaxis: { labels: { formatter: v => fmt(v, 0), style: { fontSize: '11px' } } },
        dataLabels: { enabled: false },
        legend: { position: 'top', fontSize: '12px' },
        tooltip: { y: { formatter: v => fmtK(v) + ' k EUR' } },
        grid: { borderColor: '#f0f0f0' }
    });

    // NLB Rank by segment
    const nlbRanks = segCats.map(c => {
        const sorted = getSortedBanks(c, idx);
        return sorted.indexOf('NLB') + 1;
    });

    renderChart('chartSegmentRank', {
        chart: { type: 'bar', height: 320, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [{ name: 'NLB Rank', data: nlbRanks }],
        colors: [({ value }) => value <= 2 ? '#0d8a56' : value <= 4 ? '#d68a00' : '#c0392b'],
        plotOptions: { bar: { borderRadius: 4, columnWidth: '50%', distributed: true,
            dataLabels: { position: 'center' }
        } },
        dataLabels: { enabled: true, formatter: v => '#' + v,
            style: { fontSize: '14px', fontWeight: 800, colors: ['#fff'] }
        },
        xaxis: { categories: segLabels, labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: true } },
        yaxis: { reversed: true, min: 0, max: 11, labels: { formatter: v => '#' + v, style: { fontSize: '11px' } } },
        legend: { show: false },
        tooltip: { y: { formatter: v => 'Rank #' + v } },
        grid: { borderColor: '#f0f0f0' }
    });
}

// --- SECTION 6: GROWTH ---
function updateGrowth() {
    const cat = getSelectedCategory();
    const idx = getSelectedPeriodIdx();
    const prevIdx = idx > 0 ? idx - 1 : 0;
    const topN = getTopN();

    const growthData = BANKS.map(b => {
        const cur = getVal('eur', cat, b, idx);
        const prev = getVal('eur', cat, b, prevIdx);
        const growth = (cur && prev) ? ((cur / prev - 1) * 100) : null;
        const absChange = (cur && prev) ? cur - prev : null;
        return { bank: b, growth, absChange };
    }).filter(d => d.growth != null).sort((a, b) => b.growth - a.growth).slice(0, topN);

    // Growth rate
    renderChart('chartGrowthRate', {
        chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [{ name: 'Growth %', data: growthData.map(d => ({ x: d.bank, y: parseFloat(d.growth.toFixed(2)) })) }],
        colors: [({ value, dataPointIndex }) => {
            const b = growthData[dataPointIndex]?.bank;
            return b === 'NLB' ? NLB_COLOR : (value >= 0 ? '#0d8a56' : '#c0392b');
        }],
        plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true } },
        dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%', offsetX: 5,
            style: { fontSize: '11px', fontWeight: 600, colors: ['#333'] }
        },
        xaxis: { labels: { formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px' } } },
        yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } },
        legend: { show: false },
        grid: { borderColor: '#f0f0f0' },
        tooltip: { y: { formatter: v => v.toFixed(2) + '%' } }
    });

    // Absolute contribution
    const contribData = growthData.sort((a, b) => b.absChange - a.absChange);
    renderChart('chartGrowthContrib', {
        chart: { type: 'bar', height: 420, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [{ name: 'Change (k EUR)', data: contribData.map(d => ({ x: d.bank, y: Math.round(d.absChange) })) }],
        colors: [({ dataPointIndex }) => {
            const b = contribData[dataPointIndex]?.bank;
            return b === 'NLB' ? NLB_COLOR : '#6b7280';
        }],
        plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3, distributed: true } },
        dataLabels: { enabled: true, formatter: v => fmtK(v), offsetX: 5,
            style: { fontSize: '10px', fontWeight: 600, colors: ['#333'] }
        },
        xaxis: { labels: { formatter: v => fmt(v, 0), style: { fontSize: '11px' } } },
        yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600 } } },
        legend: { show: false },
        grid: { borderColor: '#f0f0f0' },
        tooltip: { y: { formatter: v => fmtK(v) + ' k EUR' } }
    });

    // Growth insight
    const nlbGrowth = growthData.find(d => d.bank === 'NLB');
    const fastest = growthData[0];
    let gInsight = [];
    if (nlbGrowth) gInsight.push(`NLB grew by ${nlbGrowth.growth.toFixed(1)}% in ${cat} during the latest period, with an absolute increase of ${fmtK(nlbGrowth.absChange)} k EUR.`);
    if (fastest && fastest.bank !== 'NLB') gInsight.push(`The fastest growing bank is ${fastest.bank} at ${fastest.growth.toFixed(1)}%.`);
    const totalGrowth = growthData.reduce((s, d) => s + d.absChange, 0);
    if (nlbGrowth && totalGrowth) gInsight.push(`NLB contributed ${(nlbGrowth.absChange / totalGrowth * 100).toFixed(1)}% of total market growth.`);
    document.getElementById('growthInsightText').textContent = gInsight.join(' ') || 'Select a category and period to view growth insights.';
}

// --- SECTION 7: STRATEGIC INSIGHTS ---
function updateInsights() {
    const idx = getSelectedPeriodIdx();
    const prevIdx = idx > 0 ? idx - 1 : 0;
    const period = dateLabel(DATES[idx]);

    // Market Position
    const assetShare = getVal('pct', 'Assets', 'NLB', idx);
    const assetRank = getSortedBanks('Assets', idx).indexOf('NLB') + 1;
    const leader = getSortedBanks('Assets', idx)[0];
    const leaderShare = getVal('pct', 'Assets', leader, idx);
    const gap = assetShare - leaderShare;
    document.getElementById('insightPosition').textContent =
        `NLB holds ${fmtPct(assetShare)} of total banking assets, ranking #${assetRank} in Kosovo as of ${period}. ` +
        `The market leader is ${leader} with ${fmtPct(leaderShare)}. NLB trails by ${Math.abs(gap).toFixed(2)}pp. ` +
        `The bank operates in a ${BANKS.length}-bank market with the top 3 controlling over ${((getVal('pct','Assets',getSortedBanks('Assets',idx)[0],idx)||0) + (getVal('pct','Assets',getSortedBanks('Assets',idx)[1],idx)||0) + (getVal('pct','Assets',getSortedBanks('Assets',idx)[2],idx)||0)).toFixed(0)}% of assets.`;

    // Growth
    const assetNow = getVal('eur', 'Assets', 'NLB', idx);
    const assetPrev = getVal('eur', 'Assets', 'NLB', prevIdx);
    const nlbGr = assetPrev ? ((assetNow / assetPrev - 1) * 100) : 0;
    const marketNow = getVal('eur', 'Assets', 'Total', idx);
    const marketPrev = getVal('eur', 'Assets', 'Total', prevIdx);
    const mktGr = marketPrev ? ((marketNow / marketPrev - 1) * 100) : 0;
    document.getElementById('insightGrowth').textContent =
        `NLB's total assets ${nlbGr >= 0 ? 'grew' : 'declined'} by ${Math.abs(nlbGr).toFixed(1)}% in the latest period, ` +
        `${nlbGr > mktGr ? 'outpacing' : 'underperforming'} the market average of ${mktGr.toFixed(1)}%. ` +
        `This ${nlbGr > mktGr ? 'supports market share gains' : 'puts pressure on maintaining market share'}. ` +
        `Sustained above-market growth is essential for NLB to close the gap to the market leader.`;

    // Threats
    const fastestGrowers = BANKS.filter(b => b !== 'NLB').map(b => {
        const cur = getVal('eur', 'Assets', b, idx);
        const prev = getVal('eur', 'Assets', b, prevIdx);
        return { bank: b, growth: prev ? ((cur / prev - 1) * 100) : 0 };
    }).sort((a, b) => b.growth - a.growth);
    const topGrower = fastestGrowers[0];
    document.getElementById('insightThreats').textContent =
        `The fastest growing competitor is ${topGrower.bank} (+${topGrower.growth.toFixed(1)}% in assets). ` +
        `${topGrower.growth > nlbGr ? `${topGrower.bank} is growing faster than NLB, which could erode NLB's market position if sustained.` : 'NLB is currently outgrowing its closest competitors.'} ` +
        `Key competitive threats include scale advantages of ${leader} and the aggressive expansion of mid-tier banks. Monitor for potential M&A activity that could reshape the competitive landscape.`;

    // Opportunities
    const loanShare = getVal('pct', 'Gross Loans', 'NLB', idx);
    const depShare = getVal('pct', 'Total Deposits', 'NLB', idx);
    document.getElementById('insightOpportunities').textContent =
        `NLB's lending share (${fmtPct(loanShare)}) relative to its deposit share (${fmtPct(depShare)}) suggests ` +
        `${loanShare > depShare ? 'strong loan deployment capability. Focus on funding diversification.' : 'room to grow loan book against the existing deposit base. Accelerating lending growth while maintaining credit quality is a key opportunity.'}` +
        ` Segment-level analysis shows NLB can gain share in retail lending and housing loans where penetration is below the asset share. Digital transformation and customer acquisition in underserved segments offer additional upside.`;

    // Deposits
    const depRetail = getVal('pct', 'Deposits from Retail', 'NLB', idx);
    const depCorp = getVal('pct', 'Deposits from Corporate', 'NLB', idx);
    document.getElementById('insightDeposits').textContent =
        `NLB's deposit franchise is anchored by retail deposits (${fmtPct(depRetail)} market share) and corporate deposits (${fmtPct(depCorp)} share). ` +
        `${depRetail > depCorp ? 'Retail deposits represent NLB\'s stronger funding base.' : 'Corporate deposits are a relatively stronger position for NLB.'} ` +
        `Maintaining stable, low-cost deposit funding is critical for margin preservation. Competition for deposits is intensifying across the sector.`;

    // Lending
    const corpLoan = getVal('pct', 'Corporate Loans', 'NLB', idx);
    const retLoan = getVal('pct', 'Retail Loans', 'NLB', idx);
    const housLoan = getVal('pct', 'Housing Loans', 'NLB', idx);
    document.getElementById('insightLending').textContent =
        `NLB's lending portfolio shows corporate loans at ${fmtPct(corpLoan)} share and retail loans at ${fmtPct(retLoan)} share. ` +
        `Housing loans stand at ${fmtPct(housLoan)}. ` +
        `${corpLoan > retLoan ? 'The corporate segment is NLB\'s stronger lending position. Diversifying into retail could reduce concentration risk.' : 'Retail lending is well-positioned. Maintaining credit quality while growing the consumer and housing book is key.'}`;

    // Concentration chart
    const top3Dates = DATES.map((d, i) => {
        const sorted = getSortedBanks('Assets', i);
        const top3Share = sorted.slice(0, 3).reduce((s, b) => s + (getVal('pct', 'Assets', b, i) || 0), 0);
        return { x: new Date(d).getTime(), y: top3Share };
    }).filter(p => p.y > 0);

    renderChart('chartConcentration', {
        chart: { type: 'area', height: 320, fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
        series: [{ name: 'Top 3 Banks Share', data: top3Dates }],
        colors: ['#6b7280'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 } },
        stroke: { width: 2, curve: 'smooth' },
        xaxis: { type: 'datetime', labels: { style: { fontSize: '10px' } } },
        yaxis: { labels: { formatter: v => v.toFixed(0) + '%', style: { fontSize: '11px' } }, min: 40, max: 70 },
        dataLabels: { enabled: false },
        tooltip: { x: { format: 'MMM yyyy' }, y: { formatter: v => v.toFixed(1) + '%' } },
        grid: { borderColor: '#f0f0f0', strokeDashArray: 3 }
    });
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', init);
