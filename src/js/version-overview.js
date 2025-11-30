import * as d3 from 'd3';

import { getValidVersions, getWords, setProperties, Legend, getAddedWords, getRemovedWords, Swatches, getWeekNumber, getCssColorScheme } from './helper';

export class VersionOverview {
    constructor(paper) {
        this.paper = paper;

        this.validVersions = getValidVersions(this.paper);

        this.page_scale = d3.scaleLinear();
        this.color = d3.scaleSequential([0, this.validVersions.length], d3.interpolateSpectral);

        this.page_height = this.validVersions[0].pages[0].height;
        this.page_width = this.validVersions[0].pages[0].width;

        this.colorScheme = getCssColorScheme();

        // d3 join
        this.tip = d3.select('.content')
            .append("div")
            .classed('tooltip', true)
            .style('visibility', 'hidden')
            .style('position', 'absolute')

        this.setWordProperties();

        this.setEventListener();
        // this.visualize();

        this.authors = this.getAllAuthors();
        this.authorColor = d3.scaleOrdinal(this.authors, d3.schemeCategory10)

        const view = document.getElementById('view').elements['view'].value;
        if (view === 'last') {
            this.visualize();
        } else if (view === 'all') {
            this.visualizeCanvas();
        } else if (view === 'pixel') {
            this.visualizePixel();
        } else if (view === 'word') {
            this.visualizeWordLength();
        } else if (view === 'heat') {
            this.visualizeHeatmap();
        } else if (view === 'average') {
            this.visualizeAverageSizeOfChanges();
        } else if (view === 'size') {
            this.visualizeSizeOfChanges();
        } else if (view === 'rects') {
            this.visualizeSizeOfChangesRects();
        }
    }

    setEventListener() {
        window.addEventListener('resize', () => this.getLegend());
        document.getElementById('color-scheme').addEventListener('change', (event) => this.setColorScheme(event.target.value));
        document.getElementById('last-version').addEventListener('click', () => this.visualize());
        document.getElementById('all-version').addEventListener('click', () => this.visualizeCanvas());
        document.getElementById('pixel-view').addEventListener('click', () => this.visualizePixel());
        document.getElementById('attribute').addEventListener('change', (event) => event.target.value !== 'changes' ? this.visualize() : this.visualizeCanvas());
        document.getElementById('word-length').addEventListener('click', () => this.visualizeWordLength());
        document.getElementById('heatmap').addEventListener('click', () => this.visualizeHeatmap());
        document.getElementById('average-change').addEventListener('click', () => this.visualizeAverageSizeOfChanges());
        document.getElementById('rects').addEventListener('click', () => this.visualizeSizeOfChangesRects());
        document.getElementById('group').addEventListener('change', () => this.visualizeCanvas());
        document.getElementById('size-of-changes').addEventListener('click', () => this.visualizeSizeOfChanges());
    }

    setColorScheme(value) {
        const attribute = document.getElementById('attribute').value;

        let domain = [];
        if (attribute === 'age') {
            domain = [1, this.validVersions.length];
            this.color.domain(domain);
        } else if (attribute === 'time') {
            domain = [0, 23];
            this.color.domain(domain);
        }

        if (value === 'interpolateSpectral') {
            this.color = d3.scaleSequential(domain, d3.interpolateSpectral);
        } else if (value === 'interpolateRdYlGn') {
            this.color = d3.scaleSequential(domain, d3.interpolateRdYlGn);
        } else if (value === 'interpolateTurbo') {
            this.color = d3.scaleSequential(domain, d3.interpolateTurbo);
        } else if (value === 'interpolateViridis') {
            this.color = d3.scaleSequential(domain, d3.interpolateViridis);
        } else if (value === 'interpolateInferno') {
            this.color = d3.scaleSequential(domain, d3.interpolateInferno);
        } else if (value === 'interpolatePlasma') {
            this.color = d3.scaleSequential(domain, d3.interpolatePlasma);
        } else if (value === 'interpolateWarm') {
            this.color = d3.scaleSequential(domain, d3.interpolateWarm);
        } else if (value === 'interpolateCool') {
            this.color = d3.scaleSequential(domain, d3.interpolateCool);
        } else {
            this.color = d3.scaleSequential(domain, d3.interpolateSpectral);
        }
        this.visualize();
    }

    setWordProperties() {
        setProperties(this.validVersions);
        this.validVersions.forEach((version, i) => {
            version.pages.forEach(page => {
                page['version'] = i;
                page.text.forEach(word => {
                    word['version'] = i;
                    word['page'] = page.number;
                    word['author'] = this.validVersions[word.added_version].metadata.authorName;
                })
            })
        });
    }

    getAllAuthors() {
        let authors = new Set();
        this.validVersions.forEach(version => authors.add(version.metadata.authorName));

        return Array.from(authors);
    }

