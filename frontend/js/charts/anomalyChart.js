class AnomalyChart {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.margin = options.margin || { top: 20, right: 30, bottom: 50, left: 60 };
        this.color = options.color || '#667eea';
        this.anomalyColor = options.anomalyColor || '#f5222d';
        this.data = [];
        this.anomalies = [];
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
        if (this.data && this.data.length > 0) {
            this.render();
        }
    }

    setData(anomalyResult, xKey, yKey) {
        if (anomalyResult && anomalyResult.anomalies) {
            this.anomalies = anomalyResult.anomalies || [];
        } else {
            this.anomalies = [];
        }
        this.data = anomalyResult && anomalyResult.time_series ? anomalyResult.time_series : [];

        if (xKey) this.xKey = xKey;
        if (yKey) this.yKey = yKey;

        this.render();
    }

    setTimeSeriesData(timeSeriesData, anomalies, xKey, yKey) {
        this.data = timeSeriesData || [];
        this.anomalies = anomalies || [];
        if (xKey) this.xKey = xKey;
        if (yKey) this.yKey = yKey;
        this.render();
    }

    render() {
        if (!this.container || this.data.length === 0) return;

        d3.select(this.container).selectAll('*').remove();

        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        const parseTime = d3.timeParse('%Y-%m-%d');
        const xValues = this.data.map(d => parseTime(d[this.xKey]) || new Date(d[this.xKey]));
        const yValues = this.data.map(d => +d[this.yKey]);

        const x = d3.scaleTime()
            .domain(d3.extent(xValues))
            .range([0, this.width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(yValues) * 1.15])
            .range([this.height, 0]).nice();

        this.xScale = x;
        this.yScale = y;

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

        const line = d3.line()
            .x((d, i) => x(xValues[i]))
            .y(d => y(+d[this.yKey]))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(this.data)
            .attr('class', 'line')
            .attr('fill', 'none')
            .attr('stroke', this.color)
            .attr('stroke-width', 2)
            .attr('d', line);

        const self = this;
        const anomalyMap = {};
        this.anomalies.forEach(a => {
            const key = a[this.xKey] || a.date;
            if (key) anomalyMap[key] = a;
        });

        if (this.anomalies.length > 0) {
            const anomalyPoints = this.data.filter(d => {
                const key = d[self.xKey];
                return anomalyMap[key] !== undefined || d.is_anomaly;
            });

            if (anomalyPoints.length === 0 && this.anomalies.length > 0) {
                this.anomalies.forEach(a => {
                    if (a[self.yKey] !== undefined) {
                        anomalyPoints.push(a);
                    }
                });
            }

            g.selectAll('.anomaly-dot')
                .data(anomalyPoints.slice(0, 100))
                .enter()
                .append('circle')
                .attr('class', 'anomaly-dot')
                .attr('cx', d => {
                    const xVal = parseTime(d[self.xKey]) || new Date(d[self.xKey]);
                    return x(xVal);
                })
                .attr('cy', d => y(+d[self.yKey]))
                .attr('r', 7)
                .attr('fill', this.anomalyColor)
                .attr('opacity', 0.9)
                .attr('stroke', '#fff')
                .attr('stroke-width', 2)
                .style('cursor', 'pointer')
                .on('mouseover', function(event, d) {
                    d3.select(this).attr('r', 10);
                    self.showTooltip(event, d, true);
                })
                .on('mousemove', function(event, d) {
                    self.moveTooltip(event);
                })
                .on('mouseout', function() {
                    d3.select(this).attr('r', 7);
                    self.hideTooltip();
                });
        }

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
            { label: '正常数据', color: this.color },
            { label: '异常点', color: this.anomalyColor, isCircle: true }
        ];

        const legend = g.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${this.width - 120}, 0)`);

        legendData.forEach((item, i) => {
            const legendItem = legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`);

            if (item.isCircle) {
                legendItem.append('circle')
                    .attr('cx', 6)
                    .attr('cy', 8)
                    .attr('r', 5)
                    .attr('fill', item.color);
            } else {
                legendItem.append('line')
                    .attr('x1', 0)
                    .attr('x2', 14)
                    .attr('y1', 8)
                    .attr('y2', 8)
                    .attr('stroke', item.color)
                    .attr('stroke-width', 2);
            }

            legendItem.append('text')
                .attr('x', 20)
                .attr('y', 10)
                .style('font-size', '11px')
                .text(item.label);
        });
    }

    showTooltip(event, d, isAnomaly) {
        const formatValue = val => {
            if (typeof val === 'number') {
                return val.toLocaleString();
            }
            return val;
        };

        const xLabel = d[this.xKey] || d.date;
        const yLabel = formatValue(+d[this.yKey]);

        let html = `<div style="font-weight:bold;margin-bottom:4px;">`;
        html += isAnomaly ? '⚠️ 异常点' : '数据点';
        html += `</div>`;
        html += `<div>${xLabel}</div>`;
        html += `<div>数值: ${yLabel}</div>`;

        if (d.z_score !== undefined) {
            html += `<div>Z分数: ${(+d.z_score).toFixed(2)}</div>`;
        }

        this.tooltip
            .html(html)
            .style('left', (event.pageX + 12) + 'px')
            .style('top', (event.pageY - 12) + 'px')
            .classed('visible', true);
    }

    moveTooltip(event) {
        this.tooltip
            .style('left', (event.pageX + 12) + 'px')
            .style('top', (event.pageY - 12) + 'px');
    }

    hideTooltip() {
        this.tooltip.classed('visible', false);
    }
}
