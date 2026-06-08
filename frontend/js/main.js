const AppState = {
    dataLoaded: false,
    columnInfo: null,
    summary: null,
    filters: [],
    charts: {},
    debounceTimer: null,
    isUpdating: false
};

const MAX_SCATTER_POINTS = 500;
const MAX_LINE_POINTS = 365;
const UPDATE_DEBOUNCE_MS = 300;

let lineChart, rollingChart, barChart, scatterChart, heatmapChart, corrMatrixChart, mapChart, forecastChart, anomalyChart;

document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    initEventListeners();
    initTabs();
});

function initCharts() {
    lineChart = new LineChart('lineChart', { color: '#667eea' });
    rollingChart = new LineChart('rollingChart', { color: '#52c41a' });
    barChart = new BarChart('barChart');
    scatterChart = new ScatterPlot('scatterChart');
    heatmapChart = new HeatMap('heatmapChart');
    mapChart = new MapChart('mapChart');
    corrMatrixChart = new HeatMap('corrMatrix');
    forecastChart = new ForecastChart('forecastChart', { color: '#667eea', forecastColor: '#52c41a' });
    anomalyChart = new AnomalyChart('anomalyChart', { color: '#667eea', anomalyColor: '#f5222d' });
}

function initEventListeners() {
    document.getElementById('loadSampleBtn').addEventListener('click', loadSampleData);
    document.getElementById('fileUpload').addEventListener('change', handleFileUpload);

    document.getElementById('applyFilterBtn').addEventListener('click', applyFilters);
    document.getElementById('resetFilterBtn').addEventListener('click', resetFilters);
    document.getElementById('cleanDataBtn').addEventListener('click', cleanData);

    document.getElementById('trendMetric').addEventListener('change', () => debouncedUpdate(updateLineChart));
    document.getElementById('trendFreq').addEventListener('change', () => debouncedUpdate(updateLineChart));
    document.getElementById('rollingWindow').addEventListener('change', () => debouncedUpdate(updateRollingChart));

    document.getElementById('barCategory').addEventListener('change', () => debouncedUpdate(updateBarChart));
    document.getElementById('barMetric').addEventListener('change', () => debouncedUpdate(updateBarChart));

    document.getElementById('heatX').addEventListener('change', () => debouncedUpdate(updateHeatmap));
    document.getElementById('heatY').addEventListener('change', () => debouncedUpdate(updateHeatmap));

    document.getElementById('scatterX').addEventListener('change', () => debouncedUpdate(updateScatterChart));
    document.getElementById('scatterY').addEventListener('change', () => debouncedUpdate(updateScatterChart));
    document.getElementById('scatterColor').addEventListener('change', () => debouncedUpdate(updateScatterChart));

    document.getElementById('mapMetric').addEventListener('change', () => debouncedUpdate(updateMapChart));

    document.getElementById('forecastMetric').addEventListener('change', () => debouncedUpdate(updateForecastChart));
    document.getElementById('forecastMethod').addEventListener('change', () => debouncedUpdate(updateForecastChart));
    document.getElementById('forecastPeriods').addEventListener('change', () => debouncedUpdate(updateForecastChart));
    document.getElementById('forecastFreq').addEventListener('change', () => debouncedUpdate(updateForecastChart));

    document.getElementById('anomalyMetric').addEventListener('change', () => debouncedUpdate(updateAnomalyChart));
    document.getElementById('anomalyMethod').addEventListener('change', () => debouncedUpdate(updateAnomalyChart));
    document.getElementById('anomalyThreshold').addEventListener('change', () => debouncedUpdate(updateAnomalyChart));

    document.getElementById('dashboardConfigBtn').addEventListener('click', openDashboardConfig);
    document.getElementById('closeConfigModal').addEventListener('click', closeDashboardConfig);
    document.getElementById('saveConfigBtn').addEventListener('click', saveDashboardConfig);
    document.getElementById('resetConfigBtn').addEventListener('click', resetDashboardConfig);

    loadDashboardConfig();
}

function debouncedUpdate(updateFn) {
    if (AppState.debounceTimer) {
        clearTimeout(AppState.debounceTimer);
    }
    AppState.debounceTimer = setTimeout(() => {
        if (updateFn) {
            updateFn();
        }
    }, UPDATE_DEBOUNCE_MS);
}

