class BarChart {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.margin = options.margin || { top: 20, right: 30, bottom: 60, left: 60 };
        this.color = options.color || '#667eea';
        this.colorScheme = options.colorScheme || d3.schemeSet3;
        this.data = [];
        this.xKey = options.xKey || 'city';
        this.yKey = options.yKey || 'value';
        this.horizontal = options.horizontal || false;
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

    setData(data, xKey, yKey) {
        this.data = data || [];
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

        const colorScale = d3.scaleOrdinal()
            .domain(this.data.map(d => d[this.xKey]))
            .range(d3.schemeTableau10);

        const x = d3.scaleBand()
            .domain(this.data.map(d => d[this.xKey]))
            .range([0, this.width])
            .padding(0.2);

        const y = d3.scaleLinear()
            .domain([0, d3.max(this.data, d => +d[this.yKey]) * 1.1])
            .range([this.height, 0]).nice();

        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(y)
                .tickSize(-this.width)
                .tickFormat('')
            )
            .call(g => g.select('.domain').remove());

        const self = this;
        g.selectAll('.bar')
            .data(this.data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d[this.xKey]))
            .attr('y', d => y(+d[self.yKey]))
            .attr('width', x.bandwidth())
            .attr('height', d => this.height - y(+d[self.yKey]))
            .attr('fill', d => colorScale(d[this.xKey]))
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('opacity', 0.8);
                self.showTooltip(event, d);
            })
            .on('mouseout', function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('opacity', 1);
                self.hideTooltip();
            });

        g.append('g')
            .attr('class', 'x axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');

        g.append('g')
            .attr('class', 'y axis')
            .call(d3.axisLeft(y).ticks(5));

        g.selectAll('.label')
            .data(this.data)
            .enter()
            .append('text')
            .attr('class', 'bar-label')
            .attr('x', d => x(d[this.xKey]) + x.bandwidth() / 2)
            .attr('y', d => y(+d[this.yKey]) - 5)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#666')
            .text(d => {
                const val = +d[this.yKey];
                if (val > 10000) return (val / 10000).toFixed(1) + '万';
                if (val > 1000) return (val / 1000).toFixed(1) + 'k';
                return Math.round(val);
            });
    }

    showTooltip(event, d) {
        const formatValue = val => {
            if (typeof val === 'number') {
                return val.toLocaleString();
            }
            return val;
        };

        const xLabel = d[this.xKey];
        const yLabel = formatValue(+d[this.yKey]);

        this.tooltip
            .html(`
                <div><strong>${xLabel}</strong></div>
                <div>${this.yKey}: ${yLabel}</div>
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .classed('visible', true);
    }

    hideTooltip() {
        this.tooltip.classed('visible', false);
    }
}
