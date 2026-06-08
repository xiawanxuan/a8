class LineChart {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.margin = options.margin || { top: 20, right: 30, bottom: 50, left: 60 };
        this.color = options.color || '#667eea';
        this.data = [];
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

        const parseTime = d3.timeParse('%Y-%m-%d');
        const xValues = this.data.map(d => parseTime(d[this.xKey]) || new Date(d[this.xKey]));
        const yValues = this.data.map(d => +d[this.yKey]);

        const x = d3.scaleTime()
            .domain(d3.extent(xValues))
            .range([0, this.width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(yValues) * 1.1])
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

        const line = d3.line()
            .x((d, i) => x(xValues[i]))
            .y(d => y(+d[this.yKey]))
            .curve(d3.curveMonotoneX);

        const area = d3.area()
            .x((d, i) => x(xValues[i]))
            .y0(this.height)
            .y1(d => y(+d[this.yKey]))
            .curve(d3.curveMonotoneX);

        const gradient = svg.append('defs')
            .append('linearGradient')
            .attr('id', 'lineGradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '0%')
            .attr('y2', '100%');

        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', this.color)
            .attr('stop-opacity', 0.3);

        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', this.color)
            .attr('stop-opacity', 0.01);

        g.append('path')
            .datum(this.data)
            .attr('class', 'area')
            .attr('fill', 'url(#lineGradient)')
            .attr('d', area);

        g.append('path')
            .datum(this.data)
            .attr('class', 'line')
            .attr('fill', 'none')
            .attr('stroke', this.color)
            .attr('stroke-width', 2)
            .attr('d', line);

        const self = this;
        g.selectAll('.dot')
            .data(this.data)
            .enter()
            .append('circle')
            .attr('class', 'dot')
            .attr('cx', (d, i) => x(xValues[i]))
            .attr('cy', d => y(+d[this.yKey]))
            .attr('r', 3)
            .attr('fill', 'white')
            .attr('stroke', this.color)
            .attr('stroke-width', 2)
            .on('mouseover', function(event, d) {
                d3.select(this).attr('r', 6);
                self.showTooltip(event, d);
            })
            .on('mouseout', function() {
                d3.select(this).attr('r', 3);
                self.hideTooltip();
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
    }

    showTooltip(event, d) {
        const formatValue = val => {
            if (typeof val === 'number') {
                return val.toLocaleString();
            }
            return val;
        };

        const xLabel = d[this.xKey];
        const yLabel = formatValue(d[this.yKey]);

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