function debouncedUpdateAll() {
    if (AppState.debounceTimer) {
        clearTimeout(AppState.debounceTimer);
    }
    AppState.debounceTimer = setTimeout(() => {
        updateAllCharts();
    }, UPDATE_DEBOUNCE_MS);
}

function initTabs() {
    const tabs = document.querySelectorAll('.chart-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    document.querySelector(`.chart-tab[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');

    setTimeout(() => {
        if (tabName === 'trend') {
            lineChart.resize();
            rollingChart.resize();
        } else if (tabName === 'comparison') {
            barChart.resize();
            heatmapChart.resize();
        } else if (tabName === 'correlation') {
            scatterChart.resize();
            corrMatrixChart.resize();
        } else if (tabName === 'spatial') {
            mapChart.resize();
        } else if (tabName === 'forecast') {
            forecastChart.resize();
            anomalyChart.resize();
        }
    }, 50);
}

async function loadSampleData() {
    showLoading();
    try {
        const result = await API.loadSampleData();
        if (result.success) {
            AppState.dataLoaded = true;
            AppState.columnInfo = result.column_info;
            AppState.summary = result.summary;
            AppState.filters = [];

            updateDataSummary();
            buildFilterPanel();
            enableControls();
            updateAllCharts();

            showToast('示例数据加载成功！', 'success');
        } else {
            showToast(result.message || '加载失败', 'error');
        }
    } catch (error) {
        showToast('加载失败: ' + error.message, 'error');
    }
    hideLoading();
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading();
    try {
        const result = await API.uploadFile(file);
        if (result.success) {
            AppState.dataLoaded = true;
            AppState.columnInfo = result.column_info;
            AppState.summary = result.summary;
            AppState.filters = [];

            updateDataSummary();
            buildFilterPanel();
            enableControls();
            updateAllCharts();

            showToast('数据上传成功！', 'success');
        } else {
            showToast(result.message || '上传失败', 'error');
        }
    } catch (error) {
        showToast('上传失败: ' + error.message, 'error');
    }
    hideLoading();
    event.target.value = '';
}

function updateDataSummary() {
    const summary = AppState.summary;
    const columnInfo = AppState.columnInfo;

    if (!summary) return;

    const html = `
        <div class="summary-item">
            <span class="summary-label">数据行数</span>
            <span class="summary-value">${summary.rows.toLocaleString()}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">数据列数</span>
            <span class="summary-value">${summary.columns}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">时间列</span>
            <span class="summary-value">${columnInfo.date_columns.length}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">数值列</span>
            <span class="summary-value">${columnInfo.numeric_columns.length}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">分类列</span>
            <span class="summary-value">${columnInfo.categorical_columns.length}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">空间列</span>
            <span class="summary-value">${columnInfo.spatial_columns.length}</span>
        </div>
    `;

    document.getElementById('dataSummary').innerHTML = html;
}

function buildFilterPanel() {
    const panel = document.getElementById('filterPanel');
    const columnInfo = AppState.columnInfo;

    if (!columnInfo) return;

    let html = '';

    const categoricalCols = columnInfo.categorical_columns.slice(0, 6);
    categoricalCols.forEach(col => {
        html += `
            <div class="filter-group">
                <label>${col}</label>
                <select class="filter-select" data-column="${col}" data-type="categorical">
                    <option value="">全部</option>
                </select>
            </div>
        `;
    });

    const dateCols = columnInfo.date_columns.slice(0, 2);
    dateCols.forEach(col => {
        html += `
            <div class="filter-group">
                <label>${col} (起)</label>
                <input type="date" class="filter-date-start" data-column="${col}" data-type="date_start">
            </div>
            <div class="filter-group">
                <label>${col} (止)</label>
                <input type="date" class="filter-date-end" data-column="${col}" data-type="date_end">
            </div>
        `;
    });

    panel.innerHTML = html;

    categoricalCols.forEach(col => {
        loadFilterOptions(col);
    });

    bindFilterEvents();
}

function bindFilterEvents() {
    document.querySelectorAll('.filter-select').forEach(select => {
        select.addEventListener('change', onFilterChange);
    });

    document.querySelectorAll('.filter-date-start, .filter-date-end').forEach(input => {
        input.addEventListener('change', onFilterChange);
    });
}

