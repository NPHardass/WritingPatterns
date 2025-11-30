import * as d3 from 'd3'
import ResizeContainer from 'resizing-svg-canvas';

import { getValidVersions, getWords } from './helper';

class Prototype {
    constructor (paper) {
        this.paper = paper;
        this.validVersions = getValidVersions(this.paper);

        this.setProperties();

        this.leftVersion = 0;
        this.rightVersion = 0;

        this.leftPageNumber = 0;
        this.rightPageNumber = 0;

        this.svgLeftOverview = d3.select(".leftOverview")
            .select("svg");

        this.svgRightOverview = d3.select(".rightOverview")
            .select("svg");

        const leftPageDiv = d3.select('.leftPage').node();
        this.leftPageContainer = new ResizeContainer(leftPageDiv);
        const leftPageSvg = this.leftPageContainer.addSvgLayer();
        this.svgLeftPage = d3.select(leftPageSvg);

        const rightPageDiv = d3.select('.rightPage').node();
        this.rightPageContainer = new ResizeContainer(rightPageDiv);
        const rightPageSvg = this.rightPageContainer.addSvgLayer();
        this.svgRightPage = d3.select(rightPageSvg);

        this.svgLeftPage = d3.select(".leftPage")
            .select("svg");

        this.svgRightPage = d3.select(".rightPage")
            .select("svg");

        this.xRange = [1, this.validVersions.length];

        this.setEventListener();

        this.colorScheme = {};
        this.getCssColorScheme();

        this.data_groups = ['unchanged', 'moved', 'added_to_left', 'added_to_right', 'added_to_both', 'removed_from_left', 'removed_from_right', 'removed_from_both'];
        this.colors = this.data_groups.map(el => this.colorScheme[el]);

        this.shown_data_groups = new Map(this.data_groups.map(e => [e, true]));

        this.highlighted = new Map();
        this.highlighted_versions = new Map();

        this.lengthOfVersion = [];
        this.relativeLength = [];
        this.setChanges();
        this.setLengthOfVersions();

        // this.showLegend();

        this.changeVersions();

        // create a tooltip
        this.tip = d3.select('.container')
            .append("div")
            .classed('tooltip', true)
            .style('visibility', 'hidden')
            .style('position', 'absolute')
    }

    setEventListener () {
        document.getElementById("prevLeftPage").addEventListener("click", () => this.prevLeftPage());
        document.getElementById("nextLeftPage").addEventListener("click", () => this.nextLeftPage());
        document.getElementById("prevLeftVersion").addEventListener("click", () => this.prevLeftVersion());
        document.getElementById("nextLeftVersion").addEventListener("click", () => this.nextLeftVersion());

        document.getElementById("prevRightPage").addEventListener("click", () => this.prevRightPage());
        document.getElementById("nextRightPage").addEventListener("click", () => this.nextRightPage());
        document.getElementById("prevRightVersion").addEventListener("click", () => this.prevRightVersion());
        document.getElementById("nextRightVersion").addEventListener("click", () => this.nextRightVersion());

        document.getElementById('time').addEventListener('change', () => this.visualizeFooter());

        this.svgLeftPage.node().addEventListener('resize', this.onLeftPageResize.bind(this));
        this.svgRightPage.node().addEventListener('resize', this.onRightPageResize.bind(this));

    }

    getCssColorScheme() {
        const style = getComputedStyle(document.body);

        this.colorScheme = {
            default: style.getPropertyValue('--default'),
            added: style.getPropertyValue('--added'),
            removed: style.getPropertyValue('--removed'),
            moved: style.getPropertyValue('--moved'),

            unchanged: style.getPropertyValue('--default'),

            added_to_left: style.getPropertyValue('--timeline_added_left'),
            added_to_right: style.getPropertyValue('--timeline_added_right'),
            added_to_both: style.getPropertyValue('--timeline_added_both'),

            removed_from_left: style.getPropertyValue('--timeline_removed_left'),
            removed_from_right: style.getPropertyValue('--timeline_removed_right'),
            removed_from_both: style.getPropertyValue('--timeline_removed_both'),
        };
    }

    onLeftPageResize(event) {
        this.onDetailResize('left', this.svgLeftPage, {}, event);
    }

    onRightPageResize(event) {
        this.onDetailResize('right', this.svgRightPage, {}, event);
    }

    onDetailResize(side, sideSvg, data, event) {
        /// parameters could also be: version, data, svg selector, ...
        console.log(`SVG on side "${side}" was resized.`);
        // trigger redraw
        this.changeVersions();
    }

    setLengthOfVersions () {
        this.validVersions.forEach(e => {
            const currentWords = getWords(e);
            this.lengthOfVersion.push({
                "version": e.metadata.index,
                "authorDate": e.metadata.authorDate,
                "length": currentWords.length,
            });
        });
    }