    getLegend() {
        d3.select('.import').select('svg').remove();
        d3.select('.import').select('div').remove();

        const attribute = document.getElementById('attribute');
        const view = document.getElementById('view').elements['view'].value;

        const el = document.getElementsByClassName('import')[0];
        let options = {
            "width": el.offsetWidth - 50,
            "marginLeft": 25,
        };
        let legend;
        if (view === 'last' || view === 'all') {
            if (attribute.value === 'age') {
                this.color.domain([1, this.validVersions.length]);

                options.title = 'Age of Words (version)';
                options.ticks = this.validVersions.length < 25 ? this.validVersions.length : this.validVersions.length/25;
                options.tickFormat = ".0f";

                legend = Legend(this.color, options);
            } else if (attribute.value === 'time') {
                this.color.domain([0, 24]);

                options.title = 'Time of Commit (hour)';

                legend = Legend(this.color, options);
            } else if (attribute.value === 'changes') {
                legend = Swatches(d3.scaleOrdinal(['unchanged', 'moved', 'added', 'removed'], [this.colorScheme.default, this.colorScheme.moved, this.colorScheme.added, this.colorScheme.removed]), options);
            } else if (attribute.value === 'authors') {
                legend = Swatches(this.authorColor, options);
            }
        } else if (view === 'size' || view === 'rects') {
            options.title = 'Changes (more added or more deleted)';

            legend = Legend(this.color, options);
        }
        el.appendChild(legend);
        return legend;
    }

    visualize() {
        d3.select('.content').selectAll('*').remove();
        const svg = d3.select('.content').append('svg');

        const attribute = document.getElementById('attribute');

        const legend = this.getLegend();

        //sizing an größe anpassen
        const viewBox = [0, 0, this.validVersions.slice(-1)[0].pages.length * (this.page_width+5) + 15, this.page_height + 20];

        svg
            .attr('height', this.page_height + 20)
            .attr('width', document.getElementsByClassName('content')[0].offsetWidth)
            .attr('viewBox', viewBox);

        svg.selectAll('*').remove();

        var mouseover = () => {
            this.tip.style('visibility', 'hidden')
        }
        var mousemove_word_page = (event, d) => {
            const details = this.validVersions[d.version].metadata;
            let html = `Version ${details.index}<br>edited by: ${details.authorName}<br>on the ${new Date(details.authorDate).toLocaleDateString('en-us', { year:"numeric", month:"short", day:"numeric"})}<br>commit message: ${details.message}`;
            this.tip.style('visibility', 'visible')
                .html(html)
                .style("left", Math.min(event.pageX+10, window.innerWidth-200) + "px")
                .style("top", Math.min(event.pageY+15, window.innerHeight-120) + "px");
        }
        var mouseleave = () => {
            this.tip.style('visibility', 'hidden')
        }

        svg
            .append('rect')
            .datum(this.validVersions.slice(-1)[0])
                .classed('version', true)
                .attr('x', 5)
                .attr('y', 5)
                .attr('width', d => 5 + d.pages.length * (this.page_width + 5))
                .attr('height', this.page_height + 10)
                .attr('stroke', 'black')
                .attr('fill', 'rgba(0,0,0,0)')
                .attr('stroke-width', '3')
            .each(d => {
                svg
                    .selectAll('.page')
                    .data(d.pages, function (d) {
                        return d.number;
                    })
                    .enter()
                    .append('rect')
                        .classed('page', true)
                        .attr('id', d => d.number)
                        .attr('x', (d, i) => 10 + i * (this.page_width + 5))
                        .attr('y', 10)
                        .attr('width', d => d.width)
                        .attr('height', d => d.height)
                        .attr('stroke', 'black')
                        .attr('fill', 'rgba(0,0,0,0)')
                        .attr('stroke-width', '2')
                        .on('mouseover', mouseover)
                        .on('mousemove', mousemove_word_page)
                        .on('mouseleave', mouseleave)
                    .each(d => {
                        if (attribute.value !== 'authors') {
                            console.log('test2');
                            svg
                                .append('g')
                                    .attr('transform', 'translate(5,5)')
                                .selectAll('.word')
                                .data(d.text, function (d) {
                                    return d.id;
                                })
                                .enter()
                                .append('rect')
                                    .classed('word', true)
                                    .attr('id', d => d.id)
                                    .attr('x', (d, i) => d.x0 + d.page * (this.page_width + 10))
                                    .attr('y', d => d.y0 + 10)
                                    .attr('width', d => d.x1 - d.x0)
                                    .attr('height', d => d.y1 - d.y0)
                                    .attr('fill', d => attribute.value === 'age' ? this.color(d.added_version) : this.color(new Date(this.validVersions[d.added_version].metadata.authorDate).getHours()))
                                    .attr('stroke', d => attribute.value === 'age' ? this.color(d.added_version) : this.color(new Date(this.validVersions[d.added_version].metadata.authorDate).getHours()))
                                    .on('mouseover', mouseover)
                                    .on('mousemove', mousemove_word_page)
                                    .on('mouseleave', mouseleave);
                        } else {
                            console.log('test')
                            svg
                                .append('g')
                                    .attr('transform', 'translate(5,5)')
                                .selectAll('.word')
                                .data(d.text, function (d) {
                                    return d.id;
                                })
                                .enter()
                                .append('rect')
                                    .classed('word', true)
                                    .attr('id', d => d.id)
                                    .attr('x', (d, i) => d.x0 + d.page * (this.page_width + 10))
                                    .attr('y', d => d.y0 + 10)
                                    .attr('width', d => d.x1 - d.x0)
                                    .attr('height', d => d.y1 - d.y0)
                                    .attr('fill', d => this.authorColor(d.author))
                                    .attr('stroke', d => this.authorColor(d.author))
                                    .on('mouseover', mouseover)
                                    .on('mousemove', mousemove_word_page)
                                    .on('mouseleave', mouseleave);
                        }
                    })
            })
    }

