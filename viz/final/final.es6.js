//
// Cross-Departmental Research and Teaching DV
//
// (c) London School of Economics 2016
//
//     Christopher York
//     Communications Division
//     C.York@lse.ac.uk
//

// This file must be pre-processed for Safari, as it uses arrow functions.

// TODO
//   - chord colors during selection should be by *opposite* dept color   DONE
//   - relayout on resize of window                                       DONE
//   - each view in a separate group, fade in on select                   DONE
//   - move through modes on a timer                                      DONE
//   - shouldn't advance modes during hover on a department               DONE
//   - faculty sorting for dual chord                                     DONE

//   - non-directed graph, so chords should be gradient colored
//   - problems mousing in and out of chords / out of sync                DONE
//   - labels should only appear for local chords                         DONE
//   - arcs should transition in a progressive fashion?
//   - space for labels at top of chords                                  DONE
//   - when a transition occurs during a hover, chords go out of order
//   - put values next to departments
//   - move viz selector into title line                                  DONE
//   - add "explore the data" to title                                    DONE
//   - add "research" & "teaching" titles to chord diagrams               DONE
//   - rename "chord" & "matrix"                                          DONE
//   - outer margins need adjusting

//   - matrix needs to rescale after window resize

"use strict";

queue().defer(d3.csv, "../data-6.1,6.3.csv")
       .defer(d3.csv, "../data-6.2.csv")
       .defer(d3.csv, "../data-6.4.csv")
       .await( (err, depts, research, teaching) => {
  if(err) { throw err }


  // convert data from JSON to javascript types
  depts.forEach( (d) => { d.faculty = +d.faculty; d.research_links = +d.research_links; d.teaching_links = +d.teaching_links })
  research.forEach( (d) => d.links = +d.links )
  teaching.forEach( (d) => d.links = +d.links )


  // prepare list of nodes; should be a superset of depts list
  let rd1 = research.map( (d) => d.department1 )
  let rd2 = research.map( (d) => d.department2 )
  let td1 = teaching.map( (d) => d.department1 )
  let td2 = teaching.map( (d) => d.department2 )
  let dept_names = d3.set([].concat(rd1).concat(rd2).concat(td1).concat(td2)).values()
  let n = dept_names.length


  // extract faculty counts per department

  let faculty = d3.range(n).map( () => 0)
  depts.forEach( (d) => faculty[dept_names.indexOf(d.department)] = d.faculty)


  // prepare the data matrices

  function populate(xs, m) {
    xs.forEach( (x) => {
      let i = dept_names.indexOf(x.department1)
      let j = dept_names.indexOf(x.department2)
      if(m[i][j] || m[j][i]) {
        console.log("WARNING: " + x.department1 + " x " + x.department2 + " = " + m[i][j] + " or " + m[j][i] + " or " + x.links + "?")
      }
      m[i][j] = m[j][i] = x.links
    })
    return m
  }

  let sum = (vector) => vector.reduce( (a,b) => a+b, 0.0)
  let matrix_add = lift( (a,b) => a+b )
  let matrix_subtract = lift( (a,b) => a-b )

  let research_matrix = populate(research, constant_matrix(n))
  let teaching_matrix = populate(teaching, constant_matrix(n))

  let links_matrix = matrix_add(research_matrix, teaching_matrix)
  let links_sum = links_matrix.map(sum)
  let balance_matrix = matrix_subtract(research_matrix, teaching_matrix)
  let balance_sum = balance_matrix.map(sum)


  // application state

  let cur_viz, cur_order


  // cross-visualization configuration

  const margins = { top: 0, left: 150, right: 50, bottom: 0 }
  const firstSlide = 2500
  const slideSpeed = 7500
  const orders = [ 'department', 'links', 'emphasis', 'faculty' ]


  let width, height

  let svg = d3.select("body")
    .append("svg")

  svg.append('defs')
    .append('marker')
      .attr('id', 'markerCircle')
      .attr('markerWidth', 3)
      .attr('markerHeight', 3)
      .attr('refX', 1.5)
      .attr('refY', 1.5)
    .append('circle')
      .attr('r', 1.5)
      .attr('cx', 1.5)
      .attr('cy', 1.5)

  let svg_g = svg.append("g")
    .attr("transform", "translate(" + margins.left + "," + margins.top + ")")


  // timer cycling through orders

  let timeout

  function advance() {
    let i = orders.indexOf(cur_order)
    let next_order = orders[ (i + 1) % orders.length ]

    let hover_count = 0
    d3.select(".no_advance:hover").each( () => ++hover_count )

    if(hover_count === 0) {
      show(cur_viz, next_order)
    }

    timeout = setTimeout(advance, slideSpeed)
  }


  // transition application state

  function show(viz, order) {
    cur_viz = viz
    cur_order = order

    render_all()
  }


  // render complete tree of components

  const viz_names = {
    chord: 'By Department',
    matrix: 'All the Data'
  }

  let render = {
    chord: render_dual(),
    matrix: render_matrix()
  }

  function render_all() {
    render_viz_selector(cur_viz)
    render_order(cur_order)

    let viz = svg_g.selectAll(".viz")
      .data(d3.keys(render))

    viz.enter().append("g")
      .attr("class", "viz")

    viz.filter( (d) => d === cur_viz)
       .call(render[cur_viz], cur_order)

    viz.attr('visibility', (d) => d === cur_viz ? 'visible' : 'hidden')
       .transition()
         .duration(500)
         .attr("opacity", (d) => d === cur_viz ? 1 : 0)
  }


  // layout entire application

  function relayout(minWidth) {
    width = minWidth - margins.right
    height = minWidth * 0.7 - margins.bottom

    svg.attr("width", width)
       .attr("height", height)

    d3.keys(render).forEach( (viz) => {
      render[viz].relayout()
    })
  }

  window.onresize = function() {
    relayout(window.innerWidth)
    render_all()
  }


  // viz selector

  function render_viz_selector(viz) {
    let viz_li = d3.select("#viz ul")
       .selectAll("li")
      .data(d3.keys(render))

    viz_li.enter().append("li")
        .attr("id", (d) => d)
        .text((d) => viz_names[d])
       .on("click", (d) => show(d, cur_order))

    viz_li.classed("selected", (d) => d === viz)
  }


  // order selector

  function render_order(order) {

    // TODO.  generate the order HTML using D3?

    d3.select('#order input[value="' + order + '"]').property('checked', true)

    d3.select("#order").on("change", function(d) {
      let order = d3.select('#order :checked').node().value
      clearTimeout(timeout)
      show(cur_viz, order)
    })
  }


  // dual-chord viz

  function render_dual() {

    let innerRadius, outerRadius, chordRadius, labelRadius

    const margins = { top: 80, left: 0, right: 0, bottom: 0 }

    const τ = 2 * Math.PI
    const pie_rotate = τ * 5 / 8          // when ordered, start in lower left corner so labels run downwards

    const padAngle = 0.01
    const chordWidth = 0.04
    const mode_dur = 750

    const label_margin = 1.5
    const label_padding = 5
    const title_margin = 20

    let fill = d3.scale.category20c()
      .domain(d3.range(0, n))

    let arc = d3.svg.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)

    let label_arc = d3.svg.arc()
      .innerRadius(labelRadius)
      .outerRadius(outerRadius)

    let chord = d3.svg.chord()
      .radius(chordRadius)

    let dominant_arc = (d) => d3.min([d.source_index, d.target_index])
    let linked_to = (d, i) => d.source_index === i || d.target_index === i

    let arc_center = (d, width) => {
      width = width || 0.1
      let c = d3.mean([d.startAngle, d.endAngle])
      let s = d3.max([d.startAngle, c - width])
      let t = d3.min([c + width, d.endAngle])

      return { startAngle: s, endAngle: t }
    }

    let pie = d3.layout.pie()
      .startAngle(pie_rotate)
      .endAngle(τ + pie_rotate)
      .padAngle(padAngle)

    let sortsum = (a,b) => d3.descending( sum(a), sum(b) )

    let layouts = {
      department: pie.sort(null).value(Number)( d3.range(0,n).map(d3.functor(1)) ),
      faculty:    pie.sort(d3.ascending).value(Number)( faculty.map( (d) => d || 0) ),
      links:      pie.sort(sortsum).value(sum)( matrix_add(research_matrix, teaching_matrix) ),
      emphasis:   pie.sort(sortsum).value(sum)( matrix_subtract(research_matrix, teaching_matrix) )
    }

    function calc_links(data, node_positions) {
      let links = []
      let i=-1; while(i++<n-1) {
        let j=-1; while(j++<i-1) {
          let val = data[i][j]
          if(val > 0) {
            links.push({ source: arc_center(node_positions[i], chordWidth),
                         target: arc_center(node_positions[j], chordWidth),
                         value: val,
                         source_index: i,
                         target_index: j})
          }
        }
      }
      return links
    }

    const marker_circle_radius = 1.5

    function relayout_labels(nodes) {

      // add defs to svg header, if not already present
      if(svg.select('#markerCircle').empty()) {
        svg.append('defs')
          .append('marker')
            .attr('id', 'markerCircle')
            .attr('markerWidth', marker_circle_radius * 2)
            .attr('markerHeight', marker_circle_radius * 2)
            .attr('refX', marker_circle_radius)
            .attr('refY', marker_circle_radius)
          .append('circle')
            .attr('r', marker_circle_radius)
            .attr('cx', marker_circle_radius)
            .attr('cy', marker_circle_radius)
      }

      // constraint relaxing algorithm for label positions

      const sign = (x) => x > 0 ? 1 : -1
      const spacing = 2  // TODO change to "adjust"

      // returns the upper-left point in the rectangle
      // negative sizes indicate label's origin is on opposite side
      function attach_point(point, size) {
        let attach = point.slice()
        attach[0] += Math.min(0, size[0])
        attach[1] += Math.min(0, size[1])
        return attach
      }

      function rect_intersect(point1, size1, point2, size2) {
        let r1 = { x1: point1[0], y1: point1[1], x2: point1[0] + size1[0], y2: point1[1] + size1[1] }
        let r2 = { x1: point2[0], y1: point2[1], x2: point2[0] + size2[0], y2: point2[1] + size2[1] }
        let separate = /* left */  Math.max(r1.x1, r1.x2) + label_margin < Math.min(r2.x1, r2.x2) - label_margin ||
                       /* above */ Math.max(r1.y1, r1.y2) + label_margin < Math.min(r2.y1, r2.y2) - label_margin ||
                       /* right */ Math.min(r1.x1, r1.x2) - label_margin > Math.max(r2.x1, r2.x2) + label_margin ||
                       /* below */ Math.min(r1.y1, r1.y2) - label_margin > Math.max(r2.y1, r2.y2) + label_margin
        return !separate
      }

      // NB not a general solution to circle-rectangle intersection!
      //    this approach requires the rectangle's longest side to be shorter than the circle's diameter
      function circle_intersect(point, size, center, radius) {
        let x1 = point[0], y1 = point[1], x2 = point[0] + size[0], y2 = point[1] + size[1]
        let in_circle = (x,y) => Math.sqrt( Math.pow(x - center[0], 2) + Math.pow(y - center[1], 2) ) < radius

        return in_circle(x1, y1) || in_circle(x1, y2) || in_circle(x2, y2) || in_circle(x2, y1)
      }

      let labels = nodes.select('text')

      // unconventional use of D3: because bounding box isn't available until text node added to DOM,
      // we do final updates of the layout inside D3 join
      labels.each( function(d) {
        let bbox = this.getBBox()
        d.labelPosition = label_arc.centroid(d)

        // Convention: positive label size values indicate origin in upper left corner
        //             negative label size moves origin to opposite side
        d.labelSize = [ bbox.width, bbox.height ]

        // put in margin before or after label
        d.labelSize[0] += label_padding

        // adjust origin of label to match quadrant
        d.labelSize[0] *= -sign(d.labelPosition[0])
        d.labelSize[1] *= -sign(d.labelPosition[1])
      })

      // relax the label positions until they are not overlapping

      // the following algorithm works for labels with origin in upper right; text-anchor, dx, dy etc will CANNOT be used on
      // the <text> elements.

      let relaxing

      relaxing = true; while(relaxing) {
        // move labels that overlap the circle (... could be done by direct calculation)
        relaxing = false
        nodes.each( (d0,i0) => {
          if(circle_intersect(d0.labelPosition, d0.labelSize, [0,0], labelRadius)) {
            d0.labelPosition[1] += sign(d0.labelPosition[1]) * spacing
            relaxing = true
          }
        })
      }

      relaxing = true; while(relaxing) {
        // move labels that overlap each other
        relaxing = false
        nodes.each( (d0,i0) => {
          nodes.each( (d1,i1) => {
            if(i0===i1) return
            if(!rect_intersect(d0.labelPosition, d0.labelSize,
                               d1.labelPosition, d1.labelSize)) return
            // only nudge the outermost of the two labels
            if(!(Math.abs(d0.labelPosition[0]) < Math.abs(d1.labelPosition[0]))) return
            d1.labelPosition[1] += sign(d1.labelPosition[1]) * spacing
            relaxing = true
          })
        })
      }

      labels
        .attr('transform', (d) => 'translate(' + attach_point(d.labelPosition, d.labelSize) + ')')
        .attr('dy', '0.9em') // cross-browser workaround approximating <text dominant-baseline="text-before-edge">...
        .attr('dx', (d) => -label_padding * sign(d.labelPosition[0]))


      // lines
      let label_rule = (d) => {
        let attach = d.labelPosition.slice()
        attach[1] += d.labelSize[1] / 2
        return [arc.centroid(d), label_arc.centroid(d), attach ]
      }

      nodes.select('polyline')
        .attr('points', label_rule)

    }

    function update(g, order) {

      // update chords layout
      let node_positions = layouts[order]

      // transition nodes (department arcs)

      let node = g.selectAll(".dept")
          .data(node_positions)

      node.exit().remove()          // never actually used

      let node_g = node.enter().append("g")
          .attr("class", (d) => "dept no_advance")

      node_g.append("path")
        .attr("fill", (d,i) => fill(i))

      let label_info = node_g.append("g")
        .attr("class", "label_info")
        .attr("opacity", 0)
      label_info.append('polyline')
        .attr('marker-end', 'url(#markerCircle)')
      label_info.append("text")

      let trans = node.transition()
        .duration(mode_dur)

      trans.select("path")
          .attrTween("d", function(d) { // "this" below requires function...
            let interp = d3.interpolate(this._current || d, d)
            this._current = d
            return (t) => arc(interp(t))
          })

      node.select("text")
        .text( (d, i) => trim(dept_names[i], 27))

      node.call(relayout_labels)

      // transition links (chords)

      let link = g.selectAll(".link")
          .data((matrix) => calc_links(matrix, node_positions),
                (d) => [d.source_index, d.target_index].join("x"))

      link.exit()
        .transition()
          .duration(mode_dur)
          .attr("opacity", 0)
        .remove()

      link.enter()
        .append("path")
          .attr("class", "link")
          .attr("fill", (d) => fill(dominant_arc(d)))
          .attr("opacity", 0)

      link.transition()
        .duration(mode_dur)
          .attr("opacity", 1)
          .attrTween("d", function(d) { // "this" below requires function...
            let interp = d3.interpolate(this._current || d, d)
            this._current = d
            return (t) => chord(interp(t))
          })
    }

    function focus(g, d0, i0) {

      // collect list of linked departments
      let affiliated = d3.set()
      g.selectAll(".link")
        .filter( (d) => linked_to(d, i0) )
        .each( (d) => { affiliated.add(d.source_index); affiliated.add(d.target_index) })

      // silently move labels to focused dept

      g.selectAll(".dept .label_info")
        .attr("opacity", 0)

      g.selectAll(".dept")
        .filter( (d,i) => affiliated.has(i) || i === i0 )
        .call(relayout_labels)

      // transition the chords, then fade in labels

      g.transition()
        .selectAll(".link")
          .attr("opacity", (d,i) => linked_to(d, i0) ? 1 : 0.025)
// TODO.  use gradients instead
//          .attr("fill", (d) => linked_to(d, i0) ? fill(i0) : fill(dominant_arc(d, i0)) )

      let trans = g.transition().delay(1500).duration(500)

      trans.selectAll(".dept .label_info")
           .attr("opacity", (d,i) => affiliated.has(i) || i === i0 ? 1 : 0)
      trans.select(".title")
           .attr("opacity", 0)

    }

    function defocus(g) {

      g.classed('focused', false)

      g.transition().selectAll(".dept .label_info")
        .attr("opacity", 0)

      let trans = g.transition().delay(500)

      trans.selectAll(".link")
// TODO.  use gradients instead
//        .attr("fill", (d) => fill(dominant_arc(d)))
          .attr("opacity", 0.9)

      trans.select(".title")
           .attr("opacity", 1)
    }

    let chart = function(g, order) {

      // margins

      g.attr('transform', 'translate(' + margins.left + ',' + margins.top + ')')

      // pair of graph connection diagrams

      const matrix_titles = [ 'Research', 'Teaching' ]

      let chord = g.selectAll(".chord")
        .data([research_matrix, teaching_matrix])

      chord.enter().append("g")
          .attr("class", "chord")
        .append("text")
          .attr("class", "title")
          .attr("text-anchor", "middle")
          .text( (d,i) => matrix_titles[i] )

      chord.select(".title")
        .attr("transform", "translate(0," + -(labelRadius + title_margin) + ")")

      chord.attr("transform", (d,i) => "translate(" + (labelRadius * 2 * i + labelRadius) + "," + labelRadius + ")")
           .call(update, order)

      // behavior

      // [ focus each chord diagram separately since labels must be repositioned ]

      chord.selectAll(".dept path")
             .on("mouseenter", (d,i) => chord.each( function() { focus(d3.select(this), d, i) }))
             .on("mouseout", (d,i) => chord.each( function() { defocus(d3.select(this), d, i) }))
    }

    chart.relayout = function() {
      innerRadius = Math.min((width - 100) / 2.0, height) * .41
      outerRadius = innerRadius * 1.05
      chordRadius = innerRadius * 0.99
      labelRadius = innerRadius * 1.15

      arc.innerRadius(innerRadius)
         .outerRadius(outerRadius)

      label_arc.innerRadius(labelRadius)
               .outerRadius(outerRadius)

      chord.radius(chordRadius)
    }

    return chart
  }


  function render_matrix() {

    const margins = { top: 100, left: 0, right: 0, bottom: 0 }

    const legend_cell = 7
    const legend_packing = 1
    const cell_packing = 4 // should be ceiling(sqrt(max count of links))
    const cell_padding = 1
    const stroke_width = 1.0
    const trim_value = 27
    const research_color_1 = "red"
    const research_color_2 = "yellow"
    const neutral_color = "gray"
    const empty_color = "#dadad9"
    const teaching_color = "#35b7e5"

    const points = d3.merge(d3.range(n).map( (i) => d3.range(n).map( (j) => {
      return { i: i, j: j}
    })))

    let orders = {
      department: d3.range(n).sort( (a, b) => d3.ascending(dept_names[a], dept_names[b])),
      faculty: d3.range(n).sort( (a, b) => faculty[b] - faculty[a] ),
      links: d3.range(n).sort( (a, b) => links_sum[b] - links_sum[a] ),
      emphasis: d3.range(n).sort( (a, b) => balance_sum[b] - balance_sum[a])
    }

    let scale = d3.scale.ordinal()

    let colorscale = d3.scale.linear()
      .domain([-9, -2, 0, 4.5, 9])
      .range([teaching_color, teaching_color, neutral_color, research_color_1, research_color_2])

    let sizescale = d3.scale.linear()
      .domain([0, 11])  // should be max count of links

    let csd = colorscale.domain()

    let chart = function(g, order) {

      g.attr('transform', 'translate(' + margins.left + ',' + margins.top + ')')

      scale.domain(orders[order])

      sizescale.range([3, scale.rangeBand()])

      // cells (links)

      let cell = g.selectAll(".cell")
          .data(points)

      let cell_enter = cell.enter()
          .append("g")
            .attr("class", (d) => "cell x_" + to_class(dept_names[d.i]) + " y_" + to_class(dept_names[d.j]) + " no_advance")
            .attr("transform", (d) => "translate(" + scale(d.i) + "," + scale(d.j) + ")" )
            .attr("fill", "transparent")

      cell_enter.append("title")
        .text((d) => dept_names[d.i] + " & " + dept_names[d.j] +
                   "\nResearch: " + research_matrix[d.i][d.j] +
                   ", Teaching: " + teaching_matrix[d.i][d.j])

      cell_enter.append("rect")
        .attr("class", "background")
        .attr("rx", 1)
        .attr("ry", 1)
        .attr("stroke", "none")
        .attr("width", scale.rangeBand())
        .attr("height", scale.rangeBand())
        .attr("opacity", 0.2)
        .attr("fill", "none")

      cell_enter.append("rect")
        .attr("class", "sum")
        .attr("rx", 1)
        .attr("ry", 1)

      cell_enter.selectAll(".sum")
          .attr("stroke", "none")
          .attr("x", (d) => scale.rangeBand() / 2.0 - sizescale( links_matrix[d.i][d.j] ) / 2.0)
          .attr("y", (d) => scale.rangeBand() / 2.0 - sizescale( links_matrix[d.i][d.j] ) / 2.0)
          .attr("width", (d) => sizescale( links_matrix[d.i][d.j] ))
          .attr("height", (d) => sizescale( links_matrix[d.i][d.j] ))
          .attr("fill", (d) => {
            return links_matrix[d.i][d.j] > 0 ? colorscale(balance_matrix[d.i][d.j]) : empty_color
          })
          .attr("opacity", 1.0)

      // rules (nodes)

      let xlabs = g.selectAll(".x.labels")
        .data(dept_names)
       .enter().append("g")
        .attr("class", "x labels no_advance")
        .attr("transform", (d, i) => "translate(" + (scale(i) + 5) + ",-15)rotate(-45)")

      xlabs.append("rect")
        .attr("fill", "transparent")
        .attr("width", 200)
        .attr("height", scale.rangeBand())

      xlabs.append("text")
        .attr("class", (d, i) => "dept" + i)
        .attr("dominant-baseline", "middle")
        .attr("dy", scale.rangeBand() / 2.0)
        .text( (d) => trim(d, trim_value))
        .attr("fill", "black")

      xlabs.call(highlight.bind(null, "x_"))

      let ylabs = g.selectAll(".y.labels")
        .data(dept_names)
       .enter().append("g")
        .attr("class", "y labels no_advance")
        .attr("transform", (d,i) => "translate(" + (width - margins.right - margins.left) + "," + scale(i) + ")")

      ylabs.append("rect")
        .attr("fill", "transparent")
        .attr("width", 200)
        .attr("height", scale.rangeBand())

      ylabs.append("text")
        .attr("class", (d,i) => "dept" + i)
        .attr("dominant-baseline", "middle")
        .attr("dy", scale.rangeBand() / 2.0)
        .text( (d) => trim(d, trim_value))
        .attr("fill", "black")

      ylabs.call(highlight.bind(null, "y_"))

      // legends

      let tick = g.selectAll(".tick")
          .data(d3.range(d3.min(csd), d3.max(csd)))
        .enter().append("g")
          .attr("class", "tick")
          .attr("transform", (d,i) => "translate(-150," + (50 + (legend_cell + legend_packing) * i) +  ")")

      tick.append("rect")
            .attr("width", legend_cell)
            .attr("height", legend_cell)
            .attr("fill", (d) => colorscale(d))

      tick.append("g")
        .append("text")
          .attr("dominant-baseline", "hanging")
          .attr("dx", legend_cell * 1.5)
          .attr("fill", "black")
          .text( (d, i) => i === 0 ? "more teaching links" : d === 0 ? "balanced" : d === d3.max(csd) - 1 ? "more research links" : "")

      let ssd = sizescale.domain()
      let tick2 = g.selectAll(".tick2")
         .data(d3.range(ssd[0], ssd[1], 2))
        .enter().append("g")
         .attr("class", "tick2")
         .attr("transform", (d,i) => "translate(-150," + (scale.rangeBand() * i + 200) + ")")

      tick2.append("rect")
         .attr("x", (d,i) => scale.rangeBand() / 2.0 - sizescale(i) / 2.0)
         .attr("y", (d,i) => scale.rangeBand() / 2.0 - sizescale(i) / 2.0)
         .attr("width", (d,i) => sizescale(i) )
         .attr("height", (d,i) => sizescale(i) )
         .attr("fill", neutral_color)

      tick2.append("text")
        .attr("dx", scale.rangeBand() * 1.2)
        .attr("dy", scale.rangeBand() / 2.0)
        .attr("dominant-baseline", "middle")
        .text( (d, i) => d + (i === 0 ? " total links" : ""))

      // animation

      let trans = g.transition().duration(2500)

      trans.selectAll(".x.labels")
          .delay(function(d, i) { return scale(i) * 4; })
          .attr("transform", (d, i) => "translate(" + (scale(i) + 5) + ",-15)rotate(-45)")

      trans.selectAll(".cell")
          .delay(function(d) { return scale(d.i) * 4; })
          .attr("transform", (d) => "translate(" + scale(d.i) + "," + scale(d.j) + ")" )

      trans.selectAll(".y.labels")
          .delay(function(d, i) { return scale(i) * 4; })
          .attr("transform", (d,i) => "translate(" + (width - margins.right - margins.left) + "," + scale(i) + ")")

      // behavior

      function highlight(prefix, sel) {
        sel.on("mouseover", (d) => {
          d3.selectAll(".cell.selected").classed("selected", false)
          d3.selectAll(".cell." + prefix + to_class(d)).classed("selected", true)
        })
      }

    }

    chart.relayout = function () {
      scale.rangeRoundBands([0, width - margins.left - margins.right], 0.1)
    }

    return chart
  }


  // initial layout and first render

  relayout(window.innerWidth)
  show('chord', 'department')
  timeout = setTimeout(advance, firstSlide)

})


// Utility functions

function trim(s, n) {
  return (s.length > n) ? (s.slice(0,n-3)+"...") : s
}

function to_class(s) {
  return s.toLowerCase().replace(/\W/g, '_')
}

// Matrix manipulation

function constant_matrix(n, c) {
  c = c || 0.0
  return d3.range(0,n).map( () => {
    return d3.range(0,n).map( () => c )
  })
}

function lift(fn) {
  return function(a,b) {

    let n = a.length,
        c = constant_matrix(n)

    let i=-1; while(i++<n-1) {
      let j=-1; while(j++<n-1) {
        c[i][j] = fn(a[i][j], b[i][j])
      }
    }

    return c
  }
}