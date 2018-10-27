const log = console.log;
const rowColors = 
[
    "#b3d485","#da84ec","#bbe532","#ef85c0",
    "#6fda4c","#afaae6","#dfc32b","#73c3e2",
    "#ec9228","#74d4cb","#f48658","#5cdca9",
    "#ec9084","#6bd77d","#e0a2b5","#c6d04e",
    "#bbc2cc","#dbad4d","#9dcfa7","#d6b46f",
    "#b6cf64","#ccc2a7","#d6ba86"
];

//for loading files
const PromiseWrapper = function(d) {
    return new Promise(function(resolve) {
        d3.json(d, function(p) { resolve(p); });
    });
};

//dc.js modules
const sunBurst = dc.sunburstChart("#sun-burst");
const heatMap = dc.heatMap("#heatmap-chart");
const row = dc.rowChart("#row-chart");
const table = dc_datatables.datatable("#data-table");
const rowSels = dc.selectMenu("#sel-departments");
const yearSels = dc.selectMenu("#sel-years");
const fundsSels = dc.selectMenu("#sel-fundtypes");
const heatmapSels = dc.selectMenu("#sel-fundtypes-years");
const sunBurstSels = dc.selectMenu("#sel-branch-programs");
const recordCounter = dc.dataCount("#records-count");
const totalDisplay = dc.numberDisplay("#number-stat");

//1366 * 768
const laptopScreen = {
    marginLeft: "55.8%", width: "53%", height: "90%", selection: 11
};

//1920 * 1080
const monitorScreen = {
    marginLeft: "39%", width: "37.6%", height: "92%", selection: 13
};

const windowInnerWidth = window.innerWidth;

//load data json files
Promise
    .all([
        PromiseWrapper("json-files/expenditures2(May-22-2018).json"),
        PromiseWrapper("json-files/sunburst-colors.json")
    ])
    .then((resolve) => viz(resolve[0], resolve[1]));

