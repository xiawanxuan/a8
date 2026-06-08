class ScatterPlot {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.margin = options.margin || { top: 20, right: 30, bottom: 50, left: 60 };
        this.data = [];
        this.xKey = options.xKey || 'order_count';
        this.yKey = options.yKey || 'sales_amount';
        this.colorKey = options.colorKey || 'category';
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

    setData(data, xKey, yKey, colorKey) {
        this.data = data || [];
        if (xKey) this.xKey = xKey;
        if (yKey) this.yKey = yKey;
        if (colorKey) this.colorKey = colorKey;
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

        const colorScale = d3.scaleOrdinal()
            .domain([...new Set(this.data.map(d => d[this.colorKey]))])
            .range(d3.schemeTableau10);

        const x = d3.scaleLinear()
            .domain([0, d3.max(this.data, d => +d[this.xKey]) * 1.1])
            .range([0, this.width]).nice();

        const y = d3.scaleLinear()
            .domain([0, d3.max(this.data, d => +d[this.yKey]) * 1.1])
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

        const self = this;
        g.selectAll('.dot')
            .data(this.data)
            .enter()
            .append('circle')
            .attr('class', 'dot')
            .attr('cx', d => x(+d[self.xKey]))
            .attr('cy', d => y(+d[self.yKey]))
            .attr('r', 4)
            .attr('fill', d => colorScale(d[self.colorKey]))
            .attr('opacity', 0.7)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('r', 7)
                    .attr('opacity', 1);
                self.showTooltip(event, d);
            })
            .on('mouseout', function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('r', 4)
                    .attr('opacity', 0.7);
                self.hideTooltip();
            });

        g.append('g')
            .attr('class', 'x axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(x).ticks(5));

        g.append('g')
            .attr('class', 'y axis')
            .call(d3.axisLeft(y).ticks(5));

        const categories = [...new Set(this.data.map(d => d[this.colorKey]))];
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${this.width + this.margin.left - 10}, ${this.margin.top})`);

        const legendItems = legend.selectAll('.legend-item')
            .data(categories)
            .enter()
            .append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 20})`);

        legendItems.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', d => colorScale(d));

        legendItems.append('text')
            .attr('x', 18)
            .attr('y', 10)
            .style('font-size', '11px')
            .text(d => d);
    }

    showTooltip(event, d) {
        const formatValue = val => {
            if (typeof val === 'number') {
                return val.toLocaleString();
            }
            return val;
        };

        let html = `<div><strong>${d[this.colorKey] || '数据点'}</strong></div>`;
        html += `<div>${this.xKey}: ${formatValue(+d[this.xKey])}</div>`;
        html += `<div>${this.yKey}: ${formatValue(+d[this.yKey])}</div>`;

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