function onFilterChange() {
    AppState.filters = getCurrentFilters();
    debouncedUpdateAll();
}

async function loadFilterOptions(column) {
    const result = await API.getUniqueValues(column, 100);
    if (result.success && result.data) {
        const select = document.querySelector(`.filter-select[data-column="${column}"]`);
        if (select) {
            result.data.forEach(val => {
                const option = document.createElement('option');
                option.value = val;
                option.textContent = val;
                select.appendChild(option);
            });
        }
    }
}

function getCurrentFilters() {
    const filters = [];

    document.querySelectorAll('.filter-select').forEach(select => {
        const column = select.dataset.column;
        const value = select.value;
        if (value) {
            filters.push({ column, operator: 'equals', value });
        }
    });

    const dateColumns = {};
    document.querySelectorAll('.filter-date-start, .filter-date-end').forEach(input => {
        const column = input.dataset.column;
        const type = input.dataset.type;
        const value = input.value;
        if (value) {
            if (!dateColumns[column]) dateColumns[column] = {};
            dateColumns[column][type] = value;
        }
    });

    Object.entries(dateColumns).forEach(([column, dates]) => {
        if (dates.date_start && dates.date_end) {
            filters.push({
                column,
                operator: 'date_between',
                value: [dates.date_start, dates.date_end]
            });
        } else if (dates.date_start) {
            filters.push({ column, operator: 'greater_equal', value: dates.date_start });
        } else if (dates.date_end) {
            filters.push({ column, operator: 'less_equal', value: dates.date_end });
        }
    });

    return filters;
}

async function applyFilters() {
    AppState.filters = getCurrentFilters();
    await updateAllCharts();
    showToast('筛选已应用', 'success');
}

function resetFilters() {
    document.querySelectorAll('.filter-select').forEach(select => {
        select.value = '';
    });
    document.querySelectorAll('.filter-date-start, .filter-date-end').forEach(input => {
        input.value = '';
    });
    AppState.filters = [];
    updateAllCharts();
    showToast('筛选已重置', 'success');
}

async function cleanData() {
    showLoading();
    try {
        const options = {
            remove_duplicates: document.getElementById('cleanDedup').checked,
            handle_missing: document.getElementById('cleanMissing').value,
            convert_dates: document.getElementById('cleanDates').checked,
            standardize_text: false
        };

        const result = await API.cleanData(options);
        if (result.success) {
            AppState.summary = result.summary;
            updateDataSummary();
            await updateAllCharts();

            let message = '数据清洗完成！';
            if (result.report.duplicates_removed) {
                message += ` 去除重复: ${result.report.duplicates_removed}条`;
            }
            showToast(message, 'success');
        } else {
            showToast(result.message || '清洗失败', 'error');
        }
    } catch (error) {
        showToast('清洗失败: ' + error.message, 'error');
    }
    hideLoading();
}

function enableControls() {
    document.getElementById('applyFilterBtn').disabled = false;
    document.getElementById('resetFilterBtn').disabled = false;
    document.getElementById('cleanDataBtn').disabled = false;
}

async function updateAllCharts() {
    if (AppState.isUpdating) return;
    AppState.isUpdating = true;

    try {
        await Promise.all([
            updateLineChart(),
            updateRollingChart(),
            updateBarChart(),
            updateScatterChart(),
            updateHeatmap(),
            updateMapChart(),
            updateCorrelationMatrix(),
            updateTrendInfo(),
            updateCorrelationInfo(),
            updateForecastChart(),
            updateAnomalyChart(),
            updateForecastInfo(),
            updateAnomalyInfo()
        ]);
    } finally {
        AppState.isUpdating = false;
    }
}

function downsampleData(data, maxPoints) {
    if (!data || data.length <= maxPoints) return data;
    
    const step = Math.ceil(data.length / maxPoints);
    const sampled = [];
    for (let i = 0; i < data.length; i += step) {
        sampled.push(data[i]);
    }
    return sampled;
}

async function updateLineChart() {
    if (!AppState.dataLoaded) return;

    const metric = document.getElementById('trendMetric').value;
    const freq = document.getElementById('trendFreq').value;

    const result = await API.getLineChartData('date', metric, freq, 'sum', AppState.filters);
    if (result.success && result.data) {
        const sampledData = downsampleData(result.data, MAX_LINE_POINTS);
        lineChart.setData(sampledData, 'date', metric);
    }
}

