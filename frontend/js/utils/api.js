const API = {
    baseUrl: '/api',

    async request(endpoint, options = {}) {
        const url = this.baseUrl + endpoint;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API请求失败:', error);
            return { success: false, message: error.message };
        }
    },

    async healthCheck() {
        return this.request('/health');
    },

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        const url = this.baseUrl + '/data/upload';
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('文件上传失败:', error);
            return { success: false, message: error.message };
        }
    },

    async loadSampleData() {
        return this.request('/sample/load', { method: 'POST' });
    },

    async getDataSummary() {
        return this.request('/data/summary');
    },

    getDataPreview(rows = 100) {
        return this.request(`/data/preview?rows=${rows}`);
    },

    getColumns() {
        return this.request('/data/columns');
    },

    getUniqueValues(column, limit = 100) {
        return this.request(`/data/unique-values?column=${encodeURIComponent(column)}&limit=${limit}`);
    },

    getValueRange(column) {
        return this.request(`/data/value-range?column=${encodeURIComponent(column)}`);
    },

    cleanData(options) {
        return this.request('/data/clean', {
            method: 'POST',
            body: JSON.stringify({ options }),
        });
    },

    filterData(filters) {
        return this.request('/data/filter', {
            method: 'POST',
            body: JSON.stringify({ filters }),
        });
    },

    aggregateData(groupBy, aggregations, filters = []) {
        return this.request('/data/aggregate', {
            method: 'POST',
            body: JSON.stringify({ group_by: groupBy, aggregations, filters }),
        });
    },

    getLineChartData(timeColumn, valueColumn, freq = 'M', func = 'sum', filters = []) {
        return this.request('/chart/line', {
            method: 'POST',
            body: JSON.stringify({
                time_column: timeColumn,
                value_column: valueColumn,
                freq,
                func,
                filters,
            }),
        });
    },

    getBarChartData(categoryColumn, valueColumn, func = 'sum', filters = [], topN = 20) {
        return this.request('/chart/bar', {
            method: 'POST',
            body: JSON.stringify({
                category_column: categoryColumn,
                value_column: valueColumn,
                func,
                filters,
                top_n: topN,
            }),
        });
    },

    getScatterChartData(xColumn, yColumn, categoryColumn = null, filters = []) {
        return this.request('/chart/scatter', {
            method: 'POST',
            body: JSON.stringify({
                x_column: xColumn,
                y_column: yColumn,
                category_column: categoryColumn,
                filters,
            }),
        });
    },

    getHeatmapData(xColumn, yColumn, valueColumn, aggfunc = 'mean', filters = []) {
        return this.request('/chart/heatmap', {
            method: 'POST',
            body: JSON.stringify({
                x_column: xColumn,
                y_column: yColumn,
                value_column: valueColumn,
                aggfunc,
                filters,
            }),
        });
    },

    getTrendAnalysis(timeColumn, valueColumn, filters = []) {
        return this.request('/analysis/trend', {
            method: 'POST',
            body: JSON.stringify({
                time_column: timeColumn,
                value_column: valueColumn,
                filters,
            }),
        });
    },

    getRollingAverage(timeColumn, valueColumn, window = 30, filters = []) {
        return this.request('/analysis/rolling', {
            method: 'POST',
            body: JSON.stringify({
                time_column: timeColumn,
                value_column: valueColumn,
                window,
                filters,
            }),
        });
    },

    getSeasonalDecompose(timeColumn, valueColumn, period = 12, filters = []) {
        return this.request('/analysis/seasonal', {
            method: 'POST',
            body: JSON.stringify({
                time_column: timeColumn,
                value_column: valueColumn,
                period,
                filters,
            }),
        });
    },

    getCorrelationMatrix(columns = null, method = 'pearson', filters = []) {
        return this.request('/analysis/correlation-matrix', {
            method: 'POST',
            body: JSON.stringify({ columns, method, filters }),
        });
    },

    getPairwiseCorrelation(col1, col2, method = 'pearson', filters = []) {
        return this.request('/analysis/pairwise-correlation', {
            method: 'POST',
            body: JSON.stringify({ col1, col2, method, filters }),
        });
    },

    getTopCorrelations(targetColumn, topN = 10, method = 'pearson', filters = []) {
        return this.request('/analysis/top-correlations', {
            method: 'POST',
            body: JSON.stringify({
                target_column: targetColumn,
                top_n: topN,
                method,
                filters,
            }),
        });
    },

    getAnovaTest(groupColumn, valueColumn, filters = []) {
        return this.request('/analysis/anova', {
            method: 'POST',
            body: JSON.stringify({
                group_column: groupColumn,
                value_column: valueColumn,
                filters,
            }),
        });
    },

    getSpatialDistribution(locationColumn, valueColumn, filters = []) {
        return this.request('/analysis/spatial-distribution', {
            method: 'POST',
            body: JSON.stringify({
                location_column: locationColumn,
                value_column: valueColumn,
                filters,
            }),
        });
    },

    getForecast(timeColumn, valueColumn, method = 'linear', periods = 30, window = 7, alpha = 0.3, freq = 'D', filters = []) {
        return this.request('/analysis/forecast', {
            method: 'POST',
            body: JSON.stringify({
                time_column: timeColumn,
                value_column: valueColumn,
                method,
                periods,
                window,
                alpha,
                freq,
                filters,
            }),
        });
    },

    getAnomalyDetection(valueColumn, method = 'z_score', timeColumn = null, threshold = 3, k = 1.5, window = 7, filters = []) {
        return this.request('/analysis/anomaly', {
            method: 'POST',
            body: JSON.stringify({
                value_column: valueColumn,
                time_column: timeColumn,
                method,
                threshold,
                k,
                window,
                filters,
            }),
        });
    },

    getAnomalySummary(valueColumn, timeColumn = null, filters = []) {
        return this.request('/analysis/anomaly-summary', {
            method: 'POST',
            body: JSON.stringify({
                value_column: valueColumn,
                time_column: timeColumn,
                filters,
            }),
        });
    },
};