    setRelativeLengthOfVersions () {
        let relativeLength = [];
        const currentWords = getWords(this.validVersions[this.leftVersion]);
        for (let i=0; i<this.validVersions.length; i++) {
            const movedWordsCount = currentWords.filter((e) => e.move).length; 

            if (i === this.leftVersion) {
                relativeLength.push({
                "version": this.validVersions[i].metadata.index,
                "length": currentWords.length,
                    "added": 0,
                    "removed": 0,
                "moved": movedWordsCount,
                    "unchanged": currentWords.length - movedWordsCount,
                });
            } else {
                const prevWords = getWords(this.validVersions[i]);
                let addedWordsCount = [];
                let removedWordsCount = [];
                if (i < this.leftVersion) {
                    const changedWords = this.getChangedWords(prevWords, currentWords);
                    addedWordsCount = changedWords[0].length;
                    removedWordsCount = changedWords[1].length;
                } else {
                    const changedWords = this.getChangedWords(currentWords, prevWords);
                    addedWordsCount = changedWords[0].length;
                    removedWordsCount = changedWords[1].length;
                }
                relativeLength.push({
                    "version": this.validVersions[i].metadata.index,
                    "length": currentWords.length,
                    "added": addedWordsCount,
                    "removed": removedWordsCount,
                    "moved": movedWordsCount,
                    "unchanged": currentWords.length - movedWordsCount - addedWordsCount,
                });
            }
        }
        this.relativeLength = relativeLength
    }

    getColorScheme () {
        return this.colorScheme;
    }

    getOverviewScale (page) {
        return d3.scaleLinear()
            .domain([0, page.width])
            .range([0, document.getElementsByClassName("leftOverview")[0].offsetWidth - 10]);
    }

    getDetailScale (page) {
        return d3.scaleLinear()
            .domain([0, page.height])
            .range([0, document.getElementsByClassName("leftPage")[0].offsetHeight]);
    }

    getAddedWords2(version) {
        const versionWords = getWords(this.validVersions[version]);
        const leftWords = getWords(this.validVersions[this.leftVersion]);
        const rightWords = getWords(this.validVersions[this.rightVersion]);

        const leftMap = new Map(leftWords.map(e => [e.id, e]));
        const rightMap = new Map(rightWords.map(e => [e.id, e]));

        const not_in_left = [];
        const not_in_right = [];
        const not_in_both = [];

        versionWords.forEach(e => {
            if (!leftMap.has(e.id)) {
                if (!rightMap.has(e.id)) {
                    not_in_both.push(e);
                } else {
                    not_in_left.push(e);
                }
            } else {
                if (!rightMap.has(e.id)) {
                    not_in_right.push(e);
                }
            }
        });

        return [not_in_left, not_in_right, not_in_both];
    }

    getRemovedWords2(version) {
        const versionWords = getWords(this.validVersions[version]);
        const leftWords = getWords(this.validVersions[this.leftVersion]);
        const rightWords = getWords(this.validVersions[this.rightVersion]);

        const versionMap = new Map(versionWords.map(e => [e.id, e]));
        const leftMap = new Map(leftWords.map(e => [e.id, e]));
        const rightMap = new Map(rightWords.map(e => [e.id, e]));

        const only_in_left = [];
        const only_in_right = [];
        const in_both = [];

        leftWords.forEach(e => {
            if (!versionMap.has(e.id)) {
                if (rightMap.has(e.id)) {
                    in_both.push(e);
                } else {
                    only_in_left.push(e);
                }
            }
        });
        rightWords.forEach(e => {
            if (!versionMap.has(e.id)) {
                if (!leftMap.has(e.id)) {
                    only_in_right.push(e);
                }
            }
        })

        return [only_in_left, only_in_right, in_both];
    }

    getChangedWords (current, next) {
        const currentMap = new Map(current.map(e => [e.id, e]));
        const nextMap = new Map(next.map(e => [e.id, e]));

        const added = [];
        nextMap.forEach(e => {
            if (!currentMap.has(e.id)) {
                added.push(e);
            }
        });
        const removed = [];
        currentMap.forEach(e => {
            if (!nextMap.has(e.id)) {
                removed.push(e);
            }
        });

        return [added, removed];
    }

    getAddedWords (current, next) {
        const currentMap = new Map(current.map(e => [e.id, e]));
        const nextMap = new Map(next.map(e => [e.id, e]));

        const added = [];
        nextMap.forEach(e => {
            if (!currentMap.has(e.id)) {
                added.push(e);
            }
        });
        return added;
    }

    getRemovedWords (current, next) {
        const currentMap = new Map(current.map(e => [e.id, e]));
        const nextMap = new Map(next.map(e => [e.id, e]));

        const removed = [];
        currentMap.forEach(e => {
            if (!nextMap.has(e.id)) {
                removed.push(e);
            }
        });
        return removed;
    }

