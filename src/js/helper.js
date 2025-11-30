import * as d3 from 'd3';
import * as htl from 'htl';

export function getValidVersions (paper) {
    const valid = [];

    paper.versions.forEach(element => {
        if (element.pages) {
            valid.push(element);
        }
    });
    return valid;
}

export function getWords (version) {
    const words = [];

    version.pages.forEach(element => {
        words.push(...element.text);
    });
    return words;
}

export function getAddedWords (current, next) {
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

export function getRemovedWords (current, next) {
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

export function setProperties (versions) {
    let added = new Map();
    let previous = getWords(versions[0]);
    for (let i = 0; i < versions.length; i++) {
        const current = getWords(versions[i]);

        const removedWords = getRemovedWords(previous, current);
        removedWords.forEach(word => {
            if (added.has(word.id)) {
                added.delete(word.id);
            }
        })

        versions[i].pages.forEach(page => {
            page.text.forEach(word =>  {
                word.page = page.number;
                if (!added.has(word.id)) {
                    added.set(word.id, i);
                    word.added_version = i// versions[i].metadata.index;
                } else {
                    word.added_version = added.get(word.id);
                }
            });
        });
        previous = current;
    }
    
    let removed = new Map();
    previous = getWords(versions[versions.length-1]);
    for (let i = 0; i <= versions.length -1; i++) {
        const current = getWords(versions[versions.length-i-1]);

        const removedWords = getRemovedWords(current, previous);
        removedWords.forEach(word => {
            removed.set(word.id, versions.length-i);
        })
        versions[versions.length-i-1].pages.forEach(page => {
            page.text.forEach(word => {
                word.removed_version = removed.has(word.id) ? removed.get(word.id) : versions.length -1;
            })
        })
        previous = current;
    }
}

export function getCssColorScheme() {
  const style = getComputedStyle(document.body);

  return {
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

export function getWeekNumber(d) {
    // Copy date so don't modify original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    // Return array of year and week number
    return [d.getUTCFullYear(), weekNo];
}

// Copyright 2021, Observable Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/color-legend
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
export function Legend(color, {
  title,
  tickSize = 6,
  width = 320,
  height = 44 + tickSize,
  marginTop = 18,
  marginRight = 0,
  marginBottom = 16 + tickSize,
  marginLeft = 0,
  ticks = width / 64,
  tickFormat,
  tickValues
} = {}) {

  function ramp(color, n = 256) {
    const canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    for (let i = 0; i < n; ++i) {
      context.fillStyle = color(i / (n - 1));
      context.fillRect(i, 0, 1, 1);
    }
    return canvas;
  }

  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .style("overflow", "visible")
      .style("display", "block");

  let tickAdjust = g => g.selectAll(".tick line").attr("y1", marginTop + marginBottom - height);
  let x;

  // Continuous
  if (color.interpolate) {
    const n = Math.min(color.domain().length, color.range().length);

    x = color.copy().rangeRound(d3.quantize(d3.interpolate(marginLeft, width - marginRight), n));

    svg.append("image")
        .attr("x", marginLeft)
        .attr("y", marginTop)
        .attr("width", width - marginLeft - marginRight)
        .attr("height", height - marginTop - marginBottom)
        .attr("preserveAspectRatio", "none")
        .attr("xlink:href", ramp(color.copy().domain(d3.quantize(d3.interpolate(0, 1), n))).toDataURL());
  }

  // Sequential
  else if (color.interpolator) {
    x = Object.assign(color.copy()
        .interpolator(d3.interpolateRound(marginLeft, width - marginRight)),
        {range() { return [marginLeft, width - marginRight]; }});

    svg.append("image")
        .attr("x", marginLeft)
        .attr("y", marginTop)
        .attr("width", width - marginLeft - marginRight)
        .attr("height", height - marginTop - marginBottom)
        .attr("preserveAspectRatio", "none")
        .attr("xlink:href", ramp(color.interpolator()).toDataURL());

    // scaleSequentialQuantile doesn’t implement ticks or tickFormat.
    if (!x.ticks) {
      if (tickValues === undefined) {
        const n = Math.round(ticks + 1);
        tickValues = d3.range(n).map(i => d3.quantile(color.domain(), i / (n - 1)));
      }
      if (typeof tickFormat !== "function") {
        tickFormat = d3.format(tickFormat === undefined ? ",f" : tickFormat);
      }
    }
  }

  // Threshold
  else if (color.invertExtent) {
    const thresholds
        = color.thresholds ? color.thresholds() // scaleQuantize
        : color.quantiles ? color.quantiles() // scaleQuantile
        : color.domain(); // scaleThreshold

    const thresholdFormat
        = tickFormat === undefined ? d => d
        : typeof tickFormat === "string" ? d3.format(tickFormat)
        : tickFormat;

    x = d3.scaleLinear()
        .domain([-1, color.range().length - 1])
        .rangeRound([marginLeft, width - marginRight]);

    svg.append("g")
      .selectAll("rect")
      .data(color.range())
      .join("rect")
        .attr("x", (d, i) => x(i - 1))
        .attr("y", marginTop)
        .attr("width", (d, i) => x(i) - x(i - 1))
        .attr("height", height - marginTop - marginBottom)
        .attr("fill", d => d);

    tickValues = d3.range(thresholds.length);
    tickFormat = i => thresholdFormat(thresholds[i], i);
  }

  // Ordinal
  else {
    x = d3.scaleBand()
        .domain(color.domain())
        .rangeRound([marginLeft, width - marginRight]);

    svg.append("g")
      .selectAll("rect")
      .data(color.domain())
      .join("rect")
        .attr("x", x)
        .attr("y", marginTop)
        .attr("width", Math.max(0, x.bandwidth() - 1))
        .attr("height", height - marginTop - marginBottom)
        .attr("fill", color);

    tickAdjust = () => {};
  }

  svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x)
        .ticks(ticks, typeof tickFormat === "string" ? tickFormat : undefined)
        .tickFormat(typeof tickFormat === "function" ? tickFormat : undefined)
        .tickSize(tickSize)
        .tickValues(tickValues))
      .call(tickAdjust)
      .call(g => g.select(".domain").remove())
      .call(g => g.append("text")
        .attr("x", marginLeft)
        .attr("y", marginTop + marginBottom - height - 6)
        .attr("fill", "currentColor")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .attr("class", "title")
        .text(title));

  return svg.node();
}

// Copyright 2021, Observable Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/color-legend
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
export function Swatches(color, {
    columns = null,
    format,
    unknown: formatUnknown,
    swatchSize = 15,
    swatchWidth = swatchSize,
    swatchHeight = swatchSize,
    marginLeft = 0
  } = {}) {
    const id = `-swatches-${Math.random().toString(16).slice(2)}`;
    const unknown = formatUnknown == null ? undefined : color.unknown();
    const unknowns = unknown == null || unknown === d3.scaleImplicit ? [] : [unknown];
    const domain = color.domain().concat(unknowns);
    if (format === undefined) format = x => x === unknown ? formatUnknown : x;
  
    function entity(character) {
      return `&#${character.charCodeAt(0).toString()};`;
    }
  
    if (columns !== null) return htl.html`<div style="display: flex; align-items: center; margin-left: ${+marginLeft}px; min-height: 33px; font: 10px sans-serif;">
    <style>
  
  .${id}-item {
    break-inside: avoid;
    display: flex;
    align-items: center;
    padding-bottom: 1px;
  }
  
  .${id}-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(100% - ${+swatchWidth}px - 0.5em);
  }
  
  .${id}-swatch {
    width: ${+swatchWidth}px;
    height: ${+swatchHeight}px;
    margin: 0 0.5em 0 0;
  }
  
    </style>
    <div style=${{width: "100%", columns}}>${domain.map(value => {
      const label = `${format(value)}`;
      return htl.html`<div class=${id}-item>
        <div class=${id}-swatch style=${{background: color(value)}}></div>
        <div class=${id}-label title=${label}>${label}</div>
      </div>`;
    })}
    </div>
  </div>`;
  
    return htl.html`<div style="display: flex; align-items: center; min-height: 33px; margin-left: ${+marginLeft}px; font: 10px sans-serif;">
    <style>
  
  .${id} {
    display: inline-flex;
    align-items: center;
    margin-right: 1em;
  }
  
  .${id}::before {
    content: "";
    width: ${+swatchWidth}px;
    height: ${+swatchHeight}px;
    margin-right: 0.5em;
    background: var(--color);
  }
  
    </style>
    <div>${domain.map(value => htl.html`<span class="${id}" style="--color: ${color(value)}">${format(value)}</span>`)}</div>`;
  }