async function updateRollingChart() {
    if (!AppState.dataLoaded) return;

    const metric = document.getElementById('trendMetric').value;
    const windowSize = parseInt(document.getElementById('rollingWindow').value);

    const result = await API.getRollingAverage('date', metric, windowSize, AppState.filters);
    if (result.success && result.data) {
        const cleanData = result.data.filter(d => d.rolling_avg !== null && d.rolling_avg !== undefined && !isNaN(d.rolling_avg));
        const sampledData = downsampleData(cleanData, MAX_LINE_POINTS);
        rollingChart.setData(sampledData, 'date', 'rolling_avg');
    }
}

async function updateBarChart() {
    if (!AppState.dataLoaded) return;

    const category = document.getElementById('barCategory').value;
    const metric = document.getElementById('barMetric').value;

    const result = await API.getBarChartData(category, metric, 'sum', AppState.filters, 20);
    if (result.success && result.data) {
        barChart.setData(result.data, category, 'value');
    }
}

async function updateScatterChart() {
    if (!AppState.dataLoaded) return;

    const xCol = document.getElementById('scatterX').value;
    const yCol = document.getElementById('scatterY').value;
    const colorCol = document.getElementById('scatterColor').value;

    const result = await API.getScatterChartData(xCol, yCol, colorCol, AppState.filters);
    if (result.success && result.data) {
        const sampledData = downsampleData(result.data, MAX_SCATTER_POINTS);
        scatterChart.setData(sampledData, xCol, yCol, colorCol);
    }
}

async function updateHeatmap() {
    if (!AppState.dataLoaded) return;

    const xCol = document.getElementById('heatX').value;
    const yCol = document.getElementById('heatY').value;

    if (xCol === yCol) {
        showToast('X轴和Y轴不能相同', 'warning');
        return;
    }

    const result = await API.getHeatmapData(xCol, yCol, 'sales_amount', 'sum', AppState.filters);
    if (result.success && result.data) {
        heatmapChart.setData(result.data);
    }
}

async function updateCorrelationMatrix() {
    if (!AppState.dataLoaded) return;

    const result = await API.getCorrelationMatrix(null, 'pearson', AppState.filters);
    if (result.success && result.data) {
        corrMatrixChart.setData(result.data);
    }
}

async function updateMapChart() {
    if (!AppState.dataLoaded) return;

    const metric = document.getElementById('mapMetric').value;
    const result = await API.getSpatialDistribution('city', metric, AppState.filters);

    if (result.success && result.data && AppState.columnInfo) {
        const cityLatLon = getCityLatLon();
        const mapData = result.data.map(item => {
            const cityInfo = cityLatLon[item.city] || {};
            return {
                city: item.city,
                latitude: cityInfo.latitude || 30,
                longitude: cityInfo.longitude || 110,
                total: item.total,
                average: item.average,
                count: item.count
            };
        });

        mapChart.setData(mapData, { valueKey: 'total', labelKey: 'city' });
        updateSpatialRank(result.data);
    }
}

function getCityLatLon() {
    return {
        '北京': { latitude: 39.9042, longitude: 116.4074 },
        '上海': { latitude: 31.2304, longitude: 121.4737 },
        '广州': { latitude: 23.1291, longitude: 113.2644 },
        '深圳': { latitude: 22.5431, longitude: 114.0579 },
        '成都': { latitude: 30.5728, longitude: 104.0668 },
        '杭州': { latitude: 30.2741, longitude: 120.1551 },
        '武汉': { latitude: 30.5928, longitude: 114.3055 },
        '西安': { latitude: 34.3416, longitude: 108.9398 },
        '南京': { latitude: 32.0603, longitude: 118.7969 },
        '重庆': { latitude: 29.4316, longitude: 106.9123 },
        '天津': { latitude: 39.3434, longitude: 117.3616 },
        '苏州': { latitude: 31.2989, longitude: 120.5853 },
        '郑州': { latitude: 34.7466, longitude: 113.6254 },
        '长沙': { latitude: 28.2282, longitude: 112.9388 },
        '青岛': { latitude: 36.0671, longitude: 120.3826 }
    };
}