    setChanges() {
        const relativeLength = [];

        for (let i = 0; i < this.validVersions.length; i++) {
            const currentWords = getWords(this.validVersions[i]);
            const movedWordsCount = currentWords.filter((e) => e.move).length;

            const addedWords = this.getAddedWords2(i);
            const removedWords = this.getRemovedWords2(i);
            
            relativeLength.push({
                "version": this.validVersions[i].metadata.index,
                "authorDate": this.validVersions[i].metadata.authorDate,
                "length": currentWords.length,
                "added_to_left": addedWords[0].length,
                "added_to_right": addedWords[1].length,
                "added_to_both": addedWords[2].length,
                "removed_from_left": 0 - removedWords[0].length,
                "removed_from_right": 0 - removedWords[1].length,
                "removed_from_both": 0 - removedWords[2].length,
                "moved": movedWordsCount,
                "unchanged": currentWords.length - addedWords[0].length - addedWords[1].length - addedWords[2].length,
                "complete": currentWords.length + movedWordsCount + addedWords[0].length + addedWords[1].length + addedWords[2].length,
            });
        }
        this.relativeLength = relativeLength;
    }

    setProperties () {
        let added = new Map();
        let previous = getWords(this.validVersions[0]);
        for (let i = 0; i < this.validVersions.length; i++) {
            const current = getWords(this.validVersions[i]);

            const removedWords = this.getRemovedWords(previous, current);
            removedWords.forEach(word => {
                if (added.has(word.id)) {
                    added.delete(word.id);
                }
            })

            this.validVersions[i].pages.forEach(page => {
                page.text.forEach(word =>  {
                    word.page = page.number;
                    if (!added.has(word.id)) {
                        added.set(word.id, i);
                        word.added_version = i;
                    } else {
                        word.added_version = added.get(word.id);
                    }
                });
            });
            previous = current;
        }
        
        let removed = new Map();
        previous = getWords(this.validVersions[this.validVersions.length-1]);
        for (let i = 0; i <= this.validVersions.length -1; i++) {
            const current = getWords(this.validVersions[this.validVersions.length-i-1]);

            const removedWords = this.getRemovedWords(current, previous);
            removedWords.forEach(word => {
                removed.set(word.id, this.validVersions.length-i);
            })
            this.validVersions[this.validVersions.length-i-1].pages.forEach(page => {
                page.text.forEach(word => {
                    word.removed_version = removed.has(word.id) ? removed.get(word.id) : this.validVersions.length -1;
                })
            })
            previous = current;
        }
    }

    visualizeOverview (svg, pages, words, addedWords, removedWords, movedWords) {
        const pageHeight = pages[0].height;
        const overviewScale = this.getOverviewScale(pages[0]);

        const svgIsLeft = svg === this.svgLeftOverview;

        const width = document.getElementsByClassName("leftOverview")[0].offsetWidth;
        const height = overviewScale(pages.length * pages[0].height) + 5 * (pages.length + 1);
        const viewBox = "0 0 " + width + " " + height;

        svg
            .attr("preserveAspectRatio", "xMinYMin meet")
            .attr('viewBox', viewBox);

        svg.selectAll('*').remove();

        svg
            .selectAll('.overviewPage')
            .data(pages, function (d) {
                return d.number;
            })
            .join(
                enter => {
                    const g = enter;

                    const group = g.append('g')
                        .on('click', (event, d) => {
                            svgIsLeft ? this.leftPageNumber = d.number : this.rightPageNumber = d.number;
                            this.changeVersions();
                        });

                    group.append('rect')
                        .classed('overviewPage', true)
                        .classed('selectedOverviewPage', (d) => {return svgIsLeft ? d.number === this.leftPageNumber : d.number === this.rightPageNumber})
                        .attr('id', function (d) { return d.number; })
                        .attr('x', function (d) { return overviewScale(d.x0) + 5 })
                        .attr('y', function (d) { return overviewScale(d.height * d.number + d.y0) + 5 * (d.number + 1) })
                        .attr('width', function (d) { return overviewScale(d.width) })
                        .attr('height', function (d) { return overviewScale(d.height) })

                    group.selectAll('.word')
                        .data((d) => d.text, function (d) {
                            return d.id;
                        })
                        .enter()
                        .append('rect')
                            .classed('word', true)
                            .classed('moved', d => movedWords.some(w => w.id === d.id))
                            .classed('removed', d => svgIsLeft && removedWords.some(w => w.id === d.id))
                            .classed('added', d => !svgIsLeft && addedWords.some(w => w.id === d.id))
                            .classed('highlighted_overview', d => this.highlighted.has(d.id))
                            .attr('id', function (d) { return d.id })
                            .attr('x', function (d) { return overviewScale(d.x0) + 5 })
                            .attr('y', function (d) { return overviewScale(pageHeight * d.page + d.y0) + 5 * (d.page + 1) })
                            .attr('width', function (d) { return overviewScale(d.x1 - d.x0) })
                            .attr('height', function (d) { return overviewScale(d.y1 - d.y0) })
                            .attr('stroke-width', '0.5')
                }
            )
    }

