class HeatMap {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.margin = options.margin || { top: 30, right: 80, bottom: 60, left: 80 };
        this.data = null;
        this.colorScheme = options.colorScheme || d3.schemeYlOrRd;
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
        if (this.data) {
            this.render();
        }
    }

    setData(data) {
        this.data = data;
        this.render();
    }

    render() {
        if (!this.container || !this.data || !this.data.x_labels || !this.data.y_labels) return;

        d3.select(this.container).selectAll('*').remove();

        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        const xLabels = this.data.x_labels;
        const yLabels = this.data.y_labels;
        const values = this.data.values;

        const flatValues = values.flat();
        const minValue = Math.min(...flatValues.filter(v => v !== null && v !== undefined));
        const maxValue = Math.max(...flatValues.filter(v => v !== null && v !== undefined));

        const colorScale = d3.scaleSequential()
            .domain([minValue, maxValue])
            .interpolator(d3.interpolateYlOrRd);

        const xScale = d3.scaleBand()
            .domain(xLabels.map(String))
            .range([0, this.width])
            .padding(0.05);

        const yScale = d3.scaleBand()
            .domain(yLabels.map(String))
            .range([0, this.height])
            .padding(0.05);

        const self = this;
        for (let i = 0; i < yLabels.length; i++) {
            for (let j = 0; j < xLabels.length; j++) {
                const value = values[i][j];
                if (value === null || value === undefined || isNaN(value)) continue;

                g.append('rect')
                    .attr('x', xScale(String(xLabels[j])))
                    .attr('y', yScale(String(yLabels[i])))
                    .attr('width', xScale.bandwidth())
                    .attr('height', yScale.bandwidth())
                    .attr('fill', colorScale(value))
                    .attr('rx', 2)
                    .style('cursor', 'pointer')
                    .on('mouseover', function(event) {
                        d3.select(this)
                            .transition()
                            .duration(200)
                            .attr('opacity', 0.8)
                            .attr('stroke', '#333')
                            .attr('stroke-width', 2);
                        self.showTooltip(event, xLabels[j], yLabels[i], value);
                    })
                    .on('mouseout', function() {
                        d3.select(this)
                            .transition()
                            .duration(200)
                            .attr('opacity', 1)
                            .attr('stroke', 'none');
                        self.hideTooltip();
                    });
            }
        }

        g.append('g')
            .attr('class', 'x axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(xScale))
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');

        g.append('g')
            .attr('class', 'y axis')
            .call(d3.axisLeft(yScale));

        const legendWidth = 20;
        const legendHeight = this.height;
        const legendX = this.width + 20;

        const legendScale = d3.scaleLinear()
            .domain([minValue, maxValue])
            .range([legendHeight, 0]);

        const legend = svg.append('g')
            .attr('transform', `translate(${this.margin.left + legendX}, ${this.margin.top})`);

        const gradient = svg.append('defs')
            .append('linearGradient')
            .attr('id', 'heatmapGradient')
            .attr('x1', '0%')
            .attr('y1', '100%')
            .attr('x2', '0%')
            .attr('y2', '0%');

        const numStops = 10;
        for (let i = 0; i <= numStops; i++) {
            const offset = (i / numStops * 100) + '%';
            const value = minValue + (maxValue - minValue) * (i / numStops);
            gradient.append('stop')
                .attr('offset', offset)
                .attr('stop-color', colorScale(value));
        }

        legend.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .style('fill', 'url(#heatmapGradient)');

        legend.append('g')
            .attr('class', 'legend axis')
            .attr('transform', `translate(${legendWidth}, 0)`)
            .call(d3.axisRight(legendScale).ticks(5));
    }

    showTooltip(event, xLabel, yLabel, value) {
        const formatValue = val => {
            if (typeof val === 'number') {
                return val.toLocaleString();
            }
            return val;
        };

        this.tooltip
            .html(`
                <div><strong>${yLabel}</strong> × <strong>${xLabel}</strong></div>
                <div>值: ${formatValue(value)}</div>
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .classed('visible', true);
    }

    hideTooltip() {
        this.tooltip.classed('visible', false);
    }
}