    // progress kreise bei grouping
    visualizeCanvas() {
        d3.select('.content').selectAll('*').remove();

        const content = document.getElementsByClassName('content')[0];
        const div = document.createElement('div');
        div.classList.add('canvasComponent');

        content.appendChild(div);

        const canvasBar = document.createElement('div');
        canvasBar.classList.add('canvasBar');
        div.appendChild(canvasBar);

        const canvasContent = document.createElement('div');
        canvasContent.classList.add('canvasContent');
        div.appendChild(canvasContent);

        const legend = this.getLegend();

        const attribute = document.getElementById('attribute').value;

        const grouping = document.getElementById('group').checked;

        const marginLeft = 0;

        if (grouping) {
            const contentDiv = document.getElementsByClassName('canvasContent')[0];

            const weekGroups = d3.groups(this.validVersions, (d) => {const weekNumber = getWeekNumber(new Date(d.metadata.authorDate)); return `${weekNumber[0]}-${weekNumber[1]}`});

            let scale = d3.scaleLinear()
                .domain([0, Math.max(...weekGroups.map(group => group.slice(-1)[0].slice(-1)[0].pages.length))*(this.page_width + 10) + 10])
                .range([0, contentDiv.offsetWidth - 17 - marginLeft]);
            if (scale(this.page_height) > 300) {
                scale
                    .domain([0, this.page_height])
                    .range([0, 300]);
            }

            weekGroups.forEach((v, i) => {
                const weekVersion = v.slice(-1)[0].slice(-1)[0];

                let added = new Map();
                let removed = new Map();
                if (attribute === 'changes') {
                    if (i > 0) {
                        getAddedWords(getWords(weekGroups[i-1].slice(-1)[0].slice(-1)[0]), getWords(weekGroups[i].slice(-1)[0].slice(-1)[0])).forEach(w => added.set(w.id, w));
                    }
                    if (i < weekGroups.length-1) {
                        getRemovedWords(getWords(weekGroups[i].slice(-1)[0].slice(-1)[0]), getWords(weekGroups[i+1].slice(-1)[0].slice(-1)[0])).forEach(w => removed.set(w.id, w));
                    }
                }
    
                const canvas = document.createElement('canvas');
    
                contentDiv.appendChild(canvas);
    
                canvas.width = contentDiv.offsetWidth-17;

                canvas.height = scale((this.page_height + 30));
    
                const ctx = canvas.getContext('2d');
                
                ctx.lineWidth = 3;
                ctx.strokeRect(marginLeft, 0, scale(10 + weekVersion.pages.length * (this.page_width + 10)), scale(this.page_height + 20))
    
                weekVersion.pages.forEach(p => {
                    ctx.lineWidth = 2;
                    ctx.strokeRect(marginLeft + scale(10 + p.number * (this.page_width + 10)), scale(10), scale(p.width), scale(p.height));
    
                    p.text.forEach(w => {
                        if (attribute === 'age') {
                            ctx.fillStyle = this.color(w.added_version);
                        } else if (attribute === 'time') {
                            ctx.fillStyle = this.color(new Date(this.validVersions[w.added_version].metadata.authorDate).getHours());
                        } else if (attribute === 'changes') {
                            if (added.has(w.id)) {
                                ctx.fillStyle = this.colorScheme.added;
                            } else if (removed.has(w.id)) {
                                ctx.fillStyle = this.colorScheme.removed;
                            } else if (w.move) {
                                ctx.fillStyle = this.colorScheme.moved;
                            } else {
                                ctx.fillStyle = this.colorScheme.default;
                            }
                        } else if (attribute === 'authors') {
                            ctx.fillStyle = this.authorColor(w.author);
                        }
                        ctx.fillRect(marginLeft + scale(w.x0 + 10 + w.page * (this.page_width + 10)), scale(w.y0 + 10), scale(w.x1 - w.x0), scale(w.y1 - w.y0));
                    })
                })
            })

            const bar = document.createElement('canvas');
            canvasBar.appendChild(bar);

            bar.width = canvasBar.offsetWidth;
            bar.height = canvasContent.offsetHeight;

            const barCtx = bar.getContext('2d');

            const height = bar.height - 10;

            barCtx.fillStyle = 'grey'
            barCtx.fillRect(22.5, 5, 5, height);
            
            weekGroups.forEach((g, groupIndex) => {
                console.log(groupIndex)
                console.log(g);
                const heightOfGroupBar = height / (weekGroups.length);
                const groupStart = groupIndex * heightOfGroupBar + 5;
                g[1].forEach((v, versionIndex) => {
                    const circleCenter = versionIndex * heightOfGroupBar / g[1].length + 5;

                    barCtx.beginPath();
                    console.log(groupIndex * heightOfGroupBar + 5 + (versionIndex)*(heightOfGroupBar / (g[1].length)))
                    barCtx.arc(25, groupStart + circleCenter, 5, 0, 2*Math.PI);
                    barCtx.stroke();
                    barCtx.fill();
                })
            })
        } else {
            const contentDiv = document.getElementsByClassName('canvasContent')[0];

            let scale = d3.scaleLinear()
                .domain([0, Math.max(...this.validVersions.map(obj => obj.pages.length))*(this.page_width + 10) + 10])
                .range([0, contentDiv.offsetWidth-17 - marginLeft]);
            if (scale(this.page_height) > 300) {
                scale
                    .domain([0, this.page_height])
                    .range([0, 300]);
            }

            this.validVersions.forEach((v, i) => {
                let added = new Map();
                let removed = new Map();
                if (attribute === 'changes') {
                    if (i > 0) {
                        added = new Map(getAddedWords(getWords(this.validVersions[i-1]), getWords(this.validVersions[i])).map(e => [e.id, e]));
                    }
                    if (i < this.validVersions.length-1) {
                        removed = new Map(getRemovedWords(getWords(this.validVersions[i]), getWords(this.validVersions[i+1])).map(e => [e.id, e]));
                }
                }
    
                const canvas = document.createElement('canvas');
    
                contentDiv.appendChild(canvas);
    
                canvas.width = contentDiv.offsetWidth-17;
    
                canvas.height = scale((this.page_height + 30));
    
                const ctx = canvas.getContext('2d');
                
                ctx.lineWidth = 3;
                ctx.strokeRect(marginLeft, 0, scale(10 + v.pages.length * (this.page_width + 10)), scale(this.page_height + 20))
    
                v.pages.forEach(p => {
                    ctx.lineWidth = 2;
                    ctx.strokeRect(marginLeft + scale(10 + p.number * (this.page_width + 10)), scale(10), scale(p.width), scale(p.height));
    
                    p.text.forEach(w => {
                        if (attribute === 'age') {
                            ctx.fillStyle = this.color(w.added_version);
                        } else if (attribute === 'time') {
                            ctx.fillStyle = this.color(new Date(this.validVersions[w.added_version].metadata.authorDate).getHours());
                        } else if (attribute === 'changes') {
                            if (added.has(w.id)) {
                                ctx.fillStyle = this.colorScheme.added;
                            } else if (removed.has(w.id)) {
                                ctx.fillStyle = this.colorScheme.removed;
                            } else if (w.move) {
                                ctx.fillStyle = this.colorScheme.moved;
                            } else {
                                ctx.fillStyle = this.colorScheme.default;
                            } 
                        } else if (attribute === 'authors') {
                            ctx.fillStyle = this.authorColor(w.author);
                        }
                        // ctx.fillStyle = attribute === 'age' ? this.color(w.added_version) : this.color(new Date(this.validVersions[w.added_version].metadata.authorDate).getHours());
                        ctx.fillRect(marginLeft + scale(w.x0 + 10 + w.page * (this.page_width + 10)), scale(w.y0 + 10), scale(w.x1 - w.x0), scale(w.y1 - w.y0));
                    })
                })
            })

            const bar = document.createElement('canvas');
            canvasBar.appendChild(bar);

            bar.width = canvasBar.offsetWidth;
            bar.height = canvasContent.offsetHeight;

            const barCtx = bar.getContext('2d');

            const height = bar.height - scale(this.page_height + 30);

            barCtx.fillStyle = 'grey'
            barCtx.fillRect(22.5, scale(this.page_height + 30) / 2, 5, height);

            this.validVersions.forEach((v, i) => {
                barCtx.beginPath();
                barCtx.arc(25, i * (height/(this.validVersions.length-1)) + (scale(this.page_height + 30) / 2), 5, 0, 2*Math.PI);
                barCtx.stroke();
                barCtx.fill();
            });
        }
    }