    visualizePage (svg, pages, number, words, addedWords, removedWords, movedWords) {
        // this is strictly not needed, because we set the viewBox anyways, so all coordinates are in the page coordinate system anyways
        // for image-space lines that should have a constant width (e.g., links, annotations) use the vector-effect="non-scaling-stroke" property
        const detailScale = d3.scaleLinear().domain([0, 1]).range([0, 1]);  // no-op
        //const detailScale = this.getDetailScale(pages[number]);

        const colorScheme = this.getColorScheme();

        const svgIsLeft = svg === this.svgLeftPage;

        // ensure that the page is always in the center of the SVG (which now spans the entire div)
        const viewportWidth = parseFloat(svg.node().getAttribute('width'));
        const viewportHeight = parseFloat(svg.node().getAttribute('height'));
        const pageWidth = pages[number].width;
        const pageHeight = pages[number].height;
        const viewportAspect = viewportHeight / viewportWidth;
        const pageAspect = pageHeight / pageWidth;
        const [pagePaddingX, pagePaddingY] = (viewportAspect > pageAspect)
            // viewport is taller than page -> center page vertically
            ? [0, ( viewportHeight - viewportWidth * pageAspect ) * pageWidth / viewportWidth]
            // viewport is wider than page -> center page horizontally
            : [( viewportWidth - viewportHeight / pageAspect ) * pageHeight / viewportHeight, 0];

        const width = detailScale(pagePaddingX + pageWidth);
        const height = detailScale(pagePaddingY + pageHeight);
        const viewBox = `${-pagePaddingX / 2} ${-pagePaddingY / 2} ${width} ${height}`;

        svg
            .attr("preserveAspectRatio", "xMinYMin meet")
            .attr('viewBox', viewBox);

        svg
            .selectAll('.pages')
            .data([pages[number]])
            .join(
                enter => enter
                    .append('rect')
                    .classed('pages', true)
                    .attr('id', function (d) { return d.number; })
                    .attr('x', function (d) { return detailScale(d.x0) })
                    .attr('y', function (d) { return detailScale(d.y0) })
                    .attr('width', function (d) { return detailScale(d.width) })
                    .attr('height', function (d) { return detailScale(d.height) })
                    .attr('stroke', 'black')
                    .attr('fill', 'rgba(0,0,0,0)')
                    .attr('stroke-width', '3'),
                update => update
                    .attr('x', function (d) { return detailScale(d.x0) })
                    .attr('y', function (d) { return detailScale(d.y0) })
                    .attr('width', function (d) { return detailScale(d.width) })
                    .attr('height', function (d) { return detailScale(d.height) }),
                exit => exit.remove()
            );

        // Three function that change the tooltip when user hover / move / leave a cell
        var mouseover = () => {
            this.tip.style('visibility', 'hidden')
        }
        var mousemove = (event, d) => {
            const details_added = this.validVersions[d.added_version].metadata;
            const details_removed = this.validVersions[d.removed_version].metadata;
            let html = "";
            html += `id: ${d.id}`
            html += `<br>added in Version ${details_added.index}<br>by ${details_added.authorName}<br>on the ${new Date(details_added.authorDate).toLocaleDateString('en-us', { year:"numeric", month:"short", day:"numeric"})}`;
            
            if (details_removed.index !== this.validVersions[this.validVersions.length-1].metadata.index) {
                html += `<br>removed in Version ${details_removed.index}<br>by ${details_removed.authorName}<br>on the ${new Date(details_removed.authorDate).toLocaleDateString('en-us', { year:"numeric", month:"short", day:"numeric"})}`;
            } else {
                html += "<br>still in final version"
            }
            this.tip.style('visibility', 'visible')
                .html(html)
                .style("left", Math.min(event.pageX+10, window.innerWidth-200) + "px")
                .style("top", Math.min(event.pageY+15, window.innerHeight-120) + "px");
        }
        var mouseleave = () => {
            this.tip.style('visibility', 'hidden')
        }

        svg
            .selectAll('.word')
            .data(words, function (d) {
                return d.id;
            })
            .join(
                enter => enter
                    .append('rect')
                    .classed('word', true)
                    .classed('moved', d => movedWords.some(w => w.id === d.id))
                    .classed('removed', d => svgIsLeft && removedWords.some(w => w.id === d.id))
                    .classed('added', d => !svgIsLeft && addedWords.some(w => w.id === d.id))
                    .classed('highlighted', d => this.highlighted.has(d.id))
                    .attr('id', (d) => { return d.id })
                    .attr('x', (d) => { return detailScale(d.x0) })
                    .attr('y', (d) => { return detailScale(d.y0) })
                    .attr('width', (d) => { return detailScale(d.x1 - d.x0) })
                    .attr('height', (d) => { return detailScale(d.y1 - d.y0) })
                    .on('click', (event, d) => {
                        if (this.highlighted.has(d.id)) {
                            this.highlighted.delete(d.id)
                            for (var i = d.added_version; i <= d.removed_version; i++) {
                                const ids = this.highlighted_versions.get(i);
                                const index = ids.indexOf(d.id);
                                ids.splice(index, 1);
                                if (ids.length === 0) {
                                    this.highlighted_versions.delete(i);
                                } else {
                                    this.highlighted_versions.set(i,ids);
                                }
                            }
                        } else {
                            this.highlighted.set(d.id, d)
                            for (var i = d.added_version; i <= d.removed_version; i++) {
                                const ids = this.highlighted_versions.has(i) ? this.highlighted_versions.get(i) : [];
                                ids.push(d.id);
                                this.highlighted_versions.set(i,ids);
                            }
                        }
                        this.changeVersions();
                    })
                    .on("mouseover", mouseover)
                    .on("mousemove", mousemove)
                    .on("mouseleave", mouseleave),
                update => update
                    .classed('moved', d => movedWords.some(w => w.id === d.id))
                    .classed('removed', d => svgIsLeft && removedWords.some(w => w.id === d.id))
                    .classed('added', d => !svgIsLeft && addedWords.some(w => w.id === d.id))
                    .classed('highlighted', d => this.highlighted.has(d.id))
                    .attr('x', (d) => { return detailScale(d.x0) })
                    .attr('y', (d) => { return detailScale(d.y0) })
                    .attr('width', (d) => { return detailScale(d.x1 - d.x0) })
                    .attr('height', (d) => { return detailScale(d.y1 - d.y0) }),
                exit => exit.remove()
            );
    }

