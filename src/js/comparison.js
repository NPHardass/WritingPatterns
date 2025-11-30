import * as d3 from 'd3';

import { getValidVersions, Legend, Swatches, setProperties, getWords, getAddedWords, getRemovedWords } from "./helper";

class Comparison {
    constructor(base, compare) {
        this.validBaseVersions = getValidVersions(base);
        this.validCompareVersions = getValidVersions(compare);

        this.base_page_height = this.validBaseVersions[0].pages[0].height;
        this.base_page_width = this.validBaseVersions[0].pages[0].width;

        this.comp_page_height = this.validCompareVersions[0].pages[0].height;
        this.comp_page_width = this.validCompareVersions[0].pages[0].width;

        this.color = d3.scaleSequential([0, Math.max(this.validBaseVersions.length, this.validCompareVersions.length)], d3.interpolateSpectral);

        console.log(this.validBaseVersions);
        console.log(this.validCompareVersions)
        
        this.setWordProperties();

        this.setEventListener();

        const view = document.getElementById('view').elements['view'].value;
        if (view === 'last') {
            this.visualize();
        } else if (view === 'word') {
            this.visualizeWordLength();
        } else if (view === 'heat') {
            this.visualizeHeatmap();
        } else if (view === 'average') {
            this.visualizeAverageSizeOfChanges();
        } else if (view === 'size') {
            this.visualizeSizeOfChanges();
        }
    }

    setEventListener() {
        window.addEventListener('resize', () => this.getLegend());
        document.getElementById('color-scheme').addEventListener('change', (event) => this.setColorScheme(event.target.value));
        document.getElementById('last-version').addEventListener('click', () => this.visualize());
        document.getElementById('attribute').addEventListener('change', (event) => event.target.value !== 'changes' ? this.visualize() : this.visualizeCanvas());
        document.getElementById('word-length').addEventListener('click', () => this.visualizeWordLength());
        document.getElementById('heatmap').addEventListener('click', () => this.visualizeHeatmap());
        document.getElementById('average-change').addEventListener('click', () => this.visualizeAverageSizeOfChanges());
        document.getElementById('size-of-changes').addEventListener('click', () => this.visualizeSizeOfChanges());
    }

    setWordProperties() {
        setProperties(this.validBaseVersions);
        this.validBaseVersions.forEach((version, i) => {
            version.pages.forEach(page => {
                page['version'] = i;
                page.text.forEach(word => {
                    word['version'] = i;
                    word['page'] = page.number;
                })
            })
        });

        setProperties(this.validCompareVersions);
        this.validCompareVersions.forEach((version, i) => {
            version.pages.forEach(page => {
                page['version'] = i;
                page.text.forEach(word => {
                    word['version'] = i;
                    word['page'] = page.number;
                })
            })
        });
    }

    getLegend() {
        d3.select('.import').select('svg').remove();
        d3.select('.import').select('div').remove();

        const attribute = document.getElementById('attribute');

        const el = document.getElementsByClassName('import')[0];
        let options = {
            "width": el.offsetWidth - 50,
            "marginLeft": 25,
        };
        let legend;
        if (attribute.value === 'age') {
            this.color.domain([1, Math.max(this.validBaseVersions.length, this.validCompareVersions.length)]);

            options.title = 'Age of Words (version)';
            options.ticks = Math.max(this.validBaseVersions.length, this.validCompareVersions.length) < 25 ? Math.max(this.validBaseVersions.length, this.validCompareVersions.length) : Math.max(this.validBaseVersions.length, this.validCompareVersions.length)/25;
            options.tickFormat = ".0f";

            legend = Legend(this.color, options);
        } else if (attribute.value === 'time') {
            this.color.domain([0, 24]);

            options.title = 'Time of Commit (hour)';

            legend = Legend(this.color, options);
        } else if (attribute.value === 'changes') {
            legend = Swatches(d3.scaleOrdinal(['unchanged', 'moved', 'added', 'removed'], ['grey', 'blue', 'green', 'red']), options);
        }
        el.appendChild(legend);
        return legend;
    }

