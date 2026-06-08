class MapChart {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.margin = options.margin || { top: 20, right: 40, bottom: 40, left: 40 };
        this.data = [];
        this.latKey = options.latKey || 'latitude';
        this.lonKey = options.lonKey || 'longitude';
        this.valueKey = options.valueKey || 'total';
        this.labelKey = options.labelKey || 'city';
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

    setData(data, options = {}) {
        this.data = data || [];
        if (options.valueKey) this.valueKey = options.valueKey;
        if (options.labelKey) this.labelKey = options.labelKey;
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

        const lonValues = this.data.map(d => +d[this.lonKey]);
        const latValues = this.data.map(d => +d[this.latKey]);
        const valueValues = this.data.map(d => +d[this.valueKey]);

        const lonMin = Math.min(...lonValues) - 2;
        const lonMax = Math.max(...lonValues) + 2;
        const latMin = Math.min(...latValues) - 2;
        const latMax = Math.max(...latValues) + 2;

        const xScale = d3.scaleLinear()
            .domain([lonMin, lonMax])
            .range([0, this.width]);

        const yScale = d3.scaleLinear()
            .domain([latMin, latMax])
            .range([this.height, 0]);

        const valueMin = Math.min(...valueValues);
        const valueMax = Math.max(...valueValues);

        const radiusScale = d3.scaleSqrt()
            .domain([valueMin, valueMax])
            .range([8, 40]);

        const colorScale = d3.scaleSequential()
            .domain([valueMin, valueMax])
            .interpolator(d3.interpolateViridis);

        g.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('fill', '#f8f9fa')
            .attr('rx', 8);

        const self = this;

        const bubble = g.selectAll('.bubble')
            .data(this.data)
            .enter()
            .append('g')
            .attr('class', 'bubble')
            .attr('transform', d => `translate(${xScale(+d[self.lonKey])},${yScale(+d[self.latKey])})`)
            .style('cursor', 'pointer');

        bubble.append('circle')
            .attr('r', d => radiusScale(+d[self.valueKey]))
            .attr('fill', d => colorScale(+d[self.valueKey]))
            .attr('opacity', 0.7)
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('r', radiusScale(+d[self.valueKey]) * 1.15)
                    .attr('opacity', 0.9);
                self.showTooltip(event, d);
            })
            .on('mouseout', function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('r', radiusScale(+d[self.valueKey]))
                    .attr('opacity', 0.7);
                self.hideTooltip();
            });

        bubble.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .style('font-size', '11px')
            .style('fill', 'white')
            .style('font-weight', 'bold')
            .style('pointer-events', 'none')
            .style('text-shadow', '0 1px 2px rgba(0,0,0,0.5)')
            .text(d => d[this.labelKey])
            .each(function(d) {
                const label = d3.select(this);
                const r = radiusScale(+d[self.valueKey]);
                if (r < 20) {
                    label.style('font-size', '9px');
                }
                if (r < 15) {
                    label.text('');
                }
            });

        g.append('g')
            .attr('class', 'x axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => d + '°E'));

        g.append('g')
            .attr('class', 'y axis')
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => d + '°N'));

        const legendRadius = 20;
        const legendValues = [valueMin, (valueMin + valueMax) / 2, valueMax];
        const legendX = this.width - 60;
        const legendY = this.height - 80;

        const legend = g.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${legendX}, ${legendY})`);

        legendValues.forEach((val, i) => {
            legend.append('circle')
                .attr('cx', 0)
                .attr('cy', -i * 30)
                .attr('r', radiusScale(val))
                .attr('fill', 'none')
                .attr('stroke', '#999')
                .attr('stroke-width', 1);

            legend.append('text')
                .attr('x', 25)
                .attr('y', -i * 30 + 4)
                .style('font-size', '11px')
                .style('fill', '#666')
                .text(self.formatNumber(val));
        });

        legend.append('text')
            .attr('x', 0)
            .attr('y', -legendValues.length * 30 - 10)
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', '#333')
            .text(this.valueKey);
    }

    formatNumber(num) {
        if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿';
        if (num >= 10000) return (num / 10000).toFixed(1) + '万';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return Math.round(num).toString();
    }

    showTooltip(event, d) {
        const formatValue = val => {
            if (typeof val === 'number') {
                return this.formatNumber(val);
            }
            return val;
        };

        let html = `<div style="font-weight:bold;font-size:14px;margin-bottom:4px;">${d[this.labelKey]}</div>`;
        html += `<div>经度: ${d[this.lonKey]}°E</div>`;
        html += `<div>纬度: ${d[this.latKey]}°N</div>`;
        html += `<div style="margin-top:4px;"><strong>${this.valueKey}:</strong> ${formatValue(+d[this.valueKey])}</div>`;

        this.tooltip
            .html(html)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .classed('visible', true);
    }

    hideTooltip() {
        this.tooltip.classed('visible', false);
    }
}