    visualizePixel() {
        d3.select('.content').selectAll('*').remove();
        d3.select('.import').select('svg').remove();

        const div = document.getElementsByClassName('content')[0];
        const canvas = document.createElement('canvas');

        div.appendChild(canvas);

        const longest_version_length = Math.max(...this.validVersions.map(v => v.pages.reduce((sum, p) => sum + p.text.length, 0)));
        const word_width = Math.max(5, (div.offsetWidth-17)/longest_version_length); // breite und höhe entkoppeln
        const highest_id = Math.max(...this.validVersions.map(v => Math.max(...v.pages.map(p => Math.max(...p.text.map(w => w.id))))));

        canvas.width = longest_version_length * word_width;
        canvas.height = this.validVersions.length * word_width;

        const pixel_color = d3.scaleSequential([1, highest_id], this.color.interpolator());

        const el = document.getElementsByClassName('import')[0];
        let options = {
            "title": "Id of Word (earliest to latest)",
            "width": el.offsetWidth - 50,
            "marginLeft": 25,
        };
        const legend = Legend(pixel_color, options);
        el.appendChild(legend);

        const ctx = canvas.getContext('2d');

        this.validVersions.forEach((v, version_index) => {
            getWords(v).forEach((w, word_index) => {
                ctx.fillStyle = pixel_color(w.id);
                ctx.fillRect(word_index * word_width, version_index * word_width, word_width, word_width);
            });
        });
    }