    visualize() {
        d3.select('.content').selectAll('*').remove();
        const baseSvg = d3.select('.content').append('svg');
        const compSvg = d3.select('.content').append('svg');

        const attribute = document.getElementById('attribute');

        const legend = this.getLegend();

        const baseViewBox = [0, 0, this.validBaseVersions.slice(-1)[0].pages.length * (this.base_page_width+5) + 15, this.base_page_height + 20];
        const compViewBox =[0, 0, this.validCompareVersions.slice(-1)[0].pages.length * (this.comp_page_width+5) + 15, this.comp_page_height + 20];

        baseSvg
            .attr('height', 400)
            .attr('width', document.getElementsByClassName('content')[0].offsetWidth)
            .attr('viewBox', baseViewBox);

        compSvg
            .attr('height', 400)
            .attr('width', document.getElementsByClassName('content')[0].offsetWidth)
            .attr('viewBox', compViewBox);

        baseSvg.selectAll('*').remove();

        baseSvg
            .append('rect')
            .datum(this.validBaseVersions.slice(-1)[0])
                .classed('version', true)
                .attr('x', 5)
                .attr('y', 5)
                .attr('width', d => 5 + d.pages.length * (this.base_page_width + 5))
                .attr('height', this.base_page_height + 10)
                .attr('stroke', 'black')
                .attr('fill', 'rgba(0,0,0,0)')
                .attr('stroke-width', '3')
            .each(d => {
                baseSvg
                    .selectAll('.page')
                    .data(d.pages, function (d) {
                        return d.number;
                    })
                    .enter()
                    .append('rect')
                        .classed('page', true)
                        .attr('id', d => d.number)
                        .attr('x', (d, i) => 10 + i * (this.base_page_width + 5))
                        .attr('y', 10)
                        .attr('width', d => d.width)
                        .attr('height', d => d.height)
                        .attr('stroke', 'black')
                        .attr('fill', 'rgba(0,0,0,0)')
                        .attr('stroke-width', '2')
                    .each(d => {
                        baseSvg
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
                                .attr('x', (d, i) => d.x0 + d.page * (this.base_page_width + 10))
                                .attr('y', d => d.y0 + 10)
                                .attr('width', d => d.x1 - d.x0)
                                .attr('height', d => d.y1 - d.y0)
                                .attr('fill', d => attribute.value === 'age' ? this.color(d.added_version) : this.color(new Date(this.validBaseVersions[d.added_version].metadata.authorDate).getHours()))
                                .attr('stroke', d => attribute.value === 'age' ? this.color(d.added_version) : this.color(new Date(this.validBaseVersions[d.added_version].metadata.authorDate).getHours()))
                    })
            })

        compSvg.selectAll('*').remove();

        compSvg
            .append('rect')
            .datum(this.validCompareVersions.slice(-1)[0])
                .classed('version', true)
                .attr('x', 5)
                .attr('y', 5)
                .attr('width', d => 5 + d.pages.length * (this.comp_page_width + 5))
                .attr('height', this.comp_page_height + 10)
                .attr('stroke', 'black')
                .attr('fill', 'rgba(0,0,0,0)')
                .attr('stroke-width', '3')
            .each(d => {
                compSvg
                    .selectAll('.page')
                    .data(d.pages, function (d) {
                        return d.number;
                    })
                    .enter()
                    .append('rect')
                        .classed('page', true)
                        .attr('id', d => d.number)
                        .attr('x', (d, i) => 10 + i * (this.comp_page_width + 5))
                        .attr('y', 10)
                        .attr('width', d => d.width)
                        .attr('height', d => d.height)
                        .attr('stroke', 'black')
                        .attr('fill', 'rgba(0,0,0,0)')
                        .attr('stroke-width', '2')
                    .each(d => {
                        compSvg
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
                                .attr('x', (d, i) => d.x0 + d.page * (this.comp_page_width + 10))
                                .attr('y', d => d.y0 + 10)
                                .attr('width', d => d.x1 - d.x0)
                                .attr('height', d => d.y1 - d.y0)
                                .attr('fill', d => attribute.value === 'age' ? this.color(d.added_version) : this.color(new Date(this.validCompareVersions[d.added_version].metadata.authorDate).getHours()))
                                .attr('stroke', d => attribute.value === 'age' ? this.color(d.added_version) : this.color(new Date(this.validCompareVersions[d.added_version].metadata.authorDate).getHours()))
                    })
            })
    }

