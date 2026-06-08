class ForecastChart {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.margin = options.margin || { top: 20, right: 30, bottom: 50, left: 60 };
        this.color = options.color || '#667eea';
        this.forecastColor = options.forecastColor || '#52c41a';
        this.data = { historical: [], forecast: [] };
        this.xKey = options.xKey || 'date';
        this.yKey = options.yKey || 'sales_amount';
        this.tooltip = null;
        this.init();
    }

    init() {
        if (!this.container) return;

        this.tooltip = d3.select('body')
            .append('div')
            .attr('class', 'tooltip-d3');

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.container) return;
        const rect = this.container.getBoundingClientRect();
        this.width = rect.width - this.margin.left - this.margin.right;
        this.height = rect.height - this.margin.top - this.margin.bottom;
        if (this.data && (this.data.historical.length > 0 || this.data.forecast.length > 0)) {
            this.render();
        }
    }

    setData(forecastData, xKey, yKey) {
        this.data = forecastData || { historical: [], forecast: [] };
        if (xKey) this.xKey = xKey;
        if (yKey) this.yKey = yKey;
        this.render();
    }

    render() {
        if (!this.container) return;

        const allData = [
            ...(this.data.historical || []),
            ...(this.data.forecast || [])
        ];

        if (allData.length === 0) return;

        d3.select(this.container).selectAll('*').remove();

        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        const parseTime = d3.timeParse('%Y-%m-%d');
        const xValues = allData.map(d => parseTime(d[this.xKey]) || new Date(d[this.xKey]));
        const yValues = allData.map(d => +d[this.yKey]);

        const x = d3.scaleTime()
            .domain(d3.extent(xValues))
            .range([0, this.width]);

        const yMin = d3.min([
            ...yValues,
            ...(this.data.forecast || []).map(d => +d.lower)
        ]);
        const yMax = d3.max([
            ...yValues,
            ...(this.data.forecast || []).map(d => +d.upper)
        ]);

        const y = d3.scaleLinear()
            .domain([Math.min(0, yMin * 0.9), yMax * 1.1])
            .range([this.height, 0]).nice();

        g.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(x)
                .tickSize(-this.height)
                .tickFormat('')
            )
            .call(g => g.select('.domain').remove());

        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(y)
                .tickSize(-this.width)
                .tickFormat('')
            )
            .call(g => g.select('.domain').remove());

        const historicalData = this.data.historical || [];
        const forecastData = this.data.forecast || [];

        if (forecastData.length > 0) {
            const confidenceArea = d3.area()
                .x((d, i) => {
                    const idx = historicalData.length + i;
                    return x(xValues[idx]);
                })
                .y0(d => y(+d.lower))
                .y1(d => y(+d.upper))
                .curve(d3.curveMonotoneX);

            g.append('path')
                .datum(forecastData)
                .attr('class', 'confidence-band')
                .attr('fill', this.forecastColor)
                .attr('opacity', 0.2)
                .attr('d', confidenceArea);
        }

        const historicalLine = d3.line()
            .x((d, i) => {
                const historicalXValues = historicalData.map(d => parseTime(d[this.xKey]) || new Date(d[this.xKey]));
                return x(historicalXValues[i]);
            })
            .y(d => y(+d[this.yKey]))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(historicalData)
            .attr('class', 'line')
            .attr('fill', 'none')
            .attr('stroke', this.color)
            .attr('stroke-width', 2.5)
            .attr('d', historicalLine);

        if (forecastData.length > 0) {
            const forecastXValues = forecastData.map(d => parseTime(d[this.xKey]) || new Date(d[this.xKey]));

            const forecastLine = d3.line()
                .x((d, i) => x(forecastXValues[i]))
                .y(d => y(+d[this.yKey]))
                .curve(d3.curveMonotoneX);

            g.append('path')
                .datum(forecastData)
                .attr('class', 'line forecast-line')
                .attr('fill', 'none')
                .attr('stroke', this.forecastColor)
                .attr('stroke-width', 2.5)
                .attr('stroke-dasharray', '8,4')
                .attr('d', forecastLine);
        }

        const self = this;
        const bisect = d3.bisector(d => parseTime(d[self.xKey]) || new Date(d[self.xKey])).left;

        const focus = g.append('g')
            .style('display', 'none');

        focus.append('circle')
            .attr('r', 6)
            .attr('fill', 'white')
            .attr('stroke', this.color)
            .attr('stroke-width', 2);

        const overlay = g.append('rect')
            .attr('class', 'overlay')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('fill', 'none')
            .style('pointer-events', 'all')
            .style('cursor', 'crosshair')
            .on('mouseover', function() { focus.style('display', null); })
            .on('mouseout', function() { 
                focus.style('display', 'none'); 
                self.hideTooltip();
            })
            .on('mousemove', function(event) {
                const [mx] = d3.pointer(event);
                const x0 = x.invert(mx);
                
                let combinedData = [...historicalData, ...forecastData];
                let combinedXValues = combinedData.map(d => parseTime(d[self.xKey]) || new Date(d[self.xKey]));
                
                const i = bisect(combinedData, x0, 1);
                const d0 = combinedData[i - 1];
                const d1 = combinedData[i];
                
                if (!d0 && !d1) return;
                
                let d, idx;
                if (!d0) { d = d1; idx = i; }
                else if (!d1) { d = d0; idx = i - 1; }
                else {
                    d = x0 - combinedXValues[i - 1] > combinedXValues[i] - x0 ? d1 : d0;
                    idx = x0 - combinedXValues[i - 1] > combinedXValues[i] - x0 ? i : i - 1;
                }
                
                const isForecast = d.type === 'forecast' || idx >= historicalData.length;
                const color = isForecast ? self.forecastColor : self.color;
                
                focus.select('circle')
                    .attr('fill', 'white')
                    .attr('stroke', color);
                
                focus.attr('transform', `translate(${x(combinedXValues[idx])},${y(+d[self.yKey])})`);
                self.showTooltip(event, d, isForecast);
            });

        g.append('g')
            .attr('class', 'x axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat('%Y-%m-%d')))
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');

        g.append('g')
            .attr('class', 'y axis')
            .call(d3.axisLeft(y).ticks(5));

        const legendData = [
            { label: '历史数据', color: this.color, dash: '' },
            { label: '预测数据', color: this.forecastColor, dash: '8,4' },
            { label: '置信区间', color: this.forecastColor, opacity: 0.2 }
        ];

        const legend = g.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${this.width - 140}, 0)`);

        legendData.forEach((item, i) => {
            const legendItem = legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`);

            if (item.opacity) {
                legendItem.append('rect')
                    .attr('width', 20)
                    .attr('height', 10)
                    .attr('y', 3)
                    .attr('fill', item.color)
                    .attr('opacity', item.opacity);
            } else {
                legendItem.append('line')
                    .attr('x1', 0)
                    .attr('x2', 20)
                    .attr('y1', 8)
                    .attr('y2', 8)
                    .attr('stroke', item.color)
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', item.dash);
            }

            legendItem.append('text')
                .attr('x', 26)
                .attr('y', 10)
                .style('font-size', '11px')
                .text(item.label);
        });
    }

    showTooltip(event, d, isForecast) {
        const formatValue = val => {
            if (typeof val === 'number') {
                return val.toLocaleString();
            }
            return val;
        };

        const xLabel = d[this.xKey];
        const yLabel = formatValue(+d[this.yKey]);
        const typeLabel = isForecast ? '预测值' : '实际值';

        let html = `<div style="font-weight:bold;margin-bottom:4px;">${xLabel}</div>`;
        html += `<div>${typeLabel}: ${yLabel}</div>`;

        if (d.upper !== undefined && d.lower !== undefined) {
            html += `<div style="color:#666;font-size:11px;">区间: ${formatValue(+d.lower)} ~ ${formatValue(+d.upper)}</div>`;
        }

        this.tooltip
            .html(html)
            .style('left', (event.pageX + 12) + 'px')
            .style('top', (event.pageY - 12) + 'px')
            .classed('visible', true);
    }

    hideTooltip() {
        this.tooltip.classed('visible', false);
    }
}
