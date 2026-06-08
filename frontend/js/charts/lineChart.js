class LineChart {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.margin = options.margin || { top: 20, right: 30, bottom: 50, left: 60 };
        this.color = options.color || '#667eea';
        this.data = [];
        this.xKey = options.xKey || 'date';
        this.yKey = options.yKey || 'sales_amount';
        this.tooltip = null;
        this.showDotsThreshold = 50;
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

        this.xScale = x;
        this.yScale = y;
        this.xValues = xValues;

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

        const gradientId = 'lineGradient_' + Math.random().toString(36).substr(2, 9);
        const gradient = svg.append('defs')
            .append('linearGradient')
            .attr('id', gradientId)
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
            .attr('fill', `url(#${gradientId})`)
            .attr('d', area);

        g.append('path')
            .datum(this.data)
            .attr('class', 'line')
            .attr('fill', 'none')
            .attr('stroke', this.color)
            .attr('stroke-width', 2)
            .attr('d', line);

        const self = this;
        const showDots = this.data.length <= this.showDotsThreshold;

        if (showDots) {
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
                .style('cursor', 'pointer')
                .on('mouseover', function(event, d) {
                    d3.select(this).attr('r', 6);
                    self.showTooltip(event, d);
                })
                .on('mousemove', function(event, d) {
                    self.moveTooltip(event);
                })
                .on('mouseout', function() {
                    d3.select(this).attr('r', 3);
                    self.hideTooltip();
                });
        } else {
            const bisect = d3.bisector((d, i) => xValues[i]).left;

            const focus = g.append('g')
                .style('display', 'none');

            focus.append('circle')
                .attr('r', 5)
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
                    const i = bisect(xValues, x0, 1);
                    const d0 = self.data[i - 1];
                    const d1 = self.data[i];
                    if (!d0 && !d1) return;
                    
                    let d, idx;
                    if (!d0) { d = d1; idx = i; }
                    else if (!d1) { d = d0; idx = i - 1; }
                    else {
                        d = x0 - xValues[i - 1] > xValues[i] - x0 ? d1 : d0;
                        idx = x0 - xValues[i - 1] > xValues[i] - x0 ? i : i - 1;
                    }
                    
                    focus.attr('transform', `translate(${x(xValues[idx])},${y(+d[self.yKey])})`);
                    self.showTooltip(event, d);
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

    moveTooltip(event) {
        this.tooltip
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }

    hideTooltip() {
        this.tooltip.classed('visible', false);
    }
}
