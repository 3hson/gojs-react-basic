/*
*  Copyright (C) 1998-2021 by Northwoods Software Corporation. All Rights Reserved.
*/

import * as go from 'gojs';
import { ReactDiagram } from 'gojs-react';
import * as React from 'react';

import { GuidedDraggingTool } from '../GuidedDraggingTool';

import './Diagram.css';

interface DiagramProps {
  nodeDataArray: Array<go.ObjectData>;
  linkDataArray: Array<go.ObjectData>;
  modelData: go.ObjectData;
  skipsDiagramUpdate: boolean;
  onDiagramEvent: (e: go.DiagramEvent) => void;
  onModelChange: (e: go.IncrementalData) => void;
}

export class DiagramWrapper extends React.Component<DiagramProps, {}> {
  /**
   * Ref to keep a reference to the Diagram component, which provides access to the GoJS diagram via getDiagram().
   */
  private diagramRef: React.RefObject<ReactDiagram>;

  /** @internal */
  constructor(props: DiagramProps) {
    super(props);
    this.diagramRef = React.createRef();
  }

  /**
   * Get the diagram reference and add any desired diagram listeners.
   * Typically the same function will be used for each listener, with the function using a switch statement to handle the events.
   */
  public componentDidMount() {
    if (!this.diagramRef.current) return;
    const diagram = this.diagramRef.current.getDiagram();
    if (diagram instanceof go.Diagram) {
      diagram.addDiagramListener('ChangedSelection', this.props.onDiagramEvent);
    }
  }

  /**
   * Get the diagram reference and remove listeners that were added during mounting.
   */
  public componentWillUnmount() {
    if (!this.diagramRef.current) return;
    const diagram = this.diagramRef.current.getDiagram();
    if (diagram instanceof go.Diagram) {
      diagram.removeDiagramListener('ChangedSelection', this.props.onDiagramEvent);
    }
  }