    // visibility of pages symbols
    visualizeFooter() {
        const svg = d3.select('.timeline').select('svg');
        svg.selectAll('*').remove();

        const el = document.getElementsByClassName("timeline")[0];
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        const viewBox = [0, 0, width, height];

        svg
            .attr("preserveAspectRatio", "xMinYMin meet")
            .attr("viewBox", viewBox);

        svg.append('g')
            .classed('detail', true);

        this.updateHistogramOverview();
        this.updateProgressbar();
    }

    updateHistogramOverview() {
        const svg = d3.select('.timeline').select('svg');

        const el = document.getElementsByClassName("timeline")[0];
        const width = el.offsetWidth;

        const histogram_overview = svg
            .append('g')
            .classed('histogram_overview', true)
            .attr('transform', 'translate(45, 200)');

        const use_time = document.getElementById('time').checked;

        const brush = d3.brushX()
            .extent([[0, 0], [width-50, 30]])
            .on('end', (e) => {
                if (!e.selection) {
                    this.xRange = [1, this.validVersions.length];
                } else {
                    if (!use_time) {
                        this.xRange = e.selection.map(x_overview.invert).map(Math.round);
                    } else {
                        this.xRange[0] = this.validVersions.filter(v => new Date(v.metadata.authorDate).getTime() >= e.selection.map(x_overview.invert)[0].getTime())[0].metadata.index;
                        this.xRange[1] = this.validVersions.filter(v => new Date(v.metadata.authorDate).getTime() <= e.selection.map(x_overview.invert)[1].getTime()).slice(-1)[0].metadata.index;
                    }
                }
                this.updateProgressbar();
            });

        let x_overview = d3.scaleLinear()
            .domain([1, this.validVersions.length])
            .range([0, width - 75]);
        if (use_time) {
            x_overview = d3.scaleTime()
                .domain([new Date(this.validVersions[0].metadata.authorDate), new Date(this.validVersions.slice(-1)[0].metadata.authorDate)])
                .range([0, width - 75]);
        }

        const max_length_of_versions = Math.max(...this.lengthOfVersion.map(e => e.length));
        let y_overview = d3.scaleLinear()
            .domain([0, max_length_of_versions])
            .range([30, 0]);

        histogram_overview
            .append("path")
            .datum(this.lengthOfVersion)
            .attr("fill", "#cce5df")
            .attr("stroke", "#69b3a2")
            .attr("d", d3.area()
                .curve(d3.curveStep)
                .x(d => use_time ? x_overview(new Date(d.authorDate)) : x_overview(this.lengthOfVersion.indexOf(d)+1))
                .y0(y_overview(0))
                .y1(d => y_overview(d.length))
            );

       histogram_overview.call(brush);

        const x_axis_overview = d3.axisBottom(x_overview)
            .tickArguments(!use_time ? [7, ',.0f'] : [7, '%b %d']);

        histogram_overview
            .append('g')
            .attr('transform', 'translate(0,30)')
            .call(x_axis_overview);

        const y_axis_overview = d3.axisLeft(y_overview)
            .tickArguments([2])

        histogram_overview
            .append('g')
            .call(y_axis_overview);
    }