function updateSpatialRank(data) {
    const container = document.getElementById('spatialRank');
    if (!container || !data) return;

    const sorted = [...data].sort((a, b) => b.total - a.total);

    let html = '<div style="padding: 8px 0;">';
    sorted.forEach((item, index) => {
        const rankColor = index < 3 ? ['#f5222d', '#fa8c16', '#faad14'][index] : '#666';
        const barWidth = (item.total / sorted[0].total) * 100;
        html += `
            <div style="display:flex;align-items:center;margin-bottom:10px;">
                <span style="width:24px;color:${rankColor};font-weight:bold;">${index + 1}</span>
                <span style="width:60px;font-size:12px;">${item.city}</span>
                <div style="flex:1;height:20px;background:#f0f0f0;border-radius:4px;overflow:hidden;margin:0 8px;">
                    <div style="height:100%;background:linear-gradient(90deg,#667eea,#764ba2);width:${barWidth}%;"></div>
                </div>
                <span style="width:80px;text-align:right;font-size:12px;font-weight:500;">${formatNumber(item.total)}</span>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

async function updateTrendInfo() {
    if (!AppState.dataLoaded) return;

    const metric = document.getElementById('trendMetric').value;
    const result = await API.getTrendAnalysis('date', metric, AppState.filters);

    if (result.success && result.data) {
        const trend = result.data;
        const html = `
            <div class="info-grid">
                <div class="info-item">
                    <div class="label">趋势方向</div>
                    <div class="value ${trend.direction === 'increasing' ? 'positive' : trend.direction === 'decreasing' ? 'negative' : ''}">
                        ${trend.direction === 'increasing' ? '📈 上升' : trend.direction === 'decreasing' ? '📉 下降' : '➡️ 平稳'}
                    </div>
                </div>
                <div class="info-item">
                    <div class="label">R² 拟合度</div>
                    <div class="value">${(trend.r_squared * 100).toFixed(1)}%</div>
                </div>
                <div class="info-item">
                    <div class="label">显著性</div>
                    <div class="value">${trend.significance === 'high' ? '高度显著' : trend.significance === 'medium' ? '中度显著' : '不显著'}</div>
                </div>
                <div class="info-item">
                    <div class="label">P值</div>
                    <div class="value">${trend.p_value.toExponential(2)}</div>
                </div>
            </div>
        `;
        document.getElementById('trendInfo').innerHTML = html;
    }
}

async function updateCorrelationInfo() {
    if (!AppState.dataLoaded) return;

    const result = await API.getTopCorrelations('sales_amount', 5, 'pearson', AppState.filters);

    if (result.success && result.data) {
        let html = '<p style="margin-bottom:8px;font-weight:500;">与销售额最相关的指标：</p>';
        html += '<ul class="correlation-list">';
        result.data.forEach(item => {
            const isPositive = item.correlation > 0;
            html += `
                <li class="correlation-item">
                    <span class="correlation-name">${item.column}</span>
                    <span class="correlation-value ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}${(item.correlation * 100).toFixed(1)}%
                    </span>
                </li>
            `;
        });
        html += '</ul>';
        document.getElementById('correlationInfo').innerHTML = html;
    }
}

function formatNumber(num) {
    if (num >= 100000000) return (num / 100000000).toFixed(2) + '亿';
    if (num >= 10000) return (num / 10000).toFixed(2) + '万';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'k';
    return num.toFixed(0);
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

let toastTimer;
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast';
    if (type) toast.classList.add(type);

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

async function updateForecastChart() {
    if (!AppState.dataLoaded) return;

    const metric = document.getElementById('forecastMetric').value;
    const method = document.getElementById('forecastMethod').value;
    const periods = parseInt(document.getElementById('forecastPeriods').value);
    const freq = document.getElementById('forecastFreq').value;

    const result = await API.getForecast('date', metric, method, periods, 7, 0.3, freq, AppState.filters);
    if (result.success && result.data) {
        forecastChart.setData(result.data, 'date', metric);
    }
}

async function updateAnomalyChart() {
    if (!AppState.dataLoaded) return;

    const metric = document.getElementById('anomalyMetric').value;
    const method = document.getElementById('anomalyMethod').value;
    const threshold = parseFloat(document.getElementById('anomalyThreshold').value);

    let anomalyResult;
    if (method === 'z_score' || method === 'iqr') {
        anomalyResult = await API.getAnomalyDetection(metric, method, null, threshold, 1.5, 7, AppState.filters);
    } else {
        anomalyResult = await API.getAnomalyDetection(metric, 'time_series', 'date', threshold, 1.5, 7, AppState.filters);
    }

    if (anomalyResult.success && anomalyResult.data) {
        const lineResult = await API.getLineChartData('date', metric, 'D', 'sum', AppState.filters);
        if (lineResult.success && lineResult.data) {
            const anomalies = anomalyResult.data.anomalies || [];
            anomalyChart.setTimeSeriesData(lineResult.data, anomalies, 'date', metric);
        }
    }
}

async function updateForecastInfo() {
    if (!AppState.dataLoaded) return;

    const metric = document.getElementById('forecastMetric').value;
    const method = document.getElementById('forecastMethod').value;
    const periods = parseInt(document.getElementById('forecastPeriods').value);
    const freq = document.getElementById('forecastFreq').value;

    const result = await API.getForecast('date', metric, method, periods, 7, 0.3, freq, AppState.filters);

    if (result.success && result.data && result.data.model) {
        const model = result.data.model;
        const methodNames = {
            'linear_regression': '线性回归',
            'moving_average': '移动平均',
            'exponential_smoothing': '指数平滑'
        };

        let html = '<div class="info-grid">';
        html += `<div class="info-item"><div class="label">预测方法</div><div class="value">${methodNames[model.method] || model.method}</div></div>`;
        html += `<div class="info-item"><div class="label">预测周期</div><div class="value">${model.periods}天</div></div>`;

        if (model.r_squared !== undefined) {
            html += `<div class="info-item"><div class="label">R² 拟合度</div><div class="value">${(model.r_squared * 100).toFixed(1)}%</div></div>`;
        }
        if (model.rmse !== undefined) {
            html += `<div class="info-item"><div class="label">RMSE</div><div class="value">${formatNumber(model.rmse)}</div></div>`;
        }
        if (model.last_value !== undefined) {
            html += `<div class="info-item"><div class="label">预测值</div><div class="value positive">${formatNumber(model.last_value)}</div></div>`;
        }
        if (model.std !== undefined) {
            html += `<div class="info-item"><div class="label">标准差</div><div class="value">${formatNumber(model.std)}</div></div>`;
        }
        html += '</div>';

        document.getElementById('forecastInfo').innerHTML = html;
    }
}

async function updateAnomalyInfo() {
    if (!AppState.dataLoaded) return;

    const metric = document.getElementById('anomalyMetric').value;

    const result = await API.getAnomalySummary(metric, 'date', AppState.filters);

    if (result.success && result.data) {
        const data = result.data;

        let html = '<div class="info-grid">';
        html += `<div class="info-item"><div class="label">Z-Score 异常数</div><div class="value ${data.z_score.anomaly_count > 0 ? 'negative' : ''}">${data.z_score.anomaly_count}个</div></div>`;
        html += `<div class="info-item"><div class="label">IQR 异常数</div><div class="value ${data.iqr.anomaly_count > 0 ? 'negative' : ''}">${data.iqr.anomaly_count}个</div></div>`;
        html += `<div class="info-item"><div class="label">数据均值</div><div class="value">${formatNumber(data.z_score.mean)}</div></div>`;
        html += `<div class="info-item"><div class="label">数据标准差</div><div class="value">${formatNumber(data.z_score.std)}</div></div>`;
        html += '</div>';

        html += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid #eee;">';
        html += `<p style="font-size:12px;color:#666;margin-bottom:4px;">IQR 下界: ${formatNumber(data.iqr.lower_bound)}</p>`;
        html += `<p style="font-size:12px;color:#666;">IQR 上界: ${formatNumber(data.iqr.upper_bound)}</p>`;
        html += '</div>';

        document.getElementById('anomalyInfo').innerHTML = html;
    }
}

const DashboardConfig = {
    charts: {
        trend: true,
        comparison: true,
        correlation: true,
        spatial: true,
        forecast: true
    },
    theme: 'default',
    colorScheme: 'tableau',
    showGrid: true,
    showTooltip: true,
    animation: false,
    autoRefresh: false
};

function loadDashboardConfig() {
    try {
        const saved = localStorage.getItem('dashboardConfig');
        if (saved) {
            const config = JSON.parse(saved);
            Object.assign(DashboardConfig, config);
            applyDashboardConfig();
        }
    } catch (e) {
        console.log('加载配置失败，使用默认配置');
    }
}

function applyDashboardConfig() {
    document.querySelectorAll('.chart-tab').forEach(tab => {
        const chartType = tab.dataset.tab;
        if (DashboardConfig.charts[chartType] === false) {
            tab.style.display = 'none';
        } else {
            tab.style.display = '';
        }
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        const id = content.id;
        const chartType = id.replace('Tab', '');
        if (DashboardConfig.charts[chartType] === false) {
            content.classList.remove('active');
        }
    });

    document.body.classList.remove('theme-blue', 'theme-green', 'theme-dark');
    if (DashboardConfig.theme !== 'default') {
        document.body.classList.add(`theme-${DashboardConfig.theme}`);
    }

    if (DashboardConfig.showGrid) {
        document.body.classList.remove('hide-grid');
    } else {
        document.body.classList.add('hide-grid');
    }
}

function openDashboardConfig() {
    const modal = document.getElementById('dashboardConfigModal');
    if (modal) modal.classList.remove('hidden');

    document.querySelectorAll('.dashboard-chart-toggle').forEach(checkbox => {
        const chart = checkbox.dataset.chart;
        checkbox.checked = DashboardConfig.charts[chart] !== false;
    });

    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.checked = radio.value === DashboardConfig.theme;
    });

    document.querySelectorAll('input[name="colorScheme"]').forEach(radio => {
        radio.checked = radio.value === DashboardConfig.colorScheme;
    });

    document.getElementById('configShowGrid').checked = DashboardConfig.showGrid;
    document.getElementById('configShowTooltip').checked = DashboardConfig.showTooltip;
    document.getElementById('configAnimation').checked = DashboardConfig.animation;
    document.getElementById('configAutoRefresh').checked = DashboardConfig.autoRefresh;
}

function closeDashboardConfig() {
    const modal = document.getElementById('dashboardConfigModal');
    if (modal) modal.classList.add('hidden');
}

function saveDashboardConfig() {
    document.querySelectorAll('.dashboard-chart-toggle').forEach(checkbox => {
        const chart = checkbox.dataset.chart;
        DashboardConfig.charts[chart] = checkbox.checked;
    });

    const themeRadio = document.querySelector('input[name="theme"]:checked');
    if (themeRadio) DashboardConfig.theme = themeRadio.value;

    const colorRadio = document.querySelector('input[name="colorScheme"]:checked');
    if (colorRadio) DashboardConfig.colorScheme = colorRadio.value;

    DashboardConfig.showGrid = document.getElementById('configShowGrid').checked;
    DashboardConfig.showTooltip = document.getElementById('configShowTooltip').checked;
    DashboardConfig.animation = document.getElementById('configAnimation').checked;
    DashboardConfig.autoRefresh = document.getElementById('configAutoRefresh').checked;

    try {
        localStorage.setItem('dashboardConfig', JSON.stringify(DashboardConfig));
    } catch (e) {
        console.log('保存配置失败');
    }

    applyDashboardConfig();
    closeDashboardConfig();
    showToast('仪表盘配置已保存', 'success');

    const activeTab = document.querySelector('.chart-tab.active');
    if (activeTab && DashboardConfig.charts[activeTab.dataset.tab] === false) {
        const firstVisible = document.querySelector('.chart-tab:not([style*="display: none"])');
        if (firstVisible) {
            switchTab(firstVisible.dataset.tab);
        }
    }
}

function resetDashboardConfig() {
    DashboardConfig.charts = {
        trend: true,
        comparison: true,
        correlation: true,
        spatial: true,
        forecast: true
    };
    DashboardConfig.theme = 'default';
    DashboardConfig.colorScheme = 'tableau';
    DashboardConfig.showGrid = true;
    DashboardConfig.showTooltip = true;
    DashboardConfig.animation = false;
    DashboardConfig.autoRefresh = false;

    openDashboardConfig();
    showToast('已恢复默认配置', 'info');
}
