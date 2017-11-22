function formatDependencies(hosts, dependencies, hierarchical, positionData) {

    var hostObj = {};
    var positionObj = {};


    //  Passed objects are are ordered by Obj.results[i].attrs.hostName.var, would be easier to use Obj['hostName'].var
    //  Convert to Obj[hostName].var format while combining hosts and dependency objects:

    for (i = 0; i <dependencies.results.length; i++) { //build base hostObj out of dependencies, add state infromation later

        [hostName, parentName] = (dependencies.results[i].name).split('!Parent'); //need to split due to names in dependencies.json being 'hostName!ParentparentName'

        if (hostObj[hostName] === undefined) { //initialize host obj child entry if it does not exit
            hostObj[hostName] = {
                status: '',
                parents: [parentName],
                hasDependencies: true,
                group: '',
                children: [],
            }
        } else {
            hostObj[hostName].parents.push(parentName);
        }

        if (hostObj[parentName] === undefined) { //initialize host obj parent entry if it does not exit

            hostObj[parentName] = {
                status: '',
                parents: [],
                hasDependencies: true,
                group: '',
                children: [hostName],
            }
        } else {
            hostObj[parentName].children.push(hostName); //
        }

    }

    for (i = 0; i < hosts.results.length; i++) {

        if (hosts.results[i].attrs.state === 0) { //if host is in a sate of 0 it is up, if '1' it is considered down, but can also be unreachable.
            hostStatus = 'UP';
        } else if (hosts.results[i].attrs.state === 1) {

            if (hosts.results[i].attrs.last_reachable === false) {
                hostStatus = 'UNREACHABLE';
            } else {
                hostStatus = 'DOWN';
            }
        }

        if (hostObj[hosts.results[i].name] != undefined) { //insert into hostObj if dependencies exist
            hostObj[hosts.results[i].name].status = hostStatus;
            hostObj[hosts.results[i].name].group = hosts.results[i].attrs.groups[0];
        }

        if(positionData != null && positionData[i] != undefined){ //build positionObj 
            positionObj[positionData[i].node_name] = {
                node_x: positionData[i].node_x,
                node_y: positionData[i].node_y
            }
        }
    }

    console.log(Object.keys(positionObj).length)
    console.log(Object.keys(hostObj).length)


    if(Object.keys(positionObj).length != Object.keys(hostObj).length){ //if these are not the same, a host with dependencies has been removed/added
        positionObj = {}; //reset signals new network generation
    }

    drawNetwork(hostObj, hierarchical, positionObj);

}

function drawNetwork(hostObj, hierarchical, positionObj) {

    var redraw = true;

    color_background = 'white'

    var nodes = new vis.DataSet([]);

    var edges = new vis.DataSet([]);

    for (i = 0; i < Object.keys(hostObj).length; i++) {

        currHost = Object.keys(hostObj)[i];

        if (hostObj[currHost].hasDependencies) {

            if (hostObj[currHost].status === 'DOWN') {
                color_border = 'red';
            }

            if (hostObj[currHost].status === 'UNREACHABLE') {
                color_border = 'purple';
            }

            if (hostObj[currHost].status === 'UP') {
                color_border = 'green';
            }

            if (Object.keys(positionObj).length === 0) {
                nodes.update({
                    id: currHost,
                    label: currHost,
                    mass: (hostObj[currHost].children.length / 4) + 1,
                    color: {
                        border: color_border,
                        background: color_background
                    },
                    size: (hostObj[currHost].children.length * 3) + 20, //generate new x/y coordinates on network generation
                });
            } else {

                nodes.update({
                    id: currHost,
                    label: currHost,
                    mass: (hostObj[currHost].children.length / 4) + 1,
                    color: {
                        border: color_border,
                        background: color_background
                    },
                    
                    size: (hostObj[currHost].children.length * 3) + 20,
                    x: positionObj[currHost].node_x,
                    y: positionObj[currHost].node_y
                });
            }


            for (y = 0; y < hostObj[currHost].parents.length; y++) {

                edges.update({
                    from: hostObj[currHost].parents[y],
                    to: currHost
                });

            }

        }

    }

    var networkData = {
        nodes: nodes,
        edges: edges
    };

    var container = document.getElementById('dependency-network');

    const hierarchyOptions = {
        layout: {

            randomSeed: 728804,

            // improvedLayout: true,
            hierarchical: {
                enabled: true,
                levelSeparation: 200,
                nodeSpacing: 150,
                treeSpacing: 200,
                blockShifting: true,
                edgeMinimization: true,
                parentCentralization: true,
                direction: 'UD', // UD, DU, LR, RL
                sortMethod: 'directed' // hubsize, directed
            },

        },
        edges: {
            arrows: {
                middle: {
                    enabled: true,
                    scaleFactor: 1,
                    type: 'arrow'
                }
            },
        },
        nodes: {
            shape: 'square', // color: '#ff0000',
            fixed: true,
            // font: '12px arial red',
            scaling: {
                min: 1,
                max: 15,
                label: {
                    enabled: true,
                    min: 14,
                    max: 30,
                    maxVisible: 30,
                    drawThreshold: 5
                },

            },
        }
    };

    const networkOptions = {

        layout: {
            randomSeed: 728804
        },
        edges: {
            smooth: {
                "forceDirection": "none",
            }
        },

        nodes: {
            fixed: true,
            scaling: {
                label: true
            },
            shape: 'dot'
        },
    };


    if (hierarchical) {
        var network = new vis.Network(container, networkData, hierarchyOptions);
    } else {

        var network = new vis.Network(container, networkData, networkOptions);

        if (Object.keys(positionObj).length === 0) {
            network.setOptions({
                nodes: {
                    fixed: false
                }
            });
        }
    }

    if (redraw) {
        network.on("stabilizationProgress", function (params) {
            var maxWidth = 496;
            var minWidth = 20;
            var widthFactor = params.iterations / params.total;
            var width = Math.max(minWidth, maxWidth * widthFactor);

            document.getElementById('bar').style.width = width + 'px';
            document.getElementById('text').innerHTML = Math.round(widthFactor * 100) + '%';
        });

        network.once("stabilizationIterationsDone", function () {
            document.getElementById('text').innerHTML = '100%';
            document.getElementById('bar').style.width = '496px';
            document.getElementById('loadingBar').style.opacity = 0;
            // really clean the dom element
            setTimeout(function () {
                document.getElementById('loadingBar').style.display = 'none';
            }, 500);
        });
        redraw = false;
    }

    $('#zoomBtn').click(function () {

        network.setOptions({
            nodes: {
                fixed: false
            }
        });

        $('.zoom-btn-sm').toggleClass('scale-out');
        if ($('.zoom-btn-sm').hasClass('scale-out')) {
            network.setOptions({
                nodes: {
                    fixed: true
                }
            });
        }
    });

    $('.zoom-btn-sm').click(function () {
        network.setOptions({
            nodes: {
                fixed: true
            }
        });

        network.storePositions()

        $.ajax({
            url: "/icingaweb2/dependency_plugin/graph/storeNodes",
            type: 'POST',
            data: {
                json: JSON.stringify(nodes._data)
            }
        });
    });

    network.on("doubleClick", function (params) {
        if (params.nodes[0] != undefined) {
            href = location.href.split('/');
            location.href = 'http://' + href[2] + '/icingaweb2/monitoring/list/hosts#!/icingaweb2/monitoring/host/show?host=' + params.nodes[0];
        }
    });

}