    updateProgressbar() {
        const svg = d3.select('.timeline').select('svg').select('.detail');
        svg.selectAll('*').remove();

        const el = document.getElementsByClassName("timeline")[0];
        const width = el.offsetWidth;

        const progressbar = svg
            .append('g')
            .classed('progressbar', true)
            .attr('transform', 'translate(45, 10)');

        const histogram_detail = svg
            .append('g')
            .classed('histogram', true)
            .attr('transform', 'translate(45, 60)');

        const use_time = document.getElementById('time').checked;

        let x = d3.scaleBand()
            .domain(this.validVersions.slice(this.xRange[0]-1, this.xRange[1]).map(v => v.metadata.index))
            .range([0, width-75]);
        if (use_time) {
            x = d3.scaleTime()
                .domain([new Date(this.validVersions[this.xRange[0]-1].metadata.authorDate), new Date(this.validVersions[this.xRange[1]-1].metadata.authorDate)])
                .range([0, width-75]);
            x(this.validVersions[this.xRange[0]].metadata.authorDate);
        }

        progressbar
            .selectAll('.bar')
            .data([this.validVersions])
            .join(
                enter => enter
                    .append('rect')
                    .classed('bar', true)
                    .attr('x', use_time ? 0 : x.bandwidth()/2)
                    .attr('y', 35 - 1)
                    .attr('width', use_time ? width - 75 : width - 75 - x.bandwidth())
                    .attr('height', 2)
                    .attr('stroke', 'grey')
                    .attr('fill', 'grey')
            );

        progressbar
            .append('g')
            .selectAll('circle')
            .data(this.validVersions.slice(this.xRange[0]-1, this.xRange[1]), function (d) {
                return d.metadata.index;
            })
            .join(
                enter => {
                    let g = enter;

                    g
                        .append('circle')
                        .classed('version_circle', true)
                        .classed('highlighted_circle', d => {
                            return this.highlighted_versions.get(d.metadata.index-1);
                        })
                        .attr('cx', d => {
                            return use_time ? x(new Date(d.metadata.authorDate)) : x(d.metadata.index) + x.bandwidth()/2;
                        })
                        .attr('cy', 35)
                        .attr('r', 6)
                        .on('click', (event, d) => {
                            const left = progressbar
                                .select(`#left${d.metadata.index}`);

                            const right = progressbar
                                .select(`#right${d.metadata.index}`);

                            if (left.attr('visibility') === 'hidden') {
                                left.attr('visibility', 'visible');
                            } else if (left.attr('visibility') === 'visible') {
                                left.attr('visibility', 'hidden');
                            }

                            if (right.attr('visibility') === 'hidden') {
                                right.attr('visibility', 'visible');
                            } else if (right.attr('visibility') === 'visible') {
                                right.attr('visibility', 'hidden');
                            }
                        });

                    g
                        .append('rect')
                        .classed('left', true)
                        .attr('id', d => 'left' + d.metadata.index)
                        .attr('x', d => {
                            return use_time ? x(new Date(d.metadata.authorDate)) - 17.5 : x(d.metadata.index) - 17.5 + x.bandwidth()/2;
                        })
                        .attr('y', 0)
                        .attr('rx', 1)
                        .attr('ry', 1)
                        .attr('height', 21)
                        .attr('width', 15)
                        .attr('stroke', 'grey')
                        .attr('fill', (d) => {
                            return this.validVersions.indexOf(d) === this.leftVersion ? 'grey' : 'rgba(0,0,0,0)'
                        })
                        .attr('visibility', (d) => {
                            if (this.validVersions.indexOf(d) === this.leftVersion || this.validVersions.indexOf(d) === this.rightVersion) {
                                return 'visible';
                            } else {
                                return 'hidden';
                            }
                        })
                        .on('click', (event, d) => {
                            this.leftVersion = this.validVersions.indexOf(d);
                            this.changeVersions();
                        });

                    g
                        .append('rect')
                        .classed('right', true)
                        .attr('id', d => 'right' + d.metadata.index)
                        .attr('x', d => {
                            return use_time ? x(new Date(d.metadata.authorDate)) + 2.5 : x(d.metadata.index) + 2.5 + x.bandwidth()/2;
                        })
                        .attr('y', 0)
                        .attr('rx', 1)
                        .attr('ry', 1)
                        .attr('height', 21)
                        .attr('width', 15)
                        .attr('stroke', 'grey')
                        .attr('fill', (d) => {
                            return this.validVersions.indexOf(d) === this.rightVersion ? 'grey' : 'rgba(0,0,0,0)'
                        })
                        .attr('visibility', (d) => {
                            if (this.validVersions.indexOf(d) === this.leftVersion || this.validVersions.indexOf(d) === this.rightVersion) {
                                return 'visible';
                            } else {
                                return 'hidden';
                            }
                        })
                        .on('click', (event, d) => {
                            this.rightVersion = this.validVersions.indexOf(d);
                            this.changeVersions();
                        });
                }
            );

        const color = d3.scaleOrdinal()
            .domain(this.data_groups)
            .range(this.colors);

        const pos_groups = this.data_groups.slice(0, 5);
        const pos_stacked_data = d3.stack()
            .keys(pos_groups.filter(e => this.shown_data_groups.get(e)))
            .value(function(d, key){
                return d[key];
            })
            (this.relativeLength.slice(this.xRange[0]-1, this.xRange[1]+1));

        const neg_groups = this.data_groups.slice(5);
        const neg_stacked_data = d3.stack()
            .keys(neg_groups.filter(e => this.shown_data_groups.get(e)))
            .value(function(d, key){
                return d[key];
            })
            (this.relativeLength.slice(this.xRange[0]-1, this.xRange[1]));

        const max_pos_value = pos_stacked_data.length > 0 ? d3.max(pos_stacked_data[pos_stacked_data.length - 1], d => d[1]) : 0;
        const max_neg_value = neg_stacked_data.length > 0 ? d3.min(neg_stacked_data[neg_stacked_data.length - 1], d => d[1]) : 0;

        const y_detail = d3.scaleLinear()
            .domain([max_neg_value, max_pos_value])
            .range([120, 0]);

        const tooltip = d3.select('.container').select('.tooltip');

        const mouseover = function(event, d) {
            var subgroupName = d3.select(this.parentNode).datum().key;
            var subgroupValue = d.data[subgroupName];
            d3.selectAll(".myRect").style("opacity", 0.2);
            d3.selectAll("."+subgroupName)
              .style("opacity", 1);
            tooltip
              .html("subgroup: " + subgroupName.split('_').join(' ') + "<br>" + "Value: " + Math.abs(subgroupValue))
              .style('visibility', 'visible');
        }

        const mousemove = function(event, d) {
            tooltip
                .style("left", event.pageX+10 + "px")
                .style("top", event.pageY+15 + "px");
        }
        
        const mouseleave = function(event, d) {
            d3.selectAll(".myRect")
              .style("opacity",1);
            tooltip
                .style('visibility', 'hidden');
        }
            

        if (!use_time) {
            histogram_detail.append("g")
                .selectAll("g")
                .data(pos_stacked_data)
                .enter().append("g")
                .attr("fill", function(d) { return color(d.key); })
                .attr("class", function(d){ return "myRect " + d.key })
                .selectAll("rect")
                .data(function(d) { return d; })
                .enter().append("rect")
                    .attr("x", function(d) { return x(d.data.version); })
                    .attr("y", function(d) { return y_detail(d[1]); })
                    .attr("height", function(d) { return y_detail(d[0]) - y_detail(d[1]); })
                    .attr("width",x.bandwidth())
                    // .attr("stroke", "grey")
                .on('mouseover', mouseover)
                .on('mousemove', mousemove)
                .on('mouseleave', mouseleave);
    
            histogram_detail.append("g")
                .selectAll("g")
                .data(neg_stacked_data)
                .enter().append("g")
                .attr("fill", function(d) { return color(d.key); })
                .attr("class", function(d){ return "myRect " + d.key })
                .selectAll("rect")
                .data(function(d) { return d; })
                .enter().append("rect")
                    .attr("x", function(d) { return x(d.data.version); })
                    .attr("y", function(d) { return y_detail(d[0]); })
                    .attr("height", function(d) { return y_detail(d[1]) - y_detail(d[0]); })
                    .attr("width",x.bandwidth())
                    // .attr("stroke", "grey")
                .on('mouseover', mouseover)
                .on('mousemove', mousemove)
                .on('mouseleave', mouseleave);
        } else {
            histogram_detail
                .selectAll('.layer')
                .data(pos_stacked_data)
                .join(
                    enter => enter
                        .append('path')
                        .classed('layer', true)
                        .style('fill',d => color(d.key))
                        .attr('d', d3.area()
                            .curve(d3.curveStep)
                            .x(d => x(new Date(d.data.authorDate)))
                            .y0(d => y_detail(d[0]))
                            .y1(d => y_detail(d[1]))
                        )
                );

            histogram_detail
                .selectAll('.neg_layer')
                .data(neg_stacked_data)
                .join(
                    enter => enter
                        .append('path')
                        .classed('neg_layer', true)
                        .style('fill',d => color(d.key))
                        .attr('d', d3.area()
                            .curve(d3.curveStep)
                            .x(d => x(new Date(d.data.authorDate)))
                            .y0(d => y_detail(d[0]))
                            .y1(d => y_detail(d[1]))
                        )
                );
        }

        const x_axis_detail = d3.axisBottom(x)
            .tickArguments(!use_time ? [7, ',.0f'] : [7, '%b %d']);

        histogram_detail
            .append('g')
            .attr('transform', 'translate(0,120)')
            .call(x_axis_detail);

        const y_axis_detail = d3.axisLeft(y_detail)
            .tickArguments([4]);

        histogram_detail
            .append('g')
            .call(y_axis_detail);

        this.showLegend();
    }