    visualizeWordLength() {
        d3.select('.import').select('svg').remove();
        d3.select('.content').selectAll('*').remove();
        const svg = d3.select('.content').append('svg');

        const el = document.getElementsByClassName('content')[0];
        const width = el.offsetWidth - 100;
        const height = 2*el.offsetHeight/3;

        const viewBox = [0, 0, el.offsetWidth - 16, el.offsetHeight - 16];

        svg
            .attr('viewBox', viewBox);

        const histogram = svg.append('g').attr('transform', 'translate(50, 50)');

        const lengthOfWords = [];
        this.validVersions.forEach((v, index) => {
            const wordCount = v.pages.reduce((sum, p) => sum + p.text.length, 0);
            const wordLength = v.pages.reduce((sum, p) => sum + p.text.reduce((sum, w) => sum + (w.x1 - w.x0), 0), 0);
            lengthOfWords.push({
                version: index,
                wordCount: wordCount,
                wordLength: wordLength,
                quotient: wordLength/wordCount,
            })
        })

        const x = d3.scaleBand()
          .range([ 1, width ])
          .domain(lengthOfWords.map(function(d) { return d.version + 1; }))
          .padding(0.2);
        histogram.append("g")
          .attr("transform", "translate(0," + height + ")")
          .call(d3.axisBottom(x));

        const y = d3.scaleLinear()
          .domain([0, d3.max(lengthOfWords.map(function(d){return d.quotient}))])
          .range([ height, 0]);
        histogram.append("g")
          .call(d3.axisLeft(y));

        histogram.selectAll("mybar")
          .data(lengthOfWords)
          .enter()
          .append("rect")
            .attr("x", function(d) { return x(d.version + 1); })
            .attr("width", x.bandwidth())
            .attr("fill", "#69b3a2")
            .attr("height", function(d) { return height - y(0); })
            .attr("y", function(d) { return y(0); })

        histogram.selectAll("rect")
            .transition()
            .duration(800)
            .attr("y", function(d) { return y(d.quotient); })
            .attr("height", function(d) { return height - y(d.quotient); })
            .delay(function(d,i){return(i*15)})
    }

    visualizeHeatmap() {
        const changes = [];

        for (let index = 0; index < this.validVersions.length-1; index++) {
            const currentWords = getWords(this.validVersions[index]);
            const nextWords = getWords(this.validVersions[index+1]);

            const added = getAddedWords(currentWords, nextWords);
            added.forEach(word => {
                if (!changes[word.page]) {
                    changes[word.page] = [];
                }

                const xRange = d3.range(Math.round(word.x0), Math.round(word.x1+1), 1);
                const yRange = d3.range(Math.round(word.y0), Math.round(word.y1+1), 1);
                
                xRange.forEach(x => {
                    if (!changes[word.page][x]) {
                        changes[word.page][x] = [];
                    }
                    yRange.forEach(y => {
                        if (!changes[word.page][x][y]) {
                            changes[word.page][x][y] = 0;
                        }
                        changes[word.page][x][y] += 1;
                    });
                });
            });

            const removed = getRemovedWords(currentWords, nextWords);
            removed.forEach(word => {
                if (!changes[word.page]) {
                    changes[word.page] = [];
                }

                const xRange = d3.range(Math.round(word.x0), Math.round(word.x1+1), 1);
                const yRange = d3.range(Math.round(word.y0), Math.round(word.y1+1), 1);
                
                xRange.forEach(x => {
                    if (!changes[word.page][x]) {
                        changes[word.page][x] = [];
                    }
                    yRange.forEach(y => {
                        if (!changes[word.page][x][y]) {
                            changes[word.page][x][y] = 0;
                        }
                        changes[word.page][x][y] += 1;
                    });
                });
            });
        }

        let data = [];
        let max = 0;
        changes.forEach((page, pIndex) => {
            data[pIndex] = [];
            page.forEach((x, xIndex) => {
                x.forEach((y, yIndex) => {
                    max = y > max ? y : max;
                    data[pIndex].push({
                        x: xIndex,
                        y: yIndex,
                        value: y
                    });
                })
            })
        })

        d3.select('.import').select('svg').remove();
        d3.select('.content').selectAll('*').remove();

        const div = document.getElementsByClassName('content')[0];
        const canvas = document.createElement('canvas');

        div.appendChild(canvas);

        canvas.width = div.offsetWidth-17;

        const version = this.validVersions.slice(-1)[0];

        let scale = d3.scaleLinear()
            .domain([0, version.pages.length*(this.page_width + 10) + 10])
            .range([0, canvas.width]);
        if (scale(this.page_height) > 400) {
            scale
                .domain([0, this.page_height])
                .range([0, 400]);
        }

        const color = d3.scaleSequential(d3.interpolateReds);

        canvas.height = scale((this.page_height + 30));

        const ctx = canvas.getContext('2d');

        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, scale(10 + version.pages.length * (this.page_width + 10)), scale(this.page_height + 20));

        version.pages.forEach(p => {
            ctx.lineWidth = 2;
            ctx.strokeRect(scale(10 + p.number * (this.page_width + 10)), scale(10), scale(p.width), scale(p.height));

            data[p.number].forEach(obj => {
                ctx.fillStyle = color(obj.value/max);
                ctx.fillRect(scale(10 + p.number * (this.page_width + 10) + obj.x), scale(10 + obj.y), scale(1), scale(1));
            });
        });
    }

    visualizeAverageSizeOfChanges() {
        const changes = [];

        for(let i = 0; i < this.validVersions.length-1; i++) {
            const currentWords = getWords(this.validVersions[i]);
            const nextWords = getWords(this.validVersions[i+1]);

            const currentMap = new Map(currentWords.map(e => [e.id, e]));
            const nextMap = new Map(nextWords.map(e => [e.id, e]));

            let changedAddedWordCount = 0;
            let changedAddedPositionCount = 0;
            nextWords.forEach((obj, index) => {
                if (!currentMap.has(obj.id)) {
                    changedAddedWordCount++;
                    if (index >= nextWords.length - 1) {
                        changedAddedPositionCount++;
                    } else {
                        if (currentMap.has(nextWords[index+1].id)) {
                            changedAddedPositionCount++;
                        }
                    }
                }
            });

            let changedRemovedWordCount = 0;
            let changedRemovedPositionCount = 0;
            currentWords.forEach((obj, index) => {
                if (!nextMap.has(obj.id)) {
                    changedRemovedWordCount++;
                    if (index >= currentWords.length - 1) {
                        changedRemovedPositionCount++;
                    } else {
                        if (nextMap.has(currentWords[index+1].id)) {
                            changedRemovedPositionCount++;
                        }
                    }
                }
            });

            changes[i] = {
                version: this.validVersions[i].metadata.index,
                changedAddedWordCount: changedAddedWordCount,
                changedAddedPositionCount: changedAddedPositionCount,
                changedRemovedWordCount: changedRemovedWordCount,
                changedRemovedPositionCount: changedRemovedPositionCount
            };
        }

        d3.select('.import').select('svg').remove();
        d3.select('.content').selectAll('*').remove();
        const svg = d3.select('.content').append('svg');

        const el = document.getElementsByClassName('content')[0];
        const width = el.offsetWidth - 100;
        const height = 2*el.offsetHeight/3;

        const viewBox = [0, 0, el.offsetWidth - 16, el.offsetHeight - 16];

        svg
            .attr('viewBox', viewBox);

        const histogram = svg.append('g').attr('transform', 'translate(50, 50)');

        const x = d3.scaleBand()
          .range([ 1, width ])
          .domain(changes.map(d => d.version))
          .padding(0.2);
        histogram.append("g")
          .attr("transform", "translate(0," + height + ")")
          .call(d3.axisBottom(x));

        const y = d3.scaleLinear()
          .domain([d3.min(changes.map(function(d){return -(d.changedRemovedWordCount/d.changedRemovedPositionCount)})), d3.max(changes.map(function(d){return d.changedAddedWordCount/d.changedAddedPositionCount}))])
          .range([ height, 0]);
        histogram.append("g")
          .call(d3.axisLeft(y));

        histogram.selectAll("rect")
          .data(changes)
          .join(
            enter => {
                let g = enter;

                g.append("rect")
                    .classed('addedBar', true)
                    .attr("x", function(d) { return x(d.version); })
                    .attr("width", x.bandwidth())
                    .attr("fill", "green")
                    .attr("height", function(d) { return 0; })
                    .attr("y", function(d) { return y(0); });

                g.append("rect")
                    .classed('removedBar', true)
                    .attr("x", function(d) { return x(d.version); })
                    .attr("width", x.bandwidth())
                    .attr("fill", "red")
                    .attr("height", function(d) { return 0; })
                    .attr("y", function(d) { return y(0); });
            }
          )

        histogram.selectAll(".addedBar")
            .transition()
            .duration(800)
            .attr("y", function(d) { return y(d.changedAddedWordCount/d.changedAddedPositionCount); })
            .attr("height", function(d) { return y(0) - y(d.changedAddedWordCount/d.changedAddedPositionCount); })
            .delay(function(d,i){return(i*15)});

        histogram.selectAll(".removedBar")
            .transition()
            .duration(800)
            .attr("y", function(d) { return y(0); })
            .attr("height", function(d) { return y(-(d.changedRemovedWordCount/d.changedRemovedPositionCount)) - y(0); })
            .delay(function(d,i){return(i*15)});
    }

    getSizeOfChanges() {
        const maxLength = Math.max(...this.validVersions.map(v => v.pages.reduce((sum, p) => sum + p.text.length, 0)));
        const changes = [];

        this.validVersions.forEach((version, versionIndex) => {
            changes[versionIndex] = {
                version: version.metadata.index,
                changes: []
            };

            let added = new Map();
            let removed = new Map();
            if (versionIndex > 0) {
                added = new Map(getAddedWords(getWords(this.validVersions[versionIndex-1]), getWords(this.validVersions[versionIndex])).map(e => [e.id, e]));
            }
            if (versionIndex < this.validVersions.length-1) {
                removed = new Map(getRemovedWords(getWords(this.validVersions[versionIndex]), getWords(this.validVersions[versionIndex+1])).map(e => [e.id, e]));
            }

            let changedWords = 0;
            let combinedPosition = 0;
            let startPos = -1;
            let addedRemoved = 0;

            const words = getWords(version);
            words.forEach((word, wordIndex) => {
                if (added.has(word.id) || removed.has(word.id)) {
                    changedWords++;
                    combinedPosition += wordIndex;
                    if (startPos === -1) {
                        startPos = (wordIndex-1)/maxLength;
                    }
                    if (added.has(word.id)) {
                        addedRemoved += 1;
                    } else if (removed.has(word.id)) {
                        addedRemoved -= 1;
                    }
                    if (wordIndex < words.length-1) {
                        if (!added.has(words[wordIndex+1].id) && !removed.has(words[wordIndex+1].id)) {
                            changes[versionIndex].changes.push({
                                version: version.metadata.index,
                                changedWords: changedWords,
                                docpos: (combinedPosition/changedWords)/maxLength,
                                startPos: startPos,
                                endPos: (wordIndex+1)/maxLength,
                                addedRemoved: addedRemoved,
                            });
                            changedWords = 0;
                            combinedPosition = 0;
                            startPos = -1;
                            addedRemoved = 0;
                        }
                    } else {
                        changes[versionIndex].changes.push({
                            version: version.metadata.index,
                            changedWords: changedWords,
                            docpos: (combinedPosition/changedWords)/maxLength,
                            startPos: startPos,
                            endPos: wordIndex/maxLength,
                            addedRemoved: addedRemoved,
                        });
                    }
                }
            });
        });

        return [changes, maxLength]
    }

    visualizeSizeOfChanges () {
        const sizeOfChanges = this.getSizeOfChanges();

        const changes = sizeOfChanges[0];
        const maxLength = sizeOfChanges[1];

        const el = document.getElementsByClassName('content')[0];
        const width = el.offsetWidth - 50;
        const height = el.offsetHeight - 50;
        const marginTop = 25;
        const marginLeft = 25;

        d3.select('.import').select('svg').remove();
        d3.select('.content').selectAll('*').remove();
        const svg = d3.select('.content').append('svg')
            .call(zoom);

        const y = d3.scaleBand()
            .range([0, height])
            .domain(changes.map(d => d.version));
        const x = d3.scaleLinear()
            .domain([0, 1])
            .range([0, width]);

        const viewBox = [0, 0, el.offsetWidth, el.offsetHeight-8];

        svg
            .attr('viewBox', viewBox);

        const scatter = svg.append('g').attr('transform', `translate(${marginLeft}, ${marginTop})`);

        let data = changes.map(v => v.changes).flat();

        const mean = data.map((obj) => obj.changedWords).reduce((acc, val) => acc + val, 0) / data.length;
        const stdDev = Math.sqrt(data.map((obj) => obj.changedWords).reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length);

        const outlier = data.filter((obj) => {return Math.abs((obj.changedWords - mean) / stdDev) > 1});
        outlier.forEach(element => {
            data.splice(data.indexOf(element), 1);
        });

        const maximum = Math.max(...data.map((obj) => obj.changedWords));
        const sizeScale = d3.scalePow().exponent(0.57)
            .domain([0, maximum])
            .range([0, y.bandwidth()/2]);

        data = data.sort((a, b) => {return -(a.changedWords - b.changedWords);})

        const maxDel = Math.min(...data.map(obj => obj.addedRemoved));
        const maxAdd = Math.max(...data.map(obj => obj.addedRemoved));
        const color = d3.scaleSequential([maxDel, maxAdd], d3.interpolatePiYG);

        this.color = color;
        const legend = this.getLegend();

        const lengthOfVersion = this.validVersions.map(v => {return {length: v.pages.reduce((sum, p) => sum + p.text.length, 0), version:v.metadata.index}});
        scatter
            .selectAll('.length')
            .data(lengthOfVersion)
            .join(
                enter => {
                    const g = enter;

                    g.append('rect')
                        .classed('length', true)
                        .attr('x', x(0))
                        .attr('y', d => y(d.version))
                        .attr('width', d => x(d.length/maxLength))
                        .attr('height', y.bandwidth())
                        .attr('fill', '#E4E4E4');

                    g.append('rect')
                        .classed('length', true)
                        .attr('x', d => x(d.length/maxLength))
                        .attr('rx', 3)
                        .attr('y', d => y(d.version))
                        .attr('width', 3)
                        .attr('height', y.bandwidth())
                        .attr('fill', '#f1807e')
                        .attr('stroke', 'black');
                }
            );

        scatter
            .selectAll('.outlier')
            .data(outlier)
            .enter()
            .append('circle')
                .classed('outlier', true)
                .attr('cx', function(d){return x(d.docpos);})
                .attr('cy', function(d){return y(d.version)+y.bandwidth()/2;})
                .attr('r', y.bandwidth()/2)
                .attr('fill', d => color(d.addedRemoved))
                .attr('stroke', 'black');

        scatter
            .selectAll('.circle')
            .data(data)
            .enter()
            .append('circle')
                .classed('circle', true)
                .attr('cx', function(d){return x(d.docpos);})
                .attr('cy', function(d){return y(d.version)+y.bandwidth()/2;})
                .attr('r', function(d){return sizeScale(d.changedWords);})
                .attr('fill', d => color(d.addedRemoved))
                .attr('stroke', 'black');
            //hichlighting & pfade nach IDs

        scatter.append("g")
            .classed('y-axis', true)
            .call(d3.axisLeft(y));

        scatter.append("g")
            .call(d3.axisTop(x).tickValues([]));

        function zoom(svg) {
            const extent = [[0, 0], [width, height]];

            svg.call(d3.zoom()
                .scaleExtent([1, 10])
                .translateExtent(extent)
                .extent(extent)
                .on('zoom', zoomed));

            function zoomed(event) {
                y.range([1, height].map(d => event.transform.applyY(d)));
                sizeScale.range([0, y.bandwidth()/2]);
                svg.selectAll('.circle')
                    .attr('cy', d => y(d.version)+y.bandwidth()/2)
                    .attr('r', d => sizeScale(d.changedWords));
                svg.selectAll('.outlier')
                    .attr('cy', d => y(d.version)+y.bandwidth()/2)
                    .attr('r', y.bandwidth()/2);
                svg.selectAll('.length')
                    .attr('y', d => y(d.version))
                    .attr('height', y.bandwidth());
                svg.selectAll('.y-axis')
                    .call(d3.axisLeft(y));
            }
        }
    }

    visualizeSizeOfChangesRects() {
        const sizeOfChanges = this.getSizeOfChanges();

        const changes = sizeOfChanges[0];
        const maxLength = sizeOfChanges[1];

        console.log(changes)

        const el = document.getElementsByClassName('content')[0];
        const width = el.offsetWidth - 50;
        const height = el.offsetHeight - 50;
        const marginTop = 25;
        const marginLeft = 25;

        d3.select('.import').select('svg').remove();
        d3.select('.content').selectAll('*').remove();
        const svg = d3.select('.content').append('svg')
            .call(zoom);

        const y = d3.scaleBand()
            .range([1, height])
            .domain(changes.map(d => d.version));
        const x = d3.scaleLinear()
            .domain([0, 1])
            .range([0, width]);

        const viewBox = [0, 0, el.offsetWidth, el.offsetHeight-8];

        svg
            .attr('viewBox', viewBox);

        const rects = svg.append('g').attr('transform', `translate(${marginLeft}, ${marginTop})`);

        let data = changes.map(v => v.changes).flat();

        const mean = data.map((obj) => obj.changedWords).reduce((acc, val) => acc + val, 0) / data.length;
        const stdDev = Math.sqrt(data.map((obj) => obj.changedWords).reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length);

        const outlier = data.filter((obj) => {return Math.abs((obj.changedWords - mean) / stdDev) > 1});
        outlier.forEach(element => {
            data.splice(data.indexOf(element), 1);
        });

        const maximum = Math.max(...data.map((obj) => obj.changedWords));
        // const color = d3.scaleSequential([1, maximum], d3.interpolateYlOrRd);

        const maxDel = Math.min(...data.map(obj => obj.addedRemoved));
        const maxAdd = Math.max(...data.map(obj => obj.addedRemoved));
        const color = d3.scaleSequential([maxDel, maxAdd], d3.interpolatePiYG);
        
        this.color = color;
        const legend = this.getLegend();

        data = data.sort((a, b) => {return -(a.changedWords - b.changedWords);});

        const lengthOfVersion = this.validVersions.map(v => {return {length: v.pages.reduce((sum, p) => sum + p.text.length, 0), version:v.metadata.index}});
        rects
            .selectAll('.length')
            .data(lengthOfVersion)
            .join(
                enter => {
                    const g = enter;

                    g.append('rect')
                        .classed('length', true)
                        .attr('x', x(0))
                        .attr('y', d => y(d.version))
                        .attr('width', d => x(d.length/maxLength))
                        .attr('height', y.bandwidth())
                        .attr('fill', '#E4E4E4');

                    g.append('rect')
                        .classed('length', true)
                        .attr('x', d => x(d.length/maxLength))
                        .attr('rx', 3)
                        .attr('y', d => y(d.version))
                        .attr('width', 3)
                        .attr('height', y.bandwidth())
                        .attr('fill', '#f1807e')
                        .attr('stroke', 'black');
                }
            );

        rects
            .selectAll('.outlier')
            .data(outlier)
            .enter()
            .append('rect')
                .classed('outlier', true)
                .attr('x', d => {return x(d.startPos)})
                .attr('y', d => {return y(d.version)})
                .attr('height', y.bandwidth())
                .attr('width', d => {return x(d.endPos)-x(d.startPos)})
                .attr('fill', d => color(d.addedRemoved)/* color(maximum) */)
                .attr('stroke', 'black')
                .attr('stroke-width', 0.25)

        rects
            .selectAll('.circle')
            .data(data)
            .enter()
            .append('rect')
                .classed('rect', true)
                .attr('x', d => {return x(d.startPos)})
                .attr('y', d => {return y(d.version)})
                .attr('height', y.bandwidth())
                .attr('width', d => {return x(d.endPos)-x(d.startPos)})
                .attr('fill', d => color(d.addedRemoved)/* d => {return color(d.changedWords)} */)
                .attr('stroke', 'black')
                .attr('stroke-width', 0.25)

        rects.append("g")
            .classed('y-axis', true)
            .call(d3.axisLeft(y));

        rects.append("g")
            .call(d3.axisTop(x).tickValues([]));

        function zoom(svg) {
            const extent = [[0, 0], [width, height]];

            svg.call(d3.zoom()
                .scaleExtent([1, 10])
                .translateExtent(extent)
                .extent(extent)
                .on('zoom', zoomed));

            function zoomed(event) {
                y.range([1, height].map(d => event.transform.applyY(d)));
                svg.selectAll('.rect')
                    .attr('y', d => {return y(d.version)})
                    .attr('height', y.bandwidth())
                svg.selectAll('.outlier')
                    .attr('y', d => {return y(d.version)})
                    .attr('height', y.bandwidth());
                svg.selectAll('.length')
                    .attr('y', d => y(d.version))
                    .attr('height', y.bandwidth());
                svg.selectAll('.y-axis')
                    .call(d3.axisLeft(y));
            }
        }
    }

    // farbe für anderen scatter plot
}

let overview;

function loadData () {
    const [file] = document.querySelector("input[type=file]").files;
    const reader = new FileReader();

    reader.addEventListener(
        "load",
        () => {
            let paper = JSON.parse(reader.result);

            overview = new VersionOverview(paper);
        },
        false,
        );

    if (file) {
        reader.readAsText(file);
    }
}

document.getElementById("import").addEventListener("change", loadData);

// load small document by default, so that you don't have to use the file picker every time you reload
d3.json('./data/default-data.json')
    .then(data => overview = new VersionOverview(data));