function viz(response, sunburstColors) {

    //color scales
    const departments = [...new Set(response.map(d => d.department))];
    const branches = [...new Set(response.map(d => d.branch))];
    const programs = [...new Set(response.map(d => d.program))];
    const branProgs = [branches, programs].reduce((acc, curArr) => acc.concat(curArr),[]);
    const sunBurstColorScale = d3.scaleOrdinal().domain(branProgs).range(sunburstColors);
    const rowColorScale = d3.scaleOrdinal().domain(departments).range(rowColors);

    let ndx = crossfilter(response);

    //dimensions
    let branProgDim = ndx.dimension(d => [d["branch"], d["program"]]);
    let departDim = ndx.dimension(d => d["department"]);
    let fundTypeDim = ndx.dimension(d => d["fund_type"]);
    let fundTypeYearDim = ndx.dimension(d => [d["fund_type"], d["budget_year"]]);
    let budgetYrDim = ndx.dimension(d => d["budget_year"]);

    //groups
    let branProgGrp = branProgDim.group().reduceSum(d => d["budget"]);
    let departGrp = departDim.group().reduceSum(d => d["budget"]);
    let fundTypeYearGrp = fundTypeYearDim.group().reduceSum(d => d["budget"]);
    let fundTypeGrp = fundTypeDim.group().reduceSum(d => d["budget"]);
    let budgetYrGrp = budgetYrDim.group().reduceSum(d => d["budget"]);
    let sumofAllExpends = ndx.groupAll().reduceSum(d => d["budget"]);


    //title, multiple, order assignment, and customFilter func for each select menu
    [rowSels, fundsSels, yearSels, heatmapSels, sunBurstSels].forEach(sel => {
        sel
            .title(d => `${d.key}: $${d.value.toLocaleString()}`)
            .multiple(true)
            .order((a, b) => b.value > a.value ? 1 : a.value > b.value ? -1 : 0);
    });

    //title, viewBoxResizing, and customFilter func for each chart
    [row, sunBurst].forEach(chart => {
        chart
            .title(d => `${d.key}: $${d.value.toLocaleString()}`)
            .useViewBoxResizing(true);
    });

    totalDisplay
        .group(sumofAllExpends)
        .valueAccessor(d => d)
        .formatNumber(d3.format(","));

    recordCounter.dimension(ndx)
        .group(ndx.groupAll())
        .html({
            some: '<strong>%filter-count</strong> selected out of <strong>%total-count</strong> records.',
            all: 'All records selected. Please click on the chart(s) to apply filters.'
        });

    heatMap
        .height(chartMeasure(heatMap, 0.63))
        .margins({
            top: chartMeasure(heatMap, 0.0241), bottom: chartMeasure(heatMap, 0.0362), 
            right: chartMeasure(heatMap, 0.0241), left: chartMeasure(heatMap, 0.0723)
        })
        .dimension(fundTypeYearDim)
        .group(fundTypeYearGrp)
        .keyAccessor(d => d.key[0])
        .valueAccessor(d => d.key[1])
        .useViewBoxResizing(true)
        .title(d => {
            return "Fund Type: " + d.key[0] + "\n" +
                   "Year: " + d.key[1] + "\n" +
                   "Value: $" + d.value.toLocaleString();
        })
        .colorAccessor(d => d.value)
        .colors(['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#08519c','#08306b'])
        .calculateColorDomain()
        .on("preRender.heat", colorUpdate)
        .on("preRedraw.heat", colorUpdate);

    row
        .height(chartMeasure(row, 0.9))
        .margins({
            top: chartMeasure(row, 0.024), left: chartMeasure(row, 0.012), 
            bottom: chartMeasure(row, 0.043), right: chartMeasure(row, 0.024)
        })
        .dimension(departDim)
        .elasticX(true)
        .colors(rowColorScale)
        .colorAccessor(d => d.key)
        .group(departGrp);
    row.xAxis().ticks(4); 
    
    sunBurst
        .height(sunBurst.width() * 0.898)
        .label(d => d.budget, false)
        .dimension(branProgDim)
        .group(branProgGrp)
        .colors(sunBurstColorScale)
        .colorAccessor(d => d.key);

    table
        .dimension(budgetYrDim )
        .group(d => d["budget"])
        .size(10)
        .columns([
            {
                label: "Department",
                format: d => d["department"]
            },
            {
                label: "Branch",
                format: d => d["branch"]
            },
            {
                label: "Program",
                format: d => d["program"]
            },
            {
                label: "Fund Type",
                format: d => d["fund_type"]
            },
            {
                label: "Budget Year",
                format: d => d["budget_year"]
            },
            {
                label: "Budget",
                format: d => `$${d["budget"].toLocaleString()}`
            }
        ]);

    rowSels
        .dimension(departDim)
        .group(departGrp)
        .numberVisible(screenSelector().selection);   

    yearSels
        .dimension(budgetYrDim)
        .group(budgetYrGrp)
        .numberVisible(4); 

    fundsSels
        .dimension(fundTypeDim)
        .group(fundTypeGrp)
        .numberVisible(5);

    heatmapSels
        .dimension(fundTypeYearDim)
        .group(fundTypeYearGrp)
        .numberVisible(10);

    sunBurstSels
        .dimension(branProgDim)
        .group(branProgGrp)
        .numberVisible(screenSelector().selection);   

    dc.renderAll();

    //----------Tried - zoom feature for sunburst chart
    //----------Stackoverflow help - https://stackoverflow.com/questions/44485404/d3-behavior-zoom-moves-graph-to-corner-instead-of-center
    // const svg = d3.select("#sun-burst > svg");
    // const width = svg.node().getBoundingClientRect().width;
    // const height = svg.node().getBoundingClientRect().height;
    // const sunBurstG = d3.select("#sun-burst > svg > g");

    // const sunBurstZoom = d3.zoom().scaleExtent([1, 10]).on("zoom.sunburst", function() {
    //     svg.attr("viewBox","" + (-width / 2) + " " + (-height / 2) + " " + width + " " + height);
    //     return sunBurstG.attr("transform", d3.event.transform);
    // });

    // svg.call(sunBurstZoom);
    //----------Tried - zoom feature for sunburst 
    
    function colorUpdate(chart, filter) {
        eventTrigger(() => chart.calculateColorDomain(d3.extent(chart.group().all(), chart.valueAccessor())));
    };

    function eventTrigger(func) {
        return dc.events.trigger(func);
    };

    function chartMeasure(chart, widthPercent) {
        return chart.width() * widthPercent;
    };
};

function screenSelector(size = windowInnerWidth) {
    return size <= 768 ? laptopScreen:
           size > 768 && size <= 1366 ? laptopScreen:
           monitorScreen;
};

//--------------- W3 Schools Helper Functions 
function w3_open() {
    document.getElementById("main").style.marginLeft = screenSelector().marginLeft;
    document.getElementById("mySidebar").style.width = screenSelector().width;
    document.getElementById("mySidebar").style.height = screenSelector().height;
    document.getElementById("mySidebar").style.display = "block";
};

function w3_close() {
    document.getElementById("main").style.marginLeft = "0%";
    document.getElementById("mySidebar").style.display = "none";
    document.getElementById("openNav").style.display = "inline-block";
};

function myAccFunc(id) {
    const x = document.getElementById(id);
    if (x.className.indexOf("w3-show") == -1) {
        x.className += " w3-show";
        x.previousElementSibling.className += " w3-darkblue";
    } else { 
        x.className = x.className.replace(" w3-show", "");
        x.previousElementSibling.className = 
        x.previousElementSibling.className.replace(" w3-darkblue", "");
    };
};
//--------------- W3 Schools Helper Functions 