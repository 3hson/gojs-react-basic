/*
 *  Copyright (C) 1998-2021 by Northwoods Software Corporation. All Rights Reserved.
 */

import * as go from "gojs";
import { ReactDiagram } from "gojs-react";
import * as React from "react";
import { defaultProfileBase64, expandIconBase64, moreIconBase64} from "./icons";

import "./Diagram.css";

interface DiagramProps {
  nodeDataArray: Array<go.ObjectData>;
  modelData: go.ObjectData;
  skipsDiagramUpdate: boolean;
  onDiagramEvent: (e: go.DiagramEvent) => void;
  onModelChange: (e: go.IncrementalData) => void;
}

const DiagramWrapper: React.FC<DiagramProps> = ({
  nodeDataArray,
  modelData,
  onModelChange,
  onDiagramEvent,
  skipsDiagramUpdate,
}) => {
  const diagramRef = React.useRef<ReactDiagram>(null);

  React.useEffect(() => {
    /**
     * Get the diagram reference and add any desired diagram listeners.
     * Typically the same function will be used for each listener, with the function using a switch statement to handle the events.
     */
    if (!diagramRef.current) return;
    const diagram = diagramRef.current.getDiagram();
    if (diagram instanceof go.Diagram) {
      diagram.addDiagramListener("ChangedSelection", onDiagramEvent);
    }

    return () => {
      if (!diagramRef.current) return;
      const diagram = diagramRef.current.getDiagram();
      if (diagram instanceof go.Diagram) {
        diagram.removeDiagramListener("ChangedSelection", onDiagramEvent);
      }
    };
  }, []);

  /**
   * Diagram initialization method, which is passed to the ReactDiagram component.
   * This method is responsible for making the diagram and initializing the model, any templates,
   * and maybe doing other initialization tasks like customizing tools.
   * The model's data should not be set here, as the ReactDiagram component handles that.
   */
  const initDiagram = (): go.Diagram => {
    const $ = go.GraphObject.make;
    let myDiagram = $(go.Diagram, {
      maxSelectionCount: 1, // users can select only one part at a time
      validCycle: go.Diagram.CycleDestinationTree, // make sure users can only create trees
      "clickCreatingTool.archetypeNodeData": {
        // allow double-click in background to create a new node
        name: "(new person)",
        title: "",
        comments: "",
      },
      "clickCreatingTool.insertPart": function (loc) {
        // scroll to the new node
        var node = go.ClickCreatingTool.prototype.insertPart.call(this, loc);
        if (node !== null) {
          this.diagram.select(node);
          this.diagram.commandHandler.scrollToPart(node);
          this.diagram.commandHandler.editTextBlock(node.findObject("NAMETB"));
        }
        return node;
      },
      allowMove: false,
      layout: $(go.TreeLayout, {
        treeStyle: go.TreeLayout.StyleLastParents,
        // arrangement: go.TreeLayout.ArrangementHorizontal,
        arrangement: go.TreeLayout.ArrangementFixedRoots,
        // properties for most of the tree:
        angle: 180,
        layerSpacing: 35,
        // properties for the "last parents":
        alternateAngle: 90,
        alternateLayerSpacing: 35,
        alternateAlignment: go.TreeLayout.AlignmentBus,
        alternateNodeSpacing: 20,
      }),
      model: $(go.TreeModel),

      "undoManager.isEnabled": true, // enable undo & redo
    });
    // when the document is modified, add a "*" to the title and enable the "Save" button
    myDiagram.addDiagramListener("Modified", function (e) {
      var button = document.getElementById("SaveButton");
      if (button) button.disabled = !myDiagram.isModified;
      var idx = document.title.indexOf("*");
      if (myDiagram.isModified) {
        if (idx < 0) document.title += "*";
      } else {
        if (idx >= 0) document.title = document.title.substr(0, idx);
      }
    });

    // manage boss info manually when a node or link is deleted from the diagram
    myDiagram.addDiagramListener("SelectionDeleting", function (e) {
      var part = e.subject.first(); // e.subject is the myDiagram.selection collection,
      // so we'll get the first since we know we only have one selection
      myDiagram.startTransaction("clear boss");
      if (part instanceof go.Node) {
        var it = part.findTreeChildrenNodes(); // find all child nodes
        while (it.next()) {
          // now iterate through them and clear out the boss information
          var child = it.value;
          var bossText = child.findObject("boss"); // since the boss TextBlock is named, we can access it by name
          if (bossText === null) return;
          bossText.text = "";
        }
      } else if (part instanceof go.Link) {
        var child = part.toNode;
        var bossText = child.findObject("boss"); // since the boss TextBlock is named, we can access it by name
        if (bossText === null) return;
        bossText.text = "";
      }
      myDiagram.commitTransaction("clear boss");
    });

    myDiagram.layout.commitNodes = function () {
      go.TreeLayout.prototype.commitNodes.call(myDiagram.layout); // do the standard behavior
      // then go through all of the vertexes and set their corresponding node's Shape.fill
      // to a brush dependent on the TreeVertex.level value
      myDiagram.layout.network.vertexes.each(function (v) {
        if (v.node) {
          const isRoot = v.node.findTreeParentNode() === null;
          var color = isRoot ? '#007E82' : '#DDDDDD';
          var shape = v.node.findObject("SHAPE");
          if (shape)
            shape.stroke = $(go.Brush, "Linear", {
              0: color,
              1: color,
            });
        }
      });
    };

    // This function provides a common style for most of the TextBlocks.
    // Some of these values may be overridden in a particular TextBlock.
    function textStyle() {
      return { font: "14px  Segoe UI,sans-serif", stroke: "#222222" };
    }

    // define the Node template
    myDiagram.nodeTemplate = $(
      go.Node,
      "Auto",
      {
        isTreeExpanded: false,
        selectionAdorned: false,
      },
      // for sorting, have the Node.text be the data.name
      new go.Binding("text", "name"),
      // bind the Part.layerName to control the Node's layer depending on whether it isSelected
      new go.Binding("layerName", "isSelected", function (sel) {
        return sel ? "Foreground" : "";
      }).ofObject(),
      // define the node's outer shape
      $(go.Shape, "RoundedRectangle", {
        name: "SHAPE",
        fill: "white",
        stroke: "white",
        strokeWidth: 1.5,
        portId: "",
        fromLinkable: false,
        toLinkable: false,
        cursor: "default",
      }),
      $(
        go.Panel,
        "Vertical",
        {
          minSize: new go.Size(170, NaN),
          maxSize: new go.Size(170, NaN),
          defaultAlignment: go.Spot.Right,
          defaultStretch: go.GraphObject.Horizontal,
        },
        $(
          go.Panel,
          "Horizontal",
          {
            margin: new go.Margin(3, 3, 3, 3),
          },
          $(
            go.Panel,
            "Horizontal",
            {
              defaultAlignment: go.Spot.Left,
              width: 30,
            },
            $(
              go.Picture,
              {
                name: "Picture",
                desiredSize: new go.Size(24, 24),
              },
              new go.Binding("source", "key", function () {
                return moreIconBase64;
              }),
              { width: 24, height: 24 }
            )
          ),
          $(
            go.TextBlock,
            textStyle(),
            {
              font: "bold 14px  Segoe UI,sans-serif",
              margin: new go.Margin(0, 5, 0, 0),
              overflow: go.TextBlock.OverflowEllipsis,
              maxLines: 1,
              width: 90,
              textAlign: "right",
            },
            new go.Binding("text", "name").makeTwoWay()
          ),
          $(
            go.Panel,
            "Spot",
            { isClipping: true, scale: 2 },
            $(go.Shape, "Circle", { width: 20, strokeWidth: 0 }),
            $(
              go.Picture,
              {
                name: "Picture",
                desiredSize: new go.Size(20, 20),
                imageStretch: go.GraphObject.UniformToFill,
              },
              new go.Binding("source", "picture", function (image) {
                if (image) {
                  return image;
                }
                return defaultProfileBase64;
              }),
              { width: 20, height: 20 }
            )
          )
        ), // end Horizontal Panel
        $(
          go.Panel,
          "Table",
          {
            margin: new go.Margin(10, 3, 5, 0),
            defaultStretch: go.GraphObject.Horizontal,
          },
          $(
            "TreeExpanderButton",
            {
              width: 22,
              height: 22,
              margin: 4,
              "ButtonBorder.figure": "Circle",
              "ButtonBorder.fill": "#B0B0B0",
              "_buttonFillOver": "#ccc",
              "ButtonBorder.strokeWidth": 10,
            },
            // $(go.Shape, "Ellipse", {
            //   width: 22,
            //   height: 22,
            //   margin: 4,
            //   fill: "#DDDDDD",
            //   stroke: null,
            // }),
            // $(
            //   go.Picture,
            //   {
            //     name: "Picture",
            //     width: 14,
            //     height: 7,
            //     row: 0,
            //     column: 0,
            //   },
            //   new go.Binding("source", "key", function () {
            //     return expandIconBase64;
            //   })
            // ),
            new go.Binding("visible", "mainnode", function (key) {
              return key !== 1;
            })
          ),
          $(
            go.TextBlock,
            textStyle(),
            {
              margin: new go.Margin(0, 7, 0, 0),
              row: 0,
              column: 1,
            },
            new go.Binding("text", "pv", function (v, target) {
              return "PV:" + v;
            }).makeTwoWay()
          ),
          $(
            go.TextBlock,
            textStyle(),
            {
              margin: new go.Margin(0, 0, 0, 0),
              row: 0,
              column: 2,
              alignment: go.Spot.Center,
            },
            new go.Binding("text", "gpv", function (v) {
              return "GPV:" + v;
            }).makeTwoWay()
          )
        ), // end Horizontal Panel
        $(
          go.TextBlock,
          textStyle(),
          {
            font: "12px  Segoe UI,sans-serif",
            margin: new go.Margin(0, 3, 5, 5),
          },
          new go.Binding("text", "all/active", function (v) {
            return "زیر مجموعه‌های فعال: " + v;
          }).makeTwoWay()
        ) // end Horizontal Panel
      ) // end Vertical Panel
    ); // end Node

    // define the Link template
    myDiagram.linkTemplate = $(
      go.Link,
      go.Link.Orthogonal,
      { corner: 0, relinkableFrom: false, relinkableTo: false },
      $(go.Shape, { strokeWidth: 1.5, stroke: "#222222" })
    ); // the link shape

    // // read in the JSON-format data from the "mySavedModel" element
    // load();


    // // Setup zoom to fit button
    // document.getElementById('zoomToFit').addEventListener('click', function() {
    //   myDiagram.commandHandler.zoomToFit();
    // });

    // document.getElementById('centerRoot').addEventListener('click', function() {
    //   myDiagram.scale = 1;
    //   myDiagram.commandHandler.scrollToPart(myDiagram.findNodeForKey(1));
    // });
    return myDiagram;
  }; // end init
  // Show the diagram's model in JSON format
  // function save() {
  //   if(diagramRef.current)
  //   document.getElementById("mySavedModel").value = myDiagram.model.toJson();
  //   myDiagram.isModified = false;
  // }
  // function load() {
  //   myDiagram.model = go.Model.fromJson(document.getElementById("mySavedModel").value);
  //   // make sure new data keys are unique positive integers
  //   var lastkey = 1;
  //   myDiagram.model.makeUniqueKeyFunction = function(model, data) {
  //     var k = data.key || lastkey;
  //     while (model.findNodeDataForKey(k)) k++;
  //     data.key = lastkey = k;
  //     return k;
  //   };
  // }

  return (
    <ReactDiagram
      ref={diagramRef}
      divClassName="diagram-component"
      initDiagram={initDiagram}
      nodeDataArray={nodeDataArray}
      modelData={modelData}
      onModelChange={onModelChange}
      skipsDiagramUpdate={skipsDiagramUpdate}
    />
  );
};

export default DiagramWrapper;