  /**
   * Diagram initialization method, which is passed to the ReactDiagram component.
   * This method is responsible for making the diagram and initializing the model, any templates,
   * and maybe doing other initialization tasks like customizing tools.
   * The model's data should not be set here, as the ReactDiagram component handles that.
   */
  private initDiagram(): go.Diagram {
    const $ = go.GraphObject.make;
    // set your license key here before creating the diagram: go.Diagram.licenseKey = "...";
    const diagram =
      $(go.Diagram,
        {
          'undoManager.isEnabled': true,  // must be set to allow for model change listening
          // 'undoManager.maxHistoryLength': 0,  // uncomment disable undo/redo functionality
          // 'clickCreatingTool.archetypeNodeData': { text: 'new node', color: 'lightblue' },
          draggingTool: new GuidedDraggingTool(),  // defined in GuidedDraggingTool.ts
          'draggingTool.horizontalGuidelineColor': 'blue',
          'draggingTool.verticalGuidelineColor': 'blue',
          'draggingTool.centerGuidelineColor': 'green',
          'draggingTool.guidelineWidth': 1,
          contentAlignment: go.Spot.TopRight,
          layout: $(go.TreeLayout, {
            treeStyle: go.TreeLayout.StyleLastParents,
            arrangement: go.TreeLayout.ArrangementHorizontal,
            setsPortSpot: true,
            // properties for most of the tree:
            angle: 90,
            layerSpacing: 35,
            alignment: go.TreeLayout.AlignmentStart,
            // properties for the "last parents":
            // alternateAngle: 180,
            // alternateLayerSpacing: 35,
            // alternateAlignment: go.TreeLayout.AlignmentBus,
            // alternateNodeSpacing: 10,
          }),
          model: $(go.GraphLinksModel,
            {
              linkKeyProperty: 'key',  // IMPORTANT! must be defined for merges and data sync when using GraphLinksModel
              // positive keys for nodes
              makeUniqueKeyFunction: (m: go.Model, data: any) => {
                let k = data.key || 1;
                while (m.findNodeDataForKey(k)) k++;
                data.key = k;
                return k;
              },
              // negative keys for links
              makeUniqueLinkKeyFunction: (m: go.GraphLinksModel, data: any) => {
                let k = data.key || -1;
                while (m.findLinkDataForKey(k)) k--;
                data.key = k;
                return k;
              }
            })
        });
        function textStyle() {
          return { font: "9pt  Segoe UI,sans-serif", stroke: "white",       textAlign: "right",        };
        }

        function mayWorkFor(node1, node2) {
          if (!(node1 instanceof go.Node)) return false;  // must be a Node
          if (node1 === node2) return false;  // cannot work for yourself
          if (node2.isInTreeOf(node1)) return false;  // cannot work for someone who works for you
          return true;
        }

        function nodeDoubleClick(e, obj) {
          var clicked = obj.part;
          if (clicked !== null) {
            var thisemp = clicked.data;
            diagram.startTransaction("add employee");
            var newemp = {
              name: "(new person)",
              text: "",
              comments: "",
              parent: thisemp.key
            };
            diagram.model.addNodeData(newemp);
            diagram.commitTransaction("add employee");
          }
        }

              // This converter is used by the Picture.
      function findHeadShot(key) {
        if (key < 0 || key > 16) return "images/HSnopic.jpg"; // There are only 16 images on the server
        return "images/HS" + key + ".jpg"
      }
      // diagram.diagram.toolManager.linkingTool.canStart()
  
      // define a simple Node template
      diagram.nodeTemplate =
        $(go.Node, "Auto",
          { doubleClick: nodeDoubleClick },
          { // handle dragging a Node onto a Node to (maybe) change the reporting relationship
            mouseDragEnter: function(e, node, prev) {
              var diagram = node.diagram;
              var selnode = diagram.selection.first();
              if (!mayWorkFor(selnode, node)) return;
              var shape = node.findObject("SHAPE");
              if (shape) {
                shape._prevFill = shape.fill;  // remember the original brush
                shape.fill = "darkred";
              }
            },
            mouseDragLeave: function(e, node, next) {
              var shape = node.findObject("SHAPE");
              if (shape && shape._prevFill) {
                shape.fill = shape._prevFill;  // restore the original brush
              }
            },
            mouseDrop: function(e, node) {
              var diagram = node.diagram;
              var selnode = diagram.selection.first();  // assume just one Node in selection
              if (mayWorkFor(selnode, node)) {
                // find any existing link into the selected node
                var link = selnode.findTreeParentLink();
                if (link !== null) {  // reconnect any existing link
                  link.fromNode = node;
                } else {  // else create a new link
                  diagram.toolManager.linkingTool.insertLink(node, node.port, selnode, selnode.port);
                }
              }
            }
          },
          
          // for sorting, have the Node.text be the data.name
          new go.Binding("text", "name"),
          // bind the Part.layerName to control the Node's layer depending on whether it isSelected
          new go.Binding("layerName", "isSelected", function(sel) { return sel ? "Foreground" : ""; }).ofObject(),
          // define the node's outer shape
          $(go.Shape, "Rectangle",
            {
              name: "SHAPE", fill: "#333333", stroke: 'white', strokeWidth: 3.5,
              // set the port properties:
              portId: "", fromLinkable: true, toLinkable: true, cursor: "pointer"
            }),
          $(go.Panel, "Horizontal",
            $(go.Picture,
              {
                name: "Picture",
                desiredSize: new go.Size(70, 70),
                margin: 1.5,
              },
              new go.Binding("source", "key", findHeadShot)),
            // define the panel where the text will appear
            $(go.Panel, "Table",
              {
                minSize: new go.Size(130, NaN),
                maxSize: new go.Size(150, NaN),
                margin: new go.Margin(6, 10, 0, 6),
                defaultAlignment: go.Spot.Left,


              },
              $(go.RowColumnDefinition, { column: 2, width: 4 }),
              $(go.TextBlock, textStyle(),  // the name
                {
                  row: 0, column: 0, columnSpan: 5,
                  font: "12pt Segoe UI,sans-serif",
                  editable: true, isMultiline: false,
                  minSize: new go.Size(10, 16)
                },
                new go.Binding("text", "name").makeTwoWay()),
              $(go.TextBlock, "Text: ", textStyle(),
                { row: 1, column: 0 }),
              $(go.TextBlock, textStyle(),
                {
                  row: 1, column: 1, columnSpan: 4,
                  editable: true, isMultiline: false,
                  minSize: new go.Size(10, 14),
                  margin: new go.Margin(0, 0, 0, 3)
                },
                new go.Binding("text", "text").makeTwoWay()),
              $(go.TextBlock, textStyle(),
                { row: 2, column: 0 },
                new go.Binding("text", "key", function(v) { return "ID: " + v; })),
              $(go.TextBlock, textStyle(),
                { name: "boss", row: 2, column: 3, }, // we include a name so we can access this TextBlock when deleting Nodes/Links
                new go.Binding("text", "parent", function(v) { return "Boss: " + v; })),
              $(go.TextBlock, textStyle(),  // the comments
                {
                  row: 3, column: 0, columnSpan: 5,
                  font: "italic 9pt sans-serif",
                  wrap: go.TextBlock.WrapFit,
                  editable: true,  // by default newlines are allowed
                  minSize: new go.Size(10, 14)
                },
                new go.Binding("text", "comments").makeTwoWay())
            )  // end Table Panel
          ) // end Horizontal Panel
        );  // end Node

    
    return diagram;
  }

  public render() {
    return (
      <ReactDiagram
        ref={this.diagramRef}
        divClassName='diagram-component'
        initDiagram={this.initDiagram}
        nodeDataArray={this.props.nodeDataArray}
        linkDataArray={this.props.linkDataArray}
        modelData={this.props.modelData}
        onModelChange={this.props.onModelChange}
        skipsDiagramUpdate={this.props.skipsDiagramUpdate}
      />
    );
  }
}