    getChanges(paper) {
        const changes = [];

        for (let index = 0; index < paper.length-1; index++) {
            const currentWords = getWords(paper[index]);
            const nextWords = getWords(paper[index+1]);

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

        return [data, max];
    }

    visualizeHeatmap() {
        const base = this.getChanges(this.validBaseVersions);
        const comp = this.getChanges(this.validCompareVersions);

        const baseData = base[0];
        const compData = comp[0];

        const baseMax = base[1];
        const compMax = comp[1];

        console.log(this.base_page_height);
        console.log(this.comp_page_height);

        d3.select('.import').select('svg').remove();
        d3.select('.content').selectAll('*').remove();

        const div = document.getElementsByClassName('content')[0];
        const baseCanvas = document.createElement('canvas');

        div.appendChild(baseCanvas);

        baseCanvas.width = div.offsetWidth-17;

        const lastBaseVersion = this.validBaseVersions.slice(-1)[0];
        const lastCompVersion = this.validCompareVersions.slice(-1)[0];

        let scale = d3.scaleLinear()
        if ((lastBaseVersion.pages.length*(this.base_page_width + 10)) >= (lastCompVersion.pages.length*(this.comp_page_height + 10))) {
            console.log('test')
            scale
                .domain([0, lastBaseVersion.pages.length*(this.base_page_width + 10) + 10])
                .range([0, baseCanvas.width]);
        } else {
            console.log('test2')
            scale
                .domain([0, lastCompVersion.pages.length*(this.comp_page_height + 10) + 10])
                .range([0, baseCanvas.width]);
        }
        if (scale(this.base_page_height) > 400 || scale(this.comp_page_height) > 400) {
            scale
                .domain([0, this.base_page_height > this.comp_page_height ? this.base_page_height : this.comp_page_height])
                .range([0, 400]);
        }

        console.log(scale.domain());
        console.log(scale.range())

        console.log(lastBaseVersion.pages.length);
        console.log(lastCompVersion.pages.length);

        const color = d3.scaleSequential(d3.interpolateReds);

        baseCanvas.height = scale((this.base_page_height + 30));

        const ctx = baseCanvas.getContext('2d');

        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, scale(10 + lastBaseVersion.pages.length * (this.base_page_width + 10)), scale(this.base_page_height + 20));

        lastBaseVersion.pages.forEach(p => {
            ctx.lineWidth = 2;
            ctx.strokeRect(scale(10 + p.number * (this.base_page_width + 10)), scale(10), scale(p.width), scale(p.height));

            baseData[p.number].forEach(obj => {
                ctx.fillStyle = color(obj.value/baseMax);
                ctx.fillRect(scale(10 + p.number * (this.base_page_width + 10) + obj.x), scale(10 + obj.y), scale(1), scale(1));
            });
        });

        const compCanvas = document.createElement('canvas');

        div.appendChild(compCanvas);

        compCanvas.height = scale((this.comp_page_height + 30));

        compCanvas.width = div.offsetWidth-17;

        const compCtx = compCanvas.getContext('2d');

        compCtx.lineWidth = 3;
        compCtx.strokeRect(0, 0, scale(10 + lastCompVersion.pages.length * (this.comp_page_width + 10)), scale(this.comp_page_height + 20));

        lastCompVersion.pages.forEach(p => {
            compCtx.lineWidth = 2;
            compCtx.strokeRect(scale(10 + p.number * (this.comp_page_width + 10)), scale(10), scale(p.width), scale(p.height));

            compData[p.number].forEach(obj => {
                compCtx.fillStyle = color(obj.value/compMax);
                compCtx.fillRect(scale(10 + p.number * (this.comp_page_width + 10) + obj.x), scale(10 + obj.y), scale(1), scale(1));
            });
        });
    }