    showLegend () {
        const svg = d3.select('.legende').select('svg');

        const element = document.getElementsByClassName('legende')[0];
        const viewBox = [0, -10, element.offsetWidth, element.offsetHeight];

        const size = 15;

        const color = d3.scaleOrdinal()
            .domain(this.data_groups)
            .range(this.colors);
        
        svg
            .attr('viewBox', viewBox);

        svg.selectAll('*').remove();

        svg
            .selectAll('dots')
            .data(this.shown_data_groups)
            .join(
                enter => enter
                    .append('rect')
                        .attr('x', 15)
                        .attr('y', (d, i) => i * (size + 10))
                        .attr('width', size)
                        .attr('height', size)
                        .attr('stroke', 'black')
                        .attr('fill', (d) => this.shown_data_groups.get(d[0]) ? color(d[0]) : 'rgba(0,0,0,0)')
                        .on('click', (event, d) => { this.shown_data_groups.set(d[0], !this.shown_data_groups.get(d[0])); this.updateProgressbar(); })
            )

        svg
            .selectAll('labels')
            .data(this.shown_data_groups)
            .join(
                enter => enter
                    .append('text')
                        .attr('x', 15 + size * 1.5)
                        .attr('y', (d, i) => 5 + i * (size + 10) + (size / 2) - 3)
                        .text((d) => d[0].split('_').join(' '))
                        .attr('text-anchor', 'left')
                        .style('alignment-baseline', 'middle')
                        .on('click', (event, d) => { this.shown_data_groups.set(d[0], !this.shown_data_groups.get(d[0])); this.updateProgressbar(); })
            )
    }

    comparePages () {
        const validVersions = getValidVersions(this.paper);

        const leftCommit = validVersions[this.leftVersion];
        const rightCommit = validVersions[this.rightVersion];

        const leftWords = getWords(leftCommit);
        const rightWords = getWords(rightCommit);

        let addedWords = [];
        if (rightCommit.pages[this.rightPageNumber]) {
            addedWords = this.getAddedWords(
                leftWords,
                rightCommit.pages[this.rightPageNumber].text
            );
        }
        let removedWords = [];
        if (leftCommit.pages[this.leftPageNumber]) {
            removedWords = this.getRemovedWords(
                leftCommit.pages[this.leftPageNumber].text,
                rightWords
            );
        }

        const movedWords = rightWords.filter(
            word => !addedWords.some(word2 => (word2.id === word.id))
        ).filter(
            word => word.move
        );
        movedWords.push(...leftWords.filter(
            word => !removedWords.some(word2 => (word2.id === word.id))
        ).filter(
            word => word.move
        ));

        this.visualizePage(
            this.svgLeftPage,
            leftCommit.pages,
            this.leftPageNumber,
            leftCommit.pages[this.leftPageNumber].text,
            addedWords,
            removedWords,
            movedWords
        );
        this.visualizePage(
            this.svgRightPage,
            rightCommit.pages,
            this.rightPageNumber,
            rightCommit.pages[this.rightPageNumber].text,
            addedWords,
            removedWords,
            movedWords
        );
    }

    changeVersions () {
        const validVersions = getValidVersions(this.paper);

        const leftCommit = validVersions[this.leftVersion];
        const rightCommit = validVersions[this.rightVersion];

        this.leftPageNumber = validVersions[this.leftVersion].pages[this.leftPageNumber] ? this.leftPageNumber : 0;
        this.rightPageNumber = validVersions[this.rightVersion].pages[this.rightPageNumber] ? this.rightPageNumber : 0;

        const leftWords = getWords(leftCommit);
        const rightWords = getWords(rightCommit);

        const changedWords = this.getChangedWords(leftWords, rightWords);
        const addedWords = changedWords[0];
        const removedWords = changedWords[1];

        const movedWords = rightWords.filter(word => word.move);
        movedWords.push(...leftWords.filter(w => w.move));

        this.setChanges();

        this.visualizeOverview(
            this.svgLeftOverview,
            leftCommit.pages,
            leftWords,
            addedWords,
            removedWords,
            movedWords
        );
        this.visualizeOverview(
            this.svgRightOverview,
            rightCommit.pages,
            rightWords,
            addedWords,
            removedWords,
            movedWords
        );

        // this.updateProgressbar();
        this.visualizeFooter();

        this.comparePages(
            this.leftVersion,
            this.rightVersion,
            this.leftPageNumber,
            this.rightPageNumber
        );
    }

    nextLeftPage () {
        if (this.validVersions[this.leftVersion].pages[this.leftPageNumber + 1]) {
            this.leftPageNumber += 1;
            this.comparePages();
        }
    }

    prevLeftPage () {
        if (this.validVersions[this.leftVersion].pages[this.leftPageNumber - 1]) {
            this.leftPageNumber -= 1;
            this.comparePages();
        }
    }

    nextRightPage () {
        if (this.validVersions[this.rightVersion].pages[this.rightPageNumber + 1]) {
            this.rightPageNumber += 1;
            this.comparePages();
        }
    }

    prevRightPage () {
        if (this.validVersions[this.rightVersion].pages[this.rightPageNumber - 1]) {
            this.rightPageNumber -= 1;
            this.comparePages();
        }
    }

    nextLeftVersion () {
        if (this.validVersions[this.leftVersion + 1]) {
            this.leftVersion += 1;
            this.changeVersions();
        }
    }

    prevLeftVersion () {
        if (this.validVersions[this.leftVersion - 1]) {
            this.leftVersion -= 1;
            this.changeVersions();
        }
    }

    nextRightVersion () {
        if (this.validVersions[this.rightVersion + 1]) {
            this.rightVersion += 1;
            this.changeVersions();
        }
    }

    prevRightVersion () {
        if (this.validVersions[this.rightVersion - 1]) {
            this.rightVersion -= 1;
            this.changeVersions();
        }
    }
}

let prototype;

function loadData () {
    const [file] = document.querySelector("input[type=file]").files;
    const reader = new FileReader();

    reader.addEventListener(
        "load",
        () => {
            let paper = JSON.parse(reader.result);

            prototype = new Prototype(paper);
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
    .then(data => prototype = new Prototype(data));