    getAverageChanges(paper) {
        const changes = [];

        for(let i = 0; i < paper.length-1; i++) {
            const currentWords = getWords(paper[i]);
            const nextWords = getWords(paper[i+1]);

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
                version: paper[i].metadata.index,
                changedAddedWordCount: changedAddedWordCount,
                changedAddedPositionCount: changedAddedPositionCount,
                changedRemovedWordCount: changedRemovedWordCount,
                changedRemovedPositionCount: changedRemovedPositionCount
            };
        }

        return changes
    }

    visualizeAverageSizeOfChanges() {
        const baseChanges = this.getAverageChanges(this.validBaseVersions);
        const compChanges = this.getAverageChanges(this.validCompareVersions);

        d3.select('.import').select('svg').remove();
        d3.select('.content').selectAll('*').remove();

        const baseSvg = d3.select('.content').append('svg');
        const compSvg = d3.select('.content').append('svg');

        const el = document.getElementsByClassName('content')[0];
        const width = el.offsetWidth - 100;
        const height = el.offsetHeight/3;

        const viewBox = [0, 0, el.offsetWidth - 16, el.offsetHeight - 16];

        baseSvg
            .attr('viewBox', viewBox);

        compSvg
            .attr('viewBox', viewBox);

        const baseHistogram = baseSvg.append('g').attr('transform', 'translate(50, 50)');

        const compHistogram = baseSvg.append('g').attr('transform', `translate(50, ${height+75})`);

        const baseX = d3.scaleBand()
          .range([ 1, width ])
          .domain(baseChanges.map(d => d.version))
          .padding(0.2);
        baseHistogram.append("g")
          .attr("transform", "translate(0," + height + ")")
          .call(d3.axisBottom(baseX));

        const baseY = d3.scaleLinear()
          .domain([d3.min(baseChanges.map(function(d){return -(d.changedRemovedWordCount/d.changedRemovedPositionCount)})), d3.max(baseChanges.map(function(d){return d.changedAddedWordCount/d.changedAddedPositionCount}))])
          .range([ height, 0]);
        baseHistogram.append("g")
          .call(d3.axisLeft(baseY));

        baseHistogram.selectAll("rect")
          .data(baseChanges)
          .join(
            enter => {
                let g = enter;

                g.append("rect")
                    .classed('addedBar', true)
                    .attr("x", function(d) { return baseX(d.version); })
                    .attr("width", baseX.bandwidth())
                    .attr("fill", "green")
                    .attr("height", function(d) { return 0; })
                    .attr("y", function(d) { return baseY(0); });

                g.append("rect")
                    .classed('removedBar', true)
                    .attr("x", function(d) { return baseX(d.version); })
                    .attr("width", baseX.bandwidth())
                    .attr("fill", "red")
                    .attr("height", function(d) { return 0; })
                    .attr("y", function(d) { return baseY(0); });
            }
          )

        baseHistogram.selectAll(".addedBar")
            .transition()
            .duration(800)
            .attr("y", function(d) { return baseY(d.changedAddedWordCount/d.changedAddedPositionCount); })
            .attr("height", function(d) { return baseY(0) - baseY(d.changedAddedWordCount/d.changedAddedPositionCount); })
            .delay(function(d,i){return(i*15)});

        baseHistogram.selectAll(".removedBar")
            .transition()
            .duration(800)
            .attr("y", function(d) { return baseY(0); })
            .attr("height", function(d) { return baseY(-(d.changedRemovedWordCount/d.changedRemovedPositionCount)) - baseY(0); })
            .delay(function(d,i){return(i*15)});

        const compX = d3.scaleBand()
            .range([ 1, width ])
            .domain(compChanges.map(d => d.version))
            .padding(0.2);
        compHistogram.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(compX));
  
        const compY = d3.scaleLinear()
            .domain([d3.min(compChanges.map(function(d){return -(d.changedRemovedWordCount/d.changedRemovedPositionCount)})), d3.max(compChanges.map(function(d){return d.changedAddedWordCount/d.changedAddedPositionCount}))])
            .range([ height, 0]);
        compHistogram.append("g")
            .call(d3.axisLeft(compY));
  
        compHistogram.selectAll("rect")
            .data(compChanges)
            .join(
              enter => {
                  let g = enter;
  
                  g.append("rect")
                      .classed('addedBar', true)
                      .attr("x", function(d) { return compX(d.version); })
                      .attr("width", compX.bandwidth())
                      .attr("fill", "green")
                      .attr("height", function(d) { return 0; })
                      .attr("y", function(d) { return compY(0); });
  
                  g.append("rect")
                      .classed('removedBar', true)
                      .attr("x", function(d) { return compX(d.version); })
                      .attr("width", compX.bandwidth())
                      .attr("fill", "red")
                      .attr("height", function(d) { return 0; })
                      .attr("y", function(d) { return compY(0); });
              }
            )
  
        compHistogram.selectAll(".addedBar")
              .transition()
              .duration(800)
              .attr("y", function(d) { return compY(d.changedAddedWordCount/d.changedAddedPositionCount); })
              .attr("height", function(d) { return compY(0) - compY(d.changedAddedWordCount/d.changedAddedPositionCount); })
              .delay(function(d,i){return(i*15)});
  
        compHistogram.selectAll(".removedBar")
              .transition()
              .duration(800)
              .attr("y", function(d) { return compY(0); })
              .attr("height", function(d) { return compY(-(d.changedRemovedWordCount/d.changedRemovedPositionCount)) - compY(0); })
              .delay(function(d,i){return(i*15)});
    }

    getSizeOfChanges(paper) {
        const maxLength = Math.max(...paper.map(v => v.pages.reduce((sum, p) => sum + p.text.length, 0)));
        const changes = [];

        paper.forEach((version, versionIndex) => {
            changes[versionIndex] = {
                version: version.metadata.index,
                changes: []
            };

            let added = new Map();
            let removed = new Map();
            if (versionIndex > 0) {
                added = new Map(getAddedWords(getWords(paper[versionIndex-1]), getWords(paper[versionIndex])).map(e => [e.id, e]));
            }
            if (versionIndex < paper.length-1) {
                removed = new Map(getRemovedWords(getWords(paper[versionIndex]), getWords(paper[versionIndex+1])).map(e => [e.id, e]));
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
        const sizeOfBaseChanges = this.getSizeOfChanges(this.validBaseVersions);
        const sizeOfCompChanges = this.getSizeOfChanges(this.validCompareVersions);

        const baseChanges = sizeOfBaseChanges[0];
        const baseMaxLength = sizeOfBaseChanges[1];

        const compChanges = sizeOfCompChanges[0];
        const compMaxLength = sizeOfCompChanges[1]

        const el = document.getElementsByClassName('content')[0];
        const width = el.offsetWidth - 50;
        const height = el.offsetHeight - 50;
        const marginTop = 25;
        const marginLeft = 25;

        d3.select('.import').select('svg').remove();
        d3.select('.content').selectAll('*').remove();
        const svg = d3.select('.content').append('svg')
            .call(zoom);

        let versions = baseChanges.map(d => d.version);
        versions.push(...compChanges.map(d => d.version))
        versions = Array.from(new Set(versions));
        console.log(versions);

        const y = d3.scaleBand()
            .range([0, height])
            .domain(versions);

        const x = d3.scaleLinear()
            .domain([0, 1])
            .range([0, width]);

        const viewBox = [0, 0, el.offsetWidth, el.offsetHeight-8];

        svg
            .attr('viewBox', viewBox);

        const scatter = svg.append('g').attr('transform', `translate(${marginLeft}, ${marginTop})`);

        let baseData = baseChanges.map(v => v.changes).flat();
        let compData = compChanges.map(v => v.changes).flat();

        let completeData = [...baseData, ...compData];

        const mean = completeData.map((obj) => obj.changedWords).reduce((acc, val) => acc + val, 0) / completeData.length;
        const stdDev = Math.sqrt(completeData.map((obj) => obj.changedWords).reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / completeData.length);

        const baseOutlier = baseData.filter((obj) => {return Math.abs((obj.changedWords - mean) / stdDev) > 1});
        baseOutlier.forEach(element => {
            baseData.splice(baseData.indexOf(element), 1);
        });

        const compOutlier = compData.filter((obj) => {return Math.abs((obj.changedWords - mean) / stdDev) > 1});
        compOutlier.forEach(element => {
            compData.splice(compData.indexOf(element), 1);
        });

        completeData = [...baseData, ...compData];
        const maximum = Math.max(...completeData.map((obj) => obj.changedWords));
        const sizeScale = d3.scalePow().exponent(0.57)
            .domain([0, maximum])
            .range([0, y.bandwidth()/2]);

        baseData = baseData.sort((a, b) => {return -(a.changedWords - b.changedWords);})
        compData = compData.sort((a, b) => {return -(a.changedWords - b.changedWords);})

        const lengthOfBaseVersion = this.validBaseVersions.map(v => {return {length: v.pages.reduce((sum, p) => sum + p.text.length, 0), version:v.metadata.index}});
        const lengthOfCompVersion = this.validCompareVersions.map(v => {return {length: v.pages.reduce((sum, p) => sum + p.text.length, 0), version:v.metadata.index}});

        scatter
            .selectAll('.basebackground')
            .data(lengthOfBaseVersion)
            .enter()
            .append('rect')
                .classed('basebackground', true)
                .attr('x', x(0))
                .attr('y', d => y(d.version))
                .attr('width', d => x(d.length/baseMaxLength))
                .attr('height', y.bandwidth())
                .attr('fill', '#E4E4E4');

        scatter
            .selectAll('.compbackground')
            .data(lengthOfCompVersion)
            .enter()
            .append('rect')
                .classed('compbackground', true)
                .attr('x', x(0))
                .attr('y', d => y(d.version))
                .attr('width', d => x(d.length/compMaxLength))
                .attr('height', y.bandwidth())
                .attr('fill', '#E4E4E4');

        scatter
            .selectAll('.baselength')
            .data(lengthOfBaseVersion)
            .join(
                enter => {
                    const g = enter;

                    g.append('rect')
                        .classed('baselength', true)
                        .attr('x', d => x(d.length/baseMaxLength))
                        .attr('rx', 3)
                        .attr('y', d => y(d.version))
                        .attr('width', 3)
                        .attr('height', y.bandwidth())
                        .attr('fill', 'blue')
                        .attr('opacity', 0.5)
                        .attr('stroke', 'black');
                }
            );

            scatter
                .selectAll('.complength')
                .data(lengthOfCompVersion)
                .join(
                    enter => {
                        const g = enter;
    
                        g.append('rect')
                            .classed('complength', true)
                            .attr('x', d => x(d.length/compMaxLength))
                            .attr('rx', 3)
                            .attr('y', d => y(d.version))
                            .attr('width', 3)
                            .attr('height', y.bandwidth())
                            .attr('fill', 'orange')
                            .attr('opacity', 0.5)
                            .attr('stroke', 'black');
                    }
                );

        scatter
            .selectAll('.baseoutlier')
            .data(baseOutlier)
            .enter()
            .append('circle')
                .classed('baseoutlier', true)
                .attr('cx', function(d){return x(d.docpos);})
                .attr('cy', function(d){return y(d.version)+y.bandwidth()/2;})
                .attr('r', y.bandwidth()/2)
                .attr('fill', 'blue')
                .attr('stroke', 'black');

        scatter
            .selectAll('.compoutlier')
            .data(compOutlier)
            .enter()
            .append('circle')
                .classed('compoutlier', true)
                .attr('cx', function(d){return x(d.docpos);})
                .attr('cy', function(d){return y(d.version)+y.bandwidth()/2;})
                .attr('r', y.bandwidth()/2)
                .attr('fill', 'orange')
                .attr('stroke', 'black');

        scatter
            .selectAll('.basecircle')
            .data(baseData)
            .enter()
            .append('circle')
                .classed('basecircle', true)
                .attr('cx', function(d){return x(d.docpos);})
                .attr('cy', function(d){return y(d.version)+y.bandwidth()/2;})
                .attr('r', function(d){return sizeScale(d.changedWords);})
                .attr('fill', 'blue')
                .attr('stroke', 'black');

        scatter
            .selectAll('.compcircle')
            .data(compData)
            .enter()
            .append('circle')
                .classed('compcircle', true)
                .attr('cx', function(d){return x(d.docpos);})
                .attr('cy', function(d){return y(d.version)+y.bandwidth()/2;})
                .attr('r', function(d){return sizeScale(d.changedWords);})
                .attr('fill', 'orange')
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
                svg.selectAll('.basecircle')
                    .attr('cy', d => y(d.version)+y.bandwidth()/2)
                    .attr('r', d => sizeScale(d.changedWords));
                svg.selectAll('.compcircle')
                    .attr('cy', d => y(d.version)+y.bandwidth()/2)
                    .attr('r', d => sizeScale(d.changedWords));
                svg.selectAll('.baseoutlier')
                    .attr('cy', d => y(d.version)+y.bandwidth()/2)
                    .attr('r', y.bandwidth()/2);
                svg.selectAll('.compoutlier')
                    .attr('cy', d => y(d.version)+y.bandwidth()/2)
                    .attr('r', y.bandwidth()/2);
                svg.selectAll('.basebackground')
                    .attr('y', d => y(d.version))
                    .attr('height', y.bandwidth());
                svg.selectAll('.compbackground')
                    .attr('y', d => y(d.version))
                    .attr('height', y.bandwidth());
                svg.selectAll('.baselength')
                    .attr('y', d => y(d.version))
                    .attr('height', y.bandwidth());
                svg.selectAll('.complength')
                    .attr('y', d => y(d.version))
                    .attr('height', y.bandwidth());
                svg.selectAll('.y-axis')
                    .call(d3.axisLeft(y));
            }
        }
    }
}

let comparison;

const inputFile = document.getElementById('import')

// Holds the contents of each selected file.
const results = []

inputFile.addEventListener('change', async e => {
    const files  = e.target.files
    const reader = new FileReader()

    // New set of results each time.
    results.splice(0)

    for (const file of files)
      results.push(await readFile(reader, file))

    // Do something with the files.
    console.log(results)
    comparison = new Comparison(JSON.parse(results[0]), JSON.parse(results[1]))
});

function readFile(reader, file) {
    const deferredResult = new Promise(resolve => {
      reader.addEventListener('load', function getResult() {
        resolve(reader.result)
        reader.removeEventListener('load', getResult)
      })
    })

    reader.readAsText(file)

    return deferredResult
}


// load small document by default, so that you don't have to use the file picker every time you reload
d3.json('./data/default-data.json')
    .then(data => comparison = new Comparison(